import type { Customer, HeldBill, SaleDraft, SaleQuote } from '@muneem/contracts';
import { cartFromQuote, type Cart } from './cart.js';

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
