import { account, paymentAccount, type AccountRef, type PostingRule } from './journal.js';

// Tax split by head; UTGST shares the SGST accounts (the arithmetic is identical, LLD §3).
export interface TaxHeads { cgstPaise: number; sgstPaise: number; igstPaise: number; cessPaise: number }
const outputTax = <F extends { tax: TaxHeads }>(): PostingRule<F> => [
  { side: 'cr', account: account('output_cgst'), amount: (f) => f.tax.cgstPaise },
  { side: 'cr', account: account('output_sgst'), amount: (f) => f.tax.sgstPaise },
  { side: 'cr', account: account('output_igst'), amount: (f) => f.tax.igstPaise },
  { side: 'cr', account: account('output_cess'), amount: (f) => f.tax.cessPaise },
];
const inputTax = <F>(side: 'dr' | 'cr', heads: (f: F) => TaxHeads): PostingRule<F> => [
  { side, account: account('input_cgst'), amount: (f) => heads(f).cgstPaise },
  { side, account: account('input_sgst'), amount: (f) => heads(f).sgstPaise },
  { side, account: account('input_igst'), amount: (f) => heads(f).igstPaise },
  { side, account: account('input_cess'), amount: (f) => heads(f).cessPaise },
];

// Sale (LLD §5.2): takings net of change by account, the credit portion to the customer, revenue net of discount.
export interface SaleFacts {
  cashPaise: number; clearingPaise: number; creditPaise: number; customerId: string | null;
  taxablePaise: number; tax: TaxHeads; roundOffPaise: number; cogsPaise: number;
}
export const SALE_RULE: PostingRule<SaleFacts> = [
  { side: 'dr', account: account('cash'), amount: (f) => f.cashPaise },
  { side: 'dr', account: account('clearing'), amount: (f) => f.clearingPaise },
  { side: 'dr', account: account('ar'), amount: (f) => f.creditPaise, party: (f) => ({ partyType: 'customer', partyId: f.customerId! }) },
  { side: 'cr', account: account('sales_goods'), amount: (f) => f.taxablePaise },
  ...outputTax<SaleFacts>(),
  { side: 'cr', account: account('round_off'), amount: (f) => f.roundOffPaise },
  { side: 'dr', account: account('cogs'), amount: (f) => f.cogsPaise },
  { side: 'cr', account: account('inventory'), amount: (f) => f.cogsPaise },
];

// Sale return (ADR-0043): the sale's lines for the returned part on the other side — revenue, output tax and round-off
// reversed, the refund paid from cash or clearing or credited to the customer, and the goods back in stock at what they cost.
export interface SaleReturnFacts {
  cashPaise: number; clearingPaise: number; creditPaise: number; customerId: string | null;
  taxablePaise: number; tax: TaxHeads; roundOffPaise: number; costPaise: number;
}
export const SALE_RETURN_RULE: PostingRule<SaleReturnFacts> = [
  { side: 'dr', account: account('sales_goods'), amount: (f) => f.taxablePaise },
  { side: 'dr', account: account('output_cgst'), amount: (f) => f.tax.cgstPaise },
  { side: 'dr', account: account('output_sgst'), amount: (f) => f.tax.sgstPaise },
  { side: 'dr', account: account('output_igst'), amount: (f) => f.tax.igstPaise },
  { side: 'dr', account: account('output_cess'), amount: (f) => f.tax.cessPaise },
  { side: 'dr', account: account('round_off'), amount: (f) => f.roundOffPaise },
  { side: 'cr', account: account('cash'), amount: (f) => f.cashPaise },
  { side: 'cr', account: account('clearing'), amount: (f) => f.clearingPaise },
  { side: 'cr', account: account('ar'), amount: (f) => f.creditPaise, party: (f) => ({ partyType: 'customer', partyId: f.customerId! }) },
  { side: 'dr', account: account('inventory'), amount: (f) => f.costPaise },
  { side: 'cr', account: account('cogs'), amount: (f) => f.costPaise },
];

