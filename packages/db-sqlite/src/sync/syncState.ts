import type { SyncStream } from '@muneem/contracts';
import type { Db } from '../open.js';
import { stmt } from '../statements.js';
import { nowIso } from '../uow.js';

export type SyncDeviceStatus = 'active' | 'revoked' | 'upgrade_required';
export interface SyncDevice { installationId: string; cloudDeviceId: string; protocol: number; schemaVersion: number; status: SyncDeviceStatus; statusDetail: string | null }

type DeviceRow = { installation_id: string; cloud_device_id: string; protocol: number; schema_version: number; status: SyncDeviceStatus; status_detail: string | null };

export function getSyncDevice(db: Db): SyncDevice | null {
  const r = stmt(db, 'SELECT * FROM sync_device WHERE id = 1').get() as DeviceRow | undefined;
  return r ? {
    installationId: r.installation_id, cloudDeviceId: r.cloud_device_id, protocol: r.protocol, schemaVersion: r.schema_version, status: r.status,
    statusDetail: r.status_detail,
  } : null;
}

// ADR-0039: the cloud device id the device pushes and pulls as; a new registration resets the status.
export function saveSyncDevice(db: Db, d: Omit<SyncDevice, 'status' | 'statusDetail'>): SyncDevice {
  const current = getSyncDevice(db);
  if (current && current.cloudDeviceId === d.cloudDeviceId && current.protocol === d.protocol && current.schemaVersion === d.schemaVersion) return current;
  stmt(db, `INSERT INTO sync_device (id, installation_id, cloud_device_id, protocol, schema_version, status, status_detail, updated_at)
    VALUES (1, @installationId, @cloudDeviceId, @protocol, @schemaVersion, 'active', NULL, @t)
    ON CONFLICT (id) DO UPDATE SET installation_id = excluded.installation_id, cloud_device_id = excluded.cloud_device_id, protocol = excluded.protocol,
      schema_version = excluded.schema_version, status = CASE WHEN sync_device.cloud_device_id = excluded.cloud_device_id THEN sync_device.status ELSE 'active' END,
      updated_at = excluded.updated_at`).run({ ...d, t: nowIso() });
  return getSyncDevice(db)!;
}

export function setSyncDeviceStatus(db: Db, status: SyncDeviceStatus, detail: string | null): void {
  stmt(db, 'UPDATE sync_device SET status = ?, status_detail = ?, updated_at = ? WHERE id = 1').run(status, detail, nowIso());
}

export function getCursor(db: Db, businessId: string, stream: SyncStream): number {
  return (stmt(db, 'SELECT last_seq FROM sync_cursor WHERE business_id = ? AND stream = ?').pluck().get(businessId, stream) as number | undefined) ?? 0;
}

export function setCursor(db: Db, businessId: string, stream: SyncStream, seq: number, at: string): void {
  stmt(db, `INSERT INTO sync_cursor (business_id, stream, last_seq, last_pulled_at) VALUES (?, ?, ?, ?)
    ON CONFLICT (business_id, stream) DO UPDATE SET last_seq = MAX(sync_cursor.last_seq, excluded.last_seq), last_pulled_at = excluded.last_pulled_at`)
    .run(businessId, stream, seq, at);
}

export function listCursors(db: Db, businessId: string): { stream: SyncStream; lastSeq: number; lastPulledAt: string | null }[] {
  return stmt(db, 'SELECT stream, last_seq AS lastSeq, last_pulled_at AS lastPulledAt FROM sync_cursor WHERE business_id = ? ORDER BY stream').all(businessId) as {
    stream: SyncStream; lastSeq: number; lastPulledAt: string | null;
  }[];
}

// sync_log feeds the status badge: the last push and pull, and the last error in words.
export function recordPush(db: Db, at: string, ok: boolean, error: string | null): void {
  stmt(db, 'UPDATE sync_log SET last_push_at = ?, last_push_ok = ?, last_error = ? WHERE id = 1').run(at, ok ? 1 : 0, error);
}

export function recordPull(db: Db, at: string, ok: boolean, error: string | null): void {
  stmt(db, `UPDATE sync_log SET last_pull_at = CASE WHEN ? THEN ? ELSE last_pull_at END, last_pull_ok = ?, last_error = COALESCE(?, last_error) WHERE id = 1`)
    .run(ok ? 1 : 0, at, ok ? 1 : 0, error);
}
