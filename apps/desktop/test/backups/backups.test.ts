import { existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { BackupList, LocalBackup, RestoreResult } from '@muneem/contracts';
import { getMeta, listBackupLog, META_KEYS, openDatabase, quickCheck, restoreDatabaseFile, verifyAuditChain, type Db } from '@muneem/db-sqlite';
import type { RestoreHost } from '../../src/main/backups/index.js';
import { MemorySecretStore } from '../../src/main/infra/secrets.js';
import { TransportError } from '../../src/main/sync/transport.js';
import { caller, testApp, USER_ID } from '../helpers.js';
import { goldenDay } from '../sync/goldenDay.js';
import { sell } from '../sync/scenario37.js';
import { books, DEVICE_A, healthy, ownerMembership, referenceCloud, syncedDevice, syncUntilQuiet } from '../sync/syncHelpers.js';
import { DEVICE_C } from '../sync/cloudHarness.js';
import { FakeBackupCloud } from './fakeBackupCloud.js';

const HEALTHY = { tieOuts: [], replay: [], partyMismatches: [], allocationFaults: [] };
const LOGIN = { identifier: '9999999999', password: 'correct-horse' };
const sales = (db: Db) => db.prepare('SELECT COUNT(*) FROM sale').pluck().get() as number;
const product = (db: Db, businessId: string) => db.prepare(`SELECT p.id, p.base_uom_id AS uom FROM product p JOIN stock_level s ON s.product_id = p.id
  WHERE p.business_id = ? GROUP BY p.id ORDER BY SUM(s.qty_milli) DESC LIMIT 1`).get(businessId) as { id: string; uom: string };

// The swap a relaunch would do, recorded so the test can open the restored file as the app would after restarting.
function recordingHost(): RestoreHost & { installed: string[] } {
  const installed: string[] = [];
  return { installed, install: (file) => { installed.push(file); } };
}

describe('encrypted local backups (8f)', () => {
  afterEach(() => { vi.useRealTimers(); });

  it('backs up encrypted and verified, keeps the key in the secret store only, and reports health', async () => {
    const secrets = new MemorySecretStore();
    const { app, db, dir } = await testApp({ file: true, secrets });
    const { businessId } = await goldenDay(app, db);
    const { backup } = await caller(app).data<{ backup: LocalBackup }>('backups.runNow');
    expect(backup).toMatchObject({ kind: 'manual', verified: true, encrypted: true, businessId, error: null, cloudStatus: expect.stringMatching(/pending|uploading|failed/) });
    const files = readdirSync(join(dir, 'backups'));
    expect(files).toEqual([expect.stringMatching(/^muneem-.*-manual\.mbk$/)]);
    const raw = readFileSync(join(dir, 'backups', files[0]!));
    expect(raw.subarray(0, 8).toString()).toBe('MUNEEMBK');
    expect(raw.includes(Buffer.from('SQLite format 3'))).toBe(false);
    expect(raw.includes(Buffer.from('Parle-G'))).toBe(false);
    const stored = JSON.parse(secrets.get(`backup.keys.${businessId}`)!) as { current: string; keys: Record<string, string> };
    expect(Buffer.from(stored.keys[stored.current]!, 'base64')).toHaveLength(32);
    expect(raw.includes(Buffer.from(stored.keys[stored.current]!, 'base64'))).toBe(false);

    const verified = await caller(app).data<{ ok: boolean; rowCounts: Record<string, number> }>('backups.verify', { source: 'local', id: backup.id });
    expect(verified.ok).toBe(true);
    expect(verified.rowCounts.sale).toBe(sales(db));
    const list = await caller(app).data<BackupList>('backups.list');
    expect(list.local.map((b) => b.id)).toEqual([backup.id]);
    expect(list.health).toMatchObject({ status: 'ok', lastSuccessAt: backup.createdAt, lastError: null });
    expect(getMeta(db, META_KEYS.lastBackupAt)).toBe(backup.createdAt);
  });

  it('records a failed backup as the last error, and health says failing until one succeeds', async () => {
    const secrets = new MemorySecretStore();
    const { app, db } = await testApp({ file: true, secrets });
    await goldenDay(app, db);
    const set = secrets.set.bind(secrets);
    secrets.set = () => { throw new Error('keychain locked'); };
    expect((await caller(app).call('backups.runNow')).ok).toBe(false);
    expect(app.backups.backups.health()).toMatchObject({ status: 'failing', lastError: expect.stringContaining('keychain locked') });
    secrets.set = set;
    await app.backups.scheduler.now();
    expect(app.backups.backups.health().status).toBe('ok');
  });

  it('prunes to 7 daily, 4 weekly and 3 monthly across 100 simulated days', async () => {
    let now: number | null = null;
    const { app, db, dir } = await testApp({ file: true, now: () => now ?? Date.now() });
    await goldenDay(app, db);
    for (let day = 0; day < 100; day++) {
      for (const hour of [0, 12]) {
        now = Date.parse('2026-06-01T03:00:00Z') + day * 86_400_000 + hour * 3600_000;
        await app.backups.backups.run('scheduled');
      }
    }
    const kept = app.backups.backups.list();
    expect(kept.length).toBeLessThanOrEqual(14);
    expect(new Set(kept.map((b) => b.createdAt.slice(0, 10))).size).toBe(kept.length);
    expect(readdirSync(join(dir, 'backups')).filter((f) => f.endsWith('.mbk')).sort()).toEqual(kept.map((b) => b.path.split('/').pop()).sort());
    expect(listBackupLog(db, { includePruned: true })).toHaveLength(200);
    expect(kept[0]!.createdAt.slice(0, 10)).toBe('2026-09-08');
  }, 120_000);

  it('restores over a live WAL: the stale WAL is not replayed, identity is kept, the restore is audited, and a safety copy is listed', async () => {
    const host = recordingHost();
    const { app, db, dir } = await testApp({ file: true, restoreHost: host });
    const { businessId } = await goldenDay(app, db);
    const before = sales(db);
    const { backup } = await caller(app).data<{ backup: LocalBackup }>('backups.runNow');
    const p = product(db, businessId);
    await app.register.open(10_000);
    sell(app, p.id, p.uom);
    sell(app, p.id, p.uom);
    expect(sales(db)).toBe(before + 2);

    const r = await caller(app).data<RestoreResult>('backups.restore', { source: 'local', id: backup.id, confirm: true });
    expect(r).toMatchObject({ restarting: true, safetyBackupId: expect.any(String) });
    const dbFile = join(dir, 'muneem.sqlite');
    const wal = readFileSync(dbFile + '-wal');
    expect(wal.length).toBeGreaterThan(0);
    const installation = app.device.installationId();
    app.closeReadConnections();
    db.close();
    writeFileSync(dbFile + '-wal', wal);
    restoreDatabaseFile(host.installed[0]!, dbFile);

    const restored = openDatabase(dbFile);
    expect(quickCheck(restored).ok).toBe(true);
    expect(sales(restored)).toBe(before);
    expect(getMeta(restored, META_KEYS.installationId)).toBe(installation);
    expect(getMeta(restored, META_KEYS.restoreCatchUp)).toBe('1');
    const audit = restored.prepare("SELECT business_id FROM audit_log WHERE action = 'backup.restored'").all();
    expect(audit).toEqual([{ business_id: businessId }]);
    expect(verifyAuditChain(restored, businessId, installation).ok).toBe(true);
    const log = listBackupLog(restored);
    expect(log.map((b) => b.kind)).toEqual(expect.arrayContaining(['manual', 'pre_restore']));
    expect(log.find((b) => b.id === r.safetyBackupId)).toBeDefined();
    restored.close();
  });

  it('refuses a restore without the manage permission, and a tampered local backup', async () => {
    const { app, db } = await testApp({ file: true, restoreHost: recordingHost() });
    await goldenDay(app, db);
    const { backup } = await caller(app).data<{ backup: LocalBackup }>('backups.runNow');
    const raw = readFileSync(listBackupLog(db)[0]!.path);
    raw.writeUInt8(raw.readUInt8(raw.length - 20) ^ 1, raw.length - 20);
    writeFileSync(listBackupLog(db)[0]!.path, raw);
    expect(await caller(app).call('backups.verify', { source: 'local', id: backup.id })).toMatchObject({ ok: true, data: { ok: false, detail: expect.stringMatching(/failed authentication/) } });
    expect(await caller(app).call('backups.restore', { source: 'local', id: backup.id, confirm: true })).toMatchObject({ ok: false, error: { code: 'BACKUP_INVALID' } });
    db.prepare("UPDATE user_membership SET grants_json = '[{\"permission\":\"diagnostics.view\"}]'").run();
    app.session.patch({ permissions: ['diagnostics.view'] });
    expect(await caller(app).call('backups.restore', { source: 'local', id: backup.id, confirm: true })).toMatchObject({ ok: false, error: { code: 'PERMISSION_DENIED' } });
  });
});

describe('cloud backups with key escrow (8f)', () => {
  it('device A backs up and uploads; a fresh device restores the cloud backup, pulls, and its books equal A\'s', async () => {
    const server = referenceCloud();
    server.registerDevice(DEVICE_C, USER_ID);
    const objects = new FakeBackupCloud();
    let businessId = '';
    const memberships = () => (businessId ? [ownerMembership(businessId)] : []);
    const backupOpts = { backupTransport: objects.transportFor.bind(objects), bundleFetcher: objects.downloader() };
    const a = await syncedDevice(server, DEVICE_A, memberships, { file: true, ...backupOpts });
    ({ businessId } = await goldenDay(a.app, a.db));
    await syncUntilQuiet(a.app);

    await caller(a.app).data('backups.runNow');
    await a.app.backups.uploader.uploadPending();
    expect(listBackupLog(a.db)[0]).toMatchObject({ cloudStatus: 'uploaded', cloudBackupId: 'BK0001' });
    expect([...objects.keys.get(businessId)!.keys()]).toHaveLength(1);
    const p = product(a.db, businessId);
    await a.app.register.open(10_000);
    sell(a.app, p.id, p.uom);
    await syncUntilQuiet(a.app);

    const secretsC = new MemorySecretStore();
    const host = recordingHost();
    const c = await syncedDevice(server, DEVICE_C, memberships, { file: true, secrets: secretsC, restoreHost: host, ...backupOpts });
    await caller(c.app).data('auth.login', LOGIN);
    const r = await caller(c.app).data<RestoreResult>('backups.restoreFromCloud', { businessId, confirm: true });
    expect(r).toEqual({ restarting: true, safetyBackupId: null });
    expect(objects.calls).toContain('fetchKey');

    const cFile = join(c.dir, 'muneem.sqlite');
    c.app.closeReadConnections();
    c.db.close();
    restoreDatabaseFile(host.installed[0]!, cFile);
    rmSync(host.installed[0]!, { force: true });
    const c2 = await syncedDevice(server, DEVICE_C, memberships, { dbFile: cFile, secrets: secretsC, ...backupOpts });
    expect(c2.app.device.cloudDeviceId()).toBe(DEVICE_C);
    expect(getMeta(c2.db, META_KEYS.activeTerminalId)).toBe('');
    expect(sales(c2.db)).toBe(sales(a.db) - 1);
    await caller(c2.app).data('auth.login', LOGIN);
    await syncUntilQuiet(c2.app);
    expect(books(c2.db, businessId)).toEqual(books(a.db, businessId));
    expect(healthy(c2.db, businessId)).toEqual(HEALTHY);
    expect(existsSync(host.installed[0]!)).toBe(false);
  }, 120_000);

  it('a device restoring its own older backup pulls back what it synced after it, then carries on', async () => {
    const server = referenceCloud();
    let businessId = '';
    const memberships = () => (businessId ? [ownerMembership(businessId)] : []);
    const secrets = new MemorySecretStore();
    const host = recordingHost();
    const a = await syncedDevice(server, DEVICE_A, memberships, { file: true, secrets, restoreHost: host });
    ({ businessId } = await goldenDay(a.app, a.db));
    await syncUntilQuiet(a.app);
    const backup = await a.app.backups.backups.run('manual');
    const p = product(a.db, businessId);
    await a.app.register.open(10_000);
    for (let i = 0; i < 3; i++) sell(a.app, p.id, p.uom);
    await syncUntilQuiet(a.app);
    const before = books(a.db, businessId);

    await caller(a.app).data('backups.restore', { source: 'local', id: backup.id, confirm: true });
    const file = join(a.dir, 'muneem.sqlite');
    a.app.closeReadConnections();
    a.db.close();
    restoreDatabaseFile(host.installed[0]!, file);
    const again = await syncedDevice(server, DEVICE_A, memberships, { dbFile: file, secrets });
    expect(sales(again.db)).toBe(before.sales.length - 3);
    await caller(again.app).data('auth.login', LOGIN);
    await syncUntilQuiet(again.app);
    expect(books(again.db, businessId)).toEqual(before);
    expect(getMeta(again.db, META_KEYS.restoreCatchUp)).toBeNull();
    expect(healthy(again.db, businessId)).toEqual(HEALTHY);

    // 8g: the audit rows written after the backup were carried over, so the chain on the cloud carries on unforked.
    again.app.syncEngine.recover();
    await syncUntilQuiet(again.app);
    const chain = server.business(businessId)!.audit.chain(again.app.device.localDeviceId());
    expect(chain.map((e) => e.row.hash)).toEqual(again.db.prepare('SELECT hash FROM audit_log WHERE business_id = ? ORDER BY seq').pluck().all(businessId));
    expect(server.deadLetters(businessId)).toEqual([]);
    expect(await caller(again.app).data('diagnostics.verifyAudit')).toMatchObject({ ok: true });
  }, 120_000);

  it('a failed upload is recorded and retried; a tampered cloud object is refused before anything is swapped', async () => {
    const server = referenceCloud();
    const objects = new FakeBackupCloud();
    let businessId = '';
    let failures = 5;
    const flaky = (creds: Parameters<FakeBackupCloud['transportFor']>[0]) => {
      const t = objects.transportFor(creds);
      return { ...t, presignBackup: (r: Parameters<typeof t.presignBackup>[0]) => (failures-- > 0 ? Promise.reject(new TransportError(0, 'NETWORK_UNREACHABLE')) : t.presignBackup(r)) };
    };
    const host = recordingHost();
    const a = await syncedDevice(server, DEVICE_A, () => (businessId ? [ownerMembership(businessId)] : []), {
      file: true, backupTransport: flaky, bundleFetcher: objects.downloader(), restoreHost: host,
    });
    ({ businessId } = await goldenDay(a.app, a.db));
    await syncUntilQuiet(a.app);
    await caller(a.app).data('backups.runNow');
    expect(await a.app.backups.uploader.uploadPending()).toEqual({ uploaded: 0, failed: 1 });
    expect(listBackupLog(a.db)[0]).toMatchObject({ cloudStatus: 'failed', cloudError: 'NETWORK_UNREACHABLE', cloudAttempts: 4 });
    expect(a.app.backups.backups.health().lastUploadError).toBe('NETWORK_UNREACHABLE');
    expect(await a.app.backups.uploader.uploadPending()).toEqual({ uploaded: 1, failed: 0 });
    expect(a.app.backups.backups.health()).toMatchObject({ lastUploadError: null, awaitingUpload: 0 });

    const stored = objects.backups.get('BK0001')!;
    stored.object!.writeUInt8(stored.object!.readUInt8(100) ^ 1, 100);
    expect(await caller(a.app).call('backups.verify', { source: 'cloud', id: 'BK0001' })).toMatchObject({ ok: true, data: { ok: false, detail: expect.stringMatching(/checksum/) } });
    expect(await caller(a.app).call('backups.restore', { source: 'cloud', id: 'BK0001', confirm: true })).toMatchObject({ ok: false, error: { code: 'BACKUP_INVALID' } });
    expect(host.installed).toEqual([]);
  });
});
