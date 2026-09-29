import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it } from 'vitest';
import ExcelJS from 'exceljs';
import { newUlid } from '@muneem/domain';
import { verifyAuditChain, type Db } from '@muneem/db-sqlite';
import type { ImportPreview, ImportSummary, ProductHit } from '@muneem/contracts';
import type { App } from '../src/main/app.js';
import { testApp } from './helpers.js';

let app: App;
let db: Db;

const fixture = (name: string) => readFileSync(new URL(`./fixtures/import/${name}`, import.meta.url));
const b64 = (buf: Buffer | string) => Buffer.from(buf).toString('base64');
async function data<T>(channel: string, input: unknown = {}): Promise<T> {
  const r = await app.gateway.handle(channel, input, 1);
  if (!r.ok) throw new Error(`${channel}: ${JSON.stringify(r.error)}`);
  return r.data as T;
}
// The gateway rate-limits import calls, so tests that repeat them go straight to the service.
const preview = (fileName: string, content: Buffer | string) => app.productImport.preview({ fileName, contentBase64: b64(content) });
const commit = async (importId: string, duplicatePolicy: 'skip' | 'update' = 'skip', commandId = newUlid()): Promise<ImportSummary> =>
  app.productImport.commit({ importId, duplicatePolicy, commandId });
const productCount = () => db.prepare('SELECT COUNT(*) FROM product').pluck().get() as number;

beforeEach(async () => {
  ({ app, db } = await testApp());
  await app.gateway.handle('auth.login', { identifier: '9999999999', password: 'correct-horse' }, 1);
  await app.gateway.handle('business.create', { name: 'Shop', businessType: 'retail', stateCode: '07', taxScheme: 'regular' }, 1);
});

