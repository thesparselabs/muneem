import { newUlid } from '@muneem/domain';
import { appendAudit } from '../audit.js';
import type { Db } from '../open.js';
import { appendOutbox } from '../outbox.js';
import { nowIso, withTransaction } from '../uow.js';
import type { Actor } from './business.js';

export interface DocSeriesRow { id: string; businessId: string; branchId: string | null; terminalId: string | null; docType: string; fy: string; prefix: string; padWidth: number; nextSeq: number }
type Raw = { id: string; business_id: string; branch_id: string | null; terminal_id: string | null; doc_type: string; fy: string; prefix: string; pad_width: number; next_seq: number };
const map = (r: Raw): DocSeriesRow => ({ id: r.id, businessId: r.business_id, branchId: r.branch_id, terminalId: r.terminal_id, docType: r.doc_type, fy: r.fy, prefix: r.prefix, padWidth: r.pad_width, nextSeq: r.next_seq });

export function listDocSeries(db: Db, businessId: string): DocSeriesRow[] {
  return (db.prepare('SELECT * FROM doc_series WHERE business_id = ? ORDER BY doc_type, fy, branch_id, terminal_id').all(businessId) as Raw[]).map(map);
}
export function createDocSeries(db: Db, businessId: string, s: Omit<DocSeriesRow, 'id' | 'businessId' | 'nextSeq'>, actor: Actor): DocSeriesRow {
  return withTransaction(db, () => {
    const id = newUlid();
    const t = nowIso();
    db.prepare(`INSERT INTO doc_series (id, business_id, branch_id, terminal_id, doc_type, fy, prefix, pad_width, next_seq, created_at, updated_at, created_by, device_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)`).run(id, businessId, s.branchId, s.terminalId, s.docType, s.fy, s.prefix, s.padWidth, t, t, actor.userId, actor.deviceId);
    const row = map(db.prepare('SELECT * FROM doc_series WHERE id = ?').get(id) as Raw);
    appendAudit(db, { businessId, deviceId: actor.deviceId, userId: actor.userId, terminalId: actor.terminalId, action: 'series.create', entityType: 'doc_series', entityId: id, after: row });
    appendOutbox(db, { businessId, deviceId: actor.deviceId, entityType: 'doc_series', entityId: id, operationType: 'create', payload: row });
    return row;
  });
}

/**
 * LLD §6 — allocate inside the document's transaction; optimistic guard on next_seq so a duplicate is impossible.
 * Used from Stage 3; present now so the series design is exercised by tests from day one.
 */
export function allocateDocNumber(db: Db, seriesId: string): { seq: number; number: string } {
  if (!db.inTransaction) throw new Error('allocateDocNumber must run inside the document transaction');
  const s = db.prepare('SELECT * FROM doc_series WHERE id = ?').get(seriesId) as Raw | undefined;
  if (!s) throw new Error('NOT_FOUND');
  const r = db.prepare('UPDATE doc_series SET next_seq = next_seq + 1, updated_at = ? WHERE id = ? AND next_seq = ?').run(nowIso(), seriesId, s.next_seq);
  if (r.changes !== 1) throw new Error('SERIES_CONTENTION');
  return { seq: s.next_seq, number: `${s.prefix}/${s.fy}/${String(s.next_seq).padStart(s.pad_width, '0')}` };
}