// Purchase (LLD §5.2, ADR-0023): stock at landed cost, claimable tax by head, the bill total owed to the supplier.
export interface PurchaseFacts { supplierId: string; inventoryPaise: number; itc: TaxHeads; roundOffPaise: number; totalPaise: number }
export const PURCHASE_RULE: PostingRule<PurchaseFacts> = [
  { side: 'dr', account: account('inventory'), amount: (f) => f.inventoryPaise },
  ...inputTax<PurchaseFacts>('dr', (f) => f.itc),
  { side: 'dr', account: account('round_off'), amount: (f) => f.roundOffPaise },
  { side: 'cr', account: account('ap'), amount: (f) => f.totalPaise, party: (f) => ({ partyType: 'supplier', partyId: f.supplierId }) },
];

// Debit note (ADR-0024): goods back at their landed cost, claimed tax reversed; freight the supplier keeps is a loss.
export interface DebitNoteFacts {
  supplierId: string; totalPaise: number; inventoryPaise: number; itcReversed: TaxHeads; lossPaise: number; roundOffPaise: number;
}
export const DEBIT_NOTE_RULE: PostingRule<DebitNoteFacts> = [
  { side: 'dr', account: account('ap'), amount: (f) => f.totalPaise, party: (f) => ({ partyType: 'supplier', partyId: f.supplierId }) },
  { side: 'dr', account: account('purchase_return_loss'), amount: (f) => f.lossPaise },
  { side: 'cr', account: account('inventory'), amount: (f) => f.inventoryPaise },
  ...inputTax<DebitNoteFacts>('cr', (f) => f.itcReversed),
  { side: 'cr', account: account('round_off'), amount: (f) => f.roundOffPaise },
];

// Receipts post wholly to AR, so an advance is a credit balance on the customer (ADR-0032).
export interface PaymentFacts { partyType: 'customer' | 'supplier'; partyId: string; method: string; amountPaise: number }
export const RECEIPT_RULE: PostingRule<PaymentFacts> = [
  { side: 'dr', account: (f) => paymentAccount(f.method), amount: (f) => f.amountPaise },
  { side: 'cr', account: account('ar'), amount: (f) => f.amountPaise, party: (f) => ({ partyType: 'customer', partyId: f.partyId }) },
];
export const SUPPLIER_PAYMENT_RULE: PostingRule<PaymentFacts> = [
  { side: 'dr', account: account('ap'), amount: (f) => f.amountPaise, party: (f) => ({ partyType: 'supplier', partyId: f.partyId }) },
  { side: 'cr', account: (f) => paymentAccount(f.method), amount: (f) => f.amountPaise },
];

export interface WriteOffFacts { customerId: string; amountPaise: number }
export const WRITE_OFF_RULE: PostingRule<WriteOffFacts> = [
  { side: 'dr', account: account('bad_debts'), amount: (f) => f.amountPaise },
  { side: 'cr', account: account('ar'), amount: (f) => f.amountPaise, party: (f) => ({ partyType: 'customer', partyId: f.customerId }) },
];

// Expense: its category's account takes the amount and any tax that cannot be claimed.
export interface ExpenseFacts {
  expenseAccount: AccountRef; method: string; supplierId: string | null; expensePaise: number; itc: TaxHeads; roundOffPaise: number; totalPaise: number;
}
export const EXPENSE_RULE: PostingRule<ExpenseFacts> = [
  { side: 'dr', account: (f) => f.expenseAccount, amount: (f) => f.expensePaise },
  ...inputTax<ExpenseFacts>('dr', (f) => f.itc),
  { side: 'dr', account: account('round_off'), amount: (f) => f.roundOffPaise },
  { side: 'cr', account: (f) => paymentAccount(f.method), amount: (f) => f.totalPaise, when: (f) => f.method !== 'credit' },
  {
    side: 'cr', account: account('ap'), amount: (f) => f.totalPaise, when: (f) => f.method === 'credit',
    party: (f) => ({ partyType: 'supplier', partyId: f.supplierId! }),
  },
];

