import { closingEntryNo, closingLines, closingRefId, fyBounds, fyEndOf, newUlid, type ClosingBalance } from '@muneem/domain';
import type { Db } from '../open.js';
import { stmt } from '../statements.js';
import { nowIso } from '../uow.js';
import { accountTotals } from './accountingStatements.js';
import type { Actor } from './business.js';
import { ensurePeriod, postClosingJournal, type PostedJournal } from './journal.js';

// One posting of a year close: version 1 closes the year, each later version adjusts it (ADR-0045).
export interface Closing { version: number; journal: PostedJournal | null; balances: ClosingBalance[] }
export type FyCloseStatus = 'requested' | 'closed' | 'superseded';
export interface FyCloseRow {
  id: string; businessId: string; fy: string; status: FyCloseStatus; version: number; closings: Closing[]; pending: Closing | null;
  closedAt: string | null; closedBy: string | null; createdAt: string; createdBy: string;
}

type Row = {
  id: string; business_id: string; fy: string; status: FyCloseStatus; version: number; closings_json: string; pending_json: string | null;
  closed_at: string | null; closed_by: string | null; created_at: string; created_by: string;
};
const toClose = (r: Row): FyCloseRow => ({
  id: r.id, businessId: r.business_id, fy: r.fy, status: r.status, version: r.version, closings: JSON.parse(r.closings_json) as Closing[],
  pending: r.pending_json ? JSON.parse(r.pending_json) as Closing : null, closedAt: r.closed_at, closedBy: r.closed_by, createdAt: r.created_at, createdBy: r.created_by,
});

export const fyCloseFor = (db: Db, businessId: string, fy: string): FyCloseRow | null => {
  const r = stmt(db, "SELECT * FROM fy_close WHERE business_id = ? AND fy = ? AND status <> 'superseded'").get(businessId, fy) as Row | undefined;
  return r ? toClose(r) : null;
};

export const isFyClosed = (db: Db, businessId: string, fy: string): boolean => fyCloseFor(db, businessId, fy) !== null;

// Each income and expense account's movement over the year, closings included: what is still to close (from the balance cache).
export function fyBalances(db: Db, businessId: string, fy: string): ClosingBalance[] {
  const { start, end } = fyBounds(fy);
  return accountTotals(db, { businessId, from: start, to: end }).flatMap((a): ClosingBalance[] =>
    (a.type === 'income' || a.type === 'expense') && a.debitPaise !== a.creditPaise ? [{ code: a.code, type: a.type, netPaise: a.debitPaise - a.creditPaise }] : []);
}

// The next closing of a year, unposted: its journal is numbered and dated now so every device stores the same one.
export function nextClosing(db: Db, businessId: string, fy: string, closeId: string, version: number, actor: Actor): Closing {
  const balances = fyBalances(db, businessId, fy);
  const lines = closingLines(balances);
  if (lines.length === 0) return { version, journal: null, balances };
  const end = fyEndOf(fy);
  return {
    version, balances,
    journal: {
      id: newUlid(), entryNo: closingEntryNo(fy, version), entryDate: end, periodId: ensurePeriod(db, businessId, end, actor), lines, source: 'closing',
      refType: 'fy_close', refId: closingRefId(closeId, version), docDate: end, branchId: null, terminalId: null, latePosting: false, reversalOf: null,
      narration: version === 1 ? `Year ${fy} closed to retained earnings` : `Year ${fy}: postings after the close, to retained earnings`,
    },
  };
}

export function postClosing(db: Db, businessId: string, c: Closing, actor: Actor): void {
  if (c.journal) postClosingJournal(db, { ...c.journal, businessId }, actor);
}

export interface FyCloseWrite { id: string; businessId: string; fy: string; status: FyCloseStatus; version: number; closings: Closing[]; pending: Closing | null; closedAt: string | null; closedBy: string | null }

export function insertFyClose(db: Db, w: FyCloseWrite, actor: Actor, createdAt?: string): void {
  const t = nowIso();
  stmt(db, `INSERT INTO fy_close (id, business_id, fy, status, version, closings_json, pending_json, closed_at, closed_by, created_at, updated_at, created_by, device_id)
    VALUES (@id, @businessId, @fy, @status, @version, @closings, @pending, @closedAt, @closedBy, @createdAt, @t, @by, @device)`).run({
    ...w, closings: JSON.stringify(w.closings), pending: w.pending ? JSON.stringify(w.pending) : null, createdAt: createdAt ?? t, t, by: actor.userId, device: actor.deviceId,
  });
}

export function updateFyClose(db: Db, id: string, w: Pick<FyCloseWrite, 'status' | 'version' | 'closings' | 'pending' | 'closedAt' | 'closedBy'>): void {
  stmt(db, `UPDATE fy_close SET status = @status, version = @version, closings_json = @closings, pending_json = @pending, closed_at = @closedAt, closed_by = @closedBy,
      updated_at = @t WHERE id = @id`).run({ ...w, id, closings: JSON.stringify(w.closings), pending: w.pending ? JSON.stringify(w.pending) : null, t: nowIso() });
}

export const supersedeFyClose = (db: Db, id: string): void => {
  stmt(db, "UPDATE fy_close SET status = 'superseded', pending_json = NULL, updated_at = ? WHERE id = ?").run(nowIso(), id);
};

// What the cloud is sent: the whole close, every closing so far plus the one asked for (ADR-0045 as built).
export function fyClosePayload(c: FyCloseRow): Record<string, unknown> {
  const closings = c.pending ? [...c.closings, c.pending] : c.closings;
  return {
    id: c.id, businessId: c.businessId, fy: c.fy, fyEnd: fyEndOf(c.fy), version: c.pending?.version ?? c.version, closings,
    createdAt: c.createdAt, createdBy: c.createdBy, closedBy: c.closedBy ?? c.createdBy,
  };
}

// Unsent operations for a close the cloud has decided otherwise about never go out.
export const dropUnsentFyClose = (db: Db, businessId: string, id: string, operationType?: 'update'): number =>
  stmt(db, `UPDATE sync_outbox SET status = 'superseded' WHERE business_id = ? AND entity_type = 'fy_close' AND entity_id = ?
    AND status IN ('pending','failed','dead') AND (? IS NULL OR operation_type = ?)`).run(businessId, id, operationType ?? null, operationType ?? null).changes;

export const unsentFyCloseError = (db: Db, businessId: string, id: string): string | null =>
  (stmt(db, `SELECT error_message FROM sync_outbox WHERE business_id = ? AND entity_type = 'fy_close' AND entity_id = ? AND status IN ('failed','dead')
    ORDER BY seq DESC LIMIT 1`).pluck().get(businessId, id) as string | null | undefined) ?? null;
