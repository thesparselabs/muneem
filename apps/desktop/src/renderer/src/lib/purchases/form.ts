import { PURCHASE_CHARGE_KINDS, type Product, type PurchaseDraft, type PurchaseLineInput, type PurchaseQuote, type Uom } from '@muneem/contracts';
import { formatPaise, parseOptional, paiseToText, scaledToText } from '../money.js';

export interface LineUnit { id: string; code: string }
export interface PurchaseFormLine {
  productId: string; name: string; units: LineUnit[]; uomId: string;
  qty: string; rate: string; inclusive: boolean; discountPct: string; gstRate: string; itc: boolean;
}
export interface PurchaseForm {
  supplierId: string; invoiceNo: string; invoiceDate: string; dueDate: string; billDiscountPct: string;
  charges: { kind: (typeof PURCHASE_CHARGE_KINDS)[number]; amount: string }[]; billTotal: string; lines: PurchaseFormLine[];
}

export const emptyPurchaseForm = (today: string): PurchaseForm => ({
  supplierId: '', invoiceNo: '', invoiceDate: today, dueDate: '', billDiscountPct: '', charges: [], billTotal: '', lines: [],
});

// The units a product can be bought in: its base unit and every unit it converts from.
export function unitsOf(p: Pick<Product, 'baseUomId' | 'conversions'>, uoms: readonly Uom[]): LineUnit[] {
  const code = new Map(uoms.map((u) => [u.id, u.code]));
  return [p.baseUomId, ...p.conversions.map((c) => c.fromUomId)].map((id) => ({ id, code: code.get(id) ?? '?' }));
}

export function lineFor(p: Pick<Product, 'id' | 'name' | 'baseUomId' | 'conversions' | 'gstRateBp'>, uoms: readonly Uom[], input?: PurchaseLineInput): PurchaseFormLine {
  return {
    productId: p.id, name: p.name, units: unitsOf(p, uoms), uomId: input?.uomId ?? p.baseUomId,
    qty: input ? scaledToText(input.qtyMilli, 3) : '', rate: input ? paiseToText(input.unitPricePaise) : '', inclusive: input?.priceIsInclusive ?? false,
    discountPct: input && input.lineDiscount.value > 0 ? scaledToText(input.lineDiscount.value, 2) : '',
    gstRate: scaledToText(input?.gstRateBp ?? p.gstRateBp, 2), itc: input?.itcEligible ?? true,
  };
}

type Draft = { ok: true; draft: PurchaseDraft } | { ok: false; errors: Record<string, string> };

// Strings in, a draft out; every field that does not parse is named so the form can show it beside the box.
export function formToDraft(f: PurchaseForm): Draft {
  const errors: Record<string, string> = {};
  if (!f.supplierId) errors.supplierId = 'choose the supplier';
  if (!f.invoiceNo.trim()) errors.invoiceNo = 'enter the bill number';
  if (f.lines.length === 0) errors.lines = 'add at least one line';
  const pct = (text: string, key: string): number | undefined => {
    const v = parseOptional(text, 2);
    if (v === null || (v !== undefined && (v < 0 || v > 10_000))) { errors[key] = 'a percent from 0 to 100'; return undefined; }
    return v;
  };
  const lines = f.lines.map((l, i): PurchaseLineInput => {
    const qty = parseOptional(l.qty, 3);
    const rate = parseOptional(l.rate, 2);
    if (!qty || qty <= 0) errors[`lines.${i}.qty`] = 'quantity above zero';
    if (rate === undefined || rate === null || rate < 0) errors[`lines.${i}.rate`] = 'enter the rate';
    const disc = pct(l.discountPct, `lines.${i}.discountPct`);
    const gst = pct(l.gstRate, `lines.${i}.gstRate`);
    return {
      productId: l.productId, uomId: l.uomId, qtyMilli: qty ?? 0, unitPricePaise: rate ?? 0, priceIsInclusive: l.inclusive,
      lineDiscount: { kind: 'percent', value: disc ?? 0 }, itcEligible: l.itc, ...(gst !== undefined && { gstRateBp: gst }),
    };
  });
  const charges = f.charges.flatMap((c, i) => {
    const v = parseOptional(c.amount, 2);
    if (v === undefined) return [];
    if (v === null || v <= 0) { errors[`charges.${i}`] = 'an amount above zero'; return []; }
    return [{ kind: c.kind, amountPaise: v }];
  });
  const billDisc = pct(f.billDiscountPct, 'billDiscountPct');
  const bill = parseOptional(f.billTotal, 2);
  if (bill === null || (bill !== undefined && bill < 0)) errors.billTotal = 'the grand total printed on the bill';
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    draft: {
      supplierId: f.supplierId, supplierInvoiceNo: f.invoiceNo.trim(), supplierInvoiceDate: f.invoiceDate, isReverseCharge: false, lines, charges,
      billDiscount: { kind: 'percent', value: billDisc ?? 0 }, ...(f.dueDate && { dueDate: f.dueDate }), ...(bill !== undefined && bill !== null && { billTotalPaise: bill }),
    },
  };
}

export function billCheck(q: PurchaseQuote | undefined): { tone: 'ok' | 'bad' | 'none'; text: string } {
  if (!q || q.billDifferencePaise === undefined) return { tone: 'none', text: q ? `Lines add up to ${formatPaise(q.totals.computedTotalPaise)}; enter the bill total` : '' };
  if (q.billTotalOk) return { tone: 'ok', text: q.billDifferencePaise === 0 ? 'Matches the bill' : `Matches; ${formatPaise(q.billDifferencePaise)} kept as round-off` };
  return { tone: 'bad', text: `Off by ${formatPaise(q.billDifferencePaise)}: lines add up to ${formatPaise(q.totals.computedTotalPaise)}` };
}

export interface ReturnRow { purchaseItemId: string; name: string; uomCode: string; leftMilli: number; qty: string }
export function returnLines(rows: readonly ReturnRow[]): { ok: true; lines: { purchaseItemId: string; qtyMilli: number }[] } | { ok: false; error: string } {
  const lines = [];
  for (const r of rows) {
    const q = parseOptional(r.qty, 3);
    if (q === undefined || q === 0) continue;
    if (q === null || q < 0) return { ok: false, error: `Check the quantity for ${r.name}` };
    if (q > r.leftMilli) return { ok: false, error: `Only ${scaledToText(r.leftMilli, 3)} ${r.uomCode} of ${r.name} is left to return` };
    lines.push({ purchaseItemId: r.purchaseItemId, qtyMilli: q });
  }
  return lines.length > 0 ? { ok: true, lines } : { ok: false, error: 'Enter what is going back' };
}
