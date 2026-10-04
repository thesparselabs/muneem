import type { RefundMethod, ReturnDraft, ReturnQuote, SaleSummary } from '@muneem/contracts';
import { parseScaled } from '@muneem/domain';

// What the cashier has typed per sale line, as text, so a half-typed "1." is never lost.
export type QtyInputs = Record<number, string>;

export const REFUND_LABELS: Record<RefundMethod, string> = { cash: 'Cash', upi: 'UPI', card: 'Card', credit: "Customer's account" };

// Every line still returnable, prefilled with all of it (a whole-bill return is the common case).
export function wholeBill(quote: ReturnQuote): QtyInputs {
  return Object.fromEntries(quote.lines.filter((l) => l.returnableQtyMilli > 0).map((l) => [l.lineNo, String(l.returnableQtyMilli / 1000)]));
}

export interface ParsedReturn { lines: ReturnDraft['lines']; errors: Record<number, string> }

export function parseQuantities(quote: ReturnQuote, inputs: QtyInputs): ParsedReturn {
  const errors: Record<number, string> = {};
  const lines: ReturnDraft['lines'] = [];
  for (const l of quote.lines) {
    const text = (inputs[l.lineNo] ?? '').trim();
    if (text === '' || text === '0') continue;
    const qtyMilli = parseScaled(text, 3);
    if (qtyMilli === null || qtyMilli < 0) { errors[l.lineNo] = 'enter a quantity'; continue; }
    if (qtyMilli > l.returnableQtyMilli) { errors[l.lineNo] = `only ${l.returnableQtyMilli / 1000} ${l.uomCode} left`; continue; }
    if (qtyMilli > 0) lines.push({ lineNo: l.lineNo, qtyMilli });
  }
  return { lines, errors };
}

export const returnLabel = (s: Pick<SaleSummary, 'returned'>): string =>
  s.returned === 'full' ? 'Returned' : s.returned === 'partial' ? 'Part returned' : '';

// Receipt search: a bill is found by any part of its number or its customer's name.
export function matchesSearch(s: Pick<SaleSummary, 'docNumber' | 'customerName'>, query: string): boolean {
  const q = query.trim().toLowerCase();
  return q === '' || s.docNumber.toLowerCase().includes(q) || (s.customerName ?? '').toLowerCase().includes(q);
}
