import { SYNC_PROTOCOL } from '@muneem/contracts';
import { getSyncDevice, saveSyncDevice, setSyncDeviceStatus, type Db, type SyncDeviceStatus } from '@muneem/db-sqlite';
import { isTransportError, type Transport } from './transport.js';

export interface WireIdentity { businessId: string; cloudDeviceId: string }
export interface IdentitySource { installationId(): string; cloudDeviceId(): string | null }

export type Readiness = { ready: true; identity: WireIdentity } | { ready: false; reason: string };

// ADR-0039: the device syncs as its cloud id, kept in sync_device; unregistered, revoked or out-of-date devices do not sync.
export function readiness(db: Db, device: IdentitySource, businessId: string | null, schemaVersion: number): Readiness {
  const cloudDeviceId = device.cloudDeviceId();
  if (!cloudDeviceId) return { ready: false, reason: 'This device is not registered with the cloud yet' };
  if (!businessId) return { ready: false, reason: 'No business is open' };
  const saved = saveSyncDevice(db, { installationId: device.installationId(), cloudDeviceId, protocol: SYNC_PROTOCOL, schemaVersion });
  if (saved.status !== 'active') return { ready: false, reason: saved.statusDetail ?? saved.status };
  return { ready: true, identity: { businessId, cloudDeviceId } };
}

// FR-105 and 7c: a revoked device or one the cloud will not talk to any more stops and says so.
export function blockingStatus(e: unknown): { status: SyncDeviceStatus; detail: string } | null {
  if (!isTransportError(e)) return null;
  if (e.code === 'DEVICE_REVOKED') return { status: 'revoked', detail: 'This device was removed from the business' };
  if (e.status === 426 || e.code === 'VERSION_UNSUPPORTED' || e.code === 'UPGRADE_REQUIRED') return { status: 'upgrade_required', detail: 'Update Muneem to keep syncing' };
  return null;
}

export function block(db: Db, e: unknown): boolean {
  const b = blockingStatus(e);
  if (b && getSyncDevice(db)) setSyncDeviceStatus(db, b.status, b.detail);
  return b !== null;
}

// Refusals a fresh token cannot cure: the Go API answers a skewed clock with 401 too, and /auth/refresh is not clock-checked.
const NOT_A_TOKEN_PROBLEM = new Set(['DEVICE_REVOKED', 'DEVICE_CLOCK_SKEW']);

// A 401 about the token refreshes it and tries once more (7d).
export async function authorized<T>(call: (t: Transport) => Promise<T>, transport: Transport, refresh: () => Promise<boolean>): Promise<T> {
  try {
    return await call(transport);
  } catch (e) {
    if (!isTransportError(e) || e.status !== 401 || NOT_A_TOKEN_PROBLEM.has(e.code) || !(await refresh())) throw e;
    return call(transport);
  }
}
