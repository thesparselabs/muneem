// What a posting rule asks for; the chart maps each role to one account, so a renamed account keeps its postings (ADR-0031).
export const ACCOUNT_ROLES = [
  'cash', 'petty_cash', 'cash_to_classify', 'bank', 'clearing', 'ar', 'inventory',
  'input_cgst', 'input_sgst', 'input_igst', 'input_cess', 'gst_credit',
  'ap', 'output_cgst', 'output_sgst', 'output_igst', 'output_cess', 'gst_payable', 'customer_advances',
  'capital', 'drawings', 'retained_earnings', 'opening_equity',
  'sales_goods', 'sales_services', 'discount_allowed', 'cash_over', 'inventory_gain', 'round_off',
  'cogs', 'purchase_return_loss', 'shrinkage', 'discount_given', 'bad_debts', 'cash_short',
] as const;
export type AccountRole = (typeof ACCOUNT_ROLES)[number];

// ADR-0035: these move only through documents, so their tie-outs with the sub-ledgers always hold.
export const MANUAL_JOURNAL_BLOCKED_ROLES: ReadonlySet<AccountRole> = new Set<AccountRole>([
  'ar', 'ap', 'inventory', 'input_cgst', 'input_sgst', 'input_igst', 'input_cess', 'output_cgst', 'output_sgst', 'output_igst', 'output_cess',
]);

export type AccountType = 'asset' | 'liability' | 'equity' | 'income' | 'expense';
export interface ChartAccount {
  code: string; name: string; type: AccountType; group?: string; role?: AccountRole; isGroup?: boolean;
}

export const normalSide = (t: AccountType): 'debit' | 'credit' => (t === 'asset' || t === 'expense' ? 'debit' : 'credit');

// LLD §5.1 plus ADR-0031: one input and one output account per tax head, opening equity, purchase-return losses,
// bad debts and cash to classify. Groups (1000…5000) are headers nothing posts to.
export const CHART_OF_ACCOUNTS: readonly ChartAccount[] = [
  { code: '1000', name: 'Assets', type: 'asset', isGroup: true },
  { code: '1100', name: 'Cash in Hand', type: 'asset', group: '1000', role: 'cash' },
  { code: '1110', name: 'Petty Cash', type: 'asset', group: '1000', role: 'petty_cash' },
  { code: '1199', name: 'Cash to classify', type: 'asset', group: '1000', role: 'cash_to_classify' },
  { code: '1200', name: 'Bank Accounts', type: 'asset', group: '1000', role: 'bank' },
  { code: '1250', name: 'Card/UPI Settlement Clearing', type: 'asset', group: '1000', role: 'clearing' },
  { code: '1300', name: 'Accounts Receivable', type: 'asset', group: '1000', role: 'ar' },
  { code: '1400', name: 'Inventory', type: 'asset', group: '1000', role: 'inventory' },
  { code: '1510', name: 'Input CGST', type: 'asset', group: '1000', role: 'input_cgst' },
  { code: '1520', name: 'Input SGST/UTGST', type: 'asset', group: '1000', role: 'input_sgst' },
  { code: '1530', name: 'Input IGST', type: 'asset', group: '1000', role: 'input_igst' },
  { code: '1540', name: 'Input Cess', type: 'asset', group: '1000', role: 'input_cess' },
  { code: '1600', name: 'GST Credit Ledger', type: 'asset', group: '1000', role: 'gst_credit' },
  { code: '2000', name: 'Liabilities', type: 'liability', isGroup: true },
  { code: '2100', name: 'Accounts Payable', type: 'liability', group: '2000', role: 'ap' },
  { code: '2210', name: 'Output CGST', type: 'liability', group: '2000', role: 'output_cgst' },
  { code: '2220', name: 'Output SGST/UTGST', type: 'liability', group: '2000', role: 'output_sgst' },
  { code: '2230', name: 'Output IGST', type: 'liability', group: '2000', role: 'output_igst' },
  { code: '2240', name: 'Output Cess', type: 'liability', group: '2000', role: 'output_cess' },
  { code: '2300', name: 'GST Payable', type: 'liability', group: '2000', role: 'gst_payable' },
  { code: '2400', name: 'Advances from Customers', type: 'liability', group: '2000', role: 'customer_advances' },
  { code: '3000', name: 'Equity', type: 'equity', isGroup: true },
  { code: '3100', name: "Owner's Capital", type: 'equity', group: '3000', role: 'capital' },
  { code: '3200', name: 'Drawings', type: 'equity', group: '3000', role: 'drawings' },
  { code: '3300', name: 'Retained Earnings', type: 'equity', group: '3000', role: 'retained_earnings' },
  { code: '3400', name: 'Opening Balance Equity', type: 'equity', group: '3000', role: 'opening_equity' },
  { code: '4000', name: 'Income', type: 'income', isGroup: true },
  { code: '4100', name: 'Sales — Goods', type: 'income', group: '4000', role: 'sales_goods' },
  { code: '4110', name: 'Sales — Services', type: 'income', group: '4000', role: 'sales_services' },
  { code: '4200', name: 'Discount Allowed', type: 'income', group: '4000', role: 'discount_allowed' },
  { code: '4300', name: 'Other Income', type: 'income', group: '4000', role: 'cash_over' },
  { code: '4400', name: 'Inventory Gain', type: 'income', group: '4000', role: 'inventory_gain' },
  { code: '4900', name: 'Round Off', type: 'income', group: '4000', role: 'round_off' },
  { code: '5000', name: 'Expenses', type: 'expense', isGroup: true },
  { code: '5100', name: 'Cost of Goods Sold', type: 'expense', group: '5000', role: 'cogs' },
  { code: '5110', name: 'Purchase-return Losses', type: 'expense', group: '5000', role: 'purchase_return_loss' },
  { code: '5200', name: 'Inventory Shrinkage/Write-off', type: 'expense', group: '5000', role: 'shrinkage' },
  { code: '5300', name: 'Discount Given', type: 'expense', group: '5000', role: 'discount_given' },
  { code: '5400', name: 'Rent', type: 'expense', group: '5000' },
  { code: '5410', name: 'Salaries', type: 'expense', group: '5000' },
  { code: '5420', name: 'Electricity', type: 'expense', group: '5000' },
  { code: '5430', name: 'Transport', type: 'expense', group: '5000' },
  { code: '5440', name: 'Internet', type: 'expense', group: '5000' },
  { code: '5450', name: 'Repairs', type: 'expense', group: '5000' },
  { code: '5460', name: 'Bank Charges', type: 'expense', group: '5000' },
  { code: '5470', name: 'Bad Debts', type: 'expense', group: '5000', role: 'bad_debts' },
  { code: '5900', name: 'Other Expenses', type: 'expense', group: '5000', role: 'cash_short' },
];
