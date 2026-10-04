import { beforeEach, describe, expect, it } from 'vitest';
import ExcelJS from 'exceljs';
import { ProductInput } from '@muneem/contracts';
import type { Db } from '@muneem/db-sqlite';
import type { App } from '../../src/main/app.js';
import { caller, grantRole, ownerAtTill, testApp } from '../helpers.js';

let app: App;
let db: Db;
let api: ReturnType<typeof caller>;
let saved: { name: string; bytes: Buffer }[];
let html: string[];

beforeEach(async () => {
  saved = [];
  html = [];
  ({ app, db } = await testApp({
    file: true,
    saveFile: (name, bytes) => { saved.push({ name, bytes }); return Promise.resolve({ saved: true, fileName: name }); },
    pdfRenderer: (h) => { html.push(h); return Promise.resolve(Buffer.from('%PDF-fake')); },
  }));
  api = caller(app);
  await ownerAtTill(app);
  const pcs = app.catalog.listUoms().find((u) => u.code === 'PCS')!.id;
  const soap = app.products.create(ProductInput.parse({ name: 'Soap', baseUomId: pcs, gstRateBp: 1800, sellingPricePaise: 11_800, priceIsInclusive: true }));
  app.inventory.setOpeningStock({ lines: [{ productId: soap.id, qtyMilli: 10_000, unitCostPaise: 123_456 }] });
});

describe('report engine and exports (8a, ADR-0046)', () => {
  it('lists only the reports the user may run, and runs the Trial Balance on a read-only connection', async () => {
    expect((await api.data<{ id: string }[]>('reports.listDefinitions')).map((r) => r.id)).toContain('accounting.trialBalance');
    const tb = await api.data<{ rows: unknown[]; totals: { debitPaise: number; creditPaise: number } }>('reports.run', { id: 'accounting.trialBalance', params: {} });
    expect(tb.totals.debitPaise).toBe(tb.totals.creditPaise);
    expect(tb.totals.debitPaise).toBe(1_234_560);
    expect(tb).toMatchObject({ truncated: false });
  });

  it('refuses a bad date and a report the role cannot see', async () => {
    expect(await api.call('reports.run', { id: 'accounting.trialBalance', params: { asOf: '05/10/2026' } }))
      .toMatchObject({ ok: false, error: { code: 'VALIDATION_FAILED', fields: { asOf: expect.any(String) } } });
    expect(await api.call('reports.run', { id: 'nope', params: {} })).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } });
    grantRole(db, app, 'manager');
    expect((await api.data<{ id: string }[]>('reports.listDefinitions')).map((r) => r.id)).toContain('accounting.trialBalance');
    grantRole(db, app, 'cashier');
    expect(await api.call('reports.run', { id: 'accounting.trialBalance', params: {} })).toMatchObject({ ok: false, error: { code: 'PERMISSION_DENIED' } });
  });

  it('exports CSV with a BOM and rupees, XLSX with numeric cells, and PDF through the renderer', async () => {
    for (const format of ['csv', 'xlsx', 'pdf'] as const) {
      await new Promise((r) => setTimeout(r, 1100));
      expect(await api.data('reports.export', { id: 'accounting.trialBalance', params: { asOf: '2026-10-05' }, format })).toMatchObject({ saved: true });
    }
    const csv = saved[0]!.bytes.toString('utf8');
    expect(csv.startsWith('﻿Sharma Store')).toBe(true);
    expect(csv).toContain('Trial Balance');
    expect(csv).toContain('As of: 2026-10-05');
    expect(csv).toContain('Total,12345.6,12345.6');
    expect(saved[0]!.name).toBe('Trial Balance 2026-10-05.csv');

    const book = new ExcelJS.Workbook();
    await book.xlsx.load(saved[1]!.bytes as unknown as ArrayBuffer);
    const values = book.worksheets[0]!.getSheetValues().flat().filter((v) => typeof v === 'number');
    expect(values).toContain(12_345.6);

    expect(saved[2]!.bytes.toString()).toBe('%PDF-fake');
    expect(html[0]).toContain('<h1>Sharma Store</h1>');
    expect(html[0]).toContain('12,345.60');
  });
});
