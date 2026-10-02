import type { Customer, DiscountInput, ProductHit, QuoteContext, SaleDraft, SaleQuote } from '@muneem/contracts';
import { computeInvoice, type GstInvoiceResult } from '@muneem/domain';

export interface LinePricing {
  unitPricePaise: number; priceIsInclusive: boolean; gstRateBp: number; cessRateBp: number; cessPerUnitPaise: number;
  taxTreatment: ProductHit['taxTreatment'];
}
export interface CartLine {
  key: string; productId: string; name: string; uomId: string; uomCode: string; qtyMilli: number; lineDiscount: DiscountInput;
  pricing: LinePricing | null; issue?: string; stockWarning?: { message: string; blocking: boolean };
}
export interface Cart {
  lines: CartLine[]; customer: Customer | null; billDiscount: DiscountInput;
  placeOfSupplyOverride?: { stateCode: string; reason: string } | undefined;
}

const NO_DISCOUNT: DiscountInput = { kind: 'amount', value: 0 };
export const emptyCart = (): Cart => ({ lines: [], customer: null, billDiscount: NO_DISCOUNT });

let keySeq = 0;
const nextKey = () => `line-${++keySeq}`;

// Scanning the same item again adds to its line; a case barcode adds a whole case.
export function addHit(cart: Cart, hit: ProductHit): Cart {
  const existing = cart.lines.find((l) => l.productId === hit.productId && l.uomId === hit.uomId);
  if (existing) return setQty(cart, existing.key, existing.qtyMilli + hit.packQtyMilli);
  const pricing = hit.pricePaise === null ? null : {
    unitPricePaise: hit.pricePaise, priceIsInclusive: hit.priceIsInclusive, gstRateBp: hit.gstRateBp, cessRateBp: 0, cessPerUnitPaise: 0,
    taxTreatment: hit.taxTreatment,
  };
  const line: CartLine = {
    key: nextKey(), productId: hit.productId, name: hit.name, uomId: hit.uomId, uomCode: hit.uomCode, qtyMilli: hit.packQtyMilli,
    lineDiscount: NO_DISCOUNT, pricing,
  };
  return { ...cart, lines: [...cart.lines, line] };
}

const mapLine = (cart: Cart, key: string, f: (l: CartLine) => CartLine): Cart => ({ ...cart, lines: cart.lines.map((l) => (l.key === key ? f(l) : l)) });
export const setQty = (cart: Cart, key: string, qtyMilli: number): Cart => mapLine(cart, key, (l) => ({ ...l, qtyMilli }));
export const setLineDiscount = (cart: Cart, key: string, lineDiscount: DiscountInput): Cart => mapLine(cart, key, (l) => ({ ...l, lineDiscount }));
export const removeLine = (cart: Cart, key: string): Cart => ({ ...cart, lines: cart.lines.filter((l) => l.key !== key) });

export function toDraft(cart: Cart): SaleDraft {
  return {
    lines: cart.lines.map((l) => ({ productId: l.productId, uomId: l.uomId, qtyMilli: l.qtyMilli, lineDiscount: l.lineDiscount })),
    billDiscount: cart.billDiscount,
    ...(cart.customer && { customerId: cart.customer.id }),
    ...(cart.placeOfSupplyOverride && { placeOfSupplyOverride: cart.placeOfSupplyOverride }),
  };
}

// Quote lines skip lines with issues, so they are matched back to the cart by position.
export function applyQuote(cart: Cart, quote: SaleQuote): Cart {
  const issues = new Map(quote.issues.map((i) => [i.lineNo, i.message]));
  const warnings = new Map(quote.warnings.map((w) => [w.lineNo, { message: w.message, blocking: w.blocking }]));
  let next = 0;
  return {
    ...cart,
    lines: cart.lines.map((line, i) => {
      const warning = warnings.get(i + 1);
      const l: CartLine = { ...line };
      if (warning) l.stockWarning = warning; else delete l.stockWarning;
      const issue = issues.get(i + 1);
      if (issue) return { ...l, issue };
      const q = quote.lines[next++];
      if (!q) return l;
      const priced: CartLine = { ...l };
      delete priced.issue;
      return {
        ...priced, name: q.name, uomCode: q.uomCode,
        pricing: pricingOf(q),
      };
    }),
  };
}

const pricingOf = (q: SaleQuote['lines'][number]): LinePricing => ({
  unitPricePaise: q.unitPricePaise, priceIsInclusive: q.priceIsInclusive, gstRateBp: q.gstRateBp, cessRateBp: q.cessRateBp,
  cessPerUnitPaise: q.cessPerUnitPaise, taxTreatment: q.taxTreatment,
});

// A retrieved held bill comes back from a fresh quote; lines that can no longer be sold are left out.
export function cartFromQuote(base: Omit<Cart, 'lines'>, quote: SaleQuote): Cart {
  return {
    ...base,
    lines: quote.lines.map((q) => ({
      key: nextKey(), productId: q.productId, name: q.name, uomId: q.uomId, uomCode: q.uomCode, qtyMilli: q.qtyMilli,
      lineDiscount: q.lineDiscount, pricing: pricingOf(q),
    })),
  };
}

// Instant totals between quotes, with the same engine the main process uses; the quote stays authoritative.
export function localTotals(cart: Cart, context: QuoteContext | null): GstInvoiceResult | null {
  const priced = cart.lines.filter((l) => l.pricing && !l.issue);
  if (!context || priced.length === 0) return null;
  const placeOfSupply = cart.placeOfSupplyOverride?.stateCode ?? cart.customer?.stateCode ?? context.supplierStateCode;
  try {
    return computeInvoice({
      docType: context.taxScheme === 'regular' ? 'tax_invoice' : 'bill_of_supply',
      supplierStateCode: context.supplierStateCode, placeOfSupplyStateCode: placeOfSupply, isUnionTerritoryWithoutLegislature: false,
      taxScheme: context.taxScheme, billDiscount: cart.billDiscount, roundToRupee: context.roundToRupee,
      b2clThresholdPaise: context.b2clThresholdPaise, ...(cart.customer?.gstin && { customerGstin: cart.customer.gstin }),
      lines: priced.map((l) => ({ qtyMilli: l.qtyMilli, lineDiscount: l.lineDiscount, ...l.pricing! })),
    });
  } catch {
    return null;
  }
}
