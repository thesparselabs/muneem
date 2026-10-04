import { beforeEach, describe, expect, it } from 'vitest';
import { newUlid } from '@muneem/domain';
import { tieOutFailures, type Db } from '@muneem/db-sqlite';
import {
  CompleteSaleInput, CreatePurchaseInput, ExpenseInput, ManualJournalInput, PaymentInput, SaleDraft, type AccountView, type BalanceSheet, type Customer,
  type ProfitAndLoss, type Supplier, type TrialBalance,
} from '@muneem/contracts';
import type { App } from '../src/main/app.js';
import { caller, ownerAtTill, testApp } from './helpers.js';

let app: App;
let db: Db;
let api: ReturnType<typeof caller>;
let businessId: string;
let pcs: string;
let soap: string;
let ravi: Customer;
let acme: Supplier;
let accounts: Map<string, AccountView>;
const today = new Date().toLocaleDateString('en-CA');
const fyStart = `${Number(today.slice(5, 7)) >= 4 ? today.slice(0, 4) : Number(today.slice(0, 4)) - 1}-04-01`;

beforeEach(async () => {
  ({ app, db } = await testApp());
  api = caller(app);
  businessId = (await ownerAtTill(app)).businessId;
  pcs = (await api.data<{ id: string; code: string }[]>('catalog.listUoms')).find((u) => u.code === 'PCS')!.id;
  soap = (await api.data<{ id: string }>('products.create', { name: 'Soap', baseUomId: pcs, gstRateBp: 1800, sellingPricePaise: 11_800, priceIsInclusive: true })).id;
  ravi = app.customers.create({ name: 'Ravi' });
  ravi = app.customers.setCreditLimit({ id: ravi.id, version: ravi.version, limitPaise: 1_000_000 });
  acme = app.suppliers.create({ name: 'Acme', stateCode: '07', gstin: '07AAAAA0000A1Z5', taxScheme: 'regular', creditDays: 30 });
  accounts = new Map(app.statements.accounts().map((a) => [a.code, a]));
});

// A shop's month: last year's rent, opening stock, a purchase with freight, a split sale, a receipt leaving an advance.
async function trade() {
  const rent = app.expenses.categories().find((c) => c.accountCode === '5400')!.id;
  app.expenses.create(ExpenseInput.parse({ categoryId: rent, method: 'bank', amountPaise: 20_000, expenseDate: `${Number(fyStart.slice(0, 4)) - 1}-12-15`, commandId: newUlid() }));
  app.inventory.setOpeningStock({ lines: [{ productId: soap, qtyMilli: 5000, unitCostPaise: 7000 }] });
  app.purchases.create(CreatePurchaseInput.parse({ supplierId: acme.id, supplierInvoiceNo: 'B1', supplierInvoiceDate: today, billTotalPaise: 119_000, commandId: newUlid(),
    lines: [{ productId: soap, uomId: pcs, qtyMilli: 10_000, unitPricePaise: 10_000 }], charges: [{ kind: 'freight', amountPaise: 1000 }] }));
  await app.register.open(0);
  const d = SaleDraft.parse({ lines: [{ productId: soap, uomId: pcs, qtyMilli: 3000 }], customerId: ravi.id });
  app.sales.complete(CompleteSaleInput.parse({ ...d, commandId: newUlid(), expectedTotalPaise: 35_400, tenders: [{ method: 'cash', amountPaise: 15_400 }, { method: 'credit', amountPaise: 20_000 }] }));
  app.payments.create(PaymentInput.parse({ partyType: 'customer', partyId: ravi.id, amountPaise: 25_000, method: 'upi', commandId: newUlid() }));
}

describe('statements (6d)', () => {
  it('the trial balance balances, and P&L and the balance sheet agree with each other', async () => {
    await trade();
    const tb = await api.data<TrialBalance>('accounting.getTrialBalance', {});
    expect(tb).toMatchObject({ balanced: true });
    expect(tb.debitPaise).toBeGreaterThan(0);
    const pl = await api.data<ProfitAndLoss>('accounting.getProfitAndLoss', { from: fyStart, to: today });
    expect(pl.revenue).toEqual([expect.objectContaining({ code: '4100', amountPaise: 30_000 })]);
    expect(pl.grossProfitPaise).toBe(30_000 - pl.costOfSales.reduce((s, l) => s + l.amountPaise, 0));
    const bs = await api.data<BalanceSheet>('accounting.getBalanceSheet', {});
    expect(bs).toMatchObject({ balanced: true, retainedEarningsPaise: -20_000, currentProfitPaise: pl.netProfitPaise });
    // Ravi paid ₹50 more than he owed: his advance is a liability, not a negative receivable (ADR-0032).
    expect(bs.liabilities).toContainEqual(expect.objectContaining({ name: 'Advances from customers', amountPaise: 5000 }));
    expect(bs.assets.find((a) => a.code === '1300')).toBeUndefined();
    expect(tieOutFailures(db, businessId)).toEqual([]);
  });

  it('the ledger runs a balance, pages, and opens a range with the balance before it; the day book lists journals with lines', async () => {
    await trade();
    const cash = accounts.get('1100')!.id;
    app.manualJournals.post(ManualJournalInput.parse({ narration: 'Owner took cash', commandId: newUlid(), lines: [{ accountId: accounts.get('3200')!.id, debitPaise: 1000 }, { accountId: cash, creditPaise: 1000 }] }));
    const all = app.statements.ledger({ accountId: cash, limit: 100 });
    expect(all.items.map((l) => l.balancePaise)).toEqual([15_400, 14_400]);
    expect(all.closingBalancePaise).toBe(14_400);
    const first = app.statements.ledger({ accountId: cash, limit: 1 });
    expect(app.statements.ledger({ accountId: cash, limit: 1, cursor: first.nextCursor! }).items[0]!.balancePaise).toBe(14_400);
    expect(app.statements.book('cash', { limit: 100 }).closingBalancePaise).toBe(14_400);
    expect(app.statements.ledger({ accountId: accounts.get('5400')!.id, from: fyStart, limit: 100 })).toMatchObject({ openingBalancePaise: 20_000, items: [] });
    const book = app.statements.dayBook({ from: fyStart, to: today, limit: 50 });
    expect(book.items.find((e) => e.source === 'manual')).toMatchObject({ narration: 'Owner took cash', lines: [expect.objectContaining({ code: '3200', debitPaise: 1000 }), expect.objectContaining({ code: '1100', creditPaise: 1000 })] });
  });
});

