import { beforeEach, describe, expect, it } from 'vitest';
import { newUlid } from '@muneem/domain';
import { verifyAuditChain, type Db } from '@muneem/db-sqlite';
import { CompleteSaleInput, type CompleteSaleResult, type ReceiptDoc, type Sale, type SaleQuote } from '@muneem/contracts';
import type { App } from '../src/main/app.js';
import { caller, grantRole, ownerAtTill, testApp } from './helpers.js';

let app: App;
let db: Db;
let api: ReturnType<typeof caller>;
let pcs: string;
let box: string;
let soap: string;
let rice: string;

async function setup(opts: { taxScheme?: string; now?: () => number } = {}) {
  ({ app, db } = await testApp(opts.now ? { now: opts.now } : {}));
  api = caller(app);
  await ownerAtTill(app, opts.taxScheme ? { taxScheme: opts.taxScheme } : {});
  const uoms = await api.data<{ id: string; code: string }[]>('catalog.listUoms');
  pcs = uoms.find((u) => u.code === 'PCS')!.id;
  box = uoms.find((u) => u.code === 'BOX')!.id;
  soap = (await api.data<{ id: string }>('products.create', {
    name: 'Lux Soap', sku: 'LUX', hsnCode: '3401', baseUomId: pcs, gstRateBp: 1800, mrpPaise: 4500, sellingPricePaise: 4130,
    barcodes: [{ code: '8901030865275' }], conversions: [{ fromUomId: box, factorMilli: 12_000 }],
  })).id;
  rice = (await api.data<{ id: string }>('products.create', { name: 'Loose Rice', sku: 'RICE', hsnCode: '1006', baseUomId: pcs, gstRateBp: 500, sellingPricePaise: 6000 })).id;
  await api.data('pos.openRegister', { openingCashPaise: 100_000 });
}

const line = (productId: string, qtyMilli = 1000, uomId = pcs) => ({ productId, uomId, qtyMilli });
const quote = (draft: Record<string, unknown>) => api.data<SaleQuote>('sales.quote', draft);
async function sell(draft: Record<string, unknown>, tenders?: unknown[]) {
  const q = await quote(draft);
  return api.call<CompleteSaleResult>('sales.complete', {
    ...draft, commandId: newUlid(), expectedTotalPaise: q.totals.totalPaise, tenders: tenders ?? [{ method: 'cash', amountPaise: q.totals.totalPaise }],
  });
}
const count = (sql: string) => db.prepare(sql).pluck().get() as number;

