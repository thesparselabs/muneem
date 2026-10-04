import { beforeAll, describe, expect, it } from 'vitest';
import { EXPENSE_RULE, PURCHASE_RULE, SALE_RULE, buildJournal, newUlid, type JournalLine } from '@muneem/domain';
import { postJournal, withTransaction, type Actor, type Db, type JournalInput } from '@muneem/db-sqlite';
import type { App } from '../../src/main/app.js';
import { ownerAtTill, testApp } from '../helpers.js';

const SALES = 120_000;
const PURCHASES = 5_000;
const EXPENSES = 2_000;
const BATCH = 5_000;
const FIRST_DAY = Date.UTC(2025, 9, 1);
const DAYS = 365;
const YEAR_END = '2026-09-30';

let app: App;
let db: Db;
let lineCount = 0;

const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]!;
const timed = (runs: number, f: () => unknown): number => median(Array.from({ length: runs }, () => { const t0 = performance.now(); f(); return performance.now() - t0; }));

function seeded(seed: number): (n: number) => number {
  let s = seed >>> 0;
  return (n) => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return (((t ^ (t >>> 14)) >>> 0) % n);
  };
}

const dateOf = (i: number, count: number): string => new Date(FIRST_DAY + Math.floor((i * DAYS) / count) * 86_400_000).toISOString().slice(0, 10);

function saleLines(rand: (n: number) => number, customers: string[]): JournalLine[] {
  const taxablePaise = 10_000 + rand(500_000);
  const half = Math.round(taxablePaise * 0.09);
  const total = taxablePaise + 2 * half + 50;
  const creditPaise = rand(2) === 0 ? Math.floor(total / 3) : 0;
  const clearingPaise = rand(2) === 0 ? Math.floor((total - creditPaise) / 2) : 0;
  return buildJournal(SALE_RULE, {
    cashPaise: total - creditPaise - clearingPaise, clearingPaise, creditPaise, customerId: customers[rand(customers.length)]!,
    taxablePaise, tax: { cgstPaise: half, sgstPaise: half, igstPaise: 0, cessPaise: 0 }, roundOffPaise: 50, cogsPaise: Math.floor(taxablePaise * 0.7),
  });
}

function purchaseLines(rand: (n: number) => number, suppliers: string[]): JournalLine[] {
  const inventoryPaise = 500_000 + rand(5_000_000);
  const half = Math.round(inventoryPaise * 0.09);
  return buildJournal(PURCHASE_RULE, {
    supplierId: suppliers[rand(suppliers.length)]!, inventoryPaise, itc: { cgstPaise: half, sgstPaise: half, igstPaise: 0, cessPaise: 0 },
    roundOffPaise: 0, totalPaise: inventoryPaise + 2 * half,
  });
}

function expenseLines(rand: (n: number) => number): JournalLine[] {
  const expensePaise = 10_000 + rand(2_000_000);
  return buildJournal(EXPENSE_RULE, {
    expenseAccount: { code: ['5400', '5410', '5420', '5430'][rand(4)]! }, method: rand(2) === 0 ? 'cash' : 'bank', supplierId: null, expensePaise,
    itc: { cgstPaise: 0, sgstPaise: 0, igstPaise: 0, cessPaise: 0 }, roundOffPaise: 0, totalPaise: expensePaise,
  });
}

function postInBatches(journals: Omit<JournalInput, 'businessId' | 'branchId' | 'terminalId'>[], base: Pick<JournalInput, 'businessId' | 'branchId' | 'terminalId'>, actor: Actor) {
  for (let start = 0; start < journals.length; start += BATCH) {
    withTransaction(db, () => {
      for (const j of journals.slice(start, start + BATCH)) lineCount += postJournal(db, { ...base, ...j }, actor)!.lines.length;
    });
  }
}

