import Database from 'better-sqlite3';
import { copyFileSync, existsSync, mkdirSync, rmSync, statSync } from 'node:fs';
import { dirname } from 'node:path';

export type Db = Database.Database;

export interface OpenOptions {
  /** read-only connections (reports process) skip WAL/synchronous writes */
  readonly?: boolean;
  /** run PRAGMA quick_check on open (default true); cost is proportional to DB size */
  quickCheck?: boolean;
  /** path to a better_sqlite3.node built for a different ABI (Electron); default = the one in node_modules */
  nativeBinding?: string;
}

export class DbCorruptError extends Error {
  constructor(public readonly detail: string[]) {
    super('DB_CORRUPT');
    this.name = 'DbCorruptError';
  }
}

// Electron needs its own build of the SQLite addon; any extra connection (e.g. verifying a backup) must reuse it.
const nativeBindings = new WeakMap<Db, string>();
export const nativeBindingOf = (db: Db): string | undefined => nativeBindings.get(db);

/** LLD §2 pragmas — applied on EVERY connection open. synchronous=FULL is non-negotiable (NFR-019). */
export function openDatabase(path: string, opts: OpenOptions = {}): Db {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const dbOpts: Database.Options = opts.readonly ? { readonly: true, fileMustExist: true } : {};
  if (opts.nativeBinding) dbOpts.nativeBinding = opts.nativeBinding;
  const db = new Database(path, dbOpts);
  if (opts.nativeBinding) nativeBindings.set(db, opts.nativeBinding);
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = FULL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');
  db.pragma('temp_store = MEMORY');
  db.pragma('mmap_size = 268435456');
  db.pragma('cache_size = -65536');
  if (opts.quickCheck !== false) {
    const rows = db.pragma('quick_check') as { quick_check: string }[];
    const detail = rows.map((r) => r.quick_check);
    if (detail.length !== 1 || detail[0] !== 'ok') {
      db.close();
      throw new DbCorruptError(detail);
    }
  }
  return db;
}

export function quickCheck(db: Db): { ok: boolean; detail: string[] } {
  const rows = db.pragma('quick_check') as { quick_check: string }[];
  const detail = rows.map((r) => r.quick_check);
  return { ok: detail.length === 1 && detail[0] === 'ok', detail };
}

export function foreignKeyCheck(db: Db): { ok: boolean; detail: string[] } {
  const rows = db.pragma('foreign_key_check') as { table: string; rowid: number; parent: string }[];
  return { ok: rows.length === 0, detail: rows.map((r) => `${r.table}#${r.rowid} → ${r.parent}`) };
}

/** Online backup API — safe under WAL with concurrent readers/writers. Verifies the copy opens and passes quick_check. */
export async function backupDatabase(db: Db, destPath: string): Promise<{ bytes: number; verified: boolean }> {
  mkdirSync(dirname(destPath), { recursive: true });
  await db.backup(destPath);
  let verified = false;
  const nativeBinding = nativeBindingOf(db);
  const copy = new Database(destPath, { readonly: true, fileMustExist: true, ...(nativeBinding && { nativeBinding }) });
  try {
    verified = quickCheck(copy).ok;
  } finally {
    copy.close();
  }
  return { bytes: statSync(destPath).size, verified };
}

/** A connection to a backup copy with none of the live database's pragmas; read-only unless asked. */
export function openCopy(path: string, opts: { nativeBinding?: string | undefined; writable?: boolean } = {}): Db {
  return new Database(path, { readonly: !opts.writable, fileMustExist: true, ...(opts.nativeBinding && { nativeBinding: opts.nativeBinding }) });
}

/** Restore = file copy while the DB is closed. Caller must have closed all connections. */
export function restoreDatabaseFile(backupPath: string, dbPath: string): void {
  if (!existsSync(backupPath)) throw new Error(`backup not found: ${backupPath}`);
  // A leftover WAL would be replayed onto the restored file and corrupt it.
  for (const suffix of ['-wal', '-shm']) rmSync(dbPath + suffix, { force: true });
  copyFileSync(backupPath, dbPath);
}

export function dbSizeBytes(path: string): number {
  let total = 0;
  for (const suffix of ['', '-wal', '-shm']) if (existsSync(path + suffix)) total += statSync(path + suffix).size;
  return total;
}
