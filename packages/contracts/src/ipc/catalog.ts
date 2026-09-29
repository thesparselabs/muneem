import { z } from 'zod';
import { BusinessDate, IsoDateTime, Ulid } from './schemas.js';

const Paise = z.number().int().min(0).max(1_000_000_000_000);
const QtyMilli = z.number().int().min(0).max(1_000_000_000_000);
const RateBp = z.number().int().min(0).max(10_000);
const Name = (max: number) => z.string().trim().min(1).max(max);
const Version = z.number().int();

export const SYMBOLOGY_VALUES = ['EAN13', 'EAN8', 'UPCA', 'CODE128'] as const;
export const Symbology = z.enum(SYMBOLOGY_VALUES);
export const TaxTreatment = z.enum(['taxable', 'nil_rated', 'exempt', 'non_gst', 'zero_rated']);
export const PriceListKind = z.enum(['retail', 'wholesale', 'distributor', 'custom']);

export const UomInput = z.object({
  code: z.string().regex(/^[A-Z0-9]{1,8}$/, 'use 1–8 capital letters or digits'),
  name: Name(40),
  decimals: z.number().int().min(0).max(3).default(0),
});
export const Uom = UomInput.extend({ id: Ulid, businessId: Ulid, version: Version });
export type Uom = z.infer<typeof Uom>;

export const CategoryInput = z.object({ name: Name(80), parentId: Ulid.nullable().default(null) });
export const Category = CategoryInput.extend({ id: Ulid, businessId: Ulid, version: Version });
export type Category = z.infer<typeof Category>;

export const BrandInput = z.object({ name: Name(80) });
export const Brand = BrandInput.extend({ id: Ulid, businessId: Ulid, version: Version });
export type Brand = z.infer<typeof Brand>;

export const BarcodeInput = z.object({
  code: z.string().trim().min(1).max(48),
  symbology: Symbology.optional(),
  uomId: Ulid.nullable().default(null),
  packQtyMilli: z.number().int().min(1).max(1_000_000_000).default(1000),
  isPrimary: z.boolean().default(false),
});
export const Barcode = BarcodeInput.extend({ id: Ulid, symbology: Symbology });
export type Barcode = z.infer<typeof Barcode>;

export const UomConversionInput = z.object({
  fromUomId: Ulid,
  factorMilli: z.number().int().min(1).max(1_000_000_000),
});
export const UomConversion = UomConversionInput.extend({ id: Ulid, toUomId: Ulid });
export type UomConversion = z.infer<typeof UomConversion>;

export const ProductInput = z.object({
  name: Name(160),
  sku: z.string().trim().min(1).max(40).optional(),
  hsnCode: z.string().regex(/^\d{4,8}$/, 'HSN/SAC is 4–8 digits').optional(),
  categoryId: Ulid.optional(),
  brandId: Ulid.optional(),
  baseUomId: Ulid,
  taxTreatment: TaxTreatment.default('taxable'),
  gstRateBp: RateBp.default(0),
  cessRateBp: RateBp.default(0),
  cessPerUnitPaise: Paise.default(0),
  priceIsInclusive: z.boolean().default(true),
  mrpPaise: Paise.optional(),
  purchasePricePaise: Paise.optional(),
  sellingPricePaise: Paise.optional(),
  reorderLevelMilli: QtyMilli.optional(),
  allowNegativeStock: z.boolean().optional(),
  barcodes: z.array(BarcodeInput).max(20).default([]),
  conversions: z.array(UomConversionInput).max(10).default([]),
});
export type ProductInput = z.infer<typeof ProductInput>;

export const Product = ProductInput.omit({ barcodes: true, conversions: true }).extend({
  id: Ulid,
  businessId: Ulid,
  isActive: z.boolean(),
  barcodes: z.array(Barcode),
  conversions: z.array(UomConversion),
  createdAt: IsoDateTime,
  updatedAt: IsoDateTime,
  version: Version,
});
export type Product = z.infer<typeof Product>;

export const ProductUpdate = ProductInput.extend({ id: Ulid, version: Version });
export type ProductUpdate = z.infer<typeof ProductUpdate>;

export const ProductHit = z.object({
  productId: Ulid,
  name: z.string(),
  sku: z.string().optional(),
  hsnCode: z.string().optional(),
  brandName: z.string().optional(),
  categoryName: z.string().optional(),
  uomId: Ulid,
  uomCode: z.string(),
  packQtyMilli: z.number().int(),
  barcode: z.string().optional(),
  pricePaise: z.number().int().nullable(),
  priceIsInclusive: z.boolean(),
  mrpPaise: z.number().int().optional(),
  gstRateBp: z.number().int(),
  taxTreatment: TaxTreatment,
  isActive: z.boolean(),
  matchedBy: z.enum(['barcode', 'sku', 'name', 'text', 'list']),
});
export type ProductHit = z.infer<typeof ProductHit>;

