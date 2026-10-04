import { describe, expect, it } from 'vitest';
import { CustomerInput, ProductInput, SupplierInput, type Change, type SyncStream } from '@muneem/contracts';
import { applyPullPage, getCursor, type Db } from '@muneem/db-sqlite';
import { caller, ownerAtTill, testApp } from '../helpers.js';
import { DEVICE_A, DEVICE_B, ownerMembership, referenceCloud, syncedDevice, syncUntilQuiet } from './syncHelpers.js';

const GSTIN = '07AAAAA0000A1Z5';
const LOW = '00000000000000000000000001';
const HIGH = '7ZZZZZZZZZZZZZZZZZZZZZZZZZ';
const CLOUD = 'cloud-device-of-this-till';
let seq = 1000;

// Another device's row as the cloud sends it: this device's own create payload under another id.
function twin(db: Db, entityType: string, localId: string, id: string, over: Record<string, unknown> = {}): Change {
  const payload = JSON.parse(db.prepare("SELECT payload_json FROM sync_outbox WHERE entity_type = ? AND entity_id = ? AND operation_type = 'create'").pluck().get(entityType, localId) as string) as Record<string, unknown>;
  return { seq: ++seq, stream: entityType === 'terminal' ? 'config' : 'masters', entityType, entityId: id, op: 'upsert', version: 1, originDeviceId: 'other-device', payload: { ...payload, id, ...over } };
}

function pull(db: Db, businessId: string, stream: SyncStream, changes: Change[]) {
  return applyPullPage(db, { businessId, cloudDeviceId: CLOUD }, stream, { changes, nextSeq: changes.at(-1)!.seq, hasMore: false, serverTime: new Date().toISOString() }, new Date().toISOString());
}

const reviews = (db: Db) => db.prepare("SELECT kind, entity_id AS entityId, rule, winner, field FROM conflict_log WHERE kind = 'unique_clash' ORDER BY entity_id").all();

async function till() {
  const t = await testApp();
  const ids = await ownerAtTill(t.app);
  return { ...t, ...ids };
}

