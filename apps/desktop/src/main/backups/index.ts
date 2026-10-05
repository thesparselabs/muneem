import type { Db } from '@muneem/db-sqlite';
import type { Loggers } from '../infra/logger.js';
import type { SecretStore } from '../infra/secrets.js';
import type { DeviceService } from '../services/device.js';
import type { SessionService } from '../services/session.js';
import type { BundleFetcher } from '../sync/transport.js';
import { BackupService } from './backupService.js';
import { CloudBackupUploader } from './cloudUploader.js';
import { backupHandlers } from './handlers.js';
import { BackupKeyring, type KeyEscrow } from './keyring.js';
import { RestoreService, type RestoreHost } from './restoreService.js';
import { BackupScheduler } from './scheduler.js';
import type { BackupTransport } from './transport.js';

export interface BackupsConfig {
  db: () => Db;
  dir: string;
  secrets: SecretStore;
  device: DeviceService;
  session: SessionService;
  transport: () => BackupTransport | null;
  fetcher: BundleFetcher;
  host: RestoreHost;
  appVersion: string;
  now: () => number;
  sleep: (ms: number) => Promise<void>;
  loggers: Loggers;
  auditScope: string;
}

const escrowOver = (t: BackupTransport): KeyEscrow => ({
  escrowKey: (businessId, keyId, key) => t.escrowBackupKey({ businessId, keyId, key }),
  fetchKey: (businessId, keyId) => t.fetchBackupKey(businessId, keyId),
});

// Stage 8f composition: keys, local backups, the cloud upload, restore, when they run, and their IPC handlers.
export function createBackups(c: BackupsConfig) {
  const keyring = new BackupKeyring(c.secrets, () => { const t = c.transport(); return t ? escrowOver(t) : null; });
  const backups = new BackupService({
    db: c.db, dir: c.dir, keyring, appVersion: c.appVersion, now: c.now, log: c.loggers.app, sessionBusinessId: () => c.session.get()?.businessId ?? null,
    device: { installationId: () => c.device.installationId(), publicKey: () => c.device.ensureIdentity().publicKeyB64, privateKeyPem: () => c.device.privateKeyPem() },
  });
  const uploader = new CloudBackupUploader({ db: c.db, keyring, transport: c.transport, now: c.now, sleep: c.sleep, log: c.loggers.sync });
  const restore = new RestoreService({
    db: c.db, dir: c.dir, backups, transport: c.transport, fetcher: c.fetcher, device: c.device, session: c.session, host: c.host, log: c.loggers.app, auditScope: c.auditScope,
  });
  const scheduler = new BackupScheduler(backups, uploader, c.loggers.app);
  return { keyring, backups, uploader, restore, scheduler, handlers: backupHandlers({ backups, restore, scheduler }) };
}
export type Backups = ReturnType<typeof createBackups>;

export type { RestoreHost } from './restoreService.js';
export type { BackupTransport } from './transport.js';
