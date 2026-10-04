import type { AccountType } from '@muneem/domain';
import type { Db } from '../open.js';
import { stmt } from '../statements.js';

export interface StatementFilter { businessId: string; from?: string | null; to: string; branchId?: string | null }
export interface AccountAmount { accountId: string; code: string; name: string; type: AccountType; role: string | null; debitPaise: number; creditPaise: number }

// Σ of each account's lines whose entry falls in the range (from open-ended = since the beginning).
export function accountTotals(db: Db, f: StatementFilter): AccountAmount[] {
  return stmt(db, `SELECT a.id AS accountId, a.code, a.name, a.type, a.role, COALESCE(SUM(l.debit_paise), 0) AS debitPaise, COALESCE(SUM(l.credit_paise), 0) AS creditPaise
    FROM journal_line l JOIN journal_entry j ON j.id = l.entry_id JOIN account a ON a.id = l.account_id
    WHERE j.business_id = @businessId AND j.entry_date <= @to AND (@from IS NULL OR j.entry_date >= @from) AND (@branchId IS NULL OR j.branch_id = @branchId)
    GROUP BY a.id ORDER BY a.code`).all({ businessId: f.businessId, from: f.from ?? null, to: f.to, branchId: f.branchId ?? null }) as AccountAmount[];
}

export interface TrialBalanceRow { accountId: string; code: string; name: string; type: AccountType; debitPaise: number; creditPaise: number }
export function trialBalance(db: Db, f: StatementFilter): { rows: TrialBalanceRow[]; debitPaise: number; creditPaise: number; balanced: boolean } {
  const rows = accountTotals(db, { ...f, from: null }).flatMap((a): TrialBalanceRow[] => {
    const net = a.debitPaise - a.creditPaise;
    return net === 0 ? [] : [{ accountId: a.accountId, code: a.code, name: a.name, type: a.type, debitPaise: Math.max(net, 0), creditPaise: Math.max(-net, 0) }];
  });
  const debitPaise = rows.reduce((s, r) => s + r.debitPaise, 0);
  const creditPaise = rows.reduce((s, r) => s + r.creditPaise, 0);
  return { rows, debitPaise, creditPaise, balanced: debitPaise === creditPaise };
}

export interface StatementLine { accountId: string; code: string; name: string; amountPaise: number }
const income = (a: AccountAmount): number => a.creditPaise - a.debitPaise;
const expense = (a: AccountAmount): number => a.debitPaise - a.creditPaise;
const line = (a: AccountAmount, amountPaise: number): StatementLine => ({ accountId: a.accountId, code: a.code, name: a.name, amountPaise });
const sum = (xs: readonly StatementLine[]): number => xs.reduce((s, x) => s + x.amountPaise, 0);

// Revenue is 41xx/42xx and cost of sales 51xx, which gives gross profit; everything else is other income or expense.
export interface ProfitAndLoss {
  revenue: StatementLine[]; costOfSales: StatementLine[]; grossProfitPaise: number; otherIncome: StatementLine[]; expenses: StatementLine[]; netProfitPaise: number;
}
export function profitAndLoss(db: Db, f: StatementFilter): ProfitAndLoss {
  const totals = accountTotals(db, f);
  const pick = (type: AccountType, test: (code: string) => boolean, value: (a: AccountAmount) => number) =>
    totals.filter((a) => a.type === type && test(a.code)).map((a) => line(a, value(a))).filter((l) => l.amountPaise !== 0);
  const revenue = pick('income', (c) => c.startsWith('41') || c.startsWith('42'), income);
  const otherIncome = pick('income', (c) => !(c.startsWith('41') || c.startsWith('42')), income);
  const costOfSales = pick('expense', (c) => c.startsWith('51'), expense);
  const expenses = pick('expense', (c) => !c.startsWith('51'), expense);
  const grossProfitPaise = sum(revenue) - sum(costOfSales);
  return { revenue, costOfSales, grossProfitPaise, otherIncome, expenses, netProfitPaise: grossProfitPaise + sum(otherIncome) - sum(expenses) };
}

export const fyStartOf = (date: string): string => {
  const y = Number(date.slice(0, 4));
  return `${Number(date.slice(5, 7)) >= 4 ? y : y - 1}-04-01`;
};

