import { beforeAll, describe, expect, it } from 'vitest';
import { CompleteSaleInput, ProductInput, SaleDraft } from '@muneem/contracts';
import { newUlid } from '@muneem/domain';
import { createProduct, findUomByCode, withTransaction, type Db } from '@muneem/db-sqlite';
import type { App } from '../../src/main/app.js';
import { ownerAtTill, testApp } from '../helpers.js';
import type { Transport } from '../../src/main/sync/transport.js';
import { deviceServer, DEVICE_A } from '../sync/syncHelpers.js';

const SKUS = 2_000;
const SALES = 60;
const ROUNDS = 5;
const LINES = 8;

let app: App;
let db: Db;
let products: string[];
let pcs: string;

const p95 = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length * 0.95)]!;
const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]!;
const tick = () => new Promise((r) => setImmediate(r));

// The cloud lives in another process in the app, so the stand-in costs nothing here: it accepts every operation and has nothing to pull.
const acceptingCloud: Transport = {
  push: async (r) => ({ serverTime: new Date().toISOString(), nextPullSeq: 0, results: r.operations.map((o) => ({ operationId: o.operationId, status: 'applied' as const })) }),
  pull: async () => ({ changes: [], nextSeq: 0, hasMore: false, serverTime: new Date().toISOString() }),
  bootstrap: async () => { throw new Error('not used'); },
  snapshot: async () => { throw new Error('not used'); },
};

beforeAll(async () => {
  ({ app, db } = await testApp({ file: true, server: deviceServer(DEVICE_A), syncTransport: () => acceptingCloud }));
  const { businessId } = await ownerAtTill(app);
  pcs = findUomByCode(db, businessId, 'PCS')!.id;
  const actor = { userId: app.session.require().user.id, deviceId: app.device.localDeviceId() };
  products = [];
  withTransaction(db, () => {
    for (let i = 0; i < SKUS; i++) {
      products.push(createProduct(db, businessId, ProductInput.parse({ name: `Item ${i}`, sku: `S${i}`, baseUomId: pcs, gstRateBp: 1800, sellingPricePaise: 1000 + i }), actor,
        new Date().toLocaleDateString('en-CA')).id);
    }
  });
  app.register.open(0);
}, 120_000);

// One round: SALES sales, yielding between them so a running engine can claim, push and settle in the gaps, as it would between bills.
async function round(seed: number, nudge: boolean): Promise<number> {
  const samples: number[] = [];
  for (let s = 0; s < SALES; s++) {
    const lines = Array.from({ length: LINES }, (_, i) => ({ productId: products[(seed * 7919 + s * LINES + i * 37) % SKUS]!, uomId: pcs, qtyMilli: 1000 }));
    const total = app.sales.quote(SaleDraft.parse({ lines })).totals.totalPaise;
    const input = CompleteSaleInput.parse({ lines, commandId: newUlid(), expectedTotalPaise: total, tenders: [{ method: 'cash', amountPaise: total }] });
    const t0 = performance.now();
    app.sales.complete(input);
    samples.push(performance.now() - t0);
    if (nudge) app.sync.nudge();
    await tick();
  }
  return p95(samples);
}

// 7d: the sync engine in main never holds billing up; sales.complete's p95 with it pushing is within noise of it idle.
describe('sales.complete with the sync engine running (7d)', () => {
  it(`median p95 over ${ROUNDS} rounds of ${SALES} sales is unaffected by pushing in the gaps`, async () => {
    const idle: number[] = [];
    for (let r = 0; r < ROUNDS; r++) idle.push(await round(r, false));
    app.sync.start();
    const busy: number[] = [];
    for (let r = 0; r < ROUNDS; r++) busy.push(await round(ROUNDS + r, true));
    await app.sync.idle();
    app.sync.stop();
    console.info(`sales.complete p95 idle ${median(idle).toFixed(2)} ms, syncing ${median(busy).toFixed(2)} ms`);
    expect(db.prepare("SELECT COUNT(*) FROM sync_outbox WHERE entity_type = 'sale' AND status = 'sent'").pluck().get()).toBeGreaterThan(0);
    expect(median(busy)).toBeLessThan(Math.max(median(idle) * 1.5, median(idle) + 5));
    expect(median(busy)).toBeLessThan(250);
  }, 120_000);
});
