import type { Db } from '../open.js';
import { stmt } from '../statements.js';

export type BackupKind = 'scheduled' | 'manual' | 'pre_migration' | 'z_report' | 'pre_restore';
export type BackupCloudStatus = 'none' | 'pending' | 'uploading' | 'uploaded' | 'failed';

export interface BackupLogEntry {
  id: string; path: string; bytes: number; verified: boolean; kind: BackupKind; createdAt: string;
  businessId: string | null; encrypted: boolean; keyId: string | null; sha256: string | null; schemaVersion: number | null; error: string | null;
  cloudStatus: BackupCloudStatus; cloudBackupId: string | null; cloudAttempts: number; cloudError: string | null; uploadedAt: string | null; prunedAt: string | null;
}

export type NewBackupLogEntry = Pick<BackupLogEntry, 'id' | 'path' | 'bytes' | 'verified' | 'kind' | 'createdAt'>
  & Partial<Pick<BackupLogEntry, 'businessId' | 'encrypted' | 'keyId' | 'sha256' | 'schemaVersion' | 'error' | 'cloudStatus'>>;

interface Row {
  id: string; path: string; bytes: number; verified: number; kind: BackupKind; created_at: string; business_id: string | null; encrypted: number; key_id: string | null;
  sha256: string | null; schema_version: number | null; error: string | null; cloud_status: BackupCloudStatus; cloud_backup_id: string | null; cloud_attempts: number;
  cloud_error: string | null; uploaded_at: string | null; pruned_at: string | null;
}

const toEntry = (r: Row): BackupLogEntry => ({
  id: r.id, path: r.path, bytes: r.bytes, verified: r.verified === 1, kind: r.kind, createdAt: r.created_at, businessId: r.business_id, encrypted: r.encrypted === 1,
  keyId: r.key_id, sha256: r.sha256, schemaVersion: r.schema_version, error: r.error, cloudStatus: r.cloud_status, cloudBackupId: r.cloud_backup_id,
  cloudAttempts: r.cloud_attempts, cloudError: r.cloud_error, uploadedAt: r.uploaded_at, prunedAt: r.pruned_at,
});

export function insertBackupLog(db: Db, e: NewBackupLogEntry): void {
  stmt(db, `INSERT INTO backup_log (id, path, bytes, verified, kind, created_at, business_id, encrypted, key_id, sha256, schema_version, error, cloud_status)
    VALUES (@id, @path, @bytes, @verified, @kind, @createdAt, @businessId, @encrypted, @keyId, @sha256, @schemaVersion, @error, @cloudStatus)`).run({
    ...e, verified: e.verified ? 1 : 0, encrypted: e.encrypted ? 1 : 0, businessId: e.businessId ?? null, keyId: e.keyId ?? null, sha256: e.sha256 ?? null,
    schemaVersion: e.schemaVersion ?? null, error: e.error ?? null, cloudStatus: e.cloudStatus ?? 'none',
  });
}

export function getBackupLog(db: Db, id: string): BackupLogEntry | null {
  const r = stmt(db, 'SELECT * FROM backup_log WHERE id = ?').get(id) as Row | undefined;
  return r ? toEntry(r) : null;
}

// Newest first; pruned rows stay as history but are not listed unless asked for.
export function listBackupLog(db: Db, opts: { includePruned?: boolean } = {}): BackupLogEntry[] {
  const where = opts.includePruned ? '' : 'WHERE pruned_at IS NULL';
  return (stmt(db, `SELECT * FROM backup_log ${where} ORDER BY created_at DESC, id DESC`).all() as Row[]).map(toEntry);
}

export function markBackupPruned(db: Db, id: string, at: string): void {
  stmt(db, 'UPDATE backup_log SET pruned_at = ? WHERE id = ? AND pruned_at IS NULL').run(at, id);
}

export function markBackupForUpload(db: Db, id: string): void {
  stmt(db, "UPDATE backup_log SET cloud_status = 'pending', cloud_error = NULL WHERE id = ? AND cloud_status IN ('none','failed')").run(id);
}

export function setBackupUploading(db: Db, id: string): void {
  stmt(db, "UPDATE backup_log SET cloud_status = 'uploading', cloud_attempts = cloud_attempts + 1 WHERE id = ?").run(id);
}

export function setBackupUploaded(db: Db, id: string, cloudBackupId: string, at: string): void {
  stmt(db, "UPDATE backup_log SET cloud_status = 'uploaded', cloud_backup_id = ?, cloud_error = NULL, uploaded_at = ? WHERE id = ?").run(cloudBackupId, at, id);
}

export function setBackupUploadFailed(db: Db, id: string, error: string): void {
  stmt(db, "UPDATE backup_log SET cloud_status = 'failed', cloud_error = ? WHERE id = ?").run(error, id);
}

// A run killed mid-upload left 'uploading'; it is simply tried again.
export function backupsAwaitingUpload(db: Db): BackupLogEntry[] {
  return (stmt(db, `SELECT * FROM backup_log WHERE cloud_status IN ('pending','uploading','failed') AND pruned_at IS NULL AND encrypted = 1 AND verified = 1
    ORDER BY created_at DESC, id DESC`).all() as Row[]).map(toEntry);
}

// Only the newest backup goes up; older ones still waiting are no longer needed in the cloud.
export function supersedeUploadsBefore(db: Db, createdAt: string): void {
  stmt(db, "UPDATE backup_log SET cloud_status = 'none', cloud_error = NULL WHERE cloud_status IN ('pending','uploading','failed') AND created_at < ?").run(createdAt);
}

// When a backup was last chosen for the cloud, so the nightly one is chosen about once a day.
export function lastUploadChosenAt(db: Db): string | null {
  return (stmt(db, "SELECT max(created_at) FROM backup_log WHERE cloud_status <> 'none'").pluck().get() as string | null) ?? null;
}

export interface BackupHealthRow {
  lastSuccessAt: string | null; lastAttemptAt: string | null; lastError: string | null; lastErrorAt: string | null;
  lastUploadAt: string | null; lastUploadError: string | null; awaitingUpload: number;
}

export function backupHealth(db: Db): BackupHealthRow {
  const one = <T>(sql: string) => stmt(db, sql).get() as T | undefined;
  const success = one<{ at: string }>("SELECT max(created_at) AS at FROM backup_log WHERE verified = 1 AND kind <> 'pre_migration'");
  const attempt = one<{ at: string }>("SELECT max(created_at) AS at FROM backup_log WHERE kind <> 'pre_migration'");
  const failure = one<{ at: string; error: string }>('SELECT created_at AS at, error FROM backup_log WHERE verified = 0 ORDER BY created_at DESC LIMIT 1');
  const upload = one<{ at: string }>('SELECT max(uploaded_at) AS at FROM backup_log');
  const uploadError = one<{ error: string }>("SELECT cloud_error AS error FROM backup_log WHERE cloud_status = 'failed' AND pruned_at IS NULL ORDER BY created_at DESC LIMIT 1");
  const awaiting = one<{ n: number }>("SELECT count(*) AS n FROM backup_log WHERE cloud_status IN ('pending','uploading','failed') AND pruned_at IS NULL")!;
  return {
    lastSuccessAt: success?.at ?? null, lastAttemptAt: attempt?.at ?? null, lastError: failure?.error ?? null, lastErrorAt: failure?.at ?? null,
    lastUploadAt: upload?.at ?? null, lastUploadError: uploadError?.error ?? null, awaitingUpload: awaiting.n,
  };
}
