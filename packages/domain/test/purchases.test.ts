import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { billRoundOff, landedValues } from '../src/index.js';

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
