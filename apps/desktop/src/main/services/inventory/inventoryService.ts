import { AppError, type AdjustmentResult, type AdjustStockInput, type OpeningStockInput, type StockTakeInput } from '@muneem/contracts';
import { averageCostPaise, divRound, newUlid } from '@muneem/domain';
import {
  ensureDefaultWarehouse, getProduct, hasMovements, insertAdjustmentHeader, movementsForRef, postMovement, productFallbackCost, recordChange,
  stockState, withTransaction, type PostedMovement, type ReasonCode,
} from '@muneem/db-sqlite';
import type { PosContext } from '../pos/posContext.js';

type Kind = AdjustmentResult['kind'];
interface Line { productId: string; qtyMilli: number; reason: ReasonCode; receiptValuePaise?: number }

// Opening stock, adjustments and stock takes are all "adjustment documents": a header plus one movement per line (ADR-0021).
export class InventoryService {
  constructor(private readonly ctx: PosContext) {}

  warehouseId(): string {
    const till = this.ctx.till();
    return withTransaction(this.ctx.db(), () => ensureDefaultWarehouse(this.ctx.db(), till.businessId, till.branchId, this.ctx.actor()));
  }

  setOpeningStock(input: OpeningStockInput): AdjustmentResult {
    return withTransaction(this.ctx.db(), () => {
      const warehouseId = this.warehouseId();
      const fields: Record<string, string> = {};
      input.lines.forEach((l, i) => {
        this.product(l.productId);
        if (hasMovements(this.ctx.db(), this.ctx.businessId(), warehouseId, l.productId)) fields[`lines.${i}.productId`] = 'already has stock movements; use an adjustment instead';
      });
      if (new Set(input.lines.map((l) => l.productId)).size !== input.lines.length) fields.lines = 'a product is listed twice';
      if (Object.keys(fields).length > 0) throw new AppError('VALIDATION_FAILED', 'Opening stock cannot be recorded for some products', fields);
      return this.post('opening', warehouseId, input.note, input.lines.map((l) => ({
        productId: l.productId, qtyMilli: l.qtyMilli, reason: 'opening', receiptValuePaise: divRound(l.qtyMilli * l.unitCostPaise, 1000),
      })), 0);
    });
  }

  adjust(input: AdjustStockInput): AdjustmentResult {
    return withTransaction(this.ctx.db(), () => {
      const warehouseId = this.warehouseId();
      input.lines.forEach((l) => this.product(l.productId));
      return this.post('adjustment', warehouseId, input.note, input.lines.map((l) => ({ ...l, ...this.gainValue(warehouseId, l.productId, l.qtyMilli) })), 0);
    });
  }

  // Differences are taken against the level at the moment of posting, so sales made during the count are respected.
  stockTake(input: StockTakeInput): AdjustmentResult {
    return withTransaction(this.ctx.db(), () => {
      const warehouseId = this.warehouseId();
      const lines: Line[] = [];
      let unchanged = 0;
      for (const c of input.counts) {
        this.product(c.productId);
        const diff = c.countedMilli - stockState(this.ctx.db(), this.ctx.businessId(), warehouseId, c.productId).qtyMilli;
        if (diff === 0) { unchanged++; continue; }
        lines.push({ productId: c.productId, qtyMilli: diff, reason: 'counting_error', ...this.gainValue(warehouseId, c.productId, diff) });
      }
      return this.post('stock_take', warehouseId, input.note, lines, unchanged);
    });
  }

  // A gain enters at the current average cost (else the last known cost, else the purchase price).
  private gainValue(warehouseId: string, productId: string, qtyMilli: number): { receiptValuePaise?: number } {
    if (qtyMilli <= 0) return {};
    const state = stockState(this.ctx.db(), this.ctx.businessId(), warehouseId, productId);
    const unitCost = averageCostPaise(state) || productFallbackCost(this.ctx.db(), productId);
    return { receiptValuePaise: divRound(qtyMilli * unitCost, 1000) };
  }

  private product(id: string) {
    const p = getProduct(this.ctx.db(), id, this.ctx.today());
    if (!p || p.businessId !== this.ctx.businessId()) throw new AppError('NOT_FOUND', 'Product not found');
    return p;
  }

  private post(kind: Kind, warehouseId: string, note: string | undefined, lines: Line[], unchanged: number): AdjustmentResult {
    const db = this.ctx.db();
    const businessId = this.ctx.businessId();
    const actor = this.ctx.actor();
    const id = newUlid();
    if (lines.length > 0) {
      insertAdjustmentHeader(db, { id, businessId, warehouseId, kind, note: note ?? null }, actor);
      const refType = kind === 'stock_take' ? 'stock_take' : kind === 'opening' ? 'opening' : 'adjustment';
      lines.forEach((l, i) => postMovement(db, {
        businessId, warehouseId, productId: l.productId, type: kind === 'opening' ? 'opening' : 'adjustment', qtyMilli: l.qtyMilli,
        ...(l.receiptValuePaise !== undefined && { receiptValuePaise: l.receiptValuePaise }),
        refType, refId: id, refLineId: String(i + 1), reasonCode: l.reason, note: note ?? null,
      }, actor));
      const movements: PostedMovement[] = movementsForRef(db, businessId, refType, id);
      recordChange(db, businessId, actor, {
        action: `stock.${kind}`, entityType: 'stock_adjustment', entityId: id, operationType: 'create', after: { id, kind, warehouseId, note, movements },
      });
      return {
        adjustmentId: id, kind, unchanged,
        lines: movements.filter((m) => m.type !== 'cost_correction').map((m) => ({ productId: m.productId, qtyMilli: m.qtyMilli, valuePaise: m.valuePaise })),
      };
    }
    return { adjustmentId: id, kind, lines: [], unchanged };
  }
}
