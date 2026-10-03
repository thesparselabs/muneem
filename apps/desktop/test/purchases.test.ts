import { beforeEach, describe, expect, it } from 'vitest';
import { newUlid } from '@muneem/domain';
import { reconcilePartiesDb, replayCheck, stockState, type Db } from '@muneem/db-sqlite';
import { CreatePurchaseInput, ReturnPurchaseInput, type DebitNote, type Purchase, type PurchaseImportPreview, type PurchaseQuote, type Supplier } from '@muneem/contracts';
import type { App } from '../src/main/app.js';
import { caller, ownerAtTill, testApp } from './helpers.js';

let app: App;
let db: Db;
let api: ReturnType<typeof caller>;
let businessId: string;
let pcs: string;
let box: string;
let soap: string;
let rice: string;
let local: Supplier;

beforeEach(async () => {
  ({ app, db } = await testApp());
  api = caller(app);
  businessId = (await ownerAtTill(app)).businessId;
  const uoms = await api.data<{ id: string; code: string }[]>('catalog.listUoms');
  pcs = uoms.find((u) => u.code === 'PCS')!.id;
  box = uoms.find((u) => u.code === 'BOX')!.id;
  soap = (await api.data<{ id: string }>('products.create', {
    name: 'Lux Soap', sku: 'LUX', baseUomId: pcs, gstRateBp: 1800, sellingPricePaise: 15_000, barcodes: [{ code: '8901030865275' }],
    conversions: [{ fromUomId: box, factorMilli: 12_000 }],
  })).id;
  rice = (await api.data<{ id: string }>('products.create', { name: 'Rice', sku: 'RICE', baseUomId: pcs, gstRateBp: 500, sellingPricePaise: 6000 })).id;
  local = await supplier({ name: 'Acme Traders', stateCode: '07', gstin: '07AAAAA0000A1Z5', creditDays: 30 });
});

const supplier = (input: Record<string, unknown>) => api.data<Supplier>('suppliers.create', input);
const level = (productId: string) => stockState(db, businessId, app.inventory.warehouseId(), productId);
const clean = () => {
  expect(reconcilePartiesDb(db, businessId)).toEqual({ mismatches: [], faults: [] });
  expect(replayCheck(db, businessId)).toEqual([]);
};

// 10 soap @ ₹100 (18%) and 5 rice @ ₹50 (5%) with ₹100 freight: ₹1,180 + ₹262.50 + ₹100 = ₹1,542.50.
const bill = (over: Record<string, unknown> = {}) => ({
  supplierId: local.id, supplierInvoiceNo: 'INV-101', supplierInvoiceDate: '2026-09-01',
  lines: [
    { productId: soap, uomId: pcs, qtyMilli: 10_000, unitPricePaise: 10_000 },
    { productId: rice, uomId: pcs, qtyMilli: 5000, unitPricePaise: 5000 },
  ],
  charges: [{ kind: 'freight', amountPaise: 10_000 }],
  billTotalPaise: 154_250,
  ...over,
});
// Setup goes straight to the services: the IPC rate limit is for people, not test fixtures.
const create = async (over: Record<string, unknown> = {}): Promise<Purchase> => app.purchases.create(CreatePurchaseInput.parse({ ...bill(over), commandId: newUlid() }));

