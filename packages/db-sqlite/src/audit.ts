import { createHash } from 'node:crypto';
import { auditHashInput } from '@muneem/contracts';
import { newUlid } from '@muneem/domain';
import { canonicalJson } from './canonical.js';
import type { Db } from './open.js';
import { appendOutbox, lastOutboxOperationId } from './outbox.js';
import { nowIso, withTransaction } from './uow.js';
import { stmt } from './statements.js';

export interface AuditInput {
  businessId: string;
  deviceId: string;
  userId: string;
  terminalId?: string | null | undefined;
  action: string;
  entityType: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
  reason?: string | null;
  occurredAt?: string;
}

export interface AuditRow {
  id: string; business_id: string; seq: number; user_id: string; device_id: string; terminal_id: string | null;
  action: string; entity_type: string; entity_id: string | null; before_json: string | null; after_json: string | null;
  reason: string | null; occurred_at: string; prev_hash: string; hash: string;
}

export const GENESIS_HASH = '0'.repeat(64);

// Device-level actions with no business (sign-in before one is chosen) are kept locally and never pushed.
export const DEVICE_AUDIT_SCOPE = '_device';

export function computeAuditHash(r: Omit<AuditRow, 'id' | 'hash'>): string {
  return createHash('sha256').update(canonicalJson(auditHashInput(r))).digest('hex');
}

/** LLD §16 — append inside the business transaction; gap-free seq and hash chain per (business, device). */
export function appendAudit(db: Db, a: AuditInput): AuditRow {
  const last = stmt(db,
    'SELECT id, seq, hash FROM audit_log WHERE business_id = ? AND device_id = ? ORDER BY seq DESC LIMIT 1',
  ).get(a.businessId, a.deviceId) as { id: string; seq: number; hash: string } | undefined;
  const base: Omit<AuditRow, 'id' | 'hash'> = {
    business_id: a.businessId, seq: (last?.seq ?? 0) + 1, user_id: a.userId, device_id: a.deviceId,
    terminal_id: a.terminalId ?? null, action: a.action, entity_type: a.entityType, entity_id: a.entityId ?? null,
    before_json: a.before === undefined ? null : canonicalJson(a.before),
    after_json: a.after === undefined ? null : canonicalJson(a.after),
    reason: a.reason ?? null, occurred_at: a.occurredAt ?? nowIso(), prev_hash: last?.hash ?? GENESIS_HASH,
  };
  const row: AuditRow = { id: newUlid(), ...base, hash: computeAuditHash(base) };
  stmt(db, `INSERT INTO audit_log (id, business_id, seq, user_id, device_id, terminal_id, action, entity_type, entity_id,
      before_json, after_json, reason, occurred_at, prev_hash, hash)
    VALUES (@id, @business_id, @seq, @user_id, @device_id, @terminal_id, @action, @entity_type, @entity_id,
      @before_json, @after_json, @reason, @occurred_at, @prev_hash, @hash)`).run(row);
  if (row.business_id !== DEVICE_AUDIT_SCOPE) queueAuditEntry(db, row, last?.id ?? null);
  return row;
}

// 8g: the row itself is the push payload, queued behind the chain's previous row so the cloud receives seqs in order.
function queueAuditEntry(db: Db, row: AuditRow, previousId: string | null): void {
  const dependsOn = previousId ? lastOutboxOperationId(db, row.business_id, 'audit_entry', previousId) : null;
  appendOutbox(db, {
    businessId: row.business_id, deviceId: row.device_id, entityType: 'audit_entry', entityId: row.id, operationType: 'create', payload: row,
    dependsOnOperationId: dependsOn,
  });
}

// Rows written before audit rows were pushed (or carried in by a restore) are queued once, in chain order; safe to repeat.
export function queueUnsentAudit(db: Db): number {
  return withTransaction(db, () => {
    const rows = stmt(db, `SELECT a.* FROM audit_log a WHERE a.business_id <> ? AND NOT EXISTS (
        SELECT 1 FROM sync_outbox o WHERE o.business_id = a.business_id AND o.entity_type = 'audit_entry' AND o.entity_id = a.id)
      ORDER BY a.business_id, a.device_id, a.seq`).all(DEVICE_AUDIT_SCOPE) as AuditRow[];
    const previous = stmt(db, 'SELECT id FROM audit_log WHERE business_id = ? AND device_id = ? AND seq = ?').pluck();
    for (const r of rows) queueAuditEntry(db, r, (previous.get(r.business_id, r.device_id, r.seq - 1) as string | undefined) ?? null);
    return rows.length;
  });
}

export type AuditBreak = 'seq_gap' | 'prev_hash' | 'hash';
export interface AuditChainResult { ok: boolean; brokenAtSeq: number | null; reason: AuditBreak | null; count: number }

export function verifyAuditChain(db: Db, businessId: string, deviceId: string): AuditChainResult {
  const rows = db.prepare('SELECT * FROM audit_log WHERE business_id = ? AND device_id = ? ORDER BY seq').iterate(businessId, deviceId) as IterableIterator<AuditRow>;
  let prev = GENESIS_HASH;
  let count = 0;
  let broken: Pick<AuditChainResult, 'brokenAtSeq' | 'reason'> | null = null;
  for (const r of rows) {
    count++;
    if (broken) continue;
    const reason: AuditBreak | null = r.seq !== count ? 'seq_gap' : r.prev_hash !== prev ? 'prev_hash' : computeAuditHash(r) !== r.hash ? 'hash' : null;
    if (reason) broken = { brokenAtSeq: r.seq, reason };
    prev = r.hash;
  }
  return { ok: broken === null, brokenAtSeq: broken?.brokenAtSeq ?? null, reason: broken?.reason ?? null, count };
}

export interface AuditChainReport extends AuditChainResult { businessId: string; deviceId: string }

// Every chain this database holds, one result each (8g `diagnostics.verifyAudit`).
export function verifyAllAuditChains(db: Db): AuditChainReport[] {
  const chains = db.prepare('SELECT DISTINCT business_id, device_id FROM audit_log ORDER BY business_id, device_id').all() as { business_id: string; device_id: string }[];
  return chains.map((c) => ({ businessId: c.business_id, deviceId: c.device_id, ...verifyAuditChain(db, c.business_id, c.device_id) }));
}

export const AUDIT_CHECK_KEY = 'audit_check';

// The last verification is kept in app_meta; a broken chain in it blocks the sync badge until the next clean run.
export function recordAuditCheck(db: Db, reports: readonly AuditChainReport[], at: string): void {
  stmt(db, `INSERT INTO app_meta (key, value, updated_at) VALUES (?, ?, ?)
    ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`)
    .run(AUDIT_CHECK_KEY, JSON.stringify({ checkedAt: at, ok: reports.every((r) => r.ok), chains: reports }), at);
}

export interface AuditRejection { operationId: string; seq: number | null; detail: string | null }

// Audit rows the cloud refused as a broken chain (AUDIT_CHAIN_BROKEN), still failing or given up on.
export function auditRejections(db: Db): AuditRejection[] {
  return (stmt(db, `SELECT operation_id, json_extract(payload_json, '$.seq') AS seq, error_message FROM sync_outbox
    WHERE entity_type = 'audit_entry' AND error_code = 'AUDIT_CHAIN_BROKEN' AND status IN ('failed','dead') ORDER BY seq`).all() as
    { operation_id: string; seq: number | null; error_message: string | null }[]).map((r) => ({ operationId: r.operation_id, seq: r.seq, detail: r.error_message }));
}
