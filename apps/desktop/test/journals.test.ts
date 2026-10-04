import { beforeEach, describe, expect, it } from 'vitest';
import { newUlid } from '@muneem/domain';
import { tieOutFailures, type Db } from '@muneem/db-sqlite';
import {
  CompleteSaleInput, CreatePurchaseInput, ExpenseInput, PaymentInput, ReturnPurchaseInput, SaleDraft, WriteOffInput, type Customer, type Supplier, type TenderLine,
} from '@muneem/contracts';
import type { App } from '../src/main/app.js';
import { caller, ownerAtTill, testApp } from './helpers.js';

let app: App;
let db: Db;
let businessId: string;
let pcs: string;
let soap: string;
let ravi: Customer;
let acme: Supplier;

beforeEach(async () => {
  ({ app, db } = await testApp());
  const api = caller(app);
  businessId = (await ownerAtTill(app)).businessId;
  pcs = (await api.data<{ id: string; code: string }[]>('catalog.listUoms')).find((u) => u.code === 'PCS')!.id;
  soap = (await api.data<{ id: string }>('products.create', { name: 'Soap', baseUomId: pcs, gstRateBp: 1800, sellingPricePaise: 11_800, priceIsInclusive: true })).id;
  ravi = app.customers.create({ name: 'Ravi', creditDays: 15 });
  ravi = app.customers.setCreditLimit({ id: ravi.id, version: ravi.version, limitPaise: 1_000_000 });
  acme = app.suppliers.create({ name: 'Acme', stateCode: '07', gstin: '07AAAAA0000A1Z5', taxScheme: 'regular', creditDays: 30 });
});

// A journal as account code → signed amount (debit positive), with the entry's number and date.
function journal(source: string, refId: string, reversal = false) {
  const e = db.prepare(`SELECT id, entry_no, entry_date, debit_total_paise FROM journal_entry WHERE business_id = ? AND source = ? AND ref_id = ?
    AND is_reversal_of IS ${reversal ? 'NOT' : ''} NULL`).get(businessId, source, refId) as { id: string; entry_no: string; entry_date: string; debit_total_paise: number } | undefined;
  if (!e) return undefined;
  const lines = db.prepare(`SELECT a.code, SUM(l.debit_paise - l.credit_paise) AS net FROM journal_line l JOIN account a ON a.id = l.account_id
    WHERE l.entry_id = ? GROUP BY a.code ORDER BY a.code`).all(e.id) as { code: string; net: number }[];
  return { entryNo: e.entry_no, date: e.entry_date, total: e.debit_total_paise, net: Object.fromEntries(lines.map((l) => [l.code, l.net])) };
}
const tied = () => expect(tieOutFailures(db, businessId)).toEqual([]);
const stock = (qty: number, unitCostPaise: number) => app.inventory.setOpeningStock({ lines: [{ productId: soap, qtyMilli: qty * 1000, unitCostPaise }] });
const sell = (qty: number, tenders: (total: number) => TenderLine[], customerId?: string) => {
  const d = SaleDraft.parse({ lines: [{ productId: soap, uomId: pcs, qtyMilli: qty * 1000 }], ...(customerId && { customerId }) });
  const total = app.sales.quote(d).totals.totalPaise;
  return app.sales.complete(CompleteSaleInput.parse({ ...d, commandId: newUlid(), expectedTotalPaise: total, tenders: tenders(total) }));
};
const buy = (qty: number, over: Record<string, unknown> = {}) => app.purchases.create(CreatePurchaseInput.parse({
  supplierId: acme.id, supplierInvoiceNo: `B-${newUlid()}`, supplierInvoiceDate: '2026-10-01', commandId: newUlid(), billTotalPaise: qty * 11_800 + 1000,
  lines: [{ productId: soap, uomId: pcs, qtyMilli: qty * 1000, unitPricePaise: 10_000 }], charges: [{ kind: 'freight', amountPaise: 1000 }], ...over,
}));

