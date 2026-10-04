import { describe, expect, it } from 'vitest';
import { backupsToPrune, type Retainable } from '../../src/main/backups/retention.js';

const DAY = 86_400_000;
const START = Date.parse('2026-06-01T00:00:00Z');

// Four backups a day (every 6 hours) for `days` days, ids in time order.
function history(days: number): Retainable[] {
  const out: Retainable[] = [];
  for (let d = 0; d < days; d++) {
    for (let h = 0; h < 4; h++) out.push({ id: `b${String(d * 4 + h).padStart(4, '0')}`, kind: 'scheduled', createdAt: new Date(START + d * DAY + h * 6 * 3600_000 + 3600_000).toISOString() });
  }
  return out;
}

// Prunes after every backup, as the service does, and returns what is left.
function simulate(all: Retainable[]): Retainable[] {
  let kept: Retainable[] = [];
  for (const b of all) {
    kept.push(b);
    const gone = new Set(backupsToPrune(kept));
    kept = kept.filter((k) => !gone.has(k.id));
  }
  return kept;
}

describe('backup retention: 7 daily, 4 weekly, 3 monthly (8f)', () => {
  it('after 120 days of 6-hourly backups keeps the newest per day for 7 days, per week for 4 weeks and per month for 3 months', () => {
    const kept = simulate(history(120));
    const days = kept.map((b) => b.createdAt.slice(0, 10));
    expect(new Set(days).size).toBe(days.length);
    expect(kept.length).toBeLessThanOrEqual(7 + 4 + 3);
    const newest = kept.map((b) => b.createdAt).sort().reverse();
    expect(newest[0]).toBe('2026-09-28T19:00:00.000Z');
    const last7 = Array.from({ length: 7 }, (_, i) => new Date(START + (119 - i) * DAY).toISOString().slice(0, 10));
    for (const d of last7) expect(days).toContain(d);
    const months = new Set(days.map((d) => d.slice(0, 7)));
    expect([...months].sort()).toEqual(['2026-07', '2026-08', '2026-09']);
    expect(days.some((d) => d < '2026-07-01')).toBe(false);
  });

  it('keeps the newest of each day, not the first', () => {
    const kept = simulate(history(10));
    expect(kept.every((b) => b.createdAt.endsWith('T19:00:00.000Z'))).toBe(true);
  });

  it('keeps the last three safety copies apart from the routine rule', () => {
    const routine = history(2);
    const safety = [0, 1, 2, 3, 4].map((i) => ({ id: `s${i}`, kind: i % 2 ? 'pre_restore' : 'pre_migration', createdAt: new Date(START - (10 - i) * DAY).toISOString() }));
    const gone = backupsToPrune([...routine, ...safety]);
    expect(gone).toEqual(expect.arrayContaining(['s0', 's1']));
    expect(gone).not.toEqual(expect.arrayContaining(['s2']));
    expect(gone.filter((id) => id.startsWith('s'))).toHaveLength(2);
  });

  it('never prunes a lone backup', () => {
    expect(backupsToPrune([{ id: 'x', kind: 'manual', createdAt: '2020-01-01T00:00:00.000Z' }])).toEqual([]);
  });
});
