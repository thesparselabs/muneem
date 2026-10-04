import { stmt } from '../../statements.js';
import type { ApplyContext } from './context.js';
import { recordLocalReview } from './review.js';
import { updateRow, type Row } from './rows.js';

// A column unique within the business (and `within` columns, and among live rows when the index is partial); the
// losing row gets `replacement` instead.
export interface UniqueField {
  column: string;
  within?: readonly string[];
  liveOnly?: boolean;
  alsoSet?: Row;
  replacement(ctx: ApplyContext, table: string, column: string, value: string): string | null;
}

export const cleared = (): null => null;

// A code or prefix that must stay set: its leading characters plus the first suffix not taken in the business.
export const freeVariant = (maxLength: number) => (ctx: ApplyContext, table: string, column: string, value: string): string => {
  const head = value.slice(0, maxLength - 1);
  const taken = stmt(ctx.db, `SELECT 1 FROM ${table} WHERE business_id = ? AND ${column} = ?`);
  const suffix = [...'23456789ABCDEFGHJKLMNPQRSTUVWXYZ'].find((c) => !taken.get(ctx.businessId, `${head}${c}`));
  return `${head}${suffix ?? '0'}`;
};

const holder = (ctx: ApplyContext, table: string, field: UniqueField, row: Row, id: string): string | null => {
  const scope = (field.within ?? []).map((c) => ` AND ${c} = @${c}`).join('');
  const live = field.liveOnly ? ' AND deleted_at IS NULL' : '';
  return (stmt(ctx.db, `SELECT id FROM ${table} WHERE business_id = @businessId AND ${field.column} = @value AND id <> @id${live}${scope} LIMIT 1`).pluck().get({
    businessId: ctx.businessId, value: row[field.column], id, ...Object.fromEntries((field.within ?? []).map((c) => [c, row[c]])),
  }) as string | undefined) ?? null;
};

// Two rows wanting one unique value never block a stream: the lower id keeps it on every device, the other is given a
// replacement here and listed for review. Devices see the same pair whatever the order, so they settle the same way.
export function settleUniqueClashes(ctx: ApplyContext, table: string, id: string, row: Row, fields: readonly UniqueField[]): void {
  for (const field of fields) {
    const value = row[field.column];
    if (typeof value !== 'string' || value.length === 0 || (field.within ?? []).some((c) => row[c] === undefined)) continue;
    const other = holder(ctx, table, field, row, id);
    if (!other) continue;
    const loser = other < id ? id : other;
    const replacement = field.replacement(ctx, table, field.column, value);
    const set: Row = { [field.column]: replacement, ...field.alsoSet };
    if (loser === id) Object.assign(row, set);
    else updateRow(ctx.db, table, loser, set);
    recordLocalReview(ctx.db, {
      id: `unique-clash:${table}:${field.column}:${loser}`, businessId: ctx.businessId, kind: 'unique_clash', entityType: ctx.change.entityType, entityId: loser,
      rule: 'lower_id_keeps', winner: loser === id ? 'device' : 'cloud', field: field.column, cloudValue: value, deviceValue: set,
    });
  }
}
