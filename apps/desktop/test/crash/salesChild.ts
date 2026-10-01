// Child for the kill -9 suite: sets the till up once, then completes sales until it is killed.
import { CompleteSaleInput, ProductInput, SaleDraft } from '@muneem/contracts';
import { newUlid } from '@muneem/domain';
import { createProduct, findUomByCode, getMeta, setMeta, withTransaction } from '@muneem/db-sqlite';
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
  setMeta(db, READY, JSON.stringify({ pcs, ids }));
  app.register.open(0);
} else {
  await caller(app).data('auth.login', { identifier: '9999999999', password: 'correct-horse' });
}

const { pcs, ids } = JSON.parse(getMeta(db, READY)!) as { pcs: string; ids: string[] };
process.stdout.write('ready\n');
for (let n = 0; ; n++) {
  const lines = Array.from({ length: 1 + (n % 6) }, (_, i) => ({ productId: ids[(n * 7 + i * 3) % ids.length]!, uomId: pcs, qtyMilli: 1000 * (1 + (i % 3)) }));
  const total = app.sales.quote(SaleDraft.parse({ lines })).totals.totalPaise;
  const tenders = n % 3 === 0 ? [{ method: 'upi', amountPaise: total }] : [{ method: 'cash', amountPaise: total + (n % 5) * 100 }];
  app.sales.complete(CompleteSaleInput.parse({ lines, commandId: newUlid(), expectedTotalPaise: total, tenders }));
  await new Promise((r) => setImmediate(r)); // like a real till: the print queue runs between sales, so kills land there too
}
