import { DomainError } from '../errors.js';
import type { PartyRef } from '../parties/ledger.js';
import type { AccountRole } from './chart.js';

// A rule names an account by role; an expense posts to its category's account, named by code.
export type AccountRef = { role: AccountRole } | { code: string };

export interface JournalLine { account: AccountRef; debitPaise: number; creditPaise: number; party?: PartyRef }

export interface RuleLine<F> {
  side: 'dr' | 'cr';
  account: AccountRef | ((f: F) => AccountRef);
  // May be negative only for signed amounts (round-off, corrections): the line then moves to the other side.
  amount: (f: F) => number;
  when?: (f: F) => boolean;
  party?: (f: F) => PartyRef;
}
export type PostingRule<F> = readonly RuleLine<F>[];

const role = (r: AccountRole): AccountRef => ({ role: r });
export { role as account };

// LLD §5.3: evaluate the rule, drop zero lines, flip negative amounts, and refuse anything that does not balance.
export function buildJournal<F>(rule: PostingRule<F>, facts: F): JournalLine[] {
  const lines: JournalLine[] = [];
  for (const r of rule) {
    if (r.when && !r.when(facts)) continue;
    const amount = r.amount(facts);
    if (!Number.isSafeInteger(amount)) throw new DomainError('INVALID_INPUT', `posting amount must be whole paise, got ${amount}`);
    if (amount === 0) continue;
    const debit = (r.side === 'dr') === amount > 0;
    const paise = Math.abs(amount);
    lines.push({
      account: typeof r.account === 'function' ? r.account(facts) : r.account,
      debitPaise: debit ? paise : 0, creditPaise: debit ? 0 : paise,
      ...(r.party && { party: r.party(facts) }),
    });
  }
  const { debit, credit } = totals(lines);
  if (debit !== credit) throw new DomainError('LEDGER_IMBALANCE', `journal does not balance: debit ${debit}, credit ${credit}`);
  return lines;
}

export function totals(lines: readonly JournalLine[]): { debit: number; credit: number } {
  return lines.reduce((t, l) => ({ debit: t.debit + l.debitPaise, credit: t.credit + l.creditPaise }), { debit: 0, credit: 0 });
}

// Cancellations and manual reversals: the same lines on the other side.
export const reverse = (lines: readonly JournalLine[]): JournalLine[] =>
  lines.map((l) => ({ ...l, debitPaise: l.creditPaise, creditPaise: l.debitPaise }));

// ADR-0031: sale takings other than cash wait in clearing until the acquirer pays; other money moves through the bank.
export const tenderAccount = (method: string): AccountRef => role(method === 'cash' ? 'cash' : 'clearing');
export const paymentAccount = (method: string): AccountRef => role(method === 'cash' ? 'cash' : 'bank');