describe('sales post their journal in the sale transaction (6b)', () => {
  beforeEach(async () => { stock(10, 7000); await app.register.open(0); });

  it('cash, UPI and credit: takings by account, revenue net of tax, output tax, COGS', () => {
    const r = sell(3, (t) => [{ method: 'cash', amountPaise: 20_000 }, { method: 'upi', amountPaise: 10_000 }, { method: 'credit', amountPaise: t - 30_000 }], ravi.id);
    // ₹118 inclusive × 3 = ₹354: taxable ₹300, CGST ₹27, SGST ₹27.
    expect(journal('sale', r.saleId)).toMatchObject({ entryNo: r.docNumber, total: 35_400 + 21_000,
      net: { 1100: 20_000, 1250: 10_000, 1300: 5400, 1400: -21_000, 2210: -2700, 2220: -2700, 4100: -30_000, 5100: 21_000 } });
    tied();
  });

  it('change comes off the cash, and round-off posts to 4900', async () => {
    await app.settings.set('pos.roundToRupee', true);
    const r = sell(1, () => [{ method: 'cash', amountPaise: 20_000 }]);
    const j = journal('sale', r.saleId)!;
    expect(j.net['1100']).toBe(20_000 - r.changePaise);
    tied();
  });

  it('a sale with no stock records a provisional COGS, and the next purchase posts its correction', () => {
    sell(12, (t) => [{ method: 'cash', amountPaise: t }]);                  // 2 units sold below zero at the ₹70 last cost
    const p = buy(10);
    const correction = db.prepare(`SELECT ref_id FROM journal_entry WHERE business_id = ? AND ref_type = 'cost_correction'`).pluck().all(businessId);
    expect(correction).toHaveLength(1);
    expect(journal('purchase', p.id)!.net['1400']).toBe(p.lines[0]!.landedValuePaise);
    tied();
  });
});

describe('purchases, returns and cancels (6b)', () => {
  it("a purchase posts landed stock, claimable tax and the bill on the supplier's bill date", () => {
    const p = buy(10);
    expect(journal('purchase', p.id)).toMatchObject({ entryNo: p.docNumber, date: '2026-10-01',
      net: { 1400: 101_000, 1510: 9000, 1520: 9000, 2100: -119_000 } });
    tied();
  });

  it('an ineligible line puts its tax into stock', () => {
    const p = buy(10, { lines: [{ productId: soap, uomId: pcs, qtyMilli: 10_000, unitPricePaise: 10_000, itcEligible: false }] });
    expect(journal('purchase', p.id)!.net).toEqual({ 1400: 119_000, 2100: -119_000 });
    tied();
  });

  it('a debit note with freight kept posts the loss, and a full return with refund settles to zero', () => {
    const p = buy(10);
    const half = app.purchaseReturns.returnGoods(ReturnPurchaseInput.parse({ purchaseId: p.id, reason: 'x', commandId: newUlid(), lines: [{ purchaseItemId: p.lines[0]!.id, qtyMilli: 5000 }] }));
    expect(journal('purchase_return', half.id)).toMatchObject({ net: { 1400: -50_500, 1510: -4500, 1520: -4500, 2100: 59_000, 5110: 500 } });
    tied();
    const rest = app.purchaseReturns.returnGoods(ReturnPurchaseInput.parse({ purchaseId: p.id, reason: 'x', refundCharges: true, commandId: newUlid(), lines: [{ purchaseItemId: p.lines[0]!.id, qtyMilli: 5000 }] }));
    expect(journal('purchase_return', rest.id)!.net['5110']).toBeUndefined();
    tied();
  });

  it('cancelling a purchase reverses its journal on the day of the cancel', () => {
    const p = buy(4);
    app.purchaseReturns.cancel(p.id, 'wrong supplier');
    const reversal = journal('purchase', p.id, true)!;
    expect(reversal.date).toBe(new Date().toLocaleDateString('en-CA'));
    expect(reversal.net).toEqual(Object.fromEntries(Object.entries(journal('purchase', p.id)!.net).map(([k, v]) => [k, -v])));
    tied();
  });
});

