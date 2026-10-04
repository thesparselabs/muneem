import type { OutboxErrorClass } from '@muneem/contracts';
import type { Db } from '../open.js';
import { stmt } from '../statements.js';
import { withTransaction } from '../uow.js';

export interface ClaimedOperation {
  seq: number; operationId: string; entityType: string; entityId: string; operationType: 'create' | 'update' | 'cancel' | 'void';
  dependsOn: string | null; payloadHash: string; payloadJson: string; attemptCount: number;
}
export interface ClaimLimits { maxOperations: number; maxBytes: number }

type Row = {
  seq: number; operation_id: string; entity_type: string; entity_id: string; operation_type: ClaimedOperation['operationType'];
  depends_on_operation_id: string | null; payload_hash: string; payload_json: string; attempt_count: number;
};
const toClaimed = (r: Row): ClaimedOperation => ({
  seq: r.seq, operationId: r.operation_id, entityType: r.entity_type, entityId: r.entity_id, operationType: r.operation_type,
  dependsOn: r.depends_on_operation_id, payloadHash: r.payload_hash, payloadJson: r.payload_json, attemptCount: r.attempt_count,
});

const UNSENT = "('pending','in_flight','failed','dead')";

// Due operations in seq order, skipping any whose dependency is still unsent and not ahead of it in this batch.
function dueRows(db: Db, businessId: string, now: string, limits: ClaimLimits): Row[] {
  const rows = stmt(db, `SELECT seq, operation_id, entity_type, entity_id, operation_type, depends_on_operation_id, payload_hash, payload_json, attempt_count
    FROM sync_outbox WHERE business_id = ? AND status IN ('pending','failed') AND (next_attempt_at IS NULL OR next_attempt_at <= ?)
    ORDER BY seq LIMIT ?`).all(businessId, now, limits.maxOperations * 2) as Row[];
  const unsent = new Set(stmt(db, `SELECT operation_id FROM sync_outbox WHERE business_id = ? AND status IN ${UNSENT}`).pluck().all(businessId) as string[]);
  const taken: Row[] = [];
  const takenIds = new Set<string>();
  let bytes = 0;
  for (const r of rows) {
    if (taken.length >= limits.maxOperations) break;
    const dep = r.depends_on_operation_id;
    if (dep && unsent.has(dep) && !takenIds.has(dep)) continue;
    const size = Buffer.byteLength(r.payload_json, 'utf8');
    if (taken.length > 0 && bytes + size > limits.maxBytes) break;
    taken.push(r);
    takenIds.add(r.operation_id);
    bytes += size;
  }
  return taken;
}

// 7d claim: due rows become in_flight in one transaction, so a crash between claim and result leaves them reclaimable.
export function claimBatch(db: Db, businessId: string, batchId: string, now: string, limits: ClaimLimits): ClaimedOperation[] {
  return withTransaction(db, () => {
    const rows = dueRows(db, businessId, now, limits);
    const claim = stmt(db, "UPDATE sync_outbox SET status = 'in_flight', batch_id = ?, last_attempt_at = ? WHERE seq = ? AND status IN ('pending','failed')");
    for (const r of rows) claim.run(batchId, now, r.seq);
    return rows.map(toClaimed);
  });
}

export type Settlement =
  | { seq: number; outcome: 'sent' }
  | { seq: number; outcome: 'pending' | 'failed' | 'dead'; nextAttemptAt: string | null; code: string; message: string; errorClass: OutboxErrorClass };

export function settleOperations(db: Db, settlements: readonly Settlement[]): void {
  withTransaction(db, () => {
    const sent = stmt(db, `UPDATE sync_outbox SET status = 'sent', attempt_count = attempt_count + 1, next_attempt_at = NULL, error_code = NULL,
      error_message = NULL, error_class = NULL WHERE seq = ? AND status = 'in_flight'`);
    const retry = stmt(db, `UPDATE sync_outbox SET status = ?, attempt_count = attempt_count + 1, next_attempt_at = ?, error_code = ?, error_message = ?,
      error_class = ? WHERE seq = ? AND status = 'in_flight'`);
    for (const s of settlements) {
      if (s.outcome === 'sent') sent.run(s.seq);
      else retry.run(s.outcome, s.nextAttemptAt, s.code, s.message.slice(0, 500), s.errorClass, s.seq);
    }
  });
}

// A batch that never got an answer goes back as it was; `countAttempt` is false when the device itself is at fault (auth, upgrade).
export function releaseBatch(db: Db, batchId: string, r: { nextAttemptAt: string | null; code: string; message: string; countAttempt: boolean }): number {
  return stmt(db, `UPDATE sync_outbox SET status = 'pending', attempt_count = attempt_count + ?, next_attempt_at = ?, error_code = ?, error_message = ?,
    error_class = 'transient' WHERE batch_id = ? AND status = 'in_flight'`).run(r.countAttempt ? 1 : 0, r.nextAttemptAt, r.code, r.message.slice(0, 500), batchId).changes;
}

// Start-up recovery (7d): in_flight rows older than the cut-off were claimed by a process that died.
export function reclaimStale(db: Db, claimedBefore: string): number {
  return stmt(db, "UPDATE sync_outbox SET status = 'pending' WHERE status = 'in_flight' AND (last_attempt_at IS NULL OR last_attempt_at < ?)").run(claimedBefore).changes;
}

export function retryNow(db: Db, businessId: string): number {
  return stmt(db, "UPDATE sync_outbox SET next_attempt_at = NULL WHERE business_id = ? AND status IN ('pending','failed')").run(businessId).changes;
}

type UpdateRow = { seq: number; operation_id: string; entity_type: string; entity_id: string; payload_json: string };

// An unsent update replaced by a later one that says at least as much, with nothing waiting on it, is superseded (7d).
export function supersedeStale(db: Db, businessId: string, entityTypes: ReadonlySet<string>): number {
  return withTransaction(db, () => {
    const rows = (stmt(db, `SELECT seq, operation_id, entity_type, entity_id, payload_json FROM sync_outbox
      WHERE business_id = ? AND status IN ('pending','failed') AND operation_type = 'update' ORDER BY seq`).all(businessId) as UpdateRow[])
      .filter((r) => entityTypes.has(r.entity_type));
    const waitedOn = new Set(stmt(db, 'SELECT depends_on_operation_id FROM sync_outbox WHERE business_id = ? AND depends_on_operation_id IS NOT NULL')
      .pluck().all(businessId) as string[]);
    const supersede = stmt(db, "UPDATE sync_outbox SET status = 'superseded' WHERE seq = ? AND status IN ('pending','failed')");
    let n = 0;
    rows.forEach((r, i) => {
      if (waitedOn.has(r.operation_id)) return;
      const keys = Object.keys(JSON.parse(r.payload_json) as object);
      const later = rows.slice(i + 1).find((x) => x.entity_type === r.entity_type && x.entity_id === r.entity_id);
      if (!later) return;
      const laterKeys = new Set(Object.keys(JSON.parse(later.payload_json) as object));
      if (keys.every((k) => laterKeys.has(k))) n += supersede.run(r.seq).changes;
    });
    return n;
  });
}
