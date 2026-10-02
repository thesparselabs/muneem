import type { MovementPage, StockPage, StockRow, Valuation } from '@muneem/contracts';
import { normalizeName } from '@muneem/domain';
import type { Db } from '../open.js';
import { stmt } from '../statements.js';

type Cursor = Record<string, string | number>;
const encode = (c: Cursor): string => Buffer.from(JSON.stringify(c)).toString('base64url');
function decode<T extends Cursor>(s: string | undefined): T | null {
  if (!s) return null;
  try { return JSON.parse(Buffer.from(s, 'base64url').toString('utf8')) as T; } catch { return null; }
}

type StockRowDb = {
  id: string; name: string; name_norm: string; sku: string | null; uom_code: string; qty: number; value: number; avg: number; reorder: number | null;
};
const toStockRow = (r: StockRowDb): StockRow => ({
  productId: r.id, name: r.name, uomCode: r.uom_code, qtyMilli: r.qty, valuePaise: r.value, avgCostPaise: r.avg,
  low: r.reorder !== null && r.qty <= r.reorder,
  ...(r.sku !== null && { sku: r.sku }), ...(r.reorder !== null && { reorderLevelMilli: r.reorder }),
});

const STOCK_SELECT = `SELECT p.id, p.name, p.name_norm, p.sku, u.code AS uom_code, p.reorder_level_milli AS reorder,
    COALESCE(SUM(sl.qty_milli), 0) AS qty, COALESCE(SUM(sl.value_paise), 0) AS value,
    CASE WHEN COALESCE(SUM(sl.qty_milli), 0) > 0 THEN (COALESCE(SUM(sl.value_paise), 0) * 1000 + COALESCE(SUM(sl.qty_milli), 0) / 2) / COALESCE(SUM(sl.qty_milli), 0) ELSE 0 END AS avg
  FROM product p JOIN uom u ON u.id = p.base_uom_id
  LEFT JOIN stock_level sl ON sl.business_id = p.business_id AND sl.product_id = p.id`;

// Stock per product summed over the business's warehouses (one per branch until multi-warehouse lands). Low = on hand ≤ reorder level.
export function listStock(db: Db, businessId: string, f: { query?: string | undefined; lowOnly: boolean; categoryId?: string | undefined; limit: number; cursor?: string | undefined }): StockPage {
  const after = decode<{ n: string; id: string }>(f.cursor);
  const norm = f.query ? normalizeName(f.query) : null;
  const rows = stmt(db, `${STOCK_SELECT}
    WHERE p.business_id = @businessId AND p.deleted_at IS NULL AND p.is_active = 1
      AND (@norm IS NULL OR (p.name_norm >= @norm AND p.name_norm < @normEnd) OR p.sku = @raw)
      AND (@categoryId IS NULL OR p.category_id = @categoryId)
      AND (@afterN IS NULL OR (p.name_norm, p.id) > (@afterN, @afterId))
    GROUP BY p.id
    HAVING @lowOnly = 0 OR (p.reorder_level_milli IS NOT NULL AND COALESCE(SUM(sl.qty_milli), 0) <= p.reorder_level_milli)
    ORDER BY p.name_norm, p.id LIMIT @limit`).all({
    businessId, norm, normEnd: norm === null ? null : `${norm}￿`, raw: f.query ?? null, categoryId: f.categoryId ?? null,
    afterN: after?.n ?? null, afterId: after?.id ?? null, lowOnly: f.lowOnly ? 1 : 0, limit: f.limit + 1,
  }) as StockRowDb[];
  const page = rows.slice(0, f.limit);
  const last = page.at(-1);
  return { items: page.map(toStockRow), nextCursor: rows.length > f.limit && last ? encode({ n: last.name_norm, id: last.id }) : null };
}

// Newest first, each with the running quantity and value after it (FR-024 traceability).
export function productMovements(db: Db, businessId: string, productId: string, f: { limit: number; cursor?: string | undefined }): MovementPage {
  const after = decode<{ r: number }>(f.cursor);
  const rows = stmt(db, `SELECT * FROM (
      SELECT m.rowid AS r, m.id, m.movement_type, m.signed_qty_milli, m.value_paise, m.unit_cost_paise, m.cost_provisional, m.ref_type, m.ref_id,
        m.reason_code, m.note, m.created_at, m.created_by,
        SUM(m.signed_qty_milli) OVER (ORDER BY m.rowid) AS bal_qty, SUM(m.value_paise) OVER (ORDER BY m.rowid) AS bal_value
      FROM stock_movement m WHERE m.business_id = @businessId AND m.product_id = @productId)
    WHERE @after IS NULL OR r < @after ORDER BY r DESC LIMIT @limit`).all({ businessId, productId, after: after?.r ?? null, limit: f.limit + 1 }) as {
    r: number; id: string; movement_type: string; signed_qty_milli: number; value_paise: number; unit_cost_paise: number; cost_provisional: number;
    ref_type: string; ref_id: string; reason_code: string | null; note: string | null; created_at: string; created_by: string; bal_qty: number; bal_value: number;
  }[];
  const page = rows.slice(0, f.limit);
  return {
    items: page.map((m) => ({
      id: m.id, type: m.movement_type, qtyMilli: m.signed_qty_milli, valuePaise: m.value_paise, unitCostPaise: m.unit_cost_paise,
      provisional: m.cost_provisional === 1, refType: m.ref_type, refId: m.ref_id, at: m.created_at, by: m.created_by,
      balanceQtyMilli: m.bal_qty, balanceValuePaise: m.bal_value,
      ...(m.reason_code !== null && { reason: m.reason_code }), ...(m.note !== null && { note: m.note }),
    })),
    nextCursor: rows.length > f.limit && page.at(-1) ? encode({ r: page.at(-1)!.r }) : null,
  };
}

// The inventory sub-ledger (ADR-0018): Σ cached levels must equal Σ movement values; Stage 6 ties this to account 1400.
export function stockValuation(db: Db, businessId: string): Valuation {
  const rows = (stmt(db, `${STOCK_SELECT}
    WHERE p.business_id = @businessId AND p.deleted_at IS NULL
    GROUP BY p.id HAVING COALESCE(SUM(sl.qty_milli), 0) <> 0 OR COALESCE(SUM(sl.value_paise), 0) <> 0
    ORDER BY p.name_norm, p.id`).all({ businessId }) as StockRowDb[]).map(toStockRow);
  const totalValuePaise = rows.reduce((s, r) => s + r.valuePaise, 0);
  const movementValuePaise = stmt(db, 'SELECT COALESCE(SUM(value_paise), 0) FROM stock_movement WHERE business_id = ?').pluck().get(businessId) as number;
  return { rows, totalValuePaise, movementValuePaise, balanced: totalValuePaise === movementValuePaise, negativeCount: rows.filter((r) => r.qtyMilli < 0).length };
}
