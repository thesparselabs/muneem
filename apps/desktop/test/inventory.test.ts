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
      .toMatchObject({ ok: false, error: { code: 'VALIDATION_FAILED', fields: { 'lines.0.productId': expect.stringContaining('already has opening stock') } } });
    expect(db.prepare("SELECT COUNT(*) FROM sync_outbox WHERE entity_type = 'stock_adjustment'").pluck().get()).toBe(1);
  });
});

describe('opening stock after billing has started', () => {
  it('sets stock to the count and re-costs the sales made before it', async () => {
    await api.data('pos.openRegister', { openingCashPaise: 0 });
    const { CompleteSaleInput, SaleDraft } = await import('@muneem/contracts');
    const draft = SaleDraft.parse({ lines: [{ productId: soap, uomId: pcs, qtyMilli: 5000 }] });
    const total = app.sales.quote(draft).totals.totalPaise;
    const sale = app.sales.complete(CompleteSaleInput.parse({ ...draft, commandId: newUlid(), expectedTotalPaise: total, tenders: [{ method: 'cash', amountPaise: total }] }));
    expect(level(soap)).toMatchObject({ qtyMilli: -5000, valuePaise: -15_000 });           // provisional at the ₹30 purchase price
    const r = await api.data<AdjustmentResult>('inventory.setOpeningStock', { lines: [{ productId: soap, qtyMilli: 20_000, unitCostPaise: 3500 }] });
    expect(r.lines).toEqual([{ productId: soap, qtyMilli: 25_000, valuePaise: 87_500 }]);   // received the 5 sold plus the 20 on the shelf
    expect(level(soap)).toMatchObject({ qtyMilli: 20_000, valuePaise: 70_000 });
    expect(db.prepare("SELECT value_paise FROM stock_movement WHERE movement_type = 'cost_correction'").pluck().all()).toEqual([-2500]);
    expect(await api.data('inventory.valuation')).toMatchObject({ balanced: true });
    expect(sale.saleId).toBeTruthy();
  });

  it('refuses a count below what the system already holds', async () => {
    app.inventory.adjust({ lines: [{ productId: soap, qtyMilli: 4000, reason: 'other' }] });
    expect(await api.call('inventory.setOpeningStock', { lines: [{ productId: soap, qtyMilli: 3000, unitCostPaise: 3000 }] }))
      .toMatchObject({ ok: false, error: { fields: { 'lines.0.qtyMilli': expect.stringContaining('adjustment') } } });
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

  it('refuses a stock take that counts the same product twice', async () => {
    expect(await api.call('inventory.stockTake', { counts: [{ productId: soap, countedMilli: 10_000 }, { productId: soap, countedMilli: 10_000 }] }))
      .toMatchObject({ ok: false, error: { code: 'VALIDATION_FAILED' } });
    expect(level(soap).qtyMilli).toBe(10_000);
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
    expect(await app.diagnostics.checkStock()).toBe('ok');
  });

  it('a sale made while the check is paused between batches is never undone by the rebuild', async () => {
    db.prepare('UPDATE stock_level SET qty_milli = 1, value_paise = 1 WHERE product_id = ?').run(soap);
    const running = app.diagnostics.checkStock({ batchSize: 1 });   // the first batch runs now, then the check pauses
    await api.data('pos.openRegister', { openingCashPaise: 0 });
    const { CompleteSaleInput, SaleDraft } = await import('@muneem/contracts');
    const draft = SaleDraft.parse({ lines: [{ productId: soap, uomId: pcs, qtyMilli: 2000 }] });
    const total = app.sales.quote(draft).totals.totalPaise;
    app.sales.complete(CompleteSaleInput.parse({ ...draft, commandId: newUlid(), expectedTotalPaise: total, tenders: [{ method: 'cash', amountPaise: total }] }));
    expect(await running).toBe('healed');
    expect(level(soap).qtyMilli).toBe(8000);
    expect(await api.data('inventory.valuation')).toMatchObject({ balanced: true });
    // The sale was costed from the corrupted level: its movement is reported for review, but no level drifts any more.
    expect(replayCheck(db, businessId)).toEqual([expect.objectContaining({ productId: soap, levelDrift: false, badMovementIds: [expect.any(String)] })]);
    expect(await app.diagnostics.checkStock()).toBe('ok');
  });

  it('scheduled checks take a rotating slice and still heal drift inside it', async () => {
    db.prepare('UPDATE stock_level SET qty_milli = 7, value_paise = 7 WHERE product_id = ?').run(rice);
    const first = await app.diagnostics.checkStock({ slice: true, sliceSize: 1, batchSize: 1 });
    const second = await app.diagnostics.checkStock({ slice: true, sliceSize: 1, batchSize: 1 });
    expect([first, second].sort()).toEqual(['healed', 'ok']);
    expect(level(rice)).toMatchObject({ qtyMilli: 2000, valuePaise: 10_000 });
  });
});

describe('stock per branch', () => {
  it('a till sees its own branch stock in search and the stock list, matching its sale warnings', async () => {
    app.inventory.setOpeningStock({ lines: [{ productId: soap, qtyMilli: 10_000, unitCostPaise: 3000 }] });
    expect(await api.data('products.lookupBarcode', { code: '8901030865275' })).toMatchObject({ stockMilli: 10_000 });
    const noida = await api.data<{ id: string }>('business.createBranch', { code: 'NOI1', name: 'Noida', stateCode: '09' });
    const till = app.business.createTerminal({ branchId: noida.id, code: 'T01', name: 'Noida till', invoicePrefix: 'N1' });
    app.business.selectTerminal(till.id);
    expect(await api.data('products.lookupBarcode', { code: '8901030865275' })).toMatchObject({ stockMilli: 0 });
    expect((await api.data<{ items: { productId: string; qtyMilli: number }[] }>('inventory.getStock', {})).items.find((r) => r.productId === soap)?.qtyMilli).toBe(0);
    const { SaleDraft } = await import('@muneem/contracts');
    expect(app.sales.quote(SaleDraft.parse({ lines: [{ productId: soap, uomId: pcs, qtyMilli: 1000 }] })).warnings).toEqual([expect.objectContaining({ stockMilli: 0 })]);
    expect(await api.data('inventory.valuation')).toMatchObject({ totalValuePaise: 30_000 });
  });

  it('shows the last unit cost as average cost when stock is at zero', async () => {
    app.inventory.setOpeningStock({ lines: [{ productId: soap, qtyMilli: 1000, unitCostPaise: 3200 }] });
    app.inventory.adjust({ lines: [{ productId: soap, qtyMilli: -1000, reason: 'damage' }] });
    const row = (await api.data<{ items: { productId: string; avgCostPaise: number; qtyMilli: number }[] }>('inventory.getStock', {})).items.find((r) => r.productId === soap);
    expect(row).toMatchObject({ qtyMilli: 0, avgCostPaise: 3200 });
  });
});
