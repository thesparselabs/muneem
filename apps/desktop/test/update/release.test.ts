import { createHash, randomBytes } from 'node:crypto';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { parseManifest } from '../../src/main/update/manifest.js';
import { parseReleaseVersion, promoteRelease, publishChannelFor, writeChannelManifest, writeReleaseArchive } from '../../src/main/update/release.js';

const RELEASE_DATE = '2026-10-05T06:00:00.000Z';
const sha256 = (file: string) => createHash('sha256').update(readFileSync(file)).digest('hex');

function built(version: string) {
  const root = mkdtempSync(join(tmpdir(), 'muneem-promote-'));
  mkdirSync(join(root, 'build'));
  const installer = join(root, 'build', `Muneem-Setup-${version}.exe`);
  writeFileSync(installer, randomBytes(64 * 1024));
  writeFileSync(`${installer}.blockmap`, randomBytes(512));
  return { root, installer, updates: join(root, 'updates') };
}

function hashesOf(dir: string): Record<string, string> {
  return Object.fromEntries(readdirSync(dir).filter((f) => f !== 'latest.yml').map((f) => [f, sha256(join(dir, f))]));
}

describe('channel promotion (promote.yml, ADR-0056)', () => {
  it('copies a beta release to stable byte for byte and changes only the rollout percentage', async () => {
    const { installer, updates } = built('1.4.0');
    await writeChannelManifest({ outRoot: updates, channel: 'beta', version: '1.4.0', installers: [installer], releaseDate: RELEASE_DATE, rolloutPercentage: 100 });
    const beta = parseManifest(readFileSync(join(updates, 'beta', 'latest.yml'), 'utf8'));

    const file = await promoteRelease({ sourceDir: join(updates, 'beta'), outRoot: join(updates, 'promoted'), channel: 'stable', version: '1.4.0', rolloutPercentage: 10 });

    expect(file).toBe(join(updates, 'promoted', 'stable', 'latest.yml'));
    expect(hashesOf(join(updates, 'promoted', 'stable'))).toEqual(hashesOf(join(updates, 'beta')));
    expect(Object.keys(hashesOf(join(updates, 'beta')))).toEqual(['Muneem-Setup-1.4.0.exe', 'Muneem-Setup-1.4.0.exe.blockmap']);
    expect(parseManifest(readFileSync(file, 'utf8'))).toEqual({ ...beta, stagingPercentage: 10 });
  });

  it('halts at 0, widens to everyone at 100, and rewrites a channel in place', async () => {
    const { installer, updates } = built('1.4.0');
    await writeChannelManifest({ outRoot: updates, channel: 'stable', version: '1.4.0', installers: [installer], releaseDate: RELEASE_DATE, rolloutPercentage: 10 });
    const stable = join(updates, 'stable');
    const promote = (rolloutPercentage: number | null) => promoteRelease({ sourceDir: stable, outRoot: updates, channel: 'stable', version: '1.4.0', rolloutPercentage });

    expect(parseManifest(readFileSync(await promote(0), 'utf8')).stagingPercentage).toBe(0);
    expect(parseManifest(readFileSync(await promote(100), 'utf8')).stagingPercentage).toBeUndefined();
    expect(parseManifest(readFileSync(await promote(25), 'utf8'))).toMatchObject({ version: '1.4.0', releaseDate: RELEASE_DATE, stagingPercentage: 25 });
  });

  it('rolls back from the archive, which keeps every version without a rollout', async () => {
    const { installer, updates } = built('1.3.2');
    const archived = await writeReleaseArchive({ outRoot: updates, version: '1.3.2', installers: [installer], releaseDate: RELEASE_DATE });
    expect(archived).toBe(join(updates, 'releases', '1.3.2', 'latest.yml'));
    expect(parseManifest(readFileSync(archived, 'utf8')).stagingPercentage).toBeUndefined();

    const file = await promoteRelease({ sourceDir: join(updates, 'releases', '1.3.2'), outRoot: updates, channel: 'stable', version: '1.3.2', rolloutPercentage: null });
    expect(hashesOf(join(updates, 'stable'))).toEqual(hashesOf(join(updates, 'releases', '1.3.2')));
    expect(parseManifest(readFileSync(file, 'utf8')).version).toBe('1.3.2');
  });

  it('refuses a different version, an altered installer, a bad channel or percentage', async () => {
    const { installer, updates } = built('1.4.0');
    await writeChannelManifest({ outRoot: updates, channel: 'beta', version: '1.4.0', installers: [installer], releaseDate: RELEASE_DATE, rolloutPercentage: null });
    const args = { sourceDir: join(updates, 'beta'), outRoot: join(updates, 'out'), channel: 'stable', version: '1.4.0', rolloutPercentage: 10 };

    await expect(promoteRelease({ ...args, version: '1.5.0' })).rejects.toThrow(/holds 1.4.0, not 1.5.0/);
    await expect(promoteRelease({ ...args, channel: 'nightly' })).rejects.toThrow();
    await expect(promoteRelease({ ...args, rolloutPercentage: 101 })).rejects.toThrow(/rollout percentage/);
    writeFileSync(join(updates, 'beta', 'Muneem-Setup-1.4.0.exe'), randomBytes(64 * 1024));
    await expect(promoteRelease(args)).rejects.toThrow(/does not match its sha512/);
  });
});