describe('purchase invoice', () => {
  it('receives stock at landed cost, spreading freight by taxable value, and owes the supplier the bill total', async () => {
    const p = await create();
    expect(p.docNumber).toMatch(/^DE01P\/\d{4}\/00001$/);
    expect(p.totals).toMatchObject({ supplyType: 'intra', taxablePaise: 125_000, cgstPaise: 9625, sgstPaise: 9625, chargesPaise: 10_000, itcPaise: 19_250, totalPaise: 154_250 });
    expect(p.lines.map((l) => [l.chargesPaise, l.landedValuePaise, l.unitCostPaise])).toEqual([[8000, 108_000, 10_800], [2000, 27_000, 5400]]);
    expect(level(soap)).toMatchObject({ qtyMilli: 10_000, valuePaise: 108_000 });
    expect(p.dueDate).toBe('2026-10-01');
    expect(db.prepare("SELECT amount_paise, due_date FROM party_ledger_entry WHERE ref_type = 'purchase'").get()).toEqual({ amount_paise: -154_250, due_date: '2026-10-01' });
    expect(db.prepare("SELECT COUNT(*) FROM sync_outbox WHERE entity_type = 'purchase'").pluck().get()).toBe(1);
    clean();
  });

  it('converts a line in boxes to base units', async () => {
    const p = await create({ lines: [{ productId: soap, uomId: box, qtyMilli: 2000, unitPricePaise: 120_000 }], charges: [], billTotalPaise: 283_200 });
    expect(p.lines[0]).toMatchObject({ baseQtyMilli: 24_000, unitCostPaise: 10_000 });
    expect(level(soap).qtyMilli).toBe(24_000);
  });

  it('re-costs a sale made before the goods were booked', async () => {
    await api.data('pos.openRegister', { openingCashPaise: 0 });
    const { CompleteSaleInput, SaleDraft } = await import('@muneem/contracts');
    const draft = SaleDraft.parse({ lines: [{ productId: soap, uomId: pcs, qtyMilli: 2000 }] });
    const total = app.sales.quote(draft).totals.totalPaise;
    app.sales.complete(CompleteSaleInput.parse({ ...draft, commandId: newUlid(), expectedTotalPaise: total, tenders: [{ method: 'cash', amountPaise: total }] }));
    await create();
    expect(db.prepare("SELECT COUNT(*) FROM stock_movement WHERE movement_type = 'cost_correction'").pluck().get()).toBe(1);
    expect(level(soap)).toMatchObject({ qtyMilli: 8000, valuePaise: 86_400 });
    clean();
  });

  it('charges IGST from another state', async () => {
    const mumbai = await supplier({ name: 'Mumbai Wholesale', stateCode: '27', gstin: '27BBBBB0000B1Z5' });
    const p = await create({ supplierId: mumbai.id, lines: [{ productId: soap, uomId: pcs, qtyMilli: 10_000, unitPricePaise: 10_000 }], charges: [], billTotalPaise: 118_000 });
    expect(p.totals).toMatchObject({ supplyType: 'inter', igstPaise: 18_000, cgstPaise: 0, itcPaise: 18_000 });
  });

  it('a composition supplier charges no tax, so there is nothing to claim', async () => {
    const small = await supplier({ name: 'Small Co', stateCode: '07', gstin: '07CCCCC0000C1Z5', taxScheme: 'composition' });
    const p = await create({ supplierId: small.id, lines: [{ productId: soap, uomId: pcs, qtyMilli: 10_000, unitPricePaise: 10_000 }], charges: [], billTotalPaise: 100_000 });
    expect(p.totals).toMatchObject({ docType: 'bill_of_supply', cgstPaise: 0, itcPaise: 0, totalPaise: 100_000 });
    expect(p.lines[0]!.itcEligible).toBe(false);
  });

  it('tax on an ineligible line becomes part of its cost', async () => {
    const p = await create({ lines: [{ productId: soap, uomId: pcs, qtyMilli: 10_000, unitPricePaise: 10_000, itcEligible: false }], charges: [], billTotalPaise: 118_000 });
    expect(p.totals.itcPaise).toBe(0);
    expect(p.lines[0]).toMatchObject({ landedValuePaise: 118_000, unitCostPaise: 11_800 });
  });

  it('a line may carry the rate the bill charged', async () => {
    const p = await create({ lines: [{ productId: soap, uomId: pcs, qtyMilli: 10_000, unitPricePaise: 10_000, gstRateBp: 1200 }], charges: [], billTotalPaise: 112_000 });
    expect(p.lines[0]).toMatchObject({ gstRateBp: 1200, cgstPaise: 6000 });
    expect((await api.data<{ gstRateBp: number }>('products.get', { id: soap })).gstRateBp).toBe(1800);
  });

  it('keeps up to ₹1 of difference as round-off and refuses more, naming the field', async () => {
    expect((await create({ billTotalPaise: 154_200 })).totals).toMatchObject({ roundOffPaise: -50, totalPaise: 154_200 });
    expect(await api.call('purchases.create', { ...bill({ supplierInvoiceNo: 'INV-102', billTotalPaise: 154_000 }), commandId: newUlid() }))
      .toMatchObject({ ok: false, error: { code: 'VALIDATION_FAILED', fields: { billTotalPaise: expect.stringContaining('₹1,542.50') } } });
  });

  it('shows the bill difference before saving', async () => {
    const q = await api.data<PurchaseQuote>('purchases.quote', bill({ billTotalPaise: 154_000 }));
    expect(q).toMatchObject({ billDifferencePaise: -250, billTotalOk: false, dueDate: '2026-10-01' });
  });

  it('refuses the same supplier invoice twice in a year, in any case, until the first is cancelled', async () => {
    const first = await create();
    expect(await api.call('purchases.create', { ...bill({ supplierInvoiceNo: 'inv-101' }), commandId: newUlid() }))
      .toMatchObject({ ok: false, error: { fields: { supplierInvoiceNo: expect.stringContaining(first.docNumber) } } });
    app.purchaseReturns.cancel(first.id, 'entered twice');
    expect((await create({ supplierInvoiceNo: 'inv-101' })).status).toBe('posted');
  });

  it('a repeated command returns the first purchase', async () => {
    const input = { ...bill(), commandId: newUlid() };
    const a = await api.data<Purchase>('purchases.create', input);
    const b = await api.data<Purchase>('purchases.create', input);
    expect(b.id).toBe(a.id);
    expect(db.prepare('SELECT COUNT(*) FROM purchase').pluck().get()).toBe(1);
  });

  it('refuses a bill dated in the future and names bad lines', async () => {
    const r = await api.call('purchases.create', {
      ...bill({ supplierInvoiceDate: '2999-01-01', lines: [{ productId: rice, uomId: box, qtyMilli: 1000, unitPricePaise: 100 }, { productId: soap, uomId: pcs, qtyMilli: 1000, unitPricePaise: 100 }] }),
      commandId: newUlid(),
    });
    expect(r).toMatchObject({ ok: false, error: { fields: { supplierInvoiceDate: expect.any(String), 'lines.0': expect.stringContaining('BOX') } } });
    expect(db.prepare('SELECT COUNT(*) FROM purchase').pluck().get()).toBe(0);
  });

  it('a failure part-way leaves nothing behind', async () => {
    db.exec("CREATE TRIGGER fail_entry BEFORE INSERT ON party_ledger_entry BEGIN SELECT RAISE(ABORT, 'boom'); END;");
    expect((await api.call('purchases.create', { ...bill(), commandId: newUlid() })).ok).toBe(false);
    for (const t of ['purchase', 'purchase_item', 'stock_movement', 'sync_outbox WHERE entity_type = \'purchase\'']) {
      expect(db.prepare(`SELECT COUNT(*) FROM ${t}`).pluck().get()).toBe(0);
    }
  });

  it('lists newest first and pages', async () => {
    for (const n of [1, 2, 3]) await create({ supplierInvoiceNo: `INV-${n}` });
    const first = app.purchases.list({ limit: 2 });
    const rest = app.purchases.list({ limit: 2, cursor: first.nextCursor! });
    expect([...first.items, ...rest.items].map((p) => p.supplierInvoiceNo)).toEqual(['INV-3', 'INV-2', 'INV-1']);
  });
});

