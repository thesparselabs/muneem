import type { ProductHit, ProductPage } from '@muneem/contracts';
import { resolvePrice, type PriceItem } from '@muneem/domain';
import type { Db } from '../open.js';
import { stmt } from '../statements.js';
import { getDefaultPriceList, getPriceItemsByProduct, toPriceItem } from './priceList.js';

type HitRow = {
  id: string; business_id: string; name: string; name_norm: string; sku: string | null; hsn_code: string | null;
  base_uom_id: string; price_is_inclusive: number; mrp_paise: number | null; gst_rate_bp: number;
  tax_treatment: ProductHit['taxTreatment']; is_active: number; brand_name: string | null; category_name: string | null;
  uom_id: string; uom_code: string; pack_qty_milli: number; barcode: string | null; factor_milli: number | null;
};

const HIT_SELECT = `SELECT p.id, p.business_id, p.name, p.name_norm, p.sku, p.hsn_code, p.base_uom_id, p.price_is_inclusive, p.mrp_paise,
    p.gst_rate_bp, p.tax_treatment, p.is_active, b.name AS brand_name, c.name AS category_name`;
const HIT_JOINS = `LEFT JOIN brand b ON b.id = p.brand_id LEFT JOIN category c ON c.id = p.category_id`;
const BASE_UOM = `, p.base_uom_id AS uom_id, u.code AS uom_code, 1000 AS pack_qty_milli,
    (SELECT code FROM barcode WHERE product_id = p.id AND deleted_at IS NULL ORDER BY is_primary DESC, code LIMIT 1) AS barcode,
    NULL AS factor_milli
  FROM product p JOIN uom u ON u.id = p.base_uom_id ${HIT_JOINS}`;

function toHit(r: HitRow, matchedBy: ProductHit['matchedBy'], on: string, items: readonly PriceItem[]): ProductHit {
  const price = resolvePrice(items, {
    uomId: r.uom_id, baseUomId: r.base_uom_id, qtyMilli: r.pack_qty_milli, on, ...(r.factor_milli !== null && { factorMilli: r.factor_milli }),
  });
  return {
    productId: r.id, name: r.name, uomId: r.uom_id, uomCode: r.uom_code, packQtyMilli: r.pack_qty_milli,
    pricePaise: price?.pricePaise ?? null, priceIsInclusive: price?.isInclusive ?? r.price_is_inclusive === 1,
    gstRateBp: r.gst_rate_bp, taxTreatment: r.tax_treatment, isActive: r.is_active === 1, matchedBy,
    ...(r.sku !== null && { sku: r.sku }),
    ...(r.hsn_code !== null && { hsnCode: r.hsn_code }),
    ...(r.brand_name !== null && { brandName: r.brand_name }),
    ...(r.category_name !== null && { categoryName: r.category_name }),
    ...(r.barcode !== null && { barcode: r.barcode }),
    ...(r.mrp_paise !== null && { mrpPaise: r.mrp_paise }),
  };
}

// Default-list prices for every row in one query, instead of two queries per row.
function toHits(db: Db, businessId: string, rows: readonly HitRow[], matchedBy: ProductHit['matchedBy'], on: string): ProductHit[] {
  const list = rows.length > 0 ? getDefaultPriceList(db, businessId) : null;
  const items = list ? getPriceItemsByProduct(db, list.id, [...new Set(rows.map((r) => r.id))]) : new Map();
  return rows.map((r) => toHit(r, matchedBy, on, (items.get(r.id) ?? []).map(toPriceItem)));
}

export function hitByBarcode(db: Db, businessId: string, code: string, on: string): ProductHit | null {
  const r = stmt(db, `${HIT_SELECT}, COALESCE(bc.uom_id, p.base_uom_id) AS uom_id, u.code AS uom_code, bc.pack_qty_milli, bc.code AS barcode,
      cv.factor_milli
    FROM barcode bc
    JOIN product p ON p.id = bc.product_id AND p.deleted_at IS NULL AND p.is_active = 1
    JOIN uom u ON u.id = COALESCE(bc.uom_id, p.base_uom_id)
    LEFT JOIN uom_conversion cv ON cv.product_id = p.id AND cv.from_uom_id = bc.uom_id AND cv.deleted_at IS NULL
    ${HIT_JOINS}
    WHERE bc.business_id = ? AND bc.code = ? AND bc.deleted_at IS NULL`).get(businessId, code) as HitRow | undefined;
  return r ? toHits(db, businessId, [r], 'barcode', on)[0]! : null;
}

