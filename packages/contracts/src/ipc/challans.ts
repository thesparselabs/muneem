import { z } from 'zod';
import { BusinessDate, Gstin, IsoDateTime, Ulid } from './schemas.js';
import { CustomerSnapshot, QuoteLine, SaleDraft, SaleTotals } from './sales.js';

// FR-087 (ADR-0069): goods sent without a tax invoice (CGST Rule 55), valued like a bill, posting nothing.
export const CHALLAN_PURPOSES = ['supply', 'job_work', 'approval', 'branch_transfer', 'other'] as const;
export const ChallanPurpose = z.enum(CHALLAN_PURPOSES);
export type ChallanPurpose = z.infer<typeof ChallanPurpose>;
export const CHALLAN_PURPOSE_LABELS: Record<ChallanPurpose, string> = {
  supply: 'Supply, invoice to follow', job_work: 'Job work', approval: 'On approval', branch_transfer: 'Branch transfer', other: 'Other',
};

export const ChallanStatus = z.enum(['open', 'billed']);
export type ChallanStatus = z.infer<typeof ChallanStatus>;

export const TRANSPORT_MODES = ['road', 'rail', 'air', 'ship'] as const;

// What an e-way bill will need later (FR-090).
export const Transport = z.object({
  mode: z.enum(TRANSPORT_MODES).default('road'),
  vehicleNo: z.string().trim().toUpperCase().regex(/^[A-Z0-9 -]{4,15}$/u, 'letters, digits, spaces and dashes').optional(),
  transporterName: z.string().trim().min(1).max(100).optional(),
  // The transporter's GSTIN or transporter id (TRANSIN).
  transporterId: z.string().trim().toUpperCase().regex(/^[0-9A-Z]{15}$/u, '15 letters and digits').optional(),
  distanceKm: z.number().int().min(0).max(4000).optional(),
  docNo: z.string().trim().min(1).max(30).optional(),
});
export type Transport = z.infer<typeof Transport>;

// A consignee not on file as a customer: a job worker, another branch, an exhibition.
export const Consignee = z.object({
  name: z.string().trim().min(1).max(120),
  address: z.string().trim().min(1).max(300).optional(),
  gstin: Gstin.optional(),
});
export type Consignee = z.infer<typeof Consignee>;

export const ChallanLineInput = z.object({ productId: Ulid, uomId: Ulid, qtyMilli: z.number().int().min(1).max(1_000_000_000) });

export const ChallanDraft = z.object({
  purpose: ChallanPurpose,
  // One of these names who receives the goods.
  customerId: Ulid.optional(),
  consignee: Consignee.optional(),
  lines: z.array(ChallanLineInput).min(1).max(500),
  transport: Transport.default({ mode: 'road' }),
  notes: z.string().trim().max(500).optional(),
});
export type ChallanDraft = z.infer<typeof ChallanDraft>;

export const CreateChallanInput = ChallanDraft.extend({ commandId: Ulid, expectedTotalPaise: z.number().int() });
export type CreateChallanInput = z.infer<typeof CreateChallanInput>;

export const Challan = z.object({
  id: Ulid,
  docNumber: z.string(),
  docDate: BusinessDate,
  purpose: ChallanPurpose,
  status: ChallanStatus,
  customerId: Ulid.optional(),
  consignee: CustomerSnapshot,
  transport: Transport,
  notes: z.string().optional(),
  totals: SaleTotals,
  lines: z.array(QuoteLine),
  // What the POS loads to bill it.
  draft: SaleDraft,
  saleId: Ulid.optional(),
  saleDocNumber: z.string().optional(),
  billedAt: IsoDateTime.optional(),
  createdAt: IsoDateTime,
  createdBy: z.string(),
});
export type Challan = z.infer<typeof Challan>;

export const ChallanSummary = z.object({
  id: Ulid, docNumber: z.string(), docDate: BusinessDate, purpose: ChallanPurpose, consigneeName: z.string(), vehicleNo: z.string().optional(),
  totalPaise: z.number().int(), status: ChallanStatus, saleDocNumber: z.string().optional(),
});
export type ChallanSummary = z.infer<typeof ChallanSummary>;

export const ChallanListInput = z.object({
  status: ChallanStatus.optional(),
  limit: z.number().int().min(1).max(200).default(50),
  cursor: z.string().max(200).optional(),
});
export type ChallanListInput = z.infer<typeof ChallanListInput>;
export const ChallanPage = z.object({ items: z.array(ChallanSummary), nextCursor: z.string().nullable() });
export type ChallanPage = z.infer<typeof ChallanPage>;
