import type { ReconciliationRow } from '@muneem/contracts';
import type { Db } from '../open.js';
import { stmt } from '../statements.js';

type Row = Omit<ReconciliationRow, 'viaSync'> & { viaSync: number };

// FR-087: every outgoing movement that left a product below zero, in replay order (ADR-0040), with the sale and terminal behind it.
export function stockReconciliation(db: Db, businessId: string, localDeviceId: string, limit: number): ReconciliationRow[] {
  const rows = stmt(db, `WITH running AS (
      SELECT m.*, SUM(m.signed_qty_milli) OVER (PARTITION BY m.warehouse_id, m.product_id ORDER BY m.occurred_at, m.device_id, m.id
          ROWS UNBOUNDED PRECEDING) AS balance,
        SUM(m.signed_qty_milli) OVER (PARTITION BY m.warehouse_id, m.product_id) AS current_qty
      FROM stock_movement m WHERE m.business_id = @businessId)
    SELECT r.product_id AS productId, p.name AS productName, u.code AS uomCode, r.warehouse_id AS warehouseId, w.name AS warehouseName,
      r.current_qty AS currentQtyMilli, r.id AS movementId, r.movement_type AS movementType, r.ref_type AS refType, r.ref_id AS refId,
      s.doc_number AS docNumber, t.code AS terminalCode, r.device_id AS deviceId, r.device_id <> @localDeviceId AS viaSync, r.occurred_at AS occurredAt,
      r.signed_qty_milli AS qtyMilli, r.balance AS balanceAfterMilli
    FROM running r
    JOIN product p ON p.id = r.product_id
    JOIN uom u ON u.id = p.base_uom_id
    JOIN warehouse w ON w.id = r.warehouse_id
    LEFT JOIN sale s ON r.ref_type = 'sale' AND s.id = r.ref_id
    LEFT JOIN terminal t ON t.id = s.terminal_id
    WHERE r.balance < 0 AND r.signed_qty_milli < 0
    ORDER BY r.occurred_at DESC, r.id LIMIT @limit`).all({ businessId, localDeviceId, limit }) as Row[];
  return rows.map((r) => ({ ...r, viaSync: r.viaSync === 1 }));
}
