import { statSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { newUlid } from '@muneem/domain';
import { CompleteSaleInput, SaleDraft } from '@muneem/contracts';
import { getHydration, type Db } from '@muneem/db-sqlite';
import type { ReferenceServer } from '@muneem/sync-reference';
import type { App } from '../../src/main/app.js';
import { silentLoggers } from '../../src/main/infra/logger.js';
import { MemorySecretStore } from '../../src/main/infra/secrets.js';
import { Hydrator } from '../../src/main/sync/hydration/hydrator.js';
import { caller, testApp } from '../helpers.js';
import { runSoak } from '../soak/generator.js';
import { goldenDay } from './goldenDay.js';
import {
  books, bundleDownloader, DEVICE_A, DEVICE_B, healthy, hydrate, ownerMembership, referenceCloud, referenceTransport, syncedAppOptions, syncedDevice, syncUntilQuiet,
  type BundleFetchLog,
} from './syncHelpers.js';

const HEALTHY = { tieOuts: [], replay: [], partyMismatches: [], allocationFaults: [] };

async function newDevice(cloud: ReferenceServer, businessId: string, extra: Parameters<typeof syncedDevice>[3] = {}) {
  const b = await syncedDevice(cloud, DEVICE_B, () => [ownerMembership(businessId)], { coldStart: 'hydrate', bundleFetcher: bundleDownloader(cloud), ...extra });
  await caller(b.app).data('auth.login', { identifier: '9999999999', password: 'correct-horse' });
  return b;
}

function sellOne(app: App, db: Db, businessId: string): string {
  const p = db.prepare(`SELECT p.id, p.base_uom_id AS uom FROM product p JOIN stock_level s ON s.product_id = p.id
    WHERE p.business_id = ? AND p.is_active = 1 GROUP BY p.id ORDER BY SUM(s.qty_milli) DESC LIMIT 1`).get(businessId) as { id: string; uom: string };
  const draft = SaleDraft.parse({ lines: [{ productId: p.id, uomId: p.uom, qtyMilli: 1000 }] });
  const total = app.sales.quote(draft).totals.totalPaise;
  return app.sales.complete(CompleteSaleInput.parse({ ...draft, commandId: newUlid(), expectedTotalPaise: total, tenders: [{ method: 'cash', amountPaise: total }] })).saleId;
}

describe('hydration (7f): a new device imports the business from a bundle', () => {
  afterEach(() => { vi.useRealTimers(); });

  it('after a soak on A, B hydrates to the same books, holds billing until ready, then bills offline and syncs back', async () => {
    const cloud = referenceCloud();
    vi.useFakeTimers({ toFake: ['Date'] });
    const run = await runSoak({ seed: 5, days: 7, salesPerDay: 8, endDate: '2026-04-04', file: false, setTime: (ms) => vi.setSystemTime(ms), appOptions: syncedAppOptions(cloud, DEVICE_A) });
    await syncUntilQuiet(run.app);
    const a = { app: run.app, db: run.db, businessId: run.businessId };

    const b = await newDevice(cloud, a.businessId);
    const api = caller(b.app);
    expect(await api.data('sync.hydrationStatus')).toMatchObject({ businessId: a.businessId, status: 'none', held: true });
    expect((await api.call('products.list', {})).ok).toBe(false);
    expect(await b.app.syncEngine.run({ pull: true })).toMatchObject({ ran: false });

    const events: string[] = [];
    b.app.events.attach({ send: (ch, p) => { if (ch === 'sync.hydration') events.push((p as { status: string }).status); } });
    expect((await hydrate(b.app, a.businessId)).status).toBe('ready');
    expect(events).toEqual(expect.arrayContaining(['pending', 'downloading', 'importing', 'ready']));
    expect(await api.data('sync.hydrationStatus')).toMatchObject({ status: 'ready', held: false, linesTotal: expect.any(Number) });

    expect(books(b.db, a.businessId)).toEqual(books(a.db, a.businessId));
    expect(healthy(b.db, a.businessId)).toEqual(HEALTHY);
    expect(b.db.prepare('SELECT COUNT(*) FROM sync_outbox').pluck().get()).toBe(0);
    const asOf = getHydration(b.db, a.businessId)!.asOfSeq;
    expect(b.db.prepare('SELECT MIN(last_seq) FROM sync_cursor WHERE business_id = ?').pluck().get(a.businessId)).toBeGreaterThanOrEqual(asOf!);
    expect(b.db.prepare("SELECT COUNT(*) FROM audit_log WHERE business_id = ? AND action NOT LIKE '%auth.%' AND action NOT LIKE 'ipc.sync.%'").pluck().get(a.businessId)).toBe(0);
    expect(b.db.prepare("SELECT COUNT(*) FROM conflict_log WHERE kind IN ('apply_failed','unique_clash')").pluck().get()).toBe(0);

    const branchId = b.app.business.getBranches()[0]!.id;
    b.app.business.selectTerminal(b.app.business.createTerminal({ branchId, code: 'T02', name: 'Till 2' }).id);
    await b.app.register.open(10_000);
    const saleId = sellOne(b.app, b.db, a.businessId);
    await syncUntilQuiet(b.app);
    await syncUntilQuiet(a.app);
    expect(a.db.prepare('SELECT COUNT(*) FROM sale WHERE id = ?').pluck().get(saleId)).toBe(1);
    expect(books(a.db, a.businessId)).toEqual(books(b.db, a.businessId));
    expect(healthy(a.db, a.businessId)).toEqual(HEALTHY);
  }, 180_000);

  it('the golden flows reach a hydrated device with the catalog, and changes after the bundle arrive by the pull that follows', async () => {
    const cloud = referenceCloud();
    const a = await syncedDevice(cloud, DEVICE_A);
    const { businessId } = await goldenDay(a.app, a.db);
    await syncUntilQuiet(a.app);
    const b = await newDevice(cloud, businessId);
    const api = caller(b.app);
    expect(await api.data('sync.listCloudBusinesses')).toEqual([{ id: businessId, name: 'Sharma Store', stateCode: null, onThisDevice: false }]);
    expect((await api.call('sync.hydrationStart', { businessId: '01J00000000000000000000D09' })).ok).toBe(false);
    expect(await api.data('sync.hydrationStart', { businessId })).toMatchObject({ businessId, held: true });
    expect(await b.app.hydration.launch({ businessId, cloudDeviceId: DEVICE_B })).toMatchObject({ status: 'ready' });
    expect(await api.data('sync.listCloudBusinesses')).toEqual([expect.objectContaining({ id: businessId, onThisDevice: true })]);
    expect(b.db.prepare("SELECT action FROM audit_log WHERE action = 'ipc.sync.hydrationStart'").all()).toHaveLength(1);
    a.app.customers.create({ name: 'After the bundle' });
    await syncUntilQuiet(a.app);
    await syncUntilQuiet(b.app);
    const catalog = (db: Db) => ({
      products: db.prepare('SELECT id, name, gst_rate_bp, version FROM product WHERE business_id = ? ORDER BY id').all(businessId),
      prices: db.prepare('SELECT id, price_paise, effective_from, effective_to FROM price_list_item WHERE business_id = ? AND deleted_at IS NULL ORDER BY id').all(businessId),
      barcodes: db.prepare('SELECT id, code, product_id FROM barcode WHERE business_id = ? AND deleted_at IS NULL ORDER BY id').all(businessId),
      customers: db.prepare('SELECT id, name, credit_limit_paise FROM customer WHERE business_id = ? ORDER BY id').all(businessId),
      accounts: db.prepare('SELECT code, name FROM account WHERE business_id = ? AND deleted_at IS NULL ORDER BY code').all(businessId),
    });
    expect(books(b.db, businessId)).toEqual(books(a.db, businessId));
    expect(catalog(b.db)).toEqual(catalog(a.db));
    expect(healthy(b.db, businessId)).toEqual(HEALTHY);
    expect(b.app.products.lookupBarcode('8901030865275')).toMatchObject({ name: 'Parle-G Gold 100g' });
  }, 120_000);

  it('a download killed part-way resumes from its offset after a restart', async () => {
    const cloud = referenceCloud();
    const a = await syncedDevice(cloud, DEVICE_A);
    const { businessId } = await goldenDay(a.app, a.db);
    await syncUntilQuiet(a.app);

    const secrets = new MemorySecretStore();
    const first = await newDevice(cloud, businessId, { file: true, secrets, bundleFetcher: bundleDownloader(cloud, { ranges: [] }, 300) });
    first.app.hydration.start(businessId);
    await vi.waitFor(() => expect(statSync(join(first.dir, 'hydration', `${getHydration(first.db, businessId)!.snapshotId}.ndjson.gz`)).size).toBe(300));
    expect(getHydration(first.db, businessId)).toMatchObject({ status: 'downloading' });

    const log: BundleFetchLog = { ranges: [] };
    const restarted = await testApp({ ...syncedAppOptions(cloud, DEVICE_B), dbFile: join(first.dir, 'muneem.sqlite'), secrets, coldStart: 'hydrate', bundleFetcher: bundleDownloader(cloud, log) });
    const [done] = await restarted.app.hydration.resume();
    expect(done).toMatchObject({ status: 'ready' });
    expect(log.ranges).toEqual(['bytes=300-']);
    expect(books(restarted.db, businessId)).toEqual(books(a.db, businessId));
  }, 120_000);

  it('an import killed part-way picks up from its last page, and a full replay changes nothing', async () => {
    const cloud = referenceCloud();
    const a = await syncedDevice(cloud, DEVICE_A);
    const { businessId } = await goldenDay(a.app, a.db);
    await syncUntilQuiet(a.app);
    const b = await newDevice(cloud, businessId);

    let pages = 0;
    const hydrator = (killAfter: number) => new Hydrator({
      db: () => b.db, transport: referenceTransport(cloud, () => DEVICE_B), fetcher: bundleDownloader(cloud), dir: join(b.dir, 'hydration'), refreshAuth: async () => false,
      now: () => Date.now(), sleep: async () => undefined, pageSize: 20, log: silentLoggers().sync,
      onProgress: (h) => { if (h.status === 'importing' && h.linesImported > 0 && ++pages >= killAfter) throw new Error('killed'); },
    });
    const target = { businessId, cloudDeviceId: DEVICE_B };
    expect(await hydrator(2).run(target)).toMatchObject({ status: 'failed', linesImported: 40 });
    expect((await hydrator(Infinity).run(target)).status).toBe('ready');
    expect(books(b.db, businessId)).toEqual(books(a.db, businessId));

    const before = books(b.db, businessId);
    b.db.prepare("UPDATE hydration_state SET status = 'importing', lines_imported = 0").run();
    b.db.prepare('DELETE FROM sync_entity_version').run();
    await hydrator(Infinity).run(target);
    expect(books(b.db, businessId)).toEqual(before);
    expect(healthy(b.db, businessId)).toEqual(HEALTHY);
  }, 120_000);
});
