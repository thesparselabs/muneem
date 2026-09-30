import { createHash } from 'node:crypto';
import { newUlid } from '@muneem/domain';
import type { OutboxEntityType, OutboxOperationType } from '@muneem/contracts';
import { canonicalJson } from './canonical.js';
import type { Db } from './open.js';
import { nowIso } from './uow.js';
import { stmt } from './statements.js';

export interface OutboxInput {
  businessId: string;
  deviceId: string;
  entityType: OutboxEntityType;
  entityId: string;
  operationType: OutboxOperationType;
  payload: unknown;
  dependsOnOperationId?: string | null;
}

/** Transactional outbox (HLD §6): called inside the same SQLite transaction as the business write. */
export function appendOutbox(db: Db, o: OutboxInput): { operationId: string; seq: number } {
  const operationId = newUlid();
  const payloadJson = canonicalJson(o.payload);
  const payloadHash = 'sha256:' + createHash('sha256').update(payloadJson).digest('hex');
  const r = stmt(db, `INSERT INTO sync_outbox (operation_id, business_id, device_id, entity_type, entity_id, operation_type,
      payload_json, payload_hash, depends_on_operation_id, status, attempt_count, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 0, ?)`).run(
    operationId, o.businessId, o.deviceId, o.entityType, o.entityId, o.operationType, payloadJson, payloadHash,
    o.dependsOnOperationId ?? null, nowIso(),
  );
  return { operationId, seq: Number(r.lastInsertRowid) };
}

export function lastOutboxOperationId(db: Db, businessId: string, entityType: string, entityId: string): string | null {
  const row = db.prepare('SELECT operation_id FROM sync_outbox WHERE business_id = ? AND entity_type = ? AND entity_id = ? ORDER BY seq DESC LIMIT 1')
    .get(businessId, entityType, entityId) as { operation_id: string } | undefined;
  return row?.operation_id ?? null;
}
