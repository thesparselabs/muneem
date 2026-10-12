import { beforeEach, describe, expect, it } from 'vitest';
import { newUlid } from '@muneem/domain';
import { partyDues, type Db } from '@muneem/db-sqlite';
import type { DueReminders, ReminderPreview, ReminderRecord, SaleQuote } from '@muneem/contracts';
import type { App } from '../src/main/app.js';
import { caller, grantRole, ownerAtTill, testApp } from './helpers.js';

let app: App;
let db: Db;
let api: ReturnType<typeof caller>;
let clock: number;
let opened: string[];
let downloads: string[];
let meena: string;
let ravi: string;

const DAY = 86_400_000;
// Each call is rate limited per second against the test's clock.
const call = <T>(channel: string, input: unknown = {}) => { clock += 1000; return api.call<T>(channel, input); };
const due = async () => (await api.data<DueReminders>('reminders.due'));
const item = async (customerId: string) => (await due()).items.find((i) => i.customerId === customerId)!;

async function setup() {
  clock = Date.parse('2026-09-01T06:00:00.000Z');
  opened = [];
  downloads = [];
  ({ app, db } = await testApp({
    now: () => clock, documentPdf: async (html) => Buffer.from(`%PDF-1.7\n${html}`),
    saveDownload: async (fileName) => { downloads.push(fileName); return { saved: true, fileName }; }, openExternal: async (url) => { opened.push(url); },
  }));
  api = caller(app);
  await ownerAtTill(app);
  const pcs = (await api.data<{ id: string; code: string }[]>('catalog.listUoms')).find((u) => u.code === 'PCS')!.id;
  const rice = (await api.data<{ id: string }>('products.create', { name: 'Basmati Rice', baseUomId: pcs, gstRateBp: 500, sellingPricePaise: 12_000 })).id;
  meena = (await api.data<{ id: string }>('customers.create', { name: 'Meena Gupta', phone: '9876543210', creditDays: 7 })).id;
  ravi = (await api.data<{ id: string }>('customers.create', { name: 'Ravi Kumar', phone: '9123456780' })).id;
  await api.data('pos.openRegister', { openingCashPaise: 0 });
  for (const [customerId, qty] of [[meena, 10_000], [ravi, 5000]] as const) {
    const draft = { customerId, lines: [{ productId: rice, uomId: pcs, qtyMilli: qty }] };
    const q = await api.data<SaleQuote>('sales.quote', draft);
    clock += 1000;
    await api.data('sales.complete', { ...draft, commandId: newUlid(), expectedTotalPaise: q.totals.totalPaise, tenders: [{ method: 'credit', amountPaise: q.totals.totalPaise }] });
  }
  clock = Date.parse('2026-09-21T06:00:00.000Z');
}

const consent = (customerId: string) => call('customers.setConsent', { customerId, purpose: 'payment_reminders', channel: 'whatsapp', method: 'in_person' });
const send = async (customerId: string) => {
  const p = await api.data<ReminderPreview>('reminders.preview', { customerId });
  return call<ReminderRecord>('reminders.send', { customerId, to: p.to, message: p.message });
};

