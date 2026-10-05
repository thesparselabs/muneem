import type {
  Discount, GstInvoiceInput, GstInvoiceResult, Gstr1, Gstr3b, GstHeads, ItcRegisterRow, ReturnInput, ReturnResult, SetoffResult, TaxScheme, TaxTreatment,
} from '../../src/index.js';

export interface Item {
  name: string; hsn: string; uom: string; rateBp: number; treatment?: TaxTreatment; cessRateBp?: number; cessPerUnitPaise?: number;
}
export interface Party { id: string; name: string; stateCode: string; gstin?: string; scheme?: TaxScheme }
export interface Business { name: string; stateCode: string; scheme: TaxScheme; roundToRupee: boolean; b2clThresholdPaise: number }

export interface DocLine { item: Item; qtyMilli: number; unitPricePaise: number; inclusive?: boolean; lineDiscount?: Discount }
export interface SaleLine extends DocLine { cogsPaise: number }
export interface Sale {
  ref: string; number: string; date: string; customer?: Party; placeOfSupply?: string; billDiscount?: Discount; lines: SaleLine[];
  // What was paid now, by method; the rest is on credit to the customer.
  paid?: { cash?: number; upi?: number };
}
export interface CreditNote {
  ref: string; number: string; date: string; saleRef: string; lines: { line: number; qtyMilli: number }[]; refundBy: 'cash' | 'upi' | 'account';
}
export interface PurchaseLine extends DocLine { itcEligible?: boolean }
export interface Purchase {
  ref: string; number: string; date: string; supplierInvoiceNo: string; supplier: Party; lines: PurchaseLine[]; chargesPaise?: number; billTotalPaise?: number;
}
export interface DebitNote { ref: string; number: string; date: string; purchaseRef: string; lines: { line: number; qtyMilli: number }[]; refundCharges?: boolean }
export interface Expense {
  ref: string; number: string; date: string; vendor: Party; accountCode: string; amountPaise: number; inclusive?: boolean; gstRateBp?: number;
  itcEligible?: boolean; method: 'cash' | 'bank' | 'credit';
}

export interface ScenarioInput {
  name: string;
  story: string;
  business: Business;
  sales?: Sale[];
  creditNotes?: CreditNote[];
  purchases?: Purchase[];
  debitNotes?: DebitNote[];
  expenses?: Expense[];
  // Set off the period's tax at its last day and pay the cash part by challan.
  setoff?: { date: string; challanDate: string };
  // Close the year's income and expense to retained earnings.
  yearEnd?: { fy: string };
}

export interface PostedLine { side: 'Dr' | 'Cr'; code: string; account: string; paise: number; party?: string }
export interface PostedJournal { ref: string; date: string; lines: PostedLine[] }

export interface DebitNoteResult {
  ref: string; purchaseRef: string; taxablePaise: number; cgstPaise: number; sgstPaise: number; igstPaise: number; cessPaise: number;
  inventoryPaise: number; itcReversed: GstHeads; lossPaise: number; chargesPaise: number; roundOffPaise: number; totalPaise: number;
}
export interface PurchaseResult { ref: string; landedPaise: number[]; itc: GstHeads; roundOffPaise: number; totalPaise: number }

export interface ScenarioResult {
  invoices: { ref: string; kind: 'sale' | 'purchase' | 'expense'; input: GstInvoiceInput; result: GstInvoiceResult }[];
  creditNotes: { ref: string; saleRef: string; input: ReturnInput; result: ReturnResult; toAccountPaise: number; refundPaise: number }[];
  purchases: PurchaseResult[];
  debitNotes: DebitNoteResult[];
  gstr1: Gstr1;
  gstr3b: Gstr3b;
  itcRegister: ItcRegisterRow[];
  setoff: { liability: GstHeads; credit: GstHeads; result: SetoffResult } | null;
  journals: PostedJournal[];
  // Each account's closing balance, debit positive, after every journal (closing included).
  trialBalance: { code: string; account: string; netPaise: number }[];
}

// HAND values: typed in by a person from the story, asserted against the engines before the file is written.
export interface HandChecks { values: Record<string, number | string | boolean>; journals: Record<string, string[]> }
export interface Scenario extends ScenarioInput { hand: HandChecks }

export interface ScenarioFile { version: 1; scenarios: (Scenario & { expected: ScenarioResult })[] }
