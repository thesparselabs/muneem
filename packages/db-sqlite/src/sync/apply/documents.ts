import { stmt } from '../../statements.js';
import type { ApplyContext, Payload } from './context.js';
import { exists, insertRow } from './rows.js';

// A pulled document version carries its create payload, plus a later operation's payload under that operation's name (ADR-0038).
export interface DocumentApplier {
  table: string;
  create(ctx: ApplyContext, p: Payload): void;
  cancel?(ctx: ApplyContext, cancel: Payload, p: Payload): void;
  update?(ctx: ApplyContext, update: Payload, p: Payload): void;
  cancelled?(ctx: ApplyContext): boolean;
}

const sub = (p: Payload, key: string): Payload | null => (p[key] && typeof p[key] === 'object' ? (p[key] as Payload) : null);

export function applyDocument(a: DocumentApplier, ctx: ApplyContext): void {
  const p = ctx.change.payload;
  if (!exists(ctx.db, a.table, ctx.change.entityId)) a.create(ctx, p);
  const cancel = sub(p, 'cancel');
  if (cancel && a.cancel && !(a.cancelled?.(ctx) ?? false)) a.cancel(ctx, cancel, p);
  const update = sub(p, 'update');
  if (update && a.update) a.update(ctx, update, p);
}

export const statusIs = (table: string, status: string) => (ctx: ApplyContext): boolean =>
  stmt(ctx.db, `SELECT status FROM ${table} WHERE id = ?`).pluck().get(ctx.change.entityId) === status;

export const str = (v: unknown): string | null => (typeof v === 'string' && v.length > 0 ? v : null);

// The party sub-ledger entry a document carries (ADR-0022), stored under its own id; applying it twice writes nothing.
export function applyPartyEntry(ctx: ApplyContext, e: unknown): void {
  if (!e || typeof e !== 'object') return;
  const p = e as Payload;
  if (stmt(ctx.db, 'SELECT 1 FROM party_ledger_entry WHERE business_id = ? AND ref_type = ? AND ref_id = ? AND entry_kind = ?').get(ctx.businessId, p.refType, p.refId, p.kind)) return;
  const at = new Date().toISOString();
  insertRow(ctx.db, 'party_ledger_entry', {
    id: p.id, business_id: ctx.businessId, party_type: p.partyType, party_id: p.partyId, ref_type: p.refType, ref_id: p.refId, entry_kind: p.kind,
    amount_paise: p.amountPaise, doc_date: p.docDate, due_date: p.dueDate ?? null, occurred_at: at, created_at: at, updated_at: at,
    created_by: ctx.actor.userId, device_id: ctx.actor.deviceId, sync_state: 'synced',
  });
}

export interface DrawerRow { id: string; sessionId: string; kind: string; amountPaise: number; reason: string; createdAt: string }

// Cash a payment or expense moved through a drawer, when that drawer's session is on this device.
export function applyDrawerMovements(ctx: ApplyContext, rows: unknown, refType: 'payment' | 'expense', refId: string): void {
  if (!Array.isArray(rows)) return;
  for (const m of rows as DrawerRow[]) {
    if (exists(ctx.db, 'cash_movement', m.id) || !exists(ctx.db, 'pos_session', m.sessionId)) continue;
    insertRow(ctx.db, 'cash_movement', {
      id: m.id, business_id: ctx.businessId, session_id: m.sessionId, kind: m.kind, amount_paise: m.amountPaise, reason: m.reason, ref_type: refType, ref_id: refId,
      created_at: m.createdAt, updated_at: m.createdAt, created_by: ctx.actor.userId, device_id: ctx.actor.deviceId, sync_state: 'synced',
    });
  }
}
