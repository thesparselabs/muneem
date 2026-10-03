import { beforeEach, describe, expect, it } from 'vitest';
import { newUlid } from '@muneem/domain';
import { firstPrintJobFor, reconcilePartiesDb, type Db } from '@muneem/db-sqlite';
import {
  CompleteSaleInput, PaymentInput, SaleDraft, type Customer, type ReceiptDoc, type RegisterReport, type Sale, type SaleQuote, type TenderLine,
} from '@muneem/contracts';
import type { App } from '../src/main/app.js';
import { layoutReceipt, renderText } from '../src/main/services/print/layout.js';
import { caller, grantRole, ownerAtTill, testApp } from './helpers.js';

let app: App;
let db: Db;
let api: ReturnType<typeof caller>;
let businessId: string;
let pcs: string;
let soap: string;
let ravi: Customer;

beforeEach(async () => {
  ({ app, db } = await testApp());
  api = caller(app);
  businessId = (await ownerAtTill(app)).businessId;
  pcs = (await api.data<{ id: string; code: string }[]>('catalog.listUoms')).find((u) => u.code === 'PCS')!.id;
  soap = (await api.data<{ id: string }>('products.create', { name: 'Soap', baseUomId: pcs, sellingPricePaise: 10_000 })).id;   // ₹100, no GST
  ravi = await api.data<Customer>('customers.create', { name: 'Ravi', creditDays: 15 });
  await api.data('pos.openRegister', { openingCashPaise: 0 });
});

const clean = () => expect(reconcilePartiesDb(db, businessId)).toEqual({ mismatches: [], faults: [] });
const draft = (qty: number, customerId: string | null = ravi.id) => SaleDraft.parse({ lines: [{ productId: soap, uomId: pcs, qtyMilli: qty * 1000 }], ...(customerId && { customerId }) });
const sell = (qty: number, tenders: TenderLine[], customerId: string | null = ravi.id) => {
  const d = draft(qty, customerId);
  return app.sales.complete(CompleteSaleInput.parse({ ...d, commandId: newUlid(), expectedTotalPaise: app.sales.quote(d).totals.totalPaise, tenders }));
};
const setLimit = (limitPaise: number | null) => { ravi = app.customers.setCreditLimit({ id: ravi.id, version: ravi.version, limitPaise }); };
const balance = () => app.customerLedger.ledger({ partyId: ravi.id, limit: 100 }).closingBalancePaise;

describe('a sale partly on credit', () => {
  it('stores what was paid, what is on credit and when it is due, and puts the credit on the customer\'s ledger', () => {
    setLimit(100_000);
    const r = sell(3, [{ method: 'cash', amountPaise: 10_000 }, { method: 'credit', amountPaise: 20_000 }]);
    const sale = app.sales.get(r.saleId) as Sale;
    expect(sale).toMatchObject({ paidPaise: 10_000, creditPaise: 20_000, dueDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) });
    expect(balance()).toBe(20_000);
    expect(app.payments.openItems('customer', ravi.id).charges).toEqual([expect.objectContaining({ type: 'sale', id: r.saleId, openPaise: 20_000 })]);
    expect(db.prepare("SELECT COUNT(*) FROM party_ledger_entry WHERE ref_type = 'sale' AND ref_id = ?").pluck().get(r.saleId)).toBe(1);
    clean();
  });

  it('the quote tells the payment screen how much credit is left, counting an advance as room', async () => {
    setLimit(50_000);
    app.payments.create(PaymentInput.parse({ partyType: 'customer', partyId: ravi.id, amountPaise: 5000, method: 'upi', commandId: newUlid() }));
    expect((await api.data<SaleQuote>('sales.quote', draft(1))).credit).toEqual({ balancePaise: -5000, limitPaise: 50_000, availablePaise: 55_000 });
    expect((await api.data<SaleQuote>('sales.quote', draft(1, null))).credit).toBeUndefined();
  });

  it('a later receipt settles the credit sale', () => {
    setLimit(100_000);
    const r = sell(2, [{ method: 'credit', amountPaise: 20_000 }]);
    app.payments.create(PaymentInput.parse({ partyType: 'customer', partyId: ravi.id, amountPaise: 20_000, method: 'cash', commandId: newUlid() }));
    expect((app.sales.get(r.saleId) as Sale & { creditPaise: number }).creditPaise).toBe(20_000);
    expect(app.payments.openItems('customer', ravi.id).charges).toEqual([]);
    expect(balance()).toBe(0);
    clean();
  });

  it('shows on the Z report by tender and leaves expected cash alone', async () => {
    setLimit(100_000);
    sell(3, [{ method: 'cash', amountPaise: 10_000 }, { method: 'credit', amountPaise: 20_000 }]);
    const x = await api.data<RegisterReport>('pos.xReport');
    expect(x.byTender).toEqual(expect.arrayContaining([{ method: 'credit', amountPaise: 20_000 }, { method: 'cash', amountPaise: 10_000 }]));
    expect(x.expectedCashPaise).toBe(10_000);
  });

  it('prints what is on credit, when it is due and the balance now', () => {
    setLimit(100_000);
    sell(1, [{ method: 'credit', amountPaise: 10_000 }]);
    const r = sell(2, [{ method: 'credit', amountPaise: 20_000 }]);
    const doc = firstPrintJobFor(db, r.saleId)!.doc as ReceiptDoc;
    expect(doc.credit).toMatchObject({ amountPaise: 20_000, balancePaise: 30_000 });
    const text = renderText(layoutReceipt(doc, 42), 42);
    expect(text).toMatch(/On credit\s+200\.00/);
    expect(text).toMatch(/Balance now\s+300\.00/);
  });

  it('a repeated command returns the first sale with no second ledger entry', () => {
    setLimit(100_000);
    const d = draft(1);
    const input = CompleteSaleInput.parse({ ...d, commandId: newUlid(), expectedTotalPaise: 10_000, tenders: [{ method: 'credit', amountPaise: 10_000 }] });
    expect(app.sales.complete(input).saleId).toBe(app.sales.complete(input).saleId);
    expect(db.prepare('SELECT COUNT(*) FROM party_ledger_entry').pluck().get()).toBe(1);
  });
});

