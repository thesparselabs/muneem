import { normalizeName } from '@muneem/domain';
import { reindexBrand, indexProduct } from '../../repositories/productSearchIndex.js';
import { stmt } from '../../statements.js';
import { resolver } from './aliases.js';
import { hasUnsentEdit, type ApplyContext, type Payload } from './context.js';
import { applyMaster, bool, type MasterSpec } from './master.js';
import { exists, insertRow, pick, syncedColumns, updateRow, versioned, type Row } from './rows.js';

const one = (ctx: ApplyContext, sql: string, ...args: unknown[]): string | null =>
  (stmt(ctx.db, sql).pluck().get(...args) as string | undefined) ?? null;
const ref = (ctx: ApplyContext) => resolver(ctx.db, ctx.businessId);

export const UOM: MasterSpec = {
  table: 'uom',
  columns: (_ctx, p) => pick(p, { code: 'code', name: 'name', decimals: 'decimals' }, true),
  natural: { alias: 'uom', find: (ctx, r) => one(ctx, 'SELECT id FROM uom WHERE business_id = ? AND code = ? AND deleted_at IS NULL', ctx.businessId, r.code) },
};

export const CATEGORY: MasterSpec = {
  table: 'category',
  columns: (ctx, p) => ({ parent_id: ref(ctx)('category', p.parentId), name: p.name, name_norm: normalizeName(String(p.name)) }),
  natural: {
    alias: 'category',
    find: (ctx, r) => one(ctx, `SELECT id FROM category WHERE business_id = ? AND COALESCE(parent_id, '') = COALESCE(?, '') AND name_norm = ? AND deleted_at IS NULL`,
      ctx.businessId, r.parent_id, r.name_norm),
  },
};

export const BRAND: MasterSpec = {
  table: 'brand',
  columns: (_ctx, p) => ({ name: p.name, name_norm: normalizeName(String(p.name)) }),
  natural: { alias: 'brand', find: (ctx, r) => one(ctx, 'SELECT id FROM brand WHERE business_id = ? AND name_norm = ? AND deleted_at IS NULL', ctx.businessId, r.name_norm) },
  after: (ctx, id) => reindexBrand(ctx.db, id),
};

// ADR-0040: the default price list is matched by kind, any other by name.
export const PRICE_LIST: MasterSpec = {
  table: 'price_list',
  columns: (_ctx, p) => ({ ...pick(p, { name: 'name', kind: 'kind' }, false), ...('isDefault' in p && { is_default: bool(p.isDefault) }) }),
  natural: {
    alias: 'price_list',
    find: (ctx, r) => (r.is_default === 1 ? one(ctx, 'SELECT id FROM price_list WHERE business_id = ? AND is_default = 1 AND deleted_at IS NULL', ctx.businessId) : null)
      ?? one(ctx, 'SELECT id FROM price_list WHERE business_id = ? AND name = ? AND deleted_at IS NULL', ctx.businessId, r.name),
  },
};

const PRODUCT_COLUMNS = {
  name: 'name', sku: 'sku', hsn_code: 'hsn_code', tax_treatment: 'tax_treatment', gst_rate_bp: 'gst_rate_bp', cess_rate_bp: 'cess_rate_bp',
  cess_per_unit_paise: 'cess_per_unit_paise', price_is_inclusive: 'price_is_inclusive', mrp_paise: 'mrp_paise', purchase_price_paise: 'purchase_price_paise',
  allow_negative_stock: 'allow_negative_stock', reorder_level_milli: 'reorder_level_milli', isActive: 'is_active',
} as const;

// The selling price lives in price_list_item and arrives on its own; the barcode and conversion lists do too.
export const PRODUCT: MasterSpec = {
  table: 'product',
  columns: (ctx, p) => {
    const r = ref(ctx);
    const row: Row = pick(p, PRODUCT_COLUMNS, false);
    if ('name' in p) row.name_norm = normalizeName(String(p.name));
    if ('category_id' in p) row.category_id = r('category', p.category_id);
    if ('brand_id' in p) row.brand_id = r('brand', p.brand_id);
    if ('base_uom_id' in p) row.base_uom_id = r('uom', p.base_uom_id);
    return row;
  },
  after: (ctx, id) => indexProduct(ctx.db, id),
};

