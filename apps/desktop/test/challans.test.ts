import { beforeEach, describe, expect, it } from 'vitest';
import { newUlid } from '@muneem/domain';
import type { Db } from '@muneem/db-sqlite';
import { payloadSchema, type Challan, type ChallanPage, type CompleteSaleResult, type SaleQuote, type SharePreview } from '@muneem/contracts';
import type { App } from '../src/main/app.js';
import { saleDraftOf } from '../src/main/services/challans/challanService.js';
import { caller, grantRole, ownerAtTill, testApp } from './helpers.js';

let app: App;
let db: Db;
let api: ReturnType<typeof caller>;
let clock: number;
let customerId: string;
let pcs: string;
let soap: string;

const count = (sql: string, ...args: unknown[]) => db.prepare(sql).pluck().get(...args) as number;

async function setup() {
  clock = Date.parse('2026-10-12T06:00:00.000Z');
  ({ app, db } = await testApp({ now: () => clock }));
  api = caller(app);
  await ownerAtTill(app);
  pcs = (await api.data<{ id: string; code: string }[]>('catalog.listUoms')).find((u) => u.code === 'PCS')!.id;
  soap = (await api.data<{ id: string }>('products.create', { name: 'Lux Soap', sku: 'LUX', hsnCode: '3401', baseUomId: pcs, gstRateBp: 1800, sellingPricePaise: 4130 })).id;
  customerId = (await api.data<{ id: string }>('customers.create', { name: 'Gupta Traders', phone: '9876543210', email: 'gupta@example.com' })).id;
}

const supply = () => ({
  purpose: 'supply', customerId, lines: [{ productId: soap, uomId: pcs, qtyMilli: 24_000 }],
  transport: { mode: 'road', vehicleNo: 'dl01ab1234', transporterName: 'Shree Logistics', distanceKm: 12, docNo: 'LR-881' },
});
const jobWork = () => ({
  purpose: 'job_work', consignee: { name: 'Ravi Job Works', address: 'Plot 4, Bhiwandi', gstin: '27AAAAA0000A1Z5' },
  lines: [{ productId: soap, uomId: pcs, qtyMilli: 5000 }], transport: { mode: 'road' },
});
// challans.create is rate limited per second against the test's clock.
async function create(draft: Record<string, unknown>, over: Record<string, unknown> = {}) {
  clock += 1000;
  const q = await api.data<SaleQuote>('sales.quote', saleDraftOf(draft as never));
  return api.call<Challan>('challans.create', { ...draft, commandId: newUlid(), expectedTotalPaise: q.totals.totalPaise, ...over });
}
async function challan(draft: Record<string, unknown>): Promise<Challan> {
  const r = await create(draft);
  if (!r.ok) throw new Error(JSON.stringify(r.error));
  return r.data;
}
const bill = (c: Challan) => {
  clock += 1000;
  return api.call<CompleteSaleResult>('sales.complete', {
    ...c.draft, challanId: c.id, commandId: newUlid(), expectedTotalPaise: c.totals.totalPaise, tenders: [{ method: 'cash', amountPaise: c.totals.totalPaise }],
  });
};

