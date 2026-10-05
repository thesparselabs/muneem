import { createHash, randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { UpdateStatus } from '@muneem/contracts';
import { cohortOf } from '../../src/main/update/cohort.js';
import { FolderUpdater } from '../../src/main/update/folderUpdater.js';
import { parseManifest } from '../../src/main/update/manifest.js';
import { writeChannelManifest } from '../../src/main/update/release.js';
import { WAIT_FOR_REGISTER } from '../../src/main/update/installGate.js';
import { caller, grantRole, ownerAtTill, testApp } from '../helpers.js';

const MIN = 60_000;

function installerOf(dir: string, version: string, bytes = 256 * 1024): string {
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `Muneem-Setup-${version}.exe`);
  writeFileSync(file, randomBytes(bytes));
  writeFileSync(`${file}.blockmap`, 'blockmap');
  return file;
}

// The dev update server: a static folder laid out per channel by the release tooling.
async function publish(root: string, channel: string, version: string, rollout: number | null = null): Promise<string> {
  const installer = installerOf(join(root, '..', `build-${version}`), version);
  await writeChannelManifest({ outRoot: root, channel, version, installers: [installer], releaseDate: '2026-10-05T06:00:00.000Z', rolloutPercentage: rollout });
  return installer;
}

async function updatingApp(opts: { feed?: string } = {}) {
  const base = mkdtempSync(join(tmpdir(), 'muneem-updates-'));
  const feed = opts.feed ?? join(base, 'feed');
  const installed: string[] = [];
  let now = Date.parse('2026-10-05T09:00:00Z');
  const updater = new FolderUpdater({ currentVersion: '0.1.0', cacheDir: join(base, 'cache'), onInstall: (f) => installed.push(f) });
  const { app, db } = await testApp({ updater, updateBaseUrl: pathToFileURL(feed).href, appVersion: '0.1.0', registerIdleMs: 10 * MIN, now: () => now });
  const events: UpdateStatus[] = [];
  app.events.attach({ send: (ch, p) => { if (ch === 'update.status') events.push(p as UpdateStatus); } });
  await ownerAtTill(app);
  return { app, db, feed, installed, events, advance: (ms: number) => { now += ms; } };
}

describe('auto-update (8i)', () => {
  it('finds a newer release on its channel, downloads it in the background with progress, and installs when asked', async () => {
    const t = await updatingApp();
    const installer = await publish(t.feed, 'stable', '0.2.0');
    const checked = await caller(t.app).data<UpdateStatus>('update.checkNow');
    expect(checked).toMatchObject({ state: 'available', channel: 'stable', currentVersion: '0.1.0', availableVersion: '0.2.0' });
    await t.app.updates.service.idle();
    expect(t.events.map((e) => e.state)).toEqual(expect.arrayContaining(['checking', 'available', 'downloading', 'ready']));
    expect(t.events.filter((e) => e.state === 'downloading').map((e) => e.percent)).toEqual([...t.events.filter((e) => e.state === 'downloading').map((e) => e.percent)].sort((a, b) => a! - b!));
    const ready = await caller(t.app).data<UpdateStatus>('update.getStatus');
    expect(ready).toMatchObject({ state: 'ready', percent: 100, installBlockedReason: null });
    const notices = await caller(t.app).data<{ items: { kind: string; title: string; link: string | null }[] }>('notifications.list', { status: 'open', limit: 20 });
    expect(notices.items).toEqual(expect.arrayContaining([expect.objectContaining({ kind: 'update_ready', title: 'Update 0.2.0 is ready', link: '/settings/updates' })]));

    await caller(t.app).data('update.installNow');
    expect(t.installed).toHaveLength(1);
    expect(readFileSync(t.installed[0]!)).toEqual(readFileSync(installer));
  });

  it('never installs mid-sale: a cart or an open, busy register defers it until the till goes quiet', async () => {
    const t = await updatingApp();
    await publish(t.feed, 'stable', '0.2.0');
    await caller(t.app).data('pos.openRegister', { openingCashPaise: 0 });
    await caller(t.app).data('update.checkNow');
    await t.app.updates.service.idle();

    await caller(t.app).data('pos.reportCart', { lines: 2 });
    const refused = await caller(t.app).call('update.installNow');
    expect(refused).toMatchObject({ ok: false, error: { code: 'INVALID_STATE', message: expect.stringMatching(/bill is being rung up/) } });
    await caller(t.app).data('pos.reportCart', { lines: 0 });
    expect((await caller(t.app).data<UpdateStatus>('update.getStatus')).installBlockedReason).toBe(WAIT_FOR_REGISTER);
    expect((await caller(t.app).call('update.installNow')).ok).toBe(false);
    expect(t.installed).toEqual([]);

    t.advance(11 * MIN);
    expect((await caller(t.app).data<UpdateStatus>('update.getStatus')).installBlockedReason).toBeNull();
    await caller(t.app).data('update.installNow');
    expect(t.installed).toHaveLength(1);
  });

  it('keeps to its rollout cohort: excluded below its bucket, included once the percentage passes it', async () => {
    const t = await updatingApp();
    const cohort = cohortOf(t.app.device.installationId());
    await publish(t.feed, 'stable', '0.2.0', cohort);
    expect(await caller(t.app).data<UpdateStatus>('update.checkNow')).toMatchObject({ state: 'up_to_date', availableVersion: null });
    await publish(t.feed, 'stable', '0.2.0', cohort + 1);
    t.advance(MIN);
    expect(await caller(t.app).data<UpdateStatus>('update.checkNow')).toMatchObject({ state: 'available', availableVersion: '0.2.0' });
  });

  it('rejects a download that does not match the manifest checksum', async () => {
    const t = await updatingApp();
    const installer = await publish(t.feed, 'stable', '0.2.0');
    writeFileSync(join(t.feed, 'stable', `Muneem-Setup-0.2.0.exe`), randomBytes(256 * 1024));
    await caller(t.app).data('update.checkNow');
    await t.app.updates.service.idle();
    expect(await caller(t.app).data<UpdateStatus>('update.getStatus')).toMatchObject({ state: 'error', error: expect.stringMatching(/sha512/) });
    expect(existsSync(installer)).toBe(true);
    expect((await caller(t.app).call('update.installNow')).ok).toBe(false);
  });

  it('switches channel (owner only) and checks that channel\'s feed; the same version is up to date', async () => {
    const t = await updatingApp();
    await publish(t.feed, 'stable', '0.1.0');
    await publish(t.feed, 'beta', '0.2.0-beta.1');
    expect(await caller(t.app).data<UpdateStatus>('update.checkNow')).toMatchObject({ state: 'up_to_date' });
    const switched = await caller(t.app).data<UpdateStatus>('update.setChannel', { channel: 'beta' });
    expect(switched).toMatchObject({ channel: 'beta', state: 'available', availableVersion: '0.2.0-beta.1' });
    await t.app.updates.service.idle();

    grantRole(t.db, t.app, 'manager');
    expect(await caller(t.app).call('update.setChannel', { channel: 'stable' })).toMatchObject({ ok: false, error: { code: 'PERMISSION_DENIED' } });
    expect((await caller(t.app).call('update.installNow')).ok).toBe(true);
  });

  it('is off without an updater, and reports so', async () => {
    const { app } = await testApp();
    expect(await caller(app).data<UpdateStatus>('update.getStatus')).toMatchObject({ state: 'disabled', lastMigrationFailure: null });
    expect((await app.updates.service.checkNow()).state).toBe('disabled');
  });
});

