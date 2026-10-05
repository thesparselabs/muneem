import type { Branch, Business, Sale } from '@muneem/contracts';
import { placeOfSupplyLabel } from '@muneem/domain';

export interface InvoiceSeller {
  name: string; legalName: string; address: string; phone?: string; gstin?: string; pan?: string;
}
export interface InvoiceBuyer { walkIn: boolean; name?: string; gstin?: string; address?: string }
export interface InvoiceLine {
  name: string; hsn?: string; qtyMilli: number; uomCode: string; unitPricePaise: number;
  taxablePaise: number; gstRateBp: number; cgstPaise: number; sgstPaise: number; igstPaise: number; cessPaise: number; amountPaise: number;
}
export interface InvoiceTotals {
  grossPaise: number; discountPaise: number; taxablePaise: number; cgstPaise: number; sgstPaise: number;
  igstPaise: number; cessPaise: number; roundOffPaise: number; totalPaise: number;
}
export interface InvoiceTender { method: string; amountPaise: number }

export interface InvoiceData {
  seller: InvoiceSeller;
  buyer: InvoiceBuyer;
  invoiceNo: string;
  dateIso: string;
  placeOfSupply: string;
  isTaxInvoice: boolean;
  supplyType: 'intra' | 'inter';
  stateTaxLabel: 'SGST' | 'UTGST';
  lines: InvoiceLine[];
  totals: InvoiceTotals;
  tenders: InvoiceTender[];
  amountInWords: string;
}

export interface InvoiceDataDeps {
  getSale: (id: string) => Sale;
  getBusiness: () => Business | null;
  getBranch: () => Branch | null;
}

function sellerOf(business: Business | null, branch: Branch | null): InvoiceSeller {
  const name = business?.name ?? '';
  const parts = [branch?.addressLine1 ?? business?.addressLine1, business?.addressLine2, branch?.city ?? business?.city, business?.pinCode].filter(Boolean);
  const gstin = branch?.gstin ?? business?.gstin;
  return {
    name,
    legalName: business?.legalName ?? name,
    address: parts.join(', '),
    ...(business?.phone && { phone: business.phone }),
    ...(gstin && { gstin }),
    ...(business?.pan && { pan: business.pan }),
  };
}

export function buildInvoiceData(saleId: string, d: InvoiceDataDeps): InvoiceData {
  const sale = d.getSale(saleId);
  const t = sale.totals;
  const c = sale.customer;
  return {
    seller: sellerOf(d.getBusiness(), d.getBranch()),
    buyer: {
      walkIn: c.walkIn,
      ...(c.name && { name: c.name }),
      ...(c.gstin && { gstin: c.gstin }),
      ...(c.address && { address: c.address }),
    },
    invoiceNo: sale.docNumber,
    dateIso: sale.docDate,
    placeOfSupply: placeOfSupplyLabel(t.placeOfSupplyState),
    isTaxInvoice: t.docType === 'tax_invoice',
    supplyType: t.supplyType,
    stateTaxLabel: t.stateTaxKind === 'utgst' ? 'UTGST' : 'SGST',
    lines: sale.lines.map((l) => ({
      name: l.name,
      ...(l.hsnCode && { hsn: l.hsnCode }),
      qtyMilli: l.qtyMilli, uomCode: l.uomCode, unitPricePaise: l.unitPricePaise,
      taxablePaise: l.taxablePaise, gstRateBp: l.gstRateBp,
      cgstPaise: l.cgstPaise, sgstPaise: l.sgstPaise, igstPaise: l.igstPaise, cessPaise: l.cessPaise, amountPaise: l.totalPaise,
    })),
    totals: {
      grossPaise: t.grossPaise, discountPaise: t.lineDiscountPaise + t.billDiscountPaise, taxablePaise: t.taxablePaise,
      cgstPaise: t.cgstPaise, sgstPaise: t.sgstPaise, igstPaise: t.igstPaise, cessPaise: t.cessPaise,
      roundOffPaise: t.roundOffPaise, totalPaise: t.totalPaise,
    },
    tenders: sale.tenders.map((tn) => ({ method: tn.method, amountPaise: tn.amountPaise })),
    amountInWords: amountInWords(t.totalPaise),
  };
}

const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve',
  'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

const two = (n: number): string => (n < 20 ? (ONES[n] ?? '') : `${TENS[Math.floor(n / 10)] ?? ''}${n % 10 ? ` ${ONES[n % 10] ?? ''}` : ''}`);
const three = (n: number): string => {
  const h = Math.floor(n / 100);
  const r = n % 100;
  return `${h ? `${ONES[h] ?? ''} Hundred${r ? ' ' : ''}` : ''}${r ? two(r) : ''}`;
};

// Indian numbering: crore, lakh, thousand, hundred.
function indianWords(n: number): string {
  if (n <= 0) return '';
  const crore = Math.floor(n / 10_000_000);
  const lakh = Math.floor((n % 10_000_000) / 100_000);
  const thousand = Math.floor((n % 100_000) / 1000);
  const rest = n % 1000;
  return [
    crore ? `${indianWords(crore)} Crore` : '',
    lakh ? `${two(lakh)} Lakh` : '',
    thousand ? `${two(thousand)} Thousand` : '',
    rest ? three(rest) : '',
  ].filter(Boolean).join(' ');
}

export function amountInWords(paise: number): string {
  const abs = Math.abs(paise);
  const rupees = Math.floor(abs / 100);
  const paiseRem = abs % 100;
  const sign = paise < 0 ? 'Minus ' : '';
  const r = rupees === 0 ? 'Zero' : indianWords(rupees);
  const p = paiseRem > 0 ? ` and ${indianWords(paiseRem)} Paise` : '';
  return `${sign}${r} Rupees${p} Only`;
}
