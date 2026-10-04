import type { Purchase, PurchaseChargeInput, PurchaseListInput, PurchasePage, PurchaseQuoteLine, PurchaseTotals, SupplierSnapshot } from '@muneem/contracts';
import type { Db } from '../open.js';
import { stmt } from '../statements.js';
import { nowIso } from '../uow.js';
import type { Actor } from './business.js';

export interface PurchaseRecord {
  id: string; businessId: string; branchId: string; warehouseId: string; commandId: string;
  supplierId: string; supplier: SupplierSnapshot; supplierInvoiceNo: string; supplierInvoiceDate: string;
  seriesId: string; docNumber: string; docSeq: number; docDate: string; fy: string; placeOfSupplyState: string; isReverseCharge: boolean;
  dueDate: string; note: string | null; totals: PurchaseTotals; lines: readonly (PurchaseQuoteLine & { id: string })[];
  charges: readonly PurchaseChargeInput[];
  createdAt?: string;
}

export function insertPurchase(db: Db, r: PurchaseRecord, actor: Actor): void {
  const t = r.createdAt ?? nowIso();
  const x = r.totals;
  stmt(db, `INSERT INTO purchase (id, business_id, branch_id, warehouse_id, supplier_id, supplier_snapshot_json, supplier_invoice_no,
      supplier_invoice_date, series_id, doc_number, doc_seq, doc_date, fy, place_of_supply_state, supply_type, state_tax_kind, supplier_tax_scheme,
      is_reverse_charge, gross_paise, line_discount_paise, bill_discount_paise, taxable_paise, cgst_paise, sgst_paise, igst_paise, cess_paise,
      charges_paise, round_off_paise, total_paise, itc_paise, due_date, note, command_id, created_at, updated_at, created_by, device_id)
    VALUES (@id, @businessId, @branchId, @warehouseId, @supplierId, @snapshot, @invoiceNo, @invoiceDate, @seriesId, @docNumber, @docSeq, @docDate,
      @fy, @pos, @supplyType, @stateTaxKind, @scheme, @rcm, @gross, @lineDisc, @billDisc, @taxable, @cgst, @sgst, @igst, @cess, @charges,
      @roundOff, @total, @itc, @dueDate, @note, @commandId, @t, @t, @by, @device)`).run({
    id: r.id, businessId: r.businessId, branchId: r.branchId, warehouseId: r.warehouseId, supplierId: r.supplierId,
    snapshot: JSON.stringify(r.supplier), invoiceNo: r.supplierInvoiceNo, invoiceDate: r.supplierInvoiceDate, seriesId: r.seriesId,
    docNumber: r.docNumber, docSeq: r.docSeq, docDate: r.docDate, fy: r.fy, pos: r.placeOfSupplyState, supplyType: x.supplyType,
    stateTaxKind: x.stateTaxKind, scheme: r.supplier.taxScheme, rcm: r.isReverseCharge ? 1 : 0, gross: x.grossPaise, lineDisc: x.lineDiscountPaise,
    billDisc: x.billDiscountPaise, taxable: x.taxablePaise, cgst: x.cgstPaise, sgst: x.sgstPaise, igst: x.igstPaise, cess: x.cessPaise,
    charges: x.chargesPaise, roundOff: x.roundOffPaise, total: x.totalPaise, itc: x.itcPaise, dueDate: r.dueDate, note: r.note,
    commandId: r.commandId, t, by: actor.userId, device: actor.deviceId,
  });
  const item = stmt(db, `INSERT INTO purchase_item (id, purchase_id, business_id, line_no, product_id, product_name, hsn_code, uom_id, uom_code,
      qty_milli, base_qty_milli, unit_price_paise, price_is_inclusive, gross_paise, line_discount_paise, apportioned_bill_discount_paise,
      taxable_paise, tax_treatment, gst_rate_bp, cgst_paise, sgst_paise, igst_paise, cess_rate_bp, cess_per_unit_paise, cess_paise, total_paise,
      itc_eligible, charges_paise, landed_value_paise, unit_cost_paise)
    VALUES (@id, @purchaseId, @businessId, @lineNo, @productId, @name, @hsn, @uomId, @uomCode, @qty, @baseQty, @price, @inclusive, @gross,
      @lineDisc, @billDisc, @taxable, @treatment, @rate, @cgst, @sgst, @igst, @cessRate, @cessPerUnit, @cess, @total, @itc, @charges, @landed, @unitCost)`);
  for (const l of r.lines) {
    item.run({
      id: l.id, purchaseId: r.id, businessId: r.businessId, lineNo: l.lineNo, productId: l.productId, name: l.name, hsn: l.hsnCode ?? null,
      uomId: l.uomId, uomCode: l.uomCode, qty: l.qtyMilli, baseQty: l.baseQtyMilli, price: l.unitPricePaise, inclusive: l.priceIsInclusive ? 1 : 0,
      gross: l.grossPaise, lineDisc: l.lineDiscountPaise, billDisc: l.apportionedBillDiscountPaise, taxable: l.taxablePaise, treatment: l.taxTreatment,
      rate: l.gstRateBp, cgst: l.cgstPaise, sgst: l.sgstPaise, igst: l.igstPaise, cessRate: l.cessRateBp, cessPerUnit: l.cessPerUnitPaise,
      cess: l.cessPaise, total: l.totalPaise, itc: l.itcEligible ? 1 : 0, charges: l.chargesPaise, landed: l.landedValuePaise, unitCost: l.unitCostPaise,
    });
  }
  const charge = stmt(db, 'INSERT INTO purchase_charge (id, purchase_id, business_id, line_no, kind, description, amount_paise) VALUES (?, ?, ?, ?, ?, ?, ?)');
  r.charges.forEach((c, i) => charge.run(`${r.id}-C${i + 1}`, r.id, r.businessId, i + 1, c.kind, c.description ?? null, c.amountPaise));
}