describe('release manifest (scripts/release-manifest.ts)', () => {
  it('writes latest.yml per channel with sha512, size, release date and the rollout percentage, beside the installer', async () => {
    const root = mkdtempSync(join(tmpdir(), 'muneem-release-'));
    const installer = installerOf(join(root, 'build'), '1.4.0', 10_000);
    const file = await writeChannelManifest({ outRoot: join(root, 'updates'), channel: 'beta', version: '1.4.0', installers: [installer], releaseDate: '2026-10-05T06:00:00.000Z', rolloutPercentage: 10 });
    expect(file).toBe(join(root, 'updates', 'beta', 'latest.yml'));
    const text = readFileSync(file, 'utf8');
    expect(text).toContain("releaseDate: '2026-10-05T06:00:00.000Z'");
    const sha512 = createHash('sha512').update(readFileSync(installer)).digest('base64');
    expect(parseManifest(text)).toEqual({
      version: '1.4.0', files: [{ url: 'Muneem-Setup-1.4.0.exe', sha512, size: 10_000 }], path: 'Muneem-Setup-1.4.0.exe', sha512,
      releaseDate: '2026-10-05T06:00:00.000Z', stagingPercentage: 10,
    });
    expect(existsSync(join(root, 'updates', 'beta', 'Muneem-Setup-1.4.0.exe'))).toBe(true);
    expect(existsSync(join(root, 'updates', 'beta', 'Muneem-Setup-1.4.0.exe.blockmap'))).toBe(true);
  });

  it('leaves the percentage out for a full rollout and refuses a bad channel or percentage', async () => {
    const root = mkdtempSync(join(tmpdir(), 'muneem-release-'));
    const installer = installerOf(join(root, 'build'), '1.4.0', 100);
    const args = { outRoot: root, version: '1.4.0', installers: [installer], releaseDate: '2026-10-05T06:00:00.000Z' };
    for (const rolloutPercentage of [null, 100]) {
      const m = parseManifest(readFileSync(await writeChannelManifest({ ...args, channel: 'stable', rolloutPercentage }), 'utf8'));
      expect(m.stagingPercentage).toBeUndefined();
    }
    await expect(writeChannelManifest({ ...args, channel: 'nightly', rolloutPercentage: null })).rejects.toThrow();
    await expect(writeChannelManifest({ ...args, channel: 'stable', rolloutPercentage: 120 })).rejects.toThrow(/rollout percentage/);
    await expect(writeChannelManifest({ ...args, channel: 'stable', installers: [], rolloutPercentage: null })).rejects.toThrow(/no installer/);
  });
});
