import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { newUlid } from '@muneem/domain';
import { canonicalJson, listBackupLog, restoreDatabaseFile } from '@muneem/db-sqlite';
import { CompleteSaleInput, CustomerInput, PaymentInput, ProductInput, SaleDraft } from '@muneem/contracts';
import { E2E_CLOUD, goHarness } from './goCloud.js';
import { scenario37, sell } from './scenario37.js';
import { expectConverged, simulate, type SimulationShape } from './simulation.js';
import { books, healthy, hydrate, syncUntilQuiet } from './syncHelpers.js';
import { caller } from '../helpers.js';

const SEEDS = Number(process.env.MUNEEM_E2E_SIM_SEEDS ?? 3);
const SHAPE: SimulationShape = { rounds: 4, actionsPerRound: 6 };

// ADR-0042: §37 and a smaller simulation against the real Go API, Postgres and MinIO (scripts/e2e-cloud.sh sets MUNEEM_E2E_CLOUD).
describe.skipIf(!E2E_CLOUD)('sync end to end against the Go cloud (7h)', () => {
  afterEach(() => { vi.useRealTimers(); });

  it('§37: offline sales, restart, clock jump, double submit, a kill mid-sync and the last unit; cloud TB = device TB', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const r = await scenario37(await goHarness(E2E_CLOUD, 37));
    console.info(`§37 on Go: ${r.sales} sales; cloud TB ${JSON.stringify(r.cloudTrialBalance)} = device TB`);
  }, 600_000);

  it(`${SEEDS} seeds through a faulty network: no loss, no duplicates, cloud and devices converge`, async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    for (let seed = 1; seed <= SEEDS; seed++) {
      const cloud = await goHarness(E2E_CLOUD, seed);
      const r = await expectConverged(seed, cloud, await simulate(seed, cloud, SHAPE), SHAPE);
      console.info(`simulation seed ${seed} on Go: ${r.sales} sales, ${cloud.net.injected()} faults, ${r.trialBalance.length} TB accounts agree`);
    }
  }, 900_000);

  it('a device clock 10 minutes out is refused without losing anything, and syncs once set right', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const cloud = await goHarness(E2E_CLOUD, 7);
    const { app, db } = await cloud.device('A');
    const { businessId } = await cloud.ownerAtTill(app);
    const pcs = app.catalog.listUoms().find((u) => u.code === 'PCS')!.id;
    const tea = app.products.create(ProductInput.parse({ name: 'Tea', baseUomId: pcs, gstRateBp: 500, sellingPricePaise: 12_000, priceIsInclusive: true })).id;
    app.inventory.setOpeningStock({ lines: [{ productId: tea, qtyMilli: 10_000, unitCostPaise: 8000 }] });
    await app.register.open(10_000);
    await syncUntilQuiet(app);

    cloud.clock.jump(10 * 60_000);
    sell(app, tea, pcs);
    const refused = await app.syncEngine.run({ pull: true });
    expect(refused.push).toMatchObject({ sent: 0, error: 'DEVICE_CLOCK_SKEW' });
    expect(db.prepare("SELECT COUNT(*) FROM sync_outbox WHERE status = 'pending' AND attempt_count = 0").pluck().get()).toBeGreaterThan(0);
    expect(await cloud.cloudSales(businessId)).toBe(0);

    cloud.clock.reconnect();
    await syncUntilQuiet(app);
    expect(await cloud.cloudSales(businessId)).toBe(1);
    expect(db.prepare("SELECT COUNT(*) FROM sync_outbox WHERE status NOT IN ('sent', 'superseded')").pluck().get()).toBe(0);
  }, 120_000);

  it('a new device hydrates from the Go bundle in object storage to the same books and the byte-identical Trial Balance (= the cloud\'s), then bills and syncs back', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const cloud = await goHarness(E2E_CLOUD, 11);
    const a = await cloud.device('A');
    const { businessId } = await cloud.ownerAtTill(a.app);
    const pcs = a.app.catalog.listUoms().find((u) => u.code === 'PCS')!.id;
    const tea = a.app.products.create(ProductInput.parse({ name: 'Tea', baseUomId: pcs, gstRateBp: 500, sellingPricePaise: 12_000, priceIsInclusive: true })).id;
    a.app.inventory.setOpeningStock({ lines: [{ productId: tea, qtyMilli: 50_000, unitCostPaise: 8000 }] });
    await a.app.register.open(10_000);
    for (let i = 0; i < 5; i++) { cloud.clock.tick(); sell(a.app, tea, pcs); }
    const ravi = a.app.customers.create(CustomerInput.parse({ name: 'Ravi', creditDays: 15 }));
    a.app.customers.setCreditLimit({ id: ravi.id, version: ravi.version, limitPaise: 1_000_000 });
    const draft = SaleDraft.parse({ lines: [{ productId: tea, uomId: pcs, qtyMilli: 2000 }], customerId: ravi.id });
    const total = a.app.sales.quote(draft).totals.totalPaise;
    a.app.sales.complete(CompleteSaleInput.parse({ ...draft, commandId: newUlid(), expectedTotalPaise: total, tenders: [{ method: 'credit', amountPaise: total }] }));
    const paid = a.app.payments.create(PaymentInput.parse({ partyType: 'customer', partyId: ravi.id, amountPaise: 5000, method: 'cash', commandId: newUlid() }));
    a.app.payments.cancel(paid.id, 'bounced');
    await syncUntilQuiet(a.app);

    const b = await cloud.device('B');
    await cloud.login(b.app);
    await hydrate(b.app, businessId);
    expect(books(b.db, businessId)).toEqual(books(a.db, businessId));
    expect(canonicalJson(b.app.statements.trialBalance({}))).toBe(canonicalJson(a.app.statements.trialBalance({})));
    expect(await cloud.trialBalance(businessId)).toEqual(books(a.db, businessId).trialBalance);
    expect(healthy(b.db, businessId)).toEqual({ tieOuts: [], replay: [], partyMismatches: [], allocationFaults: [] });

    const branchId = b.app.business.getBranches()[0]!.id;
    b.app.business.selectTerminal(b.app.business.createTerminal({ branchId, code: 'T02', name: 'Till 2' }).id);
    await b.app.register.open(10_000);
    cloud.clock.tick();
    sell(b.app, tea, pcs);
    await syncUntilQuiet(b.app);
    await syncUntilQuiet(a.app);
    expect(books(a.db, businessId)).toEqual(books(b.db, businessId));
    expect(await cloud.cloudSales(businessId)).toBe(7);
  }, 300_000);

  it('8f: A backs up to MinIO with its key escrowed in Go; a fresh device restores that backup, pulls, and its books equal A\'s', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const cloud = await goHarness(E2E_CLOUD, 13);
    const a = await cloud.device('A', { file: true });
    const { businessId } = await cloud.ownerAtTill(a.app);
    const pcs = a.app.catalog.listUoms().find((u) => u.code === 'PCS')!.id;
    const tea = a.app.products.create(ProductInput.parse({ name: 'Tea', baseUomId: pcs, gstRateBp: 500, sellingPricePaise: 12_000, priceIsInclusive: true })).id;
    a.app.inventory.setOpeningStock({ lines: [{ productId: tea, qtyMilli: 50_000, unitCostPaise: 8000 }] });
    await a.app.register.open(10_000);
    for (let i = 0; i < 4; i++) { cloud.clock.tick(); sell(a.app, tea, pcs); }
    await syncUntilQuiet(a.app);
    await caller(a.app).data('backups.runNow');
    await a.app.backups.uploader.uploadPending();
    expect(listBackupLog(a.db)[0]).toMatchObject({ cloudStatus: 'uploaded', cloudError: null });
    cloud.clock.tick();
    sell(a.app, tea, pcs);
    await syncUntilQuiet(a.app);

    const installed: string[] = [];
    const c = await cloud.device('C', { file: true, restoreHost: { install: (f) => { installed.push(f); } } });
    await cloud.login(c.app);
    expect(await caller(c.app).data('backups.restoreFromCloud', { businessId, confirm: true })).toEqual({ restarting: true, safetyBackupId: null });
    const file = join(c.dir, 'muneem.sqlite');
    c.app.closeReadConnections();
    c.db.close();
    restoreDatabaseFile(installed[0]!, file);
    rmSync(installed[0]!, { force: true });
    const restored = await cloud.device('C', { dbFile: file });
    await cloud.login(restored.app);
    await syncUntilQuiet(restored.app);
    expect(books(restored.db, businessId)).toEqual(books(a.db, businessId));
    expect(canonicalJson(restored.app.statements.trialBalance({}))).toBe(canonicalJson(a.app.statements.trialBalance({})));
    expect(await cloud.trialBalance(businessId)).toEqual(books(a.db, businessId).trialBalance);
    expect(healthy(restored.db, businessId)).toEqual({ tieOuts: [], replay: [], partyMismatches: [], allocationFaults: [] });
    expect(await cloud.cloudSales(businessId)).toBe(5);
  }, 300_000);
});