export const purchaseIdByCommand = (db: Db, businessId: string, commandId: string): string | null =>
  (stmt(db, 'SELECT id FROM purchase WHERE business_id = ? AND command_id = ?').pluck().get(businessId, commandId) as string | undefined) ?? null;

export function postedPurchaseByInvoice(db: Db, businessId: string, supplierId: string, fy: string, invoiceNo: string): { id: string; docNumber: string } | null {
  return (stmt(db, `SELECT id, doc_number AS docNumber FROM purchase WHERE business_id = ? AND supplier_id = ? AND fy = ?
      AND supplier_invoice_no = ? COLLATE NOCASE AND status = 'posted'`).get(businessId, supplierId, fy, invoiceNo) as { id: string; docNumber: string } | undefined) ?? null;
}

// Quantity already returned per line, in the line's own unit, from posted debit notes.
export function returnedQtyByItem(db: Db, purchaseId: string): Map<string, { qtyMilli: number; baseQtyMilli: number }> {
  const rows = stmt(db, `SELECT i.purchase_item_id AS id, SUM(i.qty_milli) AS qty, SUM(i.base_qty_milli) AS base
      FROM debit_note_item i JOIN debit_note n ON n.id = i.debit_note_id WHERE n.purchase_id = ? AND n.status = 'posted'
      GROUP BY i.purchase_item_id`).all(purchaseId) as { id: string; qty: number; base: number }[];
  return new Map(rows.map((r) => [r.id, { qtyMilli: r.qty, baseQtyMilli: r.base }]));
}

export function markPurchaseCancelled(db: Db, id: string, reason: string, actor: Actor): void {
  const t = nowIso();
  stmt(db, `UPDATE purchase SET status = 'cancelled', cancelled_at = ?, cancelled_by = ?, cancel_reason = ?, updated_at = ?, version = version + 1,
      sync_state = 'pending' WHERE id = ? AND status = 'posted'`).run(t, actor.userId, reason, t, id);
}

