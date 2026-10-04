import { PUSH_MAX_BYTES, PUSH_MAX_OPERATIONS, STREAM_OF, SYNC_PROTOCOL, type OutboxEntityType, type PushOperation, type PushRequest, type PushResult } from '@muneem/contracts';
import { newUlid } from '@muneem/domain';
import { claimBatch, releaseBatch, settleOperations, supersedeStale, type ClaimedOperation, type Db, type Settlement } from '@muneem/db-sqlite';
import { MAX_ATTEMPTS, nextAttemptAt } from './backoff.js';
import { isTransportError, TransportError, type Transport } from './transport.js';
import { authorized, block, type WireIdentity } from './wire.js';

export interface PusherDeps {
  db: () => Db;
  transport: Transport;
  schemaVersion: () => number;
  refreshAuth: () => Promise<boolean>;
  now: () => number;
  random: () => number;
}

export interface PushOutcome { sent: number; retrying: number; failed: number; dead: number; error: string | null }

// Masters and config can be superseded by a later unsent update; documents never are.
const SUPERSEDABLE = new Set(Object.entries(STREAM_OF).filter(([, s]) => s === 'masters' || s === 'config').map(([t]) => t));

const toWire = (o: ClaimedOperation): PushOperation => ({
  operationId: o.operationId, seq: o.seq, entityType: o.entityType as OutboxEntityType, entityId: o.entityId, operationType: o.operationType,
  dependsOn: o.dependsOn, payloadHash: o.payloadHash, payload: JSON.parse(o.payloadJson) as Record<string, unknown>,
});

// 7d: claim → push → settle, batch after batch, until nothing is due or the wire fails.
export class Pusher {
  constructor(private readonly d: PusherDeps) {}

  async pushAll(id: WireIdentity): Promise<PushOutcome> {
    const outcome: PushOutcome = { sent: 0, retrying: 0, failed: 0, dead: 0, error: null };
    supersedeStale(this.d.db(), id.businessId, SUPERSEDABLE);
    for (;;) {
      const batchId = newUlid();
      const ops = claimBatch(this.d.db(), id.businessId, batchId, this.iso(), { maxOperations: PUSH_MAX_OPERATIONS, maxBytes: PUSH_MAX_BYTES - 64 * 1024 });
      if (ops.length === 0) return outcome;
      let results: PushResult[];
      try {
        const request: PushRequest = { businessId: id.businessId, protocol: SYNC_PROTOCOL, schemaVersion: this.d.schemaVersion(), clientTime: this.iso(), operations: ops.map(toWire) };
        results = (await authorized((t) => t.push(request), this.d.transport, this.d.refreshAuth)).results;
      } catch (e) {
        outcome.error = this.release(batchId, ops, e);
        return outcome;
      }
      const settled = this.settle(ops, results);
      for (const s of settled) outcome[s.outcome === 'sent' ? 'sent' : s.outcome === 'pending' ? 'retrying' : s.outcome] += 1;
      if (!settled.some((s) => s.outcome === 'sent')) return outcome;
    }
  }

  private iso(): string { return new Date(this.d.now()).toISOString(); }

  // The whole batch never got an answer: back to pending, counted unless the device itself has to change first.
  private release(batchId: string, ops: readonly ClaimedOperation[], e: unknown): string {
    const blocked = block(this.d.db(), e);
    const auth = isTransportError(e) && e.status === 401;
    const attempt = Math.max(...ops.map((o) => o.attemptCount)) + 1;
    const code = isTransportError(e) ? e.code : 'SYNC_FAILED';
    releaseBatch(this.d.db(), batchId, {
      nextAttemptAt: blocked || auth ? null : nextAttemptAt(this.d.now(), attempt, this.d.random), code, message: e instanceof Error ? e.message : String(e),
      countAttempt: !blocked && !auth,
    });
    return code;
  }

  private settle(ops: readonly ClaimedOperation[], results: readonly PushResult[]): Settlement[] {
    const byId = new Map(results.map((r) => [r.operationId, r]));
    const settlements = ops.map((o) => this.settlementFor(o, byId.get(o.operationId)));
    settleOperations(this.d.db(), settlements);
    if (results.some((r) => r.error?.code === 'VERSION_UNSUPPORTED')) block(this.d.db(), new TransportError(426, 'VERSION_UNSUPPORTED'));
    return settlements;
  }

  // applied/duplicate → sent; dependency → pending behind it; transient → pending; permanent → failed; the 12th failure → dead.
  private settlementFor(o: ClaimedOperation, r: PushResult | undefined): Settlement {
    if (r && (r.status === 'applied' || r.status === 'duplicate')) return { seq: o.seq, outcome: 'sent' };
    const attempt = o.attemptCount + 1;
    const errorClass = r?.error?.class ?? 'transient';
    const base = { seq: o.seq, code: r?.error?.code ?? 'NO_RESULT', message: r?.error?.detail ?? 'the server did not answer for this operation', errorClass };
    if (errorClass === 'dependency') return { ...base, outcome: 'pending', nextAttemptAt: nextAttemptAt(this.d.now(), Math.min(attempt, 4), this.d.random) };
    if (attempt >= MAX_ATTEMPTS) return { ...base, outcome: 'dead', nextAttemptAt: null };
    return { ...base, outcome: errorClass === 'permanent' ? 'failed' : 'pending', nextAttemptAt: nextAttemptAt(this.d.now(), attempt, this.d.random) };
  }
}
