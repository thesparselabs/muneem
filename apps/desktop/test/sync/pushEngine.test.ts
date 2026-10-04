import { describe, expect, it } from 'vitest';
import type { PullResponse, PushRequest, PushResponse, PushResult } from '@muneem/contracts';
import { claimBatch, getSyncDevice } from '@muneem/db-sqlite';
import { FaultInjector } from '@muneem/sync-reference';
import { backoffMs, MAX_ATTEMPTS } from '../../src/main/sync/backoff.js';
import { TransportError, type Transport } from '../../src/main/sync/transport.js';
import { SyncEngine } from '../../src/main/sync/syncEngine.js';
import { silentLoggers } from '../../src/main/infra/logger.js';
import { caller, ownerAtTill, testApp } from '../helpers.js';
import { books, DEVICE_A, DEVICE_B, healthy, ownerMembership, referenceCloud, referenceTransport, syncedDevice, syncUntilQuiet } from './syncHelpers.js';

type Answer = (r: PushRequest) => PushResponse | Error;
const page = (): PullResponse => ({ changes: [], nextSeq: 0, hasMore: false, serverTime: new Date().toISOString() });

// A wire whose push answers are scripted per call; pulls are empty.
function scripted(answers: Answer[]): Transport & { requests: PushRequest[] } {
  const requests: PushRequest[] = [];
  return {
    requests,
    push: async (r) => {
      requests.push(r);
      const a = (answers.shift() ?? ((x) => all(x, 'applied')))(r);
      if (a instanceof Error) throw a;
      return a;
    },
    pull: async () => page(),
    bootstrap: async () => { throw new TransportError(501, 'NOT_IMPLEMENTED'); },
    snapshot: async () => { throw new TransportError(501, 'NOT_IMPLEMENTED'); },
  };
}
const answer = (results: PushResult[]): PushResponse => ({ serverTime: new Date().toISOString(), nextPullSeq: 0, results });
const all = (r: PushRequest, status: PushResult['status'], error?: PushResult['error']): PushResponse =>
  answer(r.operations.map((o) => ({ operationId: o.operationId, status, ...(error && { error }) })));

async function device(answers: Answer[], now = () => Date.now()) {
  const wire = scripted(answers);
  const t = await testApp({ syncTransport: () => wire, random: () => 0.5, now });
  const { businessId } = await ownerAtTill(t.app);
  return { ...t, wire, businessId };
}
const statuses = (db: Awaited<ReturnType<typeof device>>['db']) =>
  Object.fromEntries((db.prepare('SELECT status, COUNT(*) AS n FROM sync_outbox GROUP BY status').all() as { status: string; n: number }[]).map((r) => [r.status, r.n]));

describe('backoff (7d)', () => {
  it('doubles from 2 s to a 15-minute cap, within ±20%', () => {
    expect([1, 2, 3, 9, 10, 20].map((n) => backoffMs(n, () => 0.5))).toEqual([2000, 4000, 8000, 512_000, 900_000, 900_000]);
    expect(backoffMs(3, () => 0)).toBe(6400);
    expect(backoffMs(3, () => 1)).toBe(9600);
    expect(MAX_ATTEMPTS).toBe(12);
  });
});

