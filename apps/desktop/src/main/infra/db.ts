import { join } from 'node:path';
import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import { DbCorruptError, MIGRATIONS, currentSchemaVersion, migrate, openDatabase, type Db } from '@muneem/db-sqlite';
import type { Loggers } from './logger.js';

export interface DbPaths { file: string; backups: string }

export function dbPaths(userData: string): DbPaths {
  return { file: join(userData, 'muneem.sqlite'), backups: join(userData, 'backups') };
}

export function latestBackup(backupsDir: string): string | null {
  if (!existsSync(backupsDir)) return null;
  const files = readdirSync(backupsDir).filter((f) => f.endsWith('.sqlite')).sort();
  return files.length ? join(backupsDir, files.at(-1)!) : null;
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
  return { db, schemaVersion: currentSchemaVersion(db) };
}

export { DbCorruptError };