describe('the sale commit', () => {
  beforeEach(async () => { await setup(); });

  it('bills a walk-in cash sale: number, totals, change, receipt job, one audit and one outbox row', async () => {
    const q = await quote({ lines: [line(soap, 2000), line(rice)] });
    // 2 × ₹41.30 + ₹60.00 = ₹142.60, rounded to the rupee by default
    expect(q.totals).toMatchObject({ docType: 'tax_invoice', supplyType: 'intra', placeOfSupplyState: '07', gstr1Bucket: 'b2cs', totalPaise: 14_300, roundOffPaise: 40 });
    const audits = count('SELECT COUNT(*) FROM audit_log');
    const r = await api.data<CompleteSaleResult>('sales.complete', {
      lines: [line(soap, 2000), line(rice)], commandId: newUlid(), expectedTotalPaise: 14_300, tenders: [{ method: 'cash', amountPaise: 20_000 }],
    });
    expect(r).toMatchObject({ docNumber: expect.stringMatching(/^DE01\/\d{4}\/000001$/), changePaise: 5700, replayed: false });
    expect(r.docNumber.length).toBeLessThanOrEqual(16);
    const sale = await api.data<Sale>('sales.get', { id: r.saleId });
    expect(sale.lines.map((l) => [l.name, l.qtyMilli, l.hsnCode, l.gstRateBp])).toEqual([['Lux Soap', 2000, '3401', 1800], ['Loose Rice', 1000, '1006', 500]]);
    expect(sale.tenders).toEqual([{ method: 'cash', amountPaise: 20_000, changePaise: 5700 }]);
    // series.create + warehouse.create + sale.complete + stock.negative (no opening stock) + ipc.sales.complete
    expect(count('SELECT COUNT(*) FROM audit_log') - audits).toBe(5);
    expect(db.prepare("SELECT entity_type FROM sync_outbox WHERE entity_type = 'sale'").all()).toHaveLength(1);
    await app.printQueue.idle();
    expect(db.prepare('SELECT status, open_drawer FROM print_job WHERE doc_id = ?').get(r.saleId)).toEqual({ status: 'done', open_drawer: 1 });
    const receipt = await api.data<ReceiptDoc>('sales.getReceipt', { saleId: r.saleId });
    expect(receipt).toMatchObject({ title: 'TAX INVOICE', docNumber: r.docNumber, changePaise: 5700, totals: { totalPaise: 14_300, stateTaxLabel: 'SGST' } });
    expect(receipt.taxSummary.map((t) => t.rateBp)).toEqual([500, 1800]);
    const second = await sell({ lines: [line(rice)] });
    expect(second.ok && second.data.docNumber).toMatch(/000002$/);
    expect(verifyAuditChain(db, app.session.require().businessId!, app.device.localDeviceId()).ok).toBe(true);
  });

  it('bills a B2B inter-state sale with the customer snapshot and IGST', async () => {
    const c = await api.data<{ id: string }>('customers.create', { name: 'Gupta Traders', gstin: '27AAAAA0000A1Z5' });
    const r = await sell({ customerId: c.id, lines: [line(soap)] }, [{ method: 'upi', amountPaise: 4100, reference: 'UPI123' }]);
    expect(r.ok).toBe(true);
    const sale = await api.data<Sale>('sales.get', { id: (r as { data: CompleteSaleResult }).data.saleId });
    expect(sale.totals).toMatchObject({ supplyType: 'inter', placeOfSupplyState: '27', gstr1Bucket: 'b2b', cgstPaise: 0, sgstPaise: 0, igstPaise: 630 });
    expect(sale.customer).toMatchObject({ walkIn: false, name: 'Gupta Traders', gstin: '27AAAAA0000A1Z5' });
    expect(sale.tenders[0]).toMatchObject({ method: 'upi', reference: 'UPI123', changePaise: 0 });
  });

  it('stores a place-of-supply override with its reason', async () => {
    const r = await sell({ placeOfSupplyOverride: { stateCode: '09', reason: 'delivered to Noida' }, lines: [line(soap)] });
    const sale = await api.data<Sale>('sales.get', { id: (r as { data: CompleteSaleResult }).data.saleId });
    expect(sale).toMatchObject({ placeOfSupplyReason: 'delivered to Noida', totals: { placeOfSupplyState: '09', supplyType: 'inter' } });
  });

  it('prices by unit and quantity break, and reports lines that cannot be sold', async () => {
    const q = await quote({ lines: [line(soap, 1000, box)] });
    expect(q.lines[0]).toMatchObject({ uomCode: 'BOX', baseQtyMilli: 12_000, unitPricePaise: 49_560 });
    const kg = (await api.data<{ id: string; code: string }[]>('catalog.listUoms')).find((u) => u.code === 'KG')!.id;
    const bad = await quote({ lines: [line(soap), line(rice, 1000, kg)] });
    expect(bad.issues).toEqual([{ lineNo: 2, message: 'Loose Rice is not sold in KG' }]);
    expect(await api.call('sales.complete', { lines: [line(soap), line(rice, 1000, kg)], commandId: newUlid(), expectedTotalPaise: bad.totals.totalPaise, tenders: [{ method: 'cash', amountPaise: 10_000 }] }))
      .toMatchObject({ ok: false, error: { code: 'VALIDATION_FAILED' } });
  });

  it('apportions a bill discount and enforces the cashier discount limit', async () => {
    const tenPercent = { lines: [line(soap), line(rice)], billDiscount: { kind: 'percent', value: 1000 } };
    expect((await quote(tenPercent)).totals.discountBp).toBe(1000);
    grantRole(db, app, 'cashier');
    expect(await sell(tenPercent)).toMatchObject({ ok: false, error: { code: 'PERMISSION_DENIED' } });
    const five = await sell({ ...tenPercent, billDiscount: { kind: 'percent', value: 500 } });
    expect(five.ok).toBe(true);
    const sale = await api.data<Sale>('sales.get', { id: (five as { data: CompleteSaleResult }).data.saleId });
    expect(sale.totals.discountBp).toBe(500);
    expect(sale.lines.reduce((s, l) => s + l.apportionedBillDiscountPaise, 0)).toBe(sale.totals.billDiscountPaise);
  });

  it('refuses a changed total, short or non-cash over-payment, and a closed register', async () => {
    const draft = { lines: [line(soap)] };
    expect(await api.call('sales.complete', { ...draft, commandId: newUlid(), expectedTotalPaise: 4130, tenders: [{ method: 'cash', amountPaise: 4130 }] }))
      .toMatchObject({ ok: false, error: { code: 'TOTAL_MISMATCH', message: expect.stringContaining('₹41.00') } });
    expect(await sell(draft, [{ method: 'cash', amountPaise: 4000 }])).toMatchObject({ ok: false, error: { fields: { tenders: '₹1.00 still to pay' } } });
    expect(await sell(draft, [{ method: 'card', amountPaise: 5000 }])).toMatchObject({ ok: false, error: { code: 'VALIDATION_FAILED' } });
    app.register.close({ countedCashPaise: 100_000 });
    expect(await sell(draft)).toMatchObject({ ok: false, error: { code: 'REGISTER_NOT_OPEN' } });
  });

  it('feeds the register: expected cash counts cash taken minus change, other tenders separately', async () => {
    await sell({ lines: [line(soap)] }, [{ method: 'cash', amountPaise: 5000 }]);
    await sell({ lines: [line(rice)] }, [{ method: 'upi', amountPaise: 2000 }, { method: 'cash', amountPaise: 4000 }]);
    const x = await api.data<{ expectedCashPaise: number; salesCount: number; byTender: unknown[]; changeGivenPaise: number }>('pos.xReport');
    expect(x).toMatchObject({ salesCount: 2, changeGivenPaise: 900, expectedCashPaise: 100_000 + 5000 + 4000 - 900 });
    expect(x.byTender).toEqual([{ method: 'cash', amountPaise: 8100 }, { method: 'upi', amountPaise: 2000 }]);
  });

  it('a repeated commandId returns the original sale instead of billing twice', async () => {
    const input = CompleteSaleInput.parse({ lines: [line(soap)], commandId: newUlid(), expectedTotalPaise: 4100, tenders: [{ method: 'cash', amountPaise: 4100 }] });
    const first = app.sales.complete(input);
    const again = app.sales.complete(input);
    expect(again).toEqual({ ...first, replayed: true });
    expect(count('SELECT COUNT(*) FROM sale')).toBe(1);
  });

  it('a failure anywhere in the commit leaves no sale, number, print job, audit or outbox row', async () => {
    const before = {
      audit: count('SELECT COUNT(*) FROM audit_log'), outbox: count('SELECT COUNT(*) FROM sync_outbox'), series: count('SELECT COUNT(*) FROM doc_series'),
    };
    db.exec("CREATE TRIGGER boom BEFORE INSERT ON print_job BEGIN SELECT RAISE(ABORT, 'printer table exploded'); END");
    expect((await sell({ lines: [line(soap)] })).ok).toBe(false);
    expect(count('SELECT COUNT(*) FROM sale') + count('SELECT COUNT(*) FROM sale_item') + count('SELECT COUNT(*) FROM print_job')).toBe(0);
    expect(count('SELECT COUNT(*) FROM audit_log')).toBe(before.audit);
    expect(count('SELECT COUNT(*) FROM sync_outbox')).toBe(before.outbox);
    expect(count('SELECT COUNT(*) FROM doc_series')).toBe(before.series);
    expect(count('SELECT COUNT(*) FROM stock_movement') + count('SELECT COUNT(*) FROM stock_level')).toBe(0);
    db.exec('DROP TRIGGER boom');
    const ok = await sell({ lines: [line(soap)] });
    expect(ok.ok && ok.data.docNumber).toMatch(/000001$/);
  });
});