describe('a pulled unique value that clashes never blocks a stream (7f)', () => {
  it('customer GSTIN: the lower id keeps it, whichever side that is, and the other is cleared and listed for review', async () => {
    const { app, db, businessId } = await till();
    const local = app.customers.create(CustomerInput.parse({ name: 'Ravi', gstin: GSTIN, stateCode: '07' }));
    expect(pull(db, businessId, 'masters', [twin(db, 'customer', local.id, HIGH, { name: 'Ravi Traders' })])).toMatchObject({ applied: 1, failed: 0 });
    expect(db.prepare('SELECT id, gstin FROM customer ORDER BY id').all()).toEqual([{ id: local.id, gstin: GSTIN }, { id: HIGH, gstin: null }]);

    expect(pull(db, businessId, 'masters', [twin(db, 'customer', local.id, LOW, { name: 'Ravi & Sons' })])).toMatchObject({ applied: 1, failed: 0 });
    expect(db.prepare('SELECT id, gstin FROM customer ORDER BY id').all()).toEqual([{ id: LOW, gstin: GSTIN }, { id: local.id, gstin: null }, { id: HIGH, gstin: null }]);
    expect(reviews(db)).toEqual([
      { kind: 'unique_clash', entityId: local.id, rule: 'lower_id_keeps', winner: 'cloud', field: 'gstin' },
      { kind: 'unique_clash', entityId: HIGH, rule: 'lower_id_keeps', winner: 'device', field: 'gstin' },
    ]);
    expect(getCursor(db, businessId, 'masters')).toBe(seq);
  });

  it('supplier GSTIN', async () => {
    const { app, db, businessId } = await till();
    const local = app.suppliers.create(SupplierInput.parse({ name: 'Acme', stateCode: '07', gstin: GSTIN }));
    const r = pull(db, businessId, 'masters', [twin(db, 'supplier', local.id, LOW)]);
    expect(r).toMatchObject({ applied: 1, failed: 0 });
    expect(db.prepare('SELECT id, gstin, tax_scheme FROM supplier ORDER BY id').all()).toEqual([{ id: LOW, gstin: GSTIN, tax_scheme: 'regular' }, { id: local.id, gstin: null, tax_scheme: 'unregistered' }]);
    expect(reviews(db)).toEqual([{ kind: 'unique_clash', entityId: local.id, rule: 'lower_id_keeps', winner: 'cloud', field: 'gstin' }]);
  });

  it('product SKU', async () => {
    const { app, db, businessId } = await till();
    const pcs = app.catalog.listUoms().find((u) => u.code === 'PCS')!.id;
    const local = app.products.create(ProductInput.parse({ name: 'Soap', sku: 'SOAP-1', baseUomId: pcs, gstRateBp: 1800, sellingPricePaise: 4500 }));
    expect(pull(db, businessId, 'masters', [twin(db, 'product', local.id, HIGH, { name: 'Soap (other till)' })])).toMatchObject({ applied: 1, failed: 0 });
    expect(db.prepare('SELECT id, sku FROM product ORDER BY id').all()).toEqual([{ id: local.id, sku: 'SOAP-1' }, { id: HIGH, sku: null }]);
    expect(app.products.search({ mode: 'name', query: 'Soap', limit: 10 }).length).toBeGreaterThanOrEqual(2);
  });

  it('terminal invoice prefix and code: the loser gets the next free variant, so its bills keep a unique series', async () => {
    const { db, businessId, terminalId } = await till();
    const mine = db.prepare('SELECT code, invoice_prefix AS prefix FROM terminal WHERE id = ?').get(terminalId) as { code: string; prefix: string };
    expect(pull(db, businessId, 'config', [twin(db, 'terminal', terminalId, LOW, { deviceId: 'other-device' })])).toMatchObject({ applied: 1, failed: 0 });
    const rows = db.prepare('SELECT id, code, invoice_prefix AS prefix FROM terminal ORDER BY id').all() as { id: string; code: string; prefix: string }[];
    expect(rows[0]).toEqual({ id: LOW, code: mine.code, prefix: mine.prefix });
    expect(rows[1]!.id).toBe(terminalId);
    expect(rows[1]!.prefix).not.toBe(mine.prefix);
    expect(rows[1]!.code).not.toBe(mine.code);
    expect(rows[1]!.prefix.startsWith(mine.prefix.slice(0, 3))).toBe(true);
    expect(reviews(db).map((r) => (r as { field: string }).field).sort()).toEqual(['code', 'invoice_prefix']);
  });

  it('a change that still cannot be applied is listed for review and skipped; the rest of the page and the cursor go on', async () => {
    const { app, db, businessId } = await till();
    const local = app.customers.create(CustomerInput.parse({ name: 'Ravi' }));
    const broken: Change = { seq: ++seq, stream: 'documents', entityType: 'sale', entityId: HIGH, op: 'upsert', version: 1, originDeviceId: 'other-device', payload: { id: HIGH } };
    const fine = { ...twin(db, 'customer', local.id, LOW, { name: 'Meena' }), stream: 'documents' as const };
    expect(pull(db, businessId, 'documents', [broken, fine])).toMatchObject({ applied: 1, failed: 1 });
    expect(getCursor(db, businessId, 'documents')).toBe(fine.seq);
    expect(db.prepare('SELECT COUNT(*) FROM sale').pluck().get()).toBe(0);
    expect(db.prepare("SELECT kind, entity_type, entity_id FROM conflict_log WHERE kind = 'apply_failed'").all()).toEqual([{ kind: 'apply_failed', entity_type: 'sale', entity_id: HIGH }]);
    expect(pull(db, businessId, 'documents', [{ ...broken, seq: ++seq }])).toMatchObject({ failed: 1 });
    expect(db.prepare("SELECT COUNT(*) FROM conflict_log WHERE kind = 'apply_failed'").pluck().get()).toBe(1);
  });

  it('two tills that gave one GSTIN to two customers offline settle on the same winner, and both keep syncing', async () => {
    const cloud = referenceCloud();
    const a = await syncedDevice(cloud, DEVICE_A);
    const { businessId } = await ownerAtTill(a.app);
    await syncUntilQuiet(a.app);
    const b = await syncedDevice(cloud, DEVICE_B, () => [ownerMembership(businessId)]);
    await caller(b.app).data('auth.login', { identifier: '9999999999', password: 'correct-horse' });
    await syncUntilQuiet(b.app);

    const first = a.app.customers.create(CustomerInput.parse({ name: 'Ravi', gstin: GSTIN, stateCode: '07' }));
    const second = b.app.customers.create(CustomerInput.parse({ name: 'Ravi Traders', gstin: GSTIN, stateCode: '07' }));
    await syncUntilQuiet(a.app);
    await syncUntilQuiet(b.app);
    await syncUntilQuiet(a.app);
    const parties = (db: Db) => db.prepare('SELECT id, name, gstin FROM customer ORDER BY id').all();
    expect(parties(a.db)).toEqual(parties(b.db));
    expect(parties(a.db)).toEqual([{ id: first.id, name: 'Ravi', gstin: GSTIN }, { id: second.id, name: 'Ravi Traders', gstin: null }]);
    expect(reviews(a.db)).toEqual([{ kind: 'unique_clash', entityId: second.id, rule: 'lower_id_keeps', winner: 'device', field: 'gstin' }]);
    expect(reviews(b.db)).toEqual([{ kind: 'unique_clash', entityId: second.id, rule: 'lower_id_keeps', winner: 'cloud', field: 'gstin' }]);
    expect(a.db.prepare("SELECT COUNT(*) FROM sync_outbox WHERE status <> 'sent'").pluck().get()).toBe(0);
    expect(b.db.prepare("SELECT COUNT(*) FROM sync_outbox WHERE status <> 'sent'").pluck().get()).toBe(0);
  });
});
