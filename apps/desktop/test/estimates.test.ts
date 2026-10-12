import { beforeEach, describe, expect, it } from 'vitest';
import { newUlid } from '@muneem/domain';
import type { Db } from '@muneem/db-sqlite';
import { payloadSchema, type CompleteSaleResult, type Estimate, type EstimatePage, type Sale, type SaleQuote, type SharePreview } from '@muneem/contracts';
import type { App } from '../src/main/app.js';
import { caller, grantRole, ownerAtTill, testApp } from './helpers.js';

let app: App;
let db: Db;
let api: ReturnType<typeof caller>;
let clock: number;
let customerId: string;
let pcs: string;
let soap: string;
let rice: string;

const DAY = 86_400_000;
const count = (sql: string, ...args: unknown[]) => db.prepare(sql).pluck().get(...args) as number;

async function setup() {
  clock = Date.parse('2026-10-12T06:00:00.000Z');
  ({ app, db } = await testApp({ now: () => clock }));
  api = caller(app);
  await ownerAtTill(app);
  pcs = (await api.data<{ id: string; code: string }[]>('catalog.listUoms')).find((u) => u.code === 'PCS')!.id;
  soap = (await api.data<{ id: string }>('products.create', { name: 'Lux Soap', sku: 'LUX', hsnCode: '3401', baseUomId: pcs, gstRateBp: 1800, sellingPricePaise: 4130 })).id;
  rice = (await api.data<{ id: string }>('products.create', { name: 'Basmati Rice', sku: 'RICE', hsnCode: '1006', baseUomId: pcs, gstRateBp: 500, sellingPricePaise: 12_000 })).id;
  customerId = (await api.data<{ id: string }>('customers.create', { name: 'Gupta Traders', phone: '9876543210', email: 'gupta@example.com' })).id;
}

const draft = () => ({
  customerId, billDiscount: { kind: 'percent', value: 500 },
  lines: [{ productId: soap, uomId: pcs, qtyMilli: 12_000, lineDiscount: { kind: 'percent', value: 1000 } }, { productId: rice, uomId: pcs, qtyMilli: 5000 }],
});
// estimates.create is rate limited per second against the test's clock.
const create = (input: Record<string, unknown>) => { clock += 1000; return api.call<Estimate>('estimates.create', input); };
async function estimate(over: Record<string, unknown> = {}): Promise<Estimate> {
  clock += 1000;
  const d = { ...draft(), ...over };
  const q = await api.data<SaleQuote>('sales.quote', d);
  return api.data<Estimate>('estimates.create', { ...d, commandId: newUlid(), expectedTotalPaise: q.totals.totalPaise });
}

