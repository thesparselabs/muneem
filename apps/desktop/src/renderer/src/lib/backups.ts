import type { BackupHealth, BackupKind, LocalBackup } from '@muneem/contracts';
import { ago } from './sync/status.js';

export const KIND_LABEL: Record<BackupKind, string> = {
  scheduled: 'Scheduled', manual: 'Manual', pre_migration: 'Before an update', z_report: 'After the Z report', pre_restore: 'Before a restore',
};

const CLOUD_LABEL: Record<LocalBackup['cloudStatus'], string> = { none: 'Local only', pending: 'Waiting to upload', uploading: 'Uploading', uploaded: 'In the cloud', failed: 'Upload failed' };

export function cloudLabel(b: LocalBackup): string {
  return b.cloudStatus === 'failed' && b.cloudError ? `${CLOUD_LABEL.failed}: ${b.cloudError}` : CLOUD_LABEL[b.cloudStatus];
}

export const size = (bytes: number) => (bytes >= 1_048_576 ? `${(bytes / 1_048_576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);

export type HealthTone = 'ok' | 'warn' | 'error';

// NFR-011 in one line: when the last good backup was, and what is wrong if anything.
export function healthSummary(h: BackupHealth, now: number): { tone: HealthTone; text: string } {
  const last = h.lastSuccessAt ? `Last backup ${ago(h.lastSuccessAt, now)}` : 'No backup yet';
  if (h.status === 'failing') return { tone: 'error', text: `${last}. The latest backup failed: ${h.lastError ?? 'unknown error'}` };
  if (h.status === 'never') return { tone: 'warn', text: last };
  if (h.status === 'stale') return { tone: 'warn', text: `${last} — more than a day old` };
  if (h.lastUploadError) return { tone: 'warn', text: `${last}. Cloud upload failed: ${h.lastUploadError}` };
  return { tone: 'ok', text: `${last}${h.lastUploadAt ? ` · uploaded ${ago(h.lastUploadAt, now)}` : ''}` };
}
