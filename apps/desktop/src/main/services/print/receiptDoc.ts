import type { Branch, Business, ReceiptDoc, Sale } from '@muneem/contracts';

const COMPOSITION_DECLARATION = 'Composition taxable person, not eligible to collect tax on supplies';

export interface ReceiptContext {
  business: Business;
  branch: Branch;
  terminalCode: string;
  cashier: string;
  footer: string[];
  copyNo: number;
  // A sale partly on credit: what was put on credit, when it is due, and the customer's balance after this bill.
  credit?: { amountPaise: number; dueDate: string; balancePaise: number };
}

export function qtyText(qtyMilli: number, uomCode: string): string {
  const whole = Math.trunc(qtyMilli / 1000);
  const fraction = String(qtyMilli % 1000).padStart(3, '0').replace(/0+$/u, '');
  return `${fraction ? `${whole}.${fraction}` : whole} ${uomCode}`;
}

const timeOf = (iso: string): string => new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });

function headerLines(business: Business, branch: Branch): string[] {
  const address = [branch.addressLine1 ?? business.addressLine1, branch.city ?? business.city].filter(Boolean).join(', ');
  return [business.legalName, address, business.phone ? `Ph: ${business.phone}` : undefined].filter((l): l is string => !!l);
}

function taxSummary(sale: Sale): ReceiptDoc['taxSummary'] {
  const byRate = new Map<number, ReceiptDoc['taxSummary'][number]>();
  for (const l of sale.lines.filter((x) => x.taxTreatment === 'taxable' && x.gstRateBp > 0)) {
    const row = byRate.get(l.gstRateBp) ?? { rateBp: l.gstRateBp, taxablePaise: 0, cgstPaise: 0, sgstPaise: 0, igstPaise: 0 };
    row.taxablePaise += l.taxablePaise;
    row.cgstPaise += l.cgstPaise;
    row.sgstPaise += l.sgstPaise;
    row.igstPaise += l.igstPaise;
    byRate.set(l.gstRateBp, row);
  }
  return [...byRate.values()].sort((a, b) => a.rateBp - b.rateBp);
}

export function buildReceiptDoc(sale: Sale, c: ReceiptContext): ReceiptDoc {
  const t = sale.totals;
  const gstin = c.branch.gstin ?? c.business.gstin;
  return {
    title: t.docType === 'tax_invoice' ? 'TAX INVOICE' : 'BILL OF SUPPLY',
    duplicate: c.copyNo > 1,
    copyNo: c.copyNo,
    header: { businessName: c.business.name, lines: headerLines(c.business, c.branch), ...(gstin && { gstin }) },
    docNumber: sale.docNumber,
    docDate: sale.docDate,
    time: timeOf(sale.createdAt),
    terminalCode: c.terminalCode,
    cashier: c.cashier,
    ...(!sale.customer.walkIn && sale.customer.name && {
      customer: {
        name: sale.customer.name,
        ...(sale.customer.gstin && { gstin: sale.customer.gstin }),
        ...(sale.customer.phone && { phone: sale.customer.phone }),
      },
    }),
    placeOfSupply: t.placeOfSupplyState,
    lines: sale.lines.map((l) => ({
      name: l.name, qty: qtyText(l.qtyMilli, l.uomCode), unitPricePaise: l.unitPricePaise,
      discountPaise: l.lineDiscountPaise + l.apportionedBillDiscountPaise, amountPaise: l.totalPaise,
      ...(l.hsnCode && { hsnCode: l.hsnCode }),
    })),
    totals: {
      grossPaise: t.grossPaise, discountPaise: t.lineDiscountPaise + t.billDiscountPaise, taxablePaise: t.taxablePaise,
      cgstPaise: t.cgstPaise, sgstPaise: t.sgstPaise, igstPaise: t.igstPaise, cessPaise: t.cessPaise, roundOffPaise: t.roundOffPaise,
      totalPaise: t.totalPaise, stateTaxLabel: t.stateTaxKind === 'utgst' ? 'UTGST' : 'SGST',
    },
    taxSummary: taxSummary(sale),
    tenders: sale.tenders.map((tn) => ({ method: tn.method.toUpperCase(), amountPaise: tn.amountPaise, ...(tn.reference && { reference: tn.reference }) })),
    changePaise: sale.changePaise,
    ...(c.credit && { credit: c.credit }),
    ...(c.business.taxScheme === 'composition' && { declaration: COMPOSITION_DECLARATION }),
    footer: c.footer,
  };
}
