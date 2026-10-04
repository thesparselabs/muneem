import { copyFileSync, existsSync, readdirSync, renameSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { META_KEYS, openCopy, quickCheck, restoreDatabaseFile, setMeta, verifyAuditChain } from '@muneem/db-sqlite';
import type { SecretStore } from '../infra/secrets.js';
import { openFile, readHeader } from './archive.js';
import { BackupKeyring } from './keyring.js';
import type { RestoreHost } from './restoreService.js';

const removeSqlite = (path: string) => { for (const s of ['', '-wal', '-shm']) rmSync(path + s, { force: true }); };

// Without Electron there is nothing to restart: the database is closed and swapped, and the caller opens it again.
export function swapHost(close: () => void, dbFile: string): RestoreHost {
  return {
    install: (restored) => {
      close();
      restoreDatabaseFile(restored, dbFile);
      removeSqlite(restored);
    },
  };
}

// The newest backup on disk, encrypted or a plain pre-migration copy; the corrupt database's own log cannot be trusted.
export function latestBackupFile(dir: string): string | null {
  if (!existsSync(dir)) return null;
  const files = readdirSync(dir).filter((f) => !f.startsWith('.') && (f.endsWith('.mbk') || f.endsWith('.sqlite'))).map((f) => join(dir, f));
  return files.sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0] ?? null;
}

// DB_CORRUPT at start-up (before the app exists): decrypt with this device's key, check, and put it in place.
export async function restoreBackupFile(path: string, dbFile: string, secrets: SecretStore, nativeBinding?: string): Promise<void> {
  const out = `${path}.restore.sqlite`;
  try {
    if (path.endsWith('.mbk')) await decryptOwnBackup(path, secrets, out);
    else copyFileSync(path, out);
    adoptOwnBackup(out, nativeBinding);
    restoreDatabaseFile(out, dbFile);
  } finally {
    removeSqlite(out);
  }
}

async function decryptOwnBackup(path: string, secrets: SecretStore, out: string): Promise<void> {
  const { signed } = await readHeader(path);
  const key = new BackupKeyring(secrets, () => null).local(signed.manifest.businessId, signed.manifest.keyId);
  if (!key) throw new Error('the key for this backup is not on this device');
  await openFile(path, key, out);
}

// The backup is this device's own, so its first pull also brings back what it synced after the backup (8f catch-up).
function adoptOwnBackup(file: string, nativeBinding?: string): void {
  const copy = openCopy(file, { nativeBinding, writable: true });
  try {
    if (!quickCheck(copy).ok) throw new Error('the backup fails quick_check');
    setMeta(copy, META_KEYS.restoreCatchUp, '1');
  } finally {
    copy.close();
  }
}

export type CorruptDbChoice = 'restore_local' | 'start_fresh' | 'quit';
export interface CorruptDbRecovery { choice: CorruptDbChoice; backup: string | null; quarantined: string | null; auditCarried: number }
export interface CorruptDbOptions {
  dbFile: string;
  backupsDir: string;
  secrets: SecretStore;
  nativeBinding?: string;
  now: () => number;
  choose: (latestBackup: string | null) => Promise<CorruptDbChoice>;
}

const moveSqlite = (from: string, to: string) => { for (const s of ['', '-wal', '-shm']) if (existsSync(from + s)) renameSync(from + s, to + s); };

// NFR-019: the damaged file is kept aside for support; the latest local backup goes in its place, or the device starts
// empty and is restored from the cloud after sign-in.
export async function recoverCorruptDatabase(o: CorruptDbOptions): Promise<CorruptDbRecovery> {
  const backup = latestBackupFile(o.backupsDir);
  const choice = await o.choose(backup);
  if (choice === 'quit' || (choice === 'restore_local' && !backup)) return { choice: 'quit', backup, quarantined: null, auditCarried: 0 };
  const quarantined = `${o.dbFile}.corrupt-${new Date(o.now()).toISOString().replace(/[:.]/g, '-')}`;
  moveSqlite(o.dbFile, quarantined);
  if (choice === 'start_fresh') return { choice, backup, quarantined, auditCarried: 0 };
  try {
    await restoreBackupFile(backup!, o.dbFile, o.secrets, o.nativeBinding);
  } catch (e) {
    removeSqlite(o.dbFile);
    moveSqlite(quarantined, o.dbFile);
    throw e;
  }
  return { choice, backup, quarantined, auditCarried: salvageAudit(quarantined, o.dbFile, o.nativeBinding) };
}

const AUDIT_COLUMNS = 'id, business_id, seq, user_id, device_id, terminal_id, action, entity_type, entity_id, before_json, after_json, reason, occurred_at, prev_hash, hash';
type AuditCarry = Record<string, unknown> & { business_id: string; device_id: string };

// ADR-0048: this device's audit rows written after the backup, wherever the damaged file still reads them and they still
// link, so the restored chain does not fork the one the cloud holds.
function salvageAudit(damaged: string, dbFile: string, nativeBinding?: string): number {
  const rows = readableAudit(damaged, nativeBinding);
  if (rows.length === 0) return 0;
  const db = openCopy(dbFile, { nativeBinding, writable: true });
  try {
    const insert = db.prepare(`INSERT OR IGNORE INTO audit_log (${AUDIT_COLUMNS}) VALUES (${AUDIT_COLUMNS.split(', ').map((c) => `@${c}`).join(', ')})`);
    let carried = 0;
    for (const businessId of new Set(rows.map((r) => r.business_id))) {
      const chain = rows.filter((r) => r.business_id === businessId);
      try {
        carried += db.transaction(() => {
          const n = chain.reduce((sum, r) => sum + insert.run(r).changes, 0);
          if (!verifyAuditChain(db, businessId, chain[0]!.device_id).ok) throw new Error('the salvaged rows do not link');
          return n;
        })();
      } catch { /* this business keeps the backup's chain */ }
    }
    return carried;
  } finally {
    db.close();
  }
}

function readableAudit(file: string, nativeBinding?: string): AuditCarry[] {
  try {
    const db = openCopy(file, { nativeBinding });
    try {
      return db.prepare(`SELECT ${AUDIT_COLUMNS} FROM audit_log WHERE device_id = (SELECT value FROM app_meta WHERE key = ?) ORDER BY business_id, seq`)
        .all(META_KEYS.installationId) as AuditCarry[];
    } finally {
      db.close();
    }
  } catch {
    return [];
  }
}
