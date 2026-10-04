import { describe, expect, it } from 'vitest';
import { newUlid } from '@muneem/domain';
import { fyBalances, type Db } from '@muneem/db-sqlite';
import { CompleteSaleInput, CreatePurchaseInput, ExpenseInput, PurchaseDraft, SaleDraft } from '@muneem/contracts';
import type { ReferenceServer } from '@muneem/sync-reference';
import type { App } from '../../src/main/app.js';
import { caller, ownerAtTill } from '../helpers.js';
import { books, bundleDownloader, DEVICE_A, DEVICE_B, healthy, hydrate, ownerMembership, referenceCloud, syncedDevice, syncUntilQuiet } from './syncHelpers.js';

const at = (day: string) => Date.parse(`${day}T06:30:00Z`);
const FY = '2025-26';
const HEALTHY = { tieOuts: [], replay: [], partyMismatches: [], allocationFaults: [] };
const closes = (db: Db, businessId: string) =>
  db.prepare('SELECT id, fy, status, version, closings_json FROM fy_close WHERE business_id = ? AND status <> ? ORDER BY fy').all(businessId, 'superseded');

async function trade(app: App) {
  const api = caller(app);
  const pcs = (await api.data<{ id: string; code: string }[]>('catalog.listUoms')).find((u) => u.code === 'PCS')!.id;
  const soap = (await api.data<{ id: string }>('products.create', { name: 'Soap', baseUomId: pcs, hsnCode: '3401', gstRateBp: 1800, sellingPricePaise: 118_000 })).id;
  const supplier = app.suppliers.create({ name: 'Pune Mills', stateCode: '27', gstin: '27DDDDD0000D1Z5', taxScheme: 'regular', creditDays: 30 });
  const draft = PurchaseDraft.parse({ supplierId: supplier.id, supplierInvoiceNo: 'P-1', supplierInvoiceDate: '2026-03-02', lines: [{ productId: soap, uomId: pcs, qtyMilli: 20_000, unitPricePaise: 60_000 }] });
  app.purchases.create(CreatePurchaseInput.parse({ ...draft, billTotalPaise: app.purchases.quote(draft).totals.totalPaise, commandId: newUlid() }));
  await app.register.open(100_000);
  const sale = SaleDraft.parse({ lines: [{ productId: soap, uomId: pcs, qtyMilli: 10_000 }] });
  const total = app.sales.quote(sale).totals.totalPaise;
  app.sales.complete(CompleteSaleInput.parse({ ...sale, commandId: newUlid(), expectedTotalPaise: total, tenders: [{ method: 'cash', amountPaise: total }] }));
}

function readyToClose(app: App): void {
  app.gst.setoffs.post({ month: '2026-03-01', commandId: newUlid() });
  for (let m = 4; m <= 15; m++) app.periods.lock(`${m <= 12 ? 2025 : 2026}-${String(((m - 1) % 12) + 1).padStart(2, '0')}-01`);
}

// Two devices of one business, both synced with March traded on A.
async function twoDevices(cloud: ReferenceServer, clock: () => number) {
  const a = await syncedDevice(cloud, DEVICE_A, () => [], { now: clock });
  const { businessId, branchId } = await ownerAtTill(a.app, { gstin: '07AAAAA0000A1Z5' });
  await trade(a.app);
  await syncUntilQuiet(a.app);
  const b = await syncedDevice(cloud, DEVICE_B, () => [ownerMembership(businessId)], { now: clock });
  await caller(b.app).data('auth.login', { identifier: '9999999999', password: 'correct-horse' });
  await syncUntilQuiet(b.app);
  const t2 = await caller(b.app).data<{ id: string }>('business.createTerminal', { branchId, code: 'T02', name: 'Till 2' });
  await caller(b.app).data('business.selectTerminal', { terminalId: t2.id });
  await syncUntilQuiet(b.app);
  return { a, b, businessId };
}

const settle = async (...apps: App[]) => { for (const app of [...apps, ...apps]) await syncUntilQuiet(app); };
const year = (app: App) => app.yearEnd.list().find((y) => y.fy === FY)!;

