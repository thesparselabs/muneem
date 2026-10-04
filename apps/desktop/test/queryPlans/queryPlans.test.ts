import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { CompleteSaleInput, ProductInput, SaleDraft } from '@muneem/contracts';
import { addDays, newUlid } from '@muneem/domain';
import { findUomByCode, type Db } from '@muneem/db-sqlite';
import type { App } from '../../src/main/app.js';
import { caller } from '../helpers.js';
import { runSoak } from '../soak/generator.js';
import { DEVICE_A, DEVICE_B, ownerMembership, referenceCloud, syncedAppOptions, syncedDevice, syncUntilQuiet } from '../sync/syncHelpers.js';
import { queryPlan, StatementRecorder } from './recorder.js';

let recorder: StatementRecorder;
let a: { app: App; db: Db };
let b: { app: App; db: Db };

beforeAll(async () => {
  const cloud = referenceCloud();
  vi.useFakeTimers({ toFake: ['Date'] });
  const run = await runSoak({ seed: 18, days: 3, salesPerDay: 10, endDate: new Date().toLocaleDateString('en-CA'), file: false, setTime: (ms) => vi.setSystemTime(ms), appOptions: syncedAppOptions(cloud, DEVICE_A) });
  vi.useRealTimers();
  a = { app: run.app, db: run.db };
  b = await syncedDevice(cloud, DEVICE_B, () => [ownerMembership(run.businessId)]);
  recorder = new StatementRecorder([a.db, b.db]);
  const { app, db } = a;
  const pcs = findUomByCode(db, run.businessId, 'PCS')!.id;
  const scanned = app.products.create(ProductInput.parse({ name: 'Scanned Tea 250g', baseUomId: pcs, gstRateBp: 500, sellingPricePaise: 12_000, barcodes: [{ code: '8901234567897' }] }));
  const customerId = app.customers.search('Customer', 1)[0]!.id;
  app.register.open(0);
  const today = new Date().toLocaleDateString('en-CA');
  await recorder.during('barcode lookup', () => app.products.lookupBarcode('8901234567897'));
  await recorder.during('product search', () => { app.products.search({ query: 'soak it', limit: 20, mode: 'auto' }); app.products.search({ query: 'item 1', limit: 20, mode: 'auto' }); });
  await recorder.during('customer search', () => app.customers.search('cust', 20));
  const lines = [{ productId: scanned.id, uomId: pcs, qtyMilli: 2000 }];
  await recorder.during('cart quote', () => app.sales.quote(SaleDraft.parse({ lines, customerId })));
  await recorder.during('sale complete', () => {
    for (const credit of [false, true]) {
      const draft = SaleDraft.parse({ lines, customerId });
      const total = app.sales.quote(draft).totals.totalPaise;
      app.sales.complete(CompleteSaleInput.parse({ ...draft, commandId: newUlid(), expectedTotalPaise: total, tenders: [{ method: credit ? 'credit' : 'cash', amountPaise: total }] }));
    }
  });
  await recorder.during('party open items', () => app.payments.openItems('customer', customerId));
  await recorder.during('statement month', () => {
    app.customerLedger.ledger({ partyId: customerId, from: addDays(today, -30), to: today, limit: 100 });
    app.customerLedger.outstanding({ partyId: customerId });
    app.statements.ledger({ accountId: app.statements.accounts().find((x) => x.code === '1100')!.id, from: addDays(today, -30), to: today, limit: 100 });
  });
  await recorder.during('dashboard', () => app.dashboard.get());
  await recorder.during('outbox claim', () => syncUntilQuiet(app));
  await recorder.during('pull apply', async () => {
    await caller(b.app).data('auth.login', { identifier: '9999999999', password: 'correct-horse' });
    await syncUntilQuiet(b.app);
  });
}, 300_000);

afterAll(() => { recorder.restore(); });

// Tables that stay small whatever the shop's volume (one row per business, terminal, month, account or setting).
const SMALL = new Set([
  'business', 'organization', 'branch', 'terminal', 'warehouse', 'user', 'user_membership', 'user_credential', 'uom', 'account', 'accounting_period', 'app_meta',
  'setting', 'doc_series', 'price_list', 'expense_category', 'fy_close', 'gst_setoff', 'gst_payment', 'sync_cursor', 'sync_log', 'sync_device', 'hydration_state',
  'backup_log', 'local_sequence', 'account_balance',
  // One row per party with an opening balance; its only index is partial (posted only), so the open-items union scans it.
  'party_opening',
]);
const LABELS = ['barcode lookup', 'product search', 'customer search', 'cart quote', 'sale complete', 'party open items', 'statement month', 'dashboard', 'outbox claim', 'pull apply'];

// A table scan of anything that grows with the shop's trade, or a walk of a whole business's rows through an index that only narrows
// to the business; co-routines, constant rows and virtual tables are not tables.
function scans(sql: string, plan: readonly string[]): string[] {
  const aliases = new Map([...sql.matchAll(/\b(?:FROM|JOIN)\s+(\w+)\s+(?:AS\s+)?(\w+)/gi)].map((m) => [m[2]!, m[1]!]));
  const derived = new Set(plan.flatMap((d) => /^(?:CO-ROUTINE|MATERIALIZE) (\S+)/.exec(d)?.[1] ?? []));
  return plan.flatMap((d) => {
    const m = /^(?:SCAN (\S+)|SEARCH (\S+) USING (?:INDEX \S+|PRIMARY KEY) \(business_id=\?\)$)/.exec(d);
    const named = m?.[1] ?? m?.[2];
    const table = named && (aliases.get(named) ?? named);
    if (!table || d.includes('VIRTUAL TABLE') || table === 'CONSTANT' || table.startsWith('(subquery') || derived.has(table) || SMALL.has(table)) return [];
    return [d];
  });
}

describe('query plans on the hot paths (LLD §18: no table scans)', () => {
  it('records statements on every hot path', () => {
    const seen = new Set([...recorder.statements().values()].flatMap((l) => [...l]));
    expect(LABELS.filter((l) => !seen.has(l))).toEqual([]);
  });

  it('every statement they run searches an index instead of scanning a growing table', () => {
    const bad: string[] = [];
    for (const [sql, labels] of recorder.statements()) {
      if (!/\b(SELECT|UPDATE|DELETE)\b/i.test(sql)) continue;
      const found = scans(sql, queryPlan(a.db, sql));
      if (found.length > 0) bad.push(`${[...labels].join(', ')}: ${found.join('; ')} — ${sql.replace(/\s+/g, ' ').slice(0, 160)}`);
    }
    expect(bad).toEqual([]);
  });
});
