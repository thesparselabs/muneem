import type { FailedOperation, ReviewItem, SyncOverview, SyncStream } from '@muneem/contracts';
import type { Db } from '../open.js';
import { stmt } from '../statements.js';
import { nowIso, withTransaction } from '../uow.js';
import { listCursors } from './syncState.js';

const PAYLOAD_PREVIEW_BYTES = 16_384;

export function syncOverview(db: Db, businessId: string): SyncOverview {
  const counts = { pending: 0, inFlight: 0, sent: 0, failed: 0, dead: 0, superseded: 0 };
  const rows = stmt(db, 'SELECT status, COUNT(*) AS n FROM sync_outbox WHERE business_id = ? GROUP BY status').all(businessId) as { status: string; n: number }[];
  for (const r of rows) counts[(r.status === 'in_flight' ? 'inFlight' : r.status) as keyof typeof counts] = r.n;
  const oldestPendingAt = stmt(db, "SELECT MIN(created_at) FROM sync_outbox WHERE business_id = ? AND status IN ('pending','in_flight','failed')").pluck().get(businessId) as string | null;
  const openReviewItems = stmt(db, 'SELECT COUNT(*) FROM conflict_log WHERE business_id = ? AND reviewed_at IS NULL').pluck().get(businessId) as number;
  const cursors: SyncOverview['cursors'] = listCursors(db, businessId).map((c) => ({ stream: c.stream as SyncStream, lastSeq: c.lastSeq, lastPulledAt: c.lastPulledAt }));
  return { counts, oldestPendingAt, cursors, openReviewItems };
}

type FailedRow = {
  operation_id: string; seq: number; entity_type: string; entity_id: string; operation_type: string; status: 'failed' | 'dead'; attempt_count: number;
  error_code: string | null; error_class: string | null; error_message: string | null; last_attempt_at: string | null; created_at: string; payload: string; bytes: number;
};

export function listFailedOperations(db: Db, businessId: string, limit: number): FailedOperation[] {
  const rows = stmt(db, `SELECT operation_id, seq, entity_type, entity_id, operation_type, status, attempt_count, error_code, error_class, error_message,
      last_attempt_at, created_at, substr(payload_json, 1, ${PAYLOAD_PREVIEW_BYTES}) AS payload, length(CAST(payload_json AS BLOB)) AS bytes
    FROM sync_outbox WHERE business_id = ? AND status IN ('failed','dead') ORDER BY status = 'dead' DESC, seq LIMIT ?`).all(businessId, limit) as FailedRow[];
  return rows.map((r) => ({
    operationId: r.operation_id, seq: r.seq, entityType: r.entity_type, entityId: r.entity_id, operationType: r.operation_type, status: r.status,
    attemptCount: r.attempt_count, errorCode: r.error_code, errorClass: r.error_class, errorMessage: r.error_message, lastAttemptAt: r.last_attempt_at,
    createdAt: r.created_at, payloadJson: r.payload, payloadBytes: r.bytes,
  }));
}

// A manager's resend: failed and dead operations go back to pending with a fresh attempt budget.
export function resendOperations(db: Db, businessId: string, operationIds: readonly string[]): number {
  return withTransaction(db, () => {
    const resend = stmt(db, `UPDATE sync_outbox SET status = 'pending', attempt_count = 0, next_attempt_at = NULL
      WHERE business_id = ? AND operation_id = ? AND status IN ('failed','dead')`);
    return operationIds.reduce((n, id) => n + resend.run(businessId, id).changes, 0);
  });
}

type ReviewRow = {
  id: string; kind: string; entity_type: string; entity_id: string; label: string | null; device_id: string | null; rule: string; winner: string; field: string | null;
  cloud_value_json: string | null; device_value_json: string | null; occurred_at: string; received_at: string; reviewed_at: string | null; reviewed_by: string | null;
};

const ENTITY_LABEL = `CASE c.entity_type
    WHEN 'product' THEN (SELECT name FROM product WHERE id = c.entity_id)
    WHEN 'customer' THEN (SELECT name FROM customer WHERE id = c.entity_id)
    WHEN 'supplier' THEN (SELECT name FROM supplier WHERE id = c.entity_id)
    WHEN 'category' THEN (SELECT name FROM category WHERE id = c.entity_id)
    WHEN 'barcode' THEN (SELECT code FROM barcode WHERE id = c.entity_id)
    WHEN 'sale' THEN (SELECT doc_number FROM sale WHERE id = c.entity_id)
  END`;

export function listReviewItems(db: Db, businessId: string, status: 'open' | 'reviewed' | 'all', limit: number): ReviewItem[] {
  const filter = status === 'open' ? 'AND c.reviewed_at IS NULL' : status === 'reviewed' ? 'AND c.reviewed_at IS NOT NULL' : '';
  const rows = stmt(db, `SELECT c.*, ${ENTITY_LABEL} AS label FROM conflict_log c WHERE c.business_id = ? ${filter}
    ORDER BY c.occurred_at DESC, c.id LIMIT ?`).all(businessId, limit) as ReviewRow[];
  return rows.map((r) => ({
    id: r.id, kind: r.kind, entityType: r.entity_type, entityId: r.entity_id, entityLabel: r.label, deviceId: r.device_id, rule: r.rule, winner: r.winner,
    field: r.field, cloudValueJson: r.cloud_value_json, deviceValueJson: r.device_value_json, occurredAt: r.occurred_at, receivedAt: r.received_at,
    reviewedAt: r.reviewed_at, reviewedBy: r.reviewed_by,
  }));
}

export function markReviewed(db: Db, businessId: string, ids: readonly string[], userId: string): number {
  return withTransaction(db, () => {
    const mark = stmt(db, 'UPDATE conflict_log SET reviewed_at = ?, reviewed_by = ? WHERE business_id = ? AND id = ? AND reviewed_at IS NULL');
    const at = nowIso();
    return ids.reduce((n, id) => n + mark.run(at, userId, businessId, id).changes, 0);
  });
}