describe('debit notes', () => {
  const ret = async (purchase: Purchase, lines: { line: number; qty: number }[], over: Record<string, unknown> = {}): Promise<DebitNote> => app.purchaseReturns.returnGoods(ReturnPurchaseInput.parse({
    purchaseId: purchase.id, reason: 'damaged', commandId: newUlid(),
    lines: lines.map((l) => ({ purchaseItemId: purchase.lines[l.line]!.id, qtyMilli: l.qty })), ...over,
  }));

  it('returns at the line\'s own cost, reverses its tax and settles the purchase first', async () => {
    const p = await create();
    await api.data('inventory.adjust', { lines: [{ productId: soap, qtyMilli: 10_000, reason: 'other' }] });   // average no longer = purchase cost
    const note = await ret(p, [{ line: 0, qty: 4000 }]);
    expect(note.docNumber).toMatch(/^DE01D\/\d{4}\/00001$/);
    expect(note).toMatchObject({ taxablePaise: 40_000, cgstPaise: 3600, sgstPaise: 3600, chargesPaise: 0, totalPaise: 47_200, itcReversedPaise: 7200, allocatedPaise: 47_200 });
    expect(note.lines[0]).toMatchObject({ baseQtyMilli: 4000, landedValuePaise: 43_200 });
    expect(db.prepare("SELECT value_paise FROM stock_movement WHERE movement_type = 'purchase_return'").pluck().all()).toEqual([-43_200]);
    expect((await api.data<Purchase>('purchases.get', { id: p.id })).settledPaise).toBe(47_200);
    clean();
  });

  it('several returns of a line add up to the line exactly', async () => {
    const p = await create({ lines: [{ productId: soap, uomId: pcs, qtyMilli: 3000, unitPricePaise: 3333 }], charges: [{ kind: 'freight', amountPaise: 100 }], billTotalPaise: 11_899 });
    const notes = [await ret(p, [{ line: 0, qty: 1000 }], { refundCharges: true }), await ret(p, [{ line: 0, qty: 1000 }], { refundCharges: true }), await ret(p, [{ line: 0, qty: 1000 }], { refundCharges: true })];
    const sum = (k: 'taxablePaise' | 'cgstPaise' | 'chargesPaise') => notes.reduce((s, n) => s + n[k], 0);
    expect([sum('taxablePaise'), sum('cgstPaise'), sum('chargesPaise')]).toEqual([p.lines[0]!.taxablePaise, p.lines[0]!.cgstPaise, 100]);
    expect(level(soap)).toMatchObject({ qtyMilli: 0, valuePaise: 0 });
    clean();
  });

  it('leaves what the purchase no longer owes as credit from the supplier', async () => {
    const p = await create();
    db.exec(`INSERT INTO doc_series (id, business_id, doc_type, fy, prefix, created_at, updated_at, created_by, device_id) VALUES ('pay', '${businessId}', 'payment', '2026-27', 'PY', 'a', 'a', 'u', 'd')`);
    const branch = db.prepare('SELECT branch_id FROM purchase').pluck().get() as string;
    db.exec(`INSERT INTO payment (id, business_id, branch_id, direction, party_type, party_id, series_id, doc_number, doc_seq, payment_date, fy, method, amount_paise, created_at, updated_at, created_by, device_id)
      VALUES ('py1', '${businessId}', '${branch}', 'out', 'supplier', '${local.id}', 'pay', 'PY1', 1, '2026-10-03', '2026-27', 'bank', 150_000, 'a', 'a', 'u', 'd')`);
    db.exec(`INSERT INTO allocation (id, business_id, party_type, party_id, source_type, source_id, target_type, target_id, amount_paise, allocated_at, allocated_on, created_at, updated_at, created_by, device_id)
      VALUES ('al1', '${businessId}', 'supplier', '${local.id}', 'payment', 'py1', 'purchase', '${p.id}', 150_000, 'a', '2026-10-03', 'a', 'a', 'u', 'd')`);
    db.prepare(`INSERT INTO party_ledger_entry (id, business_id, party_type, party_id, ref_type, ref_id, entry_kind, amount_paise, doc_date, occurred_at, created_at, updated_at, created_by, device_id)
      VALUES ('e1', ?, 'supplier', ?, 'payment', 'py1', 'post', 150000, '2026-10-03', 'a', 'a', 'a', 'u', 'd')`).run(businessId, local.id);
    const note = await ret(p, [{ line: 0, qty: 10_000 }]);
    expect(note).toMatchObject({ totalPaise: 118_000, allocatedPaise: 4250 });
    clean();
  });

  it('refuses to return more than is left on a line, naming it', async () => {
    const p = await create();
    await ret(p, [{ line: 1, qty: 3000 }]);
    expect(await api.call('purchases.return', { purchaseId: p.id, reason: 'x', commandId: newUlid(), lines: [{ purchaseItemId: p.lines[1]!.id, qtyMilli: 2001 }] }))
      .toMatchObject({ ok: false, error: { code: 'RETURN_QTY_EXCEEDED', fields: { 'lines.0.qtyMilli': expect.stringContaining('only 2 PCS of Rice') } } });
  });

  it('under the block policy, refuses to send back goods already sold', async () => {
    const p = await create();
    await api.data('settings.set', { key: 'inventory.negativeStock', value: 'block' });
    await api.data('inventory.adjust', { lines: [{ productId: rice, qtyMilli: -5000, reason: 'damage' }] });
    expect(await api.call('purchases.return', { purchaseId: p.id, reason: 'x', commandId: newUlid(), lines: [{ purchaseItemId: p.lines[1]!.id, qtyMilli: 1000 }] }))
      .toMatchObject({ ok: false, error: { code: 'STOCK_INSUFFICIENT' } });
  });

  it('a repeated command returns the first debit note', async () => {
    const p = await create();
    const input = { purchaseId: p.id, reason: 'x', commandId: newUlid(), lines: [{ purchaseItemId: p.lines[0]!.id, qtyMilli: 1000 }] };
    expect((await api.data<DebitNote>('purchases.return', input)).id).toBe((await api.data<DebitNote>('purchases.return', input)).id);
    expect(db.prepare('SELECT COUNT(*) FROM debit_note').pluck().get()).toBe(1);
  });
});

