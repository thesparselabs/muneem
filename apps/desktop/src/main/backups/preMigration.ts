import { join } from 'node:path';
import { backupDatabase, getMeta, listBusinesses, META_KEYS, restoreDatabaseFile, type Db } from '@muneem/db-sqlite';
import type { Loggers } from '../infra/logger.js';
import { SECRET_KEYS, type SecretStore } from '../infra/secrets.js';
import { BackupService } from './backupService.js';
import { BackupKeyring } from './keyring.js';
import { restoreBackupFile } from './recovery.js';

export interface PreMigrationBackup { path: string; bytes: number; encrypted: boolean; businessId: string | null; keyId: string | null; sha256: string | null }

// The safety net the migration guard takes before an upgrade and puts back if the upgrade fails.
export interface PreMigrationBackups {
  take(db: Db, from: number, to: number): Promise<PreMigrationBackup>;
  restore(backup: PreMigrationBackup, dbFile: string, nativeBinding?: string): Promise<void>;
}

// A verified plain copy; always possible, but unencrypted on disk.
export function plainPreMigrationBackups(dir: string): PreMigrationBackups {
  return {
    async take(db, from, to) {
      const path = join(dir, `pre-migration-v${from}-to-v${to}.sqlite`);
      const r = await backupDatabase(db, path);
      if (!r.verified) throw new Error('pre-migration backup failed verification; aborting migration');
      return { path, bytes: r.bytes, encrypted: false, businessId: null, keyId: null, sha256: null };
    },
    async restore(backup, dbFile) { restoreDatabaseFile(backup.path, dbFile); },
  };
}

export interface EncryptedPreMigrationDeps { dir: string; secrets: SecretStore; appVersion: string; now: () => number; log: Loggers['app'] }

// ADR-0047 encrypted backup (8f), built from what is on disk before the app exists; the key escrow is not reachable yet.
export function encryptedPreMigrationBackups(d: EncryptedPreMigrationDeps): PreMigrationBackups {
  return {
    async take(db) {
      const businessId = getMeta(db, META_KEYS.activeBusinessId) || listBusinesses(db)[0]?.id || null;
      const installationId = getMeta(db, META_KEYS.installationId);
      const publicKey = getMeta(db, META_KEYS.devicePublicKey);
      if (!businessId || !installationId || !publicKey || !d.secrets.get(SECRET_KEYS.devicePrivateKey)) {
        throw new Error('no business or device key yet, so the backup cannot be encrypted');
      }
      const service = new BackupService({
        db: () => db, dir: d.dir, keyring: new BackupKeyring(d.secrets, () => null), appVersion: d.appVersion, now: d.now, log: d.log, sessionBusinessId: () => businessId,
        device: { installationId: () => installationId, publicKey: () => publicKey, privateKeyPem: () => d.secrets.get(SECRET_KEYS.devicePrivateKey) },
      });
      const sealed = await service.seal('pre_migration', businessId);
      return { ...sealed, encrypted: true, businessId };
    },
    restore: (backup, dbFile, nativeBinding) => restoreBackupFile(backup.path, dbFile, d.secrets, nativeBinding),
  };
}

// Encrypted when the secret store and the business allow it, else the plain copy (8i).
export function preferEncrypted(primary: PreMigrationBackups, fallback: PreMigrationBackups, log: Loggers['app']): PreMigrationBackups {
  return {
    async take(db, from, to) {
      try {
        return await primary.take(db, from, to);
      } catch (e) {
        log.warn({ err: e instanceof Error ? e.message : String(e) }, 'encrypted pre-migration backup unavailable; taking a plain copy');
        return fallback.take(db, from, to);
      }
    },
    restore: (backup, dbFile, nativeBinding) => (backup.encrypted ? primary : fallback).restore(backup, dbFile, nativeBinding),
  };
}
