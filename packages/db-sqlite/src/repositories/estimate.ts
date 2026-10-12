import type { DiscountInput, Estimate, EstimateListInput, EstimatePage, EstimateStatus, QuoteLine, SaleDraft, SaleTotals } from '@muneem/contracts';
import { effectiveDiscountBp } from '@muneem/domain';
import type { Db } from '../open.js';
import { stmt } from '../statements.js';
import { nowIso } from '../uow.js';
import type { Actor } from './business.js';
import { customerSnapshot, getCustomer } from './customer.js';

// FR-086 (ADR-0068): an estimate is stored as priced, like a sale, and never posts.
export interface EstimateRecord {
  id: string; businessId: string; branchId: string; terminalId: string; commandId: string; seriesId: string; docNumber: string; docSeq: number;
  docDate: string; fy: string; validUntil: string; customerId: string | null; placeOfSupplyReason: string | null; billDiscount: DiscountInput;
  totals: SaleTotals; lines: readonly QuoteLine[]; notes: string | null; createdAt?: string;
}
export interface EstimateConversion { saleId: string; saleDocNumber: string; convertedAt: string }

export const estimateItemId = (estimateId: string, lineNo: number): string => `${estimateId}-${String(lineNo).padStart(3, '0')}`;

export function insertEstimate(db: Db, r: EstimateRecord, actor: Actor): void {
  const t = r.totals;
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
    docNumber: r.docNumber, docSeq: r.docSeq, docDate: r.docDate, fy: r.fy, validUntil: r.validUntil, customerId: r.customerId, docType: t.docType,
    posState: t.placeOfSupplyState, posReason: r.placeOfSupplyReason, supplyType: t.supplyType, stateTaxKind: t.stateTaxKind, bucket: t.gstr1Bucket,
    billKind: r.billDiscount.kind, billValue: r.billDiscount.value, gross: t.grossPaise, lineDisc: t.lineDiscountPaise, billDisc: t.billDiscountPaise,
    taxable: t.taxablePaise, cgst: t.cgstPaise, sgst: t.sgstPaise, igst: t.igstPaise, cess: t.cessPaise, roundOff: t.roundOffPaise, total: t.totalPaise,
    notes: r.notes, at, createdBy: actor.userId, deviceId: actor.deviceId,
  });
  const item = stmt(db, `INSERT INTO estimate_item (id, estimate_id, business_id, line_no, product_id, product_name, hsn_code, uom_id, uom_code, qty_milli,
      base_qty_milli, unit_price_paise, price_is_inclusive, mrp_paise, line_discount_kind, line_discount_value, gross_paise, line_discount_paise,
      apportioned_bill_discount_paise, taxable_paise, tax_treatment, gst_rate_bp, cgst_paise, sgst_paise, igst_paise, cess_rate_bp, cess_per_unit_paise,
      cess_paise, total_paise)
    VALUES (@id, @estimateId, @businessId, @lineNo, @productId, @name, @hsn, @uomId, @uomCode, @qty, @baseQty, @price, @inclusive, @mrp, @discKind,
      @discValue, @gross, @lineDisc, @billDisc, @taxable, @treatment, @rate, @cgst, @sgst, @igst, @cessRate, @cessPerUnit, @cess, @total)`);
  for (const l of r.lines) {
    item.run({
      id: estimateItemId(r.id, l.lineNo), estimateId: r.id, businessId: r.businessId, lineNo: l.lineNo, productId: l.productId, name: l.name,
      hsn: l.hsnCode ?? null, uomId: l.uomId, uomCode: l.uomCode, qty: l.qtyMilli, baseQty: l.baseQtyMilli, price: l.unitPricePaise,
      inclusive: l.priceIsInclusive ? 1 : 0, mrp: l.mrpPaise ?? null, discKind: l.lineDiscount.kind, discValue: l.lineDiscount.value, gross: l.grossPaise,
      lineDisc: l.lineDiscountPaise, billDisc: l.apportionedBillDiscountPaise, taxable: l.taxablePaise, treatment: l.taxTreatment, rate: l.gstRateBp,
      cgst: l.cgstPaise, sgst: l.sgstPaise, igst: l.igstPaise, cessRate: l.cessRateBp, cessPerUnit: l.cessPerUnitPaise, cess: l.cessPaise, total: l.totalPaise,
    });
  }
}

export function markEstimateConverted(db: Db, id: string, c: EstimateConversion): void {
  stmt(db, `UPDATE estimate SET status = 'converted', sale_id = @saleId, sale_doc_number = @saleDocNumber, converted_at = @convertedAt,
      updated_at = @convertedAt, version = version + 1 WHERE id = @id`).run({ id, ...c });
}

