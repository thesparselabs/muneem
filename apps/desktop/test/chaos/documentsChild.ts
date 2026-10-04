// Child for the power-loss suite: sets a shop up once, then posts one kind of document until it is killed.
import {
  CompleteReturnInput, CompleteSaleInput, CreatePurchaseInput, CustomerInput, GstPaymentInput, PaymentInput, ProductInput, PurchaseDraft,
  ReturnPurchaseInput, SaleDraft, WriteOffInput,
} from '@muneem/contracts';
import { fyBounds, newUlid, nextMonthStart } from '@muneem/domain';
import { getMeta, latestSetoffMonth, setMeta } from '@muneem/db-sqlite';
import { caller, ownerAtTill, testApp } from '../helpers.js';
import { DOCUMENT_KINDS, type DocumentKind } from './documentKinds.js';

const [file, kind] = process.argv.slice(2) as [string, DocumentKind];
if (!DOCUMENT_KINDS.includes(kind)) throw new Error(`unknown kind ${kind}`);

const at = (day: string) => Date.parse(`${day}T06:30:00Z`);
// Set-off and year-end walk through months and years; the clock follows the books, so a restart picks up where the kill landed.
const START: Partial<Record<DocumentKind, string>> = { setoff: '2024-04-01', yearEnd: '2020-03-01' };
let clock = START[kind] ? at(START[kind]) : Date.now();
const now = () => (START[kind] ? clock : Date.now());
const today = () => new Date(now()).toLocaleDateString('en-CA');
const { app, db } = await testApp({ dbFile: file, now });

interface Shop { pcs: string; products: string[]; customerId: string; local: string; interstate: string }
const READY = 'chaos.shop';

async function setUp(): Promise<Shop> {
  await ownerAtTill(app, { gstin: '07AAAAA0000A1Z5' });
  await caller(app).data('printer.setConfig', { kind: 'none' });
  const pcs = app.catalog.listUoms().find((u) => u.code === 'PCS')!.id;
  const products = Array.from({ length: 12 }, (_, i) => app.products.create(ProductInput.parse({
    name: `Item ${i}`, baseUomId: pcs, hsnCode: '3401', gstRateBp: [0, 500, 1200, 1800][i % 4], sellingPricePaise: 2_000 + i * 137, priceIsInclusive: i % 2 === 0,
  })).id);
  app.inventory.setOpeningStock({ lines: products.map((productId) => ({ productId, qtyMilli: 100_000_000, unitCostPaise: 900 })) });
  const c = app.customers.create(CustomerInput.parse({ name: 'Credit customer', creditDays: 30 }));
  const customerId = app.customers.setCreditLimit({ id: c.id, version: c.version, limitPaise: 1_000_000_000_00 }).id;
  const local = app.suppliers.create({ name: 'Delhi Traders', stateCode: '07', gstin: '07CCCCC0000C1Z5', taxScheme: 'regular', creditDays: 30 }).id;
  const interstate = app.suppliers.create({ name: 'Pune Traders', stateCode: '27', gstin: '27DDDDD0000D1Z5', taxScheme: 'regular', creditDays: 30 }).id;
  await app.register.open(0);
  return { pcs, products, customerId, local, interstate };
}

const raw = getMeta(db, READY);
const shop: Shop = raw ? JSON.parse(raw) as Shop : await setUp();
if (raw) await caller(app).data('auth.login', { identifier: '9999999999', password: 'correct-horse' });
else setMeta(db, READY, JSON.stringify(shop));
process.stdout.write('ready\n');

const count = (sql: string, ...args: unknown[]) => db.prepare(sql).pluck().get(...args) as number;
const latest = (sql: string, ...args: unknown[]) => db.prepare(sql).pluck().get(...args) as string | undefined;

function sell(n: number, credit = false): string {
  const lines = Array.from({ length: 1 + (n % 4) }, (_, i) => ({ productId: shop.products[(n * 5 + i * 3) % shop.products.length]!, uomId: shop.pcs, qtyMilli: 1000 * (1 + (i % 3)) }));
  const draft = SaleDraft.parse({ lines, ...(credit && { customerId: shop.customerId }) });
  const total = app.sales.quote(draft).totals.totalPaise;
  const tenders = credit ? [{ method: 'credit' as const, amountPaise: total }] : [{ method: 'cash' as const, amountPaise: total + (n % 3) * 100 }];
  return app.sales.complete(CompleteSaleInput.parse({ ...draft, commandId: newUlid(), expectedTotalPaise: total, tenders })).saleId;
}

function buy(n: number, invoiceDate = today()): string {
  const supplierId = n % 2 === 0 ? shop.local : shop.interstate;
  const draft = PurchaseDraft.parse({
    supplierId, supplierInvoiceNo: `INV-${n}-${newUlid().slice(-6)}`, supplierInvoiceDate: invoiceDate,
    lines: Array.from({ length: 1 + (n % 3) }, (_, i) => ({ productId: shop.products[(n + i * 5) % shop.products.length]!, uomId: shop.pcs, qtyMilli: 10_000 * (1 + i), unitPricePaise: 800 + i * 50 })),
    charges: n % 3 === 0 ? [{ kind: 'freight', amountPaise: 2_500 }] : [],
  });
  return app.purchases.create(CreatePurchaseInput.parse({ ...draft, billTotalPaise: app.purchases.quote(draft).totals.totalPaise, commandId: newUlid() })).id;
}

