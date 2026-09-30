import type { Uom } from '@muneem/contracts';
import { newUlid } from '@muneem/domain';
import type { Db } from '../open.js';
import { withTransaction } from '../uow.js';
import type { Actor } from './business.js';
import { recordChange, syncColumns } from './catalogWrite.js';

type UomRow = { id: string; business_id: string; code: string; name: string; decimals: number; version: number };
const toUom = (r: UomRow): Uom => ({ id: r.id, businessId: r.business_id, code: r.code, name: r.name, decimals: r.decimals, version: r.version });

export function listUoms(db: Db, businessId: string): Uom[] {
  return (db.prepare('SELECT * FROM uom WHERE business_id = ? AND deleted_at IS NULL ORDER BY code').all(businessId) as UomRow[]).map(toUom);
}

export function getUom(db: Db, id: string): Uom | null {
  const r = db.prepare('SELECT * FROM uom WHERE id = ? AND deleted_at IS NULL').get(id) as UomRow | undefined;
  return r ? toUom(r) : null;
}

export function findUomByCode(db: Db, businessId: string, code: string): Uom | null {
  const r = db.prepare('SELECT * FROM uom WHERE business_id = ? AND code = ? AND deleted_at IS NULL').get(businessId, code) as UomRow | undefined;
  return r ? toUom(r) : null;
}

export function createUom(db: Db, businessId: string, input: { code: string; name: string; decimals: number }, actor: Actor): Uom {
  return withTransaction(db, () => {
    const id = newUlid();
    const s = syncColumns(actor);
    db.prepare(`INSERT INTO uom (id, business_id, code, name, decimals, created_at, updated_at, created_by, device_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(id, businessId, input.code, input.name, input.decimals, s.t, s.t, s.created_by, s.device_id);
    const uom = getUom(db, id)!;
    recordChange(db, businessId, actor, { action: 'uom.create', entityType: 'uom', entityId: id, operationType: 'create', after: uom });
    return uom;
  });
}
