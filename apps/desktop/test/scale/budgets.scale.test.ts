import { copyFileSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SaleDraft, type CompleteSaleResult, type ProductHit, type SaleQuote } from '@muneem/contracts';
import { addDays, newUlid } from '@muneem/domain';
import { MIGRATIONS, openDatabase, rebuildDailySummaries, withTransaction, type Db } from '@muneem/db-sqlite';
import type { App } from '../../src/main/app.js';
import { openAndMigrate } from '../../src/main/infra/db.js';
import { markCleanExit, takeCleanExit } from '../../src/main/infra/cleanExit.js';
import { silentLoggers } from '../../src/main/infra/logger.js';
import { addHit, emptyCart, localTotals } from '../../src/renderer/src/lib/pos/cart.js';
import { caller, readWorker, testApp } from '../helpers.js';
import { scaleDataset, type ScaleDataset } from './dataset.js';
import { rssMb, sampled, summarise, table, time, within, type BudgetRow } from './measure.js';

// The 4 GB-class profile: this process runs with --max-old-space-size=1536 (vitest.scale.config.ts) and the shipped SQLite pragmas;
// RSS counts the database pages each of its three connections maps (up to 256 MiB each), so the ceiling is the heap cap.
const RSS_CEILING_MB = 1_536;
const SAMPLES = 200;

let ds: ScaleDataset;
let app: App;
let db: Db;
let api: ReturnType<typeof caller>;
let peakRss = 0;
const rows: BudgetRow[] = [];
const info: string[] = [];
const watchRss = () => { peakRss = Math.max(peakRss, rssMb()); };

// The longest gap between 5 ms ticks: how long the thread that bills was held by one synchronous piece of work.
function longestSlice(): { stop: () => number } {
  let last = performance.now();
  let longest = 0;
  const timer = setInterval(() => { const now = performance.now(); longest = Math.max(longest, now - last - 5); last = now; }, 5);
  return { stop: () => { clearInterval(timer); return Math.max(longest, performance.now() - last - 5); } };
}

// A 10-line bill through the IPC gateway; every fifth one goes on a customer's account.
async function sell(s: number): Promise<CompleteSaleResult> {
  const ids = ds.meta.productIds;
  const pcs = db.prepare("SELECT id FROM uom WHERE business_id = ? AND code = 'PCS'").pluck().get(ds.meta.businessId) as string;
  const credit = s % 5 === 0;
  const customerId = credit ? ds.meta.customerIds[s % ds.meta.customerIds.length]! : undefined;
  const draft = SaleDraft.parse({ lines: Array.from({ length: 10 }, (_, i) => ({ productId: ids[(s * 10 + i * 37) % ids.length]!, uomId: pcs, qtyMilli: 1000 + (i % 3) * 1000 })), ...(customerId && { customerId }) });
  const total = app.sales.quote(draft).totals.totalPaise;
  return ok(await api.call<CompleteSaleResult>('sales.complete', { ...draft, commandId: newUlid(), expectedTotalPaise: total, tenders: [{ method: credit ? 'credit' : 'cash', amountPaise: total }] }));
}

const ok = <T>(r: { ok: true; data: T } | { ok: false; error: unknown }): T => {
  if (!r.ok) throw new Error(JSON.stringify(r.error));
  return r.data;
};

beforeAll(async () => {
  ds = await scaleDataset();
  info.push(`dataset: ${ds.meta.counts.sale} sales, ${ds.meta.counts.product} products, ${ds.meta.counts.customer} customers, ${(ds.meta.fileBytes / 1024 ** 3).toFixed(1)} GiB; `
    + `built in ${(ds.meta.buildMs / 1000).toFixed(0)} s at peak RSS ${ds.meta.peakRssMb} MB; build checks ${JSON.stringify(ds.meta.checksMs)}`);
  const phases: Record<string, number> = {};
  markCleanExit(ds.file); // the builder closed the database, as a normal quit does
  const cold = await time(async () => {
    const opened = await time(() => testApp({
      dbFile: ds.file, backgroundReads: readWorker(ds.file), openDb: async (file) => {
        const t = await time(() => openAndMigrate({ file, backups: join(dirname(file), 'backups') }, silentLoggers(), undefined, { quickCheck: !takeCleanExit(file) }));
        phases.openAndMigrate = t.ms;
        return t.value.db;
      },
    }));
    ({ app, db } = opened.value);
    phases.createApp = opened.ms - phases.openAndMigrate!;
    api = caller(app);
    phases.login = (await time(() => api.data('auth.login', { identifier: '9999999999', password: 'correct-horse' }))).ms;
    phases.firstSearch = (await time(() => api.data('products.search', { query: ds.meta.names[0]!.slice(0, 4) }))).ms;
  });
  rows.push({ path: 'Cold start to billable (open + migrate check + createApp + login + first search)', budgetMs: 3_000, stat: 'median', sample: summarise([cold.ms]),
    note: Object.entries(phases).map(([k, v]) => `${k} ${v.toFixed(0)}`).join(', ') });
  watchRss();
  if (!app.register.current()) app.register.open(0);
}, 7_200_000);

