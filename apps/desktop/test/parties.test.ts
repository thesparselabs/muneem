import { beforeEach, describe, expect, it } from 'vitest';
import { reconcilePartiesDb, type Db } from '@muneem/db-sqlite';
import type { Customer, LedgerPage, Outstanding, PartyOpening, Supplier } from '@muneem/contracts';
import type { App } from '../src/main/app.js';
import { caller, grantRole, ownerAtTill, testApp } from './helpers.js';

let app: App;
let db: Db;
let api: ReturnType<typeof caller>;
let businessId: string;

beforeEach(async () => {
  ({ app, db } = await testApp());
  api = caller(app);
  businessId = (await ownerAtTill(app)).businessId;
});

const acme = { name: 'Acme Traders', stateCode: '07', gstin: '07AAAAA0000A1Z5', creditDays: 30 };

describe('suppliers over IPC', () => {
  it('creates, finds and updates a supplier', async () => {
    const s = await api.data<Supplier>('suppliers.create', acme);
    expect(s).toMatchObject({ taxScheme: 'regular', creditDays: 30, version: 1 });
    expect(await api.data<Supplier[]>('suppliers.search', { query: 'acme' })).toHaveLength(1);
    expect(await api.data<Supplier>('suppliers.update', { ...acme, id: s.id, version: 1, creditDays: 45 })).toMatchObject({ creditDays: 45, version: 2 });
    expect(await api.call('suppliers.update', { ...acme, id: s.id, version: 1 })).toMatchObject({ ok: false, error: { code: 'INVALID_STATE' } });
  });

  it('names the field when the GSTIN is from another state', async () => {
    expect(await api.call('suppliers.create', { ...acme, stateCode: '27' })).toMatchObject({ ok: false, error: { code: 'VALIDATION_FAILED', fields: { stateCode: expect.any(String) } } });
  });

  it('a cashier can neither see nor add suppliers', async () => {
    grantRole(db, app, 'cashier');
    expect(await api.call('suppliers.search', { query: '' })).toMatchObject({ ok: false, error: { code: 'PERMISSION_DENIED' } });
    expect(await api.call('suppliers.create', acme)).toMatchObject({ ok: false, error: { code: 'PERMISSION_DENIED' } });
  });
});

describe('customer credit limit', () => {
  it('only a user with customers.approve can set it, and null means no credit', async () => {
    const c = await api.data<Customer>('customers.create', { name: 'Ravi', creditDays: 15 });
    expect(c).toMatchObject({ creditDays: 15, creditLimitPaise: null });
    expect(await api.data<Customer>('customers.setCreditLimit', { id: c.id, version: 1, limitPaise: 500_000 })).toMatchObject({ creditLimitPaise: 500_000 });
    grantRole(db, app, 'cashier');
    expect(await api.call('customers.setCreditLimit', { id: c.id, version: 2, limitPaise: null })).toMatchObject({ ok: false, error: { code: 'PERMISSION_DENIED' } });
    grantRole(db, app, 'manager');
    expect(await api.data<Customer>('customers.setCreditLimit', { id: c.id, version: 2, limitPaise: null })).toMatchObject({ creditLimitPaise: null });
  });
});

