import { STREAM_OF, type Change, type OutboxEntityType, type PushOperation, type SyncStream } from '@muneem/contracts';
import { mergeStale, matchesSent, type FieldConflict } from './conflicts.js';
import type { BusinessState, ConflictLogRow, EntityState, Payload } from './state.js';

export type NewChange = Omit<Change, 'seq'>;
export type NewConflict = Omit<ConflictLogRow, 'id' | 'at'>;
export interface Applied { change: NewChange | null; conflicts: NewConflict[] }

// Push-only types (audit_entry) are stored apart and never reach the change log.
const streamOf = (entityType: string) => STREAM_OF[entityType as OutboxEntityType] as SyncStream;
export const isDocument = (entityType: string): boolean => streamOf(entityType) === 'documents';
const updatedAtOf = (p: Payload): string | null => (typeof p.updatedAt === 'string' ? p.updatedAt : null);

function changeOf(e: EntityState, op: Change['op'], originDeviceId: string | null): NewChange {
  return { stream: streamOf(e.entityType), entityType: e.entityType, entityId: e.entityId, op, version: e.version, originDeviceId, payload: e.payload };
}

function created(b: BusinessState, op: PushOperation, deviceId: string): EntityState {
  const e: EntityState = {
    entityType: op.entityType, entityId: op.entityId, version: 1, payload: op.payload, originDeviceId: deviceId,
    updatedAt: updatedAtOf(op.payload), deletedAt: null, history: new Map([[1, op.payload]]),
  };
  b.put(e);
  return e;
}

function bump(e: EntityState, payload: Payload, deviceId: string): void {
  e.version += 1;
  e.payload = payload;
  e.originDeviceId = deviceId;
  e.updatedAt = updatedAtOf(payload) ?? e.updatedAt;
  e.history.set(e.version, payload);
}

// Documents are insert-only; a later operation is a new version carrying the create payload plus that operation's payload under its type.
function applyDocument(b: BusinessState, op: PushOperation, deviceId: string): Applied {
  const existing = b.entity(op.entityType, op.entityId);
  if (!existing) return { change: changeOf(created(b, op, deviceId), 'upsert', deviceId), conflicts: [] };
  if (op.operationType === 'create' || existing.payload[op.operationType] !== undefined) return { change: null, conflicts: [] };
  bump(existing, { ...existing.payload, [op.operationType]: op.payload }, deviceId);
  return { change: changeOf(existing, 'upsert', deviceId), conflicts: [] };
}

const toConflict = (op: PushOperation, deviceId: string, c: FieldConflict): NewConflict => ({
  kind: 'conflict', entityType: op.entityType, entityId: op.entityId, deviceId, rule: c.rule, winner: c.winner, field: c.field,
  cloudValue: c.cloudValue, deviceValue: c.deviceValue,
});

function tombstone(e: EntityState, deviceId: string, at: string): NewChange {
  bump(e, { ...e.payload, deletedAt: at }, deviceId);
  e.deletedAt = at;
  return changeOf(e, 'delete', deviceId);
}

const itemIds = (p: Payload, key: 'items' | 'retired'): string[] =>
  ((p[key] ?? []) as (string | { id: string })[]).map((x) => (typeof x === 'string' ? x : x.id)).sort();

// A product's prices are replaced whole, naming the items replaced; replacing items the cloud no longer has is a stale edit, and the cloud keeps its prices.
function stalePrices(existing: EntityState, op: PushOperation, deviceId: string): Applied | null {
  if (op.entityType !== 'price_list_item' || sameIds(itemIds(existing.payload, 'items'), itemIds(op.payload, 'retired'))) return null;
  bump(existing, existing.payload, deviceId);
  return {
    change: changeOf(existing, 'upsert', null),
    conflicts: [{ kind: 'conflict', entityType: op.entityType, entityId: op.entityId, deviceId, rule: 'cloud_wins', winner: 'cloud', field: 'items',
      cloudValue: existing.payload.items, deviceValue: op.payload.items }],
  };
}
const sameIds = (a: string[], b: string[]): boolean => a.length === b.length && a.every((x, i) => x === b[i]);

