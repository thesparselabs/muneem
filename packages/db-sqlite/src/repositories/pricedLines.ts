import type { DiscountInput, QuoteLine, SaleTotals } from '@muneem/contracts';
import { effectiveDiscountBp } from '@muneem/domain';
import type { Db } from '../open.js';
import { stmt } from '../statements.js';

// Estimates and delivery challans are priced like a sale and stored with the sale's line and total columns (ADR-0068/0069).
const PARENT = { estimate_item: 'estimate_id', delivery_challan_item: 'challan_id' } as const;
export type PricedItemTable = keyof typeof PARENT;

export const pricedLineId = (parentId: string, lineNo: number): string => `${parentId}-${String(lineNo).padStart(3, '0')}`;

export function insertPricedLines(db: Db, table: PricedItemTable, parentId: string, businessId: string, lines: readonly QuoteLine[]): void {
  const item = stmt(db, `INSERT INTO ${table} (id, ${PARENT[table]}, business_id, line_no, product_id, product_name, hsn_code, uom_id, uom_code, qty_milli,
      base_qty_milli, unit_price_paise, price_is_inclusive, mrp_paise, line_discount_kind, line_discount_value, gross_paise, line_discount_paise,
      apportioned_bill_discount_paise, taxable_paise, tax_treatment, gst_rate_bp, cgst_paise, sgst_paise, igst_paise, cess_rate_bp, cess_per_unit_paise,
      cess_paise, total_paise)
    VALUES (@id, @parentId, @businessId, @lineNo, @productId, @name, @hsn, @uomId, @uomCode, @qty, @baseQty, @price, @inclusive, @mrp, @discKind,
      @discValue, @gross, @lineDisc, @billDisc, @taxable, @treatment, @rate, @cgst, @sgst, @igst, @cessRate, @cessPerUnit, @cess, @total)`);
  for (const l of lines) {
    item.run({
      id: pricedLineId(parentId, l.lineNo), parentId, businessId, lineNo: l.lineNo, productId: l.productId, name: l.name,
      hsn: l.hsnCode ?? null, uomId: l.uomId, uomCode: l.uomCode, qty: l.qtyMilli, baseQty: l.baseQtyMilli, price: l.unitPricePaise,
      inclusive: l.priceIsInclusive ? 1 : 0, mrp: l.mrpPaise ?? null, discKind: l.lineDiscount.kind, discValue: l.lineDiscount.value, gross: l.grossPaise,
      lineDisc: l.lineDiscountPaise, billDisc: l.apportionedBillDiscountPaise, taxable: l.taxablePaise, treatment: l.taxTreatment, rate: l.gstRateBp,
      cgst: l.cgstPaise, sgst: l.sgstPaise, igst: l.igstPaise, cessRate: l.cessRateBp, cessPerUnit: l.cessPerUnitPaise, cess: l.cessPaise, total: l.totalPaise,
    });
  }
}

type ItemRow = {
  line_no: number; product_id: string; product_name: string; hsn_code: string | null; uom_id: string; uom_code: string; qty_milli: number;
  base_qty_milli: number; unit_price_paise: number; price_is_inclusive: number; mrp_paise: number | null; line_discount_kind: DiscountInput['kind'];
  line_discount_value: number; gross_paise: number; line_discount_paise: number; apportioned_bill_discount_paise: number; taxable_paise: number;
  tax_treatment: QuoteLine['taxTreatment']; gst_rate_bp: number; cgst_paise: number; sgst_paise: number; igst_paise: number; cess_rate_bp: number;
  cess_per_unit_paise: number; cess_paise: number; total_paise: number;
};

const toLine = (l: ItemRow): QuoteLine => ({
  lineNo: l.line_no, productId: l.product_id, name: l.product_name, uomId: l.uom_id, uomCode: l.uom_code, qtyMilli: l.qty_milli,
  baseQtyMilli: l.base_qty_milli, unitPricePaise: l.unit_price_paise, priceIsInclusive: l.price_is_inclusive === 1, gstRateBp: l.gst_rate_bp,
  cessRateBp: l.cess_rate_bp, cessPerUnitPaise: l.cess_per_unit_paise, taxTreatment: l.tax_treatment,
  lineDiscount: { kind: l.line_discount_kind, value: l.line_discount_value }, grossPaise: l.gross_paise, lineDiscountPaise: l.line_discount_paise,
  apportionedBillDiscountPaise: l.apportioned_bill_discount_paise, taxablePaise: l.taxable_paise, cgstPaise: l.cgst_paise, sgstPaise: l.sgst_paise,
  igstPaise: l.igst_paise, cessPaise: l.cess_paise, totalPaise: l.total_paise,
  ...(l.hsn_code !== null && { hsnCode: l.hsn_code }), ...(l.mrp_paise !== null && { mrpPaise: l.mrp_paise }),
});

export function pricedLines(db: Db, table: PricedItemTable, parentId: string): QuoteLine[] {
  return (stmt(db, `SELECT * FROM ${table} WHERE ${PARENT[table]} = ? ORDER BY line_no`).all(parentId) as ItemRow[]).map(toLine);
}

export type TotalsRow = {
  doc_type: SaleTotals['docType']; place_of_supply_state: string; supply_type: SaleTotals['supplyType']; state_tax_kind: SaleTotals['stateTaxKind'];
  gstr1_bucket: string; gross_paise: number; line_discount_paise: number; bill_discount_paise: number; taxable_paise: number; cgst_paise: number;
  sgst_paise: number; igst_paise: number; cess_paise: number; round_off_paise: number; total_paise: number;
};

// The named parameters for a document's total columns.
export const totalsParams = (t: SaleTotals) => ({
  docType: t.docType, posState: t.placeOfSupplyState, supplyType: t.supplyType, stateTaxKind: t.stateTaxKind, bucket: t.gstr1Bucket,
  gross: t.grossPaise, lineDisc: t.lineDiscountPaise, billDisc: t.billDiscountPaise, taxable: t.taxablePaise, cgst: t.cgstPaise, sgst: t.sgstPaise,
  igst: t.igstPaise, cess: t.cessPaise, roundOff: t.roundOffPaise, total: t.totalPaise,
});

export function totalsOf(r: TotalsRow, lines: readonly QuoteLine[]): SaleTotals {
  const discount = lines.reduce((s, l) => s + l.lineDiscountPaise + l.apportionedBillDiscountPaise, 0);
  return {
    docType: r.doc_type, placeOfSupplyState: r.place_of_supply_state, supplyType: r.supply_type, stateTaxKind: r.state_tax_kind, gstr1Bucket: r.gstr1_bucket,
    grossPaise: r.gross_paise, lineDiscountPaise: r.line_discount_paise, billDiscountPaise: r.bill_discount_paise, taxablePaise: r.taxable_paise,
    cgstPaise: r.cgst_paise, sgstPaise: r.sgst_paise, igstPaise: r.igst_paise, cessPaise: r.cess_paise, roundOffPaise: r.round_off_paise,
    totalPaise: r.total_paise, discountBp: effectiveDiscountBp(r.taxable_paise + discount, discount),
  };
}
