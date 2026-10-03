import { z } from 'zod';
import { BusinessDate, IsoDateTime, StateCode, Ulid } from './schemas.js';
import { DiscountInput, QuoteLine } from './sales.js';

const Paise = z.number().int().min(0).max(1_000_000_000_000);
const Int = z.number().int();
const NoDiscount = { kind: 'amount' as const, value: 0 };

export const PURCHASE_CHARGE_KINDS = ['freight', 'loading', 'insurance', 'other'] as const;
export const PurchaseChargeInput = z.object({
  kind: z.enum(PURCHASE_CHARGE_KINDS),
  description: z.string().trim().max(120).optional(),
  amountPaise: Paise.refine((v) => v > 0, 'must be more than zero'),
});
export type PurchaseChargeInput = z.infer<typeof PurchaseChargeInput>;

// The rate is the bill's; GST rate defaults to the product's and ITC to eligible (5c details).
export const PurchaseLineInput = z.object({
  productId: Ulid,
  uomId: Ulid,
  qtyMilli: z.number().int().min(1).max(1_000_000_000),
  unitPricePaise: Paise,
  priceIsInclusive: z.boolean().default(false),
  lineDiscount: DiscountInput.default(NoDiscount),
  gstRateBp: z.number().int().min(0).max(10_000).optional(),
  itcEligible: z.boolean().optional(),
});
export type PurchaseLineInput = z.infer<typeof PurchaseLineInput>;

export const PurchaseDraft = z.object({
  supplierId: Ulid,
  supplierInvoiceNo: z.string().trim().min(1).max(30),
  supplierInvoiceDate: BusinessDate,
  dueDate: BusinessDate.optional(),
  isReverseCharge: z.boolean().default(false),
  note: z.string().trim().max(500).optional(),
  lines: z.array(PurchaseLineInput).min(1).max(500),
  billDiscount: DiscountInput.default(NoDiscount),
  charges: z.array(PurchaseChargeInput).max(10).default([]),
  billTotalPaise: Paise.optional(),
});
export type PurchaseDraft = z.infer<typeof PurchaseDraft>;
export const CreatePurchaseInput = PurchaseDraft.extend({ billTotalPaise: Paise, commandId: Ulid });
export type CreatePurchaseInput = z.infer<typeof CreatePurchaseInput>;

export const PurchaseQuoteLine = QuoteLine.extend({
  itcEligible: z.boolean(), chargesPaise: Int, landedValuePaise: Int, unitCostPaise: Int,
});
export type PurchaseQuoteLine = z.infer<typeof PurchaseQuoteLine>;

export const PurchaseTotals = z.object({
  docType: z.enum(['tax_invoice', 'bill_of_supply']),
  supplyType: z.enum(['intra', 'inter']),
  stateTaxKind: z.enum(['sgst', 'utgst']),
  grossPaise: Int, lineDiscountPaise: Int, billDiscountPaise: Int, taxablePaise: Int,
  cgstPaise: Int, sgstPaise: Int, igstPaise: Int, cessPaise: Int,
  chargesPaise: Int, itcPaise: Int,
  computedTotalPaise: Int,
  roundOffPaise: Int,
  totalPaise: Int,
});
export type PurchaseTotals = z.infer<typeof PurchaseTotals>;

// billDifferencePaise = bill total − computed total; billTotalOk = within ±₹1.
export const PurchaseQuote = z.object({
  lines: z.array(PurchaseQuoteLine),
  totals: PurchaseTotals,
  dueDate: BusinessDate,
  issues: z.array(z.object({ lineNo: Int, message: z.string() })),
  billDifferencePaise: Int.optional(),
  billTotalOk: z.boolean().optional(),
});
export type PurchaseQuote = z.infer<typeof PurchaseQuote>;

export const SupplierSnapshot = z.object({ name: z.string(), gstin: z.string().optional(), stateCode: StateCode, taxScheme: z.enum(['regular', 'composition', 'unregistered']) });
export type SupplierSnapshot = z.infer<typeof SupplierSnapshot>;

