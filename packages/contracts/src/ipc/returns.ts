import { z } from 'zod';
import { BusinessDate, IsoDateTime, Ulid } from './schemas.js';

const Int = z.number().int();

// ADR-0043: what was paid back goes to the customer's account or is refunded by cash, UPI or card.
export const REFUND_METHODS = ['cash', 'upi', 'card', 'credit'] as const;
export const RefundMethod = z.enum(REFUND_METHODS);
export type RefundMethod = z.infer<typeof RefundMethod>;

export const ReturnLineInput = z.object({ lineNo: Int.min(1), qtyMilli: Int.min(1).max(1_000_000_000) });
export const ReturnDraft = z.object({
  saleId: Ulid,
  lines: z.array(ReturnLineInput).min(1).max(500),
  refundMethod: RefundMethod.optional(),
});
export type ReturnDraft = z.infer<typeof ReturnDraft>;

const Heads = { cgstPaise: Int, sgstPaise: Int, igstPaise: Int, cessPaise: Int };

// Every line of the sale with what is left to return; the asked-for lines priced from the sale's own tax.
export const ReturnQuoteLine = z.object({
  lineNo: Int, name: z.string(), uomCode: z.string(), soldQtyMilli: Int, returnedQtyMilli: Int, returnableQtyMilli: Int,
  qtyMilli: Int, taxablePaise: Int, totalPaise: Int, ...Heads,
});
export const ReturnQuote = z.object({
  saleId: Ulid,
  saleDocNumber: z.string(),
  customerName: z.string().optional(),
  lines: z.array(ReturnQuoteLine),
  taxablePaise: Int, ...Heads, roundOffPaise: Int, totalPaise: Int,
  // Part of the refund that settles what the customer still owes on this bill; the rest is paid back by the refund method.
  creditPaise: Int,
  refundPaise: Int,
  refundMethod: RefundMethod,
  refundMethods: z.array(RefundMethod),
  outstandingPaise: Int,
  completesSale: z.boolean(),
  issues: z.array(z.object({ lineNo: Int, message: z.string() })),
});
export type ReturnQuote = z.infer<typeof ReturnQuote>;

export const CompleteReturnInput = ReturnDraft.extend({
  commandId: Ulid,
  reason: z.string().trim().min(1).max(200),
  expectedTotalPaise: Int,
  // Checked against a refund limit on the user's grant.
  refundPaise: Int.min(0).optional(),
});
export type CompleteReturnInput = z.infer<typeof CompleteReturnInput>;

export const CancelSaleInput = z.object({
  saleId: Ulid,
  reason: z.string().trim().min(1).max(200),
  refundMethod: RefundMethod.optional(),
  commandId: Ulid.optional(),
});
export type CancelSaleInput = z.infer<typeof CancelSaleInput>;

export const CompleteReturnResult = z.object({
  creditNoteId: Ulid, docNumber: z.string(), totalPaise: Int, refundMethod: RefundMethod, refundPaise: Int, creditPaise: Int, printJobId: Ulid, replayed: z.boolean(),
});
export type CompleteReturnResult = z.infer<typeof CompleteReturnResult>;

export const CreditNoteLine = z.object({
  id: z.string(), lineNo: Int, saleItemId: z.string(), saleLineNo: Int, productId: Ulid, name: z.string(), uomCode: z.string(), hsnCode: z.string().optional(), gstRateBp: Int,
  qtyMilli: Int, baseQtyMilli: Int, returnedBeforeMilli: Int, taxablePaise: Int, totalPaise: Int, costPaise: Int, ...Heads,
});
export const CreditNote = z.object({
  id: Ulid, docNumber: z.string(), docDate: BusinessDate, kind: z.enum(['return', 'cancel']), reason: z.string(),
  saleId: Ulid, saleDocNumber: z.string(), saleDocDate: BusinessDate, customerId: Ulid.optional(), customerName: z.string().optional(), customerGstin: z.string().optional(),
  terminalId: Ulid, sessionId: Ulid.optional(), supplyType: z.enum(['intra', 'inter']), stateTaxKind: z.enum(['sgst', 'utgst']), placeOfSupplyState: z.string(),
  gstr1Bucket: z.enum(['cdnr', 'cdnur', 'na']),
  taxablePaise: Int, ...Heads, roundOffPaise: Int, totalPaise: Int, costPaise: Int,
  refundMethod: RefundMethod, refundPaise: Int, creditPaise: Int, allocatedPaise: Int,
  status: z.enum(['posted', 'cancelled']), lines: z.array(CreditNoteLine), createdAt: IsoDateTime, createdBy: z.string(),
});
export type CreditNote = z.infer<typeof CreditNote>;

export const CreditNoteSummary = z.object({
  id: Ulid, docNumber: z.string(), docDate: BusinessDate, kind: z.enum(['return', 'cancel']), saleId: Ulid, saleDocNumber: z.string(),
  customerName: z.string().optional(), totalPaise: Int, refundMethod: RefundMethod, createdAt: IsoDateTime,
});
export type CreditNoteSummary = z.infer<typeof CreditNoteSummary>;
export const CreditNoteListInput = z.object({ saleId: Ulid.optional(), limit: z.number().int().min(1).max(200).default(50), cursor: z.string().max(200).optional() });
export type CreditNoteListInput = z.infer<typeof CreditNoteListInput>;
export const CreditNotePage = z.object({ items: z.array(CreditNoteSummary), nextCursor: z.string().nullable() });
export type CreditNotePage = z.infer<typeof CreditNotePage>;
