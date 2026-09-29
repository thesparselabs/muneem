import type { Brand } from '@muneem/contracts';
import { newUlid, normalizeName } from '@muneem/domain';
import type { Db } from '../open.js';
import { nowIso, withTransaction } from '../uow.js';
import type { Actor } from './business.js';
import { recordChange, syncColumns } from './catalogWrite.js';
import { reindexBrand } from './productSearchIndex.js';

type BrandRow = { id: string; business_id: string; name: string; version: number };
const toBrand = (r: BrandRow): Brand => ({ id: r.id, businessId: r.business_id, name: r.name, version: r.version });

export function listBrands(db: Db, businessId: string): Brand[] {
  return (db.prepare('SELECT * FROM brand WHERE business_id = ? AND deleted_at IS NULL ORDER BY name_norm').all(businessId) as BrandRow[]).map(toBrand);
}

export function getBrand(db: Db, id: string): Brand | null {
  const r = db.prepare('SELECT * FROM brand WHERE id = ? AND deleted_at IS NULL').get(id) as BrandRow | undefined;
  return r ? toBrand(r) : null;
}

export function findBrandByName(db: Db, businessId: string, name: string): Brand | null {
  const r = db.prepare('SELECT * FROM brand WHERE business_id = ? AND name_norm = ? AND deleted_at IS NULL').get(businessId, normalizeName(name)) as BrandRow | undefined;
  return r ? toBrand(r) : null;
}

export function createBrand(db: Db, businessId: string, input: { name: string }, actor: Actor): Brand {
  return withTransaction(db, () => {
    const id = newUlid();
    const s = syncColumns(actor);
    db.prepare(`INSERT INTO brand (id, business_id, name, name_norm, created_at, updated_at, created_by, device_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(id, businessId, input.name, normalizeName(input.name), s.t, s.t, s.created_by, s.device_id);
    const brand = getBrand(db, id)!;
    recordChange(db, businessId, actor, { action: 'brand.create', entityType: 'brand', entityId: id, operationType: 'create', after: brand });
    return brand;
  });
}

export function updateBrand(db: Db, id: string, expectedVersion: number, input: { name: string }, actor: Actor): Brand {
  return withTransaction(db, () => {
    const before = getBrand(db, id);
    if (!before) throw new Error('NOT_FOUND');
    if (before.version !== expectedVersion) throw new Error('VERSION_CONFLICT');
    db.prepare(`UPDATE brand SET name = ?, name_norm = ?, updated_at = ?, version = version + 1, sync_state = 'pending'
      WHERE id = ? AND version = ?`).run(input.name, normalizeName(input.name), nowIso(), id, expectedVersion);
    const after = getBrand(db, id)!;
    reindexBrand(db, id);
    recordChange(db, before.businessId, actor, { action: 'brand.update', entityType: 'brand', entityId: id, operationType: 'update', before, after });
    return after;
  });
}
