import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { readFileSync } from 'node:fs';
import { computeReturn, creditNoteBucket, docSeriesPrefix, DomainError, formatDocNumber, type ReturnInput, type ReturnResult, type SoldLine } from '../src/index.js';

const fixture = JSON.parse(readFileSync(new URL('../fixtures/returns/return-golden.json', import.meta.url), 'utf8')) as {
  cases: { name: string; input: ReturnInput; expected?: ReturnResult; error?: string }[];
};

describe('sale return golden vectors (shared with Go)', () => {
  it('has hand-verified and generated cases', () => {
    expect(fixture.cases.filter((c) => c.name.startsWith('HAND')).length).toBeGreaterThanOrEqual(7);
    expect(fixture.cases.length).toBeGreaterThan(30);
  });
  for (const c of fixture.cases) {
    it(c.name, () => {
      if (c.error) {
        expect(() => computeReturn(c.input)).toThrow(DomainError);
        try { computeReturn(c.input); } catch (e) { expect((e as DomainError).code).toBe(c.error); }
      } else {
        expect(computeReturn(c.input)).toEqual(c.expected);
      }
    });
  }
});

const soldLine = fc.record({
  qtyMilli: fc.integer({ min: 1, max: 50_000 }), factor: fc.integer({ min: 1, max: 24 }), taxablePaise: fc.integer({ min: 0, max: 50_000_000 }),
  rateBp: fc.constantFrom(0, 500, 1200, 1800, 2800), intra: fc.boolean(), cessPaise: fc.integer({ min: 0, max: 100_000 }), cogsPaise: fc.integer({ min: 0, max: 40_000_000 }),
}).map((l): SoldLine => {
  const tax = Math.floor((l.taxablePaise * l.rateBp) / 10_000);
  return {
    qtyMilli: l.qtyMilli, baseQtyMilli: l.qtyMilli * l.factor, taxablePaise: l.taxablePaise, cgstPaise: l.intra ? Math.floor(tax / 2) : 0,
    sgstPaise: l.intra ? tax - Math.floor(tax / 2) : 0, igstPaise: l.intra ? 0 : tax, cessPaise: l.cessPaise, cogsPaise: l.cogsPaise,
  };
});

// A line's quantity cut into 1–6 returns at random points.
const parts = (qty: number) => fc.array(fc.integer({ min: 1, max: qty }), { maxLength: 5 })
  .map((cuts) => [...new Set([0, ...cuts, qty])].sort((a, b) => a - b))
  .map((points) => points.slice(1).map((p, i) => ({ before: points[i]!, qty: p - points[i]! })));

const AMOUNTS = ['baseQtyMilli', 'taxablePaise', 'cgstPaise', 'sgstPaise', 'igstPaise', 'cessPaise'] as const;

describe('sale returns (ADR-0043)', () => {
  it('property: however a line is returned in parts, the parts add up to the line exactly and never exceed it', () => {
    fc.assert(fc.property(soldLine.chain((line) => fc.tuple(fc.constant(line), parts(line.qtyMilli))), ([line, pieces]) => {
      const results = pieces.map((p) => computeReturn({ lines: [{ line, returnedBeforeMilli: p.before, qtyMilli: p.qty }], saleRoundOffPaise: 0, roundOffReturnedPaise: 0 }));
      let running = { ...line, costPaise: 0, totalPaise: 0 };
      for (const r of results) {
        const l = r.lines[0]!;
        for (const k of AMOUNTS) {
          expect(l[k]).toBeGreaterThanOrEqual(0);
          running = { ...running, [k]: running[k] - l[k] };
          expect(running[k]).toBeGreaterThanOrEqual(0);
        }
        expect(l.totalPaise).toBe(l.taxablePaise + l.cgstPaise + l.sgstPaise + l.igstPaise + l.cessPaise);
      }
      for (const k of AMOUNTS) expect(results.reduce((s, r) => s + r.lines[0]![k], 0)).toBe(line[k]);
      expect(results.reduce((s, r) => s + r.costPaise, 0)).toBe(line.cogsPaise);
      expect(results.map((r) => r.completesSale)).toEqual(pieces.map((_, i) => i === pieces.length - 1));
    }), { numRuns: 500 });
  });

  it('property: returning a whole bill is exactly the bill — every amount, the round-off and the total', () => {
    fc.assert(fc.property(fc.array(soldLine, { minLength: 1, maxLength: 8 }), fc.integer({ min: -50, max: 50 }), (lines, roundOff) => {
      const r = computeReturn({ lines: lines.map((line) => ({ line, returnedBeforeMilli: 0, qtyMilli: line.qtyMilli })), saleRoundOffPaise: roundOff, roundOffReturnedPaise: 0 });
      const sum = (f: (l: SoldLine) => number) => lines.reduce((s, l) => s + f(l), 0);
      expect(r.lines.map((l) => [l.taxablePaise, l.cgstPaise, l.sgstPaise, l.igstPaise, l.cessPaise, l.costPaise]))
        .toEqual(lines.map((l) => [l.taxablePaise, l.cgstPaise, l.sgstPaise, l.igstPaise, l.cessPaise, l.cogsPaise]));
      expect(r.roundOffPaise).toBe(roundOff);
      expect(r.totalPaise).toBe(sum((l) => l.taxablePaise + l.cgstPaise + l.sgstPaise + l.igstPaise + l.cessPaise) + roundOff);
      expect(r.completesSale).toBe(true);
    }), { numRuns: 300 });
  });

  it('refuses a return of more than is left, and a negative quantity', () => {
    const line: SoldLine = { qtyMilli: 2000, baseQtyMilli: 2000, taxablePaise: 100, cgstPaise: 9, sgstPaise: 9, igstPaise: 0, cessPaise: 0, cogsPaise: 50 };
    expect(() => computeReturn({ lines: [{ line, returnedBeforeMilli: 1500, qtyMilli: 1000 }], saleRoundOffPaise: 0, roundOffReturnedPaise: 0 })).toThrow(/cannot take/);
    expect(() => computeReturn({ lines: [{ line, returnedBeforeMilli: 0, qtyMilli: -1 }], saleRoundOffPaise: 0, roundOffReturnedPaise: 0 })).toThrow(DomainError);
  });

  it('files a credit note as CDNR with a GSTIN, CDNUR without, and nowhere outside the regular scheme', () => {
    expect(creditNoteBucket('regular', '27AAAAA0000A1Z5')).toBe('cdnr');
    expect(creditNoteBucket('regular', undefined)).toBe('cdnur');
    expect(creditNoteBucket('composition', '27AAAAA0000A1Z5')).toBe('na');
  });

  it('numbers credit notes with the kind letter C', () => {
    expect(formatDocNumber(docSeriesPrefix('T1', 'credit_note'), '2026-27', 7)).toBe('T1C/2627/00007');
    expect(formatDocNumber(docSeriesPrefix('ABCD', 'credit_note'), '2026-27', 99_999)).toHaveLength(16);
  });
});
