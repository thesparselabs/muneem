import { z } from 'zod';
import { IsoDateTime, Ulid } from './schemas.js';

const Int = z.number().int();
const Qty = z.number().int().min(-1_000_000_000_000).max(1_000_000_000_000);
const Paise = z.number().int().min(0).max(1_000_000_000_000);

// Quantities here are always in the product's base unit (milli).
export const ADJUSTMENT_REASONS = ['damage', 'theft', 'expiry', 'counting_error', 'other'] as const;
export const AdjustmentReason = z.enum(ADJUSTMENT_REASONS);

export const OpeningStockInput = z.object({
  lines: z.array(z.object({ productId: Ulid, qtyMilli: Qty.refine((q) => q > 0, 'must be more than zero'), unitCostPaise: Paise })).min(1).max(5000),
  note: z.string().trim().max(200).optional(),
});
export type OpeningStockInput = z.infer<typeof OpeningStockInput>;

export const AdjustStockInput = z.object({
  lines: z.array(z.object({ productId: Ulid, qtyMilli: Qty.refine((q) => q !== 0, 'cannot be zero'), reason: AdjustmentReason })).min(1).max(500),
  note: z.string().trim().max(200).optional(),
});
export type AdjustStockInput = z.infer<typeof AdjustStockInput>;

export const StockTakeInput = z.object({
  counts: z.array(z.object({ productId: Ulid, countedMilli: Qty.refine((q) => q >= 0, 'cannot be negative') })).min(1).max(5000),
  note: z.string().trim().max(200).optional(),
});
export type StockTakeInput = z.infer<typeof StockTakeInput>;

export const AdjustmentResult = z.object({
  adjustmentId: Ulid,
  kind: z.enum(['opening', 'adjustment', 'stock_take']),
  lines: z.array(z.object({ productId: Ulid, qtyMilli: Int, valuePaise: Int })),
  unchanged: Int,
});
export type AdjustmentResult = z.infer<typeof AdjustmentResult>;

export const StockRow = z.object({
  productId: Ulid, name: z.string(), sku: z.string().optional(), uomCode: z.string(), qtyMilli: Int, valuePaise: Int, avgCostPaise: Int,
  reorderLevelMilli: Int.optional(), low: z.boolean(),
});
export type StockRow = z.infer<typeof StockRow>;
export const StockListInput = z.object({
  query: z.string().max(64).optional(), lowOnly: z.boolean().default(false), categoryId: Ulid.optional(),
  limit: z.number().int().min(1).max(500).default(100), cursor: z.string().max(200).optional(),
});
export type StockListInput = z.infer<typeof StockListInput>;
export const StockPage = z.object({ items: z.array(StockRow), nextCursor: z.string().nullable() });
export type StockPage = z.infer<typeof StockPage>;

export const MovementRow = z.object({
  id: z.string(), type: z.string(), qtyMilli: Int, valuePaise: Int, unitCostPaise: Int, provisional: z.boolean(),
  refType: z.string(), refId: z.string(), reason: z.string().optional(), note: z.string().optional(), at: IsoDateTime, by: z.string(),
  balanceQtyMilli: Int, balanceValuePaise: Int,
});
export type MovementRow = z.infer<typeof MovementRow>;
export const MovementsInput = z.object({ productId: Ulid, limit: z.number().int().min(1).max(500).default(100), cursor: z.string().max(200).optional() });
export const MovementPage = z.object({ items: z.array(MovementRow), nextCursor: z.string().nullable() });
export type MovementPage = z.infer<typeof MovementPage>;

export const Valuation = z.object({
  rows: z.array(StockRow),
  totalValuePaise: Int,
  movementValuePaise: Int,
  balanced: z.boolean(),
  negativeCount: Int,
});
export type Valuation = z.infer<typeof Valuation>;

export const OPENING_IMPORT_FIELDS = ['sku', 'barcode', 'qty', 'unitCost'] as const;
export const OpeningImportField = z.enum(OPENING_IMPORT_FIELDS);
export type OpeningImportField = z.infer<typeof OpeningImportField>;
export const OpeningImportMapping = z.record(OpeningImportField, z.number().int().min(0).max(500));
export type OpeningImportMapping = z.infer<typeof OpeningImportMapping>;
export const OpeningImportPreviewInput = z
  .object({ fileName: z.string().trim().min(1).max(200).optional(), contentBase64: z.string().max(14_000_000).optional(), importId: Ulid.optional(), mapping: OpeningImportMapping.optional() })
  .refine((i) => i.importId !== undefined || (i.fileName !== undefined && i.contentBase64 !== undefined), { message: 'send a file, or the importId of an earlier preview' });
export const OpeningImportPreview = z.object({
  importId: Ulid, fileName: z.string(), columns: z.array(z.string()), mapping: OpeningImportMapping,
  counts: z.object({ total: Int, ok: Int, errors: Int }),
  rows: z.array(z.object({ line: Int, status: z.enum(['ok', 'error']), name: z.string().optional(), errors: z.record(z.string(), z.string()) })),
});
export type OpeningImportPreview = z.infer<typeof OpeningImportPreview>;
export const OpeningImportCommitInput = z.object({ importId: Ulid, commandId: Ulid });
