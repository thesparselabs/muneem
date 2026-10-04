import { afterEach, describe, expect, it, vi } from 'vitest';
import { ProductInput } from '@muneem/contracts';
import { E2E_CLOUD, goHarness } from './goCloud.js';
import { scenario37, sell } from './scenario37.js';
import { expectConverged, simulate, type SimulationShape } from './simulation.js';
import { syncUntilQuiet } from './syncHelpers.js';

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
});
