import { describe, expect, it } from 'vitest';
import { appendAudit, verifyAuditChain, canonicalJson, GENESIS_HASH } from '../src/index.js';
import { ACTOR, freshDb } from './helpers.js';

describe('audit hash chain (LLD §16)', () => {
  it('chains seq and hashes per (business, device) and verifies', async () => {
    const db = await freshDb();
    const a = appendAudit(db, { businessId: 'B', deviceId: ACTOR.deviceId, userId: ACTOR.userId, action: 'x', entityType: 'e', after: { b: 1, a: 2 } });
    const b = appendAudit(db, { businessId: 'B', deviceId: ACTOR.deviceId, userId: ACTOR.userId, action: 'y', entityType: 'e' });
    expect(a.seq).toBe(1); expect(a.prev_hash).toBe(GENESIS_HASH);
    expect(b.seq).toBe(2); expect(b.prev_hash).toBe(a.hash);
    expect(verifyAuditChain(db, 'B', ACTOR.deviceId)).toEqual({ ok: true, brokenAtSeq: null, count: 2 });
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
    expect(v.ok).toBe(false); expect(v.brokenAtSeq).toBe(1);
  });
  it('canonical JSON sorts keys recursively and drops undefined', () => {
    expect(canonicalJson({ b: [{ z: 1, y: undefined }], a: 'x' })).toBe('{"a":"x","b":[{"z":1}]}');
  });
});
