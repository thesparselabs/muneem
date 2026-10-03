// Child for the kill -9 suite: sets the till up once, then completes sales until it is killed.
import { CompleteSaleInput, CustomerInput, ProductInput, SaleDraft } from '@muneem/contracts';
import { newUlid } from '@muneem/domain';
import { createCustomer, createProduct, findUomByCode, getMeta, setCustomerCreditLimit, setMeta, withTransaction } from '@muneem/db-sqlite';
import { caller, ownerAtTill, testApp } from '../helpers.js';

const file = process.argv[2]!;
const { app, db } = await testApp({ dbFile: file });
const READY = 'crash.products';

if (!getMeta(db, READY)) {
  const { businessId } = await ownerAtTill(app);
  const pcs = findUomByCode(db, businessId, 'PCS')!.id;
  const actor = { userId: app.session.require().user.id, deviceId: app.device.localDeviceId() };
  const ids = withTransaction(db, () => Array.from({ length: 40 }, (_, i) => createProduct(db, businessId, ProductInput.parse({
    name: `Item ${i}`, baseUomId: pcs, gstRateBp: [0, 500, 1200, 1800][i % 4], sellingPricePaise: 999 + i * 37,
  }), actor, new Date().toLocaleDateString('en-CA')).id));
  // No printer: jobs still go through the queue's status updates (and fail fast) without writing thousands of files.
  await caller(app).data('printer.setConfig', { kind: 'none' });
  const customer = createCustomer(db, businessId, CustomerInput.parse({ name: 'Credit customer', creditDays: 30 }), actor);
  const customerId = setCustomerCreditLimit(db, customer.id, customer.version, 1_000_000_000_00, actor).id;
  setMeta(db, READY, JSON.stringify({ pcs, ids, customerId }));
  app.register.open(0);
} else {
  await caller(app).data('auth.login', { identifier: '9999999999', password: 'correct-horse' });
}

const { pcs, ids, customerId } = JSON.parse(getMeta(db, READY)!) as { pcs: string; ids: string[]; customerId: string };
process.stdout.write('ready\n');
for (let n = 0; ; n++) {
  const lines = Array.from({ length: 1 + (n % 6) }, (_, i) => ({ productId: ids[(n * 7 + i * 3) % ids.length]!, uomId: pcs, qtyMilli: 1000 * (1 + (i % 3)) }));
  // Every fourth sale is partly on credit, so kills also land in the ledger step (ADR-0026).
  const credit = n % 4 === 1;
  const draft = { lines, ...(credit && { customerId }) };
  const total = app.sales.quote(SaleDraft.parse(draft)).totals.totalPaise;
  const half = Math.floor(total / 2);
  const tenders = credit ? [{ method: 'cash', amountPaise: total - half }, { method: 'credit', amountPaise: half }]
    : n % 3 === 0 ? [{ method: 'upi', amountPaise: total }] : [{ method: 'cash', amountPaise: total + (n % 5) * 100 }];
  app.sales.complete(CompleteSaleInput.parse({ ...draft, commandId: newUlid(), expectedTotalPaise: total, tenders }));
  await new Promise((r) => setImmediate(r)); // like a real till: the print queue runs between sales, so kills land there too
}
