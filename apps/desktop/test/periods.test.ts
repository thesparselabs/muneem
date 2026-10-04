import { beforeEach, describe, expect, it } from 'vitest';
import { newUlid } from '@muneem/domain';
import { tieOutFailures, unpostedDocuments, type Db } from '@muneem/db-sqlite';
import {
  CompleteSaleInput, CreatePurchaseInput, ExpenseInput, PaymentInput, ReturnPurchaseInput, SaleDraft, WriteOffInput, type Customer, type LatePosting, type Supplier,
} from '@muneem/contracts';
import type { App } from '../src/main/app.js';
import { caller, ownerAtTill, testApp } from './helpers.js';

let app: App;
let db: Db;
let api: ReturnType<typeof caller>;
let businessId: string;
let pcs: string;
let soap: string;
let ravi: Customer;
let acme: Supplier;
const today = new Date().toLocaleDateString('en-CA');
const thisMonth = `${today.slice(0, 7)}-01`;
const monthsAgo = (n: number) => { const d = new Date(`${thisMonth}T00:00:00Z`); d.setUTCMonth(d.getUTCMonth() - n); return d.toISOString().slice(0, 10); };

beforeEach(async () => {
  ({ app, db } = await testApp());
  api = caller(app);
  businessId = (await ownerAtTill(app)).businessId;
  pcs = (await api.data<{ id: string; code: string }[]>('catalog.listUoms')).find((u) => u.code === 'PCS')!.id;
  soap = (await api.data<{ id: string }>('products.create', { name: 'Soap', baseUomId: pcs, gstRateBp: 1800, sellingPricePaise: 11_800, priceIsInclusive: true })).id;
  ravi = app.customers.create({ name: 'Ravi' });
  ravi = app.customers.setCreditLimit({ id: ravi.id, version: ravi.version, limitPaise: 1_000_000 });
  acme = app.suppliers.create({ name: 'Acme', stateCode: '07', gstin: '07AAAAA0000A1Z5', taxScheme: 'regular', creditDays: 30 });
});

const pay = (partyType: 'customer' | 'supplier', amountPaise: number, paymentDate?: string) =>
  app.payments.create(PaymentInput.parse({ partyType, partyId: partyType === 'customer' ? ravi.id : acme.id, amountPaise, method: 'bank', commandId: newUlid(), ...(paymentDate && { paymentDate }) }));
const entry = (refId: string) => db.prepare('SELECT entry_date, doc_date, late_posting FROM journal_entry WHERE ref_id = ? AND is_reversal_of IS NULL').get(refId);

describe('periods and late postings (6c, ADR-0033)', () => {
  it('only a month that has ended can be locked', async () => {
    expect(await api.call('accounting.lockPeriod', { periodStart: thisMonth })).toMatchObject({ ok: false, error: { code: 'INVALID_STATE' } });
    expect(() => app.periods.lock('2999-01-01')).toThrow(/ended/);
    expect(app.periods.lock(monthsAgo(1))).toMatchObject({ periodStart: monthsAgo(1), status: 'locked' });
  });

  it('a document dated into a locked month posts late into the earliest open month after it, flagged and listed', () => {
    app.periods.lock(monthsAgo(2));
    app.periods.lock(monthsAgo(1));
    const backdated = `${monthsAgo(2).slice(0, 8)}15`;
    const p = pay('customer', 5000, backdated);
    expect(entry(p.id)).toEqual({ entry_date: thisMonth, doc_date: backdated, late_posting: 1 });
    expect(app.periods.latePostings()).toEqual([expect.objectContaining<Partial<LatePosting>>({ refId: p.id, docDate: backdated, entryDate: thisMonth })]);
    expect(db.prepare("SELECT COUNT(*) FROM audit_log WHERE action = 'journal.late_posting'").pluck().get()).toBe(1);
    expect(tieOutFailures(db, businessId)).toEqual([]);
  });

  it('unlocking needs a reason, and then the month takes postings again', async () => {
    app.periods.lock(monthsAgo(1));
    expect(await api.call('accounting.unlockPeriod', { periodStart: monthsAgo(1), reason: '' })).toMatchObject({ ok: false, error: { code: 'VALIDATION_FAILED' } });
    expect(app.periods.unlock(monthsAgo(1), 'GSTR-1 amended')).toMatchObject({ status: 'open', unlockReason: 'GSTR-1 amended' });
    const p = pay('customer', 5000, `${monthsAgo(1).slice(0, 8)}10`);
    expect(entry(p.id)).toMatchObject({ late_posting: 0 });
  });
});

