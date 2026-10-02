import { describe, expect, it } from 'vitest';
import {
  allocateDocNumber, bindTerminal, createBranch, createBusiness, createDocSeries, createTerminal, getSetting, listBranches,
  listTerminals, outboxDepth, readSyncStatus, setSetting, updateBusiness, verifyAuditChain, withTransaction,
  upsertUser, upsertCredential, getCredential, recordPinAttempt, listCachedUsers, grantLocalOwnership, getMembership,
} from '../src/index.js';
import { ROLE_PRESETS } from '@muneem/contracts';
import { ACTOR, ORG, freshDb } from './helpers.js';

const biz = { organizationId: ORG, name: 'Sharma General Store', businessType: 'retail' as const, stateCode: '07', taxScheme: 'regular' as const, fyStartMonth: 4 as const };

describe('business setup writes are atomic with audit + outbox', () => {
  it('createBusiness → 1 row, 1 audit, 1 outbox, local_seq bumped', async () => {
    const db = await freshDb();
    const b = createBusiness(db, biz, ACTOR);
    expect(b.name).toBe('Sharma General Store');
    expect(db.prepare('SELECT COUNT(*) AS n FROM audit_log').get()).toEqual({ n: 1 });
    expect(db.prepare("SELECT entity_type, operation_type, status FROM sync_outbox").all()).toEqual([{ entity_type: 'business', operation_type: 'create', status: 'pending' }]);
    expect(db.prepare('SELECT next_seq FROM local_sequence').get()).toEqual({ next_seq: 2 });
    expect(verifyAuditChain(db, b.id, ACTOR.deviceId).ok).toBe(true);
  });
  it('a failure after the row insert rolls back everything (no orphan audit/outbox)', async () => {
    const db = await freshDb();
    const b = createBusiness(db, biz, ACTOR);
    expect(() => withTransaction(db, () => {
      createBranch(db, b.id, { code: 'DEL1', name: 'Delhi', stateCode: '07', isDefault: true }, ACTOR);
      throw new Error('boom');
    })).toThrow('boom');
    expect(listBranches(db, b.id)).toEqual([]);
    expect(db.prepare('SELECT COUNT(*) AS n FROM audit_log').get()).toEqual({ n: 1 });
    expect(outboxDepth(db).depth).toBe(1);
    expect(db.prepare('SELECT next_seq FROM local_sequence').get()).toEqual({ next_seq: 2 });
  });
  it('branch/terminal creation, first branch becomes default, terminal binding is exclusive per device', async () => {
    const db = await freshDb();
    const b = createBusiness(db, biz, ACTOR);
    const br = createBranch(db, b.id, { code: 'DEL1', name: 'Delhi', stateCode: '07', isDefault: false }, ACTOR);
    expect(br.isDefault).toBe(true);
    const t1 = createTerminal(db, b.id, { branchId: br.id, code: 'T01', name: 'Counter 1' }, ACTOR);
    const t2 = createTerminal(db, b.id, { branchId: br.id, code: 'T02', name: 'Counter 2' }, ACTOR);
    bindTerminal(db, t1.id, ACTOR);
    bindTerminal(db, t2.id, ACTOR);
    const ts = listTerminals(db, b.id, br.id);
    expect(ts.find((t) => t.id === t1.id)!.deviceId).toBeNull();
    expect(ts.find((t) => t.id === t2.id)!.deviceId).toBe(ACTOR.deviceId);
    expect(() => createTerminal(db, b.id, { branchId: br.id, code: 'T01', name: 'dup' }, ACTOR)).toThrow(/UNIQUE/);
    expect(verifyAuditChain(db, b.id, ACTOR.deviceId).ok).toBe(true);
  });
  it('optimistic version on update', async () => {
    const db = await freshDb();
    const b = createBusiness(db, biz, ACTOR);
    const u = updateBusiness(db, b.id, 1, { name: 'Sharma Stores' }, ACTOR);
    expect(u.version).toBe(2);
    expect(() => updateBusiness(db, b.id, 1, { name: 'stale' }, ACTOR)).toThrow('VERSION_CONFLICT');
  });
  it('settings + series + doc number allocation inside a transaction', async () => {
    const db = await freshDb();
    const b = createBusiness(db, biz, ACTOR);
    setSetting(db, b.id, 'pos.roundToRupee', true, ACTOR);
    expect(getSetting(db, b.id, 'pos.roundToRupee')).toBe(true);
    const s = createDocSeries(db, b.id, { branchId: null, terminalId: null, docType: 'tax_invoice', fy: '2026-27', prefix: 'D1T1', padWidth: 6 }, ACTOR);
    expect(() => allocateDocNumber(db, s.id)).toThrow(/inside/);
    const n = withTransaction(db, () => allocateDocNumber(db, s.id));
    expect(n).toEqual({ seq: 1, number: 'D1T1/2627/000001' });
    expect(withTransaction(db, () => allocateDocNumber(db, s.id)).seq).toBe(2);
    db.prepare('UPDATE doc_series SET next_seq = 1000000 WHERE id = ?').run(s.id);
    expect(() => withTransaction(db, () => allocateDocNumber(db, s.id))).toThrow(/999999/);
    expect(db.prepare('SELECT next_seq FROM doc_series WHERE id = ?').pluck().get(s.id)).toBe(1_000_000);
  });
  it('sync status derives from the outbox', async () => {
    const db = await freshDb();
    expect(readSyncStatus(db, false, null).state).toBe('never');
    createBusiness(db, biz, ACTOR);
    const s = readSyncStatus(db, false, null);
    expect(s.state).toBe('queued'); expect(s.pending).toBe(1);
  });
});

describe('offline credential cache', () => {
  it('stores hashes, lists cached users, locks PIN after N failures', async () => {
    const db = await freshDb();
    upsertUser(db, { id: ACTOR.userId, name: 'Aditya', identifier: '9999999999', email: null, mobile: '9999999999' });
    upsertCredential(db, { userId: ACTOR.userId, passwordHash: '$argon2id$fake', maxOfflineDays: 30 });
    expect(listCachedUsers(db).map((u) => u.name)).toEqual(['Aditya']);
    expect(getCredential(db, ACTOR.userId)!.passwordHash).toBe('$argon2id$fake');
    for (let i = 0; i < 4; i++) expect(recordPinAttempt(db, ACTOR.userId, false, 5, 300).locked).toBe(false);
    const r = recordPinAttempt(db, ACTOR.userId, false, 5, 300);
    expect(r.locked).toBe(true); expect(r.lockedUntil).toBeTruthy();
    grantLocalOwnership(db, ACTOR.userId, 'BIZ', ORG, 'X', ROLE_PRESETS.owner!);
    expect(getMembership(db, ACTOR.userId, 'BIZ')!.snapshot.roles).toEqual(['owner']);
  });
});
