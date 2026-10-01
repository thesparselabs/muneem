import { describe, expect, it } from 'vitest';
import type { ProductHit, SaleQuote } from '@muneem/contracts';
import { addHit, applyQuote, cartFromQuote, emptyCart, localTotals, removeLine, setQty, toDraft } from '../../src/renderer/src/lib/pos/cart.js';
import { previewSettlement, rowsToTenders } from '../../src/renderer/src/lib/pos/payment.js';
import { feedKey, idleScan, type ScanState } from '../../src/renderer/src/lib/pos/scanBuffer.js';

const PCS = '01J0000000000000000000PCS0';
const BOX = '01J0000000000000000000B0X0';
const hit = (over: Partial<ProductHit> = {}): ProductHit => ({
  productId: '01J00000000000000000000P01', name: 'Lux Soap', uomId: PCS, uomCode: 'PCS', packQtyMilli: 1000, pricePaise: 4130,
  priceIsInclusive: true, gstRateBp: 1800, taxTreatment: 'taxable', isActive: true, matchedBy: 'barcode', ...over,
});
const CONTEXT = { supplierStateCode: '07', taxScheme: 'regular' as const, roundToRupee: true, b2clThresholdPaise: 10_000_000 };

function typeKeys(keys: string, gapMs: number, enterGapMs = gapMs): string | undefined {
  let state: ScanState = idleScan;
  let at = 1000;
  for (const k of keys) { at += gapMs; state = feedKey(state, k, at).state; }
  return feedKey(state, 'Enter', at + enterGapMs).scan;
}

describe('scan buffer', () => {
  it('recognises a fast burst ending in Enter as a scan', () => {
    expect(typeKeys('8901030865275', 8)).toBe('8901030865275');
  });
  it('ignores human typing, short codes and a slow Enter', () => {
    expect(typeKeys('soap', 150)).toBeUndefined();
    expect(typeKeys('123', 5)).toBeUndefined();
    expect(typeKeys('8901030865275', 8, 400)).toBeUndefined();
  });
  it('anything typed with gaps above 60 ms is never a scan', () => {
    for (const gap of [61, 80, 120, 250, 500]) expect(typeKeys('ABC123456', gap)).toBeUndefined();
  });
});

describe('cart', () => {
  it('adds to the same line on a repeat scan and a case barcode adds a case', () => {
    let cart = addHit(emptyCart(), hit());
    cart = addHit(cart, hit());
    cart = addHit(cart, hit({ uomId: BOX, uomCode: 'BOX', packQtyMilli: 1000, pricePaise: 49_560 }));
    expect(cart.lines.map((l) => [l.uomCode, l.qtyMilli])).toEqual([['PCS', 2000], ['BOX', 1000]]);
    expect(toDraft(removeLine(cart, cart.lines[1]!.key)).lines).toEqual([{ productId: hit().productId, uomId: PCS, qtyMilli: 2000, lineDiscount: { kind: 'amount', value: 0 } }]);
  });

  it('totals instantly with the same GST engine, rounding to the rupee', () => {
    const one = addHit(emptyCart(), hit());
    expect(localTotals(one, CONTEXT)!.totalPaise).toBe(4100);
    expect(localTotals(setQty(one, one.lines[0]!.key, 3000), CONTEXT)!.totalPaise).toBe(12_400);
    expect(localTotals(emptyCart(), CONTEXT)).toBeNull();
  });

  it('marks lines the quote could not price and takes quote prices for the rest', () => {
    const cart = addHit(addHit(emptyCart(), hit()), hit({ productId: '01J00000000000000000000P02', name: 'Rice', pricePaise: null }));
    const quote = {
      lines: [{ ...hit(), lineNo: 1, unitPricePaise: 3900, cessRateBp: 0, cessPerUnitPaise: 0, qtyMilli: 1000 }],
      issues: [{ lineNo: 2, message: 'Rice has no selling price' }],
    } as unknown as SaleQuote;
    const next = applyQuote(cart, quote);
    expect(next.lines.map((l) => [l.pricing?.unitPricePaise ?? null, l.issue ?? null])).toEqual([[3900, null], [null, 'Rice has no selling price']]);
    expect(localTotals(next, CONTEXT)!.lines).toHaveLength(1);
  });
});

describe('retrieved bills', () => {
  it('rebuild the cart from a fresh quote with quantities and discounts', () => {
    const quote = {
      lines: [{ ...hit(), lineNo: 1, qtyMilli: 3000, unitPricePaise: 3900, cessRateBp: 0, cessPerUnitPaise: 0, lineDiscount: { kind: 'percent', value: 500 } }],
      issues: [],
    } as unknown as SaleQuote;
    const cart = cartFromQuote({ customer: null, billDiscount: { kind: 'amount', value: 0 } }, quote);
    expect(toDraft(cart).lines).toEqual([{ productId: hit().productId, uomId: PCS, qtyMilli: 3000, lineDiscount: { kind: 'percent', value: 500 } }]);
  });
});

describe('payment entry', () => {
  it('turns typed amounts into tenders and previews change', () => {
    const rows = [{ method: 'upi' as const, amount: '40', reference: 'UPI1' }, { method: 'cash' as const, amount: '60.00', reference: '' }, { method: 'card' as const, amount: '', reference: '' }];
    expect(rowsToTenders(rows)).toEqual({ ok: true, tenders: [{ method: 'upi', amountPaise: 4000, reference: 'UPI1' }, { method: 'cash', amountPaise: 6000 }] });
    expect(previewSettlement(9500, rows)).toMatchObject({ ok: true, changePaise: 500 });
    expect(previewSettlement(9500, [{ method: 'cash', amount: 'ten', reference: '' }])).toMatchObject({ ok: false, reason: 'invalid' });
  });
});
