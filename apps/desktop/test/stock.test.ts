import { beforeEach, describe, expect, it } from 'vitest';
import { CompleteSaleInput, SaleDraft, type SaleQuote } from '@muneem/contracts';
import { newUlid } from '@muneem/domain';
import { ensureDefaultWarehouse, postMovement, replayCheck, stockState, withTransaction, type Db } from '@muneem/db-sqlite';
import type { App } from '../src/main/app.js';
import { caller, ownerAtTill, testApp } from './helpers.js';

let app: App;
let db: Db;
let api: ReturnType<typeof caller>;
let pcs: string;
let soap: string;
let businessId: string;
let warehouseId: string;

beforeEach(async () => {
  ({ app, db } = await testApp());
  api = caller(app);
  const till = await ownerAtTill(app);
  businessId = till.businessId;
  pcs = (await api.data<{ id: string; code: string }[]>('catalog.listUoms')).find((u) => u.code === 'PCS')!.id;
  soap = (await api.data<{ id: string }>('products.create', { name: 'Lux Soap', baseUomId: pcs, gstRateBp: 1800, purchasePricePaise: 3000, sellingPricePaise: 4100 })).id;
  await api.data('pos.openRegister', { openingCashPaise: 0 });
  const actor = { userId: app.session.require().user.id, deviceId: app.device.localDeviceId() };
  warehouseId = withTransaction(db, () => ensureDefaultWarehouse(db, businessId, till.branchId, actor));
});

const actor = () => ({ userId: app.session.require().user.id, deviceId: app.device.localDeviceId() });
const receive = (qtyMilli: number, valuePaise: number) => withTransaction(db, () => postMovement(db, {
  businessId, warehouseId, productId: soap, type: 'opening', qtyMilli, receiptValuePaise: valuePaise, refType: 'opening', refId: newUlid(),
}, actor()));
const draft = (qtyMilli: number) => SaleDraft.parse({ lines: [{ productId: soap, uomId: pcs, qtyMilli }] });
const sell = (qtyMilli: number) => {
  const q = app.sales.quote(draft(qtyMilli));
  return app.sales.complete(CompleteSaleInput.parse({ ...draft(qtyMilli), commandId: newUlid(), expectedTotalPaise: q.totals.totalPaise, tenders: [{ method: 'cash', amountPaise: q.totals.totalPaise }] }));
};

describe('stock in the sale commit (ADR-0019)', () => {
  it('a sale issues stock at average cost and records COGS on the lines and the sale', () => {
    receive(10_000, 300_000);
    const r = sell(3000);
    expect(stockState(db, businessId, warehouseId, soap)).toMatchObject({ qtyMilli: 7000, valuePaise: 210_000 });
    expect(db.prepare('SELECT unit_cost_paise, cogs_paise FROM sale_item WHERE sale_id = ?').get(r.saleId)).toEqual({ unit_cost_paise: 30_000, cogs_paise: 90_000 });
    expect(db.prepare('SELECT cogs_paise FROM sale WHERE id = ?').pluck().get(r.saleId)).toBe(90_000);
    expect(db.prepare("SELECT movement_type, signed_qty_milli, value_paise FROM stock_movement WHERE ref_id = ?").all(r.saleId)).toEqual([{ movement_type: 'sale', signed_qty_milli: -3000, value_paise: -90_000 }]);
    const payload = JSON.parse(db.prepare("SELECT payload_json FROM sync_outbox WHERE entity_type = 'sale' AND entity_id = ?").pluck().get(r.saleId) as string) as { movements: unknown[] };
    expect(payload.movements).toHaveLength(1);
    expect(replayCheck(db, businessId)).toEqual([]);
  });

  it('warns but bills when stock would go negative, and audits it', async () => {
    receive(1000, 30_000);
    const q = await api.data<SaleQuote>('sales.quote', draft(3000));
    expect(q.warnings).toEqual([expect.objectContaining({ lineNo: 1, blocking: false, stockMilli: 1000, message: 'Lux Soap: only 1 PCS in stock' })]);
    const r = sell(3000);
    expect(stockState(db, businessId, warehouseId, soap).qtyMilli).toBe(-2000);
    expect(db.prepare("SELECT COUNT(*) FROM audit_log WHERE action = 'stock.negative' AND entity_id = ?").pluck().get(r.saleId)).toBe(1);
  });

  it('blocks the sale under the block policy, unless the product allows negative stock', async () => {
    await api.data('settings.set', { key: 'inventory.negativeStock', value: 'block' });
    expect(() => sell(1000)).toThrow(/no stock recorded/);
    expect(db.prepare('SELECT COUNT(*) FROM sale').pluck().get()).toBe(0);
    const p = await api.data<Record<string, unknown> & { id: string; version: number }>('products.get', { id: soap });
    await api.data('products.update', { ...p, allowNegativeStock: true });
    expect(sell(1000).docNumber).toBeTruthy();
  });

  it('a sale below zero is costed provisionally and corrected by the next receipt', () => {
    receive(1000, 30_000);
    sell(3000);
    const corrected = receive(5000, 200_000);
    expect(corrected.map((m) => [m.type, m.valuePaise])).toEqual([['opening', 200_000], ['cost_correction', -20_000]]);
    expect(stockState(db, businessId, warehouseId, soap)).toMatchObject({ qtyMilli: 3000, valuePaise: 120_000 });
    expect(replayCheck(db, businessId)).toEqual([]);
  });
});

describe('quantities too small for the base unit', () => {
  it('are reported as a quote issue instead of failing the sale', async () => {
    const uoms = await api.data<{ id: string; code: string }[]>('catalog.listUoms');
    const kg = uoms.find((u) => u.code === 'KG')!.id;
    const g = uoms.find((u) => u.code === 'G')!.id;
    const saffron = await api.data<{ id: string }>('products.create', { name: 'Saffron', baseUomId: kg, sellingPricePaise: 30_000_000, conversions: [{ fromUomId: g, factorMilli: 1 }] });
    const q = app.sales.quote(SaleDraft.parse({ lines: [{ productId: soap, uomId: pcs, qtyMilli: 1000 }, { productId: saffron.id, uomId: g, qtyMilli: 400 }] })).issues;
    expect(q).toEqual([{ lineNo: 2, message: 'Too small: 0.4 G of Saffron is less than 0.001 KG' }]);
  });
});