export function hitBySku(db: Db, businessId: string, sku: string, on: string): ProductHit | null {
  const r = stmt(db, `${HIT_SELECT} ${BASE_UOM}
    WHERE p.business_id = ? AND p.sku = ? AND p.is_active = 1 AND p.deleted_at IS NULL`).get(businessId, sku) as HitRow | undefined;
  return r ? toHits(db, businessId, [r], 'sku', on)[0]! : null;
}

// Upper bound for a prefix range scan: every string starting with `prefix` sorts below prefix + U+FFFF.
export function hitsByNamePrefix(db: Db, businessId: string, prefix: string, limit: number, on: string): ProductHit[] {
  const rows = stmt(db, `${HIT_SELECT} ${BASE_UOM}
    WHERE p.business_id = ? AND p.is_active = 1 AND p.name_norm >= ? AND p.name_norm < ? AND p.deleted_at IS NULL
    ORDER BY p.name_norm, p.id LIMIT ?`).all(businessId, prefix, prefix + '￿', limit) as HitRow[];
  return toHits(db, businessId, rows, 'name', on);
}

export function toFtsQuery(query: string): string | null {
  const tokens = query.split(/\s+/u).filter(Boolean).map((t) => `"${t.replaceAll('"', '""')}"*`);
  return tokens.length > 0 ? tokens.join(' ') : null;
}

export function hitsByText(db: Db, businessId: string, query: string, limit: number, on: string): ProductHit[] {
  const match = toFtsQuery(query);
  if (!match) return [];
  const rows = stmt(db, `${HIT_SELECT} ${BASE_UOM}
    JOIN (SELECT product_id, rank FROM product_fts WHERE product_fts MATCH ? AND business_id = ? ORDER BY rank LIMIT ?) f ON f.product_id = p.id
    WHERE p.is_active = 1 AND p.deleted_at IS NULL
    ORDER BY f.rank, p.name_norm`).all(match, businessId, limit * 2) as HitRow[];
  return toHits(db, businessId, rows.slice(0, limit), 'text', on);
}

type Cursor = { n: string; id: string };
const encodeCursor = (c: Cursor): string => Buffer.from(JSON.stringify(c)).toString('base64url');
function decodeCursor(s: string | undefined): Cursor | null {
  if (!s) return null;
  try {
    const c = JSON.parse(Buffer.from(s, 'base64url').toString('utf8')) as Cursor;
    return typeof c.n === 'string' && typeof c.id === 'string' ? c : null;
  } catch {
    return null;
  }
}

export interface ListFilter { cursor?: string | undefined; limit: number; categoryId?: string | undefined; brandId?: string | undefined; includeInactive: boolean }

export function listProductHits(db: Db, businessId: string, f: ListFilter, on: string): ProductPage {
  const after = decodeCursor(f.cursor);
  const rows = stmt(db, `${HIT_SELECT} ${BASE_UOM}
    WHERE p.business_id = @businessId AND p.deleted_at IS NULL
      AND (@includeInactive = 1 OR p.is_active = 1)
      AND (@categoryId IS NULL OR p.category_id = @categoryId)
      AND (@brandId IS NULL OR p.brand_id = @brandId)
      AND (@afterN IS NULL OR (p.name_norm, p.id) > (@afterN, @afterId))
    ORDER BY p.name_norm, p.id LIMIT @limit`).all({
    businessId, includeInactive: f.includeInactive ? 1 : 0, categoryId: f.categoryId ?? null, brandId: f.brandId ?? null,
    afterN: after?.n ?? null, afterId: after?.id ?? null, limit: f.limit + 1,
  }) as HitRow[];
  const page = rows.slice(0, f.limit);
  const last = page.at(-1);
  return {
    items: toHits(db, businessId, page, 'list', on),
    nextCursor: rows.length > f.limit && last ? encodeCursor({ n: last.name_norm, id: last.id }) : null,
  };
}