beforeAll(async () => {
  ({ app, db } = await testApp({ file: true }));
  const { businessId, branchId, terminalId } = await ownerAtTill(app);
  const actor = { userId: app.session.require().user.id, deviceId: app.device.localDeviceId(), terminalId };
  const rand = seeded(42);
  const customers = Array.from({ length: 500 }, () => newUlid());
  const suppliers = Array.from({ length: 50 }, () => newUlid());
  const journals = [
    ...Array.from({ length: SALES }, (_, i) => ({ source: 'sale' as const, refType: 'sale', refId: newUlid(), entryNo: `S-${i}`, docDate: dateOf(i, SALES), lines: saleLines(rand, customers) })),
    ...Array.from({ length: PURCHASES }, (_, i) => ({ source: 'purchase' as const, refType: 'purchase', refId: newUlid(), entryNo: `P-${i}`, docDate: dateOf(i, PURCHASES), lines: purchaseLines(rand, suppliers) })),
    ...Array.from({ length: EXPENSES }, (_, i) => ({ source: 'expense' as const, refType: 'expense', refId: newUlid(), entryNo: `E-${i}`, docDate: dateOf(i, EXPENSES), lines: expenseLines(rand) })),
  ].sort((a, b) => a.docDate.localeCompare(b.docDate));
  const t0 = performance.now();
  postInBatches(journals, { businessId, branchId, terminalId }, actor);
  console.info(`built ${journals.length} journals, ${lineCount} lines in ${((performance.now() - t0) / 1000).toFixed(1)} s`);
}, 900_000);

// The budgets are the medians below; the test timeouts only stop a busy CI machine from failing the whole run.
describe('statements and books at a year of journals (6f)', () => {
  it('holds about a million journal lines', () => {
    expect(lineCount).toBeGreaterThanOrEqual(900_000);
    expect(db.prepare('SELECT COUNT(*) FROM journal_line').pluck().get()).toBe(lineCount);
  });

  it('trial balance, P&L and balance sheet each under 1 s (median of 3)', () => {
    let balanced = false;
    const tb = timed(3, () => { balanced = app.statements.trialBalance({ asOf: YEAR_END }).balanced; });
    const plYear = timed(3, () => app.statements.profitAndLoss({ from: '2026-04-01', to: '2027-03-31' }));
    const plSpan = timed(3, () => app.statements.profitAndLoss({ from: '2025-10-01', to: YEAR_END }));
    const plMonth = timed(3, () => app.statements.profitAndLoss({ from: '2026-06-01', to: '2026-06-30' }));
    const plRagged = timed(3, () => app.statements.profitAndLoss({ from: '2026-04-10', to: '2026-09-20' }));
    let midBalanced = false;
    const tbMid = timed(3, () => { midBalanced = app.statements.trialBalance({ asOf: '2026-09-15' }).balanced; });
    let bsBalanced = false;
    const bs = timed(3, () => { bsBalanced = app.statements.balanceSheet({ asOf: YEAR_END }).balanced; });
    console.info(`TB ${tb.toFixed(0)} ms, TB mid-month ${tbMid.toFixed(0)} ms, P&L FY ${plYear.toFixed(0)} ms, P&L 12 months ${plSpan.toFixed(0)} ms, `
      + `P&L month ${plMonth.toFixed(0)} ms, P&L part months ${plRagged.toFixed(0)} ms, BS ${bs.toFixed(0)} ms`);
    expect(balanced && midBalanced && bsBalanced).toBe(true);
    for (const ms of [tb, tbMid, plYear, plSpan, plMonth, plRagged, bs]) expect(ms).toBeLessThan(1000);
  }, 120_000);

  it('ledger first page (100 lines) for busy and sparse accounts and day book first page (50 entries) each under 50 ms (median of 5)', () => {
    const codes = new Map(app.statements.accounts(YEAR_END).map((a) => [a.code, a.id]));
    const timings: [string, number][] = [];
    for (const code of ['1100', '4100', '5400']) {
      for (const from of [undefined, '2026-04-15']) {
        let page: ReturnType<App['statements']['ledger']> | undefined;
        timings.push([`ledger ${code}${from ? ` from ${from}` : ''}`, timed(5, () => { page = app.statements.ledger({ accountId: codes.get(code), from, to: YEAR_END, limit: 100 }); })]);
        expect(page!.items).toHaveLength(100);
        if (from) expect(page!.openingBalancePaise).not.toBe(0);
      }
    }
    for (const from of ['2025-10-01', '2026-04-01']) {
      let items = 0;
      timings.push([`day book from ${from}`, timed(5, () => { items = app.statements.dayBook({ from, to: YEAR_END, limit: 50 }).items.length; })]);
      expect(items).toBe(50);
    }
    console.info(timings.map(([name, ms]) => `${name} ${ms.toFixed(1)} ms`).join(', '));
    for (const [, ms] of timings) expect(ms).toBeLessThan(50);
  }, 120_000);
});
