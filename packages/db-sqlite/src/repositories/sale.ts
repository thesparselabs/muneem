import type { CustomerSnapshot, QuoteLine, Sale, SalePage, SaleTotals } from '@muneem/contracts';
import { effectiveDiscountBp, type SettledTender } from '@muneem/domain';
import type { Db } from '../open.js';
import { stmt } from '../statements.js';
import { nowIso } from '../uow.js';
import type { Actor } from './business.js';
import { createDocSeries } from './docSeries.js';

export interface SeriesKey { businessId: string; branchId: string; terminalId: string; docType: string; fy: string }

export function findOrCreateSeries(db: Db, key: SeriesKey, prefix: string, actor: Actor): string {
  const id = stmt(db, 'SELECT id FROM doc_series WHERE business_id = ? AND doc_type = ? AND fy = ? AND branch_id = ? AND terminal_id = ?')
    .pluck().get(key.businessId, key.docType, key.fy, key.branchId, key.terminalId) as string | undefined;
  if (id) return id;
  return createDocSeries(db, key.businessId, { branchId: key.branchId, terminalId: key.terminalId, docType: key.docType, fy: key.fy, prefix, padWidth: 6 }, actor).id;
}

export function saleIdByCommand(db: Db, businessId: string, commandId: string): string | null {
  return (stmt(db, 'SELECT id FROM sale WHERE business_id = ? AND command_id = ?').pluck().get(businessId, commandId) as string | undefined) ?? null;
}

export interface SaleTender extends SettledTender { reference?: string | undefined }

export interface SaleRecord {
  id: string; businessId: string; branchId: string; terminalId: string; sessionId: string; commandId: string;
  seriesId: string; docNumber: string; docSeq: number; docDate: string; fy: string; taxScheme: string;
  customerId: string | null; customer: CustomerSnapshot; placeOfSupplyReason: string | null; priceListId: string | null;
  totals: SaleTotals; paidPaise: number; changePaise: number; lines: readonly QuoteLine[]; tenders: readonly SaleTender[];
  lineCosts: readonly { unitCostPaise: number; cogsPaise: number }[];
}

export const saleItemId = (saleId: string, lineNo: number): string => `${saleId}-${String(lineNo).padStart(3, '0')}`;

