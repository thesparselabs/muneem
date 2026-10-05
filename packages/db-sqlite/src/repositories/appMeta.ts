import type { Db } from '../open.js';
import { nowIso } from '../uow.js';

export const META_KEYS = {
  installationId: 'installation_id',
  deviceId: 'device_id',
  devicePublicKey: 'device_public_key',
  deviceRegisteredAt: 'device_registered_at',
  activeBusinessId: 'active_business_id',
  activeBranchId: 'active_branch_id',
  activeTerminalId: 'active_terminal_id',
  lastBackupAt: 'last_backup_at',
  serverSkewMs: 'server_skew_ms',
  lastServerContactAt: 'last_server_contact_at',
  restoreCatchUp: 'restore_catch_up_own', // 8f: after restoring this device's own backup, pull its own changes back too
  integrityReport: 'integrity_report', // ADR-0054: JSON of the last scheduled integrity run, carried on the sync heartbeat
  crashReportLast: 'crash_report_last', // ADR-0053: when the last crash or error report was sent, for Diagnostics
} as const;

export const integrityReportKey = (businessId: string) => `${META_KEYS.integrityReport}:${businessId}`;

export function getMeta(db: Db, key: string): string | null {
  const r = db.prepare('SELECT value FROM app_meta WHERE key = ?').get(key) as { value: string } | undefined;
  return r?.value ?? null;
}
export function setMeta(db: Db, key: string, value: string): void {
  db.prepare('INSERT INTO app_meta (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at')
    .run(key, value, nowIso());
}
export function deleteMeta(db: Db, key: string): void {
  db.prepare('DELETE FROM app_meta WHERE key = ?').run(key);
}
