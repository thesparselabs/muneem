import type { DiscountInput, Estimate, EstimateListInput, EstimatePage, EstimateStatus, QuoteLine, SaleDraft, SaleTotals } from '@muneem/contracts';
import type { Db } from '../open.js';
import { stmt } from '../statements.js';
import { nowIso } from '../uow.js';
import type { Actor } from './business.js';
import { customerSnapshot, getCustomer } from './customer.js';
import { insertPricedLines, pricedLines, totalsOf, totalsParams, type TotalsRow } from './pricedLines.js';

// FR-086 (ADR-0068): an estimate is stored as priced, like a sale, and never posts.
export interface EstimateRecord {
  id: string; businessId: string; branchId: string; terminalId: string; commandId: string; seriesId: string; docNumber: string; docSeq: number;
  docDate: string; fy: string; validUntil: string; customerId: string | null; placeOfSupplyReason: string | null; billDiscount: DiscountInput;
  totals: SaleTotals; lines: readonly QuoteLine[]; notes: string | null; createdAt?: string;
}
export interface EstimateConversion { saleId: string; saleDocNumber: string; convertedAt: string }

export function insertEstimate(db: Db, r: EstimateRecord, actor: Actor): void {
  const at = r.createdAt ?? nowIso();
  stmt(db, `INSERT INTO estimate (id, business_id, branch_id, terminal_id, command_id, series_id, doc_number, doc_seq, doc_date, fy, valid_until,
      customer_id, doc_type, place_of_supply_state, place_of_supply_reason, supply_type, state_tax_kind, gstr1_bucket, bill_discount_kind,
      bill_discount_value, gross_paise, line_discount_paise, bill_discount_paise, taxable_paise, cgst_paise, sgst_paise, igst_paise, cess_paise,
      round_off_paise, total_paise, notes, created_at, updated_at, created_by, device_id)
    VALUES (@id, @businessId, @branchId, @terminalId, @commandId, @seriesId, @docNumber, @docSeq, @docDate, @fy, @validUntil,
      @customerId, @docType, @posState, @posReason, @supplyType, @stateTaxKind, @bucket, @billKind,
      @billValue, @gross, @lineDisc, @billDisc, @taxable, @cgst, @sgst, @igst, @cess,
      @roundOff, @total, @notes, @at, @at, @createdBy, @deviceId)`).run({
    id: r.id, businessId: r.businessId, branchId: r.branchId, terminalId: r.terminalId, commandId: r.commandId, seriesId: r.seriesId,
    docNumber: r.docNumber, docSeq: r.docSeq, docDate: r.docDate, fy: r.fy, validUntil: r.validUntil, customerId: r.customerId,
    posReason: r.placeOfSupplyReason, billKind: r.billDiscount.kind, billValue: r.billDiscount.value, ...totalsParams(r.totals),
    notes: r.notes, at, createdBy: actor.userId, deviceId: actor.deviceId,
  });
  insertPricedLines(db, 'estimate_item', r.id, r.businessId, r.lines);
}

export function markEstimateConverted(db: Db, id: string, c: EstimateConversion): void {
  stmt(db, `UPDATE estimate SET status = 'converted', sale_id = @saleId, sale_doc_number = @saleDocNumber, converted_at = @convertedAt,
      updated_at = @convertedAt, version = version + 1 WHERE id = @id`).run({ id, ...c });
}

export function estimateIdByCommand(db: Db, businessId: string, commandId: string): string | null {
  return (stmt(db, 'SELECT id FROM estimate WHERE business_id = ? AND command_id = ?').pluck().get(businessId, commandId) as string | undefined) ?? null;
}

type Row = TotalsRow & {
  id: string; business_id: string; doc_number: string; doc_date: string; valid_until: string; customer_id: string | null;
  place_of_supply_reason: string | null; bill_discount_kind: DiscountInput['kind']; bill_discount_value: number; notes: string | null;
  status: 'open' | 'converted'; sale_id: string | null; sale_doc_number: string | null; converted_at: string | null; created_at: string; created_by: string;
};
// An open estimate past its date is expired; it can still be converted.
const statusOf = (r: Pick<Row, 'status' | 'valid_until'>, today: string): EstimateStatus =>
  (r.status === 'open' && r.valid_until < today ? 'expired' : r.status);