export function insertSale(db: Db, r: SaleRecord, actor: Actor): void {
  const t = r.totals;
  const now = nowIso();
  stmt(db, `INSERT INTO sale (id, business_id, branch_id, terminal_id, session_id, command_id, doc_type, series_id, doc_number, doc_seq,
      doc_date, fy, customer_id, customer_snapshot_json, place_of_supply_state, place_of_supply_reason, supply_type, state_tax_kind,
      gstr1_bucket, tax_scheme, price_list_id, gross_paise, line_discount_paise, bill_discount_paise, taxable_paise, cgst_paise, sgst_paise,
      igst_paise, cess_paise, round_off_paise, total_paise, paid_paise, change_paise, cogs_paise, created_at, updated_at, created_by, device_id)
    VALUES (@id, @businessId, @branchId, @terminalId, @sessionId, @commandId, @docType, @seriesId, @docNumber, @docSeq,
      @docDate, @fy, @customerId, @customerJson, @posState, @posReason, @supplyType, @stateTaxKind,
      @bucket, @taxScheme, @priceListId, @gross, @lineDisc, @billDisc, @taxable, @cgst, @sgst,
      @igst, @cess, @roundOff, @total, @paid, @change, @cogs, @now, @now, @createdBy, @deviceId)`).run({
    id: r.id, businessId: r.businessId, branchId: r.branchId, terminalId: r.terminalId, sessionId: r.sessionId, commandId: r.commandId,
    docType: t.docType, seriesId: r.seriesId, docNumber: r.docNumber, docSeq: r.docSeq, docDate: r.docDate, fy: r.fy,
    customerId: r.customerId, customerJson: JSON.stringify(r.customer), posState: t.placeOfSupplyState, posReason: r.placeOfSupplyReason,
    supplyType: t.supplyType, stateTaxKind: t.stateTaxKind, bucket: t.gstr1Bucket, taxScheme: r.taxScheme, priceListId: r.priceListId,
    gross: t.grossPaise, lineDisc: t.lineDiscountPaise, billDisc: t.billDiscountPaise, taxable: t.taxablePaise, cgst: t.cgstPaise,
    sgst: t.sgstPaise, igst: t.igstPaise, cess: t.cessPaise, roundOff: t.roundOffPaise, total: t.totalPaise, paid: r.paidPaise,
    change: r.changePaise, cogs: r.lineCosts.reduce((s, c) => s + c.cogsPaise, 0), now, createdBy: actor.userId, deviceId: actor.deviceId,
  });
  const item = stmt(db, `INSERT INTO sale_item (id, sale_id, business_id, line_no, product_id, product_name, hsn_code, uom_id, uom_code, qty_milli,
      base_qty_milli, unit_price_paise, price_is_inclusive, mrp_paise, gross_paise, line_discount_paise, apportioned_bill_discount_paise,
      taxable_paise, tax_treatment, gst_rate_bp, cgst_paise, sgst_paise, igst_paise, cess_rate_bp, cess_per_unit_paise, cess_paise, total_paise,
      unit_cost_paise, cogs_paise)
    VALUES (@id, @saleId, @businessId, @lineNo, @productId, @name, @hsn, @uomId, @uomCode, @qty, @baseQty, @price, @inclusive, @mrp, @gross,
      @lineDisc, @billDisc, @taxable, @treatment, @rate, @cgst, @sgst, @igst, @cessRate, @cessPerUnit, @cess, @total, @unitCost, @cogs)`);
  r.lines.forEach((l, i) => item.run({
    id: saleItemId(r.id, l.lineNo), unitCost: r.lineCosts[i]?.unitCostPaise ?? 0, cogs: r.lineCosts[i]?.cogsPaise ?? 0, saleId: r.id, businessId: r.businessId, lineNo: l.lineNo, productId: l.productId,
    name: l.name, hsn: l.hsnCode ?? null, uomId: l.uomId, uomCode: l.uomCode, qty: l.qtyMilli, baseQty: l.baseQtyMilli, price: l.unitPricePaise,
    inclusive: l.priceIsInclusive ? 1 : 0, mrp: l.mrpPaise ?? null, gross: l.grossPaise, lineDisc: l.lineDiscountPaise,
    billDisc: l.apportionedBillDiscountPaise, taxable: l.taxablePaise, treatment: l.taxTreatment, rate: l.gstRateBp, cgst: l.cgstPaise,
    sgst: l.sgstPaise, igst: l.igstPaise, cessRate: l.cessRateBp, cessPerUnit: l.cessPerUnitPaise, cess: l.cessPaise, total: l.totalPaise,
  }));
  const tender = stmt(db, `INSERT INTO sale_tender (id, sale_id, business_id, line_no, method, amount_paise, change_paise, reference)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
  r.tenders.forEach((tn, i) => tender.run(`${r.id}-T${i + 1}`, r.id, r.businessId, i + 1, tn.method, tn.amountPaise, tn.changePaise, tn.reference ?? null));
}

type SaleRow = {
  id: string; business_id: string; terminal_id: string; session_id: string; doc_type: SaleTotals['docType']; doc_number: string; doc_date: string;
  status: Sale['status']; customer_id: string | null; customer_snapshot_json: string; place_of_supply_state: string; place_of_supply_reason: string | null;
  supply_type: SaleTotals['supplyType']; state_tax_kind: SaleTotals['stateTaxKind']; gstr1_bucket: string; gross_paise: number;
  line_discount_paise: number; bill_discount_paise: number; taxable_paise: number; cgst_paise: number; sgst_paise: number; igst_paise: number;
  cess_paise: number; round_off_paise: number; total_paise: number; paid_paise: number; change_paise: number; created_at: string; created_by: string;
};
type ItemRow = {
  line_no: number; product_id: string; product_name: string; hsn_code: string | null; uom_id: string; uom_code: string; qty_milli: number;
  base_qty_milli: number; unit_price_paise: number; price_is_inclusive: number; mrp_paise: number | null; gross_paise: number;
  line_discount_paise: number; apportioned_bill_discount_paise: number; taxable_paise: number; tax_treatment: QuoteLine['taxTreatment'];
  gst_rate_bp: number; cgst_paise: number; sgst_paise: number; igst_paise: number; cess_rate_bp: number; cess_per_unit_paise: number;
  cess_paise: number; total_paise: number;
};
type TenderRow = { method: Sale['tenders'][number]['method']; amount_paise: number; change_paise: number; reference: string | null };

const totalsOf = (r: SaleRow, discountBp: number): SaleTotals => ({
  docType: r.doc_type, placeOfSupplyState: r.place_of_supply_state, supplyType: r.supply_type, stateTaxKind: r.state_tax_kind,
  gstr1Bucket: r.gstr1_bucket, grossPaise: r.gross_paise, lineDiscountPaise: r.line_discount_paise, billDiscountPaise: r.bill_discount_paise,
  taxablePaise: r.taxable_paise, cgstPaise: r.cgst_paise, sgstPaise: r.sgst_paise, igstPaise: r.igst_paise, cessPaise: r.cess_paise,
  roundOffPaise: r.round_off_paise, totalPaise: r.total_paise, discountBp,
});

// Each line's taxable plus its discounts is its pre-discount value, so the effective discount is recoverable.
function discountBpOf(lines: readonly QuoteLine[]): number {
  const discount = lines.reduce((s, l) => s + l.lineDiscountPaise + l.apportionedBillDiscountPaise, 0);
  return effectiveDiscountBp(lines.reduce((s, l) => s + l.taxablePaise, 0) + discount, discount);
}

// Discounts are stored as amounts, so a reloaded line reports its line discount as an amount.
const toLine = (l: ItemRow): QuoteLine => ({
  lineNo: l.line_no, productId: l.product_id, name: l.product_name, uomId: l.uom_id, uomCode: l.uom_code, qtyMilli: l.qty_milli,
  baseQtyMilli: l.base_qty_milli, unitPricePaise: l.unit_price_paise, priceIsInclusive: l.price_is_inclusive === 1,
  gstRateBp: l.gst_rate_bp, cessRateBp: l.cess_rate_bp, cessPerUnitPaise: l.cess_per_unit_paise, taxTreatment: l.tax_treatment,
  lineDiscount: { kind: 'amount', value: l.line_discount_paise }, grossPaise: l.gross_paise, lineDiscountPaise: l.line_discount_paise,
  apportionedBillDiscountPaise: l.apportioned_bill_discount_paise, taxablePaise: l.taxable_paise, cgstPaise: l.cgst_paise,
  sgstPaise: l.sgst_paise, igstPaise: l.igst_paise, cessPaise: l.cess_paise, totalPaise: l.total_paise,
  ...(l.hsn_code !== null && { hsnCode: l.hsn_code }),
  ...(l.mrp_paise !== null && { mrpPaise: l.mrp_paise }),
});

export function getSale(db: Db, id: string): (Sale & { businessId: string }) | null {
  const r = stmt(db, 'SELECT * FROM sale WHERE id = ?').get(id) as SaleRow | undefined;
  if (!r) return null;
  const lines = (stmt(db, 'SELECT * FROM sale_item WHERE sale_id = ? ORDER BY line_no').all(id) as ItemRow[]).map(toLine);
  const tenders = (stmt(db, 'SELECT * FROM sale_tender WHERE sale_id = ? ORDER BY line_no').all(id) as TenderRow[]).map((t) => ({
    method: t.method, amountPaise: t.amount_paise, changePaise: t.change_paise, ...(t.reference !== null && { reference: t.reference }),
  }));
  return {
    id: r.id, businessId: r.business_id, docNumber: r.doc_number, docDate: r.doc_date, docType: r.doc_type, status: r.status,
    sessionId: r.session_id, terminalId: r.terminal_id, customer: JSON.parse(r.customer_snapshot_json) as CustomerSnapshot,
    totals: totalsOf(r, discountBpOf(lines)), paidPaise: r.paid_paise, changePaise: r.change_paise, lines, tenders, createdAt: r.created_at, createdBy: r.created_by,
    ...(r.customer_id !== null && { customerId: r.customer_id }),
    ...(r.place_of_supply_reason !== null && { placeOfSupplyReason: r.place_of_supply_reason }),
  };
}

type ListCursor = { t: string; id: string };
const encodeCursor = (c: ListCursor): string => Buffer.from(JSON.stringify(c)).toString('base64url');
function decodeCursor(s: string | undefined): ListCursor | null {
  if (!s) return null;
  try {
    const c = JSON.parse(Buffer.from(s, 'base64url').toString('utf8')) as ListCursor;
    return typeof c.t === 'string' && typeof c.id === 'string' ? c : null;
  } catch {
    return null;
  }
}

// Newest first, keyed on (created_at, id) so sales sharing a timestamp are never skipped at a page boundary.
export function listSales(db: Db, businessId: string, f: { sessionId?: string | undefined; limit: number; cursor?: string | undefined }): SalePage {
  const after = decodeCursor(f.cursor);
  const rows = stmt(db, `SELECT id, doc_number, doc_date, customer_snapshot_json, total_paise, status, created_at FROM sale
    WHERE business_id = @businessId AND (@sessionId IS NULL OR session_id = @sessionId)
      AND (@t IS NULL OR (created_at, id) < (@t, @id))
    ORDER BY created_at DESC, id DESC LIMIT @limit`).all({
    businessId, sessionId: f.sessionId ?? null, t: after?.t ?? null, id: after?.id ?? null, limit: f.limit + 1,
  }) as { id: string; doc_number: string; doc_date: string; customer_snapshot_json: string; total_paise: number; status: Sale['status']; created_at: string }[];
  const page = rows.slice(0, f.limit);
  const last = page.at(-1);
  return {
    items: page.map((r) => {
      const c = JSON.parse(r.customer_snapshot_json) as CustomerSnapshot;
      return {
        id: r.id, docNumber: r.doc_number, docDate: r.doc_date, totalPaise: r.total_paise, status: r.status, createdAt: r.created_at,
        ...(c.name && { customerName: c.name }),
      };
    }),
    nextCursor: rows.length > f.limit && last ? encodeCursor({ t: last.created_at, id: last.id }) : null,
  };
}
