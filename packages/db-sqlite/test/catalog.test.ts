import { describe, expect, it } from 'vitest';
import { AppError, ProductInput } from '@muneem/contracts';
import {
  createBrand, createBusiness, createCategory, createProduct, ensureCatalogDefaults, findUomByCode, getDefaultPriceList,
  getPriceItems, getProduct, hitByBarcode, hitBySku, hitsByNamePrefix, hitsByText, listProductHits, listUoms,
  replacePriceItems, setProductActive, updateBrand, updateCategory, updateProduct, verifyAuditChain, type Db,
} from '../src/index.js';
import { ACTOR, ORG, freshDb } from './helpers.js';

const TODAY = '2026-09-30';

async function setup(): Promise<{ db: Db; businessId: string; pcs: string; box: string }> {
  const db = await freshDb();
  const b = createBusiness(db, { organizationId: ORG, name: 'Sharma Store', businessType: 'retail', stateCode: '07', taxScheme: 'regular', fyStartMonth: 4 }, ACTOR);
  ensureCatalogDefaults(db, b.id, ACTOR);
  return { db, businessId: b.id, pcs: findUomByCode(db, b.id, 'PCS')!.id, box: findUomByCode(db, b.id, 'BOX')!.id };
}

const product = (baseUomId: string, over: Partial<ProductInput> = {}) =>
  ProductInput.parse({
    name: 'Parle-G Biscuit 100g', sku: 'PG100', hsnCode: '1905', baseUomId, gstRateBp: 1800, mrpPaise: 1000,
    sellingPricePaise: 950, barcodes: [{ code: '8901030865275' }], ...over,
  });

const count = (db: Db, sql: string): number => (db.prepare(sql).pluck().get() as number);

describe('catalog defaults', () => {
  it('seeds standard units and one default Retail list, idempotently', async () => {
    const { db, businessId } = await setup();
    ensureCatalogDefaults(db, businessId, ACTOR);
    expect(listUoms(db, businessId).map((u) => u.code)).toEqual(['BOX', 'CASE', 'DOZ', 'G', 'KG', 'L', 'M', 'ML', 'PCS']);
    expect(getDefaultPriceList(db, businessId)).toMatchObject({ name: 'Retail', kind: 'retail', isDefault: true });
  });
});

