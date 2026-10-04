import { addHeads, addInto, groupBy, headsOf, taxOf, ZERO_AMOUNTS, ZERO_HEADS } from './amounts.js';
import type { InwardLine, ItcRegisterRow } from './types.js';

// One row per inward document (purchase, expense, debit note or cancel), with the tax it lets the business claim and what it does not.
export function buildItcRegister(inward: readonly InwardLine[]): ItcRegisterRow[] {
  const rows = groupBy(inward, (l) => `${l.docDate}|${l.kind}|${l.docNumber}|${l.docId}`, (l): ItcRegisterRow => ({
    kind: l.kind, docNumber: l.docNumber, docDate: l.docDate, supplierName: l.supplierName ?? '', supplierGstin: l.supplierGstin ?? '',
    supplierInvoiceNo: l.supplierInvoiceNo ?? '', supplierInvoiceDate: l.supplierInvoiceDate ?? '', ...ZERO_AMOUNTS, eligible: { ...ZERO_HEADS }, ineligiblePaise: 0,
  }), (r, l) => {
    addInto(r, l);
    if (l.itcEligible) r.eligible = addHeads(r.eligible, headsOf(l));
    else r.ineligiblePaise += taxOf(l);
  });
  return rows;
}
