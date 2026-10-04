import { describe, expect, it } from 'vitest';
import type { PushOperation } from '@muneem/contracts';
import { FaultInjector, NetworkError, ReferenceServer, ServerError, payloadHash } from '../src/index.js';

const ORG = '01J00000000000000000000B01';
const BIZ = '01J00000000000000000000D01';
let n = 0;
const ulid = () => `01J0000000000000000000${String(++n).padStart(4, '0')}`.replace(/[ILOU]/g, '0');

function op(entityType: string, entityId: string, payload: Record<string, unknown>, operationType: PushOperation['operationType'] = 'create', dependsOn: string | null = null): PushOperation {
  return { operationId: ulid(), seq: ++n, entityType, entityId, operationType, dependsOn, payloadHash: payloadHash(payload), payload };
}
const push = (operations: PushOperation[]) => ({ businessId: BIZ, protocol: 1, schemaVersion: 14, clientTime: '2026-10-04T10:00:00.000Z', operations });

function server() {
  const s = new ReferenceServer();
  s.addMember('user', ORG);
  s.registerDevice('A', 'user');
  s.registerDevice('B', 'user');
  return s;
}
const business = () => op('business', BIZ, { id: BIZ, organizationId: ORG, name: 'Shop' });

describe('reference server', () => {
  it('a tombstone wins over a concurrent update, and the sender gets the delete back', async () => {
    const s = server();
    const barcode = ulid();
    const product = ulid();
    await s.push('A', push([business(), op('product', product, { id: product, name: 'Soap' }), op('barcode', barcode, { id: barcode, productId: product, code: '111' })]));
    await s.push('A', push([op('barcode', barcode, { productId: product, id: barcode }, 'void')]));
    const r = await s.push('B', push([op('barcode', barcode, { id: barcode, productId: product, code: '112' }, 'update')]));
    expect(r.results[0]!.status).toBe('applied');
    const page = await s.pull('B', { businessId: BIZ, stream: 'masters', since: 0, limit: 500 });
    expect(page.changes.at(-1)).toMatchObject({ entityId: barcode, op: 'delete', originDeviceId: null });
    expect(s.conflicts(BIZ).map((c) => c.kind)).toEqual(['tombstone']);
  });

  it('the same barcode on two products from two devices keeps both and adds a review item', async () => {
    const s = server();
    const [p1, p2, b1, b2] = [ulid(), ulid(), ulid(), ulid()];
    await s.push('A', push([business(), op('product', p1, { id: p1, name: 'One' }), op('barcode', b1, { id: b1, productId: p1, code: '890' })]));
    await s.push('B', push([op('product', p2, { id: p2, name: 'Two' }), op('barcode', b2, { id: b2, productId: p2, code: '890' })]));
    expect(s.entity(BIZ, 'barcode', b1)?.deletedAt).toBeNull();
    expect(s.entity(BIZ, 'barcode', b2)?.deletedAt).toBeNull();
    const control = await s.pull('A', { businessId: BIZ, stream: 'control', since: 0, limit: 500 });
    expect(control.changes.map((c) => [c.entityType, c.payload.kind])).toEqual([['conflict_log', 'duplicate_barcode']]);
  });

  it('a document dated into a month locked on the cloud is stored and listed as a late arrival', async () => {
    const s = server();
    const period = ulid();
    const journal = ulid();
    await s.push('A', push([business(), op('accounting_period', period, { id: period, periodStart: '2026-09-01', periodEnd: '2026-09-30', status: 'locked' }, 'update')]));
    const lines = [{ account: { code: '1100' }, debitPaise: 100, creditPaise: 0 }, { account: { code: '3200' }, debitPaise: 0, creditPaise: 100 }];
    const r = await s.push('B', push([op('journal_entry', journal, {
      id: journal, entryNo: 'J1', entryDate: '2026-09-12', periodId: period, lines, source: 'manual', refType: 'manual', refId: journal, docDate: '2026-09-12',
      narration: null, branchId: null, terminalId: null, latePosting: false, reversalOf: null,
    })]));
    expect(r.results[0]!.status).toBe('applied');
    expect(s.conflicts(BIZ).map((c) => [c.kind, c.entityId])).toEqual([['late_arrival', journal]]);
  });

  it('a revoked device is refused and the others hear of it on the control stream', async () => {
    const s = server();
    await s.push('A', push([business()]));
    s.revokeDevice('B');
    await expect(s.pull('B', { businessId: BIZ, stream: 'control', since: 0, limit: 10 })).rejects.toMatchObject({ status: 401, code: 'DEVICE_REVOKED' });
    const control = await s.pull('A', { businessId: BIZ, stream: 'control', since: 0, limit: 10 });
    expect(control.changes[0]).toMatchObject({ entityType: 'device', entityId: 'B', payload: { status: 'revoked' } });
  });

  it('an operation id reused with another payload is rejected', async () => {
    const s = server();
    const first = business();
    await s.push('A', push([first]));
    const again = { ...first, payload: { ...first.payload, name: 'Other' } };
    again.payloadHash = payloadHash(again.payload);
    expect((await s.push('A', push([again]))).results[0]).toMatchObject({ status: 'rejected', error: { code: 'PAYLOAD_INVALID' } });
  });
});

describe('fault injector', () => {
  const run = async (seed: number) => {
    const inner = server();
    const f = new FaultInjector(inner, { seed, drop: 0.2, dropResponse: 0.2, duplicate: 0.2, error500: 0.1 }, async () => undefined);
    const outcomes: string[] = [];
    for (let i = 0; i < 30; i++) {
      try {
        await f.pull('A', { businessId: BIZ, stream: 'masters', since: 0, limit: 10 });
        outcomes.push('ok');
      } catch (e) {
        outcomes.push(e instanceof NetworkError ? 'net' : e instanceof ServerError ? String(e.status) : 'other');
      }
    }
    return { outcomes, events: f.events.map((e) => e.fault) };
  };

  it('is deterministic per seed and injects every configured fault', async () => {
    const a = await run(7);
    expect(await run(7)).toEqual(a);
    expect(new Set(a.events)).toEqual(new Set(['drop', 'drop_response', 'duplicate', 'error500', 'delivered']));
    expect((await run(8)).outcomes).not.toEqual(a.outcomes);
  });

  it('partitions until healed and skews the server clock', async () => {
    const f = new FaultInjector(server(), { seed: 1, clockSkewMs: 3_600_000 }, async () => undefined);
    f.partition(true);
    await expect(f.pull('A', { businessId: BIZ, stream: 'masters', since: 0, limit: 1 })).rejects.toBeInstanceOf(NetworkError);
    f.partition(false);
    const page = await f.pull('A', { businessId: BIZ, stream: 'masters', since: 0, limit: 1 });
    expect(Date.parse(page.serverTime) - Date.now()).toBeGreaterThan(3_000_000);
  });
});
