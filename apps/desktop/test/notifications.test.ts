import { beforeEach, describe, expect, it } from 'vitest';
import { newUlid } from '@muneem/domain';
import { AUDIT_CHECK_KEY, insertBackupLog, markReviewed, setMeta, type Db } from '@muneem/db-sqlite';
import { CreatePurchaseInput, PaymentInput, PurchaseDraft, type Notification, type NotificationCounts, type NotificationPage } from '@muneem/contracts';
import type { App } from '../src/main/app.js';
import { NotificationRunner } from '../src/main/notifications/runner.js';
import type { Detector } from '../src/main/notifications/detectors.js';
import type { NotificationService } from '../src/main/notifications/notificationService.js';
import { caller, grantRole, ownerAtTill, testApp } from './helpers.js';

const DAY = 86_400_000;
let clock: number;
let app: App;
let db: Db;
let api: ReturnType<typeof caller>;
let businessId: string;
let pcs: string;
let announced: { kind: string; severity: string }[];

beforeEach(async () => {
  clock = Date.now();
  ({ app, db } = await testApp({ now: () => clock }));
  api = caller(app);
  businessId = (await ownerAtTill(app)).businessId;
  pcs = (await api.data<{ id: string; code: string }[]>('catalog.listUoms')).find((u) => u.code === 'PCS')!.id;
  announced = [];
  app.events.attach({ send: (ch, p) => { if (ch === 'notification.new') announced.push(p as { kind: string; severity: string }); } });
});

const run = () => app.notifications.runner.run();
const open = async (kind?: string) => (await api.data<NotificationPage>('notifications.list', { status: 'open', limit: 200 })).items.filter((n) => !kind || n.kind === kind);
const rows = (kind: string) => db.prepare('SELECT entity_id, severity, resolved_at FROM notification WHERE kind = ? ORDER BY created_at').all(kind) as { entity_id: string; severity: string; resolved_at: string | null }[];
const today = () => new Date(clock).toLocaleDateString('en-CA');
const daysAgo = (n: number) => new Date(clock - n * DAY).toLocaleDateString('en-CA');

describe('low stock (FR-074)', () => {
  it('raises once per product at or below its reorder level, escalates when it runs out, and resolves when restocked', async () => {
    const soap = (await api.data<{ id: string }>('products.create', { name: 'Soap', baseUomId: pcs, sellingPricePaise: 10_000, reorderLevelMilli: 5_000 })).id;
    await api.data('products.create', { name: 'Comb', baseUomId: pcs, sellingPricePaise: 5_000, reorderLevelMilli: 1_000 });
    app.inventory.setOpeningStock({ lines: [{ productId: soap, qtyMilli: 3_000, unitCostPaise: 5_000 }] });
    run();
    run();
    expect(await open('low_stock')).toHaveLength(2);
    expect(rows('low_stock').find((r) => r.entity_id === soap)).toMatchObject({ severity: 'info', resolved_at: null });
    expect(announced.filter((a) => a.kind === 'low_stock')).toHaveLength(2);

    app.inventory.adjust({ lines: [{ productId: soap, qtyMilli: -3_000, reason: 'damage' }] });
    run();
    const soapNote = (await open('low_stock')).find((n) => n.entityId === soap)!;
    expect(soapNote).toMatchObject({ severity: 'warning', title: 'Out of stock: Soap', link: `/inventory/product/${soap}` });
    expect(announced.filter((a) => a.kind === 'low_stock')).toHaveLength(3);

    app.inventory.adjust({ lines: [{ productId: soap, qtyMilli: 10_000, reason: 'counting_error' }] });
    run();
    expect((await open('low_stock')).map((n) => n.entityId)).not.toContain(soap);
    expect(rows('low_stock').filter((r) => r.entity_id === soap)).toEqual([expect.objectContaining({ resolved_at: expect.any(String) })]);
  });
});

