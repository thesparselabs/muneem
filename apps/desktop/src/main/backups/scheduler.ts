import type { BackupKind } from '@muneem/contracts';
import type { BackupLogEntry } from '@muneem/db-sqlite';
import type { Loggers } from '../infra/logger.js';
import type { BackupService } from './backupService.js';
import type { CloudBackupUploader } from './cloudUploader.js';

// When backups happen (HLD §12): every few hours with one a day going to the cloud, after a Z report, and on demand.
export class BackupScheduler {
  constructor(private readonly backups: BackupService, private readonly uploader: CloudBackupUploader, private readonly log: Loggers['app']) {}

  async scheduled(): Promise<BackupLogEntry | null> {
    if (!this.backups.businessId()) return null;
    const b = await this.backups.run('scheduled', { upload: this.backups.nightlyDue() });
    await this.uploader.uploadPending();
    return b;
  }

  async now(kind: BackupKind = 'manual'): Promise<BackupLogEntry> {
    const b = await this.backups.run(kind, { upload: true });
    this.uploadInBackground();
    return b;
  }

  // A closed register is the day's books settled: back them up and send them, after the closing transaction has committed.
  afterRegisterClose(): void {
    setTimeout(() => {
      this.now('z_report').catch((e: unknown) => this.log.error({ err: String(e) }, 'backup after the Z report failed'));
    }, 0);
  }

  uploadInBackground(): void {
    this.uploader.uploadPending().catch((e: unknown) => this.log.error({ err: String(e) }, 'backup upload failed'));
  }
}
