import { beforeEach, describe, expect, it } from 'vitest';
import { newUlid } from '@muneem/domain';
import { reconcilePartiesDb, type Db } from '@muneem/db-sqlite';
import {
  CreatePurchaseInput, ExpenseInput, PaymentInput, ProductInput, WriteOffInput, type Customer, type Expense, type ExpenseCategory, type OpenItems, type Payment, type Purchase,
  type RegisterReport, type Supplier,
} from '@muneem/contracts';
import type { App } from '../src/main/app.js';
import { caller, grantRole, ownerAtTill, testApp } from './helpers.js';

let app: App;
let db: Db;
let api: ReturnType<typeof caller>;
let businessId: string;
let ravi: Customer;
let acme: Supplier;

beforeEach(async () => {
  ({ app, db } = await testApp());
  api = caller(app);
  businessId = (await ownerAtTill(app)).businessId;
  ravi = await api.data<Customer>('customers.create', { name: 'Ravi' });
  acme = await api.data<Supplier>('suppliers.create', { name: 'Acme Traders', stateCode: '07', gstin: '07AAAAA0000A1Z5', creditDays: 30 });
});

const clean = () => expect(reconcilePartiesDb(db, businessId)).toEqual({ mismatches: [], faults: [] });
const opening = (partyType: 'customer' | 'supplier', partyId: string, amountPaise: number, asOfDate: string) =>
  (partyType === 'customer' ? app.customerLedger : app.supplierLedger).setOpening({ partyId, amountPaise, asOfDate });
const pay = (input: Record<string, unknown>): Payment => app.payments.create(PaymentInput.parse({ method: 'bank', commandId: newUlid(), ...input }));
const purchase = async (invoiceNo: string, invoiceDate: string): Promise<Purchase> => {
  const pcs = (await api.data<{ id: string; code: string }[]>('catalog.listUoms')).find((u) => u.code === 'PCS')!.id;
  const productId = app.products.create(ProductInput.parse({ name: `Item ${invoiceNo}`, baseUomId: pcs, sellingPricePaise: 100 })).id;
  return app.purchases.create(CreatePurchaseInput.parse({
    supplierId: acme.id, supplierInvoiceNo: invoiceNo, supplierInvoiceDate: invoiceDate, commandId: newUlid(), billTotalPaise: 50_000,
    lines: [{ productId, uomId: pcs, qtyMilli: 1000, unitPricePaise: 50_000 }],
  }));
};

describe('customer receipts', () => {
  it('settle the oldest due first, keep the rest as an advance, and number as receipts', async () => {
    const charge = opening('customer', ravi.id, 60_000, '2026-08-01');
    const r = await api.data<Payment>('payments.create', { partyType: 'customer', partyId: ravi.id, amountPaise: 100_000, method: 'upi', commandId: newUlid() });
    expect(r).toMatchObject({ direction: 'in', allocatedPaise: 60_000, partyName: 'Ravi' });
    expect(r.docNumber).toMatch(/^DE01R\/\d{4}\/00001$/);
    expect(r.allocations).toEqual([expect.objectContaining({ targetType: 'opening', targetId: charge.id, amountPaise: 60_000, voided: false })]);
    const items = await api.data<OpenItems>('payments.openItems', { partyType: 'customer', partyId: ravi.id });
    expect(items).toMatchObject({ charges: [], credits: [{ type: 'payment', id: r.id, openPaise: 40_000 }] });
    clean();
  });

  it('honours a chosen allocation and refuses one larger than the item or the payment', async () => {
    const charge = opening('customer', ravi.id, 60_000, '2026-08-01');
    expect(pay({ partyType: 'customer', partyId: ravi.id, amountPaise: 50_000, allocation: [{ type: 'opening', id: charge.id, amountPaise: 20_000 }] }).allocatedPaise).toBe(20_000);
    expect(() => pay({ partyType: 'customer', partyId: ravi.id, amountPaise: 50_000, allocation: [{ type: 'opening', id: charge.id, amountPaise: 40_001 }] })).toThrow(/exceeds/);
    expect(() => pay({ partyType: 'customer', partyId: ravi.id, amountPaise: 10_000, allocation: [{ type: 'opening', id: charge.id, amountPaise: 20_000 }] })).toThrow(/exceed the payment/);
    expect(() => pay({ partyType: 'customer', partyId: ravi.id, amountPaise: 10_000, allocation: [{ type: 'sale', id: charge.id, amountPaise: 100 }] })).toThrow(/not a sale/);
    clean();
  });

  it('a repeated command returns the first payment', async () => {
    const input = { partyType: 'customer', partyId: ravi.id, amountPaise: 1000, method: 'cash', commandId: newUlid() };
    expect((await api.data<Payment>('payments.create', input)).id).toBe((await api.data<Payment>('payments.create', input)).id);
    expect(db.prepare('SELECT COUNT(*) FROM payment').pluck().get()).toBe(1);
  });

  it('refuses a payment dated in the future', () => {
    expect(() => pay({ partyType: 'customer', partyId: ravi.id, amountPaise: 1000, paymentDate: '2999-01-01' })).toThrow(/future/);
  });
});