describe('dues (FR-040, FR-074)', () => {
  it('raises a customer past the due date, not one due today, and resolves when paid', async () => {
    const ravi = app.customers.create({ name: 'Ravi' });
    const asha = app.customers.create({ name: 'Asha' });
    app.customerLedger.setOpening({ partyId: ravi.id, amountPaise: 120_000, asOfDate: daysAgo(40) });
    app.customerLedger.setOpening({ partyId: asha.id, amountPaise: 50_000, asOfDate: today() });
    run();
    expect(await open('customer_overdue')).toEqual([expect.objectContaining({
      entityId: ravi.id, severity: 'warning', title: 'Ravi is overdue', link: `/parties/customer/${ravi.id}`, body: expect.stringContaining('₹1,200.00 overdue on 1 bill'),
    })]);
    app.payments.create(PaymentInput.parse({ partyType: 'customer', partyId: ravi.id, amountPaise: 120_000, method: 'cash', commandId: newUlid() }));
    run();
    expect(await open('customer_overdue')).toEqual([]);
    expect(rows('customer_overdue')).toEqual([expect.objectContaining({ entity_id: ravi.id, resolved_at: expect.any(String) })]);
  });

  it('raises suppliers to pay within a week, overdue ones as warnings, and leaves later ones alone', async () => {
    const mills = app.suppliers.create({ name: 'Pune Mills', stateCode: '07', taxScheme: 'unregistered', creditDays: 5 });
    const later = app.suppliers.create({ name: 'Later Ltd', stateCode: '07', taxScheme: 'unregistered', creditDays: 30 });
    const old = app.suppliers.create({ name: 'Old Traders', stateCode: '07', taxScheme: 'unregistered', creditDays: 0 });
    const soap = (await api.data<{ id: string }>('products.create', { name: 'Soap', baseUomId: pcs, sellingPricePaise: 10_000 })).id;
    for (const s of [mills, later]) {
      const draft = PurchaseDraft.parse({ supplierId: s.id, supplierInvoiceNo: `P-${s.name}`, supplierInvoiceDate: today(), lines: [{ productId: soap, uomId: pcs, qtyMilli: 2_000, unitPricePaise: 5_000 }] });
      app.purchases.create(CreatePurchaseInput.parse({ ...draft, billTotalPaise: app.purchases.quote(draft).totals.totalPaise, commandId: newUlid() }));
    }
    app.supplierLedger.setOpening({ partyId: old.id, amountPaise: 30_000, asOfDate: daysAgo(10) });
    run();
    const due = await open('supplier_due');
    expect(due.map((n) => [n.entityId, n.severity])).toEqual(expect.arrayContaining([[mills.id, 'info'], [old.id, 'warning']]));
    expect(due).toHaveLength(2);
    expect(due.find((n) => n.entityId === old.id)!.title).toBe('Payment to Old Traders is overdue');
  });
});

