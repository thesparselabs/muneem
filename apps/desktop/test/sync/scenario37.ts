import { join } from 'node:path';
import { expect } from 'vitest';
import { newUlid } from '@muneem/domain';
import { CompleteSaleInput, ProductInput, SaleDraft } from '@muneem/contracts';
import { getMeta, META_KEYS, stockReconciliation, verifyAuditChain, type Db } from '@muneem/db-sqlite';
import type { App } from '../../src/main/app.js';
import { caller } from '../helpers.js';
import type { CloudHarness } from './cloudHarness.js';
import { books, healthy, syncUntilQuiet } from './syncHelpers.js';

export function sell(app: App, productId: string, uomId: string, qtyMilli = 1000, commandId = newUlid()) {
  const draft = SaleDraft.parse({ lines: [{ productId, uomId, qtyMilli }] });
  const total = app.sales.quote(draft).totals.totalPaise;
  return app.sales.complete(CompleteSaleInput.parse({ ...draft, commandId, expectedTotalPaise: total, tenders: [{ method: 'cash', amountPaise: total }] }));
}

const saleCount = (db: Db, businessId: string) => db.prepare("SELECT COUNT(*) FROM sale WHERE business_id = ? AND status = 'posted'").pluck().get(businessId) as number;

// PRD §37 with the review's additions (§6): nothing lost, duplicated or silently overwritten; stock, books, payments and the audit trail right.
export async function scenario37(cloud: CloudHarness) {
  const { clock, net } = cloud;

  // Internet on: one sale reaches the cloud.
  const first = await cloud.device('A', { file: true });
  const { businessId } = await cloud.ownerAtTill(first.app);
  await caller(first.app).data('printer.setConfig', { kind: 'none' });
  const pcs = first.app.catalog.listUoms().find((u) => u.code === 'PCS')!.id;
  const tea = first.app.products.create(ProductInput.parse({ name: 'Tea 250g', baseUomId: pcs, gstRateBp: 500, sellingPricePaise: 12_000, priceIsInclusive: true })).id;
  const last = first.app.products.create(ProductInput.parse({ name: 'Last Kettle', baseUomId: pcs, gstRateBp: 1800, sellingPricePaise: 150_000, priceIsInclusive: true })).id;
  first.app.inventory.setOpeningStock({ lines: [{ productId: tea, qtyMilli: 500_000, unitCostPaise: 8000 }, { productId: last, qtyMilli: 1000, unitCostPaise: 100_000 }] });
  await first.app.register.open(100_000);
  sell(first.app, tea, pcs);
  await syncUntilQuiet(first.app);

  // Terminal B joins while online and pulls everything, then the internet goes off for both.
  const b = await cloud.device('B');
  await cloud.login(b.app);
  await syncUntilQuiet(b.app);
  b.app.business.selectTerminal(b.app.business.createTerminal({ branchId: b.app.business.getBranches()[0]!.id, code: 'T02', name: 'Till 2' }).id);
  await b.app.register.open(100_000);
  await syncUntilQuiet(b.app);
  net.partition(true);

  // Offline: 100 sales on A, a double-submitted sale, a stock change and both terminals selling the last kettle.
  for (let i = 0; i < 100; i++) { clock.tick(); sell(first.app, tea, pcs, (1 + (i % 3)) * 1000); }
  const repeated = newUlid();
  clock.tick();
  const once = sell(first.app, tea, pcs, 1000, repeated);
  expect(sell(first.app, tea, pcs, 1000, repeated).saleId).toBe(once.saleId);
  first.app.inventory.adjust({ lines: [{ productId: tea, qtyMilli: -2000, reason: 'damage' }] });
  sell(first.app, last, pcs);
  sell(b.app, last, pcs);
  expect(await first.app.syncEngine.run({ pull: true })).toMatchObject({ ran: true });

  // Restart A on the same database; the clock jumps back an hour, and more sales follow.
  const dbFile = join(first.dir, 'muneem.sqlite');
  first.db.close();
  const a = await cloud.device('A', { dbFile });
  await cloud.login(a.app);
  clock.jump(-3_600_000);
  for (let i = 0; i < 10; i++) { clock.tick(); sell(a.app, tea, pcs); }

  // Internet back; the first push is answered but the answer is lost, and A is killed before it hears.
  net.partition(false);
  clock.reconnect();
  const faultsBefore = net.injected();
  const cloudSalesBefore = await cloud.cloudSales(businessId);
  net.faults({ dropResponse: 1 });
  await a.app.syncEngine.run({ pull: false });
  net.faults({});
  expect(net.injected(), 'the push answer was lost').toBeGreaterThan(faultsBefore);
  expect(await cloud.cloudSales(businessId), 'the cloud applied the push whose answer was lost').toBeGreaterThan(cloudSalesBefore);
  a.db.prepare("UPDATE sync_outbox SET status = 'in_flight', last_attempt_at = ? WHERE status <> 'sent'").run(new Date(clock.now() - 10 * 60_000).toISOString());
  a.db.close();
  const restarted = await cloud.device('A', { dbFile });
  await cloud.login(restarted.app);
  expect(restarted.app.syncEngine.recover()).toBeGreaterThan(0);
  restarted.app.syncEngine.retryNow();
  await syncUntilQuiet(restarted.app);
  b.app.syncEngine.retryNow();
  await syncUntilQuiet(b.app);
  await syncUntilQuiet(restarted.app);

  // Nothing lost or duplicated: 1 + 100 + 1 + 1 + 10 sales on A and 1 on B, each held once by the cloud and by both terminals.
  expect(saleCount(restarted.db, businessId)).toBe(114);
  expect(saleCount(b.db, businessId)).toBe(114);
  expect(await cloud.cloudSales(businessId)).toBe(114);
  expect(await cloud.deadLetters(businessId)).toEqual([]);
  expect(restarted.db.prepare("SELECT COUNT(*) FROM sync_outbox WHERE status NOT IN ('sent', 'superseded')").pluck().get()).toBe(0);

  // Stock, books, payments and the audit trail agree and hold; the cloud's Trial Balance is the devices'.
  const deviceBooks = books(restarted.db, businessId);
  expect(books(b.db, businessId)).toEqual(deviceBooks);
  const cloudTrialBalance = await cloud.trialBalance(businessId);
  if (cloudTrialBalance) expect(cloudTrialBalance).toEqual(deviceBooks.trialBalance);
  for (const db of [restarted.db, b.db]) expect(healthy(db, businessId)).toEqual({ tieOuts: [], replay: [], partyMismatches: [], allocationFaults: [] });
  const kettle = (db: Db) => db.prepare('SELECT SUM(qty_milli) FROM stock_level WHERE business_id = ? AND product_id = ?').pluck().get(businessId, last);
  expect([kettle(restarted.db), kettle(b.db)]).toEqual([-1000, -1000]);
  const oversold = (db: Db) => stockReconciliation(db, businessId, getMeta(db, META_KEYS.installationId)!, 50)
    .filter((r) => r.productId === last).map((r) => ({ terminal: r.terminalCode, viaSync: r.viaSync, balanceAfterMilli: r.balanceAfterMilli }));
  expect(oversold(restarted.db)).toEqual([{ terminal: 'T02', viaSync: true, balanceAfterMilli: -1000 }]);
  expect(oversold(b.db)).toEqual([{ terminal: 'T02', viaSync: false, balanceAfterMilli: -1000 }]);
  for (const [db, app] of [[restarted.db, restarted.app], [b.db, b.app]] as const) {
    expect(verifyAuditChain(db, businessId, getMeta(db, META_KEYS.installationId)!)).toMatchObject({ ok: true });
    expect(app.statements.trialBalance({})).toMatchObject({ balanced: true });
  }
  return { businessId, sales: saleCount(restarted.db, businessId), trialBalance: deviceBooks.trialBalance, cloudTrialBalance };
}
