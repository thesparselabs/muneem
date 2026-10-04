import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import type { AuditVerification, SyncStatus } from '@muneem/contracts';
import { canonicalJson, type Db } from '@muneem/db-sqlite';
import { caller, ownerAtTill } from '../helpers.js';
import { DEVICE_A, referenceCloud, syncedDevice, syncUntilQuiet } from './syncHelpers.js';

const unlock = (db: Db) => db.exec('DROP TRIGGER IF EXISTS trg_audit_no_update');
const auditOps = (db: Db) => db.prepare("SELECT status, error_code FROM sync_outbox WHERE entity_type = 'audit_entry' ORDER BY seq").all() as
  { status: string; error_code: string | null }[];

async function tradingDevice() {
  const cloud = referenceCloud();
  const d = await syncedDevice(cloud, DEVICE_A);
  const { businessId } = await ownerAtTill(d.app);
  await d.app.register.open(10_000);
  return { cloud, ...d, api: caller(d.app), businessId };
}

describe('the audit chain on the cloud (8g, ADR-0048)', () => {
  it("every audit row reaches the cloud in order, on its device's chain, and verifies there and here", async () => {
    const { cloud, app, db, api, businessId } = await tradingDevice();
    await syncUntilQuiet(app);
    const local = db.prepare('SELECT seq, hash FROM audit_log WHERE business_id = ? ORDER BY seq').all(businessId) as { seq: number; hash: string }[];
    const chain = cloud.business(businessId)!.audit.chain(app.device.localDeviceId());
    expect(chain.map((e) => ({ seq: e.row.seq, hash: e.row.hash }))).toEqual(local);
    expect(local.length).toBeGreaterThan(3);
    expect(auditOps(db).every((o) => o.status === 'sent')).toBe(true);
    const v = await api.data<AuditVerification>('diagnostics.verifyAudit');
    expect(v).toMatchObject({ ok: true, cloudRejections: [] });
    expect(v.chains.find((c) => c.businessId === businessId)).toMatchObject({ ok: true, count: local.length });
  });

  it('a row tampered with on this device is caught by verifyAudit and blocks the badge', async () => {
    const { api, db, businessId } = await tradingDevice();
    unlock(db);
    db.prepare("UPDATE audit_log SET after_json = '{\"forged\":true}' WHERE business_id = ? AND seq = 2").run(businessId);
    const v = await api.data<AuditVerification>('diagnostics.verifyAudit');
    expect(v.ok).toBe(false);
    expect(v.chains.find((c) => c.businessId === businessId)).toMatchObject({ ok: false, brokenAtSeq: 2, reason: 'hash' });
    expect(await api.data<SyncStatus>('sync.getStatus')).toMatchObject({ state: 'blocked', auditChainBroken: true });
    expect(await api.data('diagnostics.integrityCheck')).toMatchObject({ auditChain: 'broken' });
  });

  it('a row tampered with before it was sent is refused by the cloud as AUDIT_CHAIN_BROKEN and the device says so', async () => {
    const { cloud, app, api, db, businessId } = await tradingDevice();
    const target = db.prepare("SELECT entity_id FROM sync_outbox WHERE entity_type = 'audit_entry' ORDER BY seq LIMIT 1 OFFSET 2").pluck().get() as string;
    const payload = JSON.parse(db.prepare("SELECT payload_json FROM sync_outbox WHERE entity_id = ?").pluck().get(target) as string) as Record<string, unknown>;
    const forged = canonicalJson({ ...payload, action: 'forged' });
    db.prepare('UPDATE sync_outbox SET payload_json = ?, payload_hash = ? WHERE entity_id = ?')
      .run(forged, `sha256:${createHash('sha256').update(forged).digest('hex')}`, target);
    await app.syncEngine.run({ pull: true });
    expect(auditOps(db).slice(0, 4)).toEqual([
      { status: 'sent', error_code: null }, { status: 'sent', error_code: null }, { status: 'failed', error_code: 'AUDIT_CHAIN_BROKEN' }, { status: 'pending', error_code: 'DEPENDENCY_MISSING' },
    ]);
    expect(cloud.deadLetters(businessId).map((d) => d.error.code)).toEqual(['AUDIT_CHAIN_BROKEN']);
    expect(cloud.conflicts(businessId).map((c) => c.kind)).toEqual(['audit_chain_broken']);
    expect(await api.data<SyncStatus>('sync.getStatus')).toMatchObject({ state: 'blocked', auditChainBroken: true });
    const v = await api.data<AuditVerification>('diagnostics.verifyAudit');
    expect(v).toMatchObject({ ok: false, cloudRejections: [{ seq: 3, detail: 'seq 3: the hash does not match the row' }] });
    expect(v.chains.every((c) => c.ok)).toBe(true);
  });

  it('rows written before 8g are queued at start-up in chain order and resends are duplicates', async () => {
    const { cloud, app, db, businessId } = await tradingDevice();
    db.prepare("DELETE FROM sync_outbox WHERE entity_type = 'audit_entry'").run();
    app.syncEngine.recover();
    expect(app.syncEngine.recover()).toBe(0);
    await syncUntilQuiet(app);
    const count = db.prepare('SELECT COUNT(*) FROM audit_log WHERE business_id = ?').pluck().get(businessId) as number;
    expect(cloud.business(businessId)!.audit.chain(app.device.localDeviceId())).toHaveLength(count);
    db.prepare("UPDATE sync_outbox SET status = 'pending' WHERE entity_type = 'audit_entry'").run();
    const again = await app.syncEngine.run({ pull: false });
    expect(again.push).toMatchObject({ sent: count, failed: 0, dead: 0 });
    expect(cloud.business(businessId)!.audit.chain(app.device.localDeviceId())).toHaveLength(count);
    expect(cloud.deadLetters(businessId)).toEqual([]);
  });
});
