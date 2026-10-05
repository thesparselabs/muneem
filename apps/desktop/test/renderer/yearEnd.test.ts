import { describe, expect, it } from 'vitest';
import type { FinancialYear } from '@muneem/contracts';
import { canClose, checklist, monthShort, statusLabel } from '../../src/renderer/src/lib/accounting/yearEnd.js';

const months = (locked: number): FinancialYear['months'] =>
  Array.from({ length: 12 }, (_, i) => ({ month: `${i < 9 ? 2025 : 2026}-${String(((i + 3) % 12) + 1).padStart(2, '0')}-01`, status: i < locked ? 'locked' as const : 'open' as const }));
const year = (over: Partial<FinancialYear> = {}): FinancialYear => ({
  fy: '2025-26', start: '2025-04-01', end: '2026-03-31', ended: true, status: 'open', months: months(12),
  gst: { required: true, lastActiveMonth: '2026-03-01', settledThrough: '2026-03-01' }, blockers: [], profitPaise: 50_000, residuePaise: 0, needsReclose: false,
  closeId: null, closedAt: null, closedBy: null, closings: [], pending: false, syncError: null, ...over,
});

describe('Year end screen', () => {
  it('ticks the checklist in the order a shop works through it', () => {
    expect(checklist(year())).toEqual([
      { label: 'The year has ended', done: true }, { label: 'GST set off through Mar 2026', done: true, detail: 'last set-off: Mar 2026' }, { label: 'Every month locked', done: true },
    ]);
    const behind = checklist(year({ months: months(10), gst: { required: true, lastActiveMonth: '2026-03-01', settledThrough: '2026-01-01' } }));
    expect(behind.map((c) => c.done)).toEqual([true, false, false]);
    expect(behind[2]!.detail).toBe('2 open: Feb 2026, Mar 2026');
    expect(checklist(year({ gst: { required: false, lastActiveMonth: null, settledThrough: null } })).map((c) => c.label)).toEqual(['The year has ended', 'Every month locked']);
  });

  it('offers the close only when nothing stands in the way, and says where a close stands', () => {
    expect(canClose(year())).toBe(true);
    expect(canClose(year({ blockers: ['Lock every month first'] }))).toBe(false);
    expect(canClose(year({ status: 'closed' }))).toBe(false);
    expect(statusLabel(year({ status: 'requested' }))).toMatch(/waiting for the cloud/);
    expect(statusLabel(year({ status: 'closed', needsReclose: true }))).toMatch(/need closing/);
    expect(monthShort('2025-04-01')).toBe('Apr 2025');
  });
});