describe('device health', () => {
  it('raises dead operations as sync blocked and resolves once they are resent', async () => {
    db.prepare("UPDATE sync_outbox SET status = 'dead' WHERE seq = (SELECT MIN(seq) FROM sync_outbox)").run();
    run();
    expect(await open('sync_blocked')).toEqual([expect.objectContaining({ severity: 'critical', title: '1 change could not sync', entityId: 'dead' })]);
    db.prepare("UPDATE sync_outbox SET status = 'pending' WHERE status = 'dead'").run();
    run();
    expect(await open('sync_blocked')).toEqual([]);
  });

  it('follows the sync status event without waiting for the timer', async () => {
    db.prepare("UPDATE sync_outbox SET status = 'dead' WHERE seq = (SELECT MIN(seq) FROM sync_outbox)").run();
    app.events.emit('sync.status', app.syncStatus());
    expect(await open('sync_blocked')).toHaveLength(1);
  });

  it('raises a broken audit chain and resolves it after a clean check', async () => {
    setMeta(db, AUDIT_CHECK_KEY, JSON.stringify({ ok: false, chains: [] }));
    run();
    expect(await open('audit_chain_broken')).toEqual([expect.objectContaining({ severity: 'critical', link: '/diagnostics' })]);
    setMeta(db, AUDIT_CHECK_KEY, JSON.stringify({ ok: true, chains: [] }));
    run();
    expect(await open('audit_chain_broken')).toEqual([]);
  });

  it('raises a failed backup, a failing upload and a stale one, and resolves them as backups succeed', async () => {
    const at = (h: number) => new Date(clock - h * 3_600_000).toISOString();
    insertBackupLog(db, { id: 'B1', path: '/b1', bytes: 1, verified: true, kind: 'scheduled', createdAt: at(30) });
    insertBackupLog(db, { id: 'B2', path: '/b2', bytes: 0, verified: false, kind: 'scheduled', createdAt: at(1), error: 'disk full' });
    db.prepare("UPDATE backup_log SET cloud_status = 'failed', cloud_error = 'offline for 3 days' WHERE id = 'B1'").run();
    run();
    expect((await open()).filter((n) => n.kind.startsWith('backup')).map((n) => [n.kind, n.entityId, n.severity]).sort()).toEqual([
      ['backup_failed', 'local', 'critical'], ['backup_failed', 'upload', 'warning'], ['backup_stale', 'local', 'warning'],
    ]);
    insertBackupLog(db, { id: 'B3', path: '/b3', bytes: 1, verified: true, kind: 'scheduled', createdAt: at(0) });
    db.prepare("UPDATE backup_log SET cloud_status = 'uploaded', cloud_error = NULL").run();
    run();
    expect((await open()).filter((n) => n.kind.startsWith('backup'))).toEqual([]);
  });

  it('says no backup was ever taken once the business is a day old', async () => {
    run();
    expect(await open('backup_stale')).toEqual([]);
    clock += 26 * 3_600_000 + 60_000;
    run();
    expect(await open('backup_stale')).toEqual([expect.objectContaining({ title: 'No backup has been taken yet' })]);
  });

  it('counts review items, a late arrival making it a warning, and resolves when all are reviewed', async () => {
    const insert = db.prepare(`INSERT INTO conflict_log (id, business_id, kind, entity_type, entity_id, device_id, rule, winner, occurred_at, received_at)
      VALUES (?, ?, ?, 'sale', 'S1', 'D', 'r', 'cloud', ?, ?)`);
    insert.run('R1', businessId, 'field_conflict', new Date(clock).toISOString(), new Date(clock).toISOString());
    run();
    expect(await open('review_items')).toEqual([expect.objectContaining({ severity: 'info', title: '1 item to review', link: '/settings/review' })]);
    insert.run('R2', businessId, 'late_arrival', new Date(clock).toISOString(), new Date(clock).toISOString());
    run();
    expect(await open('review_items')).toEqual([expect.objectContaining({ severity: 'warning', title: '2 items to review' })]);
    markReviewed(db, businessId, ['R1', 'R2'], 'u');
    run();
    expect(await open('review_items')).toEqual([]);
  });
});

