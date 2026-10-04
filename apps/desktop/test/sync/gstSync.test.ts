import { describe, expect, it } from 'vitest';
import { newUlid } from '@muneem/domain';
import { gstMonthReturn, type Db } from '@muneem/db-sqlite';
import { CompleteSaleInput, CreatePurchaseInput, GstPaymentInput, PurchaseDraft, SaleDraft } from '@muneem/contracts';
import type { App } from '../../src/main/app.js';
import { caller, ownerAtTill } from '../helpers.js';
import { books, DEVICE_A, DEVICE_B, healthy, ownerMembership, referenceCloud, syncedDevice, syncUntilQuiet } from './syncHelpers.js';

const at = (day: string) => Date.parse(`${day}T06:30:00Z`);
const gst = (db: Db, businessId: string) => ({
  setoffs: db.prepare('SELECT * FROM gst_setoff WHERE business_id = ? ORDER BY id').all(businessId).map((r) => ({ ...(r as object), sync_state: null, device_id: null })),
  payments: db.prepare('SELECT * FROM gst_payment WHERE business_id = ? ORDER BY id').all(businessId).map((r) => ({ ...(r as object), sync_state: null, device_id: null })),
});
const HEALTHY = { tieOuts: [], replay: [], partyMismatches: [], allocationFaults: [] };

async function trade(app: App, month: string) {
  const api = caller(app);
  const pcs = (await api.data<{ id: string; code: string }[]>('catalog.listUoms')).find((u) => u.code === 'PCS')!.id;
  const soap = (await api.data<{ id: string }>('products.create', { name: `Soap ${month}`, baseUomId: pcs, hsnCode: '3401', gstRateBp: 1800, sellingPricePaise: 118_000 })).id;
  app.inventory.setOpeningStock({ lines: [{ productId: soap, qtyMilli: 100_000, unitCostPaise: 50_000 }] });
  const supplier = app.suppliers.create({ name: `Pune ${month}`, stateCode: '27', gstin: `27DDDDD00${month.slice(5, 7)}D1Z5`, taxScheme: 'regular', creditDays: 30 });
  const draft = PurchaseDraft.parse({ supplierId: supplier.id, supplierInvoiceNo: `P-${month}`, supplierInvoiceDate: `${month.slice(0, 8)}02`,
    lines: [{ productId: soap, uomId: pcs, qtyMilli: 5000, unitPricePaise: 60_000 }] });
  app.purchases.create(CreatePurchaseInput.parse({ ...draft, billTotalPaise: app.purchases.quote(draft).totals.totalPaise, commandId: newUlid() }));
  const sale = SaleDraft.parse({ lines: [{ productId: soap, uomId: pcs, qtyMilli: 10_000 }] });
  const total = app.sales.quote(sale).totals.totalPaise;
  app.sales.complete(CompleteSaleInput.parse({ ...sale, commandId: newUlid(), expectedTotalPaise: total, tenders: [{ method: 'cash', amountPaise: total }] }));
}

describe('GST set-off and payment sync (8c)', () => {
  it('a set-off and a challan on A reach B with the same books, and a month set off on both devices offline is kept and flagged', async () => {
    let clock = at('2026-05-10');
    const cloud = referenceCloud();
    const a = await syncedDevice(cloud, DEVICE_A, () => [], { now: () => clock });
    const { businessId, branchId } = await ownerAtTill(a.app, { gstin: '07AAAAA0000A1Z5' });
    await a.app.register.open(100_000);
    await trade(a.app, '2026-05-01');
    clock = at('2026-06-04');
    const setoff = a.app.gst.setoffs.post({ month: '2026-05-01', commandId: newUlid() });
    expect(setoff.cash.cgstPaise + setoff.cash.sgstPaise).toBeGreaterThan(0);
    a.app.gst.payments.record(GstPaymentInput.parse({ commandId: newUlid(), paymentDate: '2026-06-04', challanRef: 'CPIN1', month: '2026-05-01',
      cgstPaise: setoff.cash.cgstPaise, sgstPaise: setoff.cash.sgstPaise }));
    await syncUntilQuiet(a.app);
    expect(cloud.deadLetters(businessId)).toEqual([]);

    const b = await syncedDevice(cloud, DEVICE_B, () => [ownerMembership(businessId)], { now: () => clock });
    await caller(b.app).data('auth.login', { identifier: '9999999999', password: 'correct-horse' });
    await syncUntilQuiet(b.app);
    expect(gst(b.db, businessId)).toEqual(gst(a.db, businessId));
    expect(gst(b.db, businessId).payments).toHaveLength(1);
    expect(books(b.db, businessId)).toEqual(books(a.db, businessId));
    expect(healthy(b.db, businessId)).toEqual(HEALTHY);
    expect(gstMonthReturn(b.db, businessId, '2026-05-01', true).gstr3b).toEqual(gstMonthReturn(a.db, businessId, '2026-05-01', true).gstr3b);

    // June, set off on A and on B before either syncs: both stand on every device, and each lists the duplicate for review.
    await trade(a.app, '2026-06-01');
    await syncUntilQuiet(a.app);
    await syncUntilQuiet(b.app);
    const t2 = await caller(b.app).data<{ id: string }>('business.createTerminal', { branchId, code: 'T02', name: 'Till 2' });
    await caller(b.app).data('business.selectTerminal', { terminalId: t2.id });
    clock = at('2026-07-02');
    a.app.gst.setoffs.post({ month: '2026-06-01', commandId: newUlid() });
    b.app.gst.setoffs.post({ month: '2026-06-01', commandId: newUlid() });
    await syncUntilQuiet(a.app);
    await syncUntilQuiet(b.app);
    await syncUntilQuiet(a.app);
    expect(gst(a.db, businessId).setoffs).toHaveLength(3);
    expect(gst(b.db, businessId)).toEqual(gst(a.db, businessId));
    expect(books(b.db, businessId)).toEqual(books(a.db, businessId));
    for (const db of [a.db, b.db]) {
      expect(db.prepare("SELECT COUNT(*) FROM conflict_log WHERE kind = 'duplicate_setoff'").pluck().get()).toBe(1);
      expect(healthy(db, businessId)).toEqual(HEALTHY);
    }
  }, 120_000);
});
