import type { AccountView, ManualJournalInput } from '@muneem/contracts';
import { parseOptional } from '../money.js';

// ADR-0035: these change only through documents, so the form never offers them.
const CONTROL_ROLES = new Set(['ar', 'ap', 'inventory', 'input_cgst', 'input_sgst', 'input_igst', 'input_cess', 'output_cgst', 'output_sgst', 'output_igst', 'output_cess']);
export const postableAccounts = (accounts: readonly AccountView[]): AccountView[] =>
  accounts.filter((a) => !a.isGroup && !(a.role && CONTROL_ROLES.has(a.role)));

export interface JournalRow { accountId: string; debit: string; credit: string }
export const emptyRows = (): JournalRow[] => [{ accountId: '', debit: '', credit: '' }, { accountId: '', debit: '', credit: '' }];

export interface JournalCheck { debitPaise: number; creditPaise: number; differencePaise: number; errors: Record<string, string>; ready: boolean }

// The running totals and what still stops posting, shown before the user presses Post.
export function checkJournal(rows: readonly JournalRow[], narration: string): JournalCheck {
  const errors: Record<string, string> = {};
  let debitPaise = 0;
  let creditPaise = 0;
  const used = rows.filter((r) => r.accountId || r.debit.trim() || r.credit.trim());
  used.forEach((r) => {
    const i = rows.indexOf(r);
    const dr = parseOptional(r.debit, 2);
    const cr = parseOptional(r.credit, 2);
    if (!r.accountId) errors[`${i}.accountId`] = 'choose an account';
    if (dr === null || cr === null || (dr ?? 0) < 0 || (cr ?? 0) < 0) errors[`${i}`] = 'not an amount';
    else if (!!dr === !!cr) errors[`${i}`] = 'a debit or a credit';
    debitPaise += dr && dr > 0 ? dr : 0;
    creditPaise += cr && cr > 0 ? cr : 0;
  });
  if (used.length < 2) errors.lines = 'at least two lines';
  if (!narration.trim()) errors.narration = 'say what it is for';
  const differencePaise = debitPaise - creditPaise;
  return { debitPaise, creditPaise, differencePaise, errors, ready: Object.keys(errors).length === 0 && differencePaise === 0 && debitPaise > 0 };
}

export function toJournalInput(rows: readonly JournalRow[], narration: string, date: string, commandId: string): ManualJournalInput {
  return {
    date, narration: narration.trim(), commandId,
    lines: rows.filter((r) => r.accountId).map((r) => ({ accountId: r.accountId, debitPaise: parseOptional(r.debit, 2) ?? 0, creditPaise: parseOptional(r.credit, 2) ?? 0 })),
  };
}