export const ProductSearchInput = z.object({
  query: z.string().max(64),
  limit: z.number().int().min(1).max(50).default(20),
  mode: z.enum(['auto', 'barcode', 'name', 'sku']).default('auto'),
});
export type ProductSearchInput = z.infer<typeof ProductSearchInput>;

export const ProductListInput = z.object({
  cursor: z.string().max(200).optional(),
  limit: z.number().int().min(1).max(200).default(50),
  categoryId: Ulid.optional(),
  brandId: Ulid.optional(),
  includeInactive: z.boolean().default(false),
});
export type ProductListInput = z.infer<typeof ProductListInput>;
export const ProductPage = z.object({ items: z.array(ProductHit), nextCursor: z.string().nullable() });
export type ProductPage = z.infer<typeof ProductPage>;

export const PriceListInput = z.object({ name: Name(60), kind: PriceListKind });
export const PriceList = PriceListInput.extend({ id: Ulid, businessId: Ulid, isDefault: z.boolean(), version: Version });
export type PriceList = z.infer<typeof PriceList>;

export const PriceListItemInput = z.object({
  uomId: Ulid,
  minQtyMilli: QtyMilli.default(0),
  pricePaise: Paise,
  isInclusive: z.boolean().default(true),
  effectiveFrom: BusinessDate,
  effectiveTo: BusinessDate.optional(),
});
export const PriceListItem = PriceListItemInput.extend({ id: Ulid, priceListId: Ulid, productId: Ulid });
export type PriceListItem = z.infer<typeof PriceListItem>;

export const PriceItemsQuery = z.object({ priceListId: Ulid, productId: Ulid });
export const SetPriceItems = PriceItemsQuery.extend({ items: z.array(PriceListItemInput).max(50) });
export type SetPriceItems = z.infer<typeof SetPriceItems>;

export const IMPORT_FIELDS = [
  'name', 'sku', 'barcodes', 'hsnCode', 'category', 'brand', 'uom', 'mrp', 'sellingPrice', 'purchasePrice', 'gstRate', 'reorderLevel',
] as const;
export const ImportField = z.enum(IMPORT_FIELDS);
export type ImportField = z.infer<typeof ImportField>;
export const ImportMapping = z.record(ImportField, z.number().int().min(0).max(500));
export type ImportMapping = z.infer<typeof ImportMapping>;

export const IMPORT_MAX_BYTES = 10 * 1024 * 1024;
export const IMPORT_MAX_ROWS = 20_000;

export const ImportPreviewInput = z
  .object({
    fileName: z.string().trim().min(1).max(200).optional(),
    contentBase64: z.string().max(Math.ceil((IMPORT_MAX_BYTES * 4) / 3) + 4).optional(),
    importId: Ulid.optional(),
    mapping: ImportMapping.optional(),
  })
  .refine((i) => i.importId !== undefined || (i.fileName !== undefined && i.contentBase64 !== undefined), {
    message: 'send a file, or the importId of an earlier preview',
  });
export type ImportPreviewInput = z.infer<typeof ImportPreviewInput>;

export const ImportRow = z.object({
  line: z.number().int(),
  status: z.enum(['ok', 'error', 'duplicate']),
  name: z.string().optional(),
  sku: z.string().optional(),
  existingProductId: Ulid.optional(),
  errors: z.record(z.string(), z.string()),
});
export type ImportRow = z.infer<typeof ImportRow>;

export const ImportPreview = z.object({
  importId: Ulid,
  fileName: z.string(),
  columns: z.array(z.string()),
  mapping: ImportMapping,
  counts: z.object({ total: z.number().int(), ok: z.number().int(), errors: z.number().int(), duplicates: z.number().int() }),
  rows: z.array(ImportRow),
  willCreate: z.object({ categories: z.array(z.string()), brands: z.array(z.string()), uoms: z.array(z.string()) }),
});
export type ImportPreview = z.infer<typeof ImportPreview>;

export const ImportCommitInput = z.object({
  importId: Ulid,
  duplicatePolicy: z.enum(['skip', 'update']),
  commandId: Ulid,
});
export type ImportCommitInput = z.infer<typeof ImportCommitInput>;

export const ImportSummary = z.object({
  created: z.number().int(),
  updated: z.number().int(),
  skippedDuplicates: z.number().int(),
  skippedErrors: z.number().int(),
  categoriesCreated: z.number().int(),
  brandsCreated: z.number().int(),
  uomsCreated: z.number().int(),
});
export type ImportSummary = z.infer<typeof ImportSummary>;
