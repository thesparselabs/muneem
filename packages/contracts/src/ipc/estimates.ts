import { z } from 'zod';
import { BusinessDate, IsoDateTime, Ulid } from './schemas.js';
import { CustomerSnapshot, QuoteLine, SaleDraft, SaleTotals } from './sales.js';

// FR-086 (ADR-0068): a quotation priced like a bill that posts nothing; a sale made from it converts it.
export const ESTIMATE_STATUSES = ['open', 'expired', 'converted'] as const;
export const EstimateStatus = z.enum(ESTIMATE_STATUSES);
export type EstimateStatus = z.infer<typeof EstimateStatus>;

export const ESTIMATE_DEFAULT_VALID_DAYS = 15;

export const EstimateDraft = SaleDraft.extend({
  // Defaults to 15 days from the estimate's date.
  validUntil: BusinessDate.optional(),
  notes: z.string().trim().max(500).optional(),
});
export type EstimateDraft = z.infer<typeof EstimateDraft>;

export const CreateEstimateInput = EstimateDraft.extend({ commandId: Ulid, expectedTotalPaise: z.number().int() });
export type CreateEstimateInput = z.infer<typeof CreateEstimateInput>;

export const Estimate = z.object({
  id: Ulid,
  docNumber: z.string(),
  docDate: BusinessDate,
  validUntil: BusinessDate,
  status: EstimateStatus,
  customerId: Ulid.optional(),
  // The customer as on file today: an estimate is not a tax document and keeps no copy of their details.
  customer: CustomerSnapshot,
  notes: z.string().optional(),
  totals: SaleTotals,
  lines: z.array(QuoteLine),
  // What the POS loads to bill it.
  draft: SaleDraft,
  saleId: Ulid.optional(),
  saleDocNumber: z.string().optional(),
  convertedAt: IsoDateTime.optional(),
  createdAt: IsoDateTime,
  createdBy: z.string(),
});
export type Estimate = z.infer<typeof Estimate>;

export const EstimateSummary = z.object({
  id: Ulid, docNumber: z.string(), docDate: BusinessDate, validUntil: BusinessDate, customerName: z.string().optional(), totalPaise: z.number().int(),
  status: EstimateStatus, saleDocNumber: z.string().optional(),
});
export type EstimateSummary = z.infer<typeof EstimateSummary>;

export const EstimateListInput = z.object({
  status: EstimateStatus.optional(),
  limit: z.number().int().min(1).max(200).default(50),
  cursor: z.string().max(200).optional(),
});
export type EstimateListInput = z.infer<typeof EstimateListInput>;
export const EstimatePage = z.object({ items: z.array(EstimateSummary), nextCursor: z.string().nullable() });
export type EstimatePage = z.infer<typeof EstimatePage>;