const journalsOff = () => db.exec(`
  CREATE TRIGGER off_je BEFORE INSERT ON journal_entry BEGIN SELECT RAISE(IGNORE); END;
  CREATE TRIGGER off_jl BEFORE INSERT ON journal_line BEGIN SELECT RAISE(IGNORE); END;
  CREATE TRIGGER off_ab BEFORE INSERT ON account_balance BEGIN SELECT RAISE(IGNORE); END;`);
const journalsOn = () => db.exec('DROP TRIGGER off_je; DROP TRIGGER off_jl; DROP TRIGGER off_ab;');

describe('backfill of documents saved before Stage 6 (6c, ADR-0034)', () => {

  it('posts every kind of document, cancels as reversals, ties out, and posts nothing the second time', async () => {
    journalsOff();
    await app.register.open(10_000);
    const d = SaleDraft.parse({ lines: [{ productId: soap, uomId: pcs, qtyMilli: 2000 }], customerId: ravi.id });
    app.sales.complete(CompleteSaleInput.parse({ ...d, commandId: newUlid(), expectedTotalPaise: 23_600, tenders: [{ method: 'cash', amountPaise: 3600 }, { method: 'credit', amountPaise: 20_000 }] }));
    const p = app.purchases.create(CreatePurchaseInput.parse({ supplierId: acme.id, supplierInvoiceNo: 'B1', supplierInvoiceDate: today, billTotalPaise: 119_000, commandId: newUlid(),
      lines: [{ productId: soap, uomId: pcs, qtyMilli: 10_000, unitPricePaise: 10_000 }], charges: [{ kind: 'freight', amountPaise: 1000 }] }));
    app.purchaseReturns.returnGoods(ReturnPurchaseInput.parse({ purchaseId: p.id, reason: 'x', commandId: newUlid(), lines: [{ purchaseItemId: p.lines[0]!.id, qtyMilli: 1000 }] }));
    const cancelled = pay('customer', 4000);
    app.payments.cancel(cancelled.id, 'bounced');
    pay('supplier', 30_000);
    app.customerLedger.setOpening({ partyId: ravi.id, amountPaise: 5000, asOfDate: '2026-04-01' });
    const opening = app.customerLedger.setOpening({ partyId: ravi.id, amountPaise: 6000, asOfDate: '2026-04-01' });   // replaces the first
    app.writeOffs.create(WriteOffInput.parse({ customerId: ravi.id, items: [{ type: 'opening', id: opening.id, amountPaise: 1000 }], reason: 'x', commandId: newUlid() }));
    const cat = app.expenses.categories()[0]!.id;
    const e = app.expenses.create(ExpenseInput.parse({ categoryId: cat, method: 'cash', amountPaise: 2000, commandId: newUlid() }));
    app.expenses.cancel(e.id, 'dup');
    app.inventory.adjust({ lines: [{ productId: soap, qtyMilli: -1000, reason: 'damage' }] });
    app.register.cashMovement({ kind: 'cash_out', amountPaise: 500, reason: 'tea' });
    app.register.close({ countedCashPaise: 10_000 + 3600 - 500 - 100 });
    journalsOn();

    const pending = unpostedDocuments(db, businessId);
    expect(new Set(pending.map((x) => x.kind))).toEqual(new Set(['sale', 'purchase', 'debit_note', 'payment', 'party_opening', 'write_off', 'expense', 'stock_document', 'cost_correction', 'register_close', 'cash_movement']));
    const first = await api.data<{ posted: number; remaining: number }>('accounting.postBacklog');
    expect(first).toEqual({ posted: pending.length, remaining: 0 });
    expect(db.prepare('SELECT COUNT(*) FROM journal_entry WHERE is_reversal_of IS NOT NULL').pluck().get()).toBe(3);   // payment, expense, replaced opening
    expect(tieOutFailures(db, businessId)).toEqual([]);
    expect(await app.backlog.run()).toEqual({ posted: 0, remaining: 0 });
    const unqueued = db.prepare(`SELECT COUNT(*) FROM journal_entry j WHERE NOT EXISTS
      (SELECT 1 FROM sync_outbox o WHERE o.business_id = j.business_id AND o.entity_type = 'journal_entry' AND o.entity_id = j.id)`).pluck().get();
    expect(unqueued).toBe(0);
    const saleJournal = db.prepare(`SELECT o.depends_on_operation_id FROM sync_outbox o JOIN journal_entry j ON j.id = o.entity_id WHERE j.source = 'sale'`).pluck().get();
    expect(saleJournal).toBe(db.prepare("SELECT operation_id FROM sync_outbox WHERE entity_type = 'sale' ORDER BY seq DESC LIMIT 1").pluck().get());
  });

  it('documents whose journal would be empty are not candidates', async () => {
    journalsOff();
    await app.register.open(1000);
    app.register.close({ countedCashPaise: 1000 });
    journalsOn();
    expect(unpostedDocuments(db, businessId)).toEqual([]);
  });
});

