import { beforeAll, describe, expect, it } from 'vitest';
import { CreatePurchaseInput, PaymentInput, ProductInput, SupplierInput } from '@muneem/contracts';
import { newUlid } from '@muneem/domain';
import { createProduct, createSupplier, findUomByCode, reconcilePartiesDb, withTransaction, type Db } from '@muneem/db-sqlite';
import type { App } from '../../src/main/app.js';
import { ownerAtTill, testApp } from '../helpers.js';

const p95 = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length * 0.95)]!;

let app: App;
let db: Db;
let businessId: string;
let pcs: string;
let products: string[];
let actor: { userId: string; deviceId: string };

beforeAll(async () => {
  ({ app, db } = await testApp({ file: true }));
  ({ businessId } = await ownerAtTill(app));
  pcs = findUomByCode(db, businessId, 'PCS')!.id;
  actor = { userId: app.session.require().user.id, deviceId: app.device.localDeviceId() };
  const today = new Date().toLocaleDateString('en-CA');
  products = withTransaction(db, () => Array.from({ length: 400 }, (_, i) => createProduct(db, businessId, ProductInput.parse({
    name: `Item ${i}`, baseUomId: pcs, gstRateBp: [0, 500, 1200, 1800][i % 4], sellingPricePaise: 1000 + i,
  }), actor, today).id));
}, 120_000);

// The budgets are the p95s and totals below; the test timeout only stops a busy CI machine from failing the run.
describe('parties and purchases at shop scale (5g)', () => {
  it('purchases.create with 200 lines: p95 over 20 bills under 1 s', () => {
    const supplier = createSupplier(db, businessId, SupplierInput.parse({ name: 'Bulk Co', stateCode: '07', gstin: '07BBBBB0000B1Z5' }), actor);
    const samples: number[] = [];
    for (let b = 0; b < 20; b++) {
      const lines = Array.from({ length: 200 }, (_, i) => ({ productId: products[(b * 7 + i) % products.length]!, uomId: pcs, qtyMilli: 1000 + i, unitPricePaise: 500 + i }));
      const draft = { supplierId: supplier.id, supplierInvoiceNo: `B-${b}`, supplierInvoiceDate: '2026-09-01', lines, charges: [{ kind: 'freight' as const, amountPaise: 5000 }] };
      const total = app.purchases.quote(CreatePurchaseInput.omit({ commandId: true, billTotalPaise: true }).parse(draft)).totals.computedTotalPaise;
      const input = CreatePurchaseInput.parse({ ...draft, billTotalPaise: total, commandId: newUlid() });
      const t0 = performance.now();
      app.purchases.create(input);
      samples.push(performance.now() - t0);
    }
    console.info(`purchases.create (200 lines) p95 = ${p95(samples).toFixed(1)} ms`);
    expect(p95(samples)).toBeLessThan(1000);
  }, 120_000);

  it('payments.create settling 500 open bills at once: worst of 5 under 250 ms', () => {
    const samples: number[] = [];
    for (let r = 0; r < 5; r++) {
      const supplier = createSupplier(db, businessId, SupplierInput.parse({ name: `Wholesaler ${r}`, stateCode: '07', taxScheme: 'unregistered' }), actor);
      for (let b = 0; b < 500; b++) {
        app.purchases.create(CreatePurchaseInput.parse({
          supplierId: supplier.id, supplierInvoiceNo: `W${r}-${b}`, supplierInvoiceDate: '2026-09-01', billTotalPaise: 1000, commandId: newUlid(),
          lines: [{ productId: products[b % products.length]!, uomId: pcs, qtyMilli: 1000, unitPricePaise: 1000 }],
        }));
      }
      const input = PaymentInput.parse({ partyType: 'supplier', partyId: supplier.id, amountPaise: 500 * 1000, method: 'bank', commandId: newUlid() });
      const t0 = performance.now();
      const paid = app.payments.create(input);
      samples.push(performance.now() - t0);
      expect(paid.allocations).toHaveLength(500);
    }
    console.info(`payments.create over 500 bills: worst = ${Math.max(...samples).toFixed(1)} ms`);
    expect(Math.max(...samples)).toBeLessThan(250);
  }, 300_000);

  it('reconcilePartiesDb over 10,000 documents: under 2 s', () => {
    withTransaction(db, () => {
      for (let i = 0; i < 10_000; i++) {
        const id = newUlid();
        const party = newUlid();
        db.prepare(`INSERT INTO party_opening (id, business_id, party_type, party_id, side, amount_paise, as_of_date, created_at, updated_at, created_by, device_id)
          VALUES (?, ?, 'customer', ?, 'receivable', 1000, '2026-04-01', 'a', 'a', 'u', 'd')`).run(id, businessId, party);
        db.prepare(`INSERT INTO party_ledger_entry (id, business_id, party_type, party_id, ref_type, ref_id, entry_kind, amount_paise, doc_date, occurred_at,
            created_at, updated_at, created_by, device_id) VALUES (?, ?, 'customer', ?, 'opening', ?, 'post', 1000, '2026-04-01', 'a', 'a', 'a', 'u', 'd')`)
          .run(newUlid(), businessId, party, id);
      }
    });
    const t0 = performance.now();
    const r = reconcilePartiesDb(db, businessId);
    const ms = performance.now() - t0;
    const docs = db.prepare('SELECT (SELECT COUNT(*) FROM purchase) + (SELECT COUNT(*) FROM party_opening) + (SELECT COUNT(*) FROM payment)').pluck().get() as number;
    console.info(`reconcilePartiesDb over ${docs} documents = ${ms.toFixed(0)} ms`);
    expect(docs).toBeGreaterThanOrEqual(10_000);
    expect(r).toEqual({ mismatches: [], faults: [] });
    expect(ms).toBeLessThan(2000);
  }, 120_000);
});
