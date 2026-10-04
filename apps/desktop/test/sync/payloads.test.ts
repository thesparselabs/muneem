import { describe, expect, it, vi } from 'vitest';
import { payloadSchema, STREAM_OF } from '@muneem/contracts';
import { runSoak } from '../soak/generator.js';

describe('outbox payloads are the sync wire (7a)', () => {
  it('every payload a seeded run records parses with its entity schema, and every entity type has a stream', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const run = await runSoak({ seed: 7, days: 40, salesPerDay: 10, endDate: '2026-04-05', file: false, setTime: (ms) => vi.setSystemTime(ms) });
    vi.useRealTimers();
    const rows = run.db.prepare('SELECT entity_type, operation_type, payload_json FROM sync_outbox ORDER BY seq').all() as
      { entity_type: string; operation_type: string; payload_json: string }[];
    const failures = new Map<string, string>();
    for (const r of rows) {
      const key = `${r.entity_type}:${r.operation_type}`;
      if (!(r.entity_type in STREAM_OF)) failures.set(key, 'no stream');
      const parsed = payloadSchema(r.entity_type, r.operation_type).safeParse(JSON.parse(r.payload_json));
      if (!parsed.success && !failures.has(key)) failures.set(key, parsed.error.issues.slice(0, 3).map((i) => `${i.path.join('.')}: ${i.message}`).join('; '));
    }
    expect(Object.fromEntries(failures)).toEqual({});
    expect(new Set(rows.map((r) => r.entity_type)).size).toBeGreaterThan(25);
  }, 120_000);
});
