import { createHash } from 'node:crypto';
import { newUlid } from '@muneem/domain';
import { canonicalJson } from './canonical.js';
import type { Db } from './open.js';
import { nowIso } from './uow.js';
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

export function computeAuditHash(r: Omit<AuditRow, 'id' | 'hash'>): string {
  return createHash('sha256').update(canonicalJson({
    seq: r.seq, business_id: r.business_id, device_id: r.device_id, user_id: r.user_id, action: r.action,
    entity_type: r.entity_type, entity_id: r.entity_id, before: r.before_json === null ? null : JSON.parse(r.before_json),
    after: r.after_json === null ? null : JSON.parse(r.after_json), occurred_at: r.occurred_at, prev_hash: r.prev_hash,
  })).digest('hex');
}

/** LLD §16 — append inside the business transaction; gap-free seq and hash chain per (business, device). */
export function appendAudit(db: Db, a: AuditInput): AuditRow {
  const last = stmt(db,
    'SELECT seq, hash FROM audit_log WHERE business_id = ? AND device_id = ? ORDER BY seq DESC LIMIT 1',
  ).get(a.businessId, a.deviceId) as { seq: number; hash: string } | undefined;
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
  return row;
}

export function verifyAuditChain(db: Db, businessId: string, deviceId: string): { ok: boolean; brokenAtSeq: number | null; count: number } {
  const rows = db.prepare('SELECT * FROM audit_log WHERE business_id = ? AND device_id = ? ORDER BY seq').all(businessId, deviceId) as AuditRow[];
  let prev = GENESIS_HASH;
  let expectedSeq = 1;
  for (const r of rows) {
    if (r.seq !== expectedSeq || r.prev_hash !== prev || computeAuditHash(r) !== r.hash) {
      return { ok: false, brokenAtSeq: r.seq, count: rows.length };
    }
    prev = r.hash;
    expectedSeq++;
  }
  return { ok: true, brokenAtSeq: null, count: rows.length };
}
