import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { closingEntryNo, closingLines, closingRefId, fyEndOf, profitOf, totals, type ClosingBalance } from '../src/index.js';

describe('the closing journal (ADR-0045)', () => {
  it('moves a profit to retained earnings: incomes debited, expenses credited, 3300 credited', () => {
    const lines = closingLines([
      { code: '4100', type: 'income', netPaise: -100_000 }, { code: '5100', type: 'expense', netPaise: 60_000 }, { code: '5400', type: 'expense', netPaise: 0 },
    ]);
    expect(lines).toEqual([
      { account: { code: '4100' }, debitPaise: 100_000, creditPaise: 0 },
      { account: { code: '5100' }, debitPaise: 0, creditPaise: 60_000 },
      { account: { role: 'retained_earnings' }, debitPaise: 0, creditPaise: 40_000 },
    ]);
  });

  it('debits retained earnings with a loss, and closes nothing when nothing is left', () => {
    expect(closingLines([{ code: '5400', type: 'expense', netPaise: 7_000 }]).at(-1)).toEqual({ account: { role: 'retained_earnings' }, debitPaise: 7_000, creditPaise: 0 });
    expect(closingLines([{ code: '4100', type: 'income', netPaise: 0 }])).toEqual([]);
  });

  it('always balances, zeroes every account it names and gives 3300 the profit', () => {
    const balance = fc.record({ code: fc.constantFrom('4100', '4200', '4900', '5100', '5300', '5400'), type: fc.constantFrom('income' as const, 'expense' as const), netPaise: fc.integer({ min: -1e9, max: 1e9 }) });
    fc.assert(fc.property(fc.uniqueArray(balance, { selector: (b) => b.code }), (bs: ClosingBalance[]) => {
      const lines = closingLines(bs);
      const { debit, credit } = totals(lines);
      expect(debit).toBe(credit);
      for (const b of bs) {
        const l = lines.find((x) => 'code' in x.account && x.account.code === b.code);
        expect(b.netPaise + (l ? l.debitPaise - l.creditPaise : 0)).toBe(0);
      }
      const re = lines.find((x) => 'role' in x.account);
      expect(re ? re.creditPaise - re.debitPaise : 0).toBe(profitOf(bs));
    }));
  });

  it('numbers and dates a year close', () => {
    expect(closingEntryNo('2025-26', 1)).toBe('CL/2526');
    expect(closingEntryNo('2025-26', 3)).toBe('CL/2526/3');
    expect(closingRefId('X', 1)).toBe('X');
    expect(closingRefId('X', 2)).toBe('X:2');
    expect(fyEndOf('2025-26')).toBe('2026-03-31');
  });
});
