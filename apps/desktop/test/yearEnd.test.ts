import { beforeEach, describe, expect, it } from 'vitest';
import { newUlid } from '@muneem/domain';
import { applyChanges, balanceDrift, fyBalances, tieOutFailures, type Db } from '@muneem/db-sqlite';
import { CompleteSaleInput, CreatePurchaseInput, ExpenseInput, PurchaseDraft, SaleDraft, payloadSchema, type Change } from '@muneem/contracts';
import { verifyOperation } from '@muneem/sync-reference';
import type { App } from '../src/main/app.js';
import { caller, grantRole, ownerAtTill, testApp } from './helpers.js';

const at = (day: string) => Date.parse(`${day}T06:30:00Z`);
const FY = '2025-26';
let clock = at('2026-03-10');
let app: App;
let db: Db;
let api: ReturnType<typeof caller>;
let businessId: string;
let pcs: string;
let soap: string;

beforeEach(async () => {
  clock = at('2026-03-10');
  ({ app, db } = await testApp({ now: () => clock }));
  api = caller(app);
  businessId = (await ownerAtTill(app, { gstin: '07AAAAA0000A1Z5' })).businessId;
  pcs = (await api.data<{ id: string; code: string }[]>('catalog.listUoms')).find((u) => u.code === 'PCS')!.id;
  soap = (await api.data<{ id: string }>('products.create', { name: 'Soap', hsnCode: '3401', baseUomId: pcs, gstRateBp: 1800, sellingPricePaise: 11_800, priceIsInclusive: true })).id;
  const acme = app.suppliers.create({ name: 'Acme', stateCode: '07', gstin: '07CCCCC0000C1Z5', taxScheme: 'regular', creditDays: 30 });
  const draft = PurchaseDraft.parse({ supplierId: acme.id, supplierInvoiceNo: 'A-1', supplierInvoiceDate: '2026-03-02', lines: [{ productId: soap, uomId: pcs, qtyMilli: 20_000, unitPricePaise: 5_000 }] });
  app.purchases.create(CreatePurchaseInput.parse({ ...draft, billTotalPaise: app.purchases.quote(draft).totals.totalPaise, commandId: newUlid() }));
  await app.register.open(50_000);
  for (let i = 0; i < 3; i++) sell(2);
  spend('2026-03-09', 25_000);
  clock = at('2026-04-05');
});

function sell(qty: number) {
  const d = SaleDraft.parse({ lines: [{ productId: soap, uomId: pcs, qtyMilli: qty * 1000 }] });
  const total = app.sales.quote(d).totals.totalPaise;
  app.sales.complete(CompleteSaleInput.parse({ ...d, commandId: newUlid(), expectedTotalPaise: total, tenders: [{ method: 'cash', amountPaise: total }] }));
}
const spend = (expenseDate: string, amountPaise: number) =>
  app.expenses.create(ExpenseInput.parse({ categoryId: app.expenses.categories()[0]!.id, method: 'cash', amountPaise, expenseDate, commandId: newUlid() }));

function readyToClose(): void {
  app.gst.setoffs.post({ month: '2026-03-01', commandId: newUlid() });
  for (let m = 4; m <= 15; m++) app.periods.lock(`${m <= 12 ? 2025 : 2026}-${String(((m - 1) % 12) + 1).padStart(2, '0')}-01`);
}
const year = () => app.yearEnd.list().find((y) => y.fy === FY)!;
const closingJournals = () => db.prepare(`SELECT j.entry_no, j.entry_date, j.source, p.status AS period FROM journal_entry j JOIN accounting_period p ON p.id = j.period_id
  WHERE j.business_id = ? AND j.source = 'closing' ORDER BY j.entry_no`).all(businessId);
const retained = () => { const r = app.statements.trialBalance({}).rows.find((x) => x.code === '3300'); return r ? r.creditPaise - r.debitPaise : 0; };

// Another device's journal that had not heard of the locks keeps its date in the closed year (ADR-0040).
function pulledJournal(entryDate: string, code: string, amountPaise: number): void {
  const id = newUlid();
  const payload = {
    id, entryNo: 'T2J/2526/00001', entryDate, periodId: newUlid(), source: 'manual', refType: 'manual', refId: id, docDate: entryDate, narration: 'from another till',
    branchId: null, terminalId: null, latePosting: false, reversalOf: null,
    lines: [{ account: { code }, debitPaise: amountPaise, creditPaise: 0 }, { account: { role: 'cash' }, debitPaise: 0, creditPaise: amountPaise }],
  };
  const change: Change = { seq: 1, stream: 'documents', entityType: 'journal_entry', entityId: id, op: 'upsert', version: 1, originDeviceId: 'other-device', payload };
  db.transaction(() => applyChanges(db, { businessId, cloudDeviceId: 'this-device' }, [change]))();
}

