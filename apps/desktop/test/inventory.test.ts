import { beforeEach, describe, expect, it } from 'vitest';
import { newUlid } from '@muneem/domain';
import { replayCheck, stockState, type Db } from '@muneem/db-sqlite';
import type { AdjustmentResult, OpeningImportPreview } from '@muneem/contracts';
import type { App } from '../src/main/app.js';
import { caller, grantRole, ownerAtTill, testApp } from './helpers.js';

let app: App;
let db: Db;
let api: ReturnType<typeof caller>;
let businessId: string;
let pcs: string;
let soap: string;
let rice: string;

beforeEach(async () => {
  ({ app, db } = await testApp());
  api = caller(app);
  businessId = (await ownerAtTill(app)).businessId;
  pcs = (await api.data<{ id: string; code: string }[]>('catalog.listUoms')).find((u) => u.code === 'PCS')!.id;
  soap = (await api.data<{ id: string }>('products.create', { name: 'Lux Soap', sku: 'LUX', baseUomId: pcs, purchasePricePaise: 3000, sellingPricePaise: 4100, barcodes: [{ code: '8901030865275' }] })).id;
  rice = (await api.data<{ id: string }>('products.create', { name: 'Rice', sku: 'RICE', baseUomId: pcs, sellingPricePaise: 6000 })).id;
});

const level = (productId: string) => stockState(db, businessId, app.inventory.warehouseId(), productId);
const b64 = (s: string) => Buffer.from(s).toString('base64');

describe('opening stock', () => {
  it('records quantity and value once per product', async () => {
    const r = await api.data<AdjustmentResult>('inventory.setOpeningStock', { lines: [{ productId: soap, qtyMilli: 10_000, unitCostPaise: 3000 }] });
    expect(r).toMatchObject({ kind: 'opening', lines: [{ productId: soap, qtyMilli: 10_000, valuePaise: 30_000 }] });
    expect(level(soap)).toMatchObject({ qtyMilli: 10_000, valuePaise: 30_000 });
    expect(await api.call('inventory.setOpeningStock', { lines: [{ productId: soap, qtyMilli: 1000, unitCostPaise: 3000 }] }))
      .toMatchObject({ ok: false, error: { code: 'VALIDATION_FAILED', fields: { 'lines.0.productId': expect.stringContaining('adjustment') } } });
    expect(db.prepare("SELECT COUNT(*) FROM sync_outbox WHERE entity_type = 'stock_adjustment'").pluck().get()).toBe(1);
  });
});

describe('adjustments and stock take', () => {
  beforeEach(() => { app.inventory.setOpeningStock({ lines: [{ productId: soap, qtyMilli: 10_000, unitCostPaise: 3000 }] }); });

  it('a loss leaves at average cost and a gain enters at average cost, with reasons', async () => {
    const r = await api.data<AdjustmentResult>('inventory.adjust', { lines: [{ productId: soap, qtyMilli: -2000, reason: 'damage' }, { productId: soap, qtyMilli: 500, reason: 'other' }] });
    expect(r.lines.map((l) => [l.qtyMilli, l.valuePaise])).toEqual([[-2000, -6000], [500, 1500]]);
    expect(level(soap)).toMatchObject({ qtyMilli: 8500, valuePaise: 25_500 });
    expect(db.prepare("SELECT reason_code FROM stock_movement WHERE ref_type = 'adjustment' ORDER BY rowid").pluck().all()).toEqual(['damage', 'other']);
  });

  it('a cashier cannot adjust stock', async () => {
    grantRole(db, app, 'cashier');
    expect(await api.call('inventory.adjust', { lines: [{ productId: soap, qtyMilli: -1000, reason: 'theft' }] })).toMatchObject({ ok: false, error: { code: 'PERMISSION_DENIED' } });
  });

  it('a stock take posts only the differences, measured at the moment of posting', async () => {
    app.inventory.adjust({ lines: [{ productId: soap, qtyMilli: -1000, reason: 'theft' }] });
    const r = await api.data<AdjustmentResult>('inventory.stockTake', { counts: [{ productId: soap, countedMilli: 8500 }, { productId: rice, countedMilli: 0 }] });
    expect(r).toMatchObject({ kind: 'stock_take', unchanged: 1, lines: [{ productId: soap, qtyMilli: -500, valuePaise: -1500 }] });
    expect(level(soap).qtyMilli).toBe(8500);
    const nothing = app.inventory.stockTake({ counts: [{ productId: soap, countedMilli: 8500 }] }); // the gateway allows one stock take a second
    expect(nothing).toMatchObject({ lines: [], unchanged: 1 });
    expect(replayCheck(db, businessId)).toEqual([]);
  });
});

