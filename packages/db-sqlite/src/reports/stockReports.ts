import type { Db } from '../open.js';
import { stmt } from '../statements.js';

export interface StockMovementRow {
  productId: string; name: string; uomCode: string; openingQtyMilli: number; inQtyMilli: number; outQtyMilli: number; closingQtyMilli: number; closingValuePaise: number;
}

// Each product's stock across a range by the device's local date of each movement; a branch narrows it to that branch's warehouses.
export function stockMovementSummary(db: Db, r: { businessId: string; from: string; to: string; branchId: string | null }): StockMovementRow[] {
  return stmt(db, `WITH m AS (
      SELECT m.product_id, date(m.occurred_at, 'localtime') AS day, m.signed_qty_milli AS qty, m.value_paise AS value
      FROM stock_movement m JOIN warehouse w ON w.id = m.warehouse_id
      WHERE m.business_id = @businessId AND (@branchId IS NULL OR w.branch_id = @branchId)),
    t AS (
      SELECT product_id,
        SUM(CASE WHEN day < @from THEN qty ELSE 0 END) AS opening,
        SUM(CASE WHEN day BETWEEN @from AND @to AND qty > 0 THEN qty ELSE 0 END) AS qin,
        SUM(CASE WHEN day BETWEEN @from AND @to AND qty < 0 THEN -qty ELSE 0 END) AS qout,
        SUM(CASE WHEN day <= @to THEN value ELSE 0 END) AS value,
        SUM(CASE WHEN day BETWEEN @from AND @to THEN 1 ELSE 0 END) AS moves
      FROM m GROUP BY product_id)
    SELECT p.id AS productId, p.name, u.code AS uomCode, t.opening AS openingQtyMilli, t.qin AS inQtyMilli, t.qout AS outQtyMilli,
      t.opening + t.qin - t.qout AS closingQtyMilli, t.value AS closingValuePaise
    FROM t JOIN product p ON p.id = t.product_id JOIN uom u ON u.id = p.base_uom_id
    WHERE t.moves > 0 OR t.opening <> 0 OR t.value <> 0
    ORDER BY p.name_norm, p.id`).all(r) as StockMovementRow[];
}