// Stock documents post the movements' values: Σ movement values is the inventory sub-ledger (ADR-0018).
export interface OpeningStockFacts { valuePaise: number }
export const OPENING_STOCK_RULE: PostingRule<OpeningStockFacts> = [
  { side: 'dr', account: account('inventory'), amount: (f) => f.valuePaise },
  { side: 'cr', account: account('opening_equity'), amount: (f) => f.valuePaise },
];
export interface StockAdjustmentFacts { lossPaise: number; gainPaise: number }
export const STOCK_ADJUSTMENT_RULE: PostingRule<StockAdjustmentFacts> = [
  { side: 'dr', account: account('shrinkage'), amount: (f) => f.lossPaise },
  { side: 'cr', account: account('inventory'), amount: (f) => f.lossPaise },
  { side: 'dr', account: account('inventory'), amount: (f) => f.gainPaise },
  { side: 'cr', account: account('inventory_gain'), amount: (f) => f.gainPaise },
];
// A cost correction's value is signed: positive raises inventory and lowers COGS.
export interface CostCorrectionFacts { valuePaise: number }
export const COST_CORRECTION_RULE: PostingRule<CostCorrectionFacts> = [
  { side: 'dr', account: account('inventory'), amount: (f) => f.valuePaise },
  { side: 'cr', account: account('cogs'), amount: (f) => f.valuePaise },
];

// Party opening: signed so that positive means the party owes the business (ADR-0022).
export interface PartyOpeningFacts { partyType: 'customer' | 'supplier'; partyId: string; signedPaise: number }
export const PARTY_OPENING_RULE: PostingRule<PartyOpeningFacts> = [
  {
    side: 'dr', account: (f) => account(f.partyType === 'customer' ? 'ar' : 'ap'), amount: (f) => f.signedPaise,
    party: (f) => ({ partyType: f.partyType, partyId: f.partyId }),
  },
  { side: 'cr', account: account('opening_equity'), amount: (f) => f.signedPaise },
];

// Register close: counted − expected. Over goes to other income, short to other expenses (LLD §5.2).
export interface RegisterVarianceFacts { variancePaise: number }
export const REGISTER_VARIANCE_RULE: PostingRule<RegisterVarianceFacts> = [
  { side: 'dr', account: account('cash'), amount: (f) => f.variancePaise, when: (f) => f.variancePaise > 0 },
  { side: 'cr', account: account('cash_over'), amount: (f) => f.variancePaise, when: (f) => f.variancePaise > 0 },
  { side: 'dr', account: account('cash_short'), amount: (f) => -f.variancePaise, when: (f) => f.variancePaise < 0 },
  { side: 'cr', account: account('cash'), amount: (f) => -f.variancePaise, when: (f) => f.variancePaise < 0 },
];

// GST set-off (ADR-0044): each output head is cleared in full — by the input credit used against it, the rest to GST
// Payable; input tax leaves only by the credit used. No party, stock or receivable account is touched (ADR-0035).
export interface GstSetoffFacts { liability: TaxHeads; creditUsed: TaxHeads; cashPaise: number }
export const GST_SETOFF_RULE: PostingRule<GstSetoffFacts> = [
  { side: 'dr', account: account('output_igst'), amount: (f) => f.liability.igstPaise },
  { side: 'dr', account: account('output_cgst'), amount: (f) => f.liability.cgstPaise },
  { side: 'dr', account: account('output_sgst'), amount: (f) => f.liability.sgstPaise },
  { side: 'dr', account: account('output_cess'), amount: (f) => f.liability.cessPaise },
  ...inputTax<GstSetoffFacts>('cr', (f) => f.creditUsed),
  { side: 'cr', account: account('gst_payable'), amount: (f) => f.cashPaise },
];

// GST paid by challan clears GST Payable from the bank.
export interface GstPaymentFacts { totalPaise: number }
export const GST_PAYMENT_RULE: PostingRule<GstPaymentFacts> = [
  { side: 'dr', account: account('gst_payable'), amount: (f) => f.totalPaise },
  { side: 'cr', account: account('bank'), amount: (f) => f.totalPaise },
];

// Cash put into or taken out of the drawer without a document: the accountant classifies it later (ADR-0032).
export interface CashMovementFacts { direction: 'in' | 'out'; amountPaise: number }
export const CASH_MOVEMENT_RULE: PostingRule<CashMovementFacts> = [
  { side: 'dr', account: account('cash'), amount: (f) => (f.direction === 'in' ? f.amountPaise : -f.amountPaise) },
  { side: 'cr', account: account('cash_to_classify'), amount: (f) => (f.direction === 'in' ? f.amountPaise : -f.amountPaise) },
];
