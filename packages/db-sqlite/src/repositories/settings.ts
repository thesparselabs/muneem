import { appendAudit } from '../audit.js';
import type { Db } from '../open.js';
import { appendOutbox } from '../outbox.js';
import { nowIso, withTransaction } from '../uow.js';
import type { Actor } from './business.js';

export function getSetting(db: Db, businessId: string, key: string): unknown | null {
  const r = db.prepare('SELECT value_json FROM setting WHERE business_id = ? AND key = ?').get(businessId, key) as { value_json: string } | undefined;
  return r ? (JSON.parse(r.value_json) as unknown) : null;
}
export function setSetting(db: Db, businessId: string, key: string, value: unknown, actor: Actor): void {
  withTransaction(db, () => {
    const before = getSetting(db, businessId, key);
    db.prepare(`INSERT INTO setting (business_id, key, value_json, updated_at, updated_by) VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(business_id, key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at, updated_by = excluded.updated_by, version = setting.version + 1`)
      .run(businessId, key, JSON.stringify(value ?? null), nowIso(), actor.userId);
    appendAudit(db, { businessId, deviceId: actor.deviceId, userId: actor.userId, terminalId: actor.terminalId, action: 'settings.set', entityType: 'setting', entityId: key, before, after: value });
    appendOutbox(db, { businessId, deviceId: actor.deviceId, entityType: 'setting', entityId: key, operationType: 'update', payload: { key, value } });
  });
}
