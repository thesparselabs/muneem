import { describe, expect, it } from 'vitest';
import type { AccountView, BalanceSheet, ProfitAndLoss } from '@muneem/contracts';
import { checkJournal, emptyRows, postableAccounts, toJournalInput } from '../../src/renderer/src/lib/accounting/journalForm.js';
import { balanceSheetSides, profitAndLossSections } from '../../src/renderer/src/lib/accounting/statementLayout.js';
import { chartTree, normalBalance } from '../../src/renderer/src/lib/accounting/chartTree.js';

const acct = (over: Partial<AccountView>): AccountView => ({
  id: '01J000000000000000000ACCT1', code: '1100', name: 'Cash', type: 'asset', role: null, parentId: null, isGroup: false, isSystem: true, balancePaise: 0, ...over,
});

describe('manual journal form', () => {
  it('offers neither control accounts nor groups', () => {
    const list = [acct({ code: '1000', isGroup: true }), acct({ code: '1100', role: 'cash' }), acct({ code: '1300', role: 'ar' }), acct({ code: '1510', role: 'input_cgst' }), acct({ code: '5400' })];
    expect(postableAccounts(list).map((a) => a.code)).toEqual(['1100', '5400']);
  });

  it('shows the running difference and is ready only when it balances', () => {
    const rows = [{ accountId: 'A', debit: '98', credit: '' }, { accountId: 'B', debit: '2', credit: '' }, { accountId: 'C', debit: '', credit: '99' }];
    expect(checkJournal(rows, 'Settlement')).toMatchObject({ debitPaise: 10_000, creditPaise: 9900, differencePaise: 100, ready: false });
    rows[2]!.credit = '100';
    expect(checkJournal(rows, 'Settlement')).toMatchObject({ differencePaise: 0, ready: true, errors: {} });
    expect(toJournalInput(rows, ' Settlement ', '2026-10-04', 'CMD').lines).toEqual([
      { accountId: 'A', debitPaise: 9800, creditPaise: 0 }, { accountId: 'B', debitPaise: 200, creditPaise: 0 }, { accountId: 'C', debitPaise: 0, creditPaise: 10_000 },
    ]);
  });

  it('names each problem', () => {
    const rows = [{ accountId: '', debit: '5', credit: '' }, { accountId: 'B', debit: '5', credit: '5' }, ...emptyRows()];
    expect(checkJournal(rows, '').errors).toEqual({ '0.accountId': 'choose an account', 1: 'a debit or a credit', narration: 'say what it is for' });
  });
});

describe('statement layout', () => {
  it('builds P&L sections with their totals', () => {
    const p = {
      from: '2026-04-01', to: '2026-10-04', revenue: [{ accountId: 'a', code: '4100', name: 'Sales', amountPaise: 30_000 }],
      costOfSales: [{ accountId: 'b', code: '5100', name: 'COGS', amountPaise: 21_000 }], grossProfitPaise: 9000, otherIncome: [],
      expenses: [{ accountId: 'c', code: '5400', name: 'Rent', amountPaise: 2000 }, { accountId: 'd', code: '5440', name: 'Internet', amountPaise: 1000 }], netProfitPaise: 6000,
    } as ProfitAndLoss;
    const l = profitAndLossSections(p);
    expect(l.sections.map((s) => [s.title, s.totalPaise])).toEqual([['Revenue', 30_000], ['Cost of sales', 21_000], ['Other income', 0], ['Expenses', 3000]]);
    expect(l).toMatchObject({ grossProfitPaise: 9000, netProfitPaise: 6000 });
  });

  it('puts assets on one side and liabilities with equity on the other', () => {
    const b = {
      asOf: '2026-10-04', assets: [{ accountId: 'a', code: '1100', name: 'Cash', amountPaise: 10_000 }],
      liabilities: [{ accountId: 'b', code: '2100', name: 'Payables', amountPaise: 4000 }],
      equity: [{ accountId: '', code: '', name: 'Profit for the year', amountPaise: 6000 }], retainedEarningsPaise: 0, currentProfitPaise: 6000,
      totalAssetsPaise: 10_000, totalLiabilitiesAndEquityPaise: 10_000, balanced: true,
    } as BalanceSheet;
    const s = balanceSheetSides(b);
    expect([s.left[0]!.totalPaise, s.right.map((x) => x.totalPaise)]).toEqual([10_000, [4000, 6000]]);
  });
});

describe('chart tree', () => {
  it('groups accounts under their header with totals in the normal direction', () => {
    const assets = acct({ id: '01J0000000000000000000GRP1', code: '1000', name: 'Assets', isGroup: true });
    const liab = acct({ id: '01J0000000000000000000GRP2', code: '2000', name: 'Liabilities', type: 'liability', isGroup: true });
    const cash = acct({ code: '1100', parentId: assets.id, balancePaise: 5000 });
    const ap = acct({ code: '2100', type: 'liability', parentId: liab.id, balancePaise: -3000 });
    expect(chartTree([assets, liab, cash, ap]).map((g) => [g.group.code, g.accounts.length, g.totalPaise])).toEqual([['1000', 1, 5000], ['2000', 1, 3000]]);
    expect(normalBalance(ap)).toBe(3000);
  });
});
