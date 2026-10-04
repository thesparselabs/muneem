import { AppError, type ReportParams } from '@muneem/contracts';
import { accountLedger, balanceSheet, dayBook, listAccounts, profitAndLoss, type StatementLine } from '@muneem/db-sqlite';
import { branchParam, dateParam, type ReportDefinition, type ReportScope, type Row } from '../definition.js';
import { MAX_ROWS } from '../service.js';
import { col, rangeOf, rangeParams } from './params.js';

const statementColumns = [col('section', 'Section'), col('code', 'Code'), col('name', 'Account'), col('amountPaise', 'Amount', 'money')];
const section = (name: string, lines: readonly StatementLine[]): Row[] => lines.map((l) => ({ section: name, code: l.code || null, name: l.name, amountPaise: l.amountPaise }));
const subtotal = (name: string, amountPaise: number): Row => ({ section: name, code: null, name: null, amountPaise });

export const profitAndLossReport: ReportDefinition = {
  id: 'accounting.profitAndLoss', title: 'Profit and Loss', group: 'Accounts', permission: 'reports.financial', params: rangeParams, columns: statementColumns,
  run: (scope, p) => {
    const r = rangeOf(scope, p);
    const pl = profitAndLoss(scope.db, { businessId: r.businessId, from: r.from, to: r.to, branchId: r.branchId });
    return {
      rows: [...section('Revenue', pl.revenue), ...section('Cost of sales', pl.costOfSales), subtotal('Gross profit', pl.grossProfitPaise),
        ...section('Other income', pl.otherIncome), ...section('Expenses', pl.expenses)],
      totals: subtotal('Net profit', pl.netProfitPaise),
    };
  },
};

export const balanceSheetReport: ReportDefinition = {
  id: 'accounting.balanceSheet', title: 'Balance Sheet', group: 'Accounts', permission: 'reports.financial',
  params: [dateParam('asOf', 'As of', false), branchParam], columns: statementColumns,
  run: ({ db, businessId, today }, p) => {
    const bs = balanceSheet(db, { businessId, to: p.asOf ?? today, branchId: p.branchId ?? null });
    return {
      rows: [...section('Assets', bs.assets), subtotal('Total assets', bs.totalAssetsPaise), ...section('Liabilities', bs.liabilities), ...section('Equity', bs.equity)],
      totals: subtotal('Total liabilities and equity', bs.totalLiabilitiesAndEquityPaise),
    };
  },
};

const ledgerColumns = [
  col('date', 'Date', 'date'), col('entryNo', 'Entry'), col('source', 'Source'), col('narration', 'Narration'),
  col('debitPaise', 'Debit', 'money'), col('creditPaise', 'Credit', 'money'), col('balancePaise', 'Balance', 'money'),
];

function ledgerRows(scope: ReportScope, p: ReportParams, accountId: string) {
  const r = rangeOf(scope, p);
  const page = accountLedger(scope.db, { businessId: r.businessId, accountId, from: r.from, to: r.to, branchId: r.branchId, limit: MAX_ROWS });
  const rows: Row[] = [
    { date: r.from, entryNo: null, source: null, narration: 'Opening balance', debitPaise: null, creditPaise: null, balancePaise: page.openingBalancePaise },
    ...page.items.map((l) => ({
      date: l.date, entryNo: l.entryNo, source: l.source, narration: l.narration, debitPaise: l.debitPaise || null, creditPaise: l.creditPaise || null, balancePaise: l.balancePaise,
    })),
  ];
  const sum = (k: 'debitPaise' | 'creditPaise') => page.items.reduce((s, l) => s + l[k], 0);
  return { rows, totals: { date: null, entryNo: null, source: null, narration: 'Closing balance', debitPaise: sum('debitPaise'), creditPaise: sum('creditPaise'), balancePaise: page.closingBalancePaise } };
}

function accountId(scope: ReportScope, match: (a: { code: string; role: string | null }) => boolean): string {
  const a = listAccounts(scope.db, scope.businessId).find((x) => !x.isGroup && match(x));
  if (!a) throw new AppError('VALIDATION_FAILED', 'No such account', { accountCode: 'not an account code' });
  return a.id;
}

export const generalLedgerReport: ReportDefinition = {
  id: 'accounting.ledger', title: 'General ledger', group: 'Accounts', permission: 'reports.financial', columns: ledgerColumns,
  params: [{ key: 'accountCode', label: 'Account code', kind: 'text', required: true }, ...rangeParams],
  run: (scope, p) => ledgerRows(scope, p, accountId(scope, (a) => a.code === p.accountCode?.trim())),
};

const book = (id: string, title: string, role: 'cash' | 'bank'): ReportDefinition => ({
  id, title, group: 'Accounts', permission: 'reports.financial', params: rangeParams, columns: ledgerColumns,
  run: (scope, p) => ledgerRows(scope, p, accountId(scope, (a) => a.role === role)),
});
export const cashBookReport = book('accounting.cashBook', 'Cash book', 'cash');
export const bankBookReport = book('accounting.bankBook', 'Bank book', 'bank');

const dayBookColumns = [
  col('date', 'Date', 'date'), col('entryNo', 'Entry'), col('source', 'Source'), col('narration', 'Narration'), col('account', 'Account'),
  col('debitPaise', 'Debit', 'money'), col('creditPaise', 'Credit', 'money'),
];
export const dayBookReport: ReportDefinition = {
  id: 'accounting.dayBook', title: 'Day book', group: 'Accounts', permission: 'reports.financial', params: rangeParams, columns: dayBookColumns,
  run: (scope, p) => {
    const r = rangeOf(scope, p);
    const page = dayBook(scope.db, { businessId: r.businessId, from: r.from, to: r.to, branchId: r.branchId, limit: MAX_ROWS });
    const rows: Row[] = page.items.flatMap((e) => e.lines.map((l, i) => ({
      date: i === 0 ? e.date : null, entryNo: i === 0 ? e.entryNo : null, source: i === 0 ? e.source : null, narration: i === 0 ? e.narration : null,
      account: `${l.code} ${l.name}`, debitPaise: l.debitPaise || null, creditPaise: l.creditPaise || null,
    })));
    const sum = (k: 'debitPaise' | 'creditPaise') => rows.reduce((s, x) => s + (typeof x[k] === 'number' ? x[k] : 0), 0);
    return { rows, totals: { date: null, entryNo: null, source: null, narration: null, account: 'Total', debitPaise: sum('debitPaise'), creditPaise: sum('creditPaise') } };
  },
};

export const STATEMENT_REPORTS = [profitAndLossReport, balanceSheetReport, generalLedgerReport, cashBookReport, bankBookReport, dayBookReport];