function draftOf(r: Row, lines: readonly QuoteLine[]): SaleDraft {
  return {
    lines: lines.map((l) => ({ productId: l.productId, uomId: l.uomId, qtyMilli: l.qtyMilli, lineDiscount: l.lineDiscount })),
    billDiscount: { kind: r.bill_discount_kind, value: r.bill_discount_value },
    ...(r.customer_id && { customerId: r.customer_id }),
    ...(r.place_of_supply_reason && { placeOfSupplyOverride: { stateCode: r.place_of_supply_state, reason: r.place_of_supply_reason } }),
  };
}

export function getEstimate(db: Db, id: string, today: string): (Estimate & { businessId: string }) | null {
  const r = stmt(db, 'SELECT * FROM estimate WHERE id = ?').get(id) as Row | undefined;
  if (!r) return null;
  const lines = pricedLines(db, 'estimate_item', id);
  return {
    id: r.id, businessId: r.business_id, docNumber: r.doc_number, docDate: r.doc_date, validUntil: r.valid_until, status: statusOf(r, today),
    customer: customerSnapshot(r.customer_id ? getCustomer(db, r.customer_id) : null),
    totals: totalsOf(r, lines),
    lines, draft: draftOf(r, lines), createdAt: r.created_at, createdBy: r.created_by,
    ...(r.customer_id && { customerId: r.customer_id }), ...(r.notes && { notes: r.notes }),
    ...(r.sale_id && { saleId: r.sale_id }), ...(r.sale_doc_number && { saleDocNumber: r.sale_doc_number }), ...(r.converted_at && { convertedAt: r.converted_at }),
  };
}

type ListCursor = { d: string; id: string };
const encodeCursor = (c: ListCursor): string => Buffer.from(JSON.stringify(c)).toString('base64url');
function decodeCursor(s: string | undefined): ListCursor | null {
  if (!s) return null;
  try {
    const c = JSON.parse(Buffer.from(s, 'base64url').toString('utf8')) as ListCursor;
    return typeof c.d === 'string' && typeof c.id === 'string' ? c : null;
  } catch {
    return null;
  }
}

// Newest first; "open" and "expired" split the open estimates on their date.
export function listEstimates(db: Db, businessId: string, f: EstimateListInput, today: string): EstimatePage {
  const after = decodeCursor(f.cursor);
  const rows = stmt(db, `SELECT e.id, e.doc_number, e.doc_date, e.valid_until, e.total_paise, e.status, e.sale_doc_number, c.name AS customer_name
    FROM estimate e LEFT JOIN customer c ON c.id = e.customer_id
    WHERE e.business_id = @businessId
      AND (@status IS NULL OR (@status = 'converted' AND e.status = 'converted') OR (@status = 'open' AND e.status = 'open' AND e.valid_until >= @today)
        OR (@status = 'expired' AND e.status = 'open' AND e.valid_until < @today))
      AND (@d IS NULL OR (e.doc_date, e.id) < (@d, @id))
    ORDER BY e.doc_date DESC, e.id DESC LIMIT @limit`).all({
    businessId, status: f.status ?? null, today, d: after?.d ?? null, id: after?.id ?? null, limit: f.limit + 1,
  }) as (Pick<Row, 'id' | 'doc_number' | 'doc_date' | 'valid_until' | 'total_paise' | 'status' | 'sale_doc_number'> & { customer_name: string | null })[];
  const page = rows.slice(0, f.limit);
  const last = page.at(-1);
  return {
    items: page.map((r) => ({
      id: r.id, docNumber: r.doc_number, docDate: r.doc_date, validUntil: r.valid_until, totalPaise: r.total_paise, status: statusOf(r, today),
      ...(r.customer_name && { customerName: r.customer_name }), ...(r.sale_doc_number && { saleDocNumber: r.sale_doc_number }),
    })),
    nextCursor: rows.length > f.limit && last ? encodeCursor({ d: last.doc_date, id: last.id }) : null,
  };
}
