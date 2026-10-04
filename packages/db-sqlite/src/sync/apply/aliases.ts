import type { Db } from '../../open.js';
import { stmt } from '../../statements.js';

// ADR-0040 natural keys: rows each device makes on demand are matched by code, not id, and another device's id resolves to this one's.
export type AliasType = 'uom' | 'category' | 'brand' | 'account' | 'expense_category' | 'price_list' | 'warehouse';

export function addAlias(db: Db, businessId: string, type: AliasType, remoteId: string, localId: string): void {
  if (remoteId === localId) return;
  stmt(db, 'INSERT OR REPLACE INTO sync_id_alias (business_id, entity_type, remote_id, local_id) VALUES (?, ?, ?, ?)').run(businessId, type, remoteId, localId);
}

export function localId(db: Db, businessId: string, type: AliasType, remoteId: unknown): string | null {
  if (typeof remoteId !== 'string' || remoteId.length === 0) return null;
  return (stmt(db, 'SELECT local_id FROM sync_id_alias WHERE business_id = ? AND entity_type = ? AND remote_id = ?').pluck()
    .get(businessId, type, remoteId) as string | undefined) ?? remoteId;
}

// A resolver bound to one business, for apply code that maps many references.
export const resolver = (db: Db, businessId: string) => (type: AliasType, remoteId: unknown): string | null => localId(db, businessId, type, remoteId);
