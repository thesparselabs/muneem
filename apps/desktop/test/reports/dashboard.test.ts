import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { newUlid } from '@muneem/domain';
import { CompleteReturnInput, CompleteSaleInput, CreatePurchaseInput, ExpenseInput, PaymentInput, SaleDraft, SupplierInput, type Customer, type TenderLine } from '@muneem/contracts';
import { dailySummaryDrift, type Db } from '@muneem/db-sqlite';
import type { App } from '../../src/main/app.js';
import { caller, grantRole, ownerAtTill, testApp } from '../helpers.js';
import { runSoak } from '../soak/generator.js';
import { DEVICE_A, DEVICE_B, ownerMembership, referenceCloud, syncedAppOptions, syncedDevice, syncUntilQuiet } from '../sync/syncHelpers.js';

let app: App;
let db: Db;
let businessId: string;
let pcs: string;
let soap: string;
let rice: string;
let ravi: Customer;

beforeEach(async () => {
  ({ app, db } = await testApp());
  const api = caller(app);
  businessId = (await ownerAtTill(app)).businessId;
  pcs = (await api.data<{ id: string; code: string }[]>('catalog.listUoms')).find((u) => u.code === 'PCS')!.id;
  soap = (await api.data<{ id: string }>('products.create', { name: 'Soap', baseUomId: pcs, gstRateBp: 1800, sellingPricePaise: 11_800, priceIsInclusive: true, reorderLevelMilli: 100_000 })).id;
  rice = (await api.data<{ id: string }>('products.create', { name: 'Rice 1kg', baseUomId: pcs, gstRateBp: 500, sellingPricePaise: 6_001 })).id;
  app.inventory.setOpeningStock({ lines: [{ productId: soap, qtyMilli: 50_000, unitCostPaise: 7_000 }, { productId: rice, qtyMilli: 50_000, unitCostPaise: 4_333 }] });
  ravi = await api.data<Customer>('customers.create', { name: 'Ravi', creditDays: 15 });
  ravi = app.customers.setCreditLimit({ id: ravi.id, version: ravi.version, limitPaise: 10_000_000 });
  await api.data('pos.openRegister', { openingCashPaise: 100_000 });
});

const sell = (lines: [string, number][], tenders: (total: number) => TenderLine[], customerId?: string) => {
  const d = SaleDraft.parse({ lines: lines.map(([productId, qty]) => ({ productId, uomId: pcs, qtyMilli: qty * 1000 })), ...(customerId && { customerId }) });
  const total = app.sales.quote(d).totals.totalPaise;
  return app.sales.complete(CompleteSaleInput.parse({ ...d, commandId: newUlid(), expectedTotalPaise: total, tenders: tenders(total) }));
};
const giveBack = (saleId: string, lines: [number, number][]) => {
  const draft = { saleId, lines: lines.map(([lineNo, qty]) => ({ lineNo, qtyMilli: qty })) };
  const quote = app.returns.quote(draft);
  return app.returns.complete(CompleteReturnInput.parse({ ...draft, commandId: newUlid(), reason: 'changed mind', expectedTotalPaise: quote.totalPaise }));
};

function trade() {
  const cash = sell([[soap, 3], [rice, 2]], (t) => [{ method: 'cash', amountPaise: t + 1000 }]);
  sell([[rice, 4]], (t) => [{ method: 'upi', amountPaise: t }]);
  const credit = sell([[soap, 2]], (t) => [{ method: 'cash', amountPaise: 1000 }, { method: 'credit', amountPaise: t - 1000 }], ravi.id);
  giveBack(cash.saleId, [[1, 1000]]);
  giveBack(credit.saleId, [[1, 1000]]);
  app.payments.create(PaymentInput.parse({ partyType: 'customer', partyId: ravi.id, amountPaise: 5_000, method: 'upi', commandId: newUlid() }));
  const wrong = app.payments.create(PaymentInput.parse({ partyType: 'customer', partyId: ravi.id, amountPaise: 2_000, method: 'cash', commandId: newUlid() }));
  app.payments.cancel(wrong.id, 'keyed twice');
  const supplier = app.suppliers.create(SupplierInput.parse({ name: 'Acme', stateCode: '07', gstin: '07AAAAA0000A1Z5', creditDays: 30 }));
  app.purchases.create(CreatePurchaseInput.parse({
    supplierId: supplier.id, supplierInvoiceNo: 'A-1', supplierInvoiceDate: new Date().toLocaleDateString('en-CA'), billTotalPaise: 105_000,
    commandId: newUlid(), lines: [{ productId: rice, uomId: pcs, qtyMilli: 20_000, unitPricePaise: 5_000 }],
  }));
  const rent = app.expenses.categories()[0]!.id;
  app.expenses.create(ExpenseInput.parse({ categoryId: rent, method: 'cash', amountPaise: 30_000, commandId: newUlid() }));
  const typo = app.expenses.create(ExpenseInput.parse({ categoryId: rent, method: 'cash', amountPaise: 99_000, commandId: newUlid() }));
  app.expenses.cancel(typo.id, 'typo');
}

