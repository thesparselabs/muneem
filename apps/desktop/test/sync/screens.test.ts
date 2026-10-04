import { afterEach, describe, expect, it, vi } from 'vitest';
import { newUlid } from '@muneem/domain';
import { CompleteSaleInput, ProductInput, SaleDraft, type FailedOperation, type ReconciliationRow, type ReviewItem, type SyncOverview, type SyncStatus } from '@muneem/contracts';
import type { App } from '../../src/main/app.js';
import { caller, grantRole, ownerAtTill, testApp } from '../helpers.js';
import { DEVICE_A, DEVICE_B, ownerMembership, referenceCloud, syncedDevice, syncUntilQuiet } from './syncHelpers.js';

const sell = (app: App, productId: string, uomId: string, qtyMilli: number) => {
  const draft = SaleDraft.parse({ lines: [{ productId, uomId, qtyMilli }] });
  const total = app.sales.quote(draft).totals.totalPaise;
  return app.sales.complete(CompleteSaleInput.parse({ ...draft, commandId: newUlid(), expectedTotalPaise: total, tenders: [{ method: 'cash', amountPaise: total }] }));
};

describe('sync screens (7g)', () => {
  afterEach(() => { vi.useRealTimers(); });

  it('reports outbox counts and cursors, lists failed and dead operations, and a manager resends them', async () => {
    const { app, db } = await testApp();
    const { businessId } = await ownerAtTill(app);
    const { data, call } = caller(app);
    const ops = db.prepare('SELECT operation_id FROM sync_outbox ORDER BY seq').pluck().all() as string[];
    db.prepare("UPDATE sync_outbox SET status = 'failed', attempt_count = 3, error_code = 'TOTAL_MISMATCH', error_class = 'permanent', error_message = 'total off' WHERE operation_id = ?").run(ops[0]);
    db.prepare("UPDATE sync_outbox SET status = 'dead', attempt_count = 12, error_code = 'PAYLOAD_INVALID', error_class = 'permanent' WHERE operation_id = ?").run(ops[1]);
    db.prepare("INSERT INTO sync_cursor (business_id, stream, last_seq, last_pulled_at) VALUES (?, 'documents', 42, '2026-10-04T10:00:00.000Z')").run(businessId);

    const overview = await data<SyncOverview>('sync.getOverview');
    expect(overview.counts).toMatchObject({ failed: 1, dead: 1, pending: ops.length - 2, sent: 0 });
    expect(overview.cursors).toEqual([{ stream: 'documents', lastSeq: 42, lastPulledAt: '2026-10-04T10:00:00.000Z' }]);
    expect(overview.oldestPendingAt).not.toBeNull();

    const failed = await data<FailedOperation[]>('sync.listFailed', {});
    expect(failed.map((f) => [f.operationId, f.status, f.errorCode])).toEqual([[ops[1], 'dead', 'PAYLOAD_INVALID'], [ops[0], 'failed', 'TOTAL_MISMATCH']]);
    expect(JSON.parse(failed[0]!.payloadJson)).toBeTypeOf('object');

    const status = await data<SyncStatus>('sync.getStatus');
    expect(status).toMatchObject({ state: 'blocked', deviceStatus: null, terminalCount: 1, documentsPulledAt: '2026-10-04T10:00:00.000Z' });

    grantRole(db, app, 'cashier');
    expect((await call('sync.resend', { operationIds: [ops[0]] })).ok).toBe(false);
    grantRole(db, app, 'manager');
    expect(await data('sync.resend', { operationIds: [ops[0], ops[1], ops[2]] })).toEqual({ resent: 2 });
    expect(db.prepare('SELECT status, attempt_count FROM sync_outbox WHERE operation_id IN (?, ?)').all(ops[0], ops[1])).toEqual([
      { status: 'pending', attempt_count: 0 }, { status: 'pending', attempt_count: 0 },
    ]);
    expect(db.prepare("SELECT COUNT(*) FROM audit_log WHERE action = 'ipc.sync.resend'").pluck().get()).toBe(1);
  });

  it('lists review items with both versions and marks them reviewed', async () => {
    const { app, db } = await testApp();
    const { businessId } = await ownerAtTill(app);
    const pcs = app.catalog.listUoms().find((u) => u.code === 'PCS')!.id;
    const soap = app.products.create(ProductInput.parse({ name: 'Soap', baseUomId: pcs, gstRateBp: 1800, sellingPricePaise: 4500 }));
    const insert = db.prepare(`INSERT INTO conflict_log (id, business_id, kind, entity_type, entity_id, device_id, rule, winner, field, cloud_value_json, device_value_json, occurred_at, received_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    insert.run('R1', businessId, 'field_conflict', 'product', soap.id, DEVICE_B, 'cloud_wins', 'cloud', 'sellingPricePaise', '5000', '4000', '2026-10-04T10:00:00Z', '2026-10-04T10:01:00Z');
    insert.run('R2', businessId, 'late_arrival', 'sale', 'S1', DEVICE_B, 'period_locked', 'cloud', null, null, null, '2026-10-04T09:00:00Z', '2026-10-04T10:01:00Z');
    const { data } = caller(app);

    const open = await data<ReviewItem[]>('sync.listReviewItems', {});
    expect(open.map((r) => [r.id, r.entityLabel, r.cloudValueJson, r.deviceValueJson])).toEqual([['R1', 'Soap', '5000', '4000'], ['R2', null, null, null]]);
    expect(await data('sync.markReviewed', { ids: ['R1'] })).toEqual({ reviewed: 1 });
    expect((await data<ReviewItem[]>('sync.listReviewItems', {})).map((r) => r.id)).toEqual(['R2']);
    const reviewed = await data<ReviewItem[]>('sync.listReviewItems', { status: 'reviewed' });
    expect(reviewed[0]).toMatchObject({ id: 'R1', reviewedBy: app.session.require().user.id });
    expect((await data<SyncOverview>('sync.getOverview')).openReviewItems).toBe(1);
  });

  it('stock reconciliation names the other terminal whose synced sale took the last unit below zero', async () => {
    const cloud = referenceCloud();
    const a = await syncedDevice(cloud, DEVICE_A);
    const { businessId, branchId } = await ownerAtTill(a.app);
    await caller(a.app).data('printer.setConfig', { kind: 'none' });
    const pcs = a.app.catalog.listUoms().find((u) => u.code === 'PCS')!.id;
    const soap = a.app.products.create(ProductInput.parse({ name: 'Soap', baseUomId: pcs, gstRateBp: 1800, sellingPricePaise: 4500 }));
    a.app.inventory.setOpeningStock({ lines: [{ productId: soap.id, qtyMilli: 1000, unitCostPaise: 3000 }] });
    await syncUntilQuiet(a.app);

    const b = await syncedDevice(cloud, DEVICE_B, () => [ownerMembership(businessId)]);
    const bCall = caller(b.app);
    await bCall.data('auth.login', { identifier: '9999999999', password: 'correct-horse' });
    await syncUntilQuiet(b.app);
    const t2 = await bCall.data<{ id: string }>('business.createTerminal', { branchId, code: 'T02', name: 'Till 2' });
    await bCall.data('business.selectTerminal', { terminalId: t2.id });
    await bCall.data('printer.setConfig', { kind: 'none' });

    await a.app.register.open(10_000);
    await b.app.register.open(10_000);
    vi.useFakeTimers({ toFake: ['Date'], now: Date.now() });
    sell(a.app, soap.id, pcs, 1000);
    vi.setSystemTime(Date.now() + 60_000);
    const bSale = sell(b.app, soap.id, pcs, 1000);
    vi.useRealTimers();
    await syncUntilQuiet(b.app);
    await syncUntilQuiet(a.app);

    const rows = await caller(a.app).data<ReconciliationRow[]>('inventory.stockReconciliation', {});
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ productName: 'Soap', refId: bSale.saleId, terminalCode: 'T02', viaSync: true, qtyMilli: -1000, balanceAfterMilli: -1000, currentQtyMilli: -1000 });
    expect((await caller(a.app).data<SyncStatus>('sync.getStatus')).terminalCount).toBe(2);
  }, 60_000);
});
