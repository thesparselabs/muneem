import { beforeEach, describe, expect, it } from 'vitest';
import { newUlid } from '@muneem/domain';
import { firstPrintJobFor, reconcilePartiesDb, replayCheck, stockState, tieOutFailures, unpostedDocuments, type Db } from '@muneem/db-sqlite';
import {
  CompleteReturnInput, CompleteSaleInput, SaleDraft, type CreditNote, type Customer, type ReceiptDoc, type RefundMethod, type TenderLine,
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
let rice: string;
let ravi: Customer;

beforeEach(async () => {
  ({ app, db } = await testApp());
  api = caller(app);
  businessId = (await ownerAtTill(app)).businessId;
  pcs = (await api.data<{ id: string; code: string }[]>('catalog.listUoms')).find((u) => u.code === 'PCS')!.id;
  soap = (await api.data<{ id: string }>('products.create', { name: 'Soap', baseUomId: pcs, gstRateBp: 1800, sellingPricePaise: 11_800, priceIsInclusive: true })).id;
  rice = (await api.data<{ id: string }>('products.create', { name: 'Rice 1kg', baseUomId: pcs, gstRateBp: 500, sellingPricePaise: 6_001 })).id;
  app.inventory.setOpeningStock({ lines: [{ productId: soap, qtyMilli: 50_000, unitCostPaise: 7_000 }, { productId: rice, qtyMilli: 50_000, unitCostPaise: 4_333 }] });
  ravi = await api.data<Customer>('customers.create', { name: 'Ravi', creditDays: 15 });
  ravi = app.customers.setCreditLimit({ id: ravi.id, version: ravi.version, limitPaise: 10_000_000 });
  await api.data('pos.openRegister', { openingCashPaise: 100_000 });
});

const sell = (lines: [string, number][], tenders: (total: number) => TenderLine[], customerId?: string) => {
  const d = SaleDraft.parse({ lines: lines.map(([productId, qty]) => ({ productId, uomId: pcs, qtyMilli: qty * 1000 })), ...(customerId && { customerId }) });
  const total = app.sales.quote(d).totals.totalPaise;
  return app.sales.complete(CompleteSaleInput.parse({ ...d, commandId: newUlid(), expectedTotalPaise: total, tenders: tenders(total) }));
};
const giveBack = (saleId: string, lines: [number, number][], refundMethod?: RefundMethod) => {
  const draft = { saleId, lines: lines.map(([lineNo, qty]) => ({ lineNo, qtyMilli: qty })), ...(refundMethod && { refundMethod }) };
  const quote = app.returns.quote(draft);
  return app.returns.complete(CompleteReturnInput.parse({ ...draft, commandId: newUlid(), reason: 'customer changed mind', expectedTotalPaise: quote.totalPaise }));
};
const healthy = () => ({
  tieOuts: tieOutFailures(db, businessId), replay: replayCheck(db, businessId), parties: reconcilePartiesDb(db, businessId), unposted: unpostedDocuments(db, businessId),
});
const HEALTHY = { tieOuts: [], replay: [], parties: { mismatches: [], faults: [] }, unposted: [] };
const stock = (productId: string) => stockState(db, businessId, app.inventory.warehouseId(), productId);
const balance = () => app.customerLedger.ledger({ partyId: ravi.id, limit: 100 }).closingBalancePaise;

describe('returns against a cash sale (ADR-0043)', () => {
  it('a partial return is a numbered credit note with the line\'s own tax; stock comes back at cost and the drawer pays out', () => {
    const sale = sell([[soap, 3], [rice, 2]], (t) => [{ method: 'cash', amountPaise: t }]);
    const expectedBefore = app.register.xReport().expectedCashPaise!;
    const quote = app.returns.quote({ saleId: sale.saleId, lines: [{ lineNo: 1, qtyMilli: 1000 }] });
    expect(quote).toMatchObject({ refundMethod: 'cash', creditPaise: 0, completesSale: false, issues: [] });
    expect(quote.lines[0]).toMatchObject({ soldQtyMilli: 3000, returnableQtyMilli: 3000, qtyMilli: 1000, taxablePaise: 10_000, cgstPaise: 900, sgstPaise: 900, totalPaise: 11_800 });

    const r = giveBack(sale.saleId, [[1, 1000]]);
    expect(r).toMatchObject({ totalPaise: 11_800, refundMethod: 'cash', refundPaise: 11_800, replayed: false });
    expect(r.docNumber).toMatch(/^[A-Z0-9]{1,4}C\/\d{4}\/00001$/u);
    const note = app.returns.get(r.creditNoteId);
    expect(note).toMatchObject({ kind: 'return', saleId: sale.saleId, gstr1Bucket: 'cdnur', taxablePaise: 10_000, cgstPaise: 900, sgstPaise: 900, costPaise: 7_000 });
    expect(stock(soap).qtyMilli).toBe(48_000);
    expect(app.register.xReport()).toMatchObject({ returnsCount: 1, returnsTotalPaise: 11_800, cashRefundPaise: 11_800, expectedCashPaise: expectedBefore - 11_800 });
    expect(healthy()).toEqual(HEALTHY);

    const doc = firstPrintJobFor(db, r.creditNoteId)!.doc as ReceiptDoc;
    const text = renderText(layoutReceipt(doc, 42), 42);
    expect(text).toContain('CREDIT NOTE');
    expect(text).toContain(`Against: ${sale.docNumber}`);
    expect(text).toContain('REFUND CASH');
  });

  it('many partial returns add up to the line, the last takes the round-off, and the whole bill comes back exactly', () => {
    const sale = sell([[rice, 3]], (t) => [{ method: 'upi', amountPaise: t }]);
    const original = app.sales.get(sale.saleId);
    const notes = [giveBack(sale.saleId, [[1, 1000]]), giveBack(sale.saleId, [[1, 1000]]), giveBack(sale.saleId, [[1, 1000]])].map((n) => app.returns.get(n.creditNoteId));
    const sum = (k: keyof CreditNote) => notes.reduce((s, n) => s + (n[k] as number), 0);
    expect(sum('taxablePaise')).toBe(original.totals.taxablePaise);
    expect(sum('cgstPaise') + sum('sgstPaise')).toBe(original.totals.cgstPaise + original.totals.sgstPaise);
    expect(sum('totalPaise')).toBe(original.totals.totalPaise);
    expect(notes.map((n) => n.roundOffPaise).slice(0, 2)).toEqual([0, 0]);
    expect(notes[2]!.roundOffPaise).toBe(original.totals.roundOffPaise);
    expect(notes.every((n) => n.refundMethod === 'upi')).toBe(true);
    expect(app.sales.list({ limit: 5 }).items.find((s) => s.id === sale.saleId)?.returned).toBe('full');
    expect(stock(rice).qtyMilli).toBe(50_000);
    expect(healthy()).toEqual(HEALTHY);
  });

  it('refuses to return more than is left, in the service and in the database', async () => {
    const sale = sell([[soap, 2]], (t) => [{ method: 'cash', amountPaise: t }]);
    giveBack(sale.saleId, [[1, 1500]]);
    expect(app.returns.quote({ saleId: sale.saleId, lines: [{ lineNo: 1, qtyMilli: 1000 }] }).issues).toEqual([{ lineNo: 1, message: 'only 0.5 PCS of Soap is left to return' }]);
    const refused = await api.call('returns.complete', {
      saleId: sale.saleId, lines: [{ lineNo: 1, qtyMilli: 1000 }], commandId: newUlid(), reason: 'again', expectedTotalPaise: 0,
    });
    expect(refused).toMatchObject({ ok: false, error: { code: 'RETURN_QTY_EXCEEDED' } });
    const item = db.prepare('SELECT id FROM sale_item WHERE sale_id = ?').pluck().get(sale.saleId) as string;
    const note = db.prepare('SELECT id FROM credit_note LIMIT 1').pluck().get() as string;
    expect(() => db.prepare(`INSERT INTO credit_note_item (id, credit_note_id, business_id, line_no, sale_item_id, product_id, qty_milli, base_qty_milli,
      returned_before_milli, taxable_paise, total_paise) VALUES (?, ?, ?, 9, ?, ?, 1000, 1000, 0, 0, 0)`).run(newUlid(), note, businessId, item, soap)).toThrow(/RETURN_QTY_EXCEEDED/);
    expect(healthy()).toEqual(HEALTHY);
  });

  it('replays a retried command without a second note, and refuses a stale total', () => {
    const sale = sell([[soap, 2]], (t) => [{ method: 'cash', amountPaise: t }]);
    const input = CompleteReturnInput.parse({ saleId: sale.saleId, lines: [{ lineNo: 1, qtyMilli: 1000 }], commandId: newUlid(), reason: 'torn', expectedTotalPaise: 11_800 });
    const first = app.returns.complete(input);
    expect(app.returns.complete(input)).toEqual({ ...first, replayed: true });
    expect(() => app.returns.complete({ ...input, commandId: newUlid(), expectedTotalPaise: 1 })).toThrow(/now comes to/);
    expect(db.prepare('SELECT COUNT(*) FROM credit_note').pluck().get()).toBe(1);
  });

  it('a cash refund needs an open register', () => {
    const sale = sell([[soap, 1]], (t) => [{ method: 'cash', amountPaise: t }]);
    app.register.close({ countedCashPaise: app.register.xReport().expectedCashPaise! });
    expect(() => giveBack(sale.saleId, [[1, 1000]])).toThrow(/Open the register/);
    expect(giveBack(sale.saleId, [[1, 1000]], 'upi').refundMethod).toBe('upi');
    expect(healthy()).toEqual(HEALTHY);
  });
});

describe('returns against a credit sale', () => {
  it('reduce what the customer owes and settle the invoice first; the rest is refunded', () => {
    const sale = sell([[soap, 2]], (t) => [{ method: 'cash', amountPaise: t - 10_000 }, { method: 'credit', amountPaise: 10_000 }], ravi.id);
    expect(balance()).toBe(10_000);
    const r = giveBack(sale.saleId, [[1, 2000]]);
    expect(r).toMatchObject({ totalPaise: 23_600, creditPaise: 10_000, refundPaise: 13_600, refundMethod: 'cash' });
    expect(balance()).toBe(0);
    expect(app.payments.openItems('customer', ravi.id).charges).toEqual([]);
    expect(app.returns.get(r.creditNoteId)).toMatchObject({ allocatedPaise: 10_000, gstr1Bucket: 'cdnur' });
    expect(healthy()).toEqual(HEALTHY);
  });

  it('can credit the whole refund to the account, leaving an advance that later bills can use', () => {
    const sale = sell([[soap, 1]], (t) => [{ method: 'cash', amountPaise: t }], ravi.id);
    const r = giveBack(sale.saleId, [[1, 1000]], 'credit');
    expect(r).toMatchObject({ creditPaise: 11_800, refundPaise: 0 });
    expect(balance()).toBe(-11_800);
    expect(app.payments.openItems('customer', ravi.id).credits).toEqual([expect.objectContaining({ type: 'credit_note', id: r.creditNoteId, openPaise: 11_800 })]);
    const later = sell([[rice, 1]], (t) => [{ method: 'credit', amountPaise: t }], ravi.id);
    app.payments.allocate({ partyType: 'customer', partyId: ravi.id, creditType: 'credit_note', creditId: r.creditNoteId, allocation: 'auto' });
    expect(app.payments.openItems('customer', ravi.id).charges.find((c) => c.id === later.saleId)).toBeUndefined();
    expect(healthy()).toEqual(HEALTHY);
  });

  it('refuses a credit to an account when the bill has no customer', () => {
    const sale = sell([[soap, 1]], (t) => [{ method: 'cash', amountPaise: t }]);
    expect(() => giveBack(sale.saleId, [[1, 1000]], 'credit')).toThrow(/cannot be returned/);
  });
});

describe('cancelling a sale', () => {
  it('is one credit note for the whole bill, today, by a manager, and refused once anything is returned', async () => {
    const sale = sell([[soap, 2], [rice, 1]], (t) => [{ method: 'cash', amountPaise: t }]);
    const total = app.sales.get(sale.saleId).totals.totalPaise;
    grantRole(db, app, 'cashier');
    expect(await api.call('sales.cancel', { saleId: sale.saleId, reason: 'wrong bill' })).toMatchObject({ ok: false, error: { code: 'PERMISSION_DENIED' } });
    expect(await api.call('returns.complete', { saleId: sale.saleId, lines: [{ lineNo: 1, qtyMilli: 1000 }], commandId: newUlid(), reason: 'x', expectedTotalPaise: 0 }))
      .toMatchObject({ ok: false, error: { code: 'PERMISSION_DENIED' } });
    grantRole(db, app, 'manager');
    const cancelled = await api.data<{ creditNoteId: string; totalPaise: number }>('sales.cancel', { saleId: sale.saleId, reason: 'wrong bill' });
    expect(cancelled.totalPaise).toBe(total);
    const note = app.returns.get(cancelled.creditNoteId);
    expect(note).toMatchObject({ kind: 'cancel', reason: 'wrong bill', docDate: app.sales.get(sale.saleId).docDate });
    expect(db.prepare("SELECT COUNT(*) FROM audit_log WHERE action = 'sale.cancel'").pluck().get()).toBe(1);
    expect(() => app.returns.cancel({ saleId: sale.saleId, reason: 'again' })).toThrow(/already been returned/);
    expect(stock(soap).qtyMilli).toBe(50_000);
    expect(healthy()).toEqual(HEALTHY);
  });

  it('is refused for a bill that has been partly returned', () => {
    const sale = sell([[soap, 2]], (t) => [{ method: 'cash', amountPaise: t }]);
    giveBack(sale.saleId, [[1, 1000]]);
    expect(() => app.returns.cancel({ saleId: sale.saleId, reason: 'x' })).toThrow(/already been returned/);
  });

  it('lists credit notes newest first, by sale', () => {
    const a = sell([[soap, 2]], (t) => [{ method: 'cash', amountPaise: t }]);
    const b = sell([[rice, 1]], (t) => [{ method: 'cash', amountPaise: t }]);
    giveBack(a.saleId, [[1, 1000]]);
    app.returns.cancel({ saleId: b.saleId, reason: 'void' });
    expect(app.returns.list({ limit: 10 }).items.map((n) => n.kind)).toEqual(['cancel', 'return']);
    expect(app.returns.list({ saleId: a.saleId, limit: 10 }).items).toHaveLength(1);
  });
});