describe('supplier payments and later allocation', () => {
  it('pays the oldest bill first, then applies the advance to a later bill', async () => {
    const older = await purchase('A-1', '2026-08-01');
    const p = pay({ partyType: 'supplier', partyId: acme.id, amountPaise: 80_000 });
    expect(p).toMatchObject({ direction: 'out', allocatedPaise: 50_000 });
    expect(p.docNumber).toMatch(/^DE01Y\//);
    expect(app.purchases.get(older.id).settledPaise).toBe(50_000);
    const later = await purchase('A-2', '2026-09-01');
    const r = app.payments.allocate({ partyType: 'supplier', partyId: acme.id, creditType: 'payment', creditId: p.id, allocation: 'auto' });
    expect(r).toMatchObject({ allocatedPaise: 30_000, unallocatedPaise: 0, allocations: [expect.objectContaining({ targetId: later.id, amountPaise: 30_000 })] });
    expect(() => app.payments.allocate({ partyType: 'supplier', partyId: acme.id, creditType: 'payment', creditId: p.id, allocation: 'auto' })).toThrow(/nothing left/);
    clean();
  });

  it('cancelling a payment gives the amounts back to the bills and reverses the ledger', async () => {
    const bill = await purchase('A-1', '2026-08-01');
    const p = pay({ partyType: 'supplier', partyId: acme.id, amountPaise: 50_000 });
    const c = await api.data<Payment>('payments.cancel', { id: p.id, reason: 'bounced cheque' });
    expect(c).toMatchObject({ status: 'cancelled', allocatedPaise: 0, cancelReason: 'bounced cheque', allocations: [expect.objectContaining({ voided: true })] });
    expect(app.purchases.get(bill.id).settledPaise).toBe(0);
    expect(db.prepare('SELECT SUM(amount_paise) FROM party_ledger_entry WHERE ref_id = ?').pluck().get(p.id)).toBe(0);
    clean();
  });
});

describe('cash and the drawer', () => {
  it('a cash receipt and a cash supplier payment move expected cash only while a register is open', async () => {
    pay({ partyType: 'customer', partyId: ravi.id, amountPaise: 5000, method: 'cash' });
    expect(db.prepare('SELECT COUNT(*) FROM cash_movement').pluck().get()).toBe(0);
    await api.data('pos.openRegister', { openingCashPaise: 10_000 });
    const r = pay({ partyType: 'customer', partyId: ravi.id, amountPaise: 20_000, method: 'cash' });
    pay({ partyType: 'supplier', partyId: acme.id, amountPaise: 7000, method: 'cash' });
    expect((await api.data<RegisterReport>('pos.xReport')).expectedCashPaise).toBe(10_000 + 20_000 - 7000);
    expect(r.drawerSessionId).toBeTruthy();
    app.payments.cancel(r.id, 'wrong customer');
    expect((await api.data<RegisterReport>('pos.xReport')).expectedCashPaise).toBe(10_000 - 7000);
  });
});

describe('permissions', () => {
  it('a cashier can take a customer\'s payment but cannot pay a supplier or write off', async () => {
    const charge = opening('customer', ravi.id, 1000, '2026-08-01');
    grantRole(db, app, 'cashier');
    expect((await api.call('payments.create', { partyType: 'customer', partyId: ravi.id, amountPaise: 500, method: 'cash', commandId: newUlid() })).ok).toBe(true);
    expect(await api.call('payments.create', { partyType: 'supplier', partyId: acme.id, amountPaise: 500, method: 'cash', commandId: newUlid() }))
      .toMatchObject({ ok: false, error: { code: 'PERMISSION_DENIED' } });
    expect(await api.call('payments.writeOff', { customerId: ravi.id, items: [{ type: 'opening', id: charge.id, amountPaise: 500 }], reason: 'x', commandId: newUlid() }))
      .toMatchObject({ ok: false, error: { code: 'PERMISSION_DENIED' } });
  });
});

describe('write-off', () => {
  it('clears the chosen items and lowers what the customer owes', async () => {
    const charge = opening('customer', ravi.id, 30_000, '2026-04-01');
    pay({ partyType: 'customer', partyId: ravi.id, amountPaise: 10_000 });
    const w = app.writeOffs.create(WriteOffInput.parse({ customerId: ravi.id, items: [{ type: 'opening', id: charge.id, amountPaise: 20_000 }], reason: 'shop closed', commandId: newUlid() }));
    expect(w).toMatchObject({ amountPaise: 20_000, allocations: [expect.objectContaining({ amountPaise: 20_000 })] });
    expect(app.payments.openItems('customer', ravi.id).charges).toEqual([]);
    expect(app.customerLedger.ledger({ partyId: ravi.id, limit: 100 }).closingBalancePaise).toBe(0);
    expect(() => app.writeOffs.create(WriteOffInput.parse({ customerId: ravi.id, items: [{ type: 'opening', id: charge.id, amountPaise: 1 }], reason: 'x', commandId: newUlid() }))).toThrow(/not open/);
    clean();
  });
});

describe('expenses', () => {
  let categories: ExpenseCategory[];
  beforeEach(async () => { categories = await api.data<ExpenseCategory[]>('expenses.listCategories'); });
  const cat = (code: string) => categories.find((c) => c.code === code)!.id;
  const expense = (input: Record<string, unknown>): Expense => app.expenses.create(ExpenseInput.parse({ commandId: newUlid(), ...input }));

  it('seeds the categories once, mapped to the expense accounts', async () => {
    expect(categories.map((c) => c.accountCode)).toEqual(['5400', '5410', '5420', '5430', '5440', '5450', '5460', '5900']);
    expect(await api.data<ExpenseCategory[]>('expenses.listCategories')).toHaveLength(8);
  });

  it('a cash expense with GST from a registered vendor claims the tax and leaves the drawer', async () => {
    await api.data('pos.openRegister', { openingCashPaise: 50_000 });
    const e = expense({ categoryId: cat('INTERNET'), method: 'cash', amountPaise: 11_800, gstRateBp: 1800, vendorName: 'Airtel', vendorGstin: '07DDDDD0000D1Z5' });
    expect(e).toMatchObject({ docNumber: expect.stringMatching(/^DE01E\//), supplyType: 'intra', taxablePaise: 10_000, cgstPaise: 900, itcPaise: 1800, totalPaise: 11_800 });
    expect((await api.data<RegisterReport>('pos.xReport')).expectedCashPaise).toBe(50_000 - 11_800);
  });

  it('refuses GST without a GSTIN, and takes the whole amount as the expense without a rate', () => {
    expect(() => expense({ categoryId: cat('RENT'), method: 'bank', amountPaise: 2_000_000, gstRateBp: 1800 })).toThrow(expect.objectContaining({ fields: { gstRateBp: expect.any(String) } }));
    expect(expense({ categoryId: cat('RENT'), method: 'bank', amountPaise: 2_000_000 })).toMatchObject({ taxablePaise: 2_000_000, itcPaise: 0, totalPaise: 2_000_000 });
  });

  it('an expense on credit sits on the supplier\'s ledger until a supplier payment settles it; then it cannot be cancelled', async () => {
    const e = expense({ categoryId: cat('TRANSPORT'), method: 'credit', supplierId: acme.id, amountPaise: 5900, gstRateBp: 1800, expenseDate: '2026-09-01' });
    expect(e).toMatchObject({ dueDate: '2026-10-01', itcPaise: 900 });
    expect(app.payments.openItems('supplier', acme.id).charges).toEqual([expect.objectContaining({ type: 'expense', id: e.id, openPaise: 5900 })]);
    pay({ partyType: 'supplier', partyId: acme.id, amountPaise: 5900 });
    expect(app.expenses.get(e.id).settledPaise).toBe(5900);
    expect(await api.call('expenses.cancel', { id: e.id, reason: 'x' })).toMatchObject({ ok: false, error: { code: 'INVALID_STATE' } });
    expect(() => expense({ categoryId: cat('TRANSPORT'), method: 'credit', amountPaise: 100 })).toThrow(expect.objectContaining({ fields: { supplierId: expect.any(String) } }));
    clean();
  });

  it('cancelling a cash expense returns the cash to an open drawer', async () => {
    await api.data('pos.openRegister', { openingCashPaise: 50_000 });
    const e = expense({ categoryId: cat('OTHER'), method: 'cash', amountPaise: 2000 });
    expect((await api.data<Expense>('expenses.cancel', { id: e.id, reason: 'duplicate' })).status).toBe('cancelled');
    expect((await api.data<RegisterReport>('pos.xReport')).expectedCashPaise).toBe(50_000);
  });
});

describe('outstanding as of a past date (5h #5)', () => {
  const asOf = (date: string) => app.customerLedger.outstanding({ asOf: date }).totals;
  const ledgerOn = (date: string) => app.customerLedger.ledger({ partyId: ravi.id, to: date, limit: 100 }).closingBalancePaise;

  it('leaves out payments made, and cancellations done, after the date', () => {
    opening('customer', ravi.id, 100_000, '2026-08-01');
    const p = pay({ partyType: 'customer', partyId: ravi.id, amountPaise: 60_000, paymentDate: '2026-09-15' });
    expect(asOf('2026-09-01')).toMatchObject({ netPaise: 100_000, advancePaise: 0 });
    expect(asOf('2026-09-20')).toMatchObject({ netPaise: 40_000 });
    app.payments.cancel(p.id, 'bounced');
    expect(asOf('2026-09-20')).toMatchObject({ netPaise: 40_000 });                     // the cancel happened later
    expect(asOf(new Date().toLocaleDateString('en-CA'))).toMatchObject({ netPaise: 100_000 });
    for (const d of ['2026-07-31', '2026-08-01', '2026-09-15', '2026-09-20']) expect(asOf(d).netPaise).toBe(ledgerOn(d));
  });

  it('a backdated payment never settles a bill before the bill exists', () => {
    opening('customer', ravi.id, 50_000, '2026-09-10');
    pay({ partyType: 'customer', partyId: ravi.id, amountPaise: 20_000, paymentDate: '2026-09-01' });
    expect(asOf('2026-09-05')).toMatchObject({ advancePaise: 20_000, netPaise: -20_000 });
    expect(asOf('2026-09-12')).toMatchObject({ advancePaise: 0, netPaise: 30_000 });
    for (const d of ['2026-09-05', '2026-09-12']) expect(asOf(d).netPaise).toBe(ledgerOn(d));
  });
});
