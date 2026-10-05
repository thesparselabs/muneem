import { DomainError } from '../errors.js';
import { fyBounds } from '../fy.js';
import type { JournalLine } from './journal.js';

// An income or expense account's movement over a financial year, debit minus credit.
export interface ClosingBalance { code: string; type: 'income' | 'expense'; netPaise: number }

export const fyShort = (fy: string): string => `${fy.slice(2, 4)}${fy.slice(5, 7)}`;

// ADR-0045: business-level numbers, since the cloud lets only one close (and its adjustments, in turn) exist per year.
export const closingEntryNo = (fy: string, seq: number): string => (seq === 1 ? `CL/${fyShort(fy)}` : `CL/${fyShort(fy)}/${seq}`);

export const closingRefId = (closeId: string, seq: number): string => (seq === 1 ? closeId : `${closeId}:${seq}`);

export const fyEndOf = (fy: string): string => fyBounds(fy).end;

// Each balance to zero, the difference to 3300 Retained Earnings: profit credits it, a loss debits it. Empty when nothing is left to close.
export function closingLines(balances: readonly ClosingBalance[]): JournalLine[] {
  const lines: JournalLine[] = [];
  let net = 0;
  for (const b of [...balances].sort((x, y) => x.code.localeCompare(y.code))) {
    if (!Number.isSafeInteger(b.netPaise)) throw new DomainError('INVALID_INPUT', `balance of ${b.code} must be whole paise`);
    if (b.netPaise === 0) continue;
    net += b.netPaise;
    lines.push({ account: { code: b.code }, debitPaise: Math.max(-b.netPaise, 0), creditPaise: Math.max(b.netPaise, 0) });
  }
  if (lines.length === 0) return [];
  if (net !== 0) lines.push({ account: { role: 'retained_earnings' }, debitPaise: Math.max(net, 0), creditPaise: Math.max(-net, 0) });
  return lines;
}

export const profitOf = (balances: readonly ClosingBalance[]): number => balances.reduce((s, b) => s - b.netPaise, 0);
