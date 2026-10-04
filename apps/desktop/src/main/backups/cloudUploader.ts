import {
  backupsAwaitingUpload, setBackupUploaded, setBackupUploadFailed, setBackupUploading, supersedeUploadsBefore, type BackupLogEntry, type Db,
} from '@muneem/db-sqlite';
import type { Loggers } from '../infra/logger.js';
import { TransportError } from '../sync/transport.js';
import type { BackupKeyring } from './keyring.js';
import type { BackupTransport } from './transport.js';

export interface CloudUploaderDeps {
  db: () => Db;
  keyring: BackupKeyring;
  transport: () => BackupTransport | null;
  now: () => number;
  sleep: (ms: number) => Promise<void>;
  log: Loggers['sync'];
  attempts?: number;
}

const BACKOFF_MS = [2_000, 8_000, 30_000];

// A 4xx other than a timeout or a rate limit will not change by retrying now; the next trigger tries again.
const retryable = (e: unknown) => !(e instanceof TransportError) || e.status === 0 || e.status === 408 || e.status === 429 || e.status >= 500;

export interface UploadOutcome { uploaded: number; failed: number }

// 8f: the newest backup waiting goes up (escrow the key, presign, PUT, confirm); older ones waiting are superseded.
export class CloudBackupUploader {
  private running: Promise<UploadOutcome> | null = null;

  constructor(private readonly d: CloudUploaderDeps) {}

  uploadPending(): Promise<UploadOutcome> {
    this.running ??= this.uploadNewest().finally(() => { this.running = null; });
    return this.running;
  }

  private async uploadNewest(): Promise<UploadOutcome> {
    const newest = backupsAwaitingUpload(this.d.db())[0];
    const transport = this.d.transport();
    if (!newest || !transport) return { uploaded: 0, failed: 0 };
    supersedeUploadsBefore(this.d.db(), newest.createdAt);
    const attempts = this.d.attempts ?? BACKOFF_MS.length + 1;
    for (let attempt = 1; ; attempt++) {
      try {
        await this.upload(newest, transport);
        return { uploaded: 1, failed: 0 };
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        if (attempt >= attempts || !retryable(e)) {
          setBackupUploadFailed(this.d.db(), newest.id, message);
          this.d.log.warn({ code: 'BACKUP_UPLOAD_FAILED', backupId: newest.id, attempt, err: message }, 'backup upload failed');
          return { uploaded: 0, failed: 1 };
        }
        await this.d.sleep(BACKOFF_MS[attempt - 1] ?? BACKOFF_MS.at(-1)!);
      }
    }
  }

  private async upload(b: BackupLogEntry, transport: BackupTransport): Promise<void> {
    if (!b.businessId || !b.keyId || !b.sha256 || !b.schemaVersion) throw new Error('the backup row lacks what an upload needs');
    await this.d.keyring.ensureEscrowed(b.businessId, b.keyId);
    setBackupUploading(this.d.db(), b.id);
    const target = await transport.presignBackup({ businessId: b.businessId, bytes: b.bytes, sha256: b.sha256, keyId: b.keyId, schemaVersion: b.schemaVersion });
    await transport.uploadBackup({ url: target.url, path: b.path, bytes: b.bytes }, () => undefined);
    const confirmed = await transport.confirmBackup(target.backupId);
    setBackupUploaded(this.d.db(), b.id, confirmed.backupId, new Date(this.d.now()).toISOString());
    this.d.log.info({ backupId: b.id, cloudBackupId: confirmed.backupId, bytes: b.bytes }, 'backup uploaded');
  }
}
