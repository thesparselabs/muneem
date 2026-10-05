import { beforeEach, describe, expect, it } from 'vitest';
import { newUlid } from '@muneem/domain';
import { reconcilePartiesDb, tieOutFailures, type Db } from '@muneem/db-sqlite';
import { CompleteSaleInput, PaymentInput, SaleDraft, payloadSchema, type Customer, type ReceiptDoc, type TenderLine } from '@muneem/contracts';
import type { App } from '../src/main/app.js';
import type { CustomerProfileExport } from '../src/main/services/parties/customerPrivacy.js';
import { caller, grantRole, ownerAtTill, testApp } from './helpers.js';

let app: App;
let db: Db;
let api: ReturnType<typeof caller>;
let businessId: string;
let pcs: string;
let soap: string;
let ravi: Customer;
let saved: { name: string; bytes: Buffer }[];

beforeEach(async () => {
  saved = [];
  ({ app, db } = await testApp({ saveFile: (name, bytes) => { saved.push({ name, bytes }); return Promise.resolve({ saved: true, fileName: `/tmp/${name}` }); } }));
  api = caller(app);
  businessId = (await ownerAtTill(app)).businessId;
  pcs = (await api.data<{ id: string; code: string }[]>('catalog.listUoms')).find((u) => u.code === 'PCS')!.id;
  soap = (await api.data<{ id: string }>('products.create', { name: 'Soap', baseUomId: pcs, sellingPricePaise: 10_000 })).id;
  ravi = await api.data<Customer>('customers.create', {
    name: 'Ravi Kumar', phone: '9876543210', email: 'ravi@example.in', gstin: '07BBBBB0000B1Z5', addressLine1: '12 Chandni Chowk', city: 'Delhi', pinCode: '110006', creditDays: 15,
  });
  ravi = app.customers.setCreditLimit({ id: ravi.id, version: ravi.version, limitPaise: 100_000 });
  await api.data('pos.openRegister', { openingCashPaise: 0 });
});

const sell = (qty: number, tenders: TenderLine[]) => {
  const d = SaleDraft.parse({ lines: [{ productId: soap, uomId: pcs, qtyMilli: qty * 1000 }], customerId: ravi.id });
  return app.sales.complete(CompleteSaleInput.parse({ ...d, commandId: newUlid(), expectedTotalPaise: app.sales.quote(d).totals.totalPaise, tenders }));
};
const lastCustomerOp = () => db.prepare("SELECT payload_json FROM sync_outbox WHERE entity_type = 'customer' AND entity_id = ? ORDER BY seq DESC LIMIT 1").pluck().get(ravi.id) as string;

describe('consent (FR-104)', () => {
  it('records consent per channel once, withdraws it, and sends the customer with its consents', async () => {
    const given = await api.data<Customer>('customers.setConsent', { customerId: ravi.id, channel: 'whatsapp', method: 'in_person' });
    expect(given.version).toBe(ravi.version + 1);
    expect(given.consents).toEqual([expect.objectContaining({ purpose: 'payment_reminders', channel: 'whatsapp', method: 'in_person', withdrawnAt: null, capturedBy: app.session.require().user.id })]);
    expect(app.customerPrivacy.setConsent({ customerId: ravi.id, purpose: 'payment_reminders', channel: 'whatsapp', method: 'phone' }).version).toBe(given.version);
    const payload = JSON.parse(lastCustomerOp()) as Record<string, unknown>;
    expect(payload.consents).toHaveLength(1);
    expect(payloadSchema('customer', 'update').safeParse(payload).success).toBe(true);

    const withdrawn = await api.data<Customer>('customers.withdrawConsent', { customerId: ravi.id, consentId: given.consents![0]!.id });
    expect(app.customerPrivacy.withdrawConsent({ customerId: ravi.id, consentId: given.consents![0]!.id }).version).toBe(withdrawn.version);
    expect(withdrawn.consents![0]!.withdrawnAt).toEqual(expect.any(String));
    const again = app.customerPrivacy.setConsent({ customerId: ravi.id, purpose: 'payment_reminders', channel: 'whatsapp', method: 'written' });
    expect(again.consents!.map((c) => c.withdrawnAt === null)).toEqual([false, true]);
    expect(db.prepare("SELECT action FROM audit_log WHERE entity_id = ? AND action LIKE 'customer.consent%' ORDER BY seq").pluck().all(ravi.id))
      .toEqual(['customer.consent_given', 'customer.consent_withdrawn', 'customer.consent_given']);
  });

  it('needs a phone number to message, and lets a cashier record and withdraw consent but not export or erase', async () => {
    const walkIn = app.customers.create({ name: 'No Phone' });
    expect(await api.call('customers.setConsent', { customerId: walkIn.id, channel: 'sms', method: 'in_person' })).toMatchObject({ ok: false, error: { code: 'VALIDATION_FAILED' } });
    grantRole(db, app, 'cashier');
    const c = await api.data<Customer>('customers.setConsent', { customerId: ravi.id, channel: 'sms', method: 'in_person' });
    expect(await api.call('customers.withdrawConsent', { customerId: ravi.id, consentId: c.consents![0]!.id })).toMatchObject({ ok: true });
    expect(await api.call('customers.exportProfile', { customerId: ravi.id })).toMatchObject({ ok: false, error: { code: 'PERMISSION_DENIED' } });
    expect(await api.call('customers.erase', { customerId: ravi.id, version: c.version, reason: 'asked to' })).toMatchObject({ ok: false, error: { code: 'PERMISSION_DENIED' } });
  });
});

