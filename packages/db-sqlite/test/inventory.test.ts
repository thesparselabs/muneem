import { describe, expect, it } from 'vitest';
import { ProductInput } from '@muneem/contracts';
import {
  createBranch, createBusiness, createProduct, ensureCatalogDefaults, ensureDefaultWarehouse, findUomByCode, planIssues, postMovement,
  rebuildStockLevels, replayCheck, stockState, withTransaction, type Db,
} from '../src/index.js';
import { ACTOR, ORG, freshDb } from './helpers.js';

async function store(): Promise<{ db: Db; businessId: string; warehouseId: string; productId: string }> {
  const db = await freshDb();
  const b = createBusiness(db, { organizationId: ORG, name: 'S', businessType: 'retail', stateCode: '07', taxScheme: 'regular', fyStartMonth: 4 }, ACTOR);
  ensureCatalogDefaults(db, b.id, ACTOR);
  const br = createBranch(db, b.id, { code: 'DEL1', name: 'Delhi', stateCode: '07', isDefault: true }, ACTOR);
  const pcs = findUomByCode(db, b.id, 'PCS')!.id;
  const p = createProduct(db, b.id, ProductInput.parse({ name: 'Soap', baseUomId: pcs, purchasePricePaise: 9000, sellingPricePaise: 12_000 }), ACTOR, '2026-10-02');
  const warehouseId = withTransaction(db, () => ensureDefaultWarehouse(db, b.id, br.id, ACTOR));
  return { db, businessId: b.id, warehouseId, productId: p.id };
}

describe('stock ledger', () => {
  it('creates one default warehouse per branch, once', async () => {
    const { db, businessId, warehouseId } = await store();
    const branchId = db.prepare('SELECT branch_id FROM warehouse WHERE id = ?').pluck().get(warehouseId) as string;
    expect(withTransaction(db, () => ensureDefaultWarehouse(db, businessId, branchId, ACTOR))).toBe(warehouseId);
  });

  it('posts receipts and issues with the cache in step and replay agreeing', async () => {
    const { db, businessId, warehouseId, productId } = await store();
    const post = (qtyMilli: number, receiptValuePaise?: number) => withTransaction(db, () => postMovement(db, {
      businessId, warehouseId, productId, type: qtyMilli > 0 ? 'opening' : 'sale', qtyMilli, ...(receiptValuePaise !== undefined && { receiptValuePaise }),
      refType: qtyMilli > 0 ? 'opening' : 'sale', refId: `ref-${Math.abs(qtyMilli)}-${receiptValuePaise ?? 0}`,
    }, ACTOR));
    post(10_000, 100_000);
    post(-4000);
    expect(stockState(db, businessId, warehouseId, productId)).toEqual({ qtyMilli: 6000, valuePaise: 60_000, lastUnitCostPaise: 10_000 });
    expect(replayCheck(db, businessId)).toEqual([]);
    expect(db.prepare('SELECT SUM(value_paise) FROM stock_movement').pluck().get()).toBe(60_000);
  });

  it('books a value-only correction when a receipt covers stock sold below zero', async () => {
    const { db, businessId, warehouseId, productId } = await store();
    const sold = withTransaction(db, () => postMovement(db, { businessId, warehouseId, productId, type: 'sale', qtyMilli: -2000, refType: 'sale', refId: 's1', refLineId: 'l1' }, ACTOR));
    expect(sold[0]).toMatchObject({ unitCostPaise: 9000, provisional: true, valuePaise: -18_000 });
    const received = withTransaction(db, () => postMovement(db, { businessId, warehouseId, productId, type: 'opening', qtyMilli: 5000, receiptValuePaise: 50_000, refType: 'opening', refId: 'o1' }, ACTOR));
    expect(received.map((m) => [m.type, m.qtyMilli, m.valuePaise])).toEqual([['opening', 5000, 50_000], ['cost_correction', 0, -2000]]);
    expect(stockState(db, businessId, warehouseId, productId)).toMatchObject({ qtyMilli: 3000, valuePaise: 30_000 });
    expect(replayCheck(db, businessId)).toEqual([]);
  });

  it('plans issues without writing, chaining lines of the same product', async () => {
    const { db, businessId, warehouseId, productId } = await store();
    withTransaction(db, () => postMovement(db, { businessId, warehouseId, productId, type: 'opening', qtyMilli: 3000, receiptValuePaise: 30_000, refType: 'opening', refId: 'o1' }, ACTOR));
    const plan = planIssues(db, businessId, warehouseId, [{ productId, qtyMilli: 2000 }, { productId, qtyMilli: 2000 }]);
    expect(plan.map((p) => [p.cogsPaise, p.provisional, p.qtyAfterMilli])).toEqual([[20_000, false, 1000], [20_000, true, -1000]]);
    expect(stockState(db, businessId, warehouseId, productId).qtyMilli).toBe(3000);
  });

  it('detects a corrupted cache and rebuilds it from the movements', async () => {
    const { db, businessId, warehouseId, productId } = await store();
    withTransaction(db, () => postMovement(db, { businessId, warehouseId, productId, type: 'opening', qtyMilli: 3000, receiptValuePaise: 30_000, refType: 'opening', refId: 'o1' }, ACTOR));
    db.prepare('UPDATE stock_level SET qty_milli = 99000, value_paise = 1').run();
    expect(replayCheck(db, businessId)).toHaveLength(1);
    expect(rebuildStockLevels(db, businessId)).toBe(1);
    expect(replayCheck(db, businessId)).toEqual([]);
    expect(stockState(db, businessId, warehouseId, productId)).toMatchObject({ qtyMilli: 3000, valuePaise: 30_000 });
  });
});