// ADR-0041: masters and config merge by field; a tombstone wins over a concurrent update.
function applyMaster(b: BusinessState, op: PushOperation, deviceId: string, at: string): Applied {
  const existing = b.entity(op.entityType, op.entityId);
  if (!existing) {
    const e = created(b, op, deviceId);
    return { change: op.operationType === 'void' ? tombstone(e, deviceId, at) : changeOf(e, 'upsert', deviceId), conflicts: [] };
  }
  if (existing.deletedAt !== null) {
    bump(existing, existing.payload, deviceId);
    return {
      change: changeOf(existing, 'delete', null),
      conflicts: [{ kind: 'tombstone', entityType: op.entityType, entityId: op.entityId, deviceId, rule: 'tombstone_wins', winner: 'cloud' }],
    };
  }
  if (op.operationType === 'void') return { change: tombstone(existing, deviceId, at), conflicts: [] };
  const stale = stalePrices(existing, op, deviceId);
  if (stale) return stale;
  const sentVersion = typeof op.payload.version === 'number' ? op.payload.version : null;
  const base = sentVersion === null ? existing.version : sentVersion - 1;
  const merged = base >= existing.version
    ? { payload: { ...existing.payload, ...op.payload }, conflicts: [] }
    : mergeStale(op.entityType, existing.history.get(base) ?? {}, { payload: existing.payload, updatedAt: existing.updatedAt, deviceId: existing.originDeviceId },
      { payload: op.payload, updatedAt: updatedAtOf(op.payload), deviceId });
  bump(existing, merged.payload, deviceId);
  const origin = matchesSent(merged.payload, op.payload) ? deviceId : null;
  return { change: changeOf(existing, 'upsert', origin), conflicts: merged.conflicts.map((c) => toConflict(op, deviceId, c)) };
}

const monthOf = (d: unknown): string | null => (typeof d === 'string' && d.length >= 7 ? `${d.slice(0, 7)}-01` : null);

function documentMonth(p: Payload): string | null {
  const journal = p.journal as Payload | null | undefined;
  return monthOf(journal?.entryDate ?? p.docDate ?? p.paymentDate ?? p.expenseDate);
}

// A pushed lock is the business's lock (7c); a document into a locked month is stored and listed as a late arrival.
function controlEffects(b: BusinessState, op: PushOperation, deviceId: string): NewConflict[] {
  if (op.entityType === 'accounting_period') {
    const month = monthOf(op.payload.periodStart);
    if (month && op.payload.status === 'locked') b.lockedMonths.add(month);
    if (month && op.payload.status === 'open') b.lockedMonths.delete(month);
    return [];
  }
  if (op.operationType !== 'create' || !isDocument(op.entityType)) return [];
  const month = documentMonth(op.payload);
  return month && b.lockedMonths.has(month)
    ? [{ kind: 'late_arrival', entityType: op.entityType, entityId: op.entityId, deviceId, rule: 'stored_as_sent', winner: 'device' }]
    : [];
}

// The same code on two products from two devices keeps both rows and becomes a review item (ADR-0041).
function duplicateBarcode(b: BusinessState, op: PushOperation, deviceId: string): NewConflict[] {
  if (op.entityType !== 'barcode' || op.operationType !== 'create') return [];
  const clash = [...b.entities.values()].find((e) => e.entityType === 'barcode' && e.deletedAt === null && e.entityId !== op.entityId
    && e.payload.code === op.payload.code && e.payload.productId !== op.payload.productId && e.originDeviceId !== deviceId);
  return clash ? [{ kind: 'duplicate_barcode', entityType: 'barcode', entityId: op.entityId, deviceId, rule: 'keep_both', winner: 'device', cloudValue: clash.entityId }] : [];
}

// ADR-0045: a year close is stored whole as each version arrives; the refusal rules already ordered them.
function applyYearClose(b: BusinessState, op: PushOperation, deviceId: string): Applied {
  const existing = b.entity(op.entityType, op.entityId);
  if (!existing) return { change: changeOf(created(b, op, deviceId), 'upsert', deviceId), conflicts: [] };
  bump(existing, op.payload, deviceId);
  return { change: changeOf(existing, 'upsert', deviceId), conflicts: [] };
}

export function applyOperation(b: BusinessState, op: PushOperation, deviceId: string, at: string): Applied {
  if (op.entityType === 'fy_close') return applyYearClose(b, op, deviceId);
  const effects = [...controlEffects(b, op, deviceId), ...duplicateBarcode(b, op, deviceId)];
  const applied = isDocument(op.entityType) ? applyDocument(b, op, deviceId) : applyMaster(b, op, deviceId, at);
  return { change: applied.change, conflicts: [...applied.conflicts, ...effects] };
}
