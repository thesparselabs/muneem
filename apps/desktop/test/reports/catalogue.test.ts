import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import ExcelJS from 'exceljs';
import type { ReportResult } from '@muneem/contracts';
import { runSoak, type SoakRun } from '../soak/generator.js';

let run: SoakRun;
const saved: { name: string; bytes: Buffer }[] = [];
const html: string[] = [];

beforeAll(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  run = await runSoak({
    seed: 8_005, days: 6, salesPerDay: 20, endDate: '2026-04-03', file: false, setTime: (ms) => vi.setSystemTime(ms),
    appOptions: {
      saveFile: (name, bytes) => { saved.push({ name, bytes }); return Promise.resolve({ saved: true, fileName: name }); },
      pdfRenderer: (h) => { html.push(h); return Promise.resolve(Buffer.from('%PDF-fake')); },
    },
  });
}, 600_000);

afterAll(() => { vi.useRealTimers(); });

const report = (id: string, params: Record<string, string> = {}): ReportResult => run.app.reports.run(id, params);
const range = () => ({ from: run.startDate, to: run.endDate });
const total = (r: ReportResult, key: string) => r.totals![key] as number;
const sql = (q: string, ...args: unknown[]) => run.db.prepare(q).pluck().get(...args) as number;
const tbNet = (code: string) => {
  const row = run.app.statements.trialBalance({}).rows.find((r) => r.code === code);
  return row ? row.debitPaise - row.creditPaise : 0;
};
const plLine = (from: string, to: string, code: string) => {
  const pl = run.app.statements.profitAndLoss({ from, to });
  return [...pl.revenue, ...pl.costOfSales].find((l) => l.code === code)?.amountPaise ?? 0;
};