describe('year-end close (8d, ADR-0045)', () => {
  it('lists what stands in the way: the year has to end, every month be locked and GST be set off', async () => {
    clock = at('2026-03-20');
    expect(year()).toMatchObject({ status: 'open', ended: false, gst: { required: true, lastActiveMonth: '2026-03-01', settledThrough: null } });
    clock = at('2026-04-05');
    expect(year().blockers).toEqual([
      'Lock every month first; still open: 2025-04, 2025-05, 2025-06, 2025-07, 2025-08, 2025-09, 2025-10, 2025-11, 2025-12, 2026-01, 2026-02, 2026-03',
      'Set off GST through 2026-03 first',
    ]);
    expect(await api.call('accounting.closeYear', { fy: FY })).toMatchObject({ ok: false, error: { code: 'INVALID_STATE' } });
    app.gst.setoffs.post({ month: '2026-03-01', commandId: newUlid() });
    app.periods.lock('2026-03-01');
    expect(year().blockers).toEqual([expect.stringContaining('still open: 2025-04')]);
  });

  it('closes the year: one journal on 31 March into the locked March, income and expense to 3300, reports unchanged', async () => {
    readyToClose();
    const pl = app.statements.profitAndLoss({ from: '2025-04-01', to: '2026-03-31' });
    const bs = app.statements.balanceSheet({ asOf: '2026-03-31' });
    expect(pl.netProfitPaise).not.toBe(0);
    const ranges = [['2026-03-15', '2026-03-31'], ['2026-03-01', '2026-03-31'], ['2026-03-31', '2026-03-31'], ['2025-04-01', '2026-04-05'], ['2026-02-01', '2026-04-30']] as const;
    const statements = () => ({
      pl: ranges.map(([from, to]) => app.statements.profitAndLoss({ from, to })),
      bs: ['2026-03-15', '2026-03-30', '2026-03-31'].map((asOf) => app.statements.balanceSheet({ asOf })),
    });
    const read = statements();
    const later = app.statements.balanceSheet({ asOf: '2026-04-05' });
    const closed = await api.data<{ status: string; closings: { entryNo: string; profitPaise: number }[] }>('accounting.closeYear', { fy: FY });
    expect(closed).toMatchObject({ status: 'closed', closings: [{ entryNo: 'CL/2526', profitPaise: pl.netProfitPaise }] });
    expect(closingJournals()).toEqual([{ entry_no: 'CL/2526', entry_date: '2026-03-31', source: 'closing', period: 'locked' }]);
    expect(fyBalances(db, businessId, FY)).toEqual([]);
    expect(retained()).toBe(pl.netProfitPaise);
    expect(app.statements.profitAndLoss({ from: '2025-04-01', to: '2026-03-31' })).toEqual(pl);
    expect(app.statements.balanceSheet({ asOf: '2026-03-31' })).toEqual(bs);
    expect(statements()).toEqual(read);
    expect(app.statements.balanceSheet({ asOf: '2026-04-05' })).toMatchObject({ ...later, equity: expect.any(Array) });
    const now = app.statements.balanceSheet({});
    expect(now).toMatchObject({ balanced: true, retainedEarningsPaise: pl.netProfitPaise, currentProfitPaise: 0 });
    expect(now.equity).toContainEqual(expect.objectContaining({ code: '3300', amountPaise: pl.netProfitPaise }));
    expect(app.statements.trialBalance({})).toMatchObject({ balanced: true });
    expect(tieOutFailures(db, businessId)).toEqual([]);
    expect(balanceDrift(db, businessId)).toBe(0);
  });

  it('closes once, keeps its months locked, and syncs as a control change both servers accept', async () => {
    readyToClose();
    app.yearEnd.close(FY);
    expect(await api.call('accounting.closeYear', { fy: FY })).toMatchObject({ ok: false, error: { code: 'INVALID_STATE', message: expect.stringContaining('already closed') } });
    expect(() => app.periods.unlock('2026-03-01', 'amend')).toThrow(/closed/);
    const op = db.prepare("SELECT operation_type, payload_json FROM sync_outbox WHERE entity_type = 'fy_close'").get() as { operation_type: string; payload_json: string };
    const payload = JSON.parse(op.payload_json) as Record<string, unknown>;
    expect(op.operation_type).toBe('create');
    expect(payloadSchema('fy_close', 'create').safeParse(payload).success).toBe(true);
    expect(verifyOperation('fy_close', 'create', payload)).toBeNull();
    expect(payload).toMatchObject({ fy: FY, fyEnd: '2026-03-31', version: 1, closings: [{ version: 1, journal: { entryNo: 'CL/2526', source: 'closing' } }] });
  });

  it('a late document dated in the closed year posts into the new year and leaves the closed year alone', () => {
    readyToClose();
    app.yearEnd.close(FY);
    const pl = app.statements.profitAndLoss({ from: '2025-04-01', to: '2026-03-31' });
    spend('2026-03-20', 4_000);
    expect(app.statements.profitAndLoss({ from: '2025-04-01', to: '2026-03-31' })).toEqual(pl);
    expect(year()).toMatchObject({ needsReclose: false, residuePaise: 0 });
    expect(app.periods.latePostings()).toContainEqual(expect.objectContaining({ docDate: '2026-03-20', entryDate: '2026-04-01' }));
  });

  it("a journal synced into the closed year is re-closed by an adjusting closing journal, and the books agree throughout", async () => {
    readyToClose();
    app.yearEnd.close(FY);
    const before = app.statements.profitAndLoss({ from: '2025-04-01', to: '2026-03-31' }).netProfitPaise;
    pulledJournal('2026-03-15', '5400', 7_000);
    expect(year()).toMatchObject({ needsReclose: true, residuePaise: -7_000 });
    expect(app.statements.profitAndLoss({ from: '2025-04-01', to: '2026-03-31' }).netProfitPaise).toBe(before - 7_000);
    expect(app.statements.balanceSheet({})).toMatchObject({ balanced: true, retainedEarningsPaise: before - 7_000 });
    const after = await api.data<{ closings: { entryNo: string; profitPaise: number }[]; needsReclose: boolean }>('accounting.recloseYear', { fy: FY });
    expect(after).toMatchObject({ needsReclose: false, closings: [{ entryNo: 'CL/2526' }, { entryNo: 'CL/2526/2', profitPaise: -7_000 }] });
    expect(retained()).toBe(before - 7_000);
    expect(app.statements.balanceSheet({})).toMatchObject({ balanced: true, retainedEarningsPaise: before - 7_000, equity: expect.arrayContaining([expect.objectContaining({ code: '3300', amountPaise: before - 7_000 })]) });
    expect(app.statements.profitAndLoss({ from: '2025-04-01', to: '2026-03-31' }).netProfitPaise).toBe(before - 7_000);
    expect(() => app.yearEnd.reclose(FY)).toThrow(/Nothing has posted/);
    const update = db.prepare("SELECT payload_json FROM sync_outbox WHERE entity_type = 'fy_close' AND operation_type = 'update'").pluck().get() as string;
    expect(JSON.parse(update)).toMatchObject({ version: 2, closings: [{ version: 1 }, { version: 2 }] });
    expect(tieOutFailures(db, businessId)).toEqual([]);
  });

  it('needs accounting.close: a cashier or a manager may not close a year, an accountant may', async () => {
    readyToClose();
    grantRole(db, app, 'manager');
    expect(await api.call('accounting.closeYear', { fy: FY })).toMatchObject({ ok: false, error: { code: 'PERMISSION_DENIED' } });
    grantRole(db, app, 'accountant');
    expect(await api.call('accounting.closeYear', { fy: FY })).toMatchObject({ ok: true });
  });

  it('a composition business closes without GST set-offs', async () => {
    ({ app, db } = await testApp({ now: () => clock }));
    api = caller(app);
    businessId = (await ownerAtTill(app, { taxScheme: 'composition' })).businessId;
    spend('2026-03-09', 25_000);
    for (let m = 4; m <= 15; m++) app.periods.lock(`${m <= 12 ? 2025 : 2026}-${String(((m - 1) % 12) + 1).padStart(2, '0')}-01`);
    expect(year()).toMatchObject({ gst: { required: false }, blockers: [] });
    expect(app.yearEnd.close(FY)).toMatchObject({ status: 'closed', closings: [{ profitPaise: -25_000 }] });
  });
});
