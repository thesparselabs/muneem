import type { Estimate } from '@muneem/contracts';
import type { DocumentVariant } from '../invoice/invoiceData.js';
import { fmtDate } from '../invoice/templates/base.js';

// An estimate prints on the shop's invoice template as a quotation: no invoice declaration, and the date it holds to.
export function quotationVariant(e: Estimate): DocumentVariant {
  return {
    title: 'Quotation', numberLabel: 'Quotation No', declaration: false,
    rows: [{ label: 'Valid until', value: fmtDate(e.validUntil) }, ...(e.notes ? [{ label: 'Note', value: e.notes }] : [])],
  };
}

export const quotationFileName = (e: Pick<Estimate, 'docNumber'>): string => `quotation-${e.docNumber}`;
