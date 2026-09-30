import { AppError, type Category } from '@muneem/contracts';
import { newUlid, normalizeName } from '@muneem/domain';
import type { Db } from '../open.js';
import { nowIso, withTransaction } from '../uow.js';
import type { Actor } from './business.js';
import { recordChange, syncColumns } from './catalogWrite.js';

type CategoryRow = { id: string; business_id: string; parent_id: string | null; name: string; version: number };
const toCategory = (r: CategoryRow): Category => ({ id: r.id, businessId: r.business_id, parentId: r.parent_id, name: r.name, version: r.version });

export function listCategories(db: Db, businessId: string): Category[] {
  return (db.prepare('SELECT * FROM category WHERE business_id = ? AND deleted_at IS NULL ORDER BY name_norm').all(businessId) as CategoryRow[]).map(toCategory);
}

export function getCategory(db: Db, id: string): Category | null {
  const r = db.prepare('SELECT * FROM category WHERE id = ? AND deleted_at IS NULL').get(id) as CategoryRow | undefined;
  return r ? toCategory(r) : null;
}

function assertNoCycle(db: Db, id: string, parentId: string | null): void {
  for (let cursor = parentId; cursor; cursor = getCategory(db, cursor)?.parentId ?? null) {
    if (cursor === id) throw new AppError('VALIDATION_FAILED', 'A category cannot be inside itself', { parentId: 'would create a loop' });
  }
}

export function createCategory(db: Db, businessId: string, input: { name: string; parentId: string | null }, actor: Actor): Category {
  return withTransaction(db, () => {
    const id = newUlid();
    const s = syncColumns(actor);
    db.prepare(`INSERT INTO category (id, business_id, parent_id, name, name_norm, created_at, updated_at, created_by, device_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(id, businessId, input.parentId, input.name, normalizeName(input.name), s.t, s.t, s.created_by, s.device_id);
    const category = getCategory(db, id)!;
    recordChange(db, businessId, actor, { action: 'category.create', entityType: 'category', entityId: id, operationType: 'create', after: category });
    return category;
  });
}

export function updateCategory(
  db: Db, id: string, expectedVersion: number, input: { name: string; parentId: string | null }, actor: Actor,
): Category {
  return withTransaction(db, () => {
    const before = getCategory(db, id);
    if (!before) throw new Error('NOT_FOUND');
    if (before.version !== expectedVersion) throw new Error('VERSION_CONFLICT');
    assertNoCycle(db, id, input.parentId);
    db.prepare(`UPDATE category SET name = ?, name_norm = ?, parent_id = ?, updated_at = ?, version = version + 1, sync_state = 'pending'
      WHERE id = ? AND version = ?`).run(input.name, normalizeName(input.name), input.parentId, nowIso(), id, expectedVersion);
    const after = getCategory(db, id)!;
    recordChange(db, before.businessId, actor, { action: 'category.update', entityType: 'category', entityId: id, operationType: 'update', before, after });
    return after;
  });
}