describe('profile export (FR-104)', () => {
  it('saves the profile, its consents and every document made out to the customer, as JSON or CSV', async () => {
    await api.data('customers.setConsent', { customerId: ravi.id, channel: 'sms', method: 'in_person' });
    const cash = sell(1, [{ method: 'cash', amountPaise: 10_000 }]);
    const credit = sell(2, [{ method: 'credit', amountPaise: 20_000 }]);
    app.payments.create(PaymentInput.parse({ partyType: 'customer', partyId: ravi.id, amountPaise: 20_000, method: 'upi', commandId: newUlid() }));

    expect(await api.data('customers.exportProfile', { customerId: ravi.id })).toMatchObject({ saved: true, fileName: expect.stringMatching(/\.json$/u) });
    const json = JSON.parse(saved[0]!.bytes.toString('utf8')) as CustomerProfileExport;
    expect(json.customer).toMatchObject({ name: 'Ravi Kumar', phone: '9876543210', email: 'ravi@example.in', consents: [expect.objectContaining({ channel: 'sms' })] });
    expect(json.business.name).toBe('Sharma Store');
    expect(json.documents.map((d) => [d.type, d.id])).toEqual(expect.arrayContaining([['sale', cash.saleId], ['sale', credit.saleId], ['payment', expect.any(String)]]));
    expect(json.documents).toHaveLength(3);

    const r = await app.customerPrivacy.exportProfile({ customerId: ravi.id, format: 'csv' });
    const csv = saved[1]!.bytes.toString('utf8');
    expect(r.bytes).toBe(saved[1]!.bytes.length);
    expect(csv.split('\r\n')[0]).toBe('﻿section,item,date,reference,amount_paise,detail');
    expect(csv).toContain('profile,phone,,,,9876543210');
    expect(csv).toMatch(/consent,payment_reminders\/sms,/u);
    expect(csv.match(/^document,sale,/gmu)).toHaveLength(2);
  });
});

describe('erasure (FR-104)', () => {
  it('is refused while the customer owes or is owed anything', async () => {
    sell(2, [{ method: 'credit', amountPaise: 20_000 }]);
    expect(await api.call('customers.erase', { customerId: ravi.id, version: ravi.version, reason: 'customer asked' }))
      .toMatchObject({ ok: false, error: { code: 'INVALID_STATE', message: expect.stringContaining('balance') } });
  });

  it('blanks the profile and withdraws consent but keeps invoices, receipts and the books intact', async () => {
    await api.data('customers.setConsent', { customerId: ravi.id, channel: 'sms', method: 'in_person' });
    const sale = sell(2, [{ method: 'credit', amountPaise: 20_000 }]);
    app.payments.create(PaymentInput.parse({ partyType: 'customer', partyId: ravi.id, amountPaise: 20_000, method: 'cash', commandId: newUlid() }));
    const before = app.customers.get(ravi.id);
    const snapshot = db.prepare('SELECT customer_snapshot_json FROM sale WHERE id = ?').pluck().get(sale.saleId);

    const erased = await api.data<Customer>('customers.erase', { customerId: ravi.id, version: before.version, reason: 'customer asked' });
    expect(erased).toMatchObject({ name: `Erased customer ${ravi.id.slice(-6)}`, erasedAt: expect.any(String), stateCode: '07', version: before.version + 1 });
    for (const k of ['phone', 'email', 'gstin', 'addressLine1', 'city', 'pinCode'] as const) expect(erased[k]).toBeUndefined();
    expect(erased.creditLimitPaise).toBeNull();
    expect(erased.consents!.every((c) => c.withdrawnAt !== null)).toBe(true);

    expect(db.prepare('SELECT customer_snapshot_json FROM sale WHERE id = ?').pluck().get(sale.saleId)).toBe(snapshot);
    expect(JSON.parse(snapshot as string)).toMatchObject({ name: 'Ravi Kumar', gstin: '07BBBBB0000B1Z5' });
    expect((app.sales.receipt(sale.saleId) as ReceiptDoc).customer).toMatchObject({ name: 'Ravi Kumar' });
    expect(tieOutFailures(db, businessId)).toEqual([]);
    expect(reconcilePartiesDb(db, businessId)).toEqual({ mismatches: [], faults: [] });
    expect(app.customerLedger.ledger({ partyId: ravi.id, limit: 100 }).items).toHaveLength(2);

    const audit = db.prepare("SELECT before_json, after_json FROM audit_log WHERE action = 'customer.erase'").get() as { before_json: string; after_json: string };
    expect(JSON.parse(audit.before_json)).toEqual({ reason: 'customer asked' });
    expect(audit.after_json).not.toContain('9876543210');
    expect(JSON.parse(lastCustomerOp())).toMatchObject({ erasedAt: erased.erasedAt, name: erased.name });

    expect(await api.call('customers.update', { id: ravi.id, version: erased.version, name: 'Ravi again' })).toMatchObject({ ok: false, error: { code: 'INVALID_STATE' } });
    expect(() => app.customerPrivacy.setConsent({ customerId: ravi.id, purpose: 'payment_reminders', channel: 'sms', method: 'in_person' })).toThrow(/erased/u);
    expect(() => app.customerPrivacy.erase({ customerId: ravi.id, version: erased.version, reason: 'again' })).toThrow(/erased/u);
    expect(app.customers.search('Ravi', 10)).toEqual([]);
    expect(app.customers.search('9876543210', 10)).toEqual([]);
  });
});
