import { join } from 'node:path';
import { existsSync, mkdirSync, statSync } from 'node:fs';
import { newUlid } from '@muneem/domain';
import { DbCorruptError, MIGRATIONS, currentSchemaVersion, migrate, openDatabase, type Db } from '@muneem/db-sqlite';
import type { Loggers } from './logger.js';

export interface DbPaths { file: string; backups: string }

export function dbPaths(userData: string): DbPaths {
  return { file: join(userData, 'muneem.sqlite'), backups: join(userData, 'backups') };
}

/** startup: open (quick_check) → migrate (pre-migration backup) — LLD §12. Throws DbCorruptError for the caller to handle. */
export async function openAndMigrate(paths: DbPaths, loggers: Loggers, nativeBinding?: string): Promise<{ db: Db; schemaVersion: number }> {
  mkdirSync(paths.backups, { recursive: true });
  const db = openDatabase(paths.file, nativeBinding ? { nativeBinding } : {});
  const from = currentSchemaVersion(db);
  const target = MIGRATIONS.at(-1)?.version ?? 0;
  const backupPath = from > 0 && from < target ? join(paths.backups, `pre-migration-v${from}-to-v${target}.sqlite`) : undefined;
  const r = await migrate(db, { ...(backupPath && { backupPath }), log: (m) => loggers.app.info({ migration: m }, 'migrate') });
  if (r.applied.length) loggers.app.info({ from: r.from, to: r.to, backup: r.backupPath }, 'schema migrated');
  if (r.backupPath && existsSync(r.backupPath)) {
    db.prepare("INSERT INTO backup_log (id, path, bytes, verified, kind, created_at) VALUES (?, ?, ?, 1, 'pre_migration', ?)")
      .run(newUlid(), r.backupPath, statSync(r.backupPath).size, new Date().toISOString());
  }
  return { db, schemaVersion: currentSchemaVersion(db) };
}

export { DbCorruptError };
