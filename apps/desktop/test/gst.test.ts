import { beforeEach, describe, expect, it } from 'vitest';
import { computeSetoff, newUlid, taxOf, type GstHeads } from '@muneem/domain';
import {
  createProduct, gstBalancesAt, gstMonthReturn, gstPayableBalance, tieOutFailures, trialBalance, withTransaction, type Db,
} from '@muneem/db-sqlite';
import {
  CompleteReturnInput, CompleteSaleInput, CreatePurchaseInput, ExpenseInput, GstPaymentInput, ProductInput, PurchaseDraft, ReturnPurchaseInput, SaleDraft,
  payloadSchema, type Customer, type GstReturnSummary, type ReportResult, type Supplier, type TenderLine,
} from '@muneem/contracts';
import { verifyOperation } from '@muneem/sync-reference';
import type { App } from '../src/main/app.js';
import { caller, ownerAtTill, testApp } from './helpers.js';

const at = (day: string) => Date.parse(`${day}T06:30:00Z`);
let clock = at('2026-05-10');
let app: App;
let db: Db;
let api: ReturnType<typeof caller>;
let businessId: string;
let pcs: string;
const p: Record<'soap' | 'rice' | 'milk' | 'fridge', string> = { soap: '', rice: '', milk: '', fridge: '' };
let shree: Customer;
let mumbai: Customer;
let acme: Supplier;
let pune: Supplier;
const saved: { name: string; bytes: Buffer }[] = [];

const ZERO: GstHeads = { igstPaise: 0, cgstPaise: 0, sgstPaise: 0, cessPaise: 0 };

beforeEach(async () => {
  clock = at('2026-05-10');
  saved.length = 0;
  ({ app, db } = await testApp({ now: () => clock, saveFile: async (name, bytes) => { saved.push({ name, bytes }); return { saved: true, fileName: name }; } }));
  api = caller(app);
  businessId = (await ownerAtTill(app, { gstin: '07AAAAA0000A1Z5' })).businessId;
  pcs = (await api.data<{ id: string; code: string }[]>('catalog.listUoms')).find((u) => u.code === 'PCS')!.id;
  const product = async (name: string, o: Record<string, unknown>) => (await api.data<{ id: string }>('products.create', { name, baseUomId: pcs, ...o })).id;
  p.soap = await product('Soap', { hsnCode: '3401', gstRateBp: 1800, sellingPricePaise: 11_800, priceIsInclusive: true });
  p.rice = await product('Rice', { hsnCode: '1006', gstRateBp: 500, sellingPricePaise: 6_000, priceIsInclusive: false });
  p.milk = await product('Milk', { hsnCode: '0401', taxTreatment: 'nil_rated', gstRateBp: 0, sellingPricePaise: 3_000 });
  p.fridge = await product('Fridge', { hsnCode: '8418', gstRateBp: 1800, sellingPricePaise: 12_000_000, priceIsInclusive: true });
  app.inventory.setOpeningStock({ lines: Object.values(p).map((productId) => ({ productId, qtyMilli: 50_000, unitCostPaise: 1_000 })) });
  shree = app.customers.create({ name: 'Shree Traders', gstin: '07BBBBB0000B1Z5', stateCode: '07' });
  mumbai = app.customers.create({ name: 'Mumbai Walk-in', stateCode: '27' });
  acme = app.suppliers.create({ name: 'Acme', stateCode: '07', gstin: '07CCCCC0000C1Z5', taxScheme: 'regular', creditDays: 30 });
  pune = app.suppliers.create({ name: 'Pune Mills', stateCode: '27', gstin: '27DDDDD0000D1Z5', taxScheme: 'regular', creditDays: 30 });
  await app.register.open(100_000);
});

const cash = (t: number): TenderLine[] => [{ method: 'cash', amountPaise: t }];
function sell(lines: [string, number][], customerId?: string) {
  const d = SaleDraft.parse({ lines: lines.map(([productId, qty]) => ({ productId, uomId: pcs, qtyMilli: qty * 1000 })), ...(customerId && { customerId }) });
  const total = app.sales.quote(d).totals.totalPaise;
  return app.sales.complete(CompleteSaleInput.parse({ ...d, commandId: newUlid(), expectedTotalPaise: total, tenders: cash(total) }));
}
function giveBack(saleId: string, lineNo: number, qty: number) {
  const draft = { saleId, lines: [{ lineNo, qtyMilli: qty * 1000 }] };
  return app.returns.complete(CompleteReturnInput.parse({ ...draft, commandId: newUlid(), reason: 'returned', expectedTotalPaise: app.returns.quote(draft).totalPaise }));
}
function buy(supplierId: string, invoiceNo: string, date: string, lines: { productId: string; qty: number; price: number; itcEligible?: boolean }[]) {
  const draft = PurchaseDraft.parse({ supplierId, supplierInvoiceNo: invoiceNo, supplierInvoiceDate: date,
    lines: lines.map((l) => ({ productId: l.productId, uomId: pcs, qtyMilli: l.qty * 1000, unitPricePaise: l.price, ...(l.itcEligible === false && { itcEligible: false }) })) });
  return app.purchases.create(CreatePurchaseInput.parse({ ...draft, billTotalPaise: app.purchases.quote(draft).totals.totalPaise, commandId: newUlid() }));
}

