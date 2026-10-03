import { beforeAll, describe, expect, it } from 'vitest';
import { CompleteSaleInput, CustomerInput, ProductInput, SaleDraft } from '@muneem/contracts';
import { newUlid } from '@muneem/domain';
import { createCustomer, createProduct, findUomByCode, setCustomerCreditLimit, withTransaction, type Db } from '@muneem/db-sqlite';
import type { App } from '../../src/main/app.js';
import { ownerAtTill, testApp } from '../helpers.js';

const SKUS = 5_000;
const SALES = 200;
const LINES = 10;

let app: App;
let db: Db;
let products: string[];
let pcs: string;
let customerId: string;

const p95 = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length * 0.95)]!;

beforeAll(async () => {
  ({ app, db } = await testApp({ file: true }));
  const { businessId } = await ownerAtTill(app);
  pcs = findUomByCode(db, businessId, 'PCS')!.id;
  const actor = { userId: app.session.require().user.id, deviceId: app.device.localDeviceId() };
  products = [];
  withTransaction(db, () => {
    for (let i = 0; i < SKUS; i++) {
      products.push(createProduct(db, businessId, ProductInput.parse({
        name: `Item ${i}`, sku: `S${i}`, baseUomId: pcs, gstRateBp: [0, 500, 1200, 1800][i % 4], sellingPricePaise: 1000 + i, barcodes: [{ code: `B${i}` }],
      }), actor, new Date().toLocaleDateString('en-CA')).id);
    }
  });
  const customer = createCustomer(db, businessId, CustomerInput.parse({ name: 'Credit customer' }), actor);
  customerId = setCustomerCreditLimit(db, customer.id, customer.version, 100_000_000_000, actor).id;
  app.register.open(0);
}, 120_000);

describe(`sales.complete at ${SKUS} SKUs (LLD §18)`, () => {
  it(`p95 of ${SALES} ${LINES}-line sales is under 250 ms`, () => {
    const samples: number[] = [];
    for (let s = 0; s < SALES; s++) {
      const lines = Array.from({ length: LINES }, (_, i) => ({ productId: products[(s * LINES + i * 37) % SKUS]!, uomId: pcs, qtyMilli: 1000 + i * 500 }));
      const total = app.sales.quote(SaleDraft.parse({ lines })).totals.totalPaise;
      const input = CompleteSaleInput.parse({ lines, commandId: newUlid(), expectedTotalPaise: total, tenders: [{ method: 'cash', amountPaise: total }] });
      const t0 = performance.now();
      app.sales.complete(input);
      samples.push(performance.now() - t0);
    }
    console.info(`sales.complete p95 = ${p95(samples).toFixed(2)} ms`);
    expect(p95(samples)).toBeLessThan(250);
  });

  it(`p95 of ${SALES} ${LINES}-line credit sales is under 250 ms (ADR-0026)`, () => {
    const samples: number[] = [];
    for (let s = 0; s < SALES; s++) {
      const lines = Array.from({ length: LINES }, (_, i) => ({ productId: products[(s * LINES + i * 41) % SKUS]!, uomId: pcs, qtyMilli: 1000 + i * 500 }));
      const total = app.sales.quote(SaleDraft.parse({ lines, customerId })).totals.totalPaise;
      const input = CompleteSaleInput.parse({ lines, customerId, commandId: newUlid(), expectedTotalPaise: total, tenders: [{ method: 'credit', amountPaise: total }] });
      const t0 = performance.now();
      app.sales.complete(input);
      samples.push(performance.now() - t0);
    }
    console.info(`credit sales.complete p95 = ${p95(samples).toFixed(2)} ms`);
    expect(p95(samples)).toBeLessThan(250);
  });
});