describe('journal integrity (6c, ADR-0034)', () => {
  it('rebuilds a drifted balance cache, and reports what it must not rewrite', async () => {
    await app.register.open(0);
    app.inventory.setOpeningStock({ lines: [{ productId: soap, qtyMilli: 5000, unitCostPaise: 7000 }] });
    expect(app.diagnostics.checkJournals()).toBe('ok');
    db.exec('UPDATE account_balance SET debit_paise = debit_paise + 1 WHERE rowid = (SELECT MIN(rowid) FROM account_balance)');
    expect(app.diagnostics.checkJournals()).toBe('healed');
    expect(app.diagnostics.checkJournals()).toBe('ok');
    db.exec("UPDATE stock_level SET value_paise = value_paise + 100");
    expect(app.diagnostics.checkJournals()).toBe('mismatch');
    expect(db.prepare('SELECT COUNT(*) FROM journal_entry').pluck().get()).toBe(1);
  });
});

describe('6g review fixes', () => {
  it("cancels need no terminal and reverse under the original's till; an opening without one is refused clearly", () => {
    const p = pay('customer', 4000);
    const e = app.expenses.create(ExpenseInput.parse({ categoryId: app.expenses.categories()[0]!.id, method: 'bank', amountPaise: 2000, commandId: newUlid() }));
    const original = db.prepare('SELECT branch_id, terminal_id FROM journal_entry WHERE ref_id = ?').get(p.id);
    app.session.patch({ branchId: null, terminalId: null });
    app.payments.cancel(p.id, 'bounced');
    app.expenses.cancel(e.id, 'dup');
    expect(db.prepare('SELECT branch_id, terminal_id FROM journal_entry WHERE ref_id = ? AND is_reversal_of IS NOT NULL').get(p.id)).toEqual(original);
    expect(() => app.customerLedger.setOpening({ partyId: ravi.id, amountPaise: 5000, asOfDate: '2026-04-01' })).toThrow(/terminal/);
    expect(tieOutFailures(db, businessId)).toEqual([]);
  });

  it('a business with no chart yet can open its cash book and add an account', async () => {
    const fresh = await testApp();
    fresh.db.exec('CREATE TRIGGER off_acc BEFORE INSERT ON account BEGIN SELECT RAISE(IGNORE); END;');
    await ownerAtTill(fresh.app);
    fresh.db.exec('DROP TRIGGER off_acc;');
    expect(fresh.app.statements.book('cash', { limit: 10 }).items).toEqual([]);
    expect(fresh.app.chart.create({ code: '5480', name: 'Courier', parentCode: '5000' })).toMatchObject({ code: '5480' });
  });

  it('a manual journal reversed twice is refused as already reversed, and the day book says so', async () => {
    const accounts = app.statements.accounts();
    const cash = accounts.find((a) => a.role === 'cash')!.id;
    const drawings = accounts.find((a) => a.code === '3300')!.id;
    const j = app.manualJournals.post({ narration: 'drawings', commandId: newUlid(), lines: [{ accountId: drawings, debitPaise: 500, creditPaise: 0 }, { accountId: cash, debitPaise: 0, creditPaise: 500 }] });
    const rev = app.manualJournals.reverse(j.id, 'typo');
    expect(await api.call('accounting.reverseJournal', { id: j.id, reason: 'again' })).toMatchObject({ ok: false, error: { code: 'INVALID_STATE', message: expect.stringMatching(/already reversed/) } });
    const items = app.statements.dayBook({ from: today, to: today, limit: 50 }).items;
    expect(items.find((x) => x.id === j.id)?.reversedBy).toBe(rev.id);
  });

  it('the backlog stops when the session moves to another business, and never numbers with its terminal', async () => {
    await app.register.open(100_000);
    journalsOff();
    for (let i = 0; i < 201; i++) app.register.cashMovement({ kind: 'cash_out', amountPaise: 1, reason: `m${i}` });
    journalsOn();
    const run = app.backlog.run();
    app.business.create({ name: 'Second Shop', businessType: 'retail', stateCode: '07', taxScheme: 'regular' } as Parameters<App['business']['create']>[0]);
    expect(app.session.require().businessId).not.toBe(businessId);
    expect(await run).toEqual({ posted: 200, remaining: 1 });
    expect(db.prepare('SELECT COUNT(*) FROM journal_entry WHERE business_id <> ?').pluck().get(businessId)).toBe(0);
  });
});