afterAll(() => {
  console.info(`\nLLD §18 budgets at ${ds.meta.size.sales} transactions / ${ds.meta.size.products} SKUs / ${ds.meta.size.customers} customers (4 GB profile)\n${table(rows)}\n${info.join('\n')}\npeak RSS ${peakRss} MB (ceiling ${RSS_CEILING_MB} MB)`);
  app?.closeReadConnections();
  db?.close();
});

describe('LLD §18 budgets at 500k transactions (NFR-001, NFR-021)', () => {
  it('cold start to billable is under 3 s', () => {
    expect(within(rows[0]!), rows[0]!.note).toBe(true);
  });

  it('barcode → product is under 30 ms (each code scanned for the first time)', async () => {
    const sample = await sampled(SAMPLES, 30, async (i) => ok(await api.call<ProductHit | null>('products.lookupBarcode', { code: ds.meta.barcodes[i % ds.meta.barcodes.length]! })));
    const row: BudgetRow = { path: 'Barcode → product (products.lookupBarcode, LRU miss)', budgetMs: 30, stat: 'median', sample };
    rows.push(row);
    watchRss();
    expect(within(row)).toBe(true);
  }, 120_000);

  it('product prefix search is under 60 ms', async () => {
    const prefixes = ds.meta.names.map((n, i) => n.slice(0, 3 + (i % 5)));
    const sample = await sampled(SAMPLES, 30, async (i) => ok(await api.call<ProductHit[]>('products.search', { query: prefixes[i % prefixes.length]!, limit: 20 })));
    const row: BudgetRow = { path: 'Product prefix search (products.search, 3–7 letters, limit 20)', budgetMs: 60, stat: 'median', sample };
    rows.push(row);
    const customers = await sampled(50, 20, async (i) => ok(await api.call('customers.search', { query: ['ram', 'sun', 'pri', 'vik', '98'][i % 5]!, limit: 20 })));
    rows.push({ path: 'Customer search at the till (customers.search) — no LLD budget, held to the product search one', budgetMs: 60, stat: 'median', sample: customers });
    watchRss();
    expect(within(row)).toBe(true);
  }, 120_000);

  it('cart recalculation is under 10 ms', async () => {
    const hits = (await Promise.all(ds.meta.barcodes.slice(0, 20).map((code) => api.data<ProductHit | null>('products.lookupBarcode', { code })))).filter((h): h is ProductHit => h !== null);
    const cart = hits.reduce(addHit, emptyCart());
    const quote = await api.data<SaleQuote>('sales.quote', { lines: hits.map((h) => ({ productId: h.productId, uomId: h.uomId, qtyMilli: 1000 })) });
    const local = summarise(Array.from({ length: 1_000 }, () => { const t = performance.now(); localTotals(cart, quote.context); return performance.now() - t; }));
    const row: BudgetRow = { path: `Cart recalculation (renderer engine, ${hits.length} lines)`, budgetMs: 10, stat: 'p95', sample: local };
    rows.push(row);
    const lines = hits.slice(0, 10).map((h) => ({ productId: h.productId, uomId: h.uomId, qtyMilli: 2000 }));
    rows.push({ path: 'Cart quote round trip (sales.quote, 10 lines) — authoritative re-price after a scan', budgetMs: 60, stat: 'median',
      sample: await sampled(100, 30, async () => ok(await api.call('sales.quote', { lines }))) });
    expect(within(row)).toBe(true);
  }, 120_000);

  it(`sales.complete p95 over ${SAMPLES} sales is under 250 ms`, async () => {
    const sample = await sampled(SAMPLES, 5, (s) => sell(s));
    const row: BudgetRow = { path: 'sales.complete (10 lines, every 5th on credit)', budgetMs: 250, stat: 'p95', sample };
    rows.push(row);
    watchRss();
    expect(within(row)).toBe(true);
  }, 600_000);

  it('the dashboard is under 300 ms', async () => {
    const sample = await sampled(20, 5, async () => ok(await api.call('reports.dashboard', {})));
    const row: BudgetRow = { path: 'Dashboard (reports.dashboard)', budgetMs: 300, stat: 'median', sample };
    rows.push(row);
    watchRss();
    expect(within(row)).toBe(true);
  }, 120_000);

  it('reports and exports at 500k (ADR-0046) are timed', async () => {
    const to = new Date().toLocaleDateString('en-CA');
    const year = { from: addDays(to, -364), to };
    for (const [id, params] of [['sales.byDay', year], ['sales.byProduct', year], ['sales.byPaymentMethod', year], ['parties.receivables', {}],
      ['stock.valuation', {}], ['accounting.trialBalance', {}], ['accounting.profitAndLoss', year], ['accounting.balanceSheet', {}]] as const) {
      const t = await time(async () => ok(await api.call<{ rows: unknown[] }>('reports.run', { id, params })));
      info.push(`report ${id}: ${t.ms.toFixed(0)} ms (${t.value.rows.length} rows)`);
      await new Promise((r) => setTimeout(r, 250));
    }
    const exp = await time(() => app.reports.export('sales.byDay', year, 'xlsx'));
    info.push(`export sales.byDay xlsx: ${exp.ms.toFixed(0)} ms`);
    watchRss();
  }, 600_000);

  it('the scheduled integrity checks are timed', async () => {
    const since = addDays(new Date().toLocaleDateString('en-CA'), -35);
    for (const [name, run] of [
      ['checkSummaries (35 days)', () => app.diagnostics.checkSummaries(since)], ['checkParties', () => app.diagnostics.checkParties()],
      ['checkJournals', () => app.diagnostics.checkJournals()], ['verifyAudit', () => app.diagnostics.verifyAudit()],
      ['checkStock (scheduled slice)', () => app.diagnostics.checkStock({ slice: true })], ['getHealth', () => app.diagnostics.getHealth()],
      ['checkSummaries (whole history)', () => app.diagnostics.checkSummaries()],
    ] as const) {
      const t = await time(run as () => unknown);
      info.push(`${name}: ${t.ms.toFixed(0)} ms`);
    }
    watchRss();
  }, 1_800_000);

  it('billing stays within budget while the scheduled checks and a whole-history drift check run (ADR-0058)', async () => {
    const longest = longestSlice();
    const alone = await time(() => Promise.all([app.diagnostics.scheduledChecks(), app.diagnostics.checkSummaries()]));
    const longestSliceMs = longest.stop();
    let running = true;
    const checks = Promise.all([app.diagnostics.scheduledChecks(), app.diagnostics.checkSummaries()]).finally(() => { running = false; });
    const during: number[] = [];
    for (let s = 0; running || during.length < 20; s++) {
      during.push((await time(() => sell(10_000 + s))).ms);
      await new Promise((r) => setTimeout(r, 200));
    }
    await checks;
    const row: BudgetRow = { path: 'sales.complete while the scheduled checks + whole-history drift check run', budgetMs: 250, stat: 'p95', sample: summarise(during),
      note: `checks alone ${(alone.ms / 1000).toFixed(1)} s; longest main-thread slice ${longestSliceMs.toFixed(0)} ms` };
    rows.push(row);
    watchRss();
    expect(within(row)).toBe(true);
    expect(longestSliceMs).toBeLessThan(100);
  }, 1_800_000);

  it('the process stays under its RSS ceiling', () => {
    watchRss();
    expect(peakRss).toBeLessThan(RSS_CEILING_MB);
  });
});

