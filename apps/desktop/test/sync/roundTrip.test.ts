import { afterEach, describe, expect, it, vi } from 'vitest';
import { ProductUpdate } from '@muneem/contracts';
import { caller } from '../helpers.js';
import { goldenDay } from './goldenDay.js';
import { runSoak } from '../soak/generator.js';
import { books, DEVICE_A, DEVICE_B, healthy, ownerMembership, referenceCloud, syncedAppOptions, syncedDevice, syncUntilQuiet } from './syncHelpers.js';

describe('sync round trip (7e): what device A does appears on device B', () => {
  afterEach(() => { vi.useRealTimers(); });

  it('a short soak on A is pulled by B: the same documents, stock, party balances and Trial Balance, and both books hold', async () => {
    const cloud = referenceCloud();
    vi.useFakeTimers({ toFake: ['Date'] });
    const run = await runSoak({ seed: 11, days: 7, salesPerDay: 8, endDate: '2026-04-04', file: false, setTime: (ms) => vi.setSystemTime(ms), appOptions: syncedAppOptions(cloud, DEVICE_A) });
    await syncUntilQuiet(run.app);
    expect(run.db.prepare("SELECT status, COUNT(*) AS n FROM sync_outbox GROUP BY status").all()).toEqual([{ status: 'sent', n: expect.any(Number) }]);
    expect(cloud.deadLetters(run.businessId)).toEqual([]);

    const b = await syncedDevice(cloud, DEVICE_B, () => [ownerMembership(run.businessId)]);
    await caller(b.app).data('auth.login', { identifier: '9999999999', password: 'correct-horse' });
    await syncUntilQuiet(b.app);

    const pulled = books(b.db, run.businessId);
    expect(pulled).toEqual(books(run.db, run.businessId));
    expect(Object.fromEntries(Object.entries(pulled).map(([k, v]) => [k, v.length > 0]))).toEqual(Object.fromEntries(Object.keys(pulled).map((k) => [k, true])));
    expect(run.counts).toMatchObject({ cancelledPayments: expect.any(Number), writeOffs: expect.any(Number), periodsLocked: 1, manualJournals: expect.any(Number) });
    expect(healthy(b.db, run.businessId)).toEqual({ tieOuts: [], replay: [], partyMismatches: [], allocationFaults: [] });
    expect(healthy(run.db, run.businessId)).toEqual({ tieOuts: [], replay: [], partyMismatches: [], allocationFaults: [] });
    expect(b.db.prepare('SELECT COUNT(*) FROM sync_outbox').pluck().get()).toBe(0);
    expect(b.db.prepare("SELECT COUNT(*) FROM audit_log WHERE business_id = ? AND action NOT LIKE '%auth.%'").pluck().get(run.businessId)).toBe(0);

    // No echo: A pulling its own changes back changes nothing.
    const before = books(run.db, run.businessId);
    const outbox = run.db.prepare('SELECT COUNT(*) FROM sync_outbox').pluck().get();
    await syncUntilQuiet(run.app);
    expect(books(run.db, run.businessId)).toEqual(before);
    expect(run.db.prepare('SELECT COUNT(*) FROM sync_outbox').pluck().get()).toBe(outbox);
  }, 180_000);

  it('the golden flows on A reach B, catalog and prices included; a price edited from a stale copy comes back merged to its sender', async () => {
    const cloud = referenceCloud();
    const a = await syncedDevice(cloud, DEVICE_A);
    const { businessId, soapId } = await goldenDay(a.app, a.db);
    await syncUntilQuiet(a.app);
    const b = await syncedDevice(cloud, DEVICE_B, () => [ownerMembership(businessId)]);
    await caller(b.app).data('auth.login', { identifier: '9999999999', password: 'correct-horse' });
    await syncUntilQuiet(b.app);

    const catalog = (db: typeof a.db) => ({
      products: db.prepare('SELECT id, name, base_uom_id, gst_rate_bp, is_active, version FROM product WHERE business_id = ? ORDER BY id').all(businessId),
      prices: db.prepare('SELECT id, product_id, price_paise, effective_from, effective_to FROM price_list_item WHERE business_id = ? AND deleted_at IS NULL ORDER BY id').all(businessId),
      barcodes: db.prepare('SELECT id, code, product_id FROM barcode WHERE business_id = ? AND deleted_at IS NULL ORDER BY id').all(businessId),
      customers: db.prepare('SELECT id, name, credit_limit_paise FROM customer WHERE business_id = ? ORDER BY id').all(businessId),
    });
    expect(books(b.db, businessId)).toEqual(books(a.db, businessId));
    expect(catalog(b.db)).toEqual(catalog(a.db));
    expect(healthy(b.db, businessId)).toEqual({ tieOuts: [], replay: [], partyMismatches: [], allocationFaults: [] });
    expect(b.app.products.lookupBarcode('8901030865275')).toMatchObject({ name: 'Parle-G Gold 100g' });

    // A raises the soap's price and pushes; B, still on the old copy, renames it and changes the price too.
    const fromA = a.app.products.get(soapId);
    a.app.products.update(ProductUpdate.parse({ ...fromA, sellingPricePaise: 5000, barcodes: fromA.barcodes.map((x) => ({ code: x.code })), conversions: fromA.conversions.map((c) => ({ fromUomId: c.fromUomId, factorMilli: c.factorMilli })) }));
    await syncUntilQuiet(a.app);
    const fromB = b.app.products.get(soapId);
    b.app.products.update(ProductUpdate.parse({ ...fromB, name: 'Soap Bar', sellingPricePaise: 4000, barcodes: fromB.barcodes.map((x) => ({ code: x.code })), conversions: fromB.conversions.map((c) => ({ fromUomId: c.fromUomId, factorMilli: c.factorMilli })) }));
    await syncUntilQuiet(b.app);
    await syncUntilQuiet(a.app);

    expect(b.app.products.get(soapId)).toMatchObject({ name: 'Soap Bar', sellingPricePaise: 5000 });
    expect(a.app.products.get(soapId)).toMatchObject({ name: 'Soap Bar', sellingPricePaise: 5000 });
    expect(catalog(b.db)).toEqual(catalog(a.db));
    expect(cloud.conflicts(businessId).map((c) => [c.kind, c.rule, c.winner])).toEqual(expect.arrayContaining([['conflict', 'cloud_wins', 'cloud']]));
    expect(b.db.prepare("SELECT COUNT(*) FROM conflict_log WHERE kind = 'conflict'").pluck().get()).toBeGreaterThan(0);
  }, 120_000);
});
