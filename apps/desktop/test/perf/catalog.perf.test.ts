import { beforeAll, describe, expect, it } from 'vitest';
import { ProductInput } from '@muneem/contracts';
import { createProduct, findUomByCode, withTransaction, type Db } from '@muneem/db-sqlite';
import type { App } from '../../src/main/app.js';
import { testApp } from '../helpers.js';

const SKUS = 5_000;
const LOOKUPS = 1_000;
const WORDS = ['Masala', 'Basmati', 'Toor', 'Sunflower', 'Detergent', 'Biscuit', 'Tea', 'Coffee', 'Soap', 'Shampoo', 'चाय', 'आटा'];

let app: App;
let db: Db;
let codes: string[];

const p95 = (samples: number[]): number => [...samples].sort((a, b) => a - b)[Math.floor(samples.length * 0.95)]!;
function timeEach<T>(inputs: readonly T[], fn: (input: T) => unknown): number[] {
  return inputs.map((input) => {
    const t0 = performance.now();
    fn(input);
    return performance.now() - t0;
  });
}
const pick = <T>(xs: readonly T[], n: number, seed = 7): T[] => {
  let s = seed;
  return Array.from({ length: n }, () => xs[(s = (s * 1_103_515_245 + 12_345) % 2 ** 31) % xs.length]!);
};

beforeAll(async () => {
  ({ app, db } = await testApp({ file: true }));
  await app.gateway.handle('auth.login', { identifier: '9999999999', password: 'correct-horse' }, 1);
  await app.gateway.handle('business.create', { name: 'Big Store', businessType: 'retail', stateCode: '07', taxScheme: 'regular' }, 1);
  const s = app.session.require();
  const pcs = findUomByCode(db, s.businessId!, 'PCS')!.id;
  const actor = { userId: s.user.id, deviceId: app.device.localDeviceId() };
  codes = [];
  withTransaction(db, () => {
    for (let i = 0; i < SKUS; i++) {
      const barcodes = [{ code: `890${String(i).padStart(9, '0')}X` }, ...(i % 2 === 0 ? [{ code: `ALT${i}` }] : [])];
      codes.push(...barcodes.map((b) => b.code));
      createProduct(db, s.businessId!, ProductInput.parse({
        name: `${WORDS[i % WORDS.length]} ${i} ${WORDS[(i * 7) % WORDS.length]}`, sku: `SKU${i}`, baseUomId: pcs,
        gstRateBp: 500, sellingPricePaise: 1000 + i, barcodes,
      }), actor, '2026-09-30');
    }
  });
}, 120_000);

describe(`catalog performance at ${SKUS} SKUs (LLD §18)`, () => {
  it('barcode lookup p95 < 30 ms, cold', () => {
    const samples = timeEach([...new Set(pick(codes, LOOKUPS * 2))].slice(0, LOOKUPS), (code) => {
      expect(app.products.lookupBarcode(code)).not.toBeNull();
    });
    console.info(`barcode cold p95 = ${p95(samples).toFixed(3)} ms`);
    expect(p95(samples)).toBeLessThan(30);
  });

  it('barcode lookup p95 < 30 ms, warm', () => {
    const hot = pick(codes, 200, 11);
    hot.forEach((c) => app.products.lookupBarcode(c));
    const samples = timeEach(pick(hot, LOOKUPS, 13), (code) => app.products.lookupBarcode(code));
    console.info(`barcode warm p95 = ${p95(samples).toFixed(3)} ms`);
    expect(p95(samples)).toBeLessThan(30);
  });

  it('prefix search p95 < 60 ms', () => {
    const queries = pick(['ma', 'bas', 'to', 'sun', 'det', 'bi', 'te', 'co', 'so', 'sh', 'चा', 'आ', 'masala 1', 'tea'], 300);
    const samples = timeEach(queries, (query) => app.products.search({ query, limit: 20, mode: 'auto' }));
    console.info(`search p95 = ${p95(samples).toFixed(3)} ms`);
    expect(p95(samples)).toBeLessThan(60);
  });
});
