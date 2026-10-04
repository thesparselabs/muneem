import { afterEach, describe, expect, it, vi } from 'vitest';
import { newUlid } from '@muneem/domain';
import { CompleteSaleInput, CustomerInput, PaymentInput, ProductInput, ProductUpdate, SaleDraft } from '@muneem/contracts';
import type { Db } from '@muneem/db-sqlite';
import { FaultInjector, type ReferenceServer } from '@muneem/sync-reference';
import { Prng } from '../soak/generator.js';
import type { App } from '../../src/main/app.js';
import { caller, ownerAtTill, USER_ID } from '../helpers.js';
import { books, DEVICE_A, DEVICE_B, healthy, ownerMembership, referenceCloud, syncedDevice, syncUntilQuiet } from './syncHelpers.js';

const DEVICE_C = '01J0000000000000000000DEVC';
const SEEDS = Number(process.env.MUNEEM_SIM_SEEDS ?? 20);
const ROUNDS = 6;
const ACTIONS_PER_ROUND = 6;
const START = Date.parse('2026-10-05T04:00:00.000Z');

interface Device { name: string; app: App; db: Db }

// ADR-0042: one seeded workload over three devices; faults while they trade, then the network heals and everything converges.
async function simulate(seed: number) {
  const rng = new Prng(seed);
  let now = START;
  const tick = (ms = 1000) => { now += ms; vi.setSystemTime(now); };
  vi.setSystemTime(now);
  const cloud = referenceCloud();
  cloud.registerDevice(DEVICE_C, USER_ID);
  const net = new FaultInjector(cloud, { seed, drop: 0.1, dropResponse: 0.1, duplicate: 0.1, error500: 0.1, reorder: 0.1 }, () => Promise.resolve());

  const a = await syncedDevice(net, DEVICE_A);
  const { businessId } = await ownerAtTill(a.app);
  const pcs = a.app.catalog.listUoms().find((u) => u.code === 'PCS')!.id;
  const products = Array.from({ length: 6 }, (_, i) => a.app.products.create(ProductInput.parse({
    name: `Item ${i + 1}`, baseUomId: pcs, gstRateBp: [0, 500, 1200, 1800][i % 4]!, sellingPricePaise: (i + 2) * 1000, priceIsInclusive: true,
  })).id);
  a.app.inventory.setOpeningStock({ lines: products.map((productId) => ({ productId, qtyMilli: 40_000, unitCostPaise: 500 })) });
  await a.app.register.open(50_000);
  net.configure({ drop: 0, dropResponse: 0, duplicate: 0, error500: 0, reorder: 0 });
  await syncUntilQuiet(a.app);

  const devices: Device[] = [{ name: 'A', ...a }];
  for (const [name, id, code] of [['B', DEVICE_B, 'T02'], ['C', DEVICE_C, 'T03']] as const) {
    const d = await syncedDevice(net, id, () => [ownerMembership(businessId)]);
    await caller(d.app).data('auth.login', { identifier: '9999999999', password: 'correct-horse' });
    await syncUntilQuiet(d.app);
    const branchId = d.app.business.getBranches()[0]!.id;
    d.app.business.selectTerminal(d.app.business.createTerminal({ branchId, code, name: `Till ${code}` }).id);
    await d.app.register.open(50_000);
    await syncUntilQuiet(d.app);
    devices.push({ name, ...d });
  }
  net.configure({ drop: 0.1, dropResponse: 0.1, duplicate: 0.1, error500: 0.1, reorder: 0.1 });

  const act = (d: Device) => {
    const customers = d.db.prepare('SELECT id FROM customer WHERE business_id = ? ORDER BY id').pluck().all(businessId) as string[];
    const roll = rng.next();
    if (customers.length === 0 && roll >= 0.45 && roll < 0.7) {
      const c = d.app.customers.create(CustomerInput.parse({ name: `${d.name} first customer`, creditDays: 15 }));
      d.app.customers.setCreditLimit({ id: c.id, version: c.version, limitPaise: 1_000_000 });
    } else if (roll < 0.45) {
      const draft = SaleDraft.parse({ lines: rng.sample(products, rng.int(1, 3)).map((productId) => ({ productId, uomId: pcs, qtyMilli: rng.int(1, 2) * 1000 })) });
      const total = d.app.sales.quote(draft).totals.totalPaise;
      d.app.sales.complete(CompleteSaleInput.parse({ ...draft, commandId: newUlid(), expectedTotalPaise: total, tenders: [{ method: 'cash', amountPaise: total }] }));
    } else if (roll < 0.6) {
      const draft = SaleDraft.parse({ lines: [{ productId: rng.pick(products), uomId: pcs, qtyMilli: 1000 }], customerId: rng.pick(customers) });
      const total = d.app.sales.quote(draft).totals.totalPaise;
      d.app.sales.complete(CompleteSaleInput.parse({ ...draft, commandId: newUlid(), expectedTotalPaise: total, tenders: [{ method: 'credit', amountPaise: total }] }));
    } else if (roll < 0.7) {
      d.app.payments.create(PaymentInput.parse({ partyType: 'customer', partyId: rng.pick(customers), amountPaise: rng.int(1, 20) * 100, method: 'cash', commandId: newUlid() }));
    } else if (roll < 0.82) {
      const p = d.app.products.get(rng.pick(products));
      d.app.products.update(ProductUpdate.parse({ ...p, sellingPricePaise: rng.int(10, 90) * 100, barcodes: p.barcodes.map((x) => ({ code: x.code })),
        conversions: p.conversions.map((c) => ({ fromUomId: c.fromUomId, factorMilli: c.factorMilli })) }));
    } else if (roll < 0.92) {
      const c = d.app.customers.create(CustomerInput.parse({ name: `${d.name} customer ${rng.int(1, 1_000_000)}`, creditDays: 15 }));
      d.app.customers.setCreditLimit({ id: c.id, version: c.version, limitPaise: 1_000_000 });
    } else {
      d.app.inventory.adjust({ lines: [{ productId: rng.pick(products), qtyMilli: -1000, reason: 'damage' }] });
    }
  };

  for (let round = 0; round < ROUNDS; round++) {
    net.partition(rng.chance(0.3));
    for (const d of rng.sample(devices, devices.length)) {
      for (let i = 0; i < ACTIONS_PER_ROUND; i++) { tick(); act(d); }
      if (rng.chance(0.5)) await d.app.syncEngine.run({ pull: rng.chance(0.7) });
      if (rng.chance(0.15)) {
        d.db.prepare("UPDATE sync_outbox SET status = 'in_flight', last_attempt_at = ? WHERE status = 'pending'").run(new Date(now - 10 * 60_000).toISOString());
        d.app.syncEngine.recover();
      }
    }
  }

  net.partition(false);
  net.configure({ drop: 0, dropResponse: 0, duplicate: 0, error500: 0, reorder: 0 });
  tick(30 * 60_000);
  for (let pass = 0; pass < 3; pass++) {
    for (const d of devices) { d.app.syncEngine.retryNow(); await syncUntilQuiet(d.app); }
  }
  return { cloud, devices, businessId, faults: net.events };
}

