import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  effectiveDiscountBp, expectedCash, isUtWithoutLegislature, settleTenders, stateOfGstin, type TenderInput,
} from '../src/index.js';

describe('settleTenders', () => {
  it('gives change from cash only', () => {
    expect(settleTenders(95_000, [{ method: 'upi', amountPaise: 40_000 }, { method: 'cash', amountPaise: 60_000 }])).toEqual({
      ok: true, paidPaise: 100_000, changePaise: 5000,
      tenders: [{ method: 'upi', amountPaise: 40_000, changePaise: 0 }, { method: 'cash', amountPaise: 60_000, changePaise: 5000 }],
    });
  });
  it('accepts an exact split', () => {
    expect(settleTenders(1000, [{ method: 'card', amountPaise: 400 }, { method: 'upi', amountPaise: 600 }])).toMatchObject({ ok: true, changePaise: 0 });
  });
  it('refuses short payment, non-cash over-tender, empty and non-positive tenders', () => {
    expect(settleTenders(1000, [{ method: 'cash', amountPaise: 900 }])).toEqual({ ok: false, reason: 'short', shortByPaise: 100 });
    expect(settleTenders(1000, [{ method: 'card', amountPaise: 1100 }])).toEqual({ ok: false, reason: 'non_cash_over_total' });
    expect(settleTenders(1000, [])).toEqual({ ok: false, reason: 'short', shortByPaise: 1000 });
    expect(settleTenders(1000, [{ method: 'cash', amountPaise: 0 }])).toEqual({ ok: false, reason: 'non_positive' });
  });
  it('a zero bill needs no tender', () => {
    expect(settleTenders(0, [])).toMatchObject({ ok: true, paidPaise: 0, changePaise: 0 });
  });
  it('property: an accepted settlement always balances and only cash carries change', () => {
    const tender = fc.record({
      method: fc.constantFrom<TenderInput['method']>('cash', 'upi', 'card', 'other'),
      amountPaise: fc.integer({ min: 1, max: 1_000_000 }),
    });
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 2_000_000 }), fc.array(tender, { maxLength: 5 }), (total, tenders) => {
        const r = settleTenders(total, tenders);
        if (!r.ok) return;
        expect(r.paidPaise - r.changePaise).toBe(total);
        expect(r.tenders.reduce((s, t) => s + t.changePaise, 0)).toBe(r.changePaise);
        for (const t of r.tenders) {
          if (t.method !== 'cash') expect(t.changePaise).toBe(0);
          expect(t.changePaise).toBeLessThanOrEqual(t.amountPaise);
        }
      }),
    );
  });
});

describe('effectiveDiscountBp', () => {
  it('rounds up so a discount just over the limit is caught', () => {
    expect(effectiveDiscountBp(10_000, 500)).toBe(500);
    expect(effectiveDiscountBp(10_000, 501)).toBe(501);
    expect(effectiveDiscountBp(30_001, 1500)).toBe(500);
    expect(effectiveDiscountBp(29_999, 1500)).toBe(501);
    expect(effectiveDiscountBp(30_000, 1501)).toBe(501);
    expect(effectiveDiscountBp(0, 0)).toBe(0);
  });
});

describe('expectedCash', () => {
  it('adds cash takings and movements to the opening float', () => {
    expect(expectedCash({ openingPaise: 50_000, cashTenderedPaise: 120_000, changeGivenPaise: 5000, cashInPaise: 10_000, cashOutPaise: 2000, safeDropPaise: 100_000 })).toBe(73_000);
  });
});

describe('GST state helpers', () => {
  it('reads the state from a GSTIN and knows the UTs without a legislature', () => {
    expect(stateOfGstin('07AAAAA0000A1Z5')).toBe('07');
    expect(isUtWithoutLegislature('04')).toBe(true);
    expect(isUtWithoutLegislature('38')).toBe(true);
    expect(isUtWithoutLegislature('07')).toBe(false);
  });
});
