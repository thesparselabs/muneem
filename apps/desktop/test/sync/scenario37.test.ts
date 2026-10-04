import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { newUlid } from '@muneem/domain';
import { CompleteSaleInput, ProductInput, SaleDraft } from '@muneem/contracts';
import { getMeta, META_KEYS, verifyAuditChain, type Db } from '@muneem/db-sqlite';
import { FaultInjector } from '@muneem/sync-reference';
import type { App } from '../../src/main/app.js';
import { caller, ownerAtTill } from '../helpers.js';
import { books, DEVICE_A, DEVICE_B, healthy, ownerMembership, referenceCloud, syncedDevice, syncUntilQuiet } from './syncHelpers.js';

const START = Date.parse('2026-10-05T04:30:00.000Z');
const login = (app: App) => caller(app).data('auth.login', { identifier: '9999999999', password: 'correct-horse' });

function sell(app: App, productId: string, uomId: string, qtyMilli = 1000, commandId = newUlid()) {
  const draft = SaleDraft.parse({ lines: [{ productId, uomId, qtyMilli }] });
  const total = app.sales.quote(draft).totals.totalPaise;
  return app.sales.complete(CompleteSaleInput.parse({ ...draft, commandId, expectedTotalPaise: total, tenders: [{ method: 'cash', amountPaise: total }] }));
}

const saleCount = (db: Db, businessId: string) => db.prepare("SELECT COUNT(*) FROM sale WHERE business_id = ? AND status = 'posted'").pluck().get(businessId) as number;

// PRD §37 with the review's additions (§6): nothing lost, duplicated or silently overwritten; stock, books, payments and the audit trail right.
describe('the §37 offline scenario (7h)', () => {
  afterEach(() => { vi.useRealTimers(); });

  it('online sale, 100 offline sales, stock change, restart, clock jump, double submit, a kill mid-sync and two terminals on the last unit', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    let now = START;
    const tick = (ms = 2000) => { now += ms; vi.setSystemTime(now); };
    vi.setSystemTime(now);
    const cloud = referenceCloud();
    const net = new FaultInjector(cloud, { seed: 37 }, () => Promise.resolve());

    // Internet on: one sale reaches the cloud.
    const first = await syncedDevice(net, DEVICE_A, () => [], { file: true });
    const { businessId } = await ownerAtTill(first.app);
    await caller(first.app).data('printer.setConfig', { kind: 'none' });
    const pcs = first.app.catalog.listUoms().find((u) => u.code === 'PCS')!.id;
    const tea = first.app.products.create(ProductInput.parse({ name: 'Tea 250g', baseUomId: pcs, gstRateBp: 500, sellingPricePaise: 12_000, priceIsInclusive: true })).id;
    const last = first.app.products.create(ProductInput.parse({ name: 'Last Kettle', baseUomId: pcs, gstRateBp: 1800, sellingPricePaise: 150_000, priceIsInclusive: true })).id;
    first.app.inventory.setOpeningStock({ lines: [{ productId: tea, qtyMilli: 500_000, unitCostPaise: 8000 }, { productId: last, qtyMilli: 1000, unitCostPaise: 100_000 }] });
    await first.app.register.open(100_000);
    sell(first.app, tea, pcs);
    await syncUntilQuiet(first.app);

    // Terminal B joins while online and pulls everything, then the internet goes off for both.
    const b = await syncedDevice(net, DEVICE_B, () => [ownerMembership(businessId)]);
    await login(b.app);
    await syncUntilQuiet(b.app);
    b.app.business.selectTerminal(b.app.business.createTerminal({ branchId: b.app.business.getBranches()[0]!.id, code: 'T02', name: 'Till 2' }).id);
    await b.app.register.open(100_000);
    await syncUntilQuiet(b.app);
    net.partition(true);
    first.server.online = false;

    // Offline: 100 sales on A, a double-submitted sale, a stock change and both terminals selling the last kettle.
    for (let i = 0; i < 100; i++) { tick(); sell(first.app, tea, pcs, (1 + (i % 3)) * 1000); }
    const repeated = newUlid();
    tick();
    const once = sell(first.app, tea, pcs, 1000, repeated);
    expect(sell(first.app, tea, pcs, 1000, repeated).saleId).toBe(once.saleId);
    first.app.inventory.adjust({ lines: [{ productId: tea, qtyMilli: -2000, reason: 'damage' }] });
    sell(first.app, last, pcs);
    sell(b.app, last, pcs);
    expect(await first.app.syncEngine.run({ pull: true })).toMatchObject({ ran: true });

    // Restart A on the same database; the clock jumps back an hour, and more sales follow.
    const dbFile = join(first.dir, 'muneem.sqlite');
    first.db.close();
    const a = await syncedDevice(net, DEVICE_A, () => [], { dbFile, server: first.server });
    await login(a.app);
    now -= 3_600_000;
    vi.setSystemTime(now);
    for (let i = 0; i < 10; i++) { tick(); sell(a.app, tea, pcs); }

    // Internet back; the first push is answered but the answer is lost, and A is killed before it hears.
    net.partition(false);
    a.server.online = true;
    net.configure({ dropResponse: 1 });
    await a.app.syncEngine.run({ pull: false });
    net.configure({ dropResponse: 0 });
    a.db.prepare("UPDATE sync_outbox SET status = 'in_flight', last_attempt_at = ? WHERE status <> 'sent'").run(new Date(now - 10 * 60_000).toISOString());
    a.db.close();
    const restarted = await syncedDevice(net, DEVICE_A, () => [], { dbFile, server: a.server });
    await login(restarted.app);
    expect(restarted.app.syncEngine.recover()).toBeGreaterThan(0);
    restarted.app.syncEngine.retryNow();
    await syncUntilQuiet(restarted.app);
    b.app.syncEngine.retryNow();
    await syncUntilQuiet(b.app);
    await syncUntilQuiet(restarted.app);

    // Nothing lost or duplicated: 1 + 100 + 1 + 1 + 10 sales on A and 1 on B, each held once by the cloud and by both terminals.
    const onA = saleCount(restarted.db, businessId);
    expect(onA).toBe(114);
    expect(saleCount(b.db, businessId)).toBe(114);
    expect([...cloud.business(businessId)!.entities.values()].filter((e) => e.entityType === 'sale')).toHaveLength(114);
    expect(cloud.deadLetters(businessId)).toEqual([]);
    expect(restarted.db.prepare("SELECT COUNT(*) FROM sync_outbox WHERE status NOT IN ('sent', 'superseded')").pluck().get()).toBe(0);

    // Stock, books, payments and the audit trail agree and hold.
    expect(books(b.db, businessId)).toEqual(books(restarted.db, businessId));
    for (const db of [restarted.db, b.db]) expect(healthy(db, businessId)).toEqual({ tieOuts: [], replay: [], partyMismatches: [], allocationFaults: [] });
    const kettle = (db: Db) => db.prepare('SELECT SUM(qty_milli) FROM stock_level WHERE business_id = ? AND product_id = ?').pluck().get(businessId, last);
    expect([kettle(restarted.db), kettle(b.db)]).toEqual([-1000, -1000]);
    for (const [db, app] of [[restarted.db, restarted.app], [b.db, b.app]] as const) {
      expect(verifyAuditChain(db, businessId, getMeta(db, META_KEYS.installationId)!)).toMatchObject({ ok: true });
      expect(app.statements.trialBalance({})).toMatchObject({ balanced: true });
    }
  }, 300_000);
});