describe('payment reminders (FR-088)', () => {
  beforeEach(setup);

  it('lists who is past due exactly as the ageing does, and needs WhatsApp consent before any reminder', async () => {
    const list = await due();
    const ageing = partyDues(db, app.session.require().businessId!, 'customer', '2026-09-21');
    expect(list.everyDays).toBe(7);
    expect(list.items.map((i) => [i.customerId, i.overduePaise, i.oldestDueDate, i.documents])).toEqual(ageing.map((d) => [d.partyId, d.duePaise, d.oldestDueDate, d.documents]));
    expect(await item(meena)).toMatchObject({ name: 'Meena Gupta', phone: '9876543210', oldestDueDate: '2026-09-08', daysOverdue: 13, state: 'no_consent' });
    expect((await item(ravi)).daysOverdue).toBe(20);
    expect((await item(meena)).balancePaise).toBe((await item(meena)).overduePaise);
    expect(await send(meena)).toMatchObject({ ok: false, error: { code: 'INVALID_STATE', message: expect.stringMatching(/has not agreed to payment reminders on WhatsApp/u) } });
    await consent(meena);
    expect((await item(meena)).state).toBe('due');
    expect((await item(ravi)).state).toBe('no_consent');
  });

  it('opens WhatsApp with the reminder and the statement, logs it, and waits a cadence before the next', async () => {
    await consent(meena);
    const p = await api.data<ReminderPreview>('reminders.preview', { customerId: meena });
    expect(p.to).toBe('9876543210');
    expect(p.message).toBe('Dear Meena Gupta, a gentle reminder from Sharma Store: ₹1,200.00 on your account has been due since 08 Sep 2026. '
      + 'Your balance is ₹1,200.00; your statement is attached. Please pay at your earliest convenience. Thank you!');
    const r = await send(meena);
    expect(r).toMatchObject({ ok: true, data: { customerId: meena, customerName: 'Meena Gupta', channel: 'whatsapp', to: '+919876543210', overduePaise: 120_000, oldestDueDate: '2026-09-08' } });
    expect(opened).toEqual([`https://wa.me/919876543210?text=${encodeURIComponent(p.message)}`]);
    expect(downloads).toEqual([p.fileName]);
    const record = (r as { data: ReminderRecord }).data;
    expect(db.prepare('SELECT doc_type, doc_id, status FROM share_log WHERE id = ?').get(record.shareId)).toEqual({ doc_type: 'customer_statement', doc_id: meena, status: 'opened' });

    expect(await item(meena)).toMatchObject({ state: 'reminded_recently', nextOn: '2026-09-28', lastRemindedAt: record.createdAt });
    expect(await send(meena)).toMatchObject({ ok: false, error: { code: 'INVALID_STATE', message: 'Meena Gupta was reminded on 21 Sep 2026; the next reminder can go on 28 Sep 2026' } });
    clock += 7 * DAY;
    expect((await item(meena)).state).toBe('due');
    expect((await send(meena)).ok).toBe(true);
    expect((await api.data<ReminderRecord[]>('reminders.history', { customerId: meena })).map((h) => h.createdAt)).toEqual([
      new Date(clock).toISOString(), record.createdAt,
    ]);
    expect((await api.data<ReminderRecord[]>('reminders.history', {})).every((h) => h.customerId === meena)).toBe(true);
  });

  it('holds reminders for a cadence after the customer pays, and drops them once nothing is overdue', async () => {
    await consent(meena);
    await consent(ravi);
    await call('payments.create', { partyType: 'customer', partyId: meena, amountPaise: 50_000, method: 'cash', commandId: newUlid() });
    expect(await item(meena)).toMatchObject({ state: 'paid_recently', lastPaidOn: '2026-09-21', nextOn: '2026-09-28', overduePaise: 70_000 });
    expect(await send(meena)).toMatchObject({ ok: false, error: { message: 'Meena Gupta paid on 21 Sep 2026; the next reminder can go on 28 Sep 2026' } });
    await call('settings.set', { key: 'reminders.everyDays', value: 3 });
    expect(await item(meena)).toMatchObject({ state: 'paid_recently', nextOn: '2026-09-24' });
    clock += 3 * DAY;
    expect((await item(meena)).state).toBe('due');
    await call('payments.create', { partyType: 'customer', partyId: ravi, amountPaise: (await item(ravi)).overduePaise, method: 'upi', commandId: newUlid() });
    expect((await due()).items.map((i) => i.customerId)).toEqual([meena]);
    expect(await call('reminders.send', { customerId: ravi, to: '9123456780', message: 'Please pay' }))
      .toMatchObject({ ok: false, error: { code: 'INVALID_STATE', message: 'Nothing is overdue on this customer\'s account' } });
  });

  it('lets a cashier see who is due but not send; roles without customers see nothing', async () => {
    await consent(meena);
    grantRole(db, app, 'cashier');
    expect((await due()).items).toHaveLength(2);
    expect(await call('reminders.send', { customerId: meena, to: '9876543210', message: 'Please pay' })).toMatchObject({ ok: false, error: { code: 'PERMISSION_DENIED' } });
    grantRole(db, app, 'inventory');
    expect(await call('reminders.due')).toMatchObject({ ok: false, error: { code: 'PERMISSION_DENIED' } });
    expect(opened).toEqual([]);
  });
});