describe('estimates (FR-086)', () => {
  beforeEach(setup);

  it('prices like a bill and stores a Q-numbered estimate that posts nothing', async () => {
    const quote = await api.data<SaleQuote>('sales.quote', draft());
    const audits = count('SELECT COUNT(*) FROM audit_log');
    const e = await estimate();
    expect(e).toMatchObject({
      docNumber: expect.stringMatching(/^DE01Q\/\d{4}\/00001$/u), docDate: '2026-10-12', validUntil: '2026-10-27', status: 'open', customerId,
      customer: { walkIn: false, name: 'Gupta Traders', phone: '9876543210' }, totals: quote.totals,
      draft: { customerId, billDiscount: { kind: 'percent', value: 500 }, lines: draft().lines },
    });
    expect(e.lines).toEqual(quote.lines);
    for (const table of ['journal_entry', 'stock_movement', 'party_ledger_entry']) expect(count(`SELECT COUNT(*) FROM ${table} WHERE ref_id = ?`, e.id)).toBe(0);
    expect(count('SELECT COUNT(*) FROM sale')).toBe(0);
    // series.create + estimate.create + ipc.estimates.create
    expect(count('SELECT COUNT(*) FROM audit_log') - audits).toBe(3);
    const outbox = db.prepare(`SELECT operation_type, payload_json FROM sync_outbox WHERE entity_type = 'estimate'`).all() as { operation_type: string; payload_json: string }[];
    expect(outbox.map((o) => o.operation_type)).toEqual(['create']);
    const payload = JSON.parse(outbox[0]!.payload_json) as Record<string, unknown>;
    expect(payloadSchema('estimate', 'create').safeParse(payload).success).toBe(true);
    expect(payload).not.toHaveProperty('customer');
    expect((await estimate()).docNumber).toMatch(/00002$/u);
  });

  it('answers a repeated command with the first estimate and refuses what the till would refuse', async () => {
    const q = await api.data<SaleQuote>('sales.quote', draft());
    const commandId = newUlid();
    const first = await create({ ...draft(), commandId, expectedTotalPaise: q.totals.totalPaise });
    const again = await create({ ...draft(), commandId, expectedTotalPaise: q.totals.totalPaise });
    expect(first.ok && again.ok && again.data.id === first.data.id).toBe(true);
    expect(await create({ ...draft(), commandId: newUlid(), expectedTotalPaise: q.totals.totalPaise + 100 }))
      .toMatchObject({ ok: false, error: { code: 'TOTAL_MISMATCH' } });
    expect(await create({ ...draft(), validUntil: '2026-10-11', commandId: newUlid(), expectedTotalPaise: q.totals.totalPaise }))
      .toMatchObject({ ok: false, error: { code: 'VALIDATION_FAILED', fields: { validUntil: 'on or after today' } } });
    grantRole(db, app, 'cashier');
    expect(await create({ ...draft(), billDiscount: { kind: 'percent', value: 2000 }, commandId: newUlid(), expectedTotalPaise: 0 }))
      .toMatchObject({ ok: false, error: { code: 'PERMISSION_DENIED' } });
    grantRole(db, app, 'inventory');
    expect(await api.call('estimates.list', {})).toMatchObject({ ok: false, error: { code: 'PERMISSION_DENIED' } });
  });

  it('is billed at the till with the same lines and total, once, in the bill\'s own transaction', async () => {
    const e = await estimate();
    await api.data('pos.openRegister', { openingCashPaise: 0 });
    const q = await api.data<SaleQuote>('sales.quote', e.draft);
    expect(q.totals.totalPaise).toBe(e.totals.totalPaise);
    const sale = await api.data<CompleteSaleResult>('sales.complete', {
      ...e.draft, estimateId: e.id, commandId: newUlid(), expectedTotalPaise: e.totals.totalPaise, tenders: [{ method: 'cash', amountPaise: e.totals.totalPaise }],
    });
    const billed = await api.data<Sale>('sales.get', { id: sale.saleId });
    expect(billed.lines.map((l) => [l.productId, l.qtyMilli, l.taxablePaise, l.totalPaise])).toEqual(e.lines.map((l) => [l.productId, l.qtyMilli, l.taxablePaise, l.totalPaise]));
    expect(billed.totals.totalPaise).toBe(e.totals.totalPaise);
    expect(await api.data<Estimate>('estimates.get', { id: e.id })).toMatchObject({ status: 'converted', saleId: sale.saleId, saleDocNumber: sale.docNumber });
    const ops = db.prepare(`SELECT entity_type, operation_type FROM sync_outbox WHERE entity_type IN ('sale', 'estimate') ORDER BY seq`).all();
    expect(ops).toEqual([{ entity_type: 'estimate', operation_type: 'create' }, { entity_type: 'sale', operation_type: 'create' }, { entity_type: 'estimate', operation_type: 'update' }]);
    const update = JSON.parse(db.prepare(`SELECT payload_json FROM sync_outbox WHERE entity_type = 'estimate' AND operation_type = 'update'`).pluck().get() as string) as unknown;
    expect(payloadSchema('estimate', 'update').safeParse(update).success).toBe(true);

    expect(await api.call('sales.complete', {
      ...e.draft, estimateId: e.id, commandId: newUlid(), expectedTotalPaise: e.totals.totalPaise, tenders: [{ method: 'cash', amountPaise: e.totals.totalPaise }],
    })).toMatchObject({ ok: false, error: { code: 'INVALID_STATE', message: `This estimate was already billed as ${sale.docNumber}` } });
    expect(count('SELECT COUNT(*) FROM sale')).toBe(1);
  });

  it('lists newest first and tells open from expired; an expired estimate can still be billed', async () => {
    const first = await estimate({ validUntil: '2026-10-14' });
    const second = await estimate();
    const all = await api.data<EstimatePage>('estimates.list', {});
    expect(all.items.map((i) => [i.id, i.status, i.customerName])).toEqual([[second.id, 'open', 'Gupta Traders'], [first.id, 'open', 'Gupta Traders']]);
    clock += 3 * DAY;
    expect((await api.data<EstimatePage>('estimates.list', { status: 'expired' })).items.map((i) => i.id)).toEqual([first.id]);
    expect((await api.data<EstimatePage>('estimates.list', { status: 'open' })).items.map((i) => i.id)).toEqual([second.id]);
    expect((await api.data<Estimate>('estimates.get', { id: first.id })).status).toBe('expired');
    const page = await api.data<EstimatePage>('estimates.list', { limit: 1 });
    expect((await api.data<EstimatePage>('estimates.list', { limit: 1, cursor: page.nextCursor })).items.map((i) => i.id)).toEqual([first.id]);
    await api.data('pos.openRegister', { openingCashPaise: 0 });
    await api.data('sales.complete', {
      ...first.draft, estimateId: first.id, commandId: newUlid(), expectedTotalPaise: first.totals.totalPaise, tenders: [{ method: 'cash', amountPaise: first.totals.totalPaise }],
    });
    expect((await api.data<EstimatePage>('estimates.list', { status: 'converted' })).items.map((i) => i.id)).toEqual([first.id]);
  });

  it('prints as a quotation on the shop\'s template and shares like an invoice', async () => {
    const e = await estimate({ notes: 'Delivery in 3 days' });
    const { html } = await api.data<{ html: string }>('estimates.renderHtml', { id: e.id });
    expect(html).toContain('Quotation');
    expect(html).toContain('Quotation No');
    expect(html).toContain(e.docNumber);
    expect(html).toContain('Valid until');
    expect(html).toContain('27 Oct 2026');
    expect(html).toContain('Delivery in 3 days');
    expect(html).not.toContain('We declare that this invoice');
    const thermal = await api.data<{ html: string }>('estimates.renderHtml', { id: e.id, templateId: 'thermal-80' });
    expect(thermal.html).toContain('Quotation No');
    const p = await api.data<SharePreview>('share.preview', { docType: 'estimate', id: e.id, channel: 'email' });
    expect(p).toMatchObject({ docLabel: `Quotation ${e.docNumber}`, to: 'gupta@example.com', fileName: `quotation-${e.docNumber.replaceAll('/', '_')}.pdf` });
    expect(p.message).toContain('it is valid until 27 Oct 2026');
  });
});
