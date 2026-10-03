import type { Payment, PaymentListInput, PaymentPage } from '@muneem/contracts';
import type { PartyType } from '@muneem/domain';
import type { Db } from '../open.js';
import { stmt } from '../statements.js';
import { nowIso } from '../uow.js';
import { allocationsOfSource } from './allocation.js';
import type { Actor } from './business.js';
import { documentCashMovements } from './register.js';

export interface PaymentRecord {
  id: string; businessId: string; branchId: string; terminalId: string; sessionId: string | null; commandId: string;
  partyType: PartyType; partyId: string; seriesId: string; docNumber: string; docSeq: number; paymentDate: string; fy: string;
  method: Payment['method']; amountPaise: number; reference: string | null; note: string | null;
}

export function insertPayment(db: Db, r: PaymentRecord, actor: Actor): void {
  const t = nowIso();
  stmt(db, `INSERT INTO payment (id, business_id, branch_id, terminal_id, session_id, direction, party_type, party_id, series_id, doc_number, doc_seq,
      payment_date, fy, method, amount_paise, reference, note, command_id, created_at, updated_at, created_by, device_id)
    VALUES (@id, @businessId, @branchId, @terminalId, @sessionId, @direction, @partyType, @partyId, @seriesId, @docNumber, @docSeq, @paymentDate, @fy,
      @method, @amountPaise, @reference, @note, @commandId, @t, @t, @by, @device)`)
    .run({ ...r, direction: r.partyType === 'customer' ? 'in' : 'out', t, by: actor.userId, device: actor.deviceId });
}

export const paymentIdByCommand = (db: Db, businessId: string, commandId: string): string | null =>
  (stmt(db, 'SELECT id FROM payment WHERE business_id = ? AND command_id = ?').pluck().get(businessId, commandId) as string | undefined) ?? null;

export function markPaymentCancelled(db: Db, id: string, reason: string, actor: Actor): void {
  const t = nowIso();
  stmt(db, `UPDATE payment SET status = 'cancelled', cancelled_at = ?, cancelled_by = ?, cancel_reason = ?, updated_at = ?, version = version + 1,
      sync_state = 'pending' WHERE id = ? AND status = 'posted'`).run(t, actor.userId, reason, t, id);
}

type PaymentRow = {
  id: string; business_id: string; doc_number: string; payment_date: string; status: Payment['status']; direction: Payment['direction'];
  party_type: PartyType; party_id: string; party_name: string; method: Payment['method']; amount_paise: number; allocated_paise: number;
  reference: string | null; note: string | null; created_at: string; created_by: string; cancel_reason: string | null; session_id: string | null;
};
const SELECT = `SELECT p.*, COALESCE(c.name, s.name) AS party_name FROM payment p
  LEFT JOIN customer c ON p.party_type = 'customer' AND c.id = p.party_id LEFT JOIN supplier s ON p.party_type = 'supplier' AND s.id = p.party_id`;
const summary = (r: PaymentRow) => ({
  id: r.id, docNumber: r.doc_number, paymentDate: r.payment_date, status: r.status, direction: r.direction, partyType: r.party_type,
  partyId: r.party_id, partyName: r.party_name, method: r.method, amountPaise: r.amount_paise, allocatedPaise: r.allocated_paise, createdAt: r.created_at,
});

export function getPayment(db: Db, id: string): (Payment & { businessId: string; sessionId: string | null }) | null {
  const r = stmt(db, `${SELECT} WHERE p.id = ?`).get(id) as PaymentRow | undefined;
  if (!r) return null;
  const drawer = documentCashMovements(db, 'payment', id)[0];
  return {
    ...summary(r), businessId: r.business_id, sessionId: r.session_id, createdBy: r.created_by,
    allocations: allocationsOfSource(db, 'payment', id),
    ...(r.reference !== null && { reference: r.reference }), ...(r.note !== null && { note: r.note }),
    ...(r.cancel_reason !== null && { cancelReason: r.cancel_reason }), ...(drawer && { drawerSessionId: drawer.sessionId }),
  };
}

type Cursor = { d: string; id: string };
const encode = (c: Cursor): string => Buffer.from(JSON.stringify(c)).toString('base64url');
function decode(s: string | undefined): Cursor | null {
  if (!s) return null;
  try { return JSON.parse(Buffer.from(s, 'base64url').toString('utf8')) as Cursor; } catch { return null; }
}

export function listPayments(db: Db, businessId: string, f: PaymentListInput): PaymentPage {
  const after = decode(f.cursor);
  const rows = stmt(db, `${SELECT}
    WHERE p.business_id = @businessId AND (@partyType IS NULL OR p.party_type = @partyType) AND (@partyId IS NULL OR p.party_id = @partyId)
      AND (@status IS NULL OR p.status = @status) AND (@from IS NULL OR p.payment_date >= @from) AND (@to IS NULL OR p.payment_date <= @to)
      AND (@afterDate IS NULL OR (p.payment_date, p.id) < (@afterDate, @afterId))
    ORDER BY p.payment_date DESC, p.id DESC LIMIT @limit`).all({
    businessId, partyType: f.partyType ?? null, partyId: f.partyId ?? null, status: f.status ?? null, from: f.from ?? null, to: f.to ?? null,
    afterDate: after?.d ?? null, afterId: after?.id ?? null, limit: f.limit + 1,
  }) as PaymentRow[];
  const page = rows.slice(0, f.limit);
  const last = page.at(-1);
  return { items: page.map(summary), nextCursor: rows.length > f.limit && last ? encode({ d: last.payment_date, id: last.id }) : null };
}
