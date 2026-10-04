import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { currentSchemaVersion, listBackupLog, MIGRATIONS, openDatabase, type Db, type Migration } from '@muneem/db-sqlite';
import { rowCounts } from '../../src/main/backups/manifest.js';
import { encryptedPreMigrationBackups, plainPreMigrationBackups, preferEncrypted, type PreMigrationBackups } from '../../src/main/backups/preMigration.js';
import { lastMigrationFailure, lostRows, MigrationFailedError, openAndMigrate } from '../../src/main/infra/db.js';
import { silentLoggers } from '../../src/main/infra/logger.js';
import { MemorySecretStore, type SecretStore } from '../../src/main/infra/secrets.js';
import { testApp } from '../helpers.js';
import { goldenDay } from '../sync/goldenDay.js';

const CURRENT = MIGRATIONS.at(-1)!.version;
const next = (name: string, sql: string): Migration[] => [...MIGRATIONS, { version: CURRENT + 1, name, sql }];

// A shop's database after a day of trading, closed as the old build would leave it on quit.
async function tradedShop(secrets: SecretStore = new MemorySecretStore()) {
  const { app, db, dir } = await testApp({ file: true, secrets });
  await goldenDay(app, db);
  const before = rowCounts(db);
  app.closeReadConnections();
  db.close();
  return { paths: { file: join(dir, 'muneem.sqlite'), backups: join(dir, 'backups') }, before, secrets, dir };
}

const reopen = (file: string): Db => openDatabase(file, { quickCheck: false });

function encryptedOrPlain(dir: string, secrets: SecretStore): PreMigrationBackups {
  const log = silentLoggers().app;
  return preferEncrypted(encryptedPreMigrationBackups({ dir, secrets, appVersion: '0.2.0', now: () => Date.now(), log }), plainPreMigrationBackups(dir), log);
}

describe('migration guard (8i, LLD §12)', () => {
  it('a migration that errors part-way rolls back to the encrypted backup, keeps every row and records the failure', async () => {
    const shop = await tradedShop();
    const broken = next('broken', 'CREATE TABLE half_done(x); INSERT INTO half_done VALUES (1); SELECT no_such_function();');
    const err = await openAndMigrate(shop.paths, silentLoggers(), undefined, { migrations: broken, backups: encryptedOrPlain(shop.paths.backups, shop.secrets), appVersion: '0.2.0' })
      .then(() => null, (e: unknown) => e);
    expect(err).toBeInstanceOf(MigrationFailedError);
    expect((err as MigrationFailedError).failure).toMatchObject({ from: CURRENT, to: CURRENT + 1, appVersion: '0.2.0', restored: true, error: expect.stringContaining('no_such_function') });
    expect(readdirSync(shop.paths.backups)).toEqual([expect.stringMatching(/-pre_migration\.mbk$/)]);

    const db = reopen(shop.paths.file);
    expect(currentSchemaVersion(db)).toBe(CURRENT);
    expect(rowCounts(db)).toEqual(shop.before);
    expect(db.prepare("SELECT name FROM sqlite_master WHERE name = 'half_done'").get()).toBeUndefined();
    expect(lastMigrationFailure(db)).toMatchObject({ from: CURRENT, to: CURRENT + 1, restored: true });
    db.close();
  });

  it('a migration that commits but loses rows is caught by the row counts and the backup is put back', async () => {
    const shop = await tradedShop();
    const lossy = next('lossy', 'DELETE FROM sync_outbox;');
    const err = await openAndMigrate(shop.paths, silentLoggers(), undefined, { migrations: lossy, backups: encryptedOrPlain(shop.paths.backups, shop.secrets) }).catch((e: unknown) => e);
    expect((err as MigrationFailedError).failure.error).toMatch(/rows lost in migration: sync_outbox/);
    const db = reopen(shop.paths.file);
    expect(currentSchemaVersion(db)).toBe(CURRENT);
    expect(rowCounts(db)).toEqual(shop.before);
    expect(shop.before.sync_outbox).toBeGreaterThan(0);
    db.close();
  });

  it('a migration that breaks a foreign key is refused inside its transaction', async () => {
    const shop = await tradedShop();
    const dangling = next('dangling', "PRAGMA defer_foreign_keys = ON; INSERT INTO branch (id, business_id, code, name, state_code, created_at, updated_at, created_by, device_id) VALUES ('br-x', 'no-such-business', 'X', 'X', '07', 'now', 'now', 'u', 'd');");
    const err = await openAndMigrate(shop.paths, silentLoggers(), undefined, { migrations: dangling }).catch((e: unknown) => e);
    expect((err as MigrationFailedError).failure.error).toMatch(/foreign_key_check failed/);
    const db = reopen(shop.paths.file);
    expect(currentSchemaVersion(db)).toBe(CURRENT);
    expect(rowCounts(db)).toEqual(shop.before);
    db.close();
  });

  it('a healthy migration proceeds and logs its encrypted pre-migration backup', async () => {
    const shop = await tradedShop();
    const { db, schemaVersion } = await openAndMigrate(shop.paths, silentLoggers(), undefined, {
      migrations: next('healthy', 'CREATE TABLE added_later(x INTEGER);'), backups: encryptedOrPlain(shop.paths.backups, shop.secrets),
    });
    expect(schemaVersion).toBe(CURRENT + 1);
    expect(rowCounts(db)).toEqual(shop.before);
    const logged = listBackupLog(db).filter((b) => b.kind === 'pre_migration');
    expect(logged).toEqual([expect.objectContaining({ verified: true, encrypted: true, schemaVersion: CURRENT, keyId: expect.any(String) })]);
    expect(existsSync(logged[0]!.path)).toBe(true);
    expect(lastMigrationFailure(db)).toBeNull();
    db.close();
  });

  it('falls back to a plain copy when the device key is not in the secret store', async () => {
    const shop = await tradedShop();
    const empty = new MemorySecretStore();
    const { db } = await openAndMigrate(shop.paths, silentLoggers(), undefined, {
      migrations: next('healthy', 'CREATE TABLE added_later(x INTEGER);'), backups: encryptedOrPlain(shop.paths.backups, empty),
    });
    expect(listBackupLog(db).filter((b) => b.kind === 'pre_migration')).toEqual([expect.objectContaining({ encrypted: false, path: expect.stringMatching(/pre-migration-v\d+-to-v\d+\.sqlite$/) })]);
    db.close();
  });

  it('takes no backup for a fresh database or one already current', async () => {
    const shop = await tradedShop();
    const { db } = await openAndMigrate(shop.paths, silentLoggers());
    expect(listBackupLog(db).filter((b) => b.kind === 'pre_migration')).toEqual([]);
    db.close();
  });

  it('counts lost rows per table and ignores added ones', () => {
    expect(lostRows({ sale: 3, customer: 2 }, { sale: 5, customer: 1 })).toEqual(['customer 2 → 1']);
    expect(lostRows({ sale: 3 }, { sale: 3, product: 9 })).toEqual([]);
  });
});
