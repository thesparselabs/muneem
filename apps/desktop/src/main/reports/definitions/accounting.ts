import { trialBalance } from '@muneem/db-sqlite';
import { branchParam, dateParam, type ReportDefinition } from '../definition.js';

export const trialBalanceReport: ReportDefinition = {
  id: 'accounting.trialBalance', title: 'Trial Balance', group: 'Accounts', permission: 'reports.financial',
  params: [dateParam('asOf', 'As of', false), branchParam],
  columns: [
    { key: 'code', label: 'Code', kind: 'text' }, { key: 'name', label: 'Account', kind: 'text' },
    { key: 'debitPaise', label: 'Debit', kind: 'money' }, { key: 'creditPaise', label: 'Credit', kind: 'money' },
  ],
  run: ({ db, businessId, today }, p) => {
    const tb = trialBalance(db, { businessId, to: p.asOf ?? today, branchId: p.branchId ?? null });
    return {
      rows: tb.rows.map((r) => ({ code: r.code, name: r.name, debitPaise: r.debitPaise, creditPaise: r.creditPaise })),
      totals: { code: null, name: 'Total', debitPaise: tb.debitPaise, creditPaise: tb.creditPaise },
    };
  },
};
