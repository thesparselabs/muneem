import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { billRoundOff, cumulativeShare, docSeriesPrefix, formatDocNumber, landedValues } from '../src/index.js';

describe('landed cost (ADR-0023)', () => {
  it('spreads charges by taxable value and adds tax that cannot be claimed', () => {
    const lines = [{ taxablePaise: 30_000, taxPaise: 5400, itcEligible: true }, { taxablePaise: 10_000, taxPaise: 1800, itcEligible: false }];
    expect(landedValues(lines, 1000)).toEqual([
      { chargesPaise: 750, landedValuePaise: 30_750 },
      { chargesPaise: 250, landedValuePaise: 12_050 },
    ]);
  });

  it('spreads charges equally when every line is free', () => {
    expect(landedValues([{ taxablePaise: 0, taxPaise: 0, itcEligible: true }, { taxablePaise: 0, taxPaise: 0, itcEligible: true }], 101)
      .map((l) => l.chargesPaise)).toEqual([51, 50]);
  });

  it('refuses charges with nothing to land on', () => {
    expect(() => landedValues([], 100)).toThrow(/at least one line/);
    expect(landedValues([], 0)).toEqual([]);
  });

  it('property: Σ landed = Σ taxable + Σ unclaimable tax + charges', () => {
    const line = fc.record({ taxablePaise: fc.integer({ min: 0, max: 10_000_000 }), taxPaise: fc.integer({ min: 0, max: 2_000_000 }), itcEligible: fc.boolean() });
    fc.assert(fc.property(fc.array(line, { minLength: 1, maxLength: 50 }), fc.integer({ min: 0, max: 1_000_000 }), (lines, charges) => {
      const landed = landedValues(lines, charges);
      const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
      expect(sum(landed.map((l) => l.chargesPaise))).toBe(charges);
      expect(sum(landed.map((l) => l.landedValuePaise))).toBe(sum(lines.map((l) => l.taxablePaise + (l.itcEligible ? 0 : l.taxPaise))) + charges);
    }), { numRuns: 300 });
  });
});

describe('bill total check', () => {
  it('keeps a difference of up to ₹1 as round-off and refuses more', () => {
    expect(billRoundOff(118_040, 118_000)).toBe(-40);
    expect(billRoundOff(118_000, 118_100)).toBe(100);
    expect(() => billRoundOff(118_000, 118_101)).toThrow(/differs/);
  });
});

describe('return shares (5c)', () => {
  it('splits a line so the returns always add up to it exactly', () => {
    expect([cumulativeShare(1000, 3000, 0, 1000), cumulativeShare(1000, 3000, 1000, 1000), cumulativeShare(1000, 3000, 2000, 1000)]).toEqual([333, 334, 333]);
    expect(() => cumulativeShare(1000, 3000, 2000, 1001)).toThrow(/cannot take/);
  });

  it('property: any partition of the quantity returns exactly the amount, never a negative share', () => {
    fc.assert(fc.property(fc.integer({ min: 0, max: 10_000_000 }), fc.array(fc.integer({ min: 1, max: 5000 }), { minLength: 1, maxLength: 20 }), (amount, parts) => {
      const whole = parts.reduce((a, b) => a + b, 0);
      let before = 0;
      let sum = 0;
      for (const q of parts) {
        const share = cumulativeShare(amount, whole, before, q);
        expect(share).toBeGreaterThanOrEqual(0);
        sum += share;
        before += q;
      }
      expect(sum).toBe(amount);
    }), { numRuns: 300 });
  });
});

describe('document numbers (ADR-0028)', () => {
  it('puts the kind letter after the terminal prefix and stays within 16 characters', () => {
    expect(formatDocNumber(docSeriesPrefix('DE01', 'debit_note'), '2026-27', 7)).toBe('DE01D/2627/00007');
    expect(formatDocNumber(docSeriesPrefix('T1', 'purchase'), '2026-27', 99_999)).toBe('T1P/2627/99999');
    expect(() => formatDocNumber('T1P', '2026-27', 100_000)).toThrow(/all 99999/);
    expect(() => formatDocNumber('T1', '2026-27', 1)).toThrow(/kind letter/);
    expect(() => docSeriesPrefix('TOOLONG', 'purchase')).toThrow(/terminal prefix/);
  });
});
