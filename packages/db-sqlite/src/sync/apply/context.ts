import type { Change } from '@muneem/contracts';
import type { Db } from '../../open.js';
import type { Actor } from '../../repositories/business.js';
import { stmt } from '../../statements.js';

export type Payload = Record<string, unknown>;

// Everything an apply function needs besides the change: whose books, and who the rows are from.
export interface ApplyContext {
  db: Db;
  businessId: string;
  cloudDeviceId: string;
  change: Change;
  actor: Actor;
  touched: Touched;
}

// Stock keys whose levels follow the inserted movements once the page is in (7e).
export class Touched {
  private readonly keys = new Map<string, { warehouseId: string; productId: string }>();
  add(warehouseId: string, productId: string): void { this.keys.set(`${warehouseId}|${productId}`, { warehouseId, productId }); }
  list(): { warehouseId: string; productId: string }[] { return [...this.keys.values()]; }
}

const str = (v: unknown): string | null => (typeof v === 'string' && v.length > 0 ? v : null);

// Rows another device made carry its user and the cloud's id for it; the local audit chain never sees them (ADR-0040).
export const actorFor = (change: Change): Actor => ({ userId: str(change.payload.createdBy) ?? 'sync', deviceId: change.originDeviceId ?? 'cloud', terminalId: null });

export const syncedAt = (p: Payload): string => str(p.createdAt) ?? new Date().toISOString();

export function appliedVersion(db: Db, businessId: string, entityType: string, entityId: string): number {
  return (stmt(db, 'SELECT version FROM sync_entity_version WHERE business_id = ? AND entity_type = ? AND entity_id = ?').pluck()
    .get(businessId, entityType, entityId) as number | undefined) ?? 0;
}

export function markApplied(db: Db, businessId: string, entityType: string, entityId: string, version: number): void {
  stmt(db, `INSERT INTO sync_entity_version (business_id, entity_type, entity_id, version) VALUES (?, ?, ?, ?)
    ON CONFLICT (business_id, entity_type, entity_id) DO UPDATE SET version = MAX(version, excluded.version)`).run(businessId, entityType, entityId, version);
}

// ADR-0041: a local entity with an unsent edit is left alone; the cloud's merge comes back once that push lands.
export function hasUnsentEdit(db: Db, businessId: string, entityType: string, entityId: string): boolean {
  return stmt(db, `SELECT 1 FROM sync_outbox WHERE business_id = ? AND entity_type = ? AND entity_id = ? AND status IN ('pending','in_flight','failed') LIMIT 1`)
    .get(businessId, entityType, entityId) !== undefined;
}
