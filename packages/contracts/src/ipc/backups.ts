import { z } from 'zod';

// ADR-0047: encrypted local backups with retention, uploaded to the cloud with the data key escrowed there.
export const BackupKind = z.enum(['scheduled', 'manual', 'pre_migration', 'z_report', 'pre_restore']);
export type BackupKind = z.infer<typeof BackupKind>;
export const BackupCloudStatus = z.enum(['none', 'pending', 'uploading', 'uploaded', 'failed']);

export const LocalBackup = z.object({
  id: z.string(), kind: BackupKind, createdAt: z.string(), bytes: z.number().int(), verified: z.boolean(), encrypted: z.boolean(),
  businessId: z.string().nullable(), schemaVersion: z.number().int().nullable(), error: z.string().nullable(),
  cloudStatus: BackupCloudStatus, cloudError: z.string().nullable(), uploadedAt: z.string().nullable(),
});
export type LocalBackup = z.infer<typeof LocalBackup>;

export const CloudBackup = z.object({
  backupId: z.string(), businessId: z.string(), deviceId: z.string(), createdAt: z.string(), bytes: z.number().int(), schemaVersion: z.number().int(), keyId: z.string(),
});
export type CloudBackup = z.infer<typeof CloudBackup>;

// NFR-011: backup health is "ok" while the last good backup is under a day old.
export const BackupHealth = z.object({
  status: z.enum(['ok', 'stale', 'failing', 'never']), lastSuccessAt: z.string().nullable(), ageHours: z.number().nullable(),
  lastError: z.string().nullable(), lastErrorAt: z.string().nullable(), lastUploadAt: z.string().nullable(), lastUploadError: z.string().nullable(),
  awaitingUpload: z.number().int(),
});
export type BackupHealth = z.infer<typeof BackupHealth>;

export const BackupList = z.object({ local: z.array(LocalBackup), cloud: z.array(CloudBackup), cloudError: z.string().nullable(), health: BackupHealth });
export type BackupList = z.infer<typeof BackupList>;

export const BackupRef = z.object({ source: z.enum(['local', 'cloud']), id: z.string().min(1).max(64) });
export type BackupRef = z.infer<typeof BackupRef>;

export const BackupVerification = z.object({
  ok: z.boolean(), detail: z.string(), createdAt: z.string().nullable(), schemaVersion: z.number().int().nullable(),
  rowCounts: z.record(z.number().int()).nullable(),
});
export type BackupVerification = z.infer<typeof BackupVerification>;

export const RestoreBackupInput = BackupRef.extend({ confirm: z.literal(true) });
export const RestoreFromCloudInput = z.object({ businessId: z.string().min(1).max(64), confirm: z.literal(true) });
export const RestoreResult = z.object({ restarting: z.literal(true), safetyBackupId: z.string().nullable() });
export type RestoreResult = z.infer<typeof RestoreResult>;

export const RunBackupResult = z.object({ backup: LocalBackup });
export type RunBackupResult = z.infer<typeof RunBackupResult>;