describe('the update hook and the IPC', () => {
  const notifyUpdates = (n: number) => {
    for (let i = 0; i < n; i++) {
      clock += 1000;
      app.notifications.service.notify('update_ready', { severity: 'info', entityType: 'release', entityId: `1.${i}.0`, title: `Muneem 1.${i}.0 is ready`, body: 'Restart to install', link: null });
    }
  };

  it('raises through notify(), idempotently, and resolves through resolve()', async () => {
    notifyUpdates(1);
    app.notifications.service.notify('update_ready', { severity: 'info', entityType: 'release', entityId: '1.0.0', title: 'Muneem 1.0.0 is ready', body: 'Restart to install', link: null });
    expect(announced.filter((a) => a.kind === 'update_ready')).toHaveLength(1);
    expect(await open('update_ready')).toHaveLength(1);
    app.notifications.service.resolve('update_ready', 'release', '1.0.0');
    expect(await open('update_ready')).toEqual([]);
  });

  it('pages newest first without repeats, marks read and dismisses', async () => {
    notifyUpdates(5);
    const seen: Notification[] = [];
    let cursor: string | undefined;
    do {
      const page: NotificationPage = await api.data('notifications.list', { status: 'open', limit: 2, ...(cursor && { cursor }) });
      seen.push(...page.items);
      cursor = page.nextCursor ?? undefined;
    } while (cursor);
    expect(seen.map((n) => n.entityId)).toEqual(['1.4.0', '1.3.0', '1.2.0', '1.1.0', '1.0.0']);
    expect(await api.data<NotificationCounts>('notifications.counts')).toEqual({ open: 5, unread: 5, bySeverity: { info: 5, warning: 0, critical: 0 } });
    expect(await api.data('notifications.markRead', { ids: [seen[0]!.id] })).toEqual({ changed: 1 });
    expect(await api.data('notifications.markRead', { ids: [seen[0]!.id] })).toEqual({ changed: 0 });
    expect((await api.data<NotificationCounts>('notifications.counts')).unread).toBe(4);
    expect(await api.data('notifications.dismiss', {})).toEqual({ changed: 5 });
    expect(await open()).toEqual([]);
    expect((await api.data<NotificationPage>('notifications.list', { status: 'all' })).items).toHaveLength(5);
    expect(await api.data<NotificationCounts>('notifications.counts')).toMatchObject({ open: 0, unread: 0 });
  });

  it('shows each role only the kinds it may act on', async () => {
    const soap = (await api.data<{ id: string }>('products.create', { name: 'Soap', baseUomId: pcs, sellingPricePaise: 10_000, reorderLevelMilli: 5_000 })).id;
    const ravi = app.customers.create({ name: 'Ravi' });
    app.customerLedger.setOpening({ partyId: ravi.id, amountPaise: 1_000, asOfDate: daysAgo(3) });
    db.prepare("UPDATE sync_outbox SET status = 'dead' WHERE seq = (SELECT MIN(seq) FROM sync_outbox)").run();
    clock += 27 * 3_600_000;
    notifyUpdates(1);
    run();
    const kinds = async () => [...new Set((await open()).map((n) => n.kind))].sort();
    expect(await kinds()).toEqual(['backup_stale', 'customer_overdue', 'low_stock', 'sync_blocked', 'update_ready']);
    grantRole(db, app, 'cashier');
    expect(await kinds()).toEqual(['customer_overdue', 'sync_blocked', 'update_ready']);
    expect((await api.data<NotificationCounts>('notifications.counts')).open).toBe(3);
    const lowStockId = db.prepare("SELECT id FROM notification WHERE kind = 'low_stock'").pluck().get() as string;
    expect(await api.data('notifications.dismiss', { ids: [lowStockId] })).toEqual({ changed: 0 });
    grantRole(db, app, 'inventory');
    expect(await kinds()).toEqual(['low_stock', 'update_ready']);
    expect(soap).toBeTruthy();
  });

  it('needs a signed-in user', async () => {
    await api.data('auth.logout');
    expect(await api.call('notifications.counts')).toMatchObject({ ok: false, error: { code: expect.stringMatching(/AUTH|SESSION|PERMISSION/u) } });
  });
});

describe('the runner', () => {
  const service = (calls: string[]) => ({ reconcile: (kind: string) => { calls.push(kind); return true; } }) as unknown as NotificationService;
  const det = (kind: Detector['kind'], needsBusiness: boolean, fail = false): Detector => ({
    kind, needsBusiness, detect: () => { if (fail) throw new Error('boom'); return []; },
  });

  it('skips business checks without a business, keeps going past a failing one, and batches stock checks after commits', () => {
    const calls: string[] = [];
    const errors: string[] = [];
    const scheduled: (() => void)[] = [];
    let business = false;
    const runner = new NotificationRunner({
      service: service(calls), sources: {} as never, hasBusiness: () => business, log: (_e, k) => errors.push(k),
      schedule: (fn) => scheduled.push(fn), detectors: [det('low_stock', true), det('backup_failed', false, true), det('sync_blocked', false)],
    });
    runner.run();
    expect(calls).toEqual(['sync_blocked']);
    expect(errors).toEqual(['backup_failed']);
    business = true;
    runner.afterCommit('sales.complete');
    runner.afterCommit('sales.complete');
    runner.afterCommit('customers.update');
    expect(scheduled).toHaveLength(1);
    scheduled[0]!();
    expect(calls).toEqual(['sync_blocked', 'low_stock']);
    runner.afterCommit('inventory.adjust');
    expect(scheduled).toHaveLength(2);
  });
});