const dayBefore = (date: string): string => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
};

// Party balances on a control account, split by sign, so customers' advances and suppliers' debits are presented apart (ADR-0032).
function partySplit(db: Db, f: StatementFilter, role: 'ar' | 'ap'): { debitSide: number; creditSide: number } {
  const rows = stmt(db, `SELECT SUM(l.debit_paise - l.credit_paise) AS net FROM journal_line l JOIN journal_entry j ON j.id = l.entry_id JOIN account a ON a.id = l.account_id
    WHERE j.business_id = @businessId AND a.role = @role AND j.entry_date <= @to AND (@branchId IS NULL OR j.branch_id = @branchId)
    GROUP BY COALESCE(l.party_id, '')`).pluck().all({ businessId: f.businessId, role, to: f.to, branchId: f.branchId ?? null }) as number[];
  return { debitSide: rows.filter((n) => n > 0).reduce((s, n) => s + n, 0), creditSide: -rows.filter((n) => n < 0).reduce((s, n) => s + n, 0) };
}

export interface BalanceSheet {
  assets: StatementLine[]; liabilities: StatementLine[]; equity: StatementLine[];
  retainedEarningsPaise: number; currentProfitPaise: number; totalAssetsPaise: number; totalLiabilitiesAndEquityPaise: number; balanced: boolean;
}
export function balanceSheet(db: Db, f: StatementFilter): BalanceSheet {
  const totals = accountTotals(db, { ...f, from: null });
  const fyStart = fyStartOf(f.to);
  const retained = profitAndLoss(db, { ...f, from: null, to: dayBefore(fyStart) }).netProfitPaise;
  const current = profitAndLoss(db, { ...f, from: fyStart }).netProfitPaise;
  const ar = partySplit(db, f, 'ar');
  const ap = partySplit(db, f, 'ap');
  const assets: StatementLine[] = [];
  const liabilities: StatementLine[] = [];
  for (const a of totals) {
    if (a.role === 'ar') {
      assets.push(line(a, ar.debitSide));
      if (ar.creditSide) liabilities.push({ accountId: a.accountId, code: a.code, name: 'Advances from customers', amountPaise: ar.creditSide });
    } else if (a.role === 'ap') {
      liabilities.push(line(a, ap.creditSide));
      if (ap.debitSide) assets.push({ accountId: a.accountId, code: a.code, name: 'Advances to suppliers', amountPaise: ap.debitSide });
    } else if (a.type === 'asset') assets.push(line(a, expense(a)));
    else if (a.type === 'liability') liabilities.push(line(a, income(a)));
  }
  const equity = totals.filter((a) => a.type === 'equity').map((a) => line(a, income(a)));
  equity.push({ accountId: '', code: '', name: 'Retained earnings (earlier years)', amountPaise: retained });
  equity.push({ accountId: '', code: '', name: 'Profit for the year', amountPaise: current });
  const clean = (xs: StatementLine[]) => xs.filter((x) => x.amountPaise !== 0);
  const totalAssetsPaise = sum(assets);
  const totalLiabilitiesAndEquityPaise = sum(liabilities) + sum(equity);
  return {
    assets: clean(assets), liabilities: clean(liabilities), equity: clean(equity), retainedEarningsPaise: retained, currentProfitPaise: current,
    totalAssetsPaise, totalLiabilitiesAndEquityPaise, balanced: totalAssetsPaise === totalLiabilitiesAndEquityPaise,
  };
}

type Cursor = { d: string; e: string; n: number };
const encode = (c: Cursor): string => Buffer.from(JSON.stringify(c)).toString('base64url');
function decode(s: string | undefined): Cursor | null {
  if (!s) return null;
  try { return JSON.parse(Buffer.from(s, 'base64url').toString('utf8')) as Cursor; } catch { return null; }
}

