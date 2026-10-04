import { closeSync, existsSync, openSync, readdirSync, rmSync, writeSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { RestoreResult } from '@muneem/contracts';
import { getMeta, META_KEYS, restoreDatabaseFile, verifyAuditChain } from '@muneem/db-sqlite';
import type { ReferenceServer } from '@muneem/sync-reference';
import { recoverCorruptDatabase, type CorruptDbChoice } from '../../src/main/backups/recovery.js';
import { DbCorruptError, openAndMigrate } from '../../src/main/infra/db.js';
import { silentLoggers } from '../../src/main/infra/logger.js';
import { MemorySecretStore } from '../../src/main/infra/secrets.js';
import { caller, USER_ID, type TestAppOptions } from '../helpers.js';
import { FakeBackupCloud } from '../backups/fakeBackupCloud.js';
import { DEVICE_C } from '../sync/cloudHarness.js';
import { goldenDay } from '../sync/goldenDay.js';
import { sell } from '../sync/scenario37.js';
import { books, DEVICE_A, healthy, ownerMembership, referenceCloud, syncedDevice, syncUntilQuiet } from '../sync/syncHelpers.js';

const HEALTHY = { tieOuts: [], replay: [], partyMismatches: [], allocationFaults: [] };
const LOGIN = { identifier: '9999999999', password: 'correct-horse' };
const PAGE = 4096;

// Garbage over a run of pages, as a torn write on cheap hardware leaves them; page 1 (the header and schema) only when asked.
// Damaged pages are a document table's own, found with dbstat before the file closes, so the audit log stays readable
// for the carry-over however the schema grows.
function corrupt(file: string, where: 'pages' | 'header', pages: readonly number[]): void {
  const fd = openSync(file, 'r+');
  try {
    if (where === 'header') writeSync(fd, Buffer.alloc(PAGE, 0xa5), 0, PAGE, 0);
    else for (const page of pages) writeSync(fd, Buffer.alloc(PAGE, 0xa5), 0, PAGE, PAGE * (page - 1));
  } finally {
    closeSync(fd);
  }
}

const choosing = (choice: CorruptDbChoice, offered: (string | null)[]) => (backup: string | null) => { offered.push(backup); return Promise.resolve(choice); };

// Device A trades, backs up, trades on and syncs; then its database is damaged on disk.
async function damagedDevice(server: ReferenceServer, opts: TestAppOptions, where: 'pages' | 'header') {
  let businessId = '';
  const memberships = () => (businessId ? [ownerMembership(businessId)] : []);
  const secrets = new MemorySecretStore();
  const a = await syncedDevice(server, DEVICE_A, memberships, { file: true, secrets, ...opts });
  ({ businessId } = await goldenDay(a.app, a.db));
  await syncUntilQuiet(a.app);
  await caller(a.app).data('backups.runNow');
  await a.app.backups.uploader.uploadPending();
  const p = a.db.prepare("SELECT id, base_uom_id AS uom FROM product WHERE business_id = ? AND name = 'Soap'").get(businessId) as { id: string; uom: string };
  await a.app.register.open(10_000);
  for (let i = 0; i < 3; i++) sell(a.app, p.id, p.uom);
  await syncUntilQuiet(a.app);
  const original = { books: books(a.db, businessId), installationId: a.app.device.installationId() };
  const file = join(a.dir, 'muneem.sqlite');
  const pages = a.db.prepare("SELECT pageno FROM dbstat WHERE name = 'sale_item' ORDER BY pageno LIMIT 8").pluck().all() as number[];
  a.app.closeReadConnections();
  a.db.close();
  corrupt(file, where, pages);
  return { businessId, memberships, secrets, dir: a.dir, file, original };
}

const startUp = (dir: string) => openAndMigrate({ file: join(dir, 'muneem.sqlite'), backups: join(dir, 'backups') }, silentLoggers());

describe('the "database corrupted" journey (9g, NFR-019)', () => {
  it.each(['pages', 'header'] as const)('damaged %s: start-up refuses it, the latest local backup goes in, a pull brings the books back, and billing carries on', async (where) => {
    const server = referenceCloud();
    const d = await damagedDevice(server, {}, where);
    await expect(startUp(d.dir)).rejects.toBeInstanceOf(DbCorruptError);

    const offered: (string | null)[] = [];
    const r = await recoverCorruptDatabase({ dbFile: d.file, backupsDir: join(d.dir, 'backups'), secrets: d.secrets, now: () => Date.now(), choose: choosing('restore_local', offered) });
    expect(offered).toEqual([expect.stringMatching(/-manual\.mbk$/)]);
    expect(r).toMatchObject({ choice: 'restore_local', backup: offered[0], quarantined: expect.stringContaining('muneem.sqlite.corrupt-') });
    expect(existsSync(r.quarantined!), 'the damaged file is kept for support').toBe(true);
    if (where === 'pages') expect(r.auditCarried, 'audit rows after the backup read back from the damaged file').toBeGreaterThan(0);
    else expect(r.auditCarried, 'nothing reads from a file without its header').toBe(0);
    (await startUp(d.dir)).db.close();

    const again = await syncedDevice(server, DEVICE_A, d.memberships, { dbFile: d.file, secrets: d.secrets });
    expect(again.app.device.installationId()).toBe(d.original.installationId);
    expect(again.db.prepare('SELECT COUNT(*) FROM sale').pluck().get()).toBe(d.original.books.sales.length - 3);
    await caller(again.app).data('auth.login', LOGIN);
    await syncUntilQuiet(again.app);
    expect(books(again.db, d.businessId)).toEqual(d.original.books);
    expect(healthy(again.db, d.businessId)).toEqual(HEALTHY);
    expect(getMeta(again.db, META_KEYS.restoreCatchUp)).toBeNull();

    const p = again.db.prepare("SELECT id, base_uom_id AS uom FROM product WHERE business_id = ? AND name = 'Soap'").get(d.businessId) as { id: string; uom: string };
    sell(again.app, p.id, p.uom);
    again.app.syncEngine.recover();
    await syncUntilQuiet(again.app);
    expect(verifyAuditChain(again.db, d.businessId, d.original.installationId)).toMatchObject({ ok: true });
    expect(books(again.db, d.businessId).sales).toHaveLength(d.original.books.sales.length + 1);
    if (where === 'header') {
      // Known gap (docs/qa/chaos.md): audit rows the cloud took after the backup cannot be read back, so the cloud flags the fork.
      expect(new Set(server.deadLetters(d.businessId).map((l) => `${l.entityType}:${l.error.code}`))).toEqual(new Set(['audit_entry:AUDIT_CHAIN_BROKEN']));
      return;
    }
    expect(server.deadLetters(d.businessId)).toEqual([]);
    expect(server.business(d.businessId)!.audit.chain(again.app.device.localDeviceId()).map((e) => e.row.hash))
      .toEqual(again.db.prepare('SELECT hash FROM audit_log WHERE business_id = ? AND device_id = ? ORDER BY seq').pluck().all(d.businessId, d.original.installationId));
  }, 120_000);

  it('with no local backup it starts empty, keeps the damaged file, and a cloud restore plus a pull brings the books back', async () => {
    const server = referenceCloud();
    server.registerDevice(DEVICE_C, USER_ID);
    const objects = new FakeBackupCloud();
    const backupOpts = { backupTransport: objects.transportFor.bind(objects), bundleFetcher: objects.downloader() };
    const d = await damagedDevice(server, backupOpts, 'pages');
    for (const f of readdirSync(join(d.dir, 'backups'))) rmSync(join(d.dir, 'backups', f), { force: true });
    await expect(startUp(d.dir)).rejects.toBeInstanceOf(DbCorruptError);

    const offered: (string | null)[] = [];
    const r = await recoverCorruptDatabase({ dbFile: d.file, backupsDir: join(d.dir, 'backups'), secrets: d.secrets, now: () => Date.now(), choose: choosing('start_fresh', offered) });
    expect(offered).toEqual([null]);
    expect(r).toMatchObject({ choice: 'start_fresh', quarantined: expect.stringContaining('muneem.sqlite.corrupt-') });
    expect(existsSync(d.file)).toBe(false);
    (await startUp(d.dir)).db.close();

    // A new database is a new installation, so the cloud knows it as a new device.
    const host = { installed: [] as string[], install(file: string) { this.installed.push(file); } };
    const fresh = await syncedDevice(server, DEVICE_C, d.memberships, { dbFile: d.file, secrets: d.secrets, restoreHost: host, ...backupOpts });
    await caller(fresh.app).data('auth.login', LOGIN);
    expect(await caller(fresh.app).data<RestoreResult>('backups.restoreFromCloud', { businessId: d.businessId, confirm: true })).toEqual({ restarting: true, safetyBackupId: null });
    fresh.app.closeReadConnections();
    fresh.db.close();
    restoreDatabaseFile(host.installed[0]!, d.file);
    rmSync(host.installed[0]!, { force: true });

    const restored = await syncedDevice(server, DEVICE_C, d.memberships, { dbFile: d.file, secrets: d.secrets, ...backupOpts });
    await caller(restored.app).data('auth.login', LOGIN);
    await syncUntilQuiet(restored.app);
    expect(books(restored.db, d.businessId)).toEqual(d.original.books);
    expect(healthy(restored.db, d.businessId)).toEqual(HEALTHY);
    expect(verifyAuditChain(restored.db, d.businessId, d.original.installationId)).toMatchObject({ ok: true });
    expect(server.deadLetters(d.businessId)).toEqual([]);
  }, 120_000);
});