type PurchaseRow = {
  id: string; business_id: string; doc_number: string; doc_date: string; status: Purchase['status']; supplier_id: string; supplier_snapshot_json: string;
  supplier_invoice_no: string; supplier_invoice_date: string; due_date: string; is_reverse_charge: number; note: string | null;
  supply_type: PurchaseTotals['supplyType']; state_tax_kind: PurchaseTotals['stateTaxKind']; supplier_tax_scheme: SupplierSnapshot['taxScheme'];
  gross_paise: number; line_discount_paise: number; bill_discount_paise: number; taxable_paise: number; cgst_paise: number; sgst_paise: number;
  igst_paise: number; cess_paise: number; charges_paise: number; round_off_paise: number; total_paise: number; itc_paise: number;
  settled_paise: number; created_at: string; created_by: string; cancel_reason: string | null; warehouse_id: string; branch_id: string;
};
type ItemRow = {
  id: string; line_no: number; product_id: string; product_name: string; hsn_code: string | null; uom_id: string; uom_code: string; qty_milli: number;
  base_qty_milli: number; unit_price_paise: number; price_is_inclusive: number; gross_paise: number; line_discount_paise: number;
  apportioned_bill_discount_paise: number; taxable_paise: number; tax_treatment: PurchaseQuoteLine['taxTreatment']; gst_rate_bp: number;
  cgst_paise: number; sgst_paise: number; igst_paise: number; cess_rate_bp: number; cess_per_unit_paise: number; cess_paise: number;
  total_paise: number; itc_eligible: number; charges_paise: number; landed_value_paise: number; unit_cost_paise: number;
};

export type StoredPurchase = Purchase & { businessId: string; branchId: string; warehouseId: string };

export function getPurchase(db: Db, id: string): StoredPurchase | null {
  const r = stmt(db, 'SELECT * FROM purchase WHERE id = ?').get(id) as PurchaseRow | undefined;
  if (!r) return null;
  const returned = returnedQtyByItem(db, id);
  const lines = (stmt(db, 'SELECT * FROM purchase_item WHERE purchase_id = ? ORDER BY line_no').all(id) as ItemRow[]).map((l) => ({
    id: l.id, lineNo: l.line_no, productId: l.product_id, name: l.product_name, uomId: l.uom_id, uomCode: l.uom_code, qtyMilli: l.qty_milli,
    baseQtyMilli: l.base_qty_milli, unitPricePaise: l.unit_price_paise, priceIsInclusive: l.price_is_inclusive === 1, gstRateBp: l.gst_rate_bp,
    cessRateBp: l.cess_rate_bp, cessPerUnitPaise: l.cess_per_unit_paise, taxTreatment: l.tax_treatment,
    lineDiscount: { kind: 'amount' as const, value: l.line_discount_paise }, grossPaise: l.gross_paise, lineDiscountPaise: l.line_discount_paise,
    apportionedBillDiscountPaise: l.apportioned_bill_discount_paise, taxablePaise: l.taxable_paise, cgstPaise: l.cgst_paise, sgstPaise: l.sgst_paise,
    igstPaise: l.igst_paise, cessPaise: l.cess_paise, totalPaise: l.total_paise, itcEligible: l.itc_eligible === 1, chargesPaise: l.charges_paise,
    landedValuePaise: l.landed_value_paise, unitCostPaise: l.unit_cost_paise, returnedQtyMilli: returned.get(l.id)?.qtyMilli ?? 0,
    ...(l.hsn_code !== null && { hsnCode: l.hsn_code }),
  }));
  const charges = (stmt(db, 'SELECT kind, description, amount_paise FROM purchase_charge WHERE purchase_id = ? ORDER BY line_no').all(id) as {
    kind: PurchaseChargeInput['kind']; description: string | null; amount_paise: number;
  }[]).map((c) => ({ kind: c.kind, amountPaise: c.amount_paise, ...(c.description !== null && { description: c.description }) }));
  return {
    id: r.id, businessId: r.business_id, branchId: r.branch_id, warehouseId: r.warehouse_id, docNumber: r.doc_number, docDate: r.doc_date,
    status: r.status, supplierId: r.supplier_id, supplier: JSON.parse(r.supplier_snapshot_json) as SupplierSnapshot,
    supplierInvoiceNo: r.supplier_invoice_no, supplierInvoiceDate: r.supplier_invoice_date, dueDate: r.due_date, isReverseCharge: r.is_reverse_charge === 1,
    lines, charges, settledPaise: r.settled_paise, createdAt: r.created_at, createdBy: r.created_by,
    totals: {
      docType: r.supplier_tax_scheme === 'regular' ? 'tax_invoice' : 'bill_of_supply', supplyType: r.supply_type, stateTaxKind: r.state_tax_kind,
      grossPaise: r.gross_paise, lineDiscountPaise: r.line_discount_paise, billDiscountPaise: r.bill_discount_paise, taxablePaise: r.taxable_paise,
      cgstPaise: r.cgst_paise, sgstPaise: r.sgst_paise, igstPaise: r.igst_paise, cessPaise: r.cess_paise, chargesPaise: r.charges_paise,
      itcPaise: r.itc_paise, computedTotalPaise: r.total_paise - r.round_off_paise, roundOffPaise: r.round_off_paise, totalPaise: r.total_paise,
    },
    ...(r.note !== null && { note: r.note }), ...(r.cancel_reason !== null && { cancelReason: r.cancel_reason }),
  };
}