export function estimateIdByCommand(db: Db, businessId: string, commandId: string): string | null {
  return (stmt(db, 'SELECT id FROM estimate WHERE business_id = ? AND command_id = ?').pluck().get(businessId, commandId) as string | undefined) ?? null;
}

type Row = {
  id: string; business_id: string; doc_number: string; doc_date: string; valid_until: string; customer_id: string | null; doc_type: SaleTotals['docType'];
  place_of_supply_state: string; place_of_supply_reason: string | null; supply_type: SaleTotals['supplyType']; state_tax_kind: SaleTotals['stateTaxKind'];
  gstr1_bucket: string; bill_discount_kind: DiscountInput['kind']; bill_discount_value: number; gross_paise: number; line_discount_paise: number;
  bill_discount_paise: number; taxable_paise: number; cgst_paise: number; sgst_paise: number; igst_paise: number; cess_paise: number;
  round_off_paise: number; total_paise: number; notes: string | null; status: 'open' | 'converted'; sale_id: string | null; sale_doc_number: string | null;
  converted_at: string | null; created_at: string; created_by: string;
};
type ItemRow = {
  line_no: number; product_id: string; product_name: string; hsn_code: string | null; uom_id: string; uom_code: string; qty_milli: number;
  base_qty_milli: number; unit_price_paise: number; price_is_inclusive: number; mrp_paise: number | null; line_discount_kind: DiscountInput['kind'];
  line_discount_value: number; gross_paise: number; line_discount_paise: number; apportioned_bill_discount_paise: number; taxable_paise: number;
  tax_treatment: QuoteLine['taxTreatment']; gst_rate_bp: number; cgst_paise: number; sgst_paise: number; igst_paise: number; cess_rate_bp: number;
  cess_per_unit_paise: number; cess_paise: number; total_paise: number;
};

// An open estimate past its date is expired; it can still be converted.
const statusOf = (r: Pick<Row, 'status' | 'valid_until'>, today: string): EstimateStatus =>
  (r.status === 'open' && r.valid_until < today ? 'expired' : r.status);

const toLine = (l: ItemRow): QuoteLine => ({
  lineNo: l.line_no, productId: l.product_id, name: l.product_name, uomId: l.uom_id, uomCode: l.uom_code, qtyMilli: l.qty_milli,
  baseQtyMilli: l.base_qty_milli, unitPricePaise: l.unit_price_paise, priceIsInclusive: l.price_is_inclusive === 1, gstRateBp: l.gst_rate_bp,
  cessRateBp: l.cess_rate_bp, cessPerUnitPaise: l.cess_per_unit_paise, taxTreatment: l.tax_treatment,
  lineDiscount: { kind: l.line_discount_kind, value: l.line_discount_value }, grossPaise: l.gross_paise, lineDiscountPaise: l.line_discount_paise,
  apportionedBillDiscountPaise: l.apportioned_bill_discount_paise, taxablePaise: l.taxable_paise, cgstPaise: l.cgst_paise, sgstPaise: l.sgst_paise,
  igstPaise: l.igst_paise, cessPaise: l.cess_paise, totalPaise: l.total_paise,
  ...(l.hsn_code !== null && { hsnCode: l.hsn_code }), ...(l.mrp_paise !== null && { mrpPaise: l.mrp_paise }),
});

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
  const lines = (stmt(db, 'SELECT * FROM estimate_item WHERE estimate_id = ? ORDER BY line_no').all(id) as ItemRow[]).map(toLine);
  const discount = lines.reduce((s, l) => s + l.lineDiscountPaise + l.apportionedBillDiscountPaise, 0);
  return {
    id: r.id, businessId: r.business_id, docNumber: r.doc_number, docDate: r.doc_date, validUntil: r.valid_until, status: statusOf(r, today),
    customer: customerSnapshot(r.customer_id ? getCustomer(db, r.customer_id) : null),
    totals: {
      docType: r.doc_type, placeOfSupplyState: r.place_of_supply_state, supplyType: r.supply_type, stateTaxKind: r.state_tax_kind, gstr1Bucket: r.gstr1_bucket,
      grossPaise: r.gross_paise, lineDiscountPaise: r.line_discount_paise, billDiscountPaise: r.bill_discount_paise, taxablePaise: r.taxable_paise,
      cgstPaise: r.cgst_paise, sgstPaise: r.sgst_paise, igstPaise: r.igst_paise, cessPaise: r.cess_paise, roundOffPaise: r.round_off_paise,
      totalPaise: r.total_paise, discountBp: effectiveDiscountBp(r.taxable_paise + discount, discount),
    },
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