export const PurchaseLine = PurchaseQuoteLine.extend({ id: Ulid, returnedQtyMilli: Int });
export const Purchase = z.object({
  id: Ulid, docNumber: z.string(), docDate: BusinessDate, status: z.enum(['posted', 'cancelled']),
  supplierId: Ulid, supplier: SupplierSnapshot, supplierInvoiceNo: z.string(), supplierInvoiceDate: BusinessDate, dueDate: BusinessDate,
  isReverseCharge: z.boolean(), note: z.string().optional(),
  lines: z.array(PurchaseLine),
  charges: z.array(PurchaseChargeInput),
  totals: PurchaseTotals,
  settledPaise: Int,
  createdAt: IsoDateTime, createdBy: z.string(),
  cancelReason: z.string().optional(),
});
export type Purchase = z.infer<typeof Purchase>;

export const PurchaseListInput = z.object({
  supplierId: Ulid.optional(), from: BusinessDate.optional(), to: BusinessDate.optional(), status: z.enum(['posted', 'cancelled']).optional(),
  limit: z.number().int().min(1).max(200).default(50), cursor: z.string().max(200).optional(),
});
export type PurchaseListInput = z.infer<typeof PurchaseListInput>;
export const PurchaseSummary = z.object({
  id: Ulid, docNumber: z.string(), docDate: BusinessDate, status: z.enum(['posted', 'cancelled']), supplierId: Ulid, supplierName: z.string(),
  supplierInvoiceNo: z.string(), dueDate: BusinessDate, totalPaise: Int, settledPaise: Int,
});
export const PurchasePage = z.object({ items: z.array(PurchaseSummary), nextCursor: z.string().nullable() });
export type PurchasePage = z.infer<typeof PurchasePage>;

export const ReturnPurchaseInput = z.object({
  purchaseId: Ulid,
  lines: z.array(z.object({ purchaseItemId: Ulid, qtyMilli: z.number().int().min(1).max(1_000_000_000) })).min(1).max(500),
  reason: z.string().trim().min(1).max(200),
  refundCharges: z.boolean().default(false),
  commandId: Ulid,
});
export type ReturnPurchaseInput = z.infer<typeof ReturnPurchaseInput>;

export const DebitNote = z.object({
  id: Ulid, docNumber: z.string(), docDate: BusinessDate, purchaseId: Ulid, supplierId: Ulid, reason: z.string(),
  supplyType: z.enum(['intra', 'inter']),
  taxablePaise: Int, cgstPaise: Int, sgstPaise: Int, igstPaise: Int, cessPaise: Int, chargesPaise: Int, totalPaise: Int,
  itcReversedPaise: Int, allocatedPaise: Int,
  lines: z.array(z.object({
    purchaseItemId: Ulid, productId: Ulid, qtyMilli: Int, baseQtyMilli: Int, taxablePaise: Int,
    cgstPaise: Int, sgstPaise: Int, igstPaise: Int, cessPaise: Int, totalPaise: Int, landedValuePaise: Int,
  })),
});
export type DebitNote = z.infer<typeof DebitNote>;

export const CancelPurchaseInput = z.object({ id: Ulid, reason: z.string().trim().min(1).max(200) });

export const PURCHASE_IMPORT_FIELDS = ['sku', 'barcode', 'qty', 'unit', 'rate', 'gstRate', 'discount'] as const;
export const PurchaseImportField = z.enum(PURCHASE_IMPORT_FIELDS);
export type PurchaseImportField = z.infer<typeof PurchaseImportField>;
export const PurchaseImportMapping = z.record(PurchaseImportField, z.number().int().min(0).max(500));
export type PurchaseImportMapping = z.infer<typeof PurchaseImportMapping>;
export const PurchaseImportPreviewInput = z
  .object({ fileName: z.string().trim().min(1).max(200).optional(), contentBase64: z.string().max(14_000_000).optional(), importId: Ulid.optional(), mapping: PurchaseImportMapping.optional() })
  .refine((i) => i.importId !== undefined || (i.fileName !== undefined && i.contentBase64 !== undefined), { message: 'send a file, or the importId of an earlier preview' });
export const PurchaseImportPreview = z.object({
  importId: Ulid, fileName: z.string(), columns: z.array(z.string()), mapping: PurchaseImportMapping,
  counts: z.object({ total: Int, ok: Int, errors: Int }),
  errors: z.array(z.object({ line: Int, errors: z.record(z.string(), z.string()) })),
  lines: z.array(PurchaseLineInput),
});
export type PurchaseImportPreview = z.infer<typeof PurchaseImportPreview>;
