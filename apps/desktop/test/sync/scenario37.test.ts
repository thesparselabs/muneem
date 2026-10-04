import { afterEach, describe, it, vi } from 'vitest';
import { referenceHarness } from './cloudHarness.js';
import { scenario37 } from './scenario37.js';

const START = Date.parse('2026-10-05T04:30:00.000Z');

describe('the §37 offline scenario (7h)', () => {
  afterEach(() => { vi.useRealTimers(); });

  it('online sale, 100 offline sales, stock change, restart, clock jump, double submit, a kill mid-sync and two terminals on the last unit', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    await scenario37(referenceHarness(37, START));
  }, 300_000);
});