describe('the 8e report catalogue on a seeded run (FR-054, PRD §25)', () => {
  it('runs every report the owner can see, with totals', () => {
    const defs = run.app.reports.list();
    expect(defs.length).toBeGreaterThanOrEqual(25);
    for (const d of defs) {
      if (d.params.some((p) => p.required)) continue;
      const r = report(d.id, d.params.some((p) => p.key === 'from') ? range() : {});
      expect(r.truncated, d.id).toBe(false);
    }
    expect(run.counts.creditNotes).toBeGreaterThan(0);
  });

  it('sales by day nets credit notes on their own date and ties to the documents and to revenue', () => {
    const r = report('sales.byDay', range());
    const sales = sql("SELECT SUM(total_paise) FROM sale WHERE status = 'posted' AND doc_date BETWEEN ? AND ?", run.startDate, run.endDate);
    const notes = sql("SELECT SUM(total_paise) FROM credit_note WHERE status = 'posted' AND doc_date BETWEEN ? AND ?", run.startDate, run.endDate);
    expect(total(r, 'salesPaise')).toBe(sales);
    expect(total(r, 'returnsPaise')).toBe(notes);
    expect(total(r, 'netSalesPaise')).toBe(sales - notes);
    expect(total(r, 'netTaxablePaise')).toBe(plLine(run.startDate, run.endDate, '4100'));
    expect(r.rows.reduce((s, x) => s + (x.netSalesPaise as number), 0)).toBe(sales - notes);

    const monthly = report('sales.monthly', range());
    expect(monthly.rows.length).toBe(2);
    expect(monthly.totals).toMatchObject({ netSalesPaise: sales - notes, bills: total(r, 'bills') });
    expect(total(report('sales.byPaymentMethod', range()), 'netPaise')).toBe(sales - notes);
    expect(total(report('sales.byProduct', range()), 'netTaxablePaise')).toBe(total(r, 'netTaxablePaise'));
    expect(total(report('sales.byCategory', range()), 'netTaxablePaise')).toBe(total(r, 'netTaxablePaise'));
    expect(total(report('sales.creditNotes', range()), 'totalPaise')).toBe(notes);
  });

  it("product profit is revenue less the cost the sales and returns carried, the P&L's gross profit before stock corrections", () => {
    const p = report('sales.productProfit', range());
    expect(total(p, 'revenuePaise')).toBe(plLine(run.startDate, run.endDate, '4100'));
    const docCogs = sql(`SELECT SUM(l.debit_paise - l.credit_paise) FROM journal_line l JOIN journal_entry j ON j.id = l.entry_id JOIN account a ON a.id = l.account_id
      WHERE a.code = '5100' AND j.source IN ('sale', 'sale_return') AND j.entry_date BETWEEN ? AND ?`, run.startDate, run.endDate);
    expect(total(p, 'cogsPaise')).toBe(docCogs);
    expect(total(p, 'profitPaise')).toBe(total(p, 'revenuePaise') - docCogs);
  });

  it('receivables and payables as of today are the party outstanding; an earlier date reads the books as they stood', () => {
    expect(report('parties.receivables').totals).toMatchObject(run.app.customerLedger.outstanding({}).totals);
    expect(report('parties.payables').totals).toMatchObject(run.app.supplierLedger.outstanding({}).totals);
    const asOf = run.startDate;
    expect(report('parties.receivables', { asOf }).totals).toMatchObject(run.app.customerLedger.outstanding({ asOf }).totals);
  });

  it('stock valuation and stock movement close at account 1400; the cash report closes at 1100', () => {
    expect(total(report('stock.valuation'), 'valuePaise')).toBe(tbNet('1400'));
    expect(total(report('stock.movement', range()), 'closingValuePaise')).toBe(tbNet('1400'));
    expect(report('money.cash', range()).totals!.closingPaise).toBe(tbNet('1100'));
    expect(report('accounting.cashBook', range()).totals!.balancePaise).toBe(tbNet('1100'));
  });

  it('the statements match the Stage 6 services', () => {
    const pl = run.app.statements.profitAndLoss(range());
    expect(total(report('accounting.profitAndLoss', range()), 'amountPaise')).toBe(pl.netProfitPaise);
    const bs = report('accounting.balanceSheet');
    expect(bs.rows.find((r) => r.section === 'Total assets')!.amountPaise).toBe(total(bs, 'amountPaise'));
    const day = report('accounting.dayBook', range());
    expect(total(day, 'debitPaise')).toBe(total(day, 'creditPaise'));
    expect(report('accounting.ledger', { ...range(), accountCode: '1400' }).totals!.balancePaise).toBe(tbNet('1400'));
    expect(() => report('accounting.ledger', { accountCode: '9999' })).toThrow(/No such account/);
    const payments = report('money.payments', range());
    expect(total(payments, 'inPaise')).toBe(sql("SELECT SUM(amount_paise) FROM payment WHERE status = 'posted' AND direction = 'in' AND payment_date BETWEEN ? AND ?", run.startDate, run.endDate));
  });

  it('a customer ledger opens and closes on the party statement', () => {
    const customerId = sql("SELECT party_id FROM party_ledger_entry WHERE party_type = 'customer' GROUP BY party_id ORDER BY COUNT(*) DESC LIMIT 1");
    const r = report('parties.customerLedger', { partyId: String(customerId) });
    expect(r.totals!.balancePaise).toBe(sql("SELECT SUM(amount_paise) FROM party_ledger_entry WHERE party_type = 'customer' AND party_id = ?", customerId));
  });

  it('exports sales by day, receivables and the day book as CSV, XLSX and PDF with the business header', async () => {
    await run.app.reports.export('sales.byDay', range(), 'csv');
    await run.app.reports.export('parties.receivables', {}, 'xlsx');
    await run.app.reports.export('accounting.dayBook', range(), 'pdf');
    const csv = saved[0]!.bytes.toString('utf8');
    expect(csv).toContain('Sales by day');
    expect(csv).toContain(`From: ${run.startDate}`);
    expect(csv).toMatch(/Generated /u);
    const book = new ExcelJS.Workbook();
    await book.xlsx.load(saved[1]!.bytes as unknown as ArrayBuffer);
    expect(book.worksheets[0]!.getRow(1).getCell(1).value).toBeTruthy();
    expect(html[0]).toContain('Day book');
  });
});
