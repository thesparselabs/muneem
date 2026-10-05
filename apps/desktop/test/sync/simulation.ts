import { expect } from 'vitest';
import { newUlid } from '@muneem/domain';
import { CompleteReturnInput, CompleteSaleInput, CustomerInput, PaymentInput, ProductInput, ProductUpdate, SaleDraft } from '@muneem/contracts';
import { getMeta, META_KEYS, type Db } from '@muneem/db-sqlite';
import { Prng } from '../soak/generator.js';
import type { App } from '../../src/main/app.js';
import type { CloudHarness, FaultRates } from './cloudHarness.js';
import { books, healthy, syncUntilQuiet } from './syncHelpers.js';

export interface SimulationShape { rounds: number; actionsPerRound: number }
export const FULL_SHAPE: SimulationShape = { rounds: 6, actionsPerRound: 6 };
const FAULTS: FaultRates = { drop: 0.1, dropResponse: 0.1, duplicate: 0.1, error500: 0.1, reorder: 0.1 };

interface Device { name: string; app: App; db: Db }
export interface Simulated { devices: Device[]; businessId: string }

// ADR-0042: one seeded workload over three devices; faults while they trade, then the network heals and everything converges.
export async function simulate(seed: number, cloud: CloudHarness, shape: SimulationShape = FULL_SHAPE): Promise<Simulated> {
  const rng = new Prng(seed);
  const { clock, net } = cloud;

  const a = await cloud.device('A');
  const { businessId } = await cloud.ownerAtTill(a.app);
  const pcs = a.app.catalog.listUoms().find((u) => u.code === 'PCS')!.id;
  const products = Array.from({ length: 6 }, (_, i) => a.app.products.create(ProductInput.parse({
    name: `Item ${i + 1}`, baseUomId: pcs, gstRateBp: [0, 500, 1200, 1800][i % 4]!, sellingPricePaise: (i + 2) * 1000, priceIsInclusive: true,
  })).id);
  a.app.inventory.setOpeningStock({ lines: products.map((productId) => ({ productId, qtyMilli: 40_000, unitCostPaise: 500 })) });
  await a.app.register.open(50_000);
  await syncUntilQuiet(a.app);

  const devices: Device[] = [{ name: 'A', ...a }];
  for (const [name, code] of [['B', 'T02'], ['C', 'T03']] as const) {
    const d = await cloud.device(name);
    await cloud.login(d.app);
    await syncUntilQuiet(d.app);
    const branchId = d.app.business.getBranches()[0]!.id;
    d.app.business.selectTerminal(d.app.business.createTerminal({ branchId, code, name: `Till ${code}` }).id);
    await d.app.register.open(50_000);
    await syncUntilQuiet(d.app);
    devices.push({ name, ...d });
  }
  net.faults(FAULTS);

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
    } else if (roll < 0.96) {
      const own = d.db.prepare("SELECT id FROM payment WHERE business_id = ? AND status = 'posted' AND device_id = ? ORDER BY id")
        .pluck().all(businessId, getMeta(d.db, META_KEYS.installationId)) as string[];
      if (own.length > 0) d.app.payments.cancel(rng.pick(own), 'bounced');
    } else if (roll < 0.97) {
      d.app.inventory.adjust({ lines: [{ productId: rng.pick(products), qtyMilli: -1000, reason: 'damage' }] });
    } else {
      returnOwnSale(d);
    }
  };

  // ADR-0043: a device takes back one unit of its own latest bill that still has some left, refunding the way it was paid.
  const returnOwnSale = (d: Device) => {
    const own = d.db.prepare('SELECT id FROM sale WHERE business_id = ? AND device_id = ? AND credit_paise = 0 ORDER BY created_at DESC, id DESC LIMIT 5')
      .pluck().all(businessId, getMeta(d.db, META_KEYS.installationId)) as string[];
    for (const saleId of own) {
      const line = d.app.returns.quote({ saleId, lines: [{ lineNo: 1, qtyMilli: 1 }] }).lines.find((l) => l.returnableQtyMilli >= 1000);
      if (!line) continue;
      const draft = { saleId, lines: [{ lineNo: line.lineNo, qtyMilli: 1000 }], refundMethod: 'upi' as const };
      d.app.returns.complete(CompleteReturnInput.parse({ ...draft, commandId: newUlid(), reason: 'returned', expectedTotalPaise: d.app.returns.quote(draft).totalPaise }));
      return;
    }
  };

  for (let round = 0; round < shape.rounds; round++) {
    net.partition(rng.chance(0.3));
    for (const d of rng.sample(devices, devices.length)) {
      for (let i = 0; i < shape.actionsPerRound; i++) { clock.tick(1000); act(d); }
      if (rng.chance(0.5)) await d.app.syncEngine.run({ pull: rng.chance(0.7) });
      if (rng.chance(0.15)) {
        d.db.prepare("UPDATE sync_outbox SET status = 'in_flight', last_attempt_at = ? WHERE status = 'pending'").run(new Date(clock.now() - 10 * 60_000).toISOString());
        d.app.syncEngine.recover();
      }
    }
  }

  net.partition(false);
  net.faults({});
  clock.idle(30 * 60_000);
  for (let pass = 0; pass < 3; pass++) {
    for (const d of devices) { d.app.syncEngine.retryNow(); await syncUntilQuiet(d.app); }
  }
  return { devices, businessId };
}