describe('product writes', () => {
  it('create writes product, barcode, price and search row with one audit row and linked outbox rows', async () => {
    const { db, businessId, pcs } = await setup();
    const auditBefore = count(db, 'SELECT COUNT(*) FROM audit_log');
    const p = createProduct(db, businessId, product(pcs), ACTOR, TODAY);
    expect(p).toMatchObject({ name: 'Parle-G Biscuit 100g', sellingPricePaise: 950, isActive: true, version: 1 });
    expect(p.barcodes).toEqual([expect.objectContaining({ code: '8901030865275', symbology: 'EAN13', isPrimary: true })]);
    expect(count(db, 'SELECT COUNT(*) FROM audit_log') - auditBefore).toBe(1);
    const outbox = db.prepare("SELECT entity_type, depends_on_operation_id IS NOT NULL AS dep FROM sync_outbox WHERE entity_type IN ('product','barcode','price_list_item') ORDER BY seq").all();
    expect(outbox).toEqual([{ entity_type: 'product', dep: 0 }, { entity_type: 'barcode', dep: 1 }, { entity_type: 'price_list_item', dep: 1 }]);
    expect(count(db, 'SELECT COUNT(*) FROM product_fts')).toBe(1);
    expect(verifyAuditChain(db, businessId, ACTOR.deviceId).ok).toBe(true);
  });

  it('a duplicate barcode rolls the whole product back', async () => {
    const { db, businessId, pcs } = await setup();
    createProduct(db, businessId, product(pcs), ACTOR, TODAY);
    const outbox = count(db, 'SELECT COUNT(*) FROM sync_outbox');
    expect(() => createProduct(db, businessId, product(pcs, { name: 'Other', sku: 'X1' }), ACTOR, TODAY)).toThrow(AppError);
    expect(count(db, 'SELECT COUNT(*) FROM product')).toBe(1);
    expect(count(db, 'SELECT COUNT(*) FROM sync_outbox')).toBe(outbox);
  });

  it('rejects a price above MRP and a bad check digit with field errors', async () => {
    const { db, businessId, pcs } = await setup();
    try {
      createProduct(db, businessId, product(pcs, { sellingPricePaise: 1200, barcodes: [{ code: '8901030865276', symbology: 'EAN13', uomId: null, packQtyMilli: 1000, isPrimary: false }] }), ACTOR, TODAY);
      expect.unreachable();
    } catch (e) {
      expect((e as AppError).fields).toEqual({ sellingPricePaise: 'selling price is above MRP', 'barcodes.0.code': 'not a valid EAN13 barcode' });
    }
  });

  it('update enforces the version, diffs barcodes and dates the new price from today', async () => {
    const { db, businessId, pcs } = await setup();
    const p = createProduct(db, businessId, product(pcs), ACTOR, '2026-09-01');
    const next = product(pcs, { sellingPricePaise: 900, barcodes: [{ code: '8901030865275' }, { code: 'PG-LOOSE' }] });
    const u = updateProduct(db, { ...next, id: p.id, version: 1 }, ACTOR, TODAY);
    expect(u.version).toBe(2);
    expect(u.barcodes.map((b) => b.code).sort()).toEqual(['8901030865275', 'PG-LOOSE']);
    expect(u.barcodes.find((b) => b.code === '8901030865275')!.id).toBe(p.barcodes[0]!.id);
    const list = getDefaultPriceList(db, businessId)!;
    expect(getPriceItems(db, list.id, p.id).map((i) => [i.pricePaise, i.effectiveFrom, i.effectiveTo ?? null])).toEqual([
      [950, '2026-09-01', TODAY],
      [900, TODAY, null],
    ]);
    expect(getProduct(db, p.id, '2026-09-15')!.sellingPricePaise).toBe(950);
    expect(() => updateProduct(db, { ...next, id: p.id, version: 1 }, ACTOR, TODAY)).toThrow('VERSION_CONFLICT');
  });

  it('replacePriceItems stores quantity breaks that resolve in search hits', async () => {
    const { db, businessId, pcs } = await setup();
    const p = createProduct(db, businessId, product(pcs), ACTOR, TODAY);
    const list = getDefaultPriceList(db, businessId)!;
    replacePriceItems(db, businessId, list.id, p.id, [
      { uomId: pcs, minQtyMilli: 0, pricePaise: 950, isInclusive: true, effectiveFrom: TODAY },
      { uomId: pcs, minQtyMilli: 12_000, pricePaise: 900, isInclusive: true, effectiveFrom: TODAY },
    ], ACTOR);
    expect(getPriceItems(db, list.id, p.id)).toHaveLength(2);
    expect(hitBySku(db, businessId, 'PG100', TODAY)!.pricePaise).toBe(950);
  });
});

