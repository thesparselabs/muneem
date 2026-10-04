import { describe, expect, it } from 'vitest';
import type { PullResponse, PushRequest, PushResponse } from '@muneem/contracts';
import { integrityReportKey, setMeta } from '@muneem/db-sqlite';
import { TransportError, type Transport } from '../../src/main/sync/transport.js';
import { ownerAtTill, testApp } from '../helpers.js';

// A wire that applies everything and keeps every push request.
function recording(): Transport & { requests: PushRequest[] } {
  const requests: PushRequest[] = [];
  const applied = (r: PushRequest): PushResponse => ({ serverTime: new Date().toISOString(), nextPullSeq: 0, results: r.operations.map((o) => ({ operationId: o.operationId, status: 'applied' })) });
  const page = (): PullResponse => ({ changes: [], nextSeq: 0, hasMore: false, serverTime: new Date().toISOString() });
  return {
    requests,
    push: async (r) => { requests.push(r); return applied(r); },
    pull: async () => page(),
    bootstrap: async () => { throw new TransportError(501, 'NOT_IMPLEMENTED'); },
    snapshot: async () => { throw new TransportError(501, 'NOT_IMPLEMENTED'); },
  };
}

async function device() {
  const wire = recording();
  const t = await testApp({ syncTransport: () => wire, random: () => 0.5 });
  const { businessId } = await ownerAtTill(t.app);
  return { ...t, wire, businessId };
}

describe('push heartbeat (ADR-0053)', () => {
  it('reports what still waits once the batch lands, leaving the batch itself out', async () => {
    const { app, db, wire } = await device();
    db.prepare("UPDATE sync_outbox SET status = 'dead' WHERE seq = (SELECT MIN(seq) FROM sync_outbox)").run();
    const oldest = db.prepare("SELECT created_at FROM sync_outbox WHERE status = 'dead'").pluck().get() as string;
    await app.syncEngine.run({ pull: false });
    expect(wire.requests[0]!.heartbeat).toEqual({ outboxDepth: 1, oldestPendingAt: oldest, negativeStockCount: 0 });
  });

  it('carries the last integrity report of this business, and leaves a malformed one off', async () => {
    const { app, db, wire, businessId } = await device();
    await app.diagnostics.scheduledChecks();
    await app.syncEngine.run({ pull: false });
    const integrity = wire.requests[0]!.heartbeat!.integrity!;
    expect(integrity).toMatchObject({ tieOutFailures: 0, replayMismatches: 0, auditChainOk: true, documentsSeq: 0 });
    expect(integrity.journalDebitPaise).toBe(integrity.journalCreditPaise);
    expect(integrity.outboxDepth).toBeGreaterThan(0);

    setMeta(db, integrityReportKey(businessId), '{"checkedAt":"not a date"}');
    await app.gateway.handle('settings.set', { key: 'pos.roundToRupee', value: true }, 1);
    await app.syncEngine.run({ pull: false });
    expect(wire.requests.at(-1)!.heartbeat).toBeDefined();
    expect(wire.requests.at(-1)!.heartbeat!.integrity).toBeUndefined();
  });
});