export interface LedgerLineRow {
  entryId: string; entryNo: string; date: string; source: string; refType: string | null; refId: string | null; narration: string | null;
  partyType: string | null; partyId: string | null; debitPaise: number; creditPaise: number; balancePaise: number;
}
// An account's lines in date order with a running balance (debit minus credit), keyset-paged (FR-054 general ledger).
export function accountLedger(db: Db, f: StatementFilter & { accountId: string; limit: number; cursor?: string | undefined }) {
  const after = decode(f.cursor);
  const params = { businessId: f.businessId, accountId: f.accountId, from: f.from ?? null, to: f.to, branchId: f.branchId ?? null };
  const net = (cond: string) => stmt(db, `SELECT COALESCE(SUM(l.debit_paise - l.credit_paise), 0) FROM journal_line l JOIN journal_entry j ON j.id = l.entry_id
    WHERE j.business_id = @businessId AND l.account_id = @accountId AND (@branchId IS NULL OR j.branch_id = @branchId) AND ${cond}`).pluck().get(params) as number;
  const rows = stmt(db, `SELECT * FROM (
      SELECT j.id AS entryId, j.entry_no AS entryNo, j.entry_date AS date, j.source, j.ref_type AS refType, j.ref_id AS refId, j.narration, l.line_no AS n,
        l.party_type AS partyType, l.party_id AS partyId, l.debit_paise AS debitPaise, l.credit_paise AS creditPaise,
        SUM(l.debit_paise - l.credit_paise) OVER (ORDER BY j.entry_date, j.id, l.line_no) AS balancePaise
      FROM journal_line l JOIN journal_entry j ON j.id = l.entry_id
      WHERE j.business_id = @businessId AND l.account_id = @accountId AND (@branchId IS NULL OR j.branch_id = @branchId) AND j.entry_date <= @to)
    WHERE (@from IS NULL OR date >= @from) AND (@ad IS NULL OR (date, entryId, n) > (@ad, @ae, @an))
    ORDER BY date, entryId, n LIMIT @limit`).all({ ...params, ad: after?.d ?? null, ae: after?.e ?? null, an: after?.n ?? null, limit: f.limit + 1 }) as (LedgerLineRow & { n: number })[];
  const page = rows.slice(0, f.limit);
  const last = page.at(-1);
  return {
    openingBalancePaise: f.from ? net('j.entry_date < @from') : 0,
    items: page as LedgerLineRow[],
    closingBalancePaise: net('j.entry_date <= @to'),
    nextCursor: rows.length > f.limit && last ? encode({ d: last.date, e: last.entryId, n: last.n }) : null,
  };
}

export interface DayBookEntry {
  id: string; entryNo: string; date: string; docDate: string; source: string; refType: string | null; refId: string | null; narration: string | null;
  latePosting: boolean; reversalOf: string | null; lines: { code: string; name: string; debitPaise: number; creditPaise: number; partyType: string | null; partyId: string | null }[];
}
export function dayBook(db: Db, f: StatementFilter & { limit: number; cursor?: string | undefined }) {
  const after = decode(f.cursor);
  const entries = stmt(db, `SELECT id, entry_no AS entryNo, entry_date AS date, doc_date AS docDate, source, ref_type AS refType, ref_id AS refId, narration,
      late_posting AS late, is_reversal_of AS reversalOf FROM journal_entry
    WHERE business_id = @businessId AND entry_date <= @to AND (@from IS NULL OR entry_date >= @from) AND (@branchId IS NULL OR branch_id = @branchId)
      AND (@ad IS NULL OR (entry_date, id) > (@ad, @ae))
    ORDER BY entry_date, id LIMIT @limit`).all({ businessId: f.businessId, from: f.from ?? null, to: f.to, branchId: f.branchId ?? null,
    ad: after?.d ?? null, ae: after?.e ?? null, limit: f.limit + 1 }) as (Omit<DayBookEntry, 'lines' | 'latePosting'> & { late: number })[];
  const page = entries.slice(0, f.limit);
  const lines = stmt(db, `SELECT a.code, a.name, l.debit_paise AS debitPaise, l.credit_paise AS creditPaise, l.party_type AS partyType, l.party_id AS partyId
    FROM journal_line l JOIN account a ON a.id = l.account_id WHERE l.entry_id = ? ORDER BY l.line_no`);
  const last = page.at(-1);
  return {
    items: page.map(({ late, ...e }): DayBookEntry => ({ ...e, latePosting: late === 1, lines: lines.all(e.id) as DayBookEntry['lines'] })),
    nextCursor: entries.length > f.limit && last ? encode({ d: last.date, e: last.id, n: 0 }) : null,
  };
}
