import type { EstimateDraft, EstimateStatus, EstimateSummary, Product, Uom } from '@muneem/contracts';
import { parseOptional } from '../money.js';
import { unitsOf, type LineUnit } from '../purchases/form.js';

export interface EstimateFormLine { productId: string; name: string; units: LineUnit[]; uomId: string; qty: string; discountPct: string }
export interface EstimateForm {
  customer: { id: string; name: string } | null; lines: EstimateFormLine[]; billDiscountPct: string; validUntil: string; notes: string;
}

export const emptyEstimateForm = (validUntil: string): EstimateForm => ({ customer: null, lines: [], billDiscountPct: '', validUntil, notes: '' });

export function lineFor(p: Pick<Product, 'id' | 'name' | 'baseUomId' | 'conversions'>, uoms: readonly Uom[]): EstimateFormLine {
  return { productId: p.id, name: p.name, units: unitsOf(p, uoms), uomId: p.baseUomId, qty: '1', discountPct: '' };
}

type Parsed = { ok: true; draft: EstimateDraft } | { ok: false; errors: Record<string, string> };

// Strings in, a draft out; a field that does not parse is named so the form can show it beside the box.
export function formToDraft(f: EstimateForm): Parsed {
  const errors: Record<string, string> = {};
  if (f.lines.length === 0) errors.lines = 'add at least one product';
  const pct = (text: string, key: string): number => {
    const v = parseOptional(text, 2);
    if (v === null || (v !== undefined && (v < 0 || v > 10_000))) { errors[key] = 'a percent from 0 to 100'; return 0; }
    return v ?? 0;
  };
  const lines = f.lines.map((l, i) => {
    const qty = parseOptional(l.qty, 3);
    if (!qty || qty <= 0) errors[`lines.${i}.qty`] = 'quantity above zero';
    return { productId: l.productId, uomId: l.uomId, qtyMilli: qty ?? 0, lineDiscount: { kind: 'percent' as const, value: pct(l.discountPct, `lines.${i}.discountPct`) } };
  });
  const billDiscount = { kind: 'percent' as const, value: pct(f.billDiscountPct, 'billDiscountPct') };
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    draft: {
      lines, billDiscount, ...(f.customer && { customerId: f.customer.id }), ...(f.validUntil && { validUntil: f.validUntil }),
      ...(f.notes.trim() && { notes: f.notes.trim() }),
    },
  };
}

export const STATUS_FILTERS: { value: EstimateStatus | ''; label: string }[] = [
  { value: '', label: 'All' }, { value: 'open', label: 'Open' }, { value: 'expired', label: 'Expired' }, { value: 'converted', label: 'Billed' },
];

export const statusText = (e: Pick<EstimateSummary, 'status' | 'saleDocNumber'>): string =>
  (e.status === 'converted' ? `Billed as ${e.saleDocNumber ?? ''}`.trim() : e.status === 'expired' ? 'Expired' : 'Open');
