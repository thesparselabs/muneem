import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CompleteSaleInput, ProductInput, SaleDraft } from '@muneem/contracts';
import { newUlid } from '@muneem/domain';
import { findUomByCode, type Db } from '@muneem/db-sqlite';
import type { App } from '../../src/main/app.js';
import type { WorkerReads } from '../../src/main/background/backgroundReads.js';
import { ownerAtTill, readWorker, testApp } from '../helpers.js';

let app: App;
let db: Db;
let reads: WorkerReads;

beforeAll(async () => {
  const dbFile = join(mkdtempSync(join(tmpdir(), 'muneem-reads-')), 'muneem.sqlite');
  reads = readWorker(dbFile);
  ({ app, db } = await testApp({ dbFile, backgroundReads: reads }));
  const { businessId } = await ownerAtTill(app);
  const pcs = findUomByCode(db, businessId, 'PCS')!.id;
  const p = app.products.create(ProductInput.parse({ name: 'Tea', baseUomId: pcs, gstRateBp: 500, sellingPricePaise: 10_500 }));
  app.register.open(0);
  const draft = SaleDraft.parse({ lines: [{ productId: p.id, uomId: pcs, qtyMilli: 2000 }] });
  const total = app.sales.quote(draft).totals.totalPaise;
  app.sales.complete(CompleteSaleInput.parse({ ...draft, commandId: newUlid(), expectedTotalPaise: total, tenders: [{ method: 'cash', amountPaise: total }] }));
}, 60_000);

afterAll(async () => { await reads.close(); });

describe('the read worker (ADR-0058)', () => {
  it('runs reports on its own connection and sees what the main connection committed', async () => {
    const today = new Date().toLocaleDateString('en-CA');
    const r = await app.reports.run('sales.byDay', { from: today, to: today });
    expect(r.rows).toEqual([expect.objectContaining({ bills: 1 })]);
  });

  it('runs the integrity checks, which find the books whole', async () => {
    expect(await app.diagnostics.integrityCheck()).toMatchObject({ quickCheck: 'ok', foreignKeys: 'ok', auditChain: 'ok', parties: 'ok', journals: 'ok', summaries: 'ok' });
    expect(await app.diagnostics.getHealth()).toMatchObject({ auditChainOk: true });
  });

  it('a summary the worker finds drifted is rebuilt by the main connection', async () => {
    db.prepare('UPDATE daily_sales_summary SET sale_total_paise = sale_total_paise + 1').run();
    expect(await app.diagnostics.checkSummaries()).toBe('healed');
    expect(await app.diagnostics.checkSummaries()).toBe('ok');
  });

  it('passes a business rule failure back as the same AppError', async () => {
    await expect(app.reports.run('accounting.ledger', { accountCode: '9999' })).rejects.toMatchObject({ name: 'AppError', code: 'VALIDATION_FAILED', fields: { accountCode: 'not an account code' } });
  });
});
