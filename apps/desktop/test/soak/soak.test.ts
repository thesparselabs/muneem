import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { addDays } from '@muneem/domain';
import { balanceDrift, journalsNotMatchingLines, reconcilePartiesDb, replayCheck, tieOutFailures, unpostedDocuments } from '@muneem/db-sqlite';
import { runSoak, type SoakRun } from './generator.js';

const DAYS = Number(process.env.MUNEEM_SOAK_DAYS ?? 14);
const SALES_PER_DAY = Number(process.env.MUNEEM_SOAK_SALES_PER_DAY ?? (DAYS > 31 ? 270 : 60));
// The 14-day run crosses 31 March, so CI sees a month lock and a new financial year; a year's run crosses one 1 April.
const END_DATE = '2026-04-05';
const OWNER_EQUITY = new Set(['3100', '3200', '3400']);

let run: SoakRun;
const fyStartOf = (date: string) => `${Number(date.slice(5, 7)) >= 4 ? date.slice(0, 4) : Number(date.slice(0, 4)) - 1}-04-01`;

beforeAll(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  run = await runSoak({ seed: 20_260_405, days: DAYS, salesPerDay: SALES_PER_DAY, endDate: END_DATE, file: DAYS > 31, setTime: (ms) => vi.setSystemTime(ms) });
  const { db, businessId, counts, elapsedMs } = run;
  const count = (table: string) => db.prepare(`SELECT COUNT(*) FROM ${table} WHERE business_id = ?`).pluck().get(businessId);
  const lines = db.prepare('SELECT COUNT(*) FROM journal_line l JOIN journal_entry e ON e.id = l.entry_id WHERE e.business_id = ?').pluck().get(businessId);
  console.info(`soak: ${DAYS} days, ${counts.sales} sales, ${counts.purchases} purchases, ${counts.receipts + counts.supplierPayments} payments, `
    + `${count('journal_entry')} journals, ${lines} journal lines, ${run.app.periods.latePostings().length} late postings, ${(elapsedMs / 1000).toFixed(1)} s`);
}, 3_600_000);

afterAll(() => { vi.useRealTimers(); });

describe(`Stage 6 exit: the books on ${DAYS} days of seeded trading`, () => {
  it('exercised every kind of document the plan lists', () => {
    expect(run.monthEnds.length).toBeGreaterThan(0);
    expect(run.counts).toMatchObject({
      sales: DAYS * SALES_PER_DAY, purchases: expect.any(Number), periodsLocked: run.monthEnds.length, backdated: expect.any(Number),
    });
    for (const [kind, n] of Object.entries(run.counts)) expect.soft(n, kind).toBeGreaterThan(0);
  });

  it('the trial balance balances today and at every month end', () => {
    expect(run.app.statements.trialBalance({})).toMatchObject({ balanced: true });
    for (const asOf of run.monthEnds) expect(run.app.statements.trialBalance({ asOf }), asOf).toMatchObject({ balanced: true });
  });

  it("the balance sheet balances, and each year's P&L is the balance sheet's profit for the year", () => {
    expect(run.app.statements.balanceSheet({})).toMatchObject({ balanced: true });
    for (let fy = fyStartOf(run.startDate); fy <= run.endDate; fy = `${Number(fy.slice(0, 4)) + 1}-04-01`) {
      const to = [addDays(`${Number(fy.slice(0, 4)) + 1}-04-01`, -1), run.endDate].sort()[0]!;
      const bs = run.app.statements.balanceSheet({ asOf: to });
      expect(bs, to).toMatchObject({ balanced: true });
      expect(run.app.statements.profitAndLoss({ from: fy, to }).netProfitPaise, to).toBe(bs.currentProfitPaise);
    }
  });

  it("P&L over the whole run equals the change in equity apart from the owner's own money", () => {
    const rows = run.app.statements.trialBalance({}).rows;
    const net = (r: (typeof rows)[number]) => r.debitPaise - r.creditPaise;
    const netAssets = rows.filter((r) => r.type === 'asset' || r.type === 'liability').reduce((s, r) => s + net(r), 0);
    const ownersMoney = rows.filter((r) => OWNER_EQUITY.has(r.code)).reduce((s, r) => s - net(r), 0);
    // Net profit = (assets − liabilities) − (capital + opening balance equity − drawings), from an empty book.
    expect(run.app.statements.profitAndLoss({ from: run.startDate, to: run.endDate }).netProfitPaise).toBe(netAssets - ownersMoney);
  });

  it('tie-outs, party ledgers, stock replay and the journal checks all hold', () => {
    const { db, businessId } = run;
    expect(tieOutFailures(db, businessId)).toEqual([]);
    expect(reconcilePartiesDb(db, businessId)).toEqual({ mismatches: [], faults: [] });
    expect(replayCheck(db, businessId)).toEqual([]);
    expect(unpostedDocuments(db, businessId)).toEqual([]);
    expect(journalsNotMatchingLines(db, businessId)).toBe(0);
    expect(balanceDrift(db, businessId)).toBe(0);
  }, DAYS > 31 ? 120_000 : undefined);

  it('documents dated into locked months posted late', () => {
    expect(run.app.periods.latePostings().length).toBeGreaterThan(0);
  });
});