describe('delivery challans (FR-087)', () => {
  beforeEach(setup);

  it('values goods like a bill and stores an H-numbered challan that posts nothing', async () => {
    const quote = await api.data<SaleQuote>('sales.quote', saleDraftOf(supply() as never));
    const c = await challan(supply());
    expect(c).toMatchObject({
      docNumber: expect.stringMatching(/^DE01H\/\d{4}\/00001$/u), docDate: '2026-10-12', purpose: 'supply', status: 'open', customerId,
      consignee: { walkIn: false, name: 'Gupta Traders', phone: '9876543210' }, totals: quote.totals,
      transport: { mode: 'road', vehicleNo: 'DL01AB1234', transporterName: 'Shree Logistics', distanceKm: 12, docNo: 'LR-881' },
    });
    expect(c.lines).toEqual(quote.lines);
    for (const table of ['journal_entry', 'stock_movement', 'party_ledger_entry']) expect(count(`SELECT COUNT(*) FROM ${table} WHERE ref_id = ?`, c.id)).toBe(0);
    const payload = JSON.parse(db.prepare(`SELECT payload_json FROM sync_outbox WHERE entity_type = 'delivery_challan'`).pluck().get() as string) as Record<string, unknown>;
    expect(payloadSchema('delivery_challan', 'create').safeParse(payload).success).toBe(true);
    expect(payload).toMatchObject({ consignee: null, transport: { vehicleNo: 'DL01AB1234' } });
    expect((await challan(supply())).docNumber).toMatch(/00002$/u);
  });

  it('sends goods to a consignee who is not a customer; their GSTIN in another state makes it inter-state', async () => {
    const c = await challan(jobWork());
    expect(c.consignee).toEqual({ walkIn: false, name: 'Ravi Job Works', address: 'Plot 4, Bhiwandi', gstin: '27AAAAA0000A1Z5', stateCode: '27' });
    expect(c.totals).toMatchObject({ supplyType: 'inter', placeOfSupplyState: '27', cgstPaise: 0, sgstPaise: 0 });
    expect(c.totals.igstPaise).toBeGreaterThan(0);
    expect(c.draft.placeOfSupplyOverride).toEqual({ stateCode: '27', reason: 'Consignee GSTIN' });
  });

  it('refuses a challan nobody receives, a value the user did not see and a malformed vehicle number', async () => {
    expect(await create({ ...supply(), customerId: undefined })).toMatchObject({ ok: false, error: { code: 'VALIDATION_FAILED', fields: { consignee: expect.any(String) } } });
    expect(await create(supply(), { expectedTotalPaise: 1 })).toMatchObject({ ok: false, error: { code: 'TOTAL_MISMATCH' } });
    expect(await create({ ...supply(), transport: { mode: 'road', vehicleNo: 'DL-01/AB' } }))
      .toMatchObject({ ok: false, error: { code: 'VALIDATION_FAILED', fields: { 'transport.vehicleNo': expect.any(String) } } });
    grantRole(db, app, 'inventory');
    expect(await api.call('challans.list', {})).toMatchObject({ ok: false, error: { code: 'PERMISSION_DENIED' } });
  });

  it('a challan for supply is invoiced at the till once; one for job work never is', async () => {
    const c = await challan(supply());
    const job = await challan(jobWork());
    await api.data('pos.openRegister', { openingCashPaise: 0 });
    const sale = await bill(c);
    expect(sale.ok).toBe(true);
    const saleData = (sale as { data: CompleteSaleResult }).data;
    expect(saleData.totals.totalPaise).toBe(c.totals.totalPaise);
    expect(await api.data<Challan>('challans.get', { id: c.id })).toMatchObject({ status: 'billed', saleId: saleData.saleId, saleDocNumber: saleData.docNumber });
    const ops = db.prepare(`SELECT entity_type, operation_type FROM sync_outbox WHERE entity_type IN ('sale', 'delivery_challan') ORDER BY seq`).all();
    expect(ops).toEqual([
      { entity_type: 'delivery_challan', operation_type: 'create' }, { entity_type: 'delivery_challan', operation_type: 'create' },
      { entity_type: 'sale', operation_type: 'create' }, { entity_type: 'delivery_challan', operation_type: 'update' },
    ]);
    const update = JSON.parse(db.prepare(`SELECT payload_json FROM sync_outbox WHERE entity_type = 'delivery_challan' AND operation_type = 'update'`).pluck().get() as string) as unknown;
    expect(payloadSchema('delivery_challan', 'update').safeParse(update).success).toBe(true);
    expect(await bill(c)).toMatchObject({ ok: false, error: { code: 'INVALID_STATE', message: `This challan was already invoiced as ${saleData.docNumber}` } });
    expect(await bill(job)).toMatchObject({ ok: false, error: { code: 'INVALID_STATE', message: 'Only a challan sent for supply is invoiced' } });
    expect(count('SELECT COUNT(*) FROM sale')).toBe(1);
    expect((await api.data<ChallanPage>('challans.list', { status: 'billed' })).items.map((i) => i.id)).toEqual([c.id]);
    expect((await api.data<ChallanPage>('challans.list', { status: 'open' })).items.map((i) => [i.id, i.consigneeName])).toEqual([[job.id, 'Ravi Job Works']]);
  });

  it('prints its purpose and transport on A4 and on the roll, and shares like an invoice', async () => {
    const c = await challan({ ...supply(), notes: 'Handle with care' });
    const { html } = await api.data<{ html: string }>('challans.renderHtml', { id: c.id });
    for (const text of ['Delivery Challan', 'Challan No', c.docNumber, 'Consignee', 'Supply, invoice to follow', 'Road · DL01AB1234', 'Shree Logistics', '12 km', 'LR-881', 'Handle with care']) {
      expect(html).toContain(text);
    }
    expect(html).not.toContain('We declare that this invoice');
    expect((await api.data<{ html: string }>('challans.renderHtml', { id: c.id, templateId: 'thermal-80' })).html).toContain('Challan No');
    const p = await api.data<SharePreview>('share.preview', { docType: 'delivery_challan', id: c.id, channel: 'whatsapp' });
    expect(p).toMatchObject({ docLabel: `Delivery challan ${c.docNumber}`, to: '9876543210', fileName: `challan-${c.docNumber.replaceAll('/', '_')}.pdf` });
  });
});
