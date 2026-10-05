import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  effectiveDiscountBp, expectedCash, formatInvoiceNumber, isUtWithoutLegislature, settleTenders, stateOfGstin, suggestInvoicePrefix, type TenderInput,
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
  it('rounds to the nearest basis point', () => {
    expect(effectiveDiscountBp(10_000, 500)).toBe(500);
    expect(effectiveDiscountBp(10_000, 501)).toBe(501);
    expect(effectiveDiscountBp(30_001, 1500)).toBe(500);
    expect(effectiveDiscountBp(29_999, 1500)).toBe(500);
    expect(effectiveDiscountBp(29_900, 1500)).toBe(502);
    expect(effectiveDiscountBp(0, 0)).toBe(0);
  });
});

describe('expectedCash', () => {
  it('adds cash takings and movements to the opening float', () => {
    expect(expectedCash({ openingPaise: 50_000, cashTenderedPaise: 120_000, changeGivenPaise: 5000, cashInPaise: 10_000, cashOutPaise: 2000, safeDropPaise: 100_000 })).toBe(73_000);
    expect(expectedCash({ openingPaise: 50_000, cashTenderedPaise: 120_000, changeGivenPaise: 5000, cashInPaise: 10_000, cashOutPaise: 2000, safeDropPaise: 100_000, cashRefundPaise: 3000 })).toBe(70_000);
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

describe('invoice numbers (CGST Rule 46(b))', () => {
  it('formats PREFIX/2627/000123 within 16 characters of letters, digits and /', () => {
    expect(formatInvoiceNumber('D1', '2026-27', 123)).toBe('D1/2627/000123');
    expect(formatInvoiceNumber('DL1A', '2099-00', 999_999)).toBe('DL1A/9900/999999');
    for (const n of [formatInvoiceNumber('ABCD', '2026-27', 999_999)]) {
      expect(n.length).toBeLessThanOrEqual(16);
      expect(n).toMatch(/^[A-Za-z0-9/-]+$/);
    }
  });
  it('refuses bad prefixes and a sequence past 999999', () => {
    expect(() => formatInvoiceNumber('DEL1T', '2026-27', 1)).toThrow();
    expect(() => formatInvoiceNumber('d1', '2026-27', 1)).toThrow();
    expect(() => formatInvoiceNumber('D1', '2026-27', 1_000_000)).toThrow(/999999/);
    expect(() => formatInvoiceNumber('D1', '2026-27', 0)).toThrow();
  });
  it('suggests a short prefix from the branch and terminal codes, avoiding ones in use', () => {
    expect(suggestInvoicePrefix('DEL1', 'T01', new Set())).toBe('DE01');
    expect(suggestInvoicePrefix('DEL1', 'T01', new Set(['DE01']))).toBe('T1');
    expect(suggestInvoicePrefix('DEL1', 'T01', new Set(['DE01', 'T1']))).toBe('T2');
    expect(suggestInvoicePrefix('MAIN', 'COUNTR', new Set())).toBe('MATR');
  });
});
