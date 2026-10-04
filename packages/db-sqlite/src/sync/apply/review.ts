import { canonicalJson } from '../../canonical.js';
import type { Db } from '../../open.js';
import { stmt } from '../../statements.js';

export interface LocalReview {
  id: string; businessId: string; kind: 'unique_clash' | 'apply_failed'; entityType: string; entityId: string; rule: string; winner: 'cloud' | 'device';
  field?: string; cloudValue?: unknown; deviceValue?: unknown;
}

// A review item this device raised itself (7f): listed beside the cloud's, and written once however often a page is replayed.
export function recordLocalReview(db: Db, r: LocalReview): void {
  const at = new Date().toISOString();
  const json = (v: unknown) => (v === undefined ? null : canonicalJson(v));
  stmt(db, `INSERT OR IGNORE INTO conflict_log (id, business_id, kind, entity_type, entity_id, device_id, rule, winner, field, cloud_value_json,
      device_value_json, occurred_at, received_at) VALUES (?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?)`)
    .run(r.id, r.businessId, r.kind, r.entityType, r.entityId, r.rule, r.winner, r.field ?? null, json(r.cloudValue), json(r.deviceValue), at, at);
}