describe('cancelling a purchase', () => {
  it('takes the goods back out at landed cost and reverses the ledger entry', async () => {
    const p = await create();
    const c = await api.data<Purchase>('purchases.cancel', { id: p.id, reason: 'wrong supplier' });
    expect(c).toMatchObject({ status: 'cancelled', cancelReason: 'wrong supplier' });
    expect(level(soap)).toMatchObject({ qtyMilli: 0, valuePaise: 0 });
    expect(db.prepare("SELECT SUM(amount_paise) FROM party_ledger_entry WHERE ref_id = ?").pluck().get(p.id)).toBe(0);
    clean();
  });

  it('is refused once goods have been returned on a debit note', async () => {
    const p = await create();
    await api.data('purchases.return', { purchaseId: p.id, reason: 'x', commandId: newUlid(), lines: [{ purchaseItemId: p.lines[0]!.id, qtyMilli: 1000 }] });
    expect(await api.call('purchases.cancel', { id: p.id, reason: 'oops' })).toMatchObject({ ok: false, error: { code: 'INVALID_STATE' } });
  });
});

describe('importing purchase lines', () => {
  it('turns a supplier file into form lines and names bad rows', async () => {
    const csv = ['SKU,Barcode,Qty,Unit,Rate,GST %,Disc %', 'LUX,,2,BOX,1200,18,5', ',8901030865275,6,,100.50,,', 'NOPE,,1,,10,,', 'RICE,,x,,10,,', 'RICE,,1,BOX,10,,'].join('\n');
    const r = await api.data<PurchaseImportPreview>('purchases.importLinesPreview', { fileName: 'bill.csv', contentBase64: Buffer.from(csv).toString('base64') });
    expect(r.counts).toEqual({ total: 5, ok: 2, errors: 3 });
    expect(r.lines).toEqual([
      { productId: soap, uomId: box, qtyMilli: 2000, unitPricePaise: 120_000, priceIsInclusive: false, lineDiscount: { kind: 'percent', value: 500 }, gstRateBp: 1800 },
      { productId: soap, uomId: pcs, qtyMilli: 6000, unitPricePaise: 10_050, priceIsInclusive: false, lineDiscount: { kind: 'percent', value: 0 } },
    ]);
    expect(r.errors.map((e) => Object.keys(e.errors))).toEqual([['product'], ['qty'], ['unit']]);
    expect(db.prepare('SELECT COUNT(*) FROM purchase').pluck().get()).toBe(0);
  });
});