function takeBack(saleId: string, n: number): void {
  if (n % 5 === 4) { app.returns.cancel({ saleId, reason: 'billed by mistake' }); return; }
  const back = { saleId, lines: [{ lineNo: 1, qtyMilli: 1000 }], ...(n % 2 === 0 && { refundMethod: 'upi' as const }) };
  app.returns.complete(CompleteReturnInput.parse({ ...back, commandId: newUlid(), reason: 'damaged', expectedTotalPaise: app.returns.quote(back).totalPaise }));
}

const STEPS: Record<DocumentKind, (n: number) => void> = {
  returns: (n) => {
    const pending = latest('SELECT s.id FROM sale s WHERE NOT EXISTS (SELECT 1 FROM credit_note c WHERE c.sale_id = s.id) ORDER BY s.rowid DESC LIMIT 1');
    takeBack(pending ?? sell(n, n % 3 === 1), n);
  },
  purchases: (n) => {
    const id = buy(n);
    if (n % 3 === 1) {
      const line = db.prepare('SELECT id FROM purchase_item WHERE purchase_id = ? ORDER BY rowid LIMIT 1').pluck().get(id) as string;
      app.purchaseReturns.returnGoods(ReturnPurchaseInput.parse({ purchaseId: id, reason: 'torn packs', commandId: newUlid(), lines: [{ purchaseItemId: line, qtyMilli: 2000 }] }));
    } else if (n % 3 === 2) {
      app.purchaseReturns.cancel(id, 'entered twice');
    }
  },
  payments: (n) => {
    if (n % 2 === 0) {
      sell(n, true);
      app.payments.create(PaymentInput.parse({ partyType: 'customer', partyId: shop.customerId, amountPaise: 1_000 + n * 7, method: n % 4 === 0 ? 'cash' : 'upi', commandId: newUlid() }));
    } else {
      buy(n);
      app.payments.create(PaymentInput.parse({ partyType: 'supplier', partyId: n % 4 === 1 ? shop.local : shop.interstate, amountPaise: 5_000 + n * 11, method: 'cash', commandId: newUlid() }));
    }
    if (n % 5 === 3) {
      const own = latest("SELECT id FROM payment WHERE status = 'posted' ORDER BY rowid DESC LIMIT 1");
      if (own) app.payments.cancel(own, 'cheque bounced');
    }
    if (n % 7 === 6) {
      const open = app.payments.openItems('customer', shop.customerId).charges.find((c) => c.type === 'sale' && c.openPaise > 100);
      if (open) app.writeOffs.create(WriteOffInput.parse({ customerId: shop.customerId, items: [{ type: 'sale', id: open.id, amountPaise: 100 }], reason: 'not recoverable', commandId: newUlid() }));
    }
  },
  setoff: (n) => {
    const settled = latestSetoffMonth(db, businessId());
    const month = settled ? nextMonthStart(settled) : START.setoff!;
    clock = at(`${month.slice(0, 8)}10`);
    if (count('SELECT COUNT(*) FROM sale WHERE doc_date >= ? AND doc_date < ?', month, nextMonthStart(month)) === 0) {
      if (month.slice(5, 7) <= '06') buy(n, `${month.slice(0, 8)}02`); // later months have output tax left to pay by challan
      sell(n);
      sell(n + 1, true);
    }
    clock = at(`${nextMonthStart(month).slice(0, 8)}03`);
    const setoff = app.gst.setoffs.post({ month, commandId: newUlid() });
    const cash = setoff.cash;
    if (cash.igstPaise + cash.cgstPaise + cash.sgstPaise + cash.cessPaise > 0) {
      app.gst.payments.record(GstPaymentInput.parse({ commandId: newUlid(), paymentDate: today(), challanRef: `CPIN${n}`, month, ...cash }));
    }
  },
  yearEnd: (n) => {
    const closed = db.prepare('SELECT fy FROM fy_close ORDER BY fy DESC LIMIT 1').pluck().get() as string | undefined;
    const fy = closed ? nextFy(closed) : '2019-20';
    const { start, end } = fyBounds(fy);
    clock = at(`${end.slice(0, 8)}10`);
    if (count('SELECT COUNT(*) FROM sale WHERE fy = ?', fy) === 0) {
      buy(n, `${end.slice(0, 8)}02`);
      sell(n);
    }
    clock = at(`${nextMonthStart(end).slice(0, 8)}05`);
    const march = `${end.slice(0, 8)}01`;
    if ((latestSetoffMonth(db, businessId()) ?? '') < march) app.gst.setoffs.post({ month: march, commandId: newUlid() });
    for (let m = start; m <= end; m = nextMonthStart(m)) {
      if (latest('SELECT status FROM accounting_period WHERE period_start = ?', m) !== 'locked') app.periods.lock(m);
    }
    app.yearEnd.close(fy);
  },
};

function nextFy(fy: string): string {
  const y = Number(fy.slice(0, 4)) + 1;
  return `${y}-${String((y + 1) % 100).padStart(2, '0')}`;
}
function businessId(): string { return app.session.require().businessId!; }

for (let n = count('SELECT COUNT(*) FROM audit_log'); ; n++) {
  STEPS[kind](n);
  await new Promise((r) => setImmediate(r));
}
