import { mkdirSync, writeFileSync } from 'node:fs';
import { describe, it, vi } from 'vitest';
import { runSoak } from '../soak/generator.js';

// Records a soak's outbox (audit rows aside) with the device's daily tables and party balances, for the Go round trip (cloud reports_test.go):
// MUNEEM_REPORTS_FIXTURE_OUT=../../packages/contracts/fixtures/reports vitest run test/sync/dumpDailyAggregates.test.ts
const OUT = process.env.MUNEEM_REPORTS_FIXTURE_OUT;
const run = OUT ? it : it.skip;

describe('daily aggregates fixture (8e)', () => {
  run('a short soak, as pushed, with what the device computed', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const soak = await runSoak({ seed: 805, days: 5, salesPerDay: 8, endDate: '2026-04-02', file: false, setTime: (ms) => vi.setSystemTime(ms) });
    vi.useRealTimers();
    const { db, businessId } = soak;
    const all = (sql: string) => db.prepare(sql).all(businessId);
    const operations = (db.prepare("SELECT * FROM sync_outbox WHERE business_id = ? AND entity_type <> 'audit_entry' ORDER BY seq").all(businessId) as Record<string, unknown>[]).map((r) => ({
      operationId: r.operation_id, seq: r.seq, entityType: r.entity_type, entityId: r.entity_id, operationType: r.operation_type,
      dependsOn: r.depends_on_operation_id ?? null, payloadHash: r.payload_hash, payload: JSON.parse(r.payload_json as string) as unknown,
    }));
    const expected = {
      sales: all('SELECT * FROM daily_sales_summary WHERE business_id = ? ORDER BY day, branch_id'),
      payments: all('SELECT * FROM daily_payment_summary WHERE business_id = ? ORDER BY day, branch_id, flow, method'),
      products: all('SELECT * FROM product_sales_daily WHERE business_id = ? ORDER BY day, product_id, branch_id'),
      parties: all(`SELECT party_type, party_id, SUM(amount_paise) AS balance_paise FROM party_ledger_entry WHERE business_id = ?
        GROUP BY party_type, party_id HAVING SUM(amount_paise) <> 0 ORDER BY party_type, party_id`),
    };
    mkdirSync(OUT!, { recursive: true });
    writeFileSync(`${OUT!}/daily-roundtrip.json`, `${JSON.stringify({ businessId, from: soak.startDate, to: soak.endDate, operations, expected })}\n`);
  }, 600_000);
});
