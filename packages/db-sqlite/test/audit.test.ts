import { describe, expect, it } from 'vitest';
import {
  appendAudit, auditRejections, canonicalJson, DEVICE_AUDIT_SCOPE, GENESIS_HASH, queueUnsentAudit, readSyncStatus, recordAuditCheck, verifyAllAuditChains,
  verifyAuditChain, withTransaction, type Db,
} from '../src/index.js';
import { ACTOR, freshDb } from './helpers.js';

const audit = (db: Db, businessId: string, deviceId: string, after?: unknown) =>
  withTransaction(db, () => appendAudit(db, { businessId, deviceId, userId: ACTOR.userId, action: 'x', entityType: 'e', after }));
const auditOps = (db: Db) => db.prepare("SELECT operation_id, entity_id, depends_on_operation_id, payload_json FROM sync_outbox WHERE entity_type = 'audit_entry' ORDER BY seq")
  .all() as { operation_id: string; entity_id: string; depends_on_operation_id: string | null; payload_json: string }[];
const tamper = (db: Db, sql: string) => {
  db.exec('DROP TRIGGER IF EXISTS trg_audit_no_update');
  db.prepare(sql).run();
};

describe('audit hash chain (LLD §16)', () => {
  it('chains seq and hashes per (business, device) and verifies', async () => {
    const db = await freshDb();
    const a = appendAudit(db, { businessId: 'B', deviceId: ACTOR.deviceId, userId: ACTOR.userId, action: 'x', entityType: 'e', after: { b: 1, a: 2 } });
    const b = appendAudit(db, { businessId: 'B', deviceId: ACTOR.deviceId, userId: ACTOR.userId, action: 'y', entityType: 'e' });
    expect(a.seq).toBe(1); expect(a.prev_hash).toBe(GENESIS_HASH);
    expect(b.seq).toBe(2); expect(b.prev_hash).toBe(a.hash);
    expect(verifyAuditChain(db, 'B', ACTOR.deviceId)).toEqual({ ok: true, brokenAtSeq: null, reason: null, count: 2 });
    // second device has its own chain
    const c = appendAudit(db, { businessId: 'B', deviceId: 'D2', userId: ACTOR.userId, action: 'z', entityType: 'e' });
    expect(c.seq).toBe(1); expect(c.prev_hash).toBe(GENESIS_HASH);
  });
  it('detects tampering (via a raw table rebuild, since triggers block UPDATE)', async () => {
    const db = await freshDb();
    appendAudit(db, { businessId: 'B', deviceId: 'D', userId: 'u', action: 'x', entityType: 'e', after: { v: 1 } });
    appendAudit(db, { businessId: 'B', deviceId: 'D', userId: 'u', action: 'x', entityType: 'e', after: { v: 2 } });
    db.exec('DROP TRIGGER trg_audit_no_update');
    db.prepare("UPDATE audit_log SET after_json = '{\"v\":99}' WHERE seq = 1").run();
    const v = verifyAuditChain(db, 'B', 'D');
    expect(v.ok).toBe(false); expect(v.brokenAtSeq).toBe(1); expect(v.reason).toBe('hash');
  });
  it('canonical JSON sorts keys recursively and drops undefined', () => {
    expect(canonicalJson({ b: [{ z: 1, y: undefined }], a: 'x' })).toBe('{"a":"x","b":[{"z":1}]}');
  });
});

describe('audit rows are pushed (8g, ADR-0048)', () => {
  it('each row is queued in its transaction as the stored row, behind the previous row of its chain', async () => {
    const db = await freshDb();
    const rows = [audit(db, 'B', 'D', { v: 1 }), audit(db, 'B', 'D2'), audit(db, 'B', 'D', { v: 2 })];
    const ops = auditOps(db);
    expect(ops.map((o) => o.entity_id)).toEqual(rows.map((r) => r.id));
    expect(ops.map((o) => JSON.parse(o.payload_json) as unknown)).toEqual(rows);
    expect(ops.map((o) => o.depends_on_operation_id)).toEqual([null, null, ops[0]!.operation_id]);
  });

  it('device-level rows stay local', async () => {
    const db = await freshDb();
    audit(db, DEVICE_AUDIT_SCOPE, 'D');
    expect(auditOps(db)).toEqual([]);
    expect(queueUnsentAudit(db)).toBe(0);
  });

  it('rows written before 8g are queued once, in chain order', async () => {
    const db = await freshDb();
    const rows = [audit(db, 'B', 'D'), audit(db, 'B', 'D'), audit(db, 'B', 'D')];
    db.prepare("DELETE FROM sync_outbox WHERE entity_type = 'audit_entry' AND entity_id <> ?").run(rows[0]!.id);
    expect(queueUnsentAudit(db)).toBe(2);
    expect(queueUnsentAudit(db)).toBe(0);
    const ops = auditOps(db);
    expect(ops.map((o) => o.entity_id)).toEqual(rows.map((r) => r.id));
    expect(ops.map((o) => o.depends_on_operation_id)).toEqual([null, ops[0]!.operation_id, ops[1]!.operation_id]);
  });

  it('verification lists each chain with where and why it broke', async () => {
    const db = await freshDb();
    for (let i = 0; i < 3; i++) { audit(db, 'B', 'D', { i }); audit(db, 'B', 'E', { i }); }
    tamper(db, "UPDATE audit_log SET prev_hash = hash WHERE device_id = 'E' AND seq = 2");
    expect(verifyAllAuditChains(db).map((r) => [r.deviceId, r.ok, r.brokenAtSeq, r.reason, r.count])).toEqual([
      ['D', true, null, null, 3], ['E', false, 2, 'prev_hash', 3],
    ]);
    tamper(db, "UPDATE audit_log SET seq = 9 WHERE device_id = 'D' AND seq = 3");
    expect(verifyAuditChain(db, 'B', 'D')).toMatchObject({ ok: false, brokenAtSeq: 9, reason: 'seq_gap' });
  });

  it('a broken chain, found here or refused by the cloud, blocks the sync badge', async () => {
    const db = await freshDb();
    audit(db, 'B', 'D');
    recordAuditCheck(db, verifyAllAuditChains(db), '2026-10-04T10:00:00.000Z');
    expect(readSyncStatus(db, true, null)).toMatchObject({ auditChainBroken: false });
    recordAuditCheck(db, [{ businessId: 'B', deviceId: 'D', ok: false, brokenAtSeq: 1, reason: 'hash', count: 1 }], '2026-10-04T10:00:00.000Z');
    expect(readSyncStatus(db, true, null)).toMatchObject({ state: 'blocked', auditChainBroken: true });
    recordAuditCheck(db, verifyAllAuditChains(db), '2026-10-04T10:00:00.000Z');
    db.prepare("UPDATE sync_outbox SET status = 'failed', error_code = 'AUDIT_CHAIN_BROKEN', error_class = 'permanent', error_message = 'seq 1 already holds another row'").run();
    expect(readSyncStatus(db, true, null)).toMatchObject({ state: 'blocked', auditChainBroken: true });
    expect(auditRejections(db)).toEqual([{ operationId: auditOps(db)[0]!.operation_id, seq: 1, detail: 'seq 1 already holds another row' }]);
  });
});
