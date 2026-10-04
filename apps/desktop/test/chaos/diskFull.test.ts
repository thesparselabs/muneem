import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { newUlid } from '@muneem/domain';
import { CompleteReturnInput, CompleteSaleInput, CreatePurchaseInput, ProductInput, PurchaseDraft, SaleDraft } from '@muneem/contracts';
import { quickCheck, type Db } from '@muneem/db-sqlite';
import type { App } from '../../src/main/app.js';
import { caller, ownerAtTill, testApp } from '../helpers.js';
import { checkDocuments } from './checkDocuments.js';

let app: App;
let db: Db;
let dir: string;
let pcs: string;
let tea: string;
let supplierId: string;

beforeEach(async () => {
  ({ app, db, dir } = await testApp({ file: true }));
  await ownerAtTill(app, { gstin: '07AAAAA0000A1Z5' });
  await caller(app).data('printer.setConfig', { kind: 'none' });
  pcs = app.catalog.listUoms().find((u) => u.code === 'PCS')!.id;
  tea = app.products.create(ProductInput.parse({ name: 'Tea 250g', baseUomId: pcs, hsnCode: '0902', gstRateBp: 500, sellingPricePaise: 12_000 })).id;
  app.inventory.setOpeningStock({ lines: [{ productId: tea, qtyMilli: 500_000, unitCostPaise: 8_000 }] });
  supplierId = app.suppliers.create({ name: 'Acme', stateCode: '07', gstin: '07CCCCC0000C1Z5', taxScheme: 'regular', creditDays: 30 }).id;
  await app.register.open(10_000);
});

// SQLite answers a write past max_page_count exactly as it answers ENOSPC: SQLITE_FULL.
function fillDisk(): void {
  db.pragma('wal_checkpoint(TRUNCATE)');
  expect(db.pragma('freelist_count', { simple: true }), 'no free pages to grow into').toBe(0);
  db.pragma(`max_page_count = ${String(db.pragma('page_count', { simple: true }))}`);
}
const freeSpace = () => { db.pragma('max_page_count = 1073741823'); };

const tables = () => db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name").pluck().all() as string[];
const rowCounts = () => Object.fromEntries(tables().map((t) => [t, db.prepare(`SELECT COUNT(*) FROM "${t}"`).pluck().get() as number]));

function saleInput() {
  const draft = SaleDraft.parse({ lines: [{ productId: tea, uomId: pcs, qtyMilli: 2000 }] });
  const total = app.sales.quote(draft).totals.totalPaise;
  return { ...draft, commandId: newUlid(), expectedTotalPaise: total, tenders: [{ method: 'cash', amountPaise: total }] };
}
function purchaseInput() {
  const draft = PurchaseDraft.parse({ supplierId, supplierInvoiceNo: 'A-1', supplierInvoiceDate: new Date().toLocaleDateString('en-CA'),
    lines: [{ productId: tea, uomId: pcs, qtyMilli: 10_000, unitPricePaise: 7_000 }] });
  return CreatePurchaseInput.parse({ ...draft, billTotalPaise: app.purchases.quote(draft).totals.totalPaise, commandId: newUlid() });
}
function returnInput() {
  const saleId = app.sales.complete(CompleteSaleInput.parse(saleInput())).saleId;
  const back = { saleId, lines: [{ lineNo: 1, qtyMilli: 1000 }] };
  return CompleteReturnInput.parse({ ...back, commandId: newUlid(), reason: 'damaged', expectedTotalPaise: app.returns.quote(back).totalPaise });
}

// The replay goes straight to the service: the gateway allows two returns or purchases a second.
const COMMANDS = [
  { channel: 'sales.complete', table: 'sale', input: saleInput, replay: (c: unknown) => app.sales.complete(CompleteSaleInput.parse(c)).saleId, id: (r: unknown) => (r as { saleId: string }).saleId },
  { channel: 'purchases.create', table: 'purchase', input: purchaseInput, replay: (c: unknown) => app.purchases.create(CreatePurchaseInput.parse(c)).id, id: (r: unknown) => (r as { id: string }).id },
  { channel: 'returns.complete', table: 'credit_note', input: returnInput, replay: (c: unknown) => app.returns.complete(CompleteReturnInput.parse(c)).creditNoteId,
    id: (r: unknown) => (r as { creditNoteId: string }).creditNoteId },
];

describe('disk full during a commit (9g)', () => {
  it.each(COMMANDS)('$channel fails cleanly with DISK_FULL, leaves nothing behind, and the same command succeeds once after space returns', async ({ channel, table, input, replay, id }) => {
    const command = input();
    const before = rowCounts();
    fillDisk();

    const failed = await caller(app).call(channel, command);
    expect(failed).toMatchObject({ ok: false, error: { code: 'DISK_FULL', class: 'transient', message: expect.stringMatching(/disk is full.*try the same action again/i) } });
    expect(db.inTransaction).toBe(false);
    expect(rowCounts()).toEqual(before);
    expect(quickCheck(db).ok).toBe(true);

    freeSpace();
    const done = await caller(app).data(channel, command);
    expect(replay(command)).toBe(id(done));
    expect(rowCounts()[table]).toBe(before[table]! + 1);
    const report = checkDocuments(join(dir, 'muneem.sqlite'));
    expect(report.failures).toEqual([]);
  });
});