describe('opening stock import', () => {
  it('matches products by SKU or barcode, reports bad rows and imports the rest', async () => {
    const csv = ['SKU,Barcode,Opening Stock,Cost Price', 'RICE,,25.5,48', ',8901030865275,12,', 'NOPE,,3,10', 'RICE,,1,1'].join('\n');
    const p = await api.data<OpeningImportPreview>('inventory.importOpeningPreview', { fileName: 'opening.csv', contentBase64: b64(csv) });
    expect(p.mapping).toEqual({ sku: 0, barcode: 1, qty: 2, unitCost: 3 });
    expect(p.counts).toEqual({ total: 4, ok: 2, errors: 2 });
    expect(p.rows.find((r) => r.line === 4)?.errors).toMatchObject({ product: 'no product with SKU or barcode NOPE' });
    expect(p.rows.find((r) => r.line === 5)?.errors).toMatchObject({ product: 'same product as row 2' });
    const commandId = newUlid();
    const r = app.openingImport.commit(p.importId, commandId);
    expect(r.lines.map((l) => [l.productId, l.qtyMilli, l.valuePaise])).toEqual([[rice, 25_500, 122_400], [soap, 12_000, 36_000]]);
    expect(app.openingImport.commit(p.importId, commandId)).toEqual(r);
    expect(level(rice)).toMatchObject({ qtyMilli: 25_500, valuePaise: 122_400 });
  });
});

describe('stock queries', () => {
  beforeEach(async () => {
    app.inventory.setOpeningStock({ lines: [{ productId: soap, qtyMilli: 10_000, unitCostPaise: 3000 }, { productId: rice, qtyMilli: 2000, unitCostPaise: 5000 }] });
    const r = await api.data<Record<string, unknown>>('products.get', { id: rice });
    await api.data('products.update', { ...r, reorderLevelMilli: 5000 });
  });

  it('lists stock with low-stock flags and a low-only filter', async () => {
    const all = await api.data<{ items: { name: string; qtyMilli: number; low: boolean }[] }>('inventory.getStock', {});
    expect(all.items.map((r) => [r.name, r.qtyMilli, r.low])).toEqual([['Lux Soap', 10_000, false], ['Rice', 2000, true]]);
    expect((await api.data<{ name: string }[]>('inventory.listLowStock')).map((r) => r.name)).toEqual(['Rice']);
  });

  it('shows a product ledger newest first with running balances', async () => {
    app.inventory.adjust({ lines: [{ productId: soap, qtyMilli: -1000, reason: 'damage' }] });
    const page = await api.data<{ items: { type: string; qtyMilli: number; balanceQtyMilli: number; balanceValuePaise: number; reason?: string }[] }>('inventory.getMovements', { productId: soap });
    expect(page.items.map((m) => [m.type, m.qtyMilli, m.balanceQtyMilli, m.balanceValuePaise, m.reason ?? null])).toEqual([
      ['adjustment', -1000, 9000, 27_000, 'damage'], ['opening', 10_000, 10_000, 30_000, 'opening'],
    ]);
  });

  it('values stock and proves the sub-ledger balances', async () => {
    expect(await api.data('inventory.valuation')).toMatchObject({ totalValuePaise: 40_000, movementValuePaise: 40_000, balanced: true, negativeCount: 0 });
  });

  it('shows on-hand stock on product search results', async () => {
    expect(await api.data('products.lookupBarcode', { code: '8901030865275' })).toMatchObject({ stockMilli: 10_000, baseUomCode: 'PCS' });
  });

  it('the integrity check finds a drifted cache and heals it', async () => {
    db.prepare('UPDATE stock_level SET qty_milli = 1, value_paise = 1 WHERE product_id = ?').run(soap);
    expect(await api.data('diagnostics.integrityCheck')).toMatchObject({ stock: 'healed' });
    expect(level(soap)).toMatchObject({ qtyMilli: 10_000, valuePaise: 30_000 });
    expect(app.diagnostics.checkStock()).toBe('ok');
  });
});
