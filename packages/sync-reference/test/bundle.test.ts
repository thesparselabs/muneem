import { gunzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { BundleHeader, Change, STREAM_ORDER, type PushOperation } from '@muneem/contracts';
import { ReferenceServer, payloadHash } from '../src/index.js';

const ORG = '01J00000000000000000000B01';
const BIZ = '01J00000000000000000000D01';
let n = 0;
const ulid = () => `01J0000000000000000000${String(++n).padStart(4, '0')}`;

function op(entityType: string, entityId: string, payload: Record<string, unknown>, operationType: PushOperation['operationType'] = 'create'): PushOperation {
  return { operationId: ulid(), seq: ++n, entityType, entityId, operationType, dependsOn: null, payloadHash: payloadHash(payload), payload };
}
const push = (operations: PushOperation[]) => ({ businessId: BIZ, protocol: 1, schemaVersion: 14, clientTime: '2026-10-04T10:00:00.000Z', operations });

// The state a device ends with: the highest version of each entity, and every version of every document.
function replay(changes: readonly Change[]) {
  const latest = new Map<string, Change>();
  const documents: string[] = [];
  for (const c of changes) {
    const key = `${c.entityType}:${c.entityId}`;
    if ((latest.get(key)?.version ?? 0) < c.version) latest.set(key, c);
    if (c.stream === 'documents') documents.push(`${key}@${c.version}`);
  }
  return { latest: Object.fromEntries([...latest].sort(([a], [b]) => a.localeCompare(b))), documents };
}

async function busyServer(): Promise<ReferenceServer> {
  const s = new ReferenceServer();
  s.addMember('user', ORG);
  s.registerDevice('A', 'user');
  s.registerDevice('B', 'user');
  const [product, barcode, customer, terminal, session, period] = [ulid(), ulid(), ulid(), ulid(), ulid(), ulid()];
  await s.push('A', push([
    op('business', BIZ, { id: BIZ, organizationId: ORG, name: 'Shop' }), op('terminal', terminal, { id: terminal, code: 'T01' }),
    op('product', product, { id: product, name: 'Soap', version: 1 }), op('barcode', barcode, { id: barcode, productId: product, code: '890' }),
    op('customer', customer, { id: customer, name: 'Ravi' }),
    op('pos_session', session, { id: session, terminalId: terminal, sessionNo: 1, openedAt: '2026-10-04T09:00:00.000Z', openingCashPaise: 100, status: 'open' }),
  ]));
  await s.push('B', push([op('product', product, { id: product, name: 'Soap Bar', version: 2 }, 'update'), op('barcode', barcode, { id: barcode, productId: product }, 'void')]));
  await s.push('A', push([
    op('pos_session', session, { sessionId: session, closedAt: '2026-10-04T20:00:00.000Z', countedCashPaise: 100, expectedCashPaise: 100, variancePaise: 0 }, 'update'),
    op('accounting_period', period, { id: period, periodStart: '2026-09-01', periodEnd: '2026-09-30', status: 'locked' }, 'update'),
  ]));
  s.revokeDevice('B');
  return s;
}

describe('hydration bundles (7f)', () => {
  it('a bundle replays to the same state as pulling every stream from the start', async () => {
    const s = await busyServer();
    const pulled: Change[] = [];
    for (const stream of STREAM_ORDER) pulled.push(...(await s.pull('A', { businessId: BIZ, stream, since: 0, limit: 500 })).changes);

    const started = await s.bootstrap('A', { businessId: BIZ });
    expect(started.status).toBe('building');
    const ready = await s.snapshot('A', started.snapshotId);
    expect(ready).toMatchObject({ status: 'ready', bytes: expect.any(Number), asOfSeq: Math.max(...pulled.map((c) => c.seq)) });
    const object = s.bundleObject(ready.url!);
    expect(object).toMatchObject({ status: 200, total: ready.bytes });
    const [first, ...rest] = gunzipSync(object.body).toString('utf8').trim().split('\n').map((l) => JSON.parse(l) as unknown);
    const header = BundleHeader.parse(first);
    const lines = rest.map((l) => Change.parse(l));

    expect(header.counts).toEqual(Object.fromEntries(STREAM_ORDER.map((st) => [st, lines.filter((c) => c.stream === st).length])));
    expect(lines.map((c) => c.stream)).toEqual([...lines.map((c) => c.stream)].sort((a, b) => STREAM_ORDER.indexOf(a) - STREAM_ORDER.indexOf(b)));
    expect(replay(lines)).toEqual(replay(pulled));
    expect(replay(lines).documents.filter((d) => d.startsWith('pos_session'))).toHaveLength(2);
    expect(lines.find((c) => c.entityType === 'barcode')).toMatchObject({ op: 'delete' });
    expect(lines.filter((c) => c.stream === 'control').map((c) => c.entityType)).toEqual(['accounting_period', 'device']);
  });

  it('serves byte ranges and refuses an unknown bundle or another device', async () => {
    const s = await busyServer();
    const { snapshotId } = await s.bootstrap('A', { businessId: BIZ });
    const { url, bytes } = await s.snapshot('A', snapshotId);
    const whole = s.bundleObject(url!).body;
    expect(s.bundleObject(url!, 10)).toMatchObject({ status: 206, body: whole.subarray(10) });
    expect(s.bundleObject(url!, bytes!).status).toBe(416);
    expect(s.bundleObject(`${url!}x`).status).toBe(404);
    await expect(s.snapshot('B', snapshotId)).rejects.toMatchObject({ status: 401 });
    await expect(s.bootstrap('A', { businessId: '01J00000000000000000000D02' })).rejects.toMatchObject({ status: 404 });
  });
});
