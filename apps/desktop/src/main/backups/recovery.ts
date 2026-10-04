import { existsSync, readdirSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { openCopy, quickCheck, restoreDatabaseFile } from '@muneem/db-sqlite';
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
  if (!path.endsWith('.mbk')) return restoreDatabaseFile(path, dbFile);
  const { signed } = await readHeader(path);
  const key = new BackupKeyring(secrets, () => null).local(signed.manifest.businessId, signed.manifest.keyId);
  if (!key) throw new Error('the key for this backup is not on this device');
  const out = `${path}.restore.sqlite`;
  try {
    await openFile(path, key, out);
    const copy = openCopy(out, { nativeBinding });
    try { if (!quickCheck(copy).ok) throw new Error('the backup fails quick_check'); } finally { copy.close(); }
    restoreDatabaseFile(out, dbFile);
  } finally {
    removeSqlite(out);
  }
}