describe('5h-1 fixes', () => {
  it('imports a 30-line supplier file in one call, returning each product once (#3)', async () => {
    const csv = ['SKU,Qty,Rate', ...Array.from({ length: 30 }, (_, i) => `${i % 2 ? 'LUX' : 'RICE'},${i + 1},10`)].join('\n');
    const r = await api.data<PurchaseImportPreview>('purchases.importLinesPreview', { fileName: 'big.csv', contentBase64: Buffer.from(csv).toString('base64') });
    expect(r.lines).toHaveLength(30);
    expect(r.products.map((p) => p.id).sort()).toEqual([soap, rice].sort());
  });

  it('lists document series after a purchase and an expense (#11)', async () => {
    await create();
    const cat = (await api.data<{ id: string }[]>('expenses.listCategories'))[0]!.id;
    await api.data('expenses.create', { categoryId: cat, method: 'bank', amountPaise: 1000, commandId: newUlid() });
    const series = await api.data<{ docType: string; prefix: string }[]>('settings.listSeries');
    expect(series.map((x) => [x.docType, x.prefix])).toEqual(expect.arrayContaining([['purchase', 'DE01P'], ['expense', 'DE01E']]));
    expect(await api.call('settings.createSeries', { branchId: null, terminalId: null, docType: 'tax_invoice', fy: '2026-27', prefix: 'TOOLP', padWidth: 6 }))
      .toMatchObject({ ok: false, error: { code: 'VALIDATION_FAILED' } });
  });
});