describe('year-end close over sync (8d, ADR-0045)', () => {
  it('a close waits for the cloud, reaches the other device, and a second close of the year from it is refused and dropped', async () => {
    let clock = at('2026-03-10');
    const cloud = referenceCloud();
    const { a, b, businessId } = await twoDevices(cloud, () => clock);
    clock = at('2026-04-05');
    readyToClose(a.app);
    await settle(a.app, b.app);
    expect(year(b.app)).toMatchObject({ status: 'open', blockers: [] });

    expect(a.app.yearEnd.close(FY)).toMatchObject({ status: 'requested', pending: true, closings: [] });
    expect(b.app.yearEnd.close(FY)).toMatchObject({ status: 'requested' });
    expect(a.db.prepare("SELECT COUNT(*) FROM journal_entry WHERE source = 'closing'").pluck().get()).toBe(0);
    await syncUntilQuiet(a.app);
    expect(year(a.app)).toMatchObject({ status: 'closed', pending: false, closings: [{ entryNo: 'CL/2526' }] });
    await settle(b.app, a.app);

    expect(cloud.deadLetters(businessId)).toEqual([expect.objectContaining({ entityType: 'fy_close', error: expect.objectContaining({ code: 'INVALID_STATE' }) })]);
    expect(year(b.app)).toMatchObject({ status: 'closed', closeId: year(a.app).closeId, syncError: null });
    expect(b.db.prepare("SELECT status FROM fy_close WHERE business_id = ? ORDER BY status").pluck().all(businessId)).toEqual(['closed', 'superseded']);
    expect(b.db.prepare("SELECT COUNT(*) FROM conflict_log WHERE kind = 'fy_close_superseded'").pluck().get()).toBe(1);
    expect(b.db.prepare("SELECT status FROM sync_outbox WHERE entity_type = 'fy_close'").pluck().all()).toEqual(['superseded']);
    expect(closes(b.db, businessId)).toEqual(closes(a.db, businessId));
    expect(books(b.db, businessId)).toEqual(books(a.db, businessId));
    for (const db of [a.db, b.db]) {
      expect(fyBalances(db, businessId, FY)).toEqual([]);
      expect(healthy(db, businessId)).toEqual(HEALTHY);
    }
    expect(b.app.statements.balanceSheet({})).toEqual(a.app.statements.balanceSheet({}));
  }, 120_000);

  it('a document from a device that had not heard of the close is re-closed by an adjustment; a concurrent adjustment is refused', async () => {
    let clock = at('2026-03-10');
    const cloud = referenceCloud();
    const { a, b, businessId } = await twoDevices(cloud, () => clock);
    clock = at('2026-04-05');
    readyToClose(a.app);
    a.app.yearEnd.close(FY);
    await syncUntilQuiet(a.app);
    const profit = year(a.app).profitPaise;

    // B is still offline: March is open there, so its expense keeps its March date and arrives after the close.
    b.app.expenses.create(ExpenseInput.parse({ categoryId: b.app.expenses.categories()[0]!.id, method: 'cash', amountPaise: 9_000, expenseDate: '2026-03-20', commandId: newUlid() }));
    await settle(b.app, a.app);
    for (const app of [a.app, b.app]) expect(year(app)).toMatchObject({ status: 'closed', needsReclose: true, residuePaise: -9_000, profitPaise: profit - 9_000 });
    expect(a.db.prepare("SELECT COUNT(*) FROM conflict_log WHERE kind = 'late_arrival'").pluck().get()).toBeGreaterThan(0);

    a.app.yearEnd.reclose(FY);
    b.app.yearEnd.reclose(FY);
    await syncUntilQuiet(a.app);
    await settle(b.app, a.app);
    expect(cloud.deadLetters(businessId)).toEqual([expect.objectContaining({ entityType: 'fy_close', error: expect.objectContaining({ code: 'INVALID_STATE' }) })]);
    for (const app of [a.app, b.app]) {
      expect(year(app)).toMatchObject({ needsReclose: false, pending: false, closings: [{ entryNo: 'CL/2526' }, { entryNo: 'CL/2526/2', profitPaise: -9_000 }] });
    }
    expect(closes(b.db, businessId)).toEqual(closes(a.db, businessId));
    expect(books(b.db, businessId)).toEqual(books(a.db, businessId));
    expect(b.app.statements.balanceSheet({})).toMatchObject({ balanced: true, retainedEarningsPaise: profit - 9_000 });
    for (const db of [a.db, b.db]) expect(healthy(db, businessId)).toEqual(HEALTHY);
  }, 120_000);

  it('a device added after the close hydrates to the same closed year and the same Trial Balance', async () => {
    let clock = at('2026-03-10');
    const cloud = referenceCloud();
    const a = await syncedDevice(cloud, DEVICE_A, () => [], { now: () => clock });
    const { businessId } = await ownerAtTill(a.app, { gstin: '07AAAAA0000A1Z5' });
    await trade(a.app);
    clock = at('2026-04-05');
    readyToClose(a.app);
    a.app.yearEnd.close(FY);
    await syncUntilQuiet(a.app);
    const c = await syncedDevice(cloud, DEVICE_B, () => [ownerMembership(businessId)], { now: () => clock, coldStart: 'hydrate', bundleFetcher: bundleDownloader(cloud) });
    await caller(c.app).data('auth.login', { identifier: '9999999999', password: 'correct-horse' });
    expect((await hydrate(c.app, businessId)).status).toBe('ready');
    expect(closes(c.db, businessId)).toEqual(closes(a.db, businessId));
    expect(books(c.db, businessId)).toEqual(books(a.db, businessId));
    expect(c.app.statements.trialBalance({})).toEqual(a.app.statements.trialBalance({}));
    expect(year(c.app)).toMatchObject({ status: 'closed', needsReclose: false });
    expect(healthy(c.db, businessId)).toEqual(HEALTHY);
  }, 120_000);
});
