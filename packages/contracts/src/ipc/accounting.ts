import { z } from 'zod';
import { BusinessDate, IsoDateTime, Ulid } from './schemas.js';

const Int = z.number().int();
const MonthStart = BusinessDate.refine((d) => d.endsWith('-01'), 'the first day of a month');

export const Period = z.object({
  id: Ulid, fy: z.string(), periodStart: BusinessDate, periodEnd: BusinessDate, status: z.enum(['open', 'locked']),
  lockedAt: IsoDateTime.nullable(), lockedBy: z.string().nullable(), unlockReason: z.string().nullable(), journals: Int, latePostings: Int,
});
export type Period = z.infer<typeof Period>;
export const LockPeriodInput = z.object({ periodStart: MonthStart });
export const UnlockPeriodInput = z.object({ periodStart: MonthStart, reason: z.string().trim().min(1).max(200) });

export const LatePosting = z.object({
  id: Ulid, entryNo: z.string(), source: z.string(), refType: z.string().nullable(), refId: z.string().nullable(),
  docDate: BusinessDate, entryDate: BusinessDate, totalPaise: Int,
});
export type LatePosting = z.infer<typeof LatePosting>;

// ADR-0045: each financial year with its checklist, and its close once there is one.
const Fy = z.string().regex(/^\d{4}-\d{2}$/u, 'a financial year like 2025-26');
export const YearCloseInput = z.object({ fy: Fy });
export const ClosingView = z.object({
  version: Int, entryNo: z.string().nullable(), entryDate: BusinessDate, profitPaise: Int,
  lines: z.array(z.object({ code: z.string(), name: z.string(), debitPaise: Int, creditPaise: Int })),
});
export const FinancialYear = z.object({
  fy: Fy, start: BusinessDate, end: BusinessDate, ended: z.boolean(), status: z.enum(['open', 'requested', 'closed']),
  months: z.array(z.object({ month: BusinessDate, status: z.enum(['open', 'locked']) })),
  gst: z.object({ required: z.boolean(), lastActiveMonth: BusinessDate.nullable(), settledThrough: BusinessDate.nullable() }),
  blockers: z.array(z.string()), profitPaise: Int, residuePaise: Int, needsReclose: z.boolean(), closeId: Ulid.nullable(), closedAt: IsoDateTime.nullable(), closedBy: z.string().nullable(),
  closings: z.array(ClosingView), pending: z.boolean(), syncError: z.string().nullable(),
});
export type FinancialYear = z.infer<typeof FinancialYear>;

export const BacklogResult = z.object({ posted: Int, remaining: Int });
export type BacklogResult = z.infer<typeof BacklogResult>;

const AccountType = z.enum(['asset', 'liability', 'equity', 'income', 'expense']);
export const AccountView = z.object({
  id: Ulid, code: z.string(), name: z.string(), type: AccountType, role: z.string().nullable(), parentId: Ulid.nullable(), isGroup: z.boolean(),
  isSystem: z.boolean(), balancePaise: Int,
});
export type AccountView = z.infer<typeof AccountView>;
export const ListAccountsInput = z.object({ asOf: BusinessDate.optional() });
export const CreateAccountInput = z.object({ code: z.string().regex(/^\d{4}$/u, '4 digits'), name: z.string().trim().min(1).max(80), parentCode: z.string() });
export const RenameAccountInput = z.object({ id: Ulid, name: z.string().trim().min(1).max(80) });

const Branch = { branchId: Ulid.optional() };
export const AsOfInput = z.object({ asOf: BusinessDate.optional(), ...Branch });
export const RangeInput = z.object({ from: BusinessDate, to: BusinessDate, ...Branch });

export const TrialBalance = z.object({
  asOf: BusinessDate, rows: z.array(z.object({ accountId: Ulid, code: z.string(), name: z.string(), type: AccountType, debitPaise: Int, creditPaise: Int })),
  debitPaise: Int, creditPaise: Int, balanced: z.boolean(),
});
export type TrialBalance = z.infer<typeof TrialBalance>;
const StatementLine = z.object({ accountId: z.string(), code: z.string(), name: z.string(), amountPaise: Int });
export const ProfitAndLoss = z.object({
  from: BusinessDate, to: BusinessDate, revenue: z.array(StatementLine), costOfSales: z.array(StatementLine), grossProfitPaise: Int,
  otherIncome: z.array(StatementLine), expenses: z.array(StatementLine), netProfitPaise: Int,
});
export type ProfitAndLoss = z.infer<typeof ProfitAndLoss>;
export const BalanceSheet = z.object({
  asOf: BusinessDate, assets: z.array(StatementLine), liabilities: z.array(StatementLine), equity: z.array(StatementLine),
  retainedEarningsPaise: Int, currentProfitPaise: Int, totalAssetsPaise: Int, totalLiabilitiesAndEquityPaise: Int, balanced: z.boolean(),
});
export type BalanceSheet = z.infer<typeof BalanceSheet>;

export const AccountLedgerInput = z.object({
  accountId: Ulid.optional(), from: BusinessDate.optional(), to: BusinessDate.optional(), ...Branch,
  limit: z.number().int().min(1).max(500).default(100), cursor: z.string().max(200).optional(),
});
export const AccountLedgerPage = z.object({
  accountId: Ulid, openingBalancePaise: Int, closingBalancePaise: Int, nextCursor: z.string().nullable(),
  items: z.array(z.object({
    entryId: Ulid, entryNo: z.string(), date: BusinessDate, source: z.string(), refType: z.string().nullable(), refId: z.string().nullable(),
    narration: z.string().nullable(), partyType: z.string().nullable(), partyId: z.string().nullable(), debitPaise: Int, creditPaise: Int, balancePaise: Int,
  })),
});
export type AccountLedgerPage = z.infer<typeof AccountLedgerPage>;
export const DayBookInput = z.object({ from: BusinessDate, to: BusinessDate, ...Branch, limit: z.number().int().min(1).max(200).default(50), cursor: z.string().max(200).optional() });
export const DayBookPage = z.object({
  nextCursor: z.string().nullable(),
  items: z.array(z.object({
    id: Ulid, entryNo: z.string(), date: BusinessDate, docDate: BusinessDate, source: z.string(), refType: z.string().nullable(), refId: z.string().nullable(),
    narration: z.string().nullable(), latePosting: z.boolean(), reversalOf: z.string().nullable(), reversedBy: z.string().nullable(),
    lines: z.array(z.object({ code: z.string(), name: z.string(), debitPaise: Int, creditPaise: Int, partyType: z.string().nullable(), partyId: z.string().nullable() })),
  })),
});
export type DayBookPage = z.infer<typeof DayBookPage>;

const Paise = z.number().int().min(0).max(1_000_000_000_000);
export const ManualJournalInput = z.object({
  date: BusinessDate.optional(),
  narration: z.string().trim().min(1).max(200),
  lines: z.array(z.object({ accountId: Ulid, debitPaise: Paise.default(0), creditPaise: Paise.default(0) })).min(2).max(50),
  commandId: Ulid,
});
export type ManualJournalInput = z.infer<typeof ManualJournalInput>;
export const ReverseJournalInput = z.object({ id: Ulid, date: BusinessDate.optional(), reason: z.string().trim().min(1).max(200) });
export const JournalView = z.object({ id: Ulid, entryNo: z.string(), date: BusinessDate, totalPaise: Int });
export type JournalView = z.infer<typeof JournalView>;