describe('release version and channel (scripts/release-version.ts)', () => {
  it('takes the version from a tag', () => {
    expect(parseReleaseVersion('refs/tags/v1.4.0')).toBe('1.4.0');
    expect(parseReleaseVersion('v1.5.0-beta.2')).toBe('1.5.0-beta.2');
    expect(parseReleaseVersion('1.5.0-dev.7')).toBe('1.5.0-dev.7');
    for (const bad of ['', 'v1.4', 'release-1.4.0', '1.4.0-', '1.4.0+build', 'v1.4.0; rm -rf /']) expect(() => parseReleaseVersion(bad)).toThrow(/not a release version/);
  });

  it('publishes a fresh build to dev or beta, never straight to stable', () => {
    expect(publishChannelFor('1.5.0-dev.7')).toBe('dev');
    expect(publishChannelFor('1.5.0-beta.2', 'auto')).toBe('beta');
    expect(publishChannelFor('1.5.0-rc.1')).toBe('beta');
    expect(publishChannelFor('1.5.0')).toBe('beta');
    expect(publishChannelFor('1.5.0', 'dev')).toBe('dev');
    expect(() => publishChannelFor('1.5.0', 'stable')).toThrow(/promote it from beta/);
    expect(() => publishChannelFor('1.5.0', 'nightly')).toThrow();
  });
});

describe('release workflows (.github/workflows)', () => {
  const workflow = (name: string) => parse(readFileSync(new URL(`../../../../.github/workflows/${name}`, import.meta.url), 'utf8')) as {
    on: Record<string, unknown>; jobs: Record<string, { steps?: { run?: string }[] }>;
  };

  it('releases only from a version tag or by hand, and promotes only by hand', () => {
    expect(Object.keys(workflow('release.yml').on).sort()).toEqual(['push', 'workflow_dispatch']);
    expect(workflow('release.yml').on.push).toEqual({ tags: ['v*'] });
    expect(Object.keys(workflow('promote.yml').on)).toEqual(['workflow_dispatch']);
    const ci = JSON.stringify(workflow('ci.yml'));
    expect(ci).not.toMatch(/electron-builder|release:manifest|release:promote/);
  });

  it('builds on Windows, then SBOMs, checksums and publishes after it', () => {
    const { jobs } = workflow('release.yml') as unknown as { jobs: Record<string, { 'runs-on': string; needs?: string[] }> };
    expect(jobs.windows!['runs-on']).toBe('windows-latest');
    expect(jobs.publish!.needs).toEqual(['windows', 'sbom']);
  });

  it('bakes the crash DSN from a repo variable and keeps source maps out of the installer', () => {
    const release = JSON.stringify(workflow('release.yml'));
    expect(release).toContain('"MAIN_VITE_CRASH_DSN":"${{ vars.MUNEEM_CRASH_DSN }}"');
    expect(release).toContain('symbols-${{ steps.plan.outputs.version }}');
    const builder = parse(readFileSync(new URL('../../electron-builder.yml', import.meta.url), 'utf8')) as { files: string[] };
    expect(builder.files).toContain('!out/**/*.map');
  });
});
