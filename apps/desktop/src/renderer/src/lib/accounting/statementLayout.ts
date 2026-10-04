import type { BalanceSheet, ProfitAndLoss } from '@muneem/contracts';

type Line = { name: string; code: string; amountPaise: number };
export interface Section { title: string; lines: Line[]; totalLabel: string; totalPaise: number }
const total = (xs: readonly { amountPaise: number }[]): number => xs.reduce((s, x) => s + x.amountPaise, 0);

export function profitAndLossSections(p: ProfitAndLoss): { sections: Section[]; grossProfitPaise: number; netProfitPaise: number } {
  return {
    sections: [
      { title: 'Revenue', lines: p.revenue, totalLabel: 'Total revenue', totalPaise: total(p.revenue) },
      { title: 'Cost of sales', lines: p.costOfSales, totalLabel: 'Total cost of sales', totalPaise: total(p.costOfSales) },
      { title: 'Other income', lines: p.otherIncome, totalLabel: 'Total other income', totalPaise: total(p.otherIncome) },
      { title: 'Expenses', lines: p.expenses, totalLabel: 'Total expenses', totalPaise: total(p.expenses) },
    ],
    grossProfitPaise: p.grossProfitPaise, netProfitPaise: p.netProfitPaise,
  };
}

export function balanceSheetSides(b: BalanceSheet): { left: Section[]; right: Section[] } {
  return {
    left: [{ title: 'Assets', lines: b.assets, totalLabel: 'Total assets', totalPaise: b.totalAssetsPaise }],
    right: [
      { title: 'Liabilities', lines: b.liabilities, totalLabel: 'Total liabilities', totalPaise: total(b.liabilities) },
      { title: 'Equity', lines: b.equity, totalLabel: 'Total equity', totalPaise: total(b.equity) },
    ],
  };
}
