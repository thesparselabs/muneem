import { mkdirSync, writeFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { newUlid } from '@muneem/domain';
import { CompleteReturnInput, CompleteSaleInput, CreatePurchaseInput, GstPaymentInput, PurchaseDraft, SaleDraft } from '@muneem/contracts';
import type { Db } from '@muneem/db-sqlite';
import { runSoak } from '../soak/generator.js';
import { caller, ownerAtTill, testApp } from '../helpers.js';

// Writes real outbox payloads for the Go ingest checks (cloud: MUNEEM_SYNC_CENSUS=<file> go test ./internal/devicesync/...):
// MUNEEM_SYNC_CENSUS_OUT=<dir> [MUNEEM_SYNC_CENSUS_SEED=7 MUNEEM_SYNC_CENSUS_DAYS=60] vitest run test/sync/dumpCensus.test.ts
const OUT = process.env.MUNEEM_SYNC_CENSUS_OUT;
const run = OUT ? it : it.skip;

function dump(db: Db, businessId: string, file: string): void {
  const rows = db.prepare('SELECT * FROM sync_outbox WHERE business_id = ? ORDER BY seq').all(businessId) as Record<string, unknown>[];
  const operations = rows.map((r) => ({
    operationId: r.operation_id, seq: r.seq, entityType: r.entity_type, entityId: r.entity_id, operationType: r.operation_type,
    dependsOn: r.depends_on_operation_id ?? null, payloadHash: r.payload_hash, payload: JSON.parse(r.payload_json as string) as unknown,
  }));
  mkdirSync(OUT!, { recursive: true });
  writeFileSync(`${OUT!}/${file}`, JSON.stringify({ businessId, operations }));
}

describe('sync census dumps', () => {
  run('a seeded soak', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const soak = await runSoak({
      seed: Number(process.env.MUNEEM_SYNC_CENSUS_SEED ?? 7), days: Number(process.env.MUNEEM_SYNC_CENSUS_DAYS ?? 60), salesPerDay: 10,
      endDate: '2026-04-05', file: false, setTime: (ms) => vi.setSystemTime(ms),
    });
    vi.useRealTimers();
    dump(soak.db, soak.businessId, 'soak.json');
  }, 600_000);

  // What the soak never makes: bill and line discounts, cess, inter-state supply and change given, and returns of such lines.
  run('sales the soak does not make', async () => {
    const { app, db } = await testApp();
    const api = caller(app);
    const { businessId } = await ownerAtTill(app);
    const pcs = (await api.data<{ id: string; code: string }[]>('catalog.listUoms')).find((u) => u.code === 'PCS')!.id;
    const product = (name: string, o: Record<string, unknown>) => api.data<{ id: string }>('products.create', { name, baseUomId: pcs, ...o });
    const soap = await product('Soap', { gstRateBp: 1800, sellingPricePaise: 11_833, priceIsInclusive: true });
    const cola = await product('Cola', { gstRateBp: 2800, cessRateBp: 1200, sellingPricePaise: 4_017, priceIsInclusive: true });
    const rice = await product('Rice', { gstRateBp: 500, sellingPricePaise: 6_789, priceIsInclusive: false });
    const salt = await product('Salt', { gstRateBp: 0, taxTreatment: 'nil_rated', sellingPricePaise: 2_250, priceIsInclusive: true });
    const local = app.customers.create({ name: 'Ravi' });
    const mumbai = app.customers.create({ name: 'Mumbai Traders', stateCode: '27' });
    await app.register.open(100_000);
    const lines = [
      { productId: soap.id, uomId: pcs, qtyMilli: 3000, lineDiscount: { kind: 'percent', value: 1250 } },
      { productId: cola.id, uomId: pcs, qtyMilli: 7000 },
      { productId: rice.id, uomId: pcs, qtyMilli: 1250, lineDiscount: { kind: 'amount', value: 333 } },
      { productId: salt.id, uomId: pcs, qtyMilli: 2000 },
    ];
    const drafts = [
      { lines, billDiscount: { kind: 'percent', value: 777 } },
      { lines, billDiscount: { kind: 'amount', value: 1999 }, customerId: local.id },
      { lines, customerId: mumbai.id },
      { lines: lines.slice(1, 3), billDiscount: { kind: 'percent', value: 333 }, customerId: mumbai.id },
      { lines: lines.slice(0, 1), placeOfSupplyOverride: { stateCode: '29', reason: 'delivered to Bengaluru' } },
    ];
    const saleIds: string[] = [];
    for (const [i, d] of drafts.entries()) {
      const draft = SaleDraft.parse(d);
      const total = app.sales.quote(draft).totals.totalPaise;
      const tenders = i % 2 === 0
        ? [{ method: 'cash', amountPaise: Math.ceil((total + 1) / 10_000) * 10_000 }]
        : [{ method: 'upi', amountPaise: total - 1000 }, { method: 'cash', amountPaise: 5000 }];
      saleIds.push(app.sales.complete(CompleteSaleInput.parse({ ...draft, commandId: newUlid(), expectedTotalPaise: total, tenders })).saleId);
    }
    const giveBack = (saleId: string, back: { lineNo: number; qtyMilli: number }[]) => {
      const d = { saleId, lines: back };
      app.returns.complete(CompleteReturnInput.parse({ ...d, commandId: newUlid(), reason: 'returned', expectedTotalPaise: app.returns.quote(d).totalPaise }));
    };
    giveBack(saleIds[0]!, [{ lineNo: 2, qtyMilli: 3000 }, { lineNo: 3, qtyMilli: 250 }]);
    giveBack(saleIds[0]!, [{ lineNo: 2, qtyMilli: 4000 }]);
    giveBack(saleIds[1]!, [{ lineNo: 1, qtyMilli: 1000 }]);
    app.returns.cancel({ saleId: saleIds[2]!, reason: 'wrong bill' });
    dump(db, businessId, 'variety.json');
  }, 120_000);

  // ADR-0044: a month's set-off with IGST credit used across heads, and the challan that pays the rest.
  run('a GST set-off and payment', async () => {
    let clock = Date.parse('2026-05-10T06:30:00Z');
    const { app, db } = await testApp({ now: () => clock });
    const api = caller(app);
    const { businessId } = await ownerAtTill(app, { gstin: '07AAAAA0000A1Z5' });
    const pcs = (await api.data<{ id: string; code: string }[]>('catalog.listUoms')).find((u) => u.code === 'PCS')!.id;
    const soap = await api.data<{ id: string }>('products.create', { name: 'Soap', hsnCode: '3401', baseUomId: pcs, gstRateBp: 1800, cessRateBp: 100, sellingPricePaise: 118_000 });
    const supplier = app.suppliers.create({ name: 'Pune Mills', stateCode: '27', gstin: '27DDDDD0000D1Z5', taxScheme: 'regular', creditDays: 30 });
    const draft = PurchaseDraft.parse({ supplierId: supplier.id, supplierInvoiceNo: 'P-1', supplierInvoiceDate: '2026-05-02',
      lines: [{ productId: soap.id, uomId: pcs, qtyMilli: 3000, unitPricePaise: 60_000 }] });
    app.purchases.create(CreatePurchaseInput.parse({ ...draft, billTotalPaise: app.purchases.quote(draft).totals.totalPaise, commandId: newUlid() }));
    await app.register.open(100_000);
    const sale = SaleDraft.parse({ lines: [{ productId: soap.id, uomId: pcs, qtyMilli: 10_000 }] });
    const total = app.sales.quote(sale).totals.totalPaise;
    app.sales.complete(CompleteSaleInput.parse({ ...sale, commandId: newUlid(), expectedTotalPaise: total, tenders: [{ method: 'cash', amountPaise: total }] }));
    clock = Date.parse('2026-06-04T06:30:00Z');
    const setoff = app.gst.setoffs.post({ month: '2026-05-01', commandId: newUlid() });
    app.gst.payments.record(GstPaymentInput.parse({ commandId: newUlid(), paymentDate: '2026-06-04', challanRef: 'CPIN26060400001', month: '2026-05-01', ...setoff.cash }));
    dump(db, businessId, 'gst.json');
  }, 120_000);

  // ADR-0045: two months of a seeded soak across 1 April, then the year set off, locked and closed.
  run('a year-end close', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const soak = await runSoak({ seed: 11, days: 45, salesPerDay: 4, endDate: '2026-04-20', file: false, setTime: (ms) => vi.setSystemTime(ms), yearEnd: true });
    vi.useRealTimers();
    expect(soak.app.yearEnd.list().find((y) => y.fy === '2025-26')).toMatchObject({ status: 'closed' });
    dump(soak.db, soak.businessId, 'yearend.json');
  }, 600_000);
});
