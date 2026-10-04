import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { fyBounds, newUlid } from '@muneem/domain';
import { applyChanges, balanceDrift, fyBalances, journalsNotMatchingLines, reconcilePartiesDb, replayCheck, tieOutFailures, unpostedDocuments } from '@muneem/db-sqlite';
import type { Change } from '@muneem/contracts';
import { runSoak, type SoakRun } from './generator.js';

// About fourteen months crossing 1 April twice: the first year (only its last weeks traded) and the second are closed.
const DAYS = Number(process.env.MUNEEM_YEAR_END_SOAK_DAYS ?? 420);
const END_DATE = '2026-04-20';
const YEARS = ['2024-25', '2025-26'];

let run: SoakRun;
const year = (fy: string) => run.app.yearEnd.list().find((y) => y.fy === fy)!;
const plOf = (fy: string) => { const { start, end } = fyBounds(fy); return run.app.statements.profitAndLoss({ from: start, to: end }); };
const retained = () => { const r = run.app.statements.trialBalance({}).rows.find((x) => x.code === '3300'); return r ? r.creditPaise - r.debitPaise : 0; };

beforeAll(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  run = await runSoak({ seed: 20_260_331, days: DAYS, salesPerDay: 3, endDate: END_DATE, file: false, setTime: (ms) => vi.setSystemTime(ms), yearEnd: true });
  console.info(`year-end soak: ${DAYS} days from ${run.startDate}, ${run.counts.sales} sales, ${run.yearEnd.setoffs} set-offs, closed ${run.yearEnd.closed.map((c) => c.fy).join(', ')}, `
    + `${run.app.periods.latePostings().length} late postings, ${(run.elapsedMs / 1000).toFixed(1)} s`);
}, 600_000);

afterAll(() => { vi.useRealTimers(); });

describe(`8d exit: ${DAYS} days of trading with two year-ends`, () => {
  it('set off GST every month and closed both years on the first of April', () => {
    expect(run.yearEnd.closed.map((c) => c.fy)).toEqual(YEARS);
    for (const fy of YEARS) {
      expect(year(fy)).toMatchObject({ status: 'closed', needsReclose: false, closings: [{ entryNo: `CL/${fy.slice(2, 4)}${fy.slice(5, 7)}`, entryDate: fyBounds(fy).end }] });
      expect(fyBalances(run.db, run.businessId, fy)).toEqual([]);
    }
    expect(year('2026-27')).toMatchObject({ status: 'open', ended: false });
  });

  it("each closed year's P&L and year-end Balance Sheet read as they did before it was closed", () => {
    for (const c of run.yearEnd.closed) {
      const { start, end } = fyBounds(c.fy);
      expect(run.app.statements.profitAndLoss({ from: start, to: end }), c.fy).toEqual(c.profitAndLoss);
      expect(run.app.statements.balanceSheet({ asOf: end }), c.fy).toEqual(c.balanceSheet);
    }
  });

  it('retained earnings are the closed years in 3300, and the Balance Sheet balances', () => {
    const closedProfit = YEARS.reduce((s, fy) => s + plOf(fy).netProfitPaise, 0);
    expect(retained()).toBe(closedProfit);
    const bs = run.app.statements.balanceSheet({});
    expect(bs).toMatchObject({ balanced: true, retainedEarningsPaise: closedProfit, currentProfitPaise: plOf('2026-27').netProfitPaise });
    expect(run.app.statements.trialBalance({})).toMatchObject({ balanced: true });
    for (const asOf of run.monthEnds) expect(run.app.statements.balanceSheet({ asOf }), asOf).toMatchObject({ balanced: true });
  });

  it('the books still tie out', () => {
    const { db, businessId } = run;
    expect(tieOutFailures(db, businessId)).toEqual([]);
    expect(reconcilePartiesDb(db, businessId)).toEqual({ mismatches: [], faults: [] });
    expect(replayCheck(db, businessId)).toEqual([]);
    expect(unpostedDocuments(db, businessId)).toEqual([]);
    expect(journalsNotMatchingLines(db, businessId)).toBe(0);
    expect(balanceDrift(db, businessId)).toBe(0);
  }, 120_000);

  it('a journal synced into the closed year re-closes it, and the closed year, 3300 and the Balance Sheet stay consistent', () => {
    const fy = '2025-26';
    const before = plOf(fy).netProfitPaise;
    const id = newUlid();
    const payload = {
      id, entryNo: 'T9J/2526/00001', entryDate: '2026-02-14', periodId: newUlid(), source: 'manual', refType: 'manual', refId: id, docDate: '2026-02-14',
      narration: 'rent entered on another till', branchId: null, terminalId: null, latePosting: false, reversalOf: null,
      lines: [{ account: { code: '5400' }, debitPaise: 12_345, creditPaise: 0 }, { account: { role: 'bank' }, debitPaise: 0, creditPaise: 12_345 }],
    };
    const change: Change = { seq: 1, stream: 'documents', entityType: 'journal_entry', entityId: id, op: 'upsert', version: 1, originDeviceId: 'another-till', payload };
    run.db.transaction(() => applyChanges(run.db, { businessId: run.businessId, cloudDeviceId: 'this-till' }, [change]))();
    expect(year(fy)).toMatchObject({ needsReclose: true, residuePaise: -12_345, profitPaise: before - 12_345 });
    expect(run.app.statements.balanceSheet({})).toMatchObject({ balanced: true });

    run.app.yearEnd.reclose(fy);
    expect(year(fy)).toMatchObject({ needsReclose: false, closings: [{ version: 1 }, { version: 2, entryNo: 'CL/2526/2', profitPaise: -12_345 }] });
    expect(fyBalances(run.db, run.businessId, fy)).toEqual([]);
    expect(retained()).toBe(plOf('2024-25').netProfitPaise + before - 12_345);
    expect(run.app.statements.balanceSheet({})).toMatchObject({ balanced: true, retainedEarningsPaise: retained() });
    expect(tieOutFailures(run.db, run.businessId)).toEqual([]);
    expect(balanceDrift(run.db, run.businessId)).toBe(0);
  });
});
