import { insertAdjustmentHeader } from '../../repositories/inventory.js';
import { resolver } from './aliases.js';
import type { ApplyContext, Payload } from './context.js';
import { applyJournal, applyJournals } from './journals.js';
import { exists, insertRow } from './rows.js';

interface Movement {
  id: string; productId: string; type: string; qtyMilli: number; valuePaise: number; unitCostPaise: number; provisional: boolean; refType: string; refId: string;
  refLineId: string | null; reasonCode: string | null; warehouseId: string; occurredAt: string; deviceId?: string;
}

// ADR-0040: movements are stored with their values and unit costs as facts, never re-costed; the levels follow when the page is in.
export function applyMovements(ctx: ApplyContext, movements: unknown): void {
  if (!Array.isArray(movements)) return;
  const warehouse = (id: string) => resolver(ctx.db, ctx.businessId)('warehouse', id)!;
  for (const m of movements as Movement[]) {
    if (exists(ctx.db, 'stock_movement', m.id)) continue;
    const warehouseId = warehouse(m.warehouseId);
    insertRow(ctx.db, 'stock_movement', {
      id: m.id, business_id: ctx.businessId, warehouse_id: warehouseId, product_id: m.productId, movement_type: m.type, signed_qty_milli: m.qtyMilli,
      unit_cost_paise: m.unitCostPaise, value_paise: m.valuePaise, cost_provisional: m.provisional ? 1 : 0, ref_type: m.refType, ref_id: m.refId,
      ref_line_id: m.refLineId, reason_code: m.reasonCode, note: null, occurred_at: m.occurredAt, created_at: m.occurredAt, updated_at: m.occurredAt,
      created_by: ctx.actor.userId, device_id: m.deviceId ?? ctx.actor.deviceId, sync_state: 'synced',
    });
    ctx.touched.add(warehouseId, m.productId);
  }
}

// A receipt's cost corrections travel with it: their movements, then their journals (ADR-0040).
export function applyCorrections(ctx: ApplyContext, p: Payload): void {
  applyMovements(ctx, p.correctionMovements);
  applyJournals(ctx, p.corrections);
}

// Opening stock, adjustments and stock takes: the header, the movements, the journal and any cost corrections.
export function applyStockDocument(ctx: ApplyContext): void {
  const p = ctx.change.payload;
  if (!exists(ctx.db, 'stock_adjustment', ctx.change.entityId)) {
    insertAdjustmentHeader(ctx.db, {
      id: ctx.change.entityId, businessId: ctx.businessId, warehouseId: resolver(ctx.db, ctx.businessId)('warehouse', p.warehouseId)!,
      kind: p.kind as 'opening' | 'adjustment' | 'stock_take', note: (p.note as string | null) ?? null,
    }, ctx.actor);
  }
  applyMovements(ctx, p.movements);
  applyJournal(ctx, p.journal);
  applyCorrections(ctx, p);
}