// May: B2B, B2CS intra and inter, a B2CL bill, a nil-rated line, credit notes against each kind, purchases with and without ITC,
// a debit note and an expense with GST.
function may() {
  sell([[p.soap, 2], [p.milk, 1]]);
  const b2b = sell([[p.soap, 1], [p.rice, 2]], shree.id);
  const b2cl = sell([[p.fridge, 1]], mumbai.id);
  const inter = sell([[p.soap, 2]], mumbai.id);
  giveBack(b2b.saleId, 1, 1);
  giveBack(b2cl.saleId, 1, 1);
  giveBack(inter.saleId, 1, 1);
  const bought = buy(acme.id, 'A-101', '2026-05-04', [{ productId: p.soap, qty: 20, price: 7_000 }, { productId: p.rice, qty: 10, price: 4_000, itcEligible: false }]);
  buy(pune.id, 'P-9', '2026-05-06', [{ productId: p.rice, qty: 10, price: 4_000 }]);
  app.purchaseReturns.returnGoods(ReturnPurchaseInput.parse({ purchaseId: bought.id, reason: 'damaged', commandId: newUlid(), lines: [{ purchaseItemId: bought.lines[0]!.id, qtyMilli: 2000 }] }));
  app.expenses.create(ExpenseInput.parse({ categoryId: app.expenses.categories()[0]!.id, method: 'cash', amountPaise: 11_800, vendorGstin: '07EEEEE0000E1Z5', gstRateBp: 1800, commandId: newUlid() }));
}

const summary = async (month: string): Promise<GstReturnSummary> => app.gst.returns.summary(month);
const section = (s: GstReturnSummary, key: string) => s.sections.find((x) => x.section === key)!;
const run = (id: string, month: string): Promise<ReportResult> => app.reports.run(id, { month });