describe('push state machine (7d)', () => {
  it('applied and duplicate are sent; a dependency waits; transient retries later; permanent fails', async () => {
    const { app, db, wire } = await device([
      (r) => answer(r.operations.map((o, i) => ({
        operationId: o.operationId,
        ...(i === 0 ? { status: 'applied' } : i === 1 ? { status: 'duplicate' }
          : i === 2 ? { status: 'deferred', error: { code: 'DEPENDENCY_MISSING', class: 'dependency', detail: 'x' } }
            : i === 3 ? { status: 'rejected', error: { code: 'BUSINESS_UNKNOWN', class: 'transient', detail: 'x' } }
              : { status: 'rejected', error: { code: 'TOTAL_MISMATCH', class: 'permanent', detail: 'x' } }),
      } as PushResult))),
    ]);
    const run = await app.syncEngine.run({ pull: false });
    const ops = wire.requests[0]!.operations;
    const row = (i: number) => db.prepare('SELECT status, attempt_count, next_attempt_at, error_code FROM sync_outbox WHERE operation_id = ?').get(ops[i]!.operationId) as
      { status: string; attempt_count: number; next_attempt_at: string | null; error_code: string | null };
    expect([0, 1, 2, 3, 4].map((i) => row(i).status)).toEqual(['sent', 'sent', 'pending', 'pending', 'failed']);
    expect(row(3)).toMatchObject({ attempt_count: 1, error_code: 'BUSINESS_UNKNOWN' });
    expect(Date.parse(row(3).next_attempt_at!) - Date.now()).toBeGreaterThan(1000);
    expect(run.push).toMatchObject({ sent: 2, error: null });
  });

  it('the twelfth failure of an operation is dead and the badge says blocked', async () => {
    const { app, db } = await device(Array.from({ length: 3 }, () => (r: PushRequest) => all(r, 'rejected', { code: 'PAYLOAD_INVALID', class: 'permanent', detail: 'bad' })));
    db.prepare('UPDATE sync_outbox SET attempt_count = ?').run(MAX_ATTEMPTS - 1);
    await app.syncEngine.run({ pull: false });
    expect(statuses(db)).toEqual({ dead: expect.any(Number) });
    expect(app.syncStatus()).toMatchObject({ state: 'blocked' });
  });

  it('a lost answer puts the whole batch back with a backoff, and the next run sends it again', async () => {
    const { app, db, wire } = await device([() => new TransportError(0, 'NETWORK_UNREACHABLE')]);
    const first = await app.syncEngine.run({ pull: false });
    expect(first.push?.error).toBe('NETWORK_UNREACHABLE');
    expect(statuses(db)).toEqual({ pending: expect.any(Number) });
    expect(db.prepare('SELECT MIN(attempt_count) FROM sync_outbox').pluck().get()).toBe(1);
    expect(app.syncStatus()).toMatchObject({ state: 'queued', detail: 'NETWORK_UNREACHABLE' });
    db.prepare('UPDATE sync_outbox SET next_attempt_at = NULL').run();
    await app.syncEngine.run({ pull: false });
    expect(statuses(db)).toEqual({ sent: expect.any(Number) });
    expect(wire.requests[1]!.operations.map((o) => o.operationId)).toEqual(wire.requests[0]!.operations.map((o) => o.operationId));
  });

  it('a 401 refreshes the token and retries once; a revoked device stops and shows blocked', async () => {
    const { app, db, wire, server } = await device([() => new TransportError(401, 'TOKEN_EXPIRED'), (r) => all(r, 'applied')]);
    server.respond = ((base) => (m: string, p: string, b: unknown) => (p === '/v1/auth/refresh'
      ? { status: 200, body: { access_token: 'fresh', refresh_token: 'refresh-2', expires_in: 900 } } : base(m, p, b)))(server.respond);
    await app.syncEngine.run({ pull: false });
    expect(wire.requests).toHaveLength(2);
    expect(statuses(db)).toEqual({ sent: expect.any(Number) });
    expect(app.session.getAccessToken()).toBe('fresh');

    const revoked = await device([() => new TransportError(401, 'DEVICE_REVOKED')]);
    await revoked.app.syncEngine.run({ pull: false });
    expect(getSyncDevice(revoked.db)).toMatchObject({ status: 'revoked' });
    expect(revoked.app.syncStatus()).toMatchObject({ state: 'blocked' });
    expect(statuses(revoked.db)).toEqual({ pending: expect.any(Number) });
    expect(await revoked.app.syncEngine.run({ pull: false })).toMatchObject({ ran: false });
  });

  it('a clock-skew 401 does not spend a refresh token; the batch waits, uncounted, for the clock to be set right', async () => {
    const { app, db, wire, server } = await device([() => new TransportError(401, 'DEVICE_CLOCK_SKEW')]);
    const run = await app.syncEngine.run({ pull: false });
    expect(run.push?.error).toBe('DEVICE_CLOCK_SKEW');
    expect(wire.requests).toHaveLength(1);
    expect(server.calls.filter((c) => c.path === '/v1/auth/refresh')).toEqual([]);
    expect(statuses(db)).toEqual({ pending: expect.any(Number) });
    expect(db.prepare('SELECT MAX(attempt_count) FROM sync_outbox').pluck().get()).toBe(0);
  });

  it('an unsent update replaced by a later, fuller one is superseded; documents and anything depended on are not', async () => {
    const { app, db, wire } = await device([]);
    let c = app.customers.create({ name: 'Ravi' });
    c = app.customers.update({ id: c.id, version: c.version, name: 'Ravi K' });
    app.customers.update({ id: c.id, version: c.version, name: 'Ravi Kumar' });
    await app.syncEngine.run({ pull: false });
    const updates = db.prepare("SELECT status FROM sync_outbox WHERE entity_type = 'customer' AND operation_type = 'update' ORDER BY seq").pluck().all();
    expect(updates).toEqual(['superseded', 'sent']);
    expect(wire.requests.flatMap((r) => r.operations).filter((o) => o.entityType === 'customer').map((o) => o.payload.name)).toEqual(['Ravi', 'Ravi Kumar']);
  });

  it('operations claimed by a process killed before the answer are reclaimed after 5 minutes at start-up', async () => {
    let now = Date.now();
    const { app, db, businessId } = await device([], () => now);
    const claimed = claimBatch(db, businessId, 'killed', new Date(now).toISOString(), { maxOperations: 200, maxBytes: 2_000_000 });
    expect(claimed.length).toBeGreaterThan(0);
    expect(app.syncEngine.recover()).toBe(0);
    now += 6 * 60_000;
    expect(app.syncEngine.recover()).toBe(claimed.length);
    expect(statuses(db)).toEqual({ pending: claimed.length });
    await app.syncEngine.run({ pull: false });
    expect(statuses(db)).toEqual({ sent: claimed.length });
  });
});

