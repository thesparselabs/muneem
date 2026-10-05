import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { readFileSync } from 'node:fs';
import {
  addHeads, buildJournal, computeSetoff, creditUsedBy, DomainError, GST_PAYMENT_RULE, GST_SETOFF_RULE, liabilityMetBy, taxOf, totals, type GstHeads, type SetoffResult,
} from '../src/index.js';

const fixture = JSON.parse(readFileSync(new URL('../fixtures/setoff/setoff-golden.json', import.meta.url), 'utf8')) as {
  cases: { name: string; liability: GstHeads; credit: GstHeads; expected?: SetoffResult; error?: string }[];
};

describe('set-off golden vectors (shared with Go)', () => {
  it('has hand-verified and generated cases', () => {
    expect(fixture.cases.filter((c) => c.name.startsWith('HAND')).length).toBeGreaterThanOrEqual(6);
    expect(fixture.cases.length).toBeGreaterThan(40);
  });
  for (const c of fixture.cases) {
    it(c.name, () => {
      if (c.error) expect(() => computeSetoff(c.liability, c.credit)).toThrow(DomainError);
      else expect(computeSetoff(c.liability, c.credit)).toEqual(c.expected);
    });
  }
});

const amount = fc.oneof(fc.constant(0), fc.integer({ min: 0, max: 1_000 }), fc.integer({ min: 0, max: 50_000_000 }));
const heads = fc.record({ igstPaise: amount, cgstPaise: amount, sgstPaise: amount, cessPaise: amount });
const KEYS = ['igstPaise', 'cgstPaise', 'sgstPaise', 'cessPaise'] as const;

// The plain statutory sequence with no look-ahead: IGST → IGST, CGST, SGST; CGST → CGST, IGST; SGST → SGST, IGST; cess → cess.
function naiveCash(l: GstHeads, c: GstHeads): number {
  const owe = { ...l };
  const have = { ...c };
  const pay = (from: keyof GstHeads, to: keyof GstHeads) => { const a = Math.min(have[from], owe[to]); have[from] -= a; owe[to] -= a; };
  pay('igstPaise', 'igstPaise'); pay('igstPaise', 'cgstPaise'); pay('igstPaise', 'sgstPaise');
  pay('cgstPaise', 'cgstPaise'); pay('cgstPaise', 'igstPaise'); pay('sgstPaise', 'sgstPaise'); pay('sgstPaise', 'igstPaise'); pay('cessPaise', 'cessPaise');
  return taxOf(owe);
}

describe('set-off properties', () => {
  it('conserves: each liability is met by credit or cash, each credit is used or left; nothing goes negative', () => {
    fc.assert(fc.property(heads, heads, (l, c) => {
      const r = computeSetoff(l, c);
      const met = liabilityMetBy(r.utilisation);
      for (const k of KEYS) {
        expect(met[k] + r.cash[k]).toBe(l[k]);
        expect(r.creditUsed[k] + r.creditLeft[k]).toBe(c[k]);
        expect(Math.min(met[k], r.cash[k], r.creditUsed[k], r.creditLeft[k])).toBeGreaterThanOrEqual(0);
      }
      expect(r.creditUsed).toEqual(creditUsedBy(r.utilisation));
      expect(Object.values(r.utilisation).every((v) => v >= 0)).toBe(true);
    }));
  });

  it('never over-utilises: no head is paid beyond its liability and no credit beyond what is available', () => {
    fc.assert(fc.property(heads, heads, (l, c) => {
      const r = computeSetoff(l, c);
      const met = liabilityMetBy(r.utilisation);
      for (const k of KEYS) {
        expect(met[k]).toBeLessThanOrEqual(l[k]);
        expect(r.creditUsed[k]).toBeLessThanOrEqual(c[k]);
      }
    }));
  });

  it('respects the order: IGST credit is used up before any CGST or SGST credit, and pays all it can', () => {
    fc.assert(fc.property(heads, heads, (l, c) => {
      const r = computeSetoff(l, c);
      if (r.creditUsed.cgstPaise + r.creditUsed.sgstPaise > 0) expect(r.creditLeft.igstPaise).toBe(0);
      if (r.creditLeft.igstPaise > 0) expect([r.cash.igstPaise, r.cash.cgstPaise, r.cash.sgstPaise]).toEqual([0, 0, 0]);
      if (r.creditLeft.cgstPaise > 0) expect([r.cash.cgstPaise, r.cash.igstPaise]).toEqual([0, 0]);
      if (r.creditLeft.sgstPaise > 0) expect([r.cash.sgstPaise, r.cash.igstPaise]).toEqual([0, 0]);
      if (r.creditLeft.cessPaise > 0) expect(r.cash.cessPaise).toBe(0);
    }));
  });

  it('never needs more cash than the plain statutory sequence', () => {
    fc.assert(fc.property(heads, heads, (l, c) => {
      expect(taxOf(computeSetoff(l, c).cash)).toBeLessThanOrEqual(naiveCash(l, c));
    }));
  });

  it('its journal balances and moves only the tax accounts and GST Payable', () => {
    fc.assert(fc.property(heads, heads, (l, c) => {
      const r = computeSetoff(l, c);
      const lines = buildJournal(GST_SETOFF_RULE, { liability: l, creditUsed: r.creditUsed, cashPaise: taxOf(r.cash) });
      const t = totals(lines);
      expect(t.debit).toBe(t.credit);
      expect(t.debit).toBe(taxOf(l));
      const roles = new Set(lines.map((x) => ('role' in x.account ? x.account.role : x.account.code)));
      for (const role of roles) expect(role).toMatch(/^(output_|input_|gst_payable$)/u);
      expect(taxOf(addHeads(r.creditUsed, r.cash))).toBe(taxOf(l));
    }));
  });

  it('a GST payment moves GST Payable against the bank', () => {
    expect(buildJournal(GST_PAYMENT_RULE, { totalPaise: 12_345 })).toEqual([
      { account: { role: 'gst_payable' }, debitPaise: 12_345, creditPaise: 0 },
      { account: { role: 'bank' }, debitPaise: 0, creditPaise: 12_345 },
    ]);
  });
});