describe('payments, write-offs and expenses (6b)', () => {
  it('a receipt with an advance posts wholly to 1300, and a supplier payment from the bank to 2100', () => {
    app.customerLedger.setOpening({ partyId: ravi.id, amountPaise: 30_000, asOfDate: '2026-04-01' });
    const r = app.payments.create(PaymentInput.parse({ partyType: 'customer', partyId: ravi.id, amountPaise: 50_000, method: 'upi', commandId: newUlid() }));
    expect(journal('receipt', r.id)!.net).toEqual({ 1200: 50_000, 1300: -50_000 });
    buy(1);
    const s = app.payments.create(PaymentInput.parse({ partyType: 'supplier', partyId: acme.id, amountPaise: 5000, method: 'cash', commandId: newUlid() }));
    expect(journal('payment', s.id)!.net).toEqual({ 1100: -5000, 2100: 5000 });
    tied();
  });

  it('a cancelled payment is reversed', () => {
    const r = app.payments.create(PaymentInput.parse({ partyType: 'customer', partyId: ravi.id, amountPaise: 5000, method: 'cash', commandId: newUlid() }));
    app.payments.cancel(r.id, 'bounced');
    expect(journal('receipt', r.id, true)!.net).toEqual({ 1100: -5000, 1300: 5000 });
    tied();
  });

  it('a write-off posts to 5470 Bad Debts', () => {
    const o = app.customerLedger.setOpening({ partyId: ravi.id, amountPaise: 2000, asOfDate: '2026-04-01' });
    const w = app.writeOffs.create(WriteOffInput.parse({ customerId: ravi.id, items: [{ type: 'opening', id: o.id, amountPaise: 2000 }], reason: 'gone', commandId: newUlid() }));
    expect(journal('write_off', w.id)).toMatchObject({ entryNo: expect.stringMatching(/^DE01J\//), net: { 1300: -2000, 5470: 2000 } });
    tied();
  });

  it('expenses: claimable GST paid by bank, on credit to the supplier, and a cancel', () => {
    const cat = (code: string) => app.expenses.categories().find((c) => c.accountCode === code)!.id;
    const e = app.expenses.create(ExpenseInput.parse({ categoryId: cat('5440'), method: 'bank', amountPaise: 11_800, gstRateBp: 1800, vendorGstin: '07DDDDD0000D1Z5', commandId: newUlid() }));
    expect(journal('expense', e.id)!.net).toEqual({ 1200: -11_800, 1510: 900, 1520: 900, 5440: 10_000 });
    const c = app.expenses.create(ExpenseInput.parse({ categoryId: cat('5430'), method: 'credit', supplierId: acme.id, amountPaise: 5000, commandId: newUlid() }));
    expect(journal('expense', c.id)!.net).toEqual({ 2100: -5000, 5430: 5000 });
    app.expenses.cancel(e.id, 'duplicate');
    expect(journal('expense', e.id, true)!.net['5440']).toBe(-10_000);
    tied();
  });
});

describe('stock documents, openings and the register (6b)', () => {
  it('opening stock against 3400, and adjustments and stock takes to shrinkage or gain', () => {
    const o = stock(10, 7000);
    expect(journal('opening', o.adjustmentId)!.net).toEqual({ 1400: 70_000, 3400: -70_000 });
    const loss = app.inventory.adjust({ lines: [{ productId: soap, qtyMilli: -2000, reason: 'damage' }] });
    expect(journal('stock_adjustment', loss.adjustmentId)!.net).toEqual({ 1400: -14_000, 5200: 14_000 });
    const take = app.inventory.stockTake({ counts: [{ productId: soap, countedMilli: 9000 }] });
    expect(journal('stock_adjustment', take.adjustmentId)!.net).toEqual({ 1400: 7000, 4400: -7000 });
    tied();
  });

  it('party openings on each side, and a replaced opening reversed', () => {
    app.supplierLedger.setOpening({ partyId: acme.id, amountPaise: 40_000, asOfDate: '2026-04-01' });
    const first = app.customerLedger.setOpening({ partyId: ravi.id, amountPaise: 1000, asOfDate: '2026-04-01' });
    app.customerLedger.setOpening({ partyId: ravi.id, side: 'payable', amountPaise: 300, asOfDate: '2026-04-01' });
    expect(journal('opening', first.id, true)!.net).toEqual({ 1300: -1000, 3400: 1000 });
    expect(db.prepare("SELECT COUNT(*) FROM sync_outbox WHERE entity_type = 'journal_entry'").pluck().get()).toBe(4);
    tied();
  });

  it('register close posts the variance, and cash in/out wait in 1199', async () => {
    await app.register.open(10_000);
    app.register.cashMovement({ kind: 'cash_out', amountPaise: 2000, reason: 'tea' });
    app.register.cashMovement({ kind: 'safe_drop', amountPaise: 1000, reason: 'safe' });
    const s = app.register.current()!;
    app.register.close({ countedCashPaise: 10_000 - 2000 - 1000 - 300 });
    expect(journal('register_close', s.id)!.net).toEqual({ 1100: -300, 5900: 300 });
    expect(db.prepare("SELECT COUNT(*) FROM journal_entry WHERE source = 'cash_movement'").pluck().get()).toBe(1);
    tied();
  });
});

describe('atomic and once (6b)', () => {
  it('a journal that cannot be written takes its sale with it, and a retried sale posts nothing twice', async () => {
    stock(10, 7000);
    await app.register.open(0);
    db.exec("CREATE TRIGGER fail_journal BEFORE INSERT ON journal_entry WHEN NEW.source = 'sale' BEGIN SELECT RAISE(ABORT, 'boom'); END;");
    expect(() => sell(1, (t) => [{ method: 'cash', amountPaise: t }])).toThrow(/boom/);
    expect(db.prepare('SELECT COUNT(*) FROM sale').pluck().get()).toBe(0);
    db.exec('DROP TRIGGER fail_journal');
    const d = SaleDraft.parse({ lines: [{ productId: soap, uomId: pcs, qtyMilli: 1000 }] });
    const input = CompleteSaleInput.parse({ ...d, commandId: newUlid(), expectedTotalPaise: 11_800, tenders: [{ method: 'cash', amountPaise: 11_800 }] });
    app.sales.complete(input);
    app.sales.complete(input);
    expect(db.prepare("SELECT COUNT(*) FROM journal_entry WHERE source = 'sale'").pluck().get()).toBe(1);
    tied();
  });
});
