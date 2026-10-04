import type { HttpComponents } from '@muneem/contracts';

export type CloudBackupDto = HttpComponents['schemas']['Backup'];
export type CloudBackupDownload = HttpComponents['schemas']['BackupDownload'];
export type BackupPresignRequest = HttpComponents['schemas']['BackupPresignRequest'];
export type BackupUploadTarget = HttpComponents['schemas']['BackupUpload'];
export type EscrowedKey = HttpComponents['schemas']['BackupKey'];

// 8f: the object goes straight to storage with a plain PUT of the presigned URL, streamed from the file main names.
export interface BackupObjectUpload { url: string; path: string; bytes: number }

// The /backups wire (ADR-0047): HTTP in the utility process, a proxy to it from main, or a fake cloud in tests.
export interface BackupTransport {
  presignBackup(request: BackupPresignRequest): Promise<BackupUploadTarget>;
  uploadBackup(request: BackupObjectUpload, onProgress: (bytes: number) => void): Promise<void>;
  confirmBackup(backupId: string): Promise<CloudBackupDto>;
  listBackups(businessId: string): Promise<CloudBackupDto[]>;
  getBackup(backupId: string): Promise<CloudBackupDownload>;
  escrowBackupKey(key: EscrowedKey): Promise<void>;
  // Resolves null when the cloud holds no key for the business.
  fetchBackupKey(businessId: string, keyId?: string): Promise<EscrowedKey | null>;
}

export const isBackupTransport = (t: unknown): t is BackupTransport => typeof (t as Partial<BackupTransport> | null)?.presignBackup === 'function';