const catalog = (db: Db, businessId: string) => ({
  products: db.prepare('SELECT id, name, gst_rate_bp, version FROM product WHERE business_id = ? ORDER BY id').all(businessId),
  prices: db.prepare('SELECT id, product_id, price_paise, effective_from, effective_to FROM price_list_item WHERE business_id = ? AND deleted_at IS NULL ORDER BY id').all(businessId),
  customers: db.prepare('SELECT id, name, credit_limit_paise FROM customer WHERE business_id = ? ORDER BY id').all(businessId),
});
const unsent = (db: Db) => db.prepare("SELECT entity_type, operation_type, status, attempt_count, error_code, error_class, error_message FROM sync_outbox WHERE status NOT IN ('sent', 'superseded')").all();

// No loss, no duplicates, and every device (and the cloud) on the same books.
export async function expectConverged(seed: number, cloud: CloudHarness, { devices, businessId }: Simulated, shape: SimulationShape = FULL_SHAPE) {
  expect(cloud.net.injected(), `seed ${seed} injected faults`).toBeGreaterThan(0);
  expect(await cloud.deadLetters(businessId), `seed ${seed}`).toEqual([]);
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
  expect(sent, `seed ${seed}: all three devices sold`).toBeGreaterThan(shape.rounds * 5);
  expect(new Set(reference.journals.map((j) => (j as { entry_no: string }).entry_no.slice(0, 4))).size, `seed ${seed}: three terminals' numbers`).toBeGreaterThanOrEqual(3);
  expect(await cloud.cloudSales(businessId), `seed ${seed}: the cloud holds each sale once`).toBe(sent);
  const deviceChains = Object.fromEntries(devices.flatMap((d) => d.db.prepare('SELECT device_id, COUNT(*) AS n FROM audit_log WHERE business_id = ? GROUP BY device_id')
    .all(businessId).map((r) => { const { device_id, n } = r as { device_id: string; n: number }; return [device_id, n]; })));
  expect(Object.keys(deviceChains), `seed ${seed}: each device kept an audit trail`).toHaveLength(devices.length);
  expect(await cloud.auditChains(businessId), `seed ${seed}: every device's audit rows reached the cloud`).toEqual(deviceChains);
  const cloudTrialBalance = await cloud.trialBalance(businessId);
  if (cloudTrialBalance) expect(cloudTrialBalance, `seed ${seed}: cloud Trial Balance`).toEqual(reference.trialBalance);
  return { sales: sent, trialBalance: reference.trialBalance };
}
