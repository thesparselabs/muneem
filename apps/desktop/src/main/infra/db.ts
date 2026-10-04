import { join } from 'node:path';
import { mkdirSync } from 'node:fs';
import type { MigrationFailure } from '@muneem/contracts';
import { newUlid } from '@muneem/domain';
import {
  DbCorruptError, insertBackupLog, MIGRATIONS, currentSchemaVersion, getMeta, migrate, openDatabase, setMeta, type Db, type Migration,
} from '@muneem/db-sqlite';
import { rowCounts } from '../backups/manifest.js';
import { plainPreMigrationBackups, type PreMigrationBackup, type PreMigrationBackups } from '../backups/preMigration.js';
import type { Loggers } from './logger.js';

export interface DbPaths { file: string; backups: string }

export function dbPaths(userData: string): DbPaths {
  return { file: join(userData, 'muneem.sqlite'), backups: join(userData, 'backups') };
}

export const MIGRATION_FAILURE_KEY = 'migration_failure';

export interface MigrateGuardOptions {
  backups?: PreMigrationBackups;
  migrations?: readonly Migration[];
  appVersion?: string;
  now?: () => number;
}

// The upgrade failed and the database is back as it was; this build cannot run on that schema.
export class MigrationFailedError extends Error {
  constructor(public readonly failure: MigrationFailure) {
    super(`MIGRATION_FAILED: ${failure.error}`);
    this.name = 'MigrationFailedError';
  }
}

export function lastMigrationFailure(db: Db): MigrationFailure | null {
  const raw = getMeta(db, MIGRATION_FAILURE_KEY);
  return raw ? JSON.parse(raw) as MigrationFailure : null;
}

// A migration may add rows to a core table, never lose them.
export function lostRows(before: Record<string, number>, after: Record<string, number>): string[] {
  return Object.entries(before).filter(([t, n]) => (after[t] ?? 0) < n).map(([t, n]) => `${t} ${n} → ${after[t] ?? 0}`);
}

/**
 * LLD §12 start-up: open (quick_check) → pre-migration backup → migrate in one transaction (foreign_key_check inside)
 * → row-count sanity. Any failure puts the backup back, records it and throws MigrationFailedError.
 */
export async function openAndMigrate(paths: DbPaths, loggers: Loggers, nativeBinding?: string, opts: MigrateGuardOptions = {}): Promise<{ db: Db; schemaVersion: number }> {
  mkdirSync(paths.backups, { recursive: true });
  const open = () => openDatabase(paths.file, nativeBinding ? { nativeBinding } : {});
  const db = open();
  const migrations = opts.migrations ?? MIGRATIONS;
  const from = currentSchemaVersion(db);
  const to = migrations.at(-1)?.version ?? 0;
  const log = (m: string) => loggers.app.info({ migration: m }, 'migrate');
  if (from === 0 || from >= to) {
    await migrate(db, { migrations, log });
    return { db, schemaVersion: currentSchemaVersion(db) };
  }

  const backups = opts.backups ?? plainPreMigrationBackups(paths.backups);
  const before = rowCounts(db);
  let backup: PreMigrationBackup;
  try {
    backup = await backups.take(db, from, to);
  } catch (e) {
    db.close();
    throw e;
  }
  try {
    const r = await migrate(db, { migrations, log });
    const lost = lostRows(before, rowCounts(db));
    if (lost.length) throw new Error(`rows lost in migration: ${lost.join(', ')}`);
    logPreMigrationBackup(db, backup, from, opts.now);
    loggers.app.info({ from: r.from, to: r.to, backup: backup.path, encrypted: backup.encrypted }, 'schema migrated');
    return { db, schemaVersion: currentSchemaVersion(db) };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    try { db.close(); } catch { /* already closed */ }
    const restored = await backups.restore(backup, paths.file, nativeBinding).then(() => true, (err: unknown) => {
      loggers.app.error({ err: String(err), backup: backup.path }, 'restoring the pre-migration backup failed');
      return false;
    });
    const failure: MigrationFailure = { at: new Date(opts.now?.() ?? Date.now()).toISOString(), from, to, appVersion: opts.appVersion ?? '', error, restored };
    recordFailure(open, failure, loggers);
    loggers.app.error({ code: 'MIGRATION_FAILED', ...failure, backup: backup.path }, 'schema migration failed; the database was put back');
    throw new MigrationFailedError(failure);
  }
}

function logPreMigrationBackup(db: Db, b: PreMigrationBackup, schemaVersion: number, now?: () => number): void {
  insertBackupLog(db, {
    id: newUlid(), path: b.path, bytes: b.bytes, verified: true, kind: 'pre_migration', createdAt: new Date(now?.() ?? Date.now()).toISOString(),
    businessId: b.businessId, encrypted: b.encrypted, keyId: b.keyId, sha256: b.sha256, schemaVersion,
  });
}

function recordFailure(open: () => Db, failure: MigrationFailure, loggers: Loggers): void {
  try {
    const db = open();
    try { setMeta(db, MIGRATION_FAILURE_KEY, JSON.stringify(failure)); } finally { db.close(); }
  } catch (e) {
    loggers.app.error({ err: String(e) }, 'could not record the migration failure in app_meta');
  }
}

export { DbCorruptError };
