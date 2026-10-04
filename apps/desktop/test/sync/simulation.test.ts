import { afterEach, describe, expect, it, vi } from 'vitest';
import { referenceHarness, type ReferenceHarness } from './cloudHarness.js';
import { expectConverged, simulate } from './simulation.js';

const SEEDS = Number(process.env.MUNEEM_SIM_SEEDS ?? 20);
const START = Date.parse('2026-10-05T04:00:00.000Z');

const conflictOutcomes = (cloud: ReferenceHarness, businessId: string) =>
  cloud.server.conflicts(businessId).map((c) => `${c.kind}:${c.entityType}:${c.field ?? ''}:${c.rule}:${c.winner}`);

describe('sync simulation (7h, ADR-0042)', () => {
  afterEach(() => { vi.useRealTimers(); });

  it(`${SEEDS} seeds: no loss, no duplicates, every device converges on the same books`, async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    let cancelled = 0;
    for (let seed = 1; seed <= SEEDS; seed++) {
      const cloud = referenceHarness(seed, START);
      const run = await simulate(seed, cloud);
      await expectConverged(seed, cloud, run);
      cancelled += run.devices[0]!.db.prepare("SELECT COUNT(*) FROM payment WHERE business_id = ? AND status = 'cancelled'").pluck().get(run.businessId) as number;
    }
    expect(cancelled, 'the workload cancelled receipts, so later document versions were synced').toBeGreaterThan(0);
  }, 900_000);

  it('the same seed gives the same conflict outcomes', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const first = referenceHarness(4242, START);
    const firstRun = await simulate(4242, first);
    const second = referenceHarness(4242, START);
    const secondRun = await simulate(4242, second);
    expect(conflictOutcomes(second, secondRun.businessId)).toEqual(conflictOutcomes(first, firstRun.businessId));
    expect(conflictOutcomes(first, firstRun.businessId).length).toBeGreaterThan(0);
  }, 300_000);
});