describe('the offline dashboard and its daily summaries (FR-072, 8e)', () => {
  it("today's figures are the sales by day report's, with the payment split, parties, purchases, expenses and top sellers", async () => {
    trade();
    const d = app.dashboard.get();
    const today = d.today;
    const byDay = await app.reports.run('sales.byDay', { from: today, to: today });
    expect(d.sales).toMatchObject({
      saleCount: byDay.totals!.bills, salesPaise: byDay.totals!.salesPaise, returnCount: 2, returnsPaise: byDay.totals!.returnsPaise,
      netSalesPaise: byDay.totals!.netSalesPaise, netTaxablePaise: byDay.totals!.netTaxablePaise,
    });
    const pl = app.statements.profitAndLoss({ from: today, to: today });
    expect(d.sales.grossProfitPaise).toBe(pl.grossProfitPaise);
    expect((await app.reports.run('sales.productProfit', { from: today, to: today })).totals!.profitPaise).toBe(pl.grossProfitPaise);
    const split = await app.reports.run('sales.byPaymentMethod', { from: today, to: today });
    expect(Object.fromEntries(d.todayTenders.map((t) => [t.method, t.amountPaise]))).toEqual(Object.fromEntries(split.rows.filter((r) => r.netPaise !== 0).map((r) => [r.method, r.netPaise])));
    expect(d.receivablePaise).toBe(app.customerLedger.outstanding({}).totals.netPaise);
    expect(d.payablePaise).toBe(app.supplierLedger.outstanding({}).totals.netPaise);
    expect(d.purchasesPaise).toBe(105_000);
    expect(d.expensesPaise).toBe(30_000);
    expect(d.trend).toHaveLength(30);
    expect(d.trend.at(-1)).toMatchObject({ day: today, netSalesPaise: d.sales.netSalesPaise });
    expect(d.topProducts.map((p) => p.name)).toEqual(['Rice 1kg', 'Soap']);
    expect(d.lowStock).toMatchObject({ count: 1, items: [{ name: 'Soap' }] });
    expect(dailySummaryDrift(db, businessId)).toEqual([]);
  });

  it('a drifted summary is found by the integrity check and rebuilt from the documents', async () => {
    trade();
    const before = app.dashboard.get();
    db.prepare('UPDATE daily_sales_summary SET sale_total_paise = sale_total_paise + 1').run();
    db.prepare("DELETE FROM daily_payment_summary WHERE flow = 'expense'").run();
    expect(dailySummaryDrift(db, businessId).map((x) => x.table)).toEqual(['daily_sales_summary', 'daily_payment_summary']);
    const check = await app.diagnostics.integrityCheck();
    expect(check.summaries).toBe('healed');
    expect(dailySummaryDrift(db, businessId)).toEqual([]);
    expect(app.dashboard.get()).toEqual(before);
    expect(await app.diagnostics.checkSummaries()).toBe('ok');
  });

  it('is behind reports.view: a cashier is refused', async () => {
    const api = caller(app);
    expect(await api.call('reports.dashboard')).toMatchObject({ ok: true });
    grantRole(db, app, 'cashier');
    expect(await api.call('reports.dashboard')).toMatchObject({ ok: false, error: { code: 'PERMISSION_DENIED' } });
  });
});

describe('daily summaries on a seeded run and on the device that pulled it (ADR-0040)', () => {
  afterEach(() => { vi.useRealTimers(); });

  it('rebuild = incremental on the device that traded and on the one that pulled every document', async () => {
    const cloud = referenceCloud();
    vi.useFakeTimers({ toFake: ['Date'] });
    const run = await runSoak({ seed: 31, days: 5, salesPerDay: 10, endDate: '2026-04-02', file: false, setTime: (ms) => vi.setSystemTime(ms), appOptions: syncedAppOptions(cloud, DEVICE_A) });
    expect(dailySummaryDrift(run.db, run.businessId)).toEqual([]);
    await syncUntilQuiet(run.app);
    const b = await syncedDevice(cloud, DEVICE_B, () => [ownerMembership(run.businessId)]);
    await caller(b.app).data('auth.login', { identifier: '9999999999', password: 'correct-horse' });
    await syncUntilQuiet(b.app);
    const summaries = (x: Db) => ['daily_sales_summary', 'daily_payment_summary', 'product_sales_daily']
      .map((t) => x.prepare(`SELECT * FROM ${t} WHERE business_id = ? ORDER BY 1, 2, 3, 4, 5`).all(run.businessId));
    expect(summaries(run.db)[0]!.length).toBeGreaterThan(0);
    expect(summaries(b.db)).toEqual(summaries(run.db));
    expect(dailySummaryDrift(b.db, run.businessId)).toEqual([]);
  }, 300_000);
});
