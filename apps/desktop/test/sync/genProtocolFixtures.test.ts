import { mkdirSync, writeFileSync } from 'node:fs';
import { describe, it } from 'vitest';
import { createHash } from 'node:crypto';
import { newUlid } from '@muneem/domain';
import { canonicalJson, computeAuditHash, type AuditRow } from '@muneem/db-sqlite';
import { CompleteSaleInput, PaymentInput, SaleDraft, type PushOperation } from '@muneem/contracts';
import { ORG_ID, USER_ID, caller, ownerAtTill, testApp } from '../helpers.js';

// Regenerates packages/contracts/fixtures/sync from a real flow: MUNEEM_GEN_SYNC_FIXTURES=1 vitest run test/sync/genProtocolFixtures.test.ts
const OUT = new URL('../../../../packages/contracts/fixtures/sync/', import.meta.url);
const run = process.env.MUNEEM_GEN_SYNC_FIXTURES === '1' ? it : it.skip;
const hash = (payload: unknown) => `sha256:${createHash('sha256').update(canonicalJson(payload)).digest('hex')}`;
const CLIENT_TIME = '2026-10-04T10:00:00.000Z';

describe('sync protocol fixtures', () => {
  run('records a real flow and writes the request/response pairs both servers must pass', async () => {
    const { app, db } = await testApp();
    const api = caller(app);
    const { businessId } = await ownerAtTill(app);
    const pcs = (await api.data<{ id: string; code: string }[]>('catalog.listUoms')).find((u) => u.code === 'PCS')!.id;
    const soap = await api.data<{ id: string }>('products.create', { name: 'Soap', baseUomId: pcs, gstRateBp: 1800, sellingPricePaise: 11_800, priceIsInclusive: true });
    let ravi = app.customers.create({ name: 'Ravi' });
    ravi = app.customers.setCreditLimit({ id: ravi.id, version: ravi.version, limitPaise: 1_000_000 });
    await app.register.open(10_000);
    const draft = SaleDraft.parse({ lines: [{ productId: soap.id, uomId: pcs, qtyMilli: 2000 }], customerId: ravi.id });
    app.sales.complete(CompleteSaleInput.parse({ ...draft, commandId: newUlid(), expectedTotalPaise: 23_600, tenders: [{ method: 'credit', amountPaise: 23_600 }] }));
    const receipt = app.payments.create(PaymentInput.parse({ partyType: 'customer', partyId: ravi.id, amountPaise: 10_000, method: 'cash', commandId: newUlid() }));
    const outbox = (sql: string) => (db.prepare(sql).all(businessId) as Record<string, unknown>[]).map(toOperation);
    const ops = outbox("SELECT * FROM sync_outbox WHERE business_id = ? AND entity_type <> 'audit_entry' ORDER BY seq");
    app.payments.cancel(receipt.id, 'bounced');
    const cancelOps = outbox("SELECT * FROM sync_outbox WHERE business_id = ? AND entity_type <> 'audit_entry' ORDER BY seq").filter((o) => o.seq > ops.at(-1)!.seq);
    const push = (operations: PushOperation[]) => ({ businessId, protocol: 1, schemaVersion: 14, clientTime: CLIENT_TIME, operations });
    const applied = (o: PushOperation[]) => ({ results: o.map((x) => ({ operationId: x.operationId, status: 'applied' })) });
    const sale = ops.find((o) => o.entityType === 'sale')!;
    const payment = ops.find((o) => o.entityType === 'payment')!;
    const product = ops.find((o) => o.entityType === 'product')!;
    const beforeSale = ops.filter((o) => o.seq < sale.seq);
    const setup = { organizationId: ORG_ID, userId: USER_ID, devices: ['A', 'B'] };

    const tampered = structuredClone(sale);
    tampered.operationId = newUlid();
    (tampered.payload.totals as { totalPaise: number }).totalPaise += 100;
    tampered.payloadHash = hash(tampered.payload);
    const priceEdit = (device: string, pricePaise: number, version: number): PushOperation => {
      const payload = { ...product.payload, sellingPricePaise: pricePaise, version, updatedAt: device === 'A' ? '2026-10-04T10:01:00.000Z' : '2026-10-04T10:02:00.000Z' };
      return { ...product, operationId: newUlid(), seq: product.seq + 1000, operationType: 'update', dependsOn: product.operationId, payload, payloadHash: hash(payload) };
    };
    const nameEdit = (): PushOperation => {
      const payload = { ...product.payload, name: 'Soap Bar', version: 2, updatedAt: '2026-10-04T10:03:00.000Z' };
      return { ...product, operationId: newUlid(), seq: product.seq + 1001, operationType: 'update', dependsOn: product.operationId, payload, payloadHash: hash(payload) };
    };
    const prices = ops.find((o) => o.entityType === 'price_list_item')!;
    const priceItems = (device: string, pricePaise: number, retired: string[]): PushOperation => {
      const current = (prices.payload.items as { id: string }[])[0]!;
      const item = { ...current, id: newUlid(), pricePaise };
      const payload = { ...prices.payload, items: [item], retired };
      return { ...prices, operationId: newUlid(), seq: prices.seq + (device === 'A' ? 2000 : 2001), dependsOn: null, payload, payloadHash: hash(payload) };
    };
    const original = (prices.payload.items as { id: string }[]).map((i) => i.id);
    const pricesFromA = priceItems('A', 12_500, original);
    const pricesFromB = priceItems('B', 9_900, original);
    const fromB = priceEdit('B', 9_900, 2);
    const fromA = priceEdit('A', 12_500, 2);
    const nameFromB = nameEdit();

    const fixtures = {
      'push-applied-then-duplicate': {
        description: 'A business created offline, its masters, a credit sale and a receipt all apply in order; the same batch again is all duplicate.',
        setup, steps: [
          { device: 'A', call: 'push', request: push(ops), expect: applied(ops) },
          { device: 'A', call: 'push', request: push(ops), expect: { results: ops.map((x) => ({ operationId: x.operationId, status: 'duplicate' })) } },
        ],
      },
      'push-tampered-total': {
        description: 'A sale whose total no longer matches its lines is rejected for good, and the rest of the batch still applies.',
        setup, steps: [
          { device: 'A', call: 'push', request: push([...beforeSale, tampered]),
            expect: { results: [...applied(beforeSale).results, { operationId: tampered.operationId, status: 'rejected', error: { code: 'TOTAL_MISMATCH', class: 'permanent' } }] } },
        ],
      },
      'push-dependency-missing': {
        description: 'A receipt for a customer the cloud has not seen is deferred, then applies once the customer and sale arrive.',
        setup, steps: [
          { device: 'A', call: 'push', request: push([...ops.filter((o) => o.entityType === 'business'), payment]),
            expect: { results: [{ operationId: ops[0]!.operationId, status: 'applied' }, { operationId: payment.operationId, status: 'deferred', error: { code: 'DEPENDENCY_MISSING', class: 'dependency' } }] } },
          { device: 'A', call: 'push', request: push(ops.filter((o) => o.entityType !== 'business')),
            expect: { results: ops.filter((o) => o.entityType !== 'business').map((x) => ({ operationId: x.operationId, status: 'applied' })) } },
        ],
      },
      'pull-another-devices-changes': {
        description: "Device B pulls A's masters and documents with A as origin; A's own pull returns the same rows for A to skip.",
        setup, steps: [
          { device: 'A', call: 'push', request: push(ops), expect: applied(ops) },
          { device: 'B', call: 'pull', request: { businessId, stream: 'masters', since: 0, limit: 500 },
            expect: { hasMore: false, changes: ops.filter((o) => ['uom', 'product', 'customer', 'customer_credit_limit', 'price_list', 'price_list_item', 'warehouse'].includes(o.entityType))
              .map((o) => ({ entityType: o.entityType, entityId: o.entityId, originDeviceId: 'A' })) } },
          { device: 'B', call: 'pull', request: { businessId, stream: 'documents', since: 0, limit: 500 },
            expect: { hasMore: false, changes: ops.filter((o) => ['pos_session', 'sale', 'payment'].includes(o.entityType))
              .map((o) => ({ entityType: o.entityType, entityId: o.entityId, originDeviceId: 'A' })) } },
        ],
      },
      'price-items-stale-edit-cloud-wins': {
        description: "A replaces the product's prices, then B replaces the prices it last saw: the cloud keeps A's prices, logs the conflict and sends them back to B.",
        setup, steps: [
          { device: 'A', call: 'push', request: push(ops), expect: applied(ops) },
          { device: 'A', call: 'push', request: push([pricesFromA]), expect: applied([pricesFromA]) },
          { device: 'B', call: 'push', request: push([pricesFromB]), expect: applied([pricesFromB]) },
          { device: 'B', call: 'pull', request: { businessId, stream: 'masters', since: 0, limit: 500 },
            expect: { lastChangeFor: { entityType: 'price_list_item', entityId: prices.entityId, originDeviceId: null,
              payload: { items: [{ id: (pricesFromA.payload.items as { id: string }[])[0]!.id, pricePaise: 12_500 }] } } } },
        ],
      },
      'document-cancel-version': {
        description: "A cancels a receipt: the cloud stores the cancel as the document's next version, the create payload with the cancel under `cancel`; B pulls it; the same cancel again is a duplicate.",
        setup, steps: [
          { device: 'A', call: 'push', request: push(ops), expect: applied(ops) },
          { device: 'A', call: 'push', request: push(cancelOps), expect: applied(cancelOps) },
          { device: 'A', call: 'push', request: push(cancelOps), expect: { results: cancelOps.map((x) => ({ operationId: x.operationId, status: 'duplicate' })) } },
          { device: 'B', call: 'pull', request: { businessId, stream: 'documents', since: 0, limit: 500 },
            expect: { lastChangeFor: { entityType: 'payment', entityId: payment.entityId, originDeviceId: 'A',
              payload: { docNumber: payment.payload.docNumber, status: 'posted', cancel: { status: 'cancelled', reason: 'bounced' } } } } },
        ],
      },
      'master-conflict-cloud-wins-price': {
        description: "A changes the price, then B changes it from an older version: the cloud keeps A's price, logs the conflict, keeps B's name edit, and sends the merge back to B.",
        setup, steps: [
          { device: 'A', call: 'push', request: push(ops), expect: applied(ops) },
          { device: 'A', call: 'push', request: push([fromA]), expect: applied([fromA]) },
          { device: 'B', call: 'push', request: push([fromB, nameFromB]), expect: applied([fromB, nameFromB]) },
          { device: 'B', call: 'pull', request: { businessId, stream: 'masters', since: 0, limit: 500 },
            expect: { lastChangeFor: { entityType: 'product', entityId: product.entityId, originDeviceId: null, payload: { sellingPricePaise: 12_500, name: 'Soap Bar' } } } },
        ],
      },
    };
    write(fixtures);
  });

  run('records the audit chain fixture (8g)', async () => {
    const { app, db } = await testApp();
    const { businessId } = await ownerAtTill(app);
    await app.register.open(10_000);
    const outbox = (sql: string) => (db.prepare(sql).all(businessId) as Record<string, unknown>[]).map(toOperation);
    const business = outbox("SELECT * FROM sync_outbox WHERE business_id = ? AND entity_type = 'business' ORDER BY seq").slice(0, 1);
    const [a1, a2, a3, a4, a5] = outbox("SELECT * FROM sync_outbox WHERE business_id = ? AND entity_type = 'audit_entry' ORDER BY seq") as [PushOperation, PushOperation, PushOperation, PushOperation, PushOperation];
    const push = (operations: PushOperation[]) => ({ businessId, protocol: 1, schemaVersion: 14, clientTime: CLIENT_TIME, operations });
    const result = (o: PushOperation, status: string, code?: string) => ({ operationId: o.operationId, status, ...(code && { error: { code, class: code === 'DEPENDENCY_MISSING' ? 'dependency' : 'permanent' } }) });
    const again = (o: PushOperation, payload: Record<string, unknown>): PushOperation => ({ ...o, operationId: newUlid(), payload, payloadHash: hash(payload) });
    const tampered = again(a5, { ...a5.payload, after_json: '{"tampered":true}' });
    const forgedRow = { ...a3.payload, occurred_at: '2026-10-04T09:00:00.000Z' } as unknown as AuditRow;
    const forged = again(a3, { ...forgedRow, hash: computeAuditHash(forgedRow) });
    write({
      'push-audit-chain': {
        description: 'Audit rows apply in seq order; a gap waits, a resend (same or new operation id) is a duplicate, an edited row or a second row at a held seq is AUDIT_CHAIN_BROKEN, and the chain carries on.',
        setup: { organizationId: ORG_ID, userId: USER_ID, devices: ['A', 'B'] }, steps: [
          { device: 'A', call: 'push', request: push([...business, a1, a2]), expect: { results: [...business, a1, a2].map((o) => result(o, 'applied')) } },
          { device: 'A', call: 'push', request: push([a4]), expect: { results: [result(a4, 'deferred', 'DEPENDENCY_MISSING')] } },
          { device: 'A', call: 'push', request: push([a3, a4]), expect: { results: [result(a3, 'applied'), result(a4, 'applied')] } },
          { device: 'A', call: 'push', request: push([a1, a2, again(a2, a2.payload)]), expect: { results: [result(a1, 'duplicate'), result(a2, 'duplicate'), { status: 'duplicate' }] } },
          { device: 'A', call: 'push', request: push([tampered, forged]), expect: { results: [result(tampered, 'rejected', 'AUDIT_CHAIN_BROKEN'), result(forged, 'rejected', 'AUDIT_CHAIN_BROKEN')] } },
          { device: 'A', call: 'push', request: push([a5]), expect: { results: [result(a5, 'applied')] } },
        ],
      },
    });
  });
});

function write(fixtures: Record<string, object>): void {
  mkdirSync(OUT, { recursive: true });
  for (const [name, f] of Object.entries(fixtures)) writeFileSync(new URL(`${name}.json`, OUT), `${JSON.stringify({ name, ...f }, null, 1)}\n`);
}

function toOperation(r: Record<string, unknown>): PushOperation {
  return {
    operationId: r.operation_id as string, seq: r.seq as number, entityType: r.entity_type as string, entityId: r.entity_id as string,
    operationType: r.operation_type as PushOperation['operationType'], dependsOn: (r.depends_on_operation_id as string | null) ?? null,
    payloadHash: r.payload_hash as string, payload: JSON.parse(r.payload_json as string) as Record<string, unknown>,
  };
}