describe('opening balances, statements and outstanding', () => {
  it('defaults to the usual side, replaces on re-entry, and keeps the sub-ledger reconciled', async () => {
    const c = await api.data<Customer>('customers.create', { name: 'Ravi' });
    const s = await api.data<Supplier>('suppliers.create', acme);
    expect(await api.data<PartyOpening>('customers.setOpening', { partyId: c.id, amountPaise: 120_000, asOfDate: '2026-08-01' })).toMatchObject({ side: 'receivable' });
    expect(await api.data<PartyOpening>('suppliers.setOpening', { partyId: s.id, amountPaise: 90_000, asOfDate: '2026-09-15' })).toMatchObject({ side: 'payable' });
    await api.data('customers.setOpening', { partyId: c.id, amountPaise: 100_000, asOfDate: '2026-08-01' });

    const ledger = await api.data<LedgerPage>('customers.getLedger', { partyId: c.id });
    expect(ledger.items.map((l) => [l.kind, l.amountPaise, l.balancePaise])).toEqual([['post', 120_000, 120_000], ['cancel', -120_000, 0], ['post', 100_000, 100_000]]);
    expect(ledger.closingBalancePaise).toBe(100_000);
    expect((await api.data<LedgerPage>('suppliers.getLedger', { partyId: s.id })).closingBalancePaise).toBe(-90_000);

    const owed = await api.data<Outstanding>('customers.getOutstanding', { asOf: '2026-10-03' });
    expect(owed.totals).toMatchObject({ days61to90Paise: 100_000, netPaise: 100_000 });
    expect((await api.data<Outstanding>('suppliers.getOutstanding', { asOf: '2026-10-03' })).totals).toMatchObject({ days0to30Paise: 90_000, netPaise: 90_000 });
    expect(reconcilePartiesDb(db, businessId)).toEqual({ mismatches: [], faults: [] });
  });

  it('refuses a party from outside the business and an opening without edit rights', async () => {
    expect(await api.call('customers.setOpening', { partyId: '01J00000000000000000000Z99', amountPaise: 1, asOfDate: '2026-04-01' }))
      .toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } });
    const c = await api.data<Customer>('customers.create', { name: 'Ravi' });
    grantRole(db, app, 'cashier');
    expect(await api.call('customers.setOpening', { partyId: c.id, amountPaise: 1, asOfDate: '2026-04-01' })).toMatchObject({ ok: false, error: { code: 'PERMISSION_DENIED' } });
  });
});

describe('party ledger integrity check (5g)', () => {
  it('reports ok on a clean ledger and names a mismatch without rewriting anything', async () => {
    const c = await api.data<Customer>('customers.create', { name: 'Ravi' });
    app.customerLedger.setOpening({ partyId: c.id, amountPaise: 1000, asOfDate: '2026-04-01' });
    expect(await api.data('diagnostics.integrityCheck')).toMatchObject({ parties: 'ok' });
    db.prepare(`INSERT INTO party_ledger_entry (id, business_id, party_type, party_id, ref_type, ref_id, entry_kind, amount_paise, doc_date, occurred_at,
        created_at, updated_at, created_by, device_id) VALUES ('X1', ?, 'customer', ?, 'sale', 'ghost', 'post', 50, '2026-10-04', 'a', 'a', 'a', 'u', 'd')`).run(businessId, c.id);
    expect(app.diagnostics.checkParties()).toBe('mismatch');
    expect(db.prepare("SELECT COUNT(*) FROM party_ledger_entry WHERE id = 'X1'").pluck().get()).toBe(1);
  });
});

describe('5h-1 fixes', () => {
  it('a new owner can see the Stage 5 screens straight after setup, without logging in again (#2)', async () => {
    expect((await api.data<{ permissions: string[] }>('auth.getSession')).permissions).toEqual(expect.arrayContaining(['purchases.view', 'payments.view', 'suppliers.view']));
  });

  it('a customer update with every saved field keeps them all (#1)', async () => {
    const c = await api.data<Customer>('customers.create', { name: 'Ravi', email: 'ravi@example.com', stateCode: '29', addressLine1: '12 MG Road', city: 'Bengaluru', pinCode: '560001' });
    const fields = { email: c.email, stateCode: c.stateCode, addressLine1: c.addressLine1, city: c.city, pinCode: c.pinCode, creditDays: c.creditDays };
    expect(await api.data<Customer>('customers.update', { ...fields, name: 'Ravi K', id: c.id, version: c.version }))
      .toMatchObject({ name: 'Ravi K', email: 'ravi@example.com', stateCode: '29', addressLine1: '12 MG Road', city: 'Bengaluru', pinCode: '560001' });
  });
});