type Cursor = { d: string; id: string };
const encode = (c: Cursor): string => Buffer.from(JSON.stringify(c)).toString('base64url');
function decode(s: string | undefined): Cursor | null {
  if (!s) return null;
  try { return JSON.parse(Buffer.from(s, 'base64url').toString('utf8')) as Cursor; } catch { return null; }
}

// Newest first by (doc date, id), so purchases saved on the same day never fall between pages.
export function listPurchases(db: Db, businessId: string, f: PurchaseListInput): PurchasePage {
  const after = decode(f.cursor);
  const rows = stmt(db, `SELECT p.id, p.doc_number, p.doc_date, p.status, p.supplier_id, s.name AS supplier_name, p.supplier_invoice_no, p.due_date,
      p.total_paise, p.settled_paise
    FROM purchase p JOIN supplier s ON s.id = p.supplier_id
    WHERE p.business_id = @businessId AND (@supplierId IS NULL OR p.supplier_id = @supplierId) AND (@status IS NULL OR p.status = @status)
      AND (@from IS NULL OR p.doc_date >= @from) AND (@to IS NULL OR p.doc_date <= @to)
      AND (@afterDate IS NULL OR (p.doc_date, p.id) < (@afterDate, @afterId))
    ORDER BY p.doc_date DESC, p.id DESC LIMIT @limit`).all({
    businessId, supplierId: f.supplierId ?? null, status: f.status ?? null, from: f.from ?? null, to: f.to ?? null,
    afterDate: after?.d ?? null, afterId: after?.id ?? null, limit: f.limit + 1,
  }) as {
    id: string; doc_number: string; doc_date: string; status: Purchase['status']; supplier_id: string; supplier_name: string; supplier_invoice_no: string;
    due_date: string; total_paise: number; settled_paise: number;
  }[];
  const page = rows.slice(0, f.limit);
  const last = page.at(-1);
  return {
    items: page.map((r) => ({
      id: r.id, docNumber: r.doc_number, docDate: r.doc_date, status: r.status, supplierId: r.supplier_id, supplierName: r.supplier_name,
      supplierInvoiceNo: r.supplier_invoice_no, dueDate: r.due_date, totalPaise: r.total_paise, settledPaise: r.settled_paise,
    })),
    nextCursor: rows.length > f.limit && last ? encode({ d: last.doc_date, id: last.id }) : null,
  };
}