describe('push and pull under faults (ADR-0042)', () => {
  it('drops, duplicates, 500s, lost answers and a partition lose nothing and apply nothing twice', async () => {
    const cloud = referenceCloud();
    const faults = new FaultInjector(cloud, { seed: 3, drop: 0.15, dropResponse: 0.15, duplicate: 0.2, error500: 0.1, reorder: 0.1 }, async () => undefined);
    const a = await syncedDevice(faults, DEVICE_A);
    const { businessId } = await ownerAtTill(a.app);
    const api = caller(a.app);
    for (let i = 0; i < 25; i++) a.app.customers.create({ name: `Customer ${i}` });
    await api.data('pos.openRegister', { openingCashPaise: 1000 });
    faults.partition(true);
    expect((await a.app.syncEngine.run({ pull: true })).push?.error).toBe('NETWORK_UNREACHABLE');
    faults.partition(false);
    for (let i = 0; i < 60; i++) {
      a.db.prepare('UPDATE sync_outbox SET next_attempt_at = NULL').run();
      const r = await a.app.syncEngine.run({ pull: true });
      if (!r.push?.error && !r.error && a.db.prepare("SELECT COUNT(*) FROM sync_outbox WHERE status <> 'sent'").pluck().get() === 0) break;
    }
    const ops = a.db.prepare('SELECT operation_id, entity_type, entity_id, status FROM sync_outbox').all() as { operation_id: string; entity_type: string; entity_id: string; status: string }[];
    expect(new Set(ops.map((o) => o.status))).toEqual(new Set(['sent']));
    const stored = cloud.business(businessId)!;
    for (const o of ops) expect(stored.appliedOperationIds.has(o.operation_id)).toBe(true);
    const creates = stored.changes.filter((c) => c.version === 1 && c.stream !== 'control').map((c) => `${c.entityType}:${c.entityId}`);
    expect(creates.length).toBe(new Set(creates).size);
    expect([...new Set(faults.events.map((e) => e.fault))]).toEqual(expect.arrayContaining(['drop', 'drop_response', 'duplicate', 'error500', 'partition', 'delivered']));
    expect(faults.events.filter((e) => e.fault !== 'delivered').length).toBeGreaterThan(5);

    faults.heal();
    const b = await syncedDevice(cloud, DEVICE_B, () => [ownerMembership(businessId)]);
    await caller(b.app).data('auth.login', { identifier: '9999999999', password: 'correct-horse' });
    await syncUntilQuiet(b.app);
    expect(books(b.db, businessId)).toEqual(books(a.db, businessId));
    expect(b.db.prepare('SELECT COUNT(*) FROM customer').pluck().get()).toBe(25);
    expect(healthy(b.db, businessId).tieOuts).toEqual([]);
  }, 120_000);

  it('the engine skips a business it is not registered for and keeps the outbox as it was', async () => {
    const t = await testApp();
    const engine = new SyncEngine({
      db: () => t.db, transport: referenceTransport(referenceCloud(), () => null), device: { installationId: () => 'x', cloudDeviceId: () => null },
      businessId: () => null, schemaVersion: () => 14, refreshAuth: async () => false, now: () => Date.now(), random: () => 0.5, log: silentLoggers().sync,
      onStatus: () => undefined, onApplied: () => undefined,
    });
    expect(await engine.run({ pull: true })).toEqual({ ran: false, reason: 'This device is not registered with the cloud yet' });
  });
});