const catalog = (db: Db, businessId: string) => ({
  products: db.prepare('SELECT id, name, gst_rate_bp, version FROM product WHERE business_id = ? ORDER BY id').all(businessId),
  prices: db.prepare('SELECT id, product_id, price_paise, effective_from, effective_to FROM price_list_item WHERE business_id = ? AND deleted_at IS NULL ORDER BY id').all(businessId),
  customers: db.prepare('SELECT id, name, credit_limit_paise FROM customer WHERE business_id = ? ORDER BY id').all(businessId),
});
const unsent = (db: Db) => db.prepare("SELECT entity_type, operation_type, status, attempt_count, error_code, error_class, error_message FROM sync_outbox WHERE status NOT IN ('sent', 'superseded')").all();
const conflictOutcomes = (cloud: ReferenceServer, businessId: string) =>
  cloud.conflicts(businessId).map((c) => `${c.kind}:${c.entityType}:${c.field ?? ''}:${c.rule}:${c.winner}`);

describe('sync simulation (7h, ADR-0042)', () => {
  afterEach(() => { vi.useRealTimers(); });

  it(`${SEEDS} seeds: no loss, no duplicates, every device converges on the same books`, async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    for (let seed = 1; seed <= SEEDS; seed++) {
      const { cloud, devices, businessId, faults } = await simulate(seed);
      expect(faults.filter((f) => f.fault !== 'delivered').length, `seed ${seed} injected faults`).toBeGreaterThan(0);
      expect(cloud.deadLetters(businessId), `seed ${seed}`).toEqual([]);
      const reference = books(devices[0]!.db, businessId);
      const referenceCatalog = catalog(devices[0]!.db, businessId);
      for (const d of devices) {
        expect(unsent(d.db), `seed ${seed} device ${d.name} unsent`).toEqual([]);
        expect(books(d.db, businessId), `seed ${seed} device ${d.name}`).toEqual(reference);
        expect(catalog(d.db, businessId), `seed ${seed} device ${d.name} catalog`).toEqual(referenceCatalog);
        expect(healthy(d.db, businessId), `seed ${seed} device ${d.name}`).toEqual({ tieOuts: [], replay: [], partyMismatches: [], allocationFaults: [] });
      }
      const sent = devices.reduce((n, d) => n + (d.db.prepare("SELECT COUNT(*) FROM sync_outbox WHERE entity_type = 'sale'").pluck().get() as number), 0);
      expect(reference.sales.length, `seed ${seed}: every sale exactly once`).toBe(sent);
      expect(sent, `seed ${seed}: all three devices sold`).toBeGreaterThan(30);
      expect(new Set(reference.journals.map((j) => (j as { entry_no: string }).entry_no.slice(0, 4))).size, `seed ${seed}: three terminals' numbers`).toBeGreaterThanOrEqual(3);
      const cloudSales = [...cloud.business(businessId)!.entities.values()].filter((e) => e.entityType === 'sale').length;
      expect(cloudSales, `seed ${seed}: the cloud holds each sale once`).toBe(sent);
    }
  }, 900_000);

  it('the same seed gives the same conflict outcomes', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const first = await simulate(4242);
    const second = await simulate(4242);
    expect(conflictOutcomes(second.cloud, second.businessId)).toEqual(conflictOutcomes(first.cloud, first.businessId));
    expect(conflictOutcomes(first.cloud, first.businessId).length).toBeGreaterThan(0);
  }, 300_000);
});
