import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { vi } from 'vitest';
import { addDays } from '@muneem/domain';
import {
  balanceDrift, dailySummaryDrift, journalsNotMatchingLines, rebuildAccountBalances, rebuildStockLevels, reconcilePartiesDb, replayCheck, tieOutFailures,
  unpostedDocuments, verifyAllAuditChains, withTransaction, type Db,
} from '@muneem/db-sqlite';
import { testApp } from '../helpers.js';
import { Prng } from '../soak/generator.js';
import { TemplateBlock } from './block.js';
import { BlockCloner, CLONED_TABLES, DERIVED_TABLES, snapshotBlock } from './cloner.js';
import { PRICE_CLASSES, setUpScaleShop, type ScaleSize } from './shop.js';

export const FULL_SIZE: ScaleSize = { products: 20_000, customers: 50_000, sales: 500_000, days: 730 };
const BLOCK_DAYS = 2;
const MIN_FREE_BYTES = 2 * 1024 ** 3;

export interface DatasetMeta {
  seed: number; size: ScaleSize; businessId: string; firstDate: string; lastDate: string;
  barcodes: string[]; names: string[]; productIds: string[]; customerIds: string[];
  counts: Record<string, number>; buildMs: number; peakRssMb: number; fileBytes: number; checksMs: Record<string, number>;
}
export interface ScaleDataset { file: string; meta: DatasetMeta }

const memAvailable = () => Number(/MemAvailable:\s+(\d+)/.exec(readFileSync('/proc/meminfo', 'utf8'))?.[1] ?? Infinity) * 1024;
const peakRssMb = () => Math.round(process.resourceUsage().maxRSS / 1024);

// Built once per seed and size under the OS temp dir; MUNEEM_SCALE_REBUILD=1 builds it again.
export async function scaleDataset(size: ScaleSize = FULL_SIZE, seed = 9_500): Promise<ScaleDataset> {
  const dir = join(tmpdir(), 'muneem-scale', `${seed}-${size.sales}-${size.products}-${size.customers}-${size.days}`);
  const file = join(dir, 'muneem.sqlite');
  const metaFile = join(dir, 'dataset.json');
  if (existsSync(metaFile) && process.env.MUNEEM_SCALE_REBUILD !== '1') return { file, meta: JSON.parse(readFileSync(metaFile, 'utf8')) as DatasetMeta };
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const meta = await build(file, size, seed);
  writeFileSync(metaFile, JSON.stringify(meta));
  return { file, meta };
}

async function build(file: string, size: ScaleSize, seed: number): Promise<DatasetMeta> {
  const t0 = performance.now();
  const firstDate = addDays(new Date().toLocaleDateString('en-CA'), -size.days);
  vi.useFakeTimers({ toFake: ['Date'] });
  try {
    vi.setSystemTime(new Date(`${firstDate}T08:00:00`).getTime());
    const { app, db } = await testApp({ dbFile: file });
    const rng = new Prng(seed);
    const shop = await setUpScaleShop(app, db, size, rng, firstDate);
    const actor = { userId: app.session.require().user.id, deviceId: app.device.localDeviceId() };
    const since = new Date(`${firstDate}T09:00:00`).toISOString();
    const before = tableCounts(db);
    const blocks = Math.floor(size.days / BLOCK_DAYS);
    new TemplateBlock(app, shop, rng, (ms) => vi.setSystemTime(ms)).run({
      startDate: firstDate, days: BLOCK_DAYS, salesPerDay: Math.ceil(size.sales / (blocks * BLOCK_DAYS)), purchasesPerDay: 2,
    });
    assertClonable(before, tableCounts(db));
    const cloner = new BlockCloner(db, shop.businessId, actor, snapshotBlock(db, shop.businessId, since), shop.products, shop.customers, rng);
    const classSize = shop.products.length / PRICE_CLASSES;
    for (let k = 1; k < blocks; k++) {
      await waitForMemory();
      withTransaction(db, () => cloner.clone({
        offsetDays: k * BLOCK_DAYS, productShift: ((k * 389) % classSize) * PRICE_CLASSES, customerShift: (k * 7_919) % shop.customers.length, tag: String(k),
      }));
      if (k % 50 === 0) console.info(`scale dataset: block ${k}/${blocks}, ${((performance.now() - t0) / 1000).toFixed(0)} s, peak RSS ${peakRssMb()} MB`);
    }
    db.prepare("UPDATE sync_outbox SET status = 'sent', attempt_count = 1 WHERE status = 'pending'").run();
    withTransaction(db, () => { rebuildStockLevels(db, shop.businessId); rebuildAccountBalances(db, shop.businessId); });
    vi.useRealTimers();
    const checksMs = verify(db, shop.businessId);
    const counts = tableCounts(db);
    db.pragma('wal_checkpoint(TRUNCATE)');
    db.close();
    const pick = <T>(xs: readonly T[]) => Array.from({ length: 200 }, (_, i) => xs[(i * 7_919) % xs.length]!);
    return {
      seed, size, businessId: shop.businessId, firstDate, lastDate: addDays(firstDate, blocks * BLOCK_DAYS - 1),
      barcodes: pick(shop.products).map((p) => p.barcode), names: pick(shop.products).map((p) => p.name), productIds: pick(shop.products).map((p) => p.id),
      customerIds: pick(shop.customers).map((c) => c.id), counts, buildMs: Math.round(performance.now() - t0), peakRssMb: peakRssMb(), fileBytes: statSync(file).size, checksMs,
    };
  } finally {
    vi.useRealTimers();
  }
}