describe('document types and financial years', () => {
  it('a composition business issues a bill of supply with no tax and the declaration', async () => {
    await setup({ taxScheme: 'composition' });
    const r = await sell({ lines: [line(soap)] });
    expect(r.ok && r.data.totals).toMatchObject({ docType: 'bill_of_supply', cgstPaise: 0, sgstPaise: 0, igstPaise: 0 });
    const receipt = await api.data<ReceiptDoc>('sales.getReceipt', { saleId: (r as { data: CompleteSaleResult }).data.saleId });
    expect(receipt).toMatchObject({ title: 'BILL OF SUPPLY', declaration: expect.stringContaining('Composition') });
  });

  it('starts a new series at 000001 in a new financial year', async () => {
    let now = Date.parse('2027-03-31T06:30:00Z');
    await setup({ now: () => now });
    const march = await sell({ lines: [line(soap)] });
    now = Date.parse('2027-04-01T06:30:00Z');
    const april = await sell({ lines: [line(soap)] });
    expect([march.ok && march.data.docNumber, april.ok && april.data.docNumber]).toEqual(['DE01/2627/000001', 'DE01/2728/000001']);
  });
});

describe('sales list', () => {
  it('pages through sales that share a timestamp without skipping any', async () => {
    await setup();
    const ids: string[] = [];
    for (let i = 0; i < 5; i++) {
      const r = await sell({ lines: [line(rice)] });
      ids.push((r as { data: CompleteSaleResult }).data.saleId);
    }
    db.prepare("UPDATE sale SET created_at = '2026-10-02T10:00:00.000Z'").run();
    const seen: string[] = [];
    let cursor: string | undefined;
    do {
      const page = app.sales.list({ limit: 2, ...(cursor && { cursor }) });
      seen.push(...page.items.map((s) => s.id));
      cursor = page.nextCursor ?? undefined;
    } while (cursor);
    expect(seen.sort()).toEqual([...ids].sort());
  });
});
