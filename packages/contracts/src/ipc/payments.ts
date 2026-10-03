import { z } from 'zod';
import { BusinessDate, Gstin, IsoDateTime, Ulid } from './schemas.js';
import { PartyType } from './parties.js';

const Amount = z.number().int().min(1).max(1_000_000_000_000);
const Int = z.number().int();

export const PAYMENT_METHODS = ['cash', 'upi', 'card', 'bank', 'cheque', 'other'] as const;
export const PaymentMethod = z.enum(PAYMENT_METHODS);

// The charge types a settlement can be applied to (ADR-0025).
export const ChargeRef = z.object({ type: z.enum(['sale', 'purchase', 'expense', 'opening']), id: Ulid, amountPaise: Amount });
export type ChargeRef = z.infer<typeof ChargeRef>;
// 'auto' = oldest due date first; otherwise exactly these amounts, the rest kept as an advance.
export const AllocationChoice = z.union([z.literal('auto'), z.array(ChargeRef).max(500)]);
export type AllocationChoice = z.infer<typeof AllocationChoice>;

export const PaymentInput = z.object({
  partyType: PartyType,
  partyId: Ulid,
  amountPaise: Amount,
  paymentDate: BusinessDate.optional(),
  method: PaymentMethod,
  reference: z.string().trim().max(60).optional(),
  note: z.string().trim().max(500).optional(),
  allocation: AllocationChoice.default('auto'),
  commandId: Ulid,
});
export type PaymentInput = z.infer<typeof PaymentInput>;

export const AllocationLine = z.object({ id: Ulid, targetType: z.string(), targetId: Ulid, docNumber: z.string().optional(), amountPaise: Int, voided: z.boolean() });
export const Payment = z.object({
  id: Ulid, docNumber: z.string(), paymentDate: BusinessDate, status: z.enum(['posted', 'cancelled']),
  direction: z.enum(['in', 'out']), partyType: PartyType, partyId: Ulid, partyName: z.string(),
  method: PaymentMethod, amountPaise: Int, allocatedPaise: Int, reference: z.string().optional(), note: z.string().optional(),
  allocations: z.array(AllocationLine), drawerSessionId: Ulid.optional(), createdAt: IsoDateTime, createdBy: z.string(), cancelReason: z.string().optional(),
});
export type Payment = z.infer<typeof Payment>;

export const PaymentListInput = z.object({
  partyType: PartyType.optional(), partyId: Ulid.optional(), from: BusinessDate.optional(), to: BusinessDate.optional(),
  status: z.enum(['posted', 'cancelled']).optional(), limit: z.number().int().min(1).max(200).default(50), cursor: z.string().max(200).optional(),
});
export type PaymentListInput = z.infer<typeof PaymentListInput>;
export const PaymentSummary = Payment.omit({ allocations: true, note: true, reference: true, createdBy: true, cancelReason: true, drawerSessionId: true });
export const PaymentPage = z.object({ items: z.array(PaymentSummary), nextCursor: z.string().nullable() });
export type PaymentPage = z.infer<typeof PaymentPage>;

export const CREDIT_TYPES = ['payment', 'debit_note', 'opening'] as const;
export const AllocateInput = z.object({
  partyType: PartyType, partyId: Ulid, creditType: z.enum(CREDIT_TYPES), creditId: Ulid, allocation: AllocationChoice.default('auto'),
});
export type AllocateInput = z.infer<typeof AllocateInput>;
export const AllocateResult = z.object({ allocatedPaise: Int, unallocatedPaise: Int, allocations: z.array(AllocationLine) });
export type AllocateResult = z.infer<typeof AllocateResult>;

export const OpenItem = z.object({
  type: z.string(), id: Ulid, docNumber: z.string().optional(), docDate: BusinessDate, dueDate: BusinessDate, amountPaise: Int, openPaise: Int,
});
export const OpenItems = z.object({ charges: z.array(OpenItem), credits: z.array(OpenItem) });
export type OpenItems = z.infer<typeof OpenItems>;
export const PartyRefInput = z.object({ partyType: PartyType, partyId: Ulid });

export const CancelDocumentInput = z.object({ id: Ulid, reason: z.string().trim().min(1).max(200) });

export const WriteOffInput = z.object({
  customerId: Ulid,
  items: z.array(ChargeRef).min(1).max(500),
  reason: z.string().trim().min(1).max(200),
  commandId: Ulid,
});
export type WriteOffInput = z.infer<typeof WriteOffInput>;
export const WriteOff = z.object({
  id: Ulid, customerId: Ulid, docDate: BusinessDate, amountPaise: Int, reason: z.string(), allocations: z.array(AllocationLine),
});
export type WriteOff = z.infer<typeof WriteOff>;

export const ExpenseCategory = z.object({ id: Ulid, code: z.string(), name: z.string(), accountCode: z.string() });
export type ExpenseCategory = z.infer<typeof ExpenseCategory>;

export const EXPENSE_METHODS = [...PAYMENT_METHODS, 'credit'] as const;
export const ExpenseInput = z.object({
  categoryId: Ulid,
  expenseDate: BusinessDate.optional(),
  description: z.string().trim().max(200).optional(),
  method: z.enum(EXPENSE_METHODS),
  reference: z.string().trim().max(60).optional(),
  supplierId: Ulid.optional(),
  vendorName: z.string().trim().max(120).optional(),
  vendorGstin: Gstin.optional(),
  amountPaise: Amount,
  amountIsInclusive: z.boolean().default(true),
  gstRateBp: z.number().int().min(0).max(10_000).optional(),
  itcEligible: z.boolean().optional(),
  commandId: Ulid,
});
export type ExpenseInput = z.infer<typeof ExpenseInput>;
export const Expense = z.object({
  id: Ulid, docNumber: z.string(), expenseDate: BusinessDate, status: z.enum(['posted', 'cancelled']), categoryId: Ulid, categoryName: z.string(),
  method: z.enum(EXPENSE_METHODS), description: z.string().optional(), reference: z.string().optional(),
  supplierId: Ulid.optional(), vendorName: z.string().optional(), vendorGstin: z.string().optional(),
  supplyType: z.enum(['intra', 'inter']).optional(), taxablePaise: Int, cgstPaise: Int, sgstPaise: Int, igstPaise: Int, cessPaise: Int, itcPaise: Int,
  totalPaise: Int, dueDate: BusinessDate.optional(), settledPaise: Int, drawerSessionId: Ulid.optional(), createdAt: IsoDateTime, cancelReason: z.string().optional(),
});
export type Expense = z.infer<typeof Expense>;
export const ExpenseListInput = z.object({
  categoryId: Ulid.optional(), from: BusinessDate.optional(), to: BusinessDate.optional(), status: z.enum(['posted', 'cancelled']).optional(),
  limit: z.number().int().min(1).max(200).default(50), cursor: z.string().max(200).optional(),
});
export type ExpenseListInput = z.infer<typeof ExpenseListInput>;
export const ExpensePage = z.object({ items: z.array(Expense), nextCursor: z.string().nullable() });
export type ExpensePage = z.infer<typeof ExpensePage>;
