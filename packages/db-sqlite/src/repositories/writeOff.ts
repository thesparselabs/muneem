import type { WriteOff } from '@muneem/contracts';
import type { Db } from '../open.js';
import { stmt } from '../statements.js';
import { allocationsOfSource } from './allocation.js';
import type { Actor } from './business.js';
import { syncColumns } from './catalogWrite.js';

export function insertWriteOff(
  db: Db, r: { id: string; businessId: string; customerId: string; docDate: string; amountPaise: number; reason: string; commandId: string }, actor: Actor,
): void {
  const s = syncColumns(actor);
  stmt(db, `INSERT INTO write_off (id, business_id, customer_id, doc_date, amount_paise, reason, command_id, created_at, updated_at, created_by, device_id)
    VALUES (@id, @businessId, @customerId, @docDate, @amountPaise, @reason, @commandId, @t, @t, @created_by, @device_id)`).run({ ...r, ...s });
}

export const writeOffIdByCommand = (db: Db, businessId: string, commandId: string): string | null =>
  (stmt(db, 'SELECT id FROM write_off WHERE business_id = ? AND command_id = ?').pluck().get(businessId, commandId) as string | undefined) ?? null;

export function getWriteOff(db: Db, id: string): (WriteOff & { businessId: string }) | null {
  const r = stmt(db, `SELECT id, business_id AS businessId, customer_id AS customerId, doc_date AS docDate, amount_paise AS amountPaise, reason
    FROM write_off WHERE id = ?`).get(id) as (Omit<WriteOff, 'allocations'> & { businessId: string }) | undefined;
  return r ? { ...r, allocations: allocationsOfSource(db, 'write_off', id) } : null;
}