describe('product import', () => {
  it('maps common headers, previews, and commits a clean file', async () => {
    const p = await preview('good.csv', fixture('good.csv'));
    expect(p.mapping).toEqual({
      name: 0, sku: 1, barcodes: 2, hsnCode: 3, category: 4, brand: 5, uom: 6, mrp: 7, sellingPrice: 8, purchasePrice: 9, gstRate: 10, reorderLevel: 11,
    });
    expect(p.counts).toEqual({ total: 4, ok: 4, errors: 0, duplicates: 0 });
    expect(p.willCreate).toEqual({ categories: ['Biscuits', 'Staples', 'Beverages'], brands: ['Parle', 'Tata', 'Wagh Bakri'], uoms: [] });

    const s = await commit(p.importId);
    expect(s).toEqual({ created: 4, updated: 0, skippedDuplicates: 0, skippedErrors: 0, categoriesCreated: 3, brandsCreated: 3, uomsCreated: 0 });
    expect(await data<ProductHit>('products.lookupBarcode', { code: 'TS1-LOOSE' })).toMatchObject({ name: 'Tata Salt 1kg', pricePaise: 2700, mrpPaise: 2800, gstRateBp: 0 });
    expect(await data<ProductHit[]>('products.search', { query: 'toor' })).toEqual([expect.objectContaining({ uomCode: 'KG', pricePaise: 14_000 })]);
    expect(await data<ProductHit[]>('products.search', { query: 'चाय' })).toEqual([expect.objectContaining({ brandName: 'Wagh Bakri' })]);
    const toor = await data<{ reorderLevelMilli: number }>('products.get', { id: (await data<ProductHit[]>('products.search', { query: 'TOOR' }))[0]!.productId });
    expect(toor.reorderLevelMilli).toBe(5500);
  });

  it('reports every bad row with the reason and skips only those rows', async () => {
    const p = await preview('errors.csv', fixture('errors.csv'));
    expect(p.counts).toEqual({ total: 7, ok: 2, errors: 5, duplicates: 0 });
    const byLine = Object.fromEntries(p.rows.map((r) => [r.line, r.errors]));
    expect(byLine[2]).toMatchObject({ name: 'name is required' });
    expect(byLine[3]).toMatchObject({ sellingPrice: '"ten" is not a valid amount' });
    expect(byLine[4]).toMatchObject({ sellingPrice: 'selling price is above MRP' });
    expect(byLine[6]).toMatchObject({ sku: 'same SKU as row 5' });
    expect(byLine[7]).toMatchObject({ gstRate: '"abc" is not a valid amount' });
    const s = await commit(p.importId);
    expect(s).toMatchObject({ created: 2, skippedErrors: 5 });
  });

  it('skips or updates existing products by SKU, keeping columns the file does not have', async () => {
    await commit((await preview('good.csv', fixture('good.csv'))).importId);
    const p = await preview('duplicates.csv', fixture('duplicates.csv'));
    expect(p.counts).toMatchObject({ ok: 1, duplicates: 1 });

    const skipped = await commit(p.importId, 'skip');
    expect(skipped).toMatchObject({ created: 1, skippedDuplicates: 1 });
    expect(await data<ProductHit>('products.lookupBarcode', { code: '8901030865275' })).toMatchObject({ pricePaise: 950 });

    const again = await preview('duplicates.csv', fixture('duplicates.csv'));
    expect(again.counts).toMatchObject({ ok: 0, duplicates: 2 });
    expect(await commit(again.importId, 'update')).toMatchObject({ updated: 2 });
    const hit = await data<ProductHit>('products.lookupBarcode', { code: 'PG100-ALT' });
    expect(hit).toMatchObject({ name: 'Parle-G Biscuit 100g (new pack)', pricePaise: 900, gstRateBp: 1800, brandName: 'Parle' });
    expect(await data<ProductHit>('products.lookupBarcode', { code: '8901030865275' })).toMatchObject({ productId: hit.productId });
  });

  it('reads the same data from an XLSX workbook', async () => {
    const wb = new ExcelJS.Workbook();
    const sheet = wb.addWorksheet('Products');
    sheet.addRow(['Name', 'SKU', 'Barcode', 'Price', 'GST']);
    sheet.addRow(['Excel Soap', 'XS1', 8901030865275, 35.5, 18]);
    sheet.addRow([{ richText: [{ text: 'Rich ' }, { text: 'Text Shampoo' }] }, 'XS2', 'XS2-CODE', { formula: '2*60', result: 120 }, 18]);
    const p = await preview('products.xlsx', Buffer.from(await wb.xlsx.writeBuffer()));
    expect(p.counts).toMatchObject({ total: 2, ok: 2 });
    await commit(p.importId);
    expect(await data<ProductHit>('products.lookupBarcode', { code: '8901030865275' })).toMatchObject({ name: 'Excel Soap', pricePaise: 3550 });
    expect(await data<ProductHit>('products.lookupBarcode', { code: 'XS2-CODE' })).toMatchObject({ name: 'Rich Text Shampoo', pricePaise: 12_000 });
  });

  it('lets the user change the column mapping without sending the file again', async () => {
    const p = await preview('good.csv', fixture('good.csv'));
    const remapped = await data<ImportPreview>('products.importPreview', { importId: p.importId, mapping: { ...p.mapping, sellingPrice: 7 } });
    expect(remapped.importId).toBe(p.importId);
    await commit(p.importId);
    expect(await data<ProductHit>('products.lookupBarcode', { code: '8901030865275' })).toMatchObject({ pricePaise: 1000 });
  });

  it('a repeated commit with the same commandId does nothing twice', async () => {
    const p = await preview('good.csv', fixture('good.csv'));
    const commandId = newUlid();
    const first = await commit(p.importId, 'skip', commandId);
    expect(await commit(p.importId, 'skip', commandId)).toEqual(first);
    expect(productCount()).toBe(4);
  });

  it('a failure part-way through leaves no products, units, categories or outbox rows behind', async () => {
    const p = await preview('good.csv', fixture('good.csv'));
    db.exec("CREATE TRIGGER boom AFTER INSERT ON product WHEN NEW.sku = 'CHAI250' BEGIN SELECT RAISE(ABORT, 'boom'); END");
    const outbox = db.prepare('SELECT COUNT(*) FROM sync_outbox').pluck().get();
    const r = await app.gateway.handle('products.importCommit', { importId: p.importId, duplicatePolicy: 'skip', commandId: newUlid() }, 1);
    expect(r.ok).toBe(false);
    expect(productCount()).toBe(0);
    expect(db.prepare('SELECT COUNT(*) FROM category').pluck().get()).toBe(0);
    expect(db.prepare('SELECT COUNT(*) FROM sync_outbox').pluck().get()).toBe(outbox);
  });

  it('commits through the gateway and keeps the uploaded file out of the audit log', async () => {
    const csv = ['Name,SKU,Price', ...Array.from({ length: 100 }, (_, i) => `Item ${i},I${i},10`)].join('\n');
    const p = await data<ImportPreview>('products.importPreview', { fileName: 'big.csv', contentBase64: b64(csv) });
    expect(await data<ImportSummary>('products.importCommit', { importId: p.importId, duplicatePolicy: 'skip', commandId: newUlid() })).toMatchObject({ created: 100 });
    const row = db.prepare("SELECT after_json FROM audit_log WHERE action = 'ipc.products.importPreview'").pluck().get() as string;
    expect(row).toMatch(/"contentBase64":"\[\d+ chars\]"/);
  });
});

describe('Stage 2 exit criterion: 5,000 SKUs imported', () => {
  it('imports 5,000 rows in under 10 s and every product scans afterwards', async () => {
    const lines = ['Name,SKU,Barcode,Category,Brand,MRP,Price,GST'];
    for (let i = 0; i < 5000; i++) lines.push(`Product ${i},SKU${i},BC${i};ALT${i},Cat ${i % 40},Brand ${i % 120},${100 + i}.00,${90 + i}.50,18`);
    const p = await preview('5000.csv', lines.join('\n'));
    expect(p.counts).toEqual({ total: 5000, ok: 5000, errors: 0, duplicates: 0 });
    const t0 = performance.now();
    const s = await commit(p.importId);
    const ms = performance.now() - t0;
    console.info(`5,000-row import committed in ${Math.round(ms)} ms`);
    expect(s).toMatchObject({ created: 5000, categoriesCreated: 40, brandsCreated: 120 });
    expect(ms).toBeLessThan(10_000);
    for (let i = 0; i < 5000; i++) expect(app.products.lookupBarcode(`ALT${i}`)?.pricePaise).toBe((90 + i) * 100 + 50);
    const session = app.session.require();
    expect(verifyAuditChain(db, session.businessId!, app.device.localDeviceId()).ok).toBe(true);
  }, 60_000);
});
