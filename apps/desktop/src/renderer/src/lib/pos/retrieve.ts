import { CHALLAN_PURPOSE_LABELS, type Challan, type Customer, type Estimate, type HeldBill, type SaleDraft, type SaleQuote } from '@muneem/contracts';
import { formatPaise } from '../money.js';
import { cartFromQuote, type BillSource, type Cart } from './cart.js';

export interface RetrieveDeps {
  getHeldBill(id: string): Promise<HeldBill>;
  getCustomer(id: string): Promise<Customer>;
  quote(draft: SaleDraft): Promise<SaleQuote>;
  discardBill(id: string): Promise<unknown>;
}

export type RetrieveResult = { ok: true; cart: Cart; quote: SaleQuote; notes: string[] } | { ok: false; error: string };

const messageOf = (e: unknown) => (e && typeof e === 'object' && 'message' in e ? String((e as { message: unknown }).message) : String(e));

// The held copy is removed only after the cart has been rebuilt; any failure before that leaves the bill held.
export async function retrieveHeldBill(deps: RetrieveDeps, id: string): Promise<RetrieveResult> {
  const notes: string[] = [];
  let bill: HeldBill;
  let quote: SaleQuote;
  let customer: Customer | null = null;
  try {
    bill = await deps.getHeldBill(id);
    if (bill.cart.customerId) {
      customer = await deps.getCustomer(bill.cart.customerId).catch(() => {
        notes.push('The customer on this bill no longer exists; it is now a walk-in bill.');
        return null;
      });
    }
    const draft: SaleDraft = { ...bill.cart };
    if (!customer) delete draft.customerId;
    quote = await deps.quote(draft);
  } catch (e) {
    return { ok: false, error: `${messageOf(e)}. The bill is still held.` };
  }
  if (quote.issues.length > 0) notes.push(`Left out: ${quote.issues.map((i) => i.message).join('; ')}`);
  const cart = cartFromQuote({ customer, billDiscount: bill.cart.billDiscount, placeOfSupplyOverride: bill.cart.placeOfSupplyOverride }, quote);
  await deps.discardBill(id).catch(() => notes.push('The held copy could not be removed; discard it from Held bills.'));
  return { ok: true, cart, quote, notes };
}

// An estimate or a delivery challan as the till needs it: its draft, the total it promised, and why it cannot be billed.
export interface BillableDocument { id: string; docNumber: string; draft: SaleDraft; totalPaise: number; refusal?: string | undefined }
export interface BillableDeps {
  get(id: string): Promise<BillableDocument>;
  getCustomer(id: string): Promise<Customer>;
  quote(draft: SaleDraft): Promise<SaleQuote>;
}

export const SOURCE_NAMES: Record<BillSource['type'], string> = { estimate: 'estimate', delivery_challan: 'challan' };

export function billableEstimate(e: Estimate): BillableDocument {
  return {
    id: e.id, docNumber: e.docNumber, draft: e.draft, totalPaise: e.totals.totalPaise,
    ...(e.status === 'converted' && { refusal: `Estimate ${e.docNumber} was already billed as ${e.saleDocNumber ?? 'another bill'}.` }),
  };
}

export function billableChallan(c: Challan): BillableDocument {
  const refusal = c.status === 'billed' ? `Challan ${c.docNumber} was already invoiced as ${c.saleDocNumber ?? 'another bill'}.`
    : c.purpose !== 'supply' ? `Challan ${c.docNumber} was sent for ${CHALLAN_PURPOSE_LABELS[c.purpose].toLowerCase()}; only a challan for supply is invoiced.` : undefined;
  return { id: c.id, docNumber: c.docNumber, draft: c.draft, totalPaise: c.totals.totalPaise, ...(refusal && { refusal }) };
}

// FR-086/087: the document comes to the till at today's prices; the cashier is told if the total moved since it was made.
export async function loadBillable(type: BillSource['type'], deps: BillableDeps, id: string): Promise<RetrieveResult> {
  const notes: string[] = [];
  let doc: BillableDocument;
  let quote: SaleQuote;
  let customer: Customer | null = null;
  try {
    doc = await deps.get(id);
    if (doc.refusal) return { ok: false, error: doc.refusal };
    if (doc.draft.customerId) customer = await deps.getCustomer(doc.draft.customerId);
    quote = await deps.quote(doc.draft);
  } catch (e) {
    return { ok: false, error: messageOf(e) };
  }
  if (quote.issues.length > 0) notes.push(`Left out: ${quote.issues.map((i) => i.message).join('; ')}`);
  if (quote.totals.totalPaise !== doc.totalPaise) {
    notes.push(`Prices have changed since ${SOURCE_NAMES[type]} ${doc.docNumber}: it was ${formatPaise(doc.totalPaise)}, now ${formatPaise(quote.totals.totalPaise)}.`);
  }
  const cart = cartFromQuote({
    customer, billDiscount: doc.draft.billDiscount, placeOfSupplyOverride: doc.draft.placeOfSupplyOverride, source: { type, id: doc.id, docNumber: doc.docNumber },
  }, quote);
  return { ok: true, cart, quote, notes };
}