describe('product lookup and search', () => {
  it('a case barcode scans as one case priced through the conversion', async () => {
    const { db, businessId, pcs, box } = await setup();
    createProduct(db, businessId, product(pcs, {
      conversions: [{ fromUomId: box, factorMilli: 24_000 }],
      barcodes: [{ code: '8901030865275', uomId: null, packQtyMilli: 1000, isPrimary: true }, { code: 'PGBOX24', uomId: box, packQtyMilli: 1000, isPrimary: false }],
    }), ACTOR, TODAY);
    expect(hitByBarcode(db, businessId, 'PGBOX24', TODAY)).toMatchObject({ uomCode: 'BOX', pricePaise: 22_800, barcode: 'PGBOX24', matchedBy: 'barcode' });
    expect(hitByBarcode(db, businessId, '8901030865275', TODAY)).toMatchObject({ uomCode: 'PCS', pricePaise: 950 });
    expect(hitByBarcode(db, businessId, 'nope', TODAY)).toBeNull();
  });

  it('prefix search uses the normalised name, including Hindi names', async () => {
    const { db, businessId, pcs } = await setup();
    createProduct(db, businessId, product(pcs, { name: 'Café Coffee', sku: 'C1', barcodes: [] }), ACTOR, TODAY);
    createProduct(db, businessId, product(pcs, { name: 'चाय पत्ती', sku: 'C2', barcodes: [] }), ACTOR, TODAY);
    expect(hitsByNamePrefix(db, businessId, 'cafe', 20, TODAY).map((h) => h.name)).toEqual(['Café Coffee']);
    expect(hitsByNamePrefix(db, businessId, 'चाय', 20, TODAY).map((h) => h.name)).toEqual(['चाय पत्ती']);
  });

  it('text search matches a word inside the name, HSN and brand, and follows a brand rename', async () => {
    const { db, businessId, pcs } = await setup();
    const brand = createBrand(db, businessId, { name: 'Parle' }, ACTOR);
    createProduct(db, businessId, product(pcs, { name: 'Glucose Biscuit', brandId: brand.id }), ACTOR, TODAY);
    expect(hitsByText(db, businessId, 'biscu', 20, TODAY).map((h) => h.name)).toEqual(['Glucose Biscuit']);
    expect(hitsByText(db, businessId, 'parle', 20, TODAY)).toHaveLength(1);
    expect(hitsByText(db, businessId, '1905', 20, TODAY)).toHaveLength(1);
    updateBrand(db, brand.id, 1, { name: 'Parle Products' }, ACTOR);
    expect(hitsByText(db, businessId, 'products', 20, TODAY)).toHaveLength(1);
    expect(hitsByText(db, businessId, '"; DROP', 20, TODAY)).toEqual([]);
  });

  it('a deactivated product disappears from search and default lists', async () => {
    const { db, businessId, pcs } = await setup();
    const p = createProduct(db, businessId, product(pcs), ACTOR, TODAY);
    setProductActive(db, p.id, 1, false, ACTOR, TODAY);
    expect(hitByBarcode(db, businessId, '8901030865275', TODAY)).toBeNull();
    expect(hitsByNamePrefix(db, businessId, 'parle', 20, TODAY)).toEqual([]);
    expect(listProductHits(db, businessId, { limit: 50, includeInactive: false }, TODAY).items).toEqual([]);
    expect(listProductHits(db, businessId, { limit: 50, includeInactive: true }, TODAY).items).toHaveLength(1);
  });

  it('list pages by name with a stable cursor and filters by category', async () => {
    const { db, businessId, pcs } = await setup();
    const cat = createCategory(db, businessId, { name: 'Snacks', parentId: null }, ACTOR);
    for (const n of ['Delta', 'Alpha', 'Charlie', 'Bravo', 'Echo']) {
      createProduct(db, businessId, product(pcs, { name: n, sku: n, barcodes: [], ...(n < 'C' && { categoryId: cat.id }) }), ACTOR, TODAY);
    }
    const first = listProductHits(db, businessId, { limit: 2, includeInactive: false }, TODAY);
    const second = listProductHits(db, businessId, { limit: 2, includeInactive: false, cursor: first.nextCursor! }, TODAY);
    const third = listProductHits(db, businessId, { limit: 2, includeInactive: false, cursor: second.nextCursor! }, TODAY);
    expect([...first.items, ...second.items, ...third.items].map((h) => h.name)).toEqual(['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo']);
    expect(third.nextCursor).toBeNull();
    expect(listProductHits(db, businessId, { limit: 50, includeInactive: false, categoryId: cat.id }, TODAY).items.map((h) => h.name)).toEqual(['Alpha', 'Bravo']);
  });
});

describe('categories', () => {
  it('refuses to make a category its own ancestor', async () => {
    const { db, businessId } = await setup();
    const food = createCategory(db, businessId, { name: 'Food', parentId: null }, ACTOR);
    const snacks = createCategory(db, businessId, { name: 'Snacks', parentId: food.id }, ACTOR);
    expect(() => updateCategory(db, food.id, 1, { name: 'Food', parentId: snacks.id }, ACTOR)).toThrow(AppError);
  });
});
