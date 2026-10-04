import { addAlias, localId, type AliasType } from './aliases.js';
import { hasUnsentEdit, type ApplyContext, type Payload } from './context.js';
import { exists, insertRow, syncedColumns, updateRow, versioned, type Row } from './rows.js';
import { settleUniqueClashes, type UniqueField } from './uniqueClash.js';

// How one master or config entity maps onto its table (ADR-0040/0041: upsert, natural keys, no outbox, no audit).
export interface MasterSpec {
  table: string;
  columns(ctx: ApplyContext, p: Payload): Row;
  inserted?(ctx: ApplyContext, p: Payload): Row;
  natural?: { alias: AliasType; find(ctx: ApplyContext, row: Row): string | null };
  after?(ctx: ApplyContext, id: string): void;
  softDelete?: boolean;
  unique?: readonly UniqueField[];
}

export function applyMaster(spec: MasterSpec, ctx: ApplyContext): void {
  const { db, businessId, change } = ctx;
  const remoteId = change.entityId;
  const id = spec.natural ? localId(db, businessId, spec.natural.alias, remoteId)! : remoteId;
  if (hasUnsentEdit(db, businessId, change.entityType, id)) return;
  if (change.op === 'delete') {
    if (spec.softDelete !== false && exists(db, spec.table, id)) updateRow(db, spec.table, id, { deleted_at: change.payload.deletedAt ?? new Date().toISOString(), ...versioned(ctx) });
    return;
  }
  const row = spec.columns(ctx, change.payload);
  if (spec.unique) settleUniqueClashes(ctx, spec.table, id, row, spec.unique);
  if (exists(db, spec.table, id)) {
    updateRow(db, spec.table, id, { ...row, ...versioned(ctx), updated_at: syncedColumns(ctx, change.payload).updated_at });
  } else {
    const twin = spec.natural?.find(ctx, row);
    if (twin && spec.natural) {
      addAlias(db, businessId, spec.natural.alias, remoteId, twin);
      return;
    }
    insertRow(db, spec.table, { id, business_id: businessId, ...row, ...spec.inserted?.(ctx, change.payload), ...syncedColumns(ctx, change.payload), ...versioned(ctx) });
  }
  spec.after?.(ctx, id);
}

export const bool = (v: unknown): number | null => (v === undefined || v === null ? null : v ? 1 : 0);