describe('refused credit', () => {
  it('needs a customer, one credit line, and no more than the bill', () => {
    setLimit(100_000);
    expect(() => sell(1, [{ method: 'credit', amountPaise: 10_000 }], null)).toThrow(/customer/);
    expect(() => sell(2, [{ method: 'credit', amountPaise: 10_000 }, { method: 'credit', amountPaise: 10_000 }])).toThrow(/credit part on one line/);
    expect(() => sell(1, [{ method: 'credit', amountPaise: 10_100 }])).toThrow(/cannot exceed the bill/);
    expect(db.prepare('SELECT COUNT(*) FROM sale').pluck().get()).toBe(0);
  });
});

describe('the credit limit', () => {
  it('refuses a cashier past the limit with the numbers, and writes nothing', async () => {
    setLimit(25_000);
    sell(2, [{ method: 'credit', amountPaise: 20_000 }]);
    grantRole(db, app, 'cashier');
    const d = draft(1);
    const r = await api.call('sales.complete', { ...d, commandId: newUlid(), expectedTotalPaise: 10_000, tenders: [{ method: 'credit', amountPaise: 10_000 }] });
    expect(r).toMatchObject({ ok: false, error: { code: 'CREDIT_LIMIT_EXCEEDED', message: expect.stringMatching(/owes ₹200\.00 with a limit of ₹250\.00; ₹50\.00 more/) } });
    expect(db.prepare('SELECT COUNT(*) FROM sale').pluck().get()).toBe(1);
    expect(balance()).toBe(20_000);
  });

  it('lets a manager go past it, on the record', () => {
    setLimit(25_000);
    sell(2, [{ method: 'credit', amountPaise: 20_000 }]);
    grantRole(db, app, 'manager');
    const r = sell(1, [{ method: 'credit', amountPaise: 10_000 }]);
    const audit = db.prepare("SELECT after_json FROM audit_log WHERE action = 'credit.limit_override' AND entity_id = ?").pluck().get(r.saleId) as string;
    expect(JSON.parse(audit)).toMatchObject({ customerId: ravi.id, creditPaise: 10_000, balancePaise: 20_000, limitPaise: 25_000 });
    clean();
  });

  it('with no limit set, any credit needs the override', async () => {
    grantRole(db, app, 'cashier');
    const d = draft(1);
    expect(await api.call('sales.complete', { ...d, commandId: newUlid(), expectedTotalPaise: 10_000, tenders: [{ method: 'credit', amountPaise: 10_000 }] }))
      .toMatchObject({ ok: false, error: { code: 'CREDIT_LIMIT_EXCEEDED', message: expect.stringContaining('no credit limit set') } });
  });
});
