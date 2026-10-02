import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkSalesConsistency } from './checkSales.js';
import { killDuringSales } from './killLoop.js';

// About a second per kill; `pnpm crash-loop --scenario sales 200` runs the long version by hand.
const KILLS = Number(process.env.MUNEEM_CRASH_KILLS ?? 20);

describe('kill -9 during billing (Stage 3 exit criterion)', () => {
  it(`${KILLS} SIGKILLs mid-sale leave no partial sale, orphan row or consumed number`, async () => {
    const file = join(mkdtempSync(join(tmpdir(), 'muneem-crash-sales-')), 'muneem.sqlite');
    await killDuringSales(file, KILLS);
    const report = checkSalesConsistency(file);
    console.info(JSON.stringify(report));
    expect(report.failures).toEqual([]);
    expect(report.ok).toBe(true);
  }, 600_000);
});
