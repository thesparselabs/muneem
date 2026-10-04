import type { Db } from '../../open.js';
import { stmt } from '../../statements.js';
import { syncedAt, type ApplyContext, type Payload } from './context.js';

export type Row = Record<string, unknown>;

// Column names always come from apply code, never from a payload; only values do.
export const exists = (db: Db, table: string, id: string): boolean => stmt(db, `SELECT 1 FROM ${table} WHERE id = ?`).get(id) !== undefined;

export function insertRow(db: Db, table: string, row: Row): void {
  const cols = Object.keys(row);
  stmt(db, `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${cols.map((c) => `@${c}`).join(', ')})`).run(row);
}

export function updateRow(db: Db, table: string, id: string, row: Row): void {
  const cols = Object.keys(row);
  if (cols.length === 0) return;
  stmt(db, `UPDATE ${table} SET ${cols.map((c) => `${c} = @${c}`).join(', ')} WHERE id = @__id`).run({ ...row, __id: id });
}

// The bookkeeping columns of a row that came from another device: its times, its author, the cloud's version, and synced.
export function syncedColumns(ctx: ApplyContext, p: Payload): Row {
  const at = syncedAt(p);
  return { created_at: at, updated_at: typeof p.updatedAt === 'string' ? p.updatedAt : at, created_by: ctx.actor.userId, device_id: ctx.actor.deviceId };
}

export const versioned = (ctx: ApplyContext): Row => ({ version: ctx.change.version, sync_state: 'synced' });

// Only the keys a payload carries; a missing optional field reads as null for entities whose payload is always whole.
export function pick(p: Payload, map: Readonly<Record<string, string>>, whole: boolean): Row {
  const out: Row = {};
  for (const [key, col] of Object.entries(map)) {
    if (key in p) out[col] = toSql(p[key]);
    else if (whole) out[col] = null;
  }
  return out;
}

export const toSql = (v: unknown): unknown => (typeof v === 'boolean' ? (v ? 1 : 0) : v === undefined ? null : v);
