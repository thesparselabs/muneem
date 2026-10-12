import { describe, expect, it } from 'vitest';
import type { Estimate, SaleQuote } from '@muneem/contracts';
import { emptyEstimateForm, formToDraft, statusText, type EstimateForm } from '../../src/renderer/src/lib/estimates/form.js';
import { alignQuote } from '../../src/renderer/src/lib/pos/cart.js';
import { billableEstimate, loadBillable } from '../../src/renderer/src/lib/pos/retrieve.js';

const P = '01J00000000000000000000P01';
const U = '01J00000000000000000000U01';
const line = (qty: string, discountPct = '') => ({ productId: P, name: 'Soap', units: [{ id: U, code: 'PCS' }], uomId: U, qty, discountPct });

describe('estimate form', () => {
  it('turns typed fields into a draft with percent discounts in basis points', () => {
    const f: EstimateForm = { ...emptyEstimateForm('2026-10-27'), customer: { id: 'c1', name: 'Gupta' }, lines: [line('2.5', '10')], billDiscountPct: '5', notes: '  Bulk rate ' };
    expect(formToDraft(f)).toEqual({
      ok: true,
      draft: {
        customerId: 'c1', validUntil: '2026-10-27', notes: 'Bulk rate', billDiscount: { kind: 'percent', value: 500 },
        lines: [{ productId: P, uomId: U, qtyMilli: 2500, lineDiscount: { kind: 'percent', value: 1000 } }],
      },
    });
  });

  it('names every field that does not parse', () => {
    expect(formToDraft(emptyEstimateForm('2026-10-27'))).toEqual({ ok: false, errors: { lines: 'add at least one product' } });
    const bad = formToDraft({ ...emptyEstimateForm('2026-10-27'), lines: [line('0', '120')], billDiscountPct: 'x' });
    expect(bad).toEqual({ ok: false, errors: { 'lines.0.qty': 'quantity above zero', 'lines.0.discountPct': 'a percent from 0 to 100', billDiscountPct: 'a percent from 0 to 100' } });
  });

  it('matches priced lines to form lines past a line the engine refused', () => {
    const quote = { lines: [{ lineNo: 1, name: 'A' }, { lineNo: 2, name: 'C' }], issues: [{ lineNo: 2, message: 'no price' }] } as unknown as SaleQuote;
    expect(alignQuote(3, quote).map((x) => x.line?.name ?? x.issue)).toEqual(['A', 'no price', 'C']);
    expect(alignQuote(2, undefined)).toEqual([{}, {}]);
  });

  it('says where an estimate stands', () => {
    expect([statusText({ status: 'open' }), statusText({ status: 'expired' }), statusText({ status: 'converted', saleDocNumber: 'DE01/2627/000009' })])
      .toEqual(['Open', 'Expired', 'Billed as DE01/2627/000009']);
  });
});

describe('billing an estimate at the till', () => {
  const estimate = (over: Partial<Estimate> = {}): Estimate => ({
    id: 'e1', docNumber: 'DE01Q/2627/00004', status: 'open', totals: { totalPaise: 10_000 },
    draft: { customerId: 'c1', lines: [{ productId: P, uomId: U, qtyMilli: 2000, lineDiscount: { kind: 'percent', value: 500 } }], billDiscount: { kind: 'amount', value: 0 } },
    ...over,
  }) as Estimate;
  const quote = (totalPaise: number) => ({
    lines: [{ lineNo: 1, productId: P, name: 'Soap', uomId: U, uomCode: 'PCS', qtyMilli: 2000, unitPricePaise: 5000, priceIsInclusive: true, gstRateBp: 1800,
      cessRateBp: 0, cessPerUnitPaise: 0, taxTreatment: 'taxable', lineDiscount: { kind: 'percent', value: 500 } }],
    issues: [], totals: { totalPaise },
  }) as unknown as SaleQuote;
  const deps = (e: Estimate, total: number) => ({
    get: async () => billableEstimate(e), getCustomer: async () => ({ id: 'c1', name: 'Gupta' }) as never, quote: async () => quote(total),
  });

  it('fills the cart with the estimate\'s lines, customer and link, and says when prices moved', async () => {
    const same = await loadBillable('estimate', deps(estimate(), 10_000), 'e1');
    expect(same.ok && [same.cart.source, same.cart.customer?.name, same.cart.lines[0]!.lineDiscount, same.notes]).toEqual([
      { type: 'estimate', id: 'e1', docNumber: 'DE01Q/2627/00004' }, 'Gupta', { kind: 'percent', value: 500 }, [],
    ]);
    const moved = await loadBillable('estimate', deps(estimate(), 10_500), 'e1');
    expect(moved.ok && moved.notes).toEqual(['Prices have changed since estimate DE01Q/2627/00004: it was ₹100.00, now ₹105.00.']);
  });

  it('refuses an estimate already billed', async () => {
    expect(await loadBillable('estimate', deps(estimate({ status: 'converted', saleDocNumber: 'DE01/2627/000009' }), 10_000), 'e1'))
      .toEqual({ ok: false, error: 'Estimate DE01Q/2627/00004 was already billed as DE01/2627/000009.' });
  });
});
