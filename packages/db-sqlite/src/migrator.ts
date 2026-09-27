import type { Db } from './open.js';
import { backupDatabase, foreignKeyCheck, quickCheck } from './open.js';
import { MIGRATIONS, type Migration } from './migrations.generated.js';

export interface MigrateOptions {
  /** where to write the pre-migration backup; omitted = no backup (tests / in-memory) */
  backupPath?: string;
  migrations?: readonly Migration[];
  log?: (msg: string) => void;
}

export interface MigrateResult {
  from: number;
  to: number;
  applied: number[];
  backupPath?: string;
}

export function currentSchemaVersion(db: Db): number {
  return Number((db.pragma('user_version', { simple: true }) as number) ?? 0);
}

/**
 * LLD §12: startup → quick_check → backup → apply pending migrations in ONE transaction
 *        → foreign_key_check → user_version = N. On failure the transaction rolls back and the
 *        caller restores the backup (the DB is untouched anyway, but the backup is the safety net
 *        against partial DDL on older SQLite builds).
 */
export async function migrate(db: Db, opts: MigrateOptions = {}): Promise<MigrateResult> {
  const migrations = [...(opts.migrations ?? MIGRATIONS)].sort((a, b) => a.version - b.version);
  const from = currentSchemaVersion(db);
  const pending = migrations.filter((m) => m.version > from);
  const latest = migrations.at(-1)?.version ?? from;
  if (pending.length === 0) return { from, to: from, applied: [] };

  const qc = quickCheck(db);
  if (!qc.ok) throw new Error(`refusing to migrate a corrupt database: ${qc.detail.join('; ')}`);

  let backupPath: string | undefined;
  if (opts.backupPath && from > 0) {
    const r = await backupDatabase(db, opts.backupPath);
    if (!r.verified) throw new Error('pre-migration backup failed verification; aborting migration');
    backupPath = opts.backupPath;
  }

  const applied: number[] = [];
  const run = db.transaction(() => {
    for (const m of pending) {
      if (m.version !== (applied.at(-1) ?? from) + 1) {
        throw new Error(`migration gap: expected ${(applied.at(-1) ?? from) + 1}, found ${m.version}`);
      }
      opts.log?.(`applying ${String(m.version).padStart(4, '0')}_${m.name}`);
      db.exec(m.sql);
      applied.push(m.version);
    }
    const fk = foreignKeyCheck(db);
    if (!fk.ok) throw new Error(`foreign_key_check failed after migration: ${fk.detail.join('; ')}`);
    db.pragma(`user_version = ${latest}`);
  });
  run.immediate();
  const result: MigrateResult = { from, to: latest, applied };
  if (backupPath) result.backupPath = backupPath;
  return result;
}