describe('5h-2 fixes', () => {
  it('quote lines say which form row they came from, so a bad row does not shift the others (#4)', async () => {
    const q = await api.data<PurchaseQuote>('purchases.quote', bill({ lines: [
      { productId: rice, uomId: box, qtyMilli: 1000, unitPricePaise: 100 },              // rice has no BOX unit: left out
      { productId: soap, uomId: pcs, qtyMilli: 10_000, unitPricePaise: 10_000 },
    ] }));
    expect(q.issues).toEqual([{ lineNo: 1, message: expect.stringContaining('BOX') }]);
    expect(q.lines).toEqual([expect.objectContaining({ draftLineNo: 2, productId: soap, taxablePaise: 100_000 })]);
  });

  it('a full return takes back the round-off too, leaving nothing owed (#6)', async () => {
    const p = await create({ billTotalPaise: 154_200 });                                // ₹0.50 below the lines: round-off −50
    expect(p.totals.roundOffPaise).toBe(-50);
    const note = app.purchaseReturns.returnGoods(ReturnPurchaseInput.parse({
      purchaseId: p.id, reason: 'wrong goods', refundCharges: true, commandId: newUlid(),
      lines: p.lines.map((l) => ({ purchaseItemId: l.id, qtyMilli: l.qtyMilli })),
    }));
    expect(note).toMatchObject({ roundOffPaise: -50, totalPaise: 154_200 });
    expect(app.purchases.get(p.id).settledPaise).toBe(154_200);
    clean();
  });

  it('a partial return carries no round-off', async () => {
    const p = await create({ billTotalPaise: 154_200 });
    const note = app.purchaseReturns.returnGoods(ReturnPurchaseInput.parse({
      purchaseId: p.id, reason: 'x', commandId: newUlid(), lines: [{ purchaseItemId: p.lines[0]!.id, qtyMilli: 1000 }],
    }));
    expect(note.roundOffPaise).toBe(0);
  });

  it('refuses a reverse-charge purchase until it is supported (#7)', async () => {
    expect(await api.call('purchases.create', { ...bill({ isReverseCharge: true }), commandId: newUlid() }))
      .toMatchObject({ ok: false, error: { code: 'VALIDATION_FAILED', fields: { isReverseCharge: expect.stringContaining('not supported') } } });
  });
});

describe('series prefixes (5i #3)', () => {
  const series = (docType: string, prefix: string) => api.call('settings.createSeries', { branchId: null, terminalId: null, docType, fy: '2027-28', prefix, padWidth: 5 });
  it('take the terminal prefix plus their own letter for non-sale documents, and 1–4 characters for sale documents', async () => {
    expect(await series('purchase', 'DE01')).toMatchObject({ ok: false, error: { code: 'VALIDATION_FAILED', fields: { prefix: expect.stringContaining('followed by P') } } });
    await new Promise((r) => setTimeout(r, 510));
    expect(await series('purchase', 'DE01D')).toMatchObject({ ok: false, error: { fields: { prefix: expect.stringContaining('followed by P') } } });
    await new Promise((r) => setTimeout(r, 510));
    expect(await series('tax_invoice', 'DE01P')).toMatchObject({ ok: false, error: { fields: { prefix: '1–4 capital letters or digits' } } });
    await new Promise((r) => setTimeout(r, 510));
    expect(await series('purchase', 'DE01P')).toMatchObject({ ok: true, data: { docType: 'purchase', prefix: 'DE01P' } });
  });
});