describe('GST returns from the documents (8c, ADR-0044)', () => {
  it('a May with every kind of supply: sections, GSTR-3B and the tie-out to the tax accounts', async () => {
    may();
    const s = await summary('2026-05-01');
    expect(s).toMatchObject({ applicable: true, missingHsn: 0, locked: false, setoffId: null });
    expect(s.tieOuts.filter((t) => t.returnPaise !== t.booksPaise)).toEqual([]);
    expect(s.tieOuts.find((t) => t.name.startsWith('output CGST'))).toMatchObject({ returnPaise: 1_800 + 900 + 300 - 900 });

    expect(section(s, 'b2b')).toMatchObject({ rows: 2, taxablePaise: 22_000, cgstPaise: 1_200, sgstPaise: 1_200 });
    expect((await run('gst.gstr1.b2cs', '2026-05-01')).rows).toEqual([
      { type: 'OE', pos: '07-Delhi', applicable: '', rate: 18, taxablePaise: 20_000, cessPaise: 0, ecom: '' },
      { type: 'OE', pos: '27-Maharashtra', applicable: '', rate: 18, taxablePaise: 10_000, cessPaise: 0, ecom: '' },
    ]);
    expect(section(s, 'b2cl')).toMatchObject({ rows: 1 });
    expect(section(s, 'cdnr')).toMatchObject({ rows: 1, taxablePaise: 10_000, cgstPaise: 900 });
    expect((await run('gst.gstr1.cdnur', '2026-05-01')).rows).toEqual([expect.objectContaining({ urType: 'B2CL', pos: '27-Maharashtra', rate: 18 })]);
    expect((await run('gst.gstr1.exemp', '2026-05-01')).rows).toContainEqual({ description: 'Intra-State supplies to unregistered persons', nilPaise: 3_000, exemptPaise: 0, nonGstPaise: 0 });
    expect((await run('gst.gstr1.docs', '2026-05-01')).rows).toEqual([
      expect.objectContaining({ nature: 'Invoices for outward supply', total: 4, cancelled: 0 }),
      expect.objectContaining({ nature: 'Credit Note', total: 3, cancelled: 0 }),
    ]);
    const hsn = (await run('gst.gstr1.hsn_b2c', '2026-05-01')).rows;
    expect(hsn.find((r) => r.hsn === '3401')).toMatchObject({ uqc: 'PCS-PIECES', qtyMilli: 3_000, taxablePaise: 30_000 });

    const g3b = Object.fromEntries(s.gstr3b.map((r) => [r.code, r]));
    expect(g3b['3.1c']).toMatchObject({ taxablePaise: 3_000 });
    expect(g3b['4A5']).toMatchObject({ igstPaise: 2_000, cgstPaise: 12_600 + 900, sgstPaise: 12_600 + 900 });
    expect(g3b['4B2']).toMatchObject({ cgstPaise: 1_260, sgstPaise: 1_260 });
    expect(g3b['4D2']).toMatchObject({ cgstPaise: 1_000, sgstPaise: 1_000 });
    const itc = await run('gst.itcRegister', '2026-05-01');
    expect(itc.rows.map((r) => r.kind)).toEqual(expect.arrayContaining(['Purchase', 'Debit note', 'Expense']));
    expect(itc.totals).toMatchObject({ eligibleCgstPaise: 12_600 + 900 - 1_260, ineligiblePaise: 2_000 });
    expect(tieOutFailures(db, businessId)).toEqual([]);
  });

  it('exports each GSTR-1 section in the offline tool\'s columns with no header lines', async () => {
    may();
    await app.reports.export('gst.gstr1.b2b', { month: '2026-05-01' }, 'csv');
    const lines = saved[0]!.bytes.toString('utf8').replace(/^﻿/u, '').trim().split('\r\n');
    expect(lines[0]).toBe('GSTIN/UIN of Recipient,Receiver Name,Invoice Number,Invoice date,Invoice Value,Place Of Supply,Reverse Charge,Applicable % of Tax Rate,Invoice Type,E-Commerce GSTIN,Rate,Taxable Value,Cess Amount');
    expect(lines).toHaveLength(3);
    expect(lines[1]).toMatch(/^07BBBBB0000B1Z5,Shree Traders,[A-Z0-9]+\/2627\/000002,10-May-2026,[\d.]+,07-Delhi,N,,Regular B2B,,5,120,0$/u);
    await app.reports.export('gst.gstr3b', { month: '2026-05-01' }, 'xlsx');
    expect(saved[1]!.name).toMatch(/GSTR-3B summary/u);
  });

  it('a late purchase into a locked month is reported in the next open month, and both months still tie out', async () => {
    may();
    clock = at('2026-06-05');
    app.periods.lock('2026-05-01');
    buy(acme.id, 'A-150', '2026-05-28', [{ productId: p.soap, qty: 1, price: 7_000 }]);
    const may5 = gstMonthReturn(db, businessId, '2026-05-01', true);
    const june = gstMonthReturn(db, businessId, '2026-06-01', true);
    expect(june.inward.map((l) => l.supplierInvoiceNo)).toEqual(['A-150']);
    expect(may5.inward.map((l) => l.supplierInvoiceNo)).not.toContain('A-150');
    expect([...may5.tieOuts, ...june.tieOuts].filter((t) => t.returnPaise !== t.booksPaise)).toEqual([]);
  });

  it('a composition business has no GSTR-1 or set-off here', async () => {
    const other = await testApp({ now: () => clock });
    await ownerAtTill(other.app, { taxScheme: 'composition' });
    const r = await caller(other.app).data<GstReturnSummary>('gst.returnSummary', { month: '2026-04-01' });
    expect(r).toMatchObject({ applicable: false, sections: [] });
    expect((await caller(other.app).data<{ blockers: string[] }>('gst.previewSetoff', { month: '2026-04-01' })).blockers)
      .toContain('Only a business under the regular scheme sets off GST');
  });
});

describe('HSN on products (8c)', () => {
  it('a GST-registered regular business must give a new product an HSN; older ones are listed', async () => {
    expect(await api.call('products.create', { name: 'Pen', baseUomId: pcs, gstRateBp: 1200 }))
      .toMatchObject({ ok: false, error: { code: 'VALIDATION_FAILED', fields: { hsnCode: expect.any(String) } } });
    withTransaction(db, () => createProduct(db, businessId, ProductInput.parse({ name: 'Old stock', baseUomId: pcs }), { userId: 'u', deviceId: 'd', terminalId: null }, '2026-05-10'));
    expect((await app.reports.run('gst.productsMissingHsn', {})).rows).toEqual([{ name: 'Old stock', sku: null, soldLines: 0 }]);
  });
});

