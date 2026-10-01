import { z } from 'zod';
import { BusinessDate, IsoDateTime, StateCode, Ulid } from './schemas.js';
import { TaxTreatment } from './catalog.js';

const Paise = z.number().int().min(0).max(1_000_000_000_000);
const Int = z.number().int();

// Percent discounts are in basis points (10% = 1000), amounts in paise, as in the GST engine.
export const DiscountInput = z.object({ kind: z.enum(['amount', 'percent']), value: z.number().int().min(0).max(1_000_000_000_000) })
  .refine((d) => d.kind === 'amount' || d.value <= 10_000, { message: 'a percent discount cannot exceed 100%', path: ['value'] });
export type DiscountInput = z.infer<typeof DiscountInput>;
const NoDiscount = { kind: 'amount' as const, value: 0 };

export const CartLineInput = z.object({
  productId: Ulid,
  uomId: Ulid,
  qtyMilli: z.number().int().min(1).max(1_000_000_000),
  lineDiscount: DiscountInput.default(NoDiscount),
});
export type CartLineInput = z.infer<typeof CartLineInput>;

export const PlaceOfSupplyOverride = z.object({ stateCode: StateCode, reason: z.string().trim().min(1).max(200) });

export const SaleDraft = z.object({
  customerId: Ulid.optional(),
  placeOfSupplyOverride: PlaceOfSupplyOverride.optional(),
  lines: z.array(CartLineInput).min(1).max(500),
  billDiscount: DiscountInput.default(NoDiscount),
});
export type SaleDraft = z.infer<typeof SaleDraft>;

export const QuoteLine = z.object({
  lineNo: Int,
  productId: Ulid,
  name: z.string(),
  hsnCode: z.string().optional(),
  uomId: Ulid,
  uomCode: z.string(),
  qtyMilli: Int,
  baseQtyMilli: Int,
  unitPricePaise: Int,
  priceIsInclusive: z.boolean(),
  mrpPaise: Int.optional(),
  gstRateBp: Int,
  cessRateBp: Int,
  cessPerUnitPaise: Int,
  taxTreatment: TaxTreatment,
  lineDiscount: DiscountInput,
  grossPaise: Int,
  lineDiscountPaise: Int,
  apportionedBillDiscountPaise: Int,
  taxablePaise: Int,
  cgstPaise: Int, sgstPaise: Int, igstPaise: Int, cessPaise: Int,
  totalPaise: Int,
});
export type QuoteLine = z.infer<typeof QuoteLine>;

export const SaleTotals = z.object({
  docType: z.enum(['tax_invoice', 'bill_of_supply']),
  placeOfSupplyState: StateCode,
  supplyType: z.enum(['intra', 'inter']),
  stateTaxKind: z.enum(['sgst', 'utgst']),
  gstr1Bucket: z.string(),
  grossPaise: Int,
  lineDiscountPaise: Int,
  billDiscountPaise: Int,
  taxablePaise: Int,
  cgstPaise: Int, sgstPaise: Int, igstPaise: Int, cessPaise: Int,
  roundOffPaise: Int,
  totalPaise: Int,
  discountBp: Int,
});
export type SaleTotals = z.infer<typeof SaleTotals>;

export const SaleQuote = z.object({
  lines: z.array(QuoteLine),
  totals: SaleTotals,
  issues: z.array(z.object({ lineNo: Int, message: z.string() })),
});
export type SaleQuote = z.infer<typeof SaleQuote>;

export const TENDER_METHODS = ['cash', 'upi', 'card', 'other'] as const;
export const TenderLine = z.object({
  method: z.enum(TENDER_METHODS),
  amountPaise: Paise.refine((v) => v > 0, 'must be more than zero'),
  reference: z.string().trim().max(60).optional(),
});
export type TenderLine = z.infer<typeof TenderLine>;

export const CompleteSaleInput = SaleDraft.extend({
  commandId: Ulid,
  tenders: z.array(TenderLine).max(10),
  expectedTotalPaise: Int,
});
export type CompleteSaleInput = z.infer<typeof CompleteSaleInput>;

export const CompleteSaleResult = z.object({
  saleId: Ulid,
  docNumber: z.string(),
  totals: SaleTotals,
  changePaise: Int,
  printJobId: Ulid,
  replayed: z.boolean(),
});
export type CompleteSaleResult = z.infer<typeof CompleteSaleResult>;

export const SaleTender = TenderLine.extend({ changePaise: Int });
export const CustomerSnapshot = z.object({
  walkIn: z.boolean(),
  name: z.string().optional(),
  phone: z.string().optional(),
  gstin: z.string().optional(),
  stateCode: z.string().optional(),
  address: z.string().optional(),
});
export type CustomerSnapshot = z.infer<typeof CustomerSnapshot>;

export const Sale = z.object({
  id: Ulid,
  docNumber: z.string(),
  docDate: BusinessDate,
  docType: z.string(),
  status: z.enum(['posted', 'cancelled']),
  sessionId: Ulid,
  terminalId: Ulid,
  customerId: Ulid.optional(),
  customer: CustomerSnapshot,
  placeOfSupplyReason: z.string().optional(),
  totals: SaleTotals,
  paidPaise: Int,
  changePaise: Int,
  lines: z.array(QuoteLine),
  tenders: z.array(SaleTender),
  createdAt: IsoDateTime,
  createdBy: z.string(),
});
export type Sale = z.infer<typeof Sale>;

export const SaleSummary = z.object({
  id: Ulid, docNumber: z.string(), docDate: BusinessDate, customerName: z.string().optional(), totalPaise: Int,
  status: z.enum(['posted', 'cancelled']), createdAt: IsoDateTime,
});
export type SaleSummary = z.infer<typeof SaleSummary>;
export const SaleListInput = z.object({ sessionId: Ulid.optional(), limit: z.number().int().min(1).max(200).default(50), before: IsoDateTime.optional() });
