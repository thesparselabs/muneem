import type { CreditNote, ReceiptDoc, Sale } from '@muneem/contracts';
import { headerLines, qtyText, timeOf, type ReceiptContext } from './receiptDoc.js';

const REFUND_LABEL = { cash: 'REFUND CASH', upi: 'REFUND UPI', card: 'REFUND CARD', credit: 'TO ACCOUNT' } as const;

function taxSummary(note: CreditNote): ReceiptDoc['taxSummary'] {
  const byRate = new Map<number, ReceiptDoc['taxSummary'][number]>();
  for (const l of note.lines.filter((x) => x.gstRateBp > 0)) {
    const row = byRate.get(l.gstRateBp) ?? { rateBp: l.gstRateBp, taxablePaise: 0, cgstPaise: 0, sgstPaise: 0, igstPaise: 0 };
    row.taxablePaise += l.taxablePaise;
    row.cgstPaise += l.cgstPaise;
    row.sgstPaise += l.sgstPaise;
    row.igstPaise += l.igstPaise;
    byRate.set(l.gstRateBp, row);
  }
  return [...byRate.values()].sort((a, b) => a.rateBp - b.rateBp);
}

// A credit note prints like the invoice it reverses, naming that invoice and the reason (ADR-0043).
export function buildCreditNoteDoc(note: CreditNote, sale: Sale, c: Omit<ReceiptContext, 'credit'>): ReceiptDoc {
  const gstin = c.branch.gstin ?? c.business.gstin;
  const priceOf = new Map(sale.lines.map((l) => [l.lineNo, l.unitPricePaise]));
  const tenders = [
    ...(note.refundPaise > 0 ? [{ method: REFUND_LABEL[note.refundMethod], amountPaise: note.refundPaise }] : []),
    ...(note.creditPaise > 0 ? [{ method: REFUND_LABEL.credit, amountPaise: note.creditPaise }] : []),
  ];
  return {
    title: 'CREDIT NOTE',
    duplicate: c.copyNo > 1,
    copyNo: c.copyNo,
    header: { businessName: c.business.name, lines: headerLines(c.business, c.branch), ...(gstin && { gstin }) },
    docNumber: note.docNumber,
    docDate: note.docDate,
    time: timeOf(note.createdAt),
    terminalCode: c.terminalCode,
    cashier: c.cashier,
    ...(!sale.customer.walkIn && sale.customer.name && {
      customer: { name: sale.customer.name, ...(sale.customer.gstin && { gstin: sale.customer.gstin }), ...(sale.customer.phone && { phone: sale.customer.phone }) },
    }),
    placeOfSupply: note.placeOfSupplyState,
    against: { docNumber: note.saleDocNumber, docDate: note.saleDocDate },
    reason: note.reason,
    lines: note.lines.map((l) => ({
      name: l.name, qty: qtyText(l.qtyMilli, l.uomCode), unitPricePaise: priceOf.get(l.saleLineNo) ?? 0, discountPaise: 0, amountPaise: l.totalPaise,
      ...(l.hsnCode && { hsnCode: l.hsnCode }),
    })),
    totals: {
      grossPaise: note.taxablePaise, discountPaise: 0, taxablePaise: note.taxablePaise, cgstPaise: note.cgstPaise, sgstPaise: note.sgstPaise, igstPaise: note.igstPaise,
      cessPaise: note.cessPaise, roundOffPaise: note.roundOffPaise, totalPaise: note.totalPaise, stateTaxLabel: note.stateTaxKind === 'utgst' ? 'UTGST' : 'SGST',
    },
    taxSummary: taxSummary(note),
    tenders,
    changePaise: 0,
    footer: c.footer,
  };
}
