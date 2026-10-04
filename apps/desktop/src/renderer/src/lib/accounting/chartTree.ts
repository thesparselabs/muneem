import type { AccountView } from '@muneem/contracts';

export interface ChartGroup { group: AccountView; accounts: AccountView[]; totalPaise: number }

// Accounts under their header; a group's total is in its normal direction (assets and expenses as debits, the rest as credits).
export function chartTree(accounts: readonly AccountView[]): ChartGroup[] {
  return accounts.filter((a) => a.isGroup).map((group) => {
    const children = accounts.filter((a) => a.parentId === group.id);
    const sign = group.type === 'asset' || group.type === 'expense' ? 1 : -1;
    return { group, accounts: children, totalPaise: sign * children.reduce((s, a) => s + a.balancePaise, 0) };
  });
}

// A balance shown in the account's normal direction, so a liability reads as a positive amount owed.
export const normalBalance = (a: AccountView): number => (a.type === 'asset' || a.type === 'expense' ? a.balancePaise : -a.balancePaise);
