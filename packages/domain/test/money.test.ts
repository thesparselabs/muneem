import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { readFileSync } from 'node:fs';
import { apportion, divRound, pctOf, DomainError } from '../src/index.js';

describe('divRound (HALF_UP, sign preserved)', () => {
  it('rounds ties away from zero on the absolute value', () => {
    expect(divRound(5, 10)).toBe(1); // 0.5 → 1
    expect(divRound(-5, 10)).toBe(-1); // -0.5 → -1
    expect(divRound(15, 10)).toBe(2);
    expect(divRound(-15, 10)).toBe(-2);
    expect(divRound(25, 10)).toBe(3);
    expect(divRound(4, 10)).toBe(0);
    expect(divRound(-4, 10)).toBe(0);
    expect(divRound(0, 7)).toBe(0);
    expect(divRound(7, -2)).toBe(-4);
    expect(divRound(-7, -2)).toBe(4);
  });
  it('matches the money fixture file', () => {
    const fx = JSON.parse(readFileSync(new URL('../fixtures/money/divround.json', import.meta.url), 'utf8')) as {
      cases: { n: number; d: number; expected: number }[];
    };
    for (const c of fx.cases) expect(divRound(c.n, c.d), `${c.n}/${c.d}`).toBe(c.expected);
  });
  it('refuses division by zero and unsafe integers', () => {
    expect(() => divRound(1, 0)).toThrow(DomainError);
    expect(() => divRound(2 ** 53, 1)).toThrow(DomainError);
    expect(() => divRound(1.5, 1)).toThrow(DomainError);
  });
  it('property: |result - n/d| <= 0.5 and ties go away from zero', () => {
    fc.assert(
      fc.property(fc.integer({ min: -1e12, max: 1e12 }), fc.integer({ min: 1, max: 1e6 }), (n, d) => {
        const r = divRound(n, d);
        const exact = n / d;
        expect(Math.abs(r - exact)).toBeLessThanOrEqual(0.5 + 1e-9);
        if (Math.abs(Math.abs(exact) % 1 - 0.5) < 1e-9) expect(Math.abs(r)).toBeGreaterThanOrEqual(Math.abs(exact));
      }),
    );
  });
});

describe('pctOf', () => {
  it('18% of ₹100', () => expect(pctOf(10_000, 1800)).toBe(1800));
  it('0.25% of ₹1,00,000', () => expect(pctOf(10_000_000, 25)).toBe(25_000));
  it('rounds half up', () => expect(pctOf(3, 5000)).toBe(2)); // 1.5 → 2
});

describe('apportion (largest remainder)', () => {
  it('sums exactly and breaks ties by lower index', () => {
    expect(apportion(100, [1000, 1000, 1000])).toEqual([34, 33, 33]);
    expect(apportion(0, [1, 2, 3])).toEqual([0, 0, 0]);
    expect(apportion(7, [0, 0, 5])).toEqual([0, 0, 7]);
    expect(apportion(5, [1, 1, 1, 1, 1, 1])).toEqual([1, 1, 1, 1, 1, 0]);
  });
  it('matches the money fixture file', () => {
    const fx = JSON.parse(readFileSync(new URL('../fixtures/money/apportion.json', import.meta.url), 'utf8')) as {
      cases: { total: number; weights: number[]; expected: number[] }[];
    };
    for (const c of fx.cases) expect(apportion(c.total, c.weights)).toEqual(c.expected);
  });
  it('refuses to spread a non-zero total over zero weights', () => {
    expect(() => apportion(5, [0, 0])).toThrow(DomainError);
  });
  it('property: Σ parts === total and each part within 1 of its exact share', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 1e11 }),
        fc.array(fc.integer({ min: 0, max: 1e9 }), { minLength: 1, maxLength: 60 }),
        (total, weights) => {
          fc.pre(weights.some((w) => w > 0));
          const parts = apportion(total, weights);
          expect(parts.reduce((a, b) => a + b, 0)).toBe(total);
          const sum = weights.reduce((a, b) => a + b, 0);
          parts.forEach((p, i) => {
            const exact = (total * (weights[i] ?? 0)) / sum;
            expect(Math.abs(p - exact)).toBeLessThan(1 + 1e-6);
          });
        },
      ),
    );
  });
  it('uses BigInt so huge totals × weights do not lose paise', () => {
    // 500-line wholesale invoice: total × weight ≈ 1e9 × 1e9 = 1e18 > 2^53
    const weights = Array.from({ length: 500 }, (_, i) => 1_000_000_000 + i);
    const parts = apportion(1_000_000_000, weights);
    expect(parts.reduce((a, b) => a + b, 0)).toBe(1_000_000_000);
  });
});