describe('set-off and payment documents (8c, ADR-0044)', () => {
  const postSetoff = (month: string) => {
    try {
      return { ok: true as const, data: app.gst.setoffs.post({ month, commandId: newUlid() }) };
    } catch (e) {
      return { ok: false as const, error: { code: (e as { code?: string }).code } };
    }
  };

  it('May is set off in the statutory order, the books follow, June is paid by challan, and everything ties out', async () => {
    may();
    expect((await api.data<{ blockers: string[] }>('gst.previewSetoff', { month: '2026-05-01' })).blockers).toEqual(['Only a month that has ended can be set off']);
    clock = at('2026-06-05');
    const before = gstBalancesAt(db, businessId, '2026-05-31');
    const preview = app.gst.setoffs.preview('2026-05-01');
    expect(preview).toMatchObject({ liability: before.output, credit: before.input, blockers: [] });
    expect(preview).toMatchObject(computeSetoff(before.output, before.input));
    expect(preview.creditLeft.igstPaise).toBe(0);

    const posted = await postSetoff('2026-05-01');
    expect(posted).toMatchObject({ ok: true, data: { docNumber: expect.stringMatching(/^[A-Z0-9]{1,4}S\/2627\/00001$/u) } });
    const after = gstBalancesAt(db, businessId, '2026-05-31');
    expect(after.output).toEqual(ZERO);
    expect(after.input).toEqual(preview.creditLeft);
    expect(await postSetoff('2026-05-01')).toMatchObject({ ok: false, error: { code: 'INVALID_STATE' } });
    expect(app.gst.setoffs.preview('2026-04-01').blockers).toEqual(['2026-05 is already set off; months are set off in order']);

    sell([[p.fridge, 1]], shree.id);
    clock = at('2026-07-03');
    const june = { data: app.gst.setoffs.post({ month: '2026-06-01', commandId: newUlid() }) };
    const due = taxOf(june.data.cash);
    expect(due).toBeGreaterThan(0);
    expect(gstPayableBalance(db, businessId)).toBe(due);
    const challan = app.gst.payments.record(GstPaymentInput.parse({
      commandId: newUlid(), paymentDate: '2026-07-03', challanRef: 'CPIN26070300001', month: '2026-06-01', ...june.data.cash,
    }));
    expect(challan).toMatchObject({ docNumber: expect.stringMatching(/G\/2627\/00001$/u), totalPaise: due });
    expect(gstPayableBalance(db, businessId)).toBe(0);
    expect(app.gst.payments.ledger()).toMatchObject({ payablePaise: 0, setoffs: [expect.anything(), expect.anything()], payments: [expect.anything()] });

    const tb = trialBalance(db, { businessId, to: '2026-07-31', branchId: null });
    expect(tb.debitPaise).toBe(tb.creditPaise);
    expect(tieOutFailures(db, businessId)).toEqual([]);
    const s = await summary('2026-05-01');
    expect(s.setoffId).toBe((posted as { ok: true; data: { id: string } }).data.id);
    expect(s.tieOuts.filter((t) => t.returnPaise !== t.booksPaise)).toEqual([]);

    for (const row of db.prepare("SELECT entity_type, operation_type, payload_json FROM sync_outbox WHERE entity_type IN ('gst_setoff', 'gst_payment')").all() as { entity_type: string; operation_type: string; payload_json: string }[]) {
      const payload = JSON.parse(row.payload_json) as Record<string, unknown>;
      expect(payloadSchema(row.entity_type, row.operation_type).safeParse(payload).success).toBe(true);
      expect(verifyOperation(row.entity_type, row.operation_type, payload)).toBeNull();
    }
  });

  it('a locked month can be neither set off nor paid into', async () => {
    may();
    clock = at('2026-06-05');
    app.periods.lock('2026-05-01');
    expect(await postSetoff('2026-05-01')).toMatchObject({ ok: false, error: { code: 'PERIOD_LOCKED' } });
    expect(() => app.gst.payments.record(GstPaymentInput.parse({ commandId: newUlid(), paymentDate: '2026-05-20', challanRef: 'X1', cgstPaise: 100 })))
      .toThrow(/locked/u);
    expect(await api.call('gst.recordPayment', { commandId: newUlid(), paymentDate: '2026-06-05', challanRef: 'X1' }))
      .toMatchObject({ ok: false, error: { code: 'VALIDATION_FAILED' } });
  });

  it('a retried command posts once', async () => {
    may();
    clock = at('2026-06-05');
    const commandId = newUlid();
    const a = await api.data<{ id: string }>('gst.postSetoff', { month: '2026-05-01', commandId });
    const b = app.gst.setoffs.post({ month: '2026-05-01', commandId });
    expect(b.id).toBe(a.id);
    expect(db.prepare('SELECT COUNT(*) FROM gst_setoff').pluck().get()).toBe(1);
  });
});