function tableCounts(db: Db): Record<string, number> {
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '%fts%'").pluck().all() as string[];
  return Object.fromEntries(tables.map((t) => [t, db.prepare(`SELECT COUNT(*) FROM "${t}"`).pluck().get() as number]));
}

// A table the template block writes but the cloner neither copies nor rebuilds would leave the dataset inconsistent.
function assertClonable(before: Record<string, number>, after: Record<string, number>): void {
  const missed = Object.keys(after).filter((t) => after[t] !== before[t] && !CLONED_TABLES.has(t) && !DERIVED_TABLES.has(t));
  if (missed.length > 0) throw new Error(`the template block wrote tables the cloner does not handle: ${missed.join(', ')}`);
}

async function waitForMemory(): Promise<void> {
  while (memAvailable() < MIN_FREE_BYTES) {
    console.warn('scale dataset: under 2 GB of free memory; pausing');
    await new Promise((r) => setTimeout(r, 5_000));
  }
}

// The dataset is only useful if it is exactly what the app would have written, so every integrity check must pass.
function verify(db: Db, businessId: string): Record<string, number> {
  const checks: [string, () => unknown, (r: never) => boolean][] = [
    ['dailySummaryDrift', () => dailySummaryDrift(db, businessId), (r: unknown[]) => r.length === 0],
    ['replayCheck', () => replayCheck(db, businessId), (r: unknown[]) => r.length === 0],
    ['reconcileParties', () => reconcilePartiesDb(db, businessId), (r: { mismatches: unknown[]; faults: unknown[] }) => r.mismatches.length + r.faults.length === 0],
    ['tieOuts', () => tieOutFailures(db, businessId), (r: unknown[]) => r.length === 0],
    ['unposted', () => unpostedDocuments(db, businessId), (r: unknown[]) => r.length === 0],
    ['journalsNotMatchingLines', () => journalsNotMatchingLines(db, businessId), (r: number) => r === 0],
    ['balanceDrift', () => balanceDrift(db, businessId), (r: number) => r === 0],
    ['auditChains', () => verifyAllAuditChains(db), (r: { ok: boolean }[]) => r.every((c) => c.ok)],
  ];
  const ms: Record<string, number> = {};
  for (const [name, run, ok] of checks) {
    const t = performance.now();
    const r = run();
    ms[name] = Math.round(performance.now() - t);
    if (!ok(r as never)) throw new Error(`scale dataset failed ${name}: ${JSON.stringify(r).slice(0, 2_000)}`);
  }
  return ms;
}