// MUNEEM_SCALE_MIGRATION=0 skips the half hour this takes, for runs that only need the budgets.
describe.skipIf(process.env.MUNEEM_SCALE_MIGRATION === '0')('migration runtime at 500k', () => {
  it('an upgrade (quick_check, pre-migration backup, migrate, foreign_key_check, row counts) is timed on a copy', async () => {
    const dir = join(dirname(ds.file), 'migration-copy');
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });
    const file = join(dir, 'muneem.sqlite');
    db.pragma('wal_checkpoint(TRUNCATE)');
    const copy = await time(() => copyFileSync(ds.file, file));
    try {
      const latest = MIGRATIONS.at(-1)!.version;
      const probe = { version: latest + 1, name: 'scale_probe', sql: 'CREATE INDEX ix_scale_probe ON sale(business_id, total_paise);' };
      const t = await time(() => openAndMigrate({ file, backups: join(dir, 'backups') }, silentLoggers(), undefined, { migrations: [...MIGRATIONS, probe] }));
      t.value.db.close();
      const backfill = openDatabase(file, { quickCheck: false });
      const rebuild = await time(() => withTransaction(backfill, () => rebuildDailySummaries(backfill, ds.meta.businessId)));
      backfill.close();
      info.push(`migration: copy ${copy.ms.toFixed(0)} ms; upgrade with one index migration ${t.ms.toFixed(0)} ms; a 0018-style backfill (rebuildDailySummaries) ${rebuild.ms.toFixed(0)} ms`);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 3_600_000);
});
