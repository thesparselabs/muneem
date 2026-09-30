import { beforeEach, describe, expect, it } from 'vitest';
import { ROLE_PRESETS } from '@muneem/contracts';
import { verifyAuditChain, type Db } from '@muneem/db-sqlite';
import type { App } from '../src/main/app.js';
import { testApp } from './helpers.js';

let app: App;
let db: Db;
const call = <T = unknown>(channel: string, input: unknown = {}) =>
  app.gateway.handle(channel, input, 1) as Promise<{ ok: true; data: T } | { ok: false; error: { code: string; fields?: Record<string, string> } }>;
const data = async <T>(channel: string, input: unknown = {}): Promise<T> => {
  const r = await call<T>(channel, input);
  if (!r.ok) throw new Error(`${channel}: ${JSON.stringify(r.error)}`);
  return r.data;
};

async function ownerWithBusiness(): Promise<{ pcs: string }> {
  await call('auth.login', { identifier: '9999999999', password: 'correct-horse' });
  await call('business.create', { name: 'Shop', businessType: 'retail', stateCode: '07', taxScheme: 'regular' });
  const uoms = await data<{ id: string; code: string }[]>('catalog.listUoms');
  return { pcs: uoms.find((u) => u.code === 'PCS')!.id };
}

const biscuit = (pcs: string) => ({
  name: 'Parle-G 100g', sku: 'PG100', hsnCode: '1905', baseUomId: pcs, gstRateBp: 1800, mrpPaise: 1000, sellingPricePaise: 950,
  barcodes: [{ code: '8901030865275' }],
});

beforeEach(async () => { ({ app, db } = await testApp()); });

describe('catalog over IPC', () => {
  it('a new business starts with units and a Retail price list', async () => {
    await ownerWithBusiness();
    expect((await data<unknown[]>('catalog.listUoms')).length).toBe(9);
    expect(await data('pricing.listLists')).toEqual([expect.objectContaining({ name: 'Retail', isDefault: true })]);
  });

  it('create → scan → search → update → deactivate, with the audit chain intact', async () => {
    const { pcs } = await ownerWithBusiness();
    const p = await data<{ id: string; version: number }>('products.create', biscuit(pcs));
    expect(await data('products.lookupBarcode', { code: '8901030865275' })).toMatchObject({ productId: p.id, pricePaise: 950, matchedBy: 'barcode' });
    expect(await data('products.search', { query: 'PG100' })).toEqual([expect.objectContaining({ matchedBy: 'sku' })]);
    expect(await data('products.search', { query: 'parle' })).toEqual([expect.objectContaining({ matchedBy: 'name' })]);
    expect(await data('products.search', { query: '100g' })).toEqual([expect.objectContaining({ matchedBy: 'text' })]);

    const updated = await data<{ version: number }>('products.update', { ...biscuit(pcs), id: p.id, version: p.version, sellingPricePaise: 900 });
    expect(await data('products.lookupBarcode', { code: '8901030865275' })).toMatchObject({ pricePaise: 900 });

    await data('products.deactivate', { id: p.id, version: updated.version });
    expect(await data('products.lookupBarcode', { code: '8901030865275' })).toBeNull();
    const s = app.session.require();
    expect(verifyAuditChain(db, s.businessId!, app.device.localDeviceId()).ok).toBe(true);
  });

  it('maps rule violations to field errors', async () => {
    const { pcs } = await ownerWithBusiness();
    const r = await call('products.create', { ...biscuit(pcs), sellingPricePaise: 1100 });
    expect(r).toMatchObject({ ok: false, error: { code: 'VALIDATION_FAILED', fields: { sellingPricePaise: 'selling price is above MRP' } } });
    await data('products.create', biscuit(pcs));
    expect(await call('products.create', { ...biscuit(pcs), sku: 'OTHER' })).toMatchObject({ ok: false, error: { code: 'ALREADY_EXISTS' } });
    expect(await call('products.create', { ...biscuit(pcs), barcodes: [] })).toMatchObject({ ok: false, error: { code: 'ALREADY_EXISTS' } });
  });

  it('price items above MRP are rejected', async () => {
    const { pcs } = await ownerWithBusiness();
    const p = await data<{ id: string }>('products.create', biscuit(pcs));
    const [retail] = await data<{ id: string }[]>('pricing.listLists');
    const r = await call('pricing.setItems', { priceListId: retail!.id, productId: p.id, items: [{ uomId: pcs, pricePaise: 1200, effectiveFrom: '2026-01-01' }] });
    expect(r).toMatchObject({ ok: false, error: { code: 'VALIDATION_FAILED' } });
  });

  it('checks pack prices against MRP scaled by the unit conversion', async () => {
    const { pcs } = await ownerWithBusiness();
    const uoms = await data<{ id: string; code: string }[]>('catalog.listUoms');
    const box = uoms.find((u) => u.code === 'BOX')!.id;
    const kg = uoms.find((u) => u.code === 'KG')!.id;
    const p = await data<{ id: string }>('products.create', { ...biscuit(pcs), mrpPaise: 2000, sellingPricePaise: 1900, conversions: [{ fromUomId: box, factorMilli: 24_000 }] });
    const [retail] = await data<{ id: string }[]>('pricing.listLists');
    const set = (items: unknown[]) => call('pricing.setItems', { priceListId: retail!.id, productId: p.id, items });
    expect(await set([{ uomId: box, pricePaise: 45_000, effectiveFrom: '2026-01-01' }])).toMatchObject({ ok: true });
    expect(await set([{ uomId: box, pricePaise: 48_001, effectiveFrom: '2026-01-01' }])).toMatchObject({ ok: false, error: { fields: { 'items.0.pricePaise': 'price is above MRP (₹480.00 per BOX)' } } });
    expect(await set([{ uomId: kg, pricePaise: 100, effectiveFrom: '2026-01-01' }])).toMatchObject({ ok: false, error: { fields: { 'items.0.uomId': 'add a conversion for this unit on the product first' } } });
  });

  it('reports an end date before the start date on the field instead of a generic error', async () => {
    const { pcs } = await ownerWithBusiness();
    const p = await data<{ id: string }>('products.create', biscuit(pcs));
    const [retail] = await data<{ id: string }[]>('pricing.listLists');
    const r = await call('pricing.setItems', { priceListId: retail!.id, productId: p.id, items: [{ uomId: pcs, pricePaise: 900, effectiveFrom: '2026-10-05', effectiveTo: '2026-10-01' }] });
    expect(r).toMatchObject({ ok: false, error: { code: 'VALIDATION_FAILED', fields: { 'items.0.effectiveTo': 'must be after the "from" date' } } });
  });

  it('a cashier can search but cannot create products', async () => {
    const { pcs } = await ownerWithBusiness();
    await data('products.create', biscuit(pcs));
    const s = app.session.require();
    db.prepare('UPDATE user_membership SET grants_json = ? WHERE user_id = ?').run(JSON.stringify(ROLE_PRESETS.cashier), s.user.id);
    expect(await data<unknown[]>('products.search', { query: 'parle' })).toHaveLength(1);
    expect(await call('products.create', { ...biscuit(pcs), sku: 'X', barcodes: [] })).toMatchObject({ ok: false, error: { code: 'PERMISSION_DENIED' } });
  });
});
