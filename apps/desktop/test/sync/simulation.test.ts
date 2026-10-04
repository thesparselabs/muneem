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
    for (let seed = 1; seed <= SEEDS; seed++) {
      const cloud = referenceHarness(seed, START);
      await expectConverged(seed, cloud, await simulate(seed, cloud));
    }
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