describe('manual journals (6d, ADR-0035)', () => {
  const mj = (lines: { code: string; dr?: number; cr?: number }[], over: Record<string, unknown> = {}) => ManualJournalInput.parse({
    narration: 'Card settlement', commandId: newUlid(), ...over,
    lines: lines.map((l) => ({ accountId: accounts.get(l.code)!.id, debitPaise: l.dr ?? 0, creditPaise: l.cr ?? 0 })),
  });

  it('posts a balanced journal numbered J, once per command, and reverses it once', async () => {
    const input = mj([{ code: '1200', dr: 9800 }, { code: '5460', dr: 200 }, { code: '1250', cr: 10_000 }]);
    const j = app.manualJournals.post(input);
    expect(j).toMatchObject({ entryNo: expect.stringMatching(/^DE01J\//), totalPaise: 10_000 });
    expect(app.manualJournals.post(input).id).toBe(j.id);
    const r = app.manualJournals.reverse(j.id, 'posted twice');
    expect(r.totalPaise).toBe(10_000);
    expect(() => app.manualJournals.reverse(j.id, 'again')).toThrow();
    expect(() => app.manualJournals.reverse(r.id, 'reverse the reversal')).toThrow(/Only a manual journal/);
    expect(tieOutFailures(db, businessId)).toEqual([]);
  });

  it('refuses an unbalanced journal, a control or group account, and a locked month', async () => {
    expect(() => app.manualJournals.post(mj([{ code: '1200', dr: 100 }, { code: '1250', cr: 99 }]))).toThrow(expect.objectContaining({ fields: { lines: expect.stringContaining('must be equal') } }));
    expect(() => app.manualJournals.post(mj([{ code: '1300', dr: 100 }, { code: '1100', cr: 100 }]))).toThrow(expect.objectContaining({ fields: { 'lines.0.accountId': expect.stringContaining('only through documents') } }));
    expect(() => app.manualJournals.post(mj([{ code: '1510', dr: 100 }, { code: '2210', cr: 100 }]))).toThrow(expect.objectContaining({ fields: {
      'lines.0.accountId': expect.stringContaining('only through documents'), 'lines.1.accountId': expect.stringContaining('only through documents') } }));
    expect(() => app.manualJournals.post(mj([{ code: '1000', dr: 100 }, { code: '1100', cr: 100 }]))).toThrow(expect.objectContaining({ fields: { 'lines.0.accountId': expect.stringContaining('is a group') } }));
    const lastMonth = new Date(`${today.slice(0, 7)}-01T00:00:00Z`); lastMonth.setUTCMonth(lastMonth.getUTCMonth() - 1);
    const start = lastMonth.toISOString().slice(0, 10);
    app.periods.lock(start);
    expect(await api.call('accounting.postManualJournal', { ...mj([{ code: '1200', dr: 100 }, { code: '1250', cr: 100 }]), date: `${start.slice(0, 8)}20` }))
      .toMatchObject({ ok: false, error: { code: 'PERIOD_LOCKED' } });
  });
});

describe('chart of accounts (6d)', () => {
  it('adds an account under a group, uses it, and renames a system account', async () => {
    const hdfc = await api.data<AccountView>('accounting.createAccount', { code: '1210', name: 'HDFC Current', parentCode: '1000' });
    expect(hdfc).toMatchObject({ type: 'asset', isSystem: false, balancePaise: 0 });
    app.manualJournals.post(ManualJournalInput.parse({ narration: 'Moved to HDFC', commandId: newUlid(), lines: [{ accountId: hdfc.id, debitPaise: 500 }, { accountId: accounts.get('1200')!.id, creditPaise: 500 }] }));
    expect(app.statements.accounts().find((a) => a.code === '1210')!.balancePaise).toBe(500);
    expect(() => app.chart.create({ code: '2210', name: 'X', parentCode: '1000' })).toThrow(expect.objectContaining({ fields: { code: expect.stringContaining('start with 1') } }));
    expect(() => app.chart.create({ code: '1100', name: 'X', parentCode: '1000' })).toThrow(expect.objectContaining({ fields: { code: 'already used' } }));
    expect(() => app.chart.create({ code: '1220', name: 'X', parentCode: '1100' })).toThrow(expect.objectContaining({ fields: { parentCode: expect.any(String) } }));
    expect(app.chart.rename(accounts.get('1300')!.id, 'Sundry Debtors')).toMatchObject({ code: '1300', name: 'Sundry Debtors', role: 'ar' });
  });
});