const liveBarcode = (ctx: ApplyContext, code: unknown): string | null =>
  one(ctx, 'SELECT id FROM barcode WHERE business_id = ? AND code = ? AND deleted_at IS NULL', ctx.businessId, code);

// A code already live here on another product stays with it; the cloud lists the clash as a review item (ADR-0041).
export function applyBarcode(ctx: ApplyContext): void {
  const p = ctx.change.payload;
  if (ctx.change.op === 'upsert' && !exists(ctx.db, 'barcode', ctx.change.entityId)) {
    const holder = liveBarcode(ctx, p.code);
    if (holder && holder !== ctx.change.entityId) return;
  }
  applyMaster({
    table: 'barcode',
    columns: (c, x) => ({
      product_id: x.productId, code: x.code, symbology: x.symbology ?? 'EAN13', uom_id: ref(c)('uom', x.uomId), pack_qty_milli: x.packQtyMilli ?? 1000,
      is_primary: bool(x.isPrimary) ?? 0,
    }),
  }, ctx);
}

export function applyConversion(ctx: ApplyContext): void {
  const p = ctx.change.payload;
  const r = ref(ctx);
  if (ctx.change.op === 'upsert' && !exists(ctx.db, 'uom_conversion', ctx.change.entityId)
    && one(ctx, 'SELECT id FROM uom_conversion WHERE product_id = ? AND from_uom_id = ? AND deleted_at IS NULL', p.productId, r('uom', p.fromUomId))) return;
  applyMaster({
    table: 'uom_conversion',
    columns: () => ({ product_id: p.productId, from_uom_id: r('uom', p.fromUomId), to_uom_id: r('uom', p.toUomId), factor_milli: p.factorMilli }),
  }, ctx);
}

interface PriceItem { id: string; uomId: string; minQtyMilli: number; pricePaise: number; isInclusive: boolean; effectiveFrom: string; effectiveTo?: string }

// One product's prices in one list are replaced whole, as the origin did (replacePriceItems).
export function applyPriceItems(ctx: ApplyContext): void {
  const { db, businessId, change } = ctx;
  const p = change.payload as Payload & { priceListId: string; productId: string; items?: PriceItem[] };
  if (hasUnsentEdit(db, businessId, 'price_list_item', change.entityId)) return;
  const r = ref(ctx);
  const listId = r('price_list', p.priceListId)!;
  const items = change.op === 'delete' ? [] : p.items ?? [];
  const keep = new Set(items.map((i) => i.id));
  const at = syncedColumns(ctx, p).updated_at;
  const live = stmt(db, 'SELECT id FROM price_list_item WHERE price_list_id = ? AND product_id = ? AND deleted_at IS NULL').pluck().all(listId, p.productId) as string[];
  for (const id of live) if (!keep.has(id)) updateRow(db, 'price_list_item', id, { deleted_at: at, updated_at: at, ...versioned(ctx) });
  for (const i of items) {
    const row = {
      price_list_id: listId, product_id: p.productId, uom_id: r('uom', i.uomId), min_qty_milli: i.minQtyMilli, price_paise: i.pricePaise,
      is_inclusive: i.isInclusive ? 1 : 0, effective_from: i.effectiveFrom, effective_to: i.effectiveTo ?? null, deleted_at: null,
    };
    if (exists(db, 'price_list_item', i.id)) updateRow(db, 'price_list_item', i.id, { ...row, ...versioned(ctx) });
    else insertRow(db, 'price_list_item', { id: i.id, business_id: businessId, ...row, ...syncedColumns(ctx, p), ...versioned(ctx) });
  }
}

// Each branch's store is matched by its code, so a device that stocked the branch first keeps its own (ADR-0040).
export const WAREHOUSE: MasterSpec = {
  table: 'warehouse',
  columns: (_ctx, p) => ({ branch_id: p.branchId, code: p.code, name: p.name }),
  inserted: (ctx, p) => ({
    is_default: one(ctx, 'SELECT id FROM warehouse WHERE branch_id = ? AND is_default = 1 AND deleted_at IS NULL', p.branchId) ? 0 : 1,
  }),
  natural: { alias: 'warehouse', find: (ctx, r) => one(ctx, 'SELECT id FROM warehouse WHERE business_id = ? AND code = ? AND deleted_at IS NULL', ctx.businessId, r.code) },
};
