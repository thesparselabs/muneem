import { newUlid, type PartyType } from '@muneem/domain';
import type { Db } from '../open.js';
import { stmt } from '../statements.js';
import type { Actor } from './business.js';
import { syncColumns } from './catalogWrite.js';
import { docNumbers } from './partyDocuments.js';

export type AllocationSource = 'payment' | 'debit_note' | 'credit_note' | 'write_off' | 'opening';
export type AllocationTarget = 'sale' | 'purchase' | 'expense' | 'opening';

export interface AllocationInput {
  businessId: string; partyType: PartyType; partyId: string;
  sourceType: AllocationSource; sourceId: string; targetType: AllocationTarget; targetId: string; amountPaise: number;
  on: string;   // business date: the settling document's date when made with it, else the day it is made
}

const TARGET_DATE: Record<AllocationTarget, string> = {
  sale: 'SELECT doc_date FROM sale WHERE id = ?', purchase: 'SELECT doc_date FROM purchase WHERE id = ?',
  expense: 'SELECT expense_date FROM expense WHERE id = ?', opening: 'SELECT as_of_date FROM party_opening WHERE id = ?',
};

// The only writer of allocation; triggers keep both documents' totals and refuse over-allocation (ADR-0025).
// It takes effect no earlier than the document it settles, so a backdated payment never settles a bill before the bill exists (5h #5).
export function insertAllocation(db: Db, a: AllocationInput, actor: Actor): { id: string; allocatedOn: string } {
  const id = newUlid();
  const s = syncColumns(actor);
  const targetDate = (stmt(db, TARGET_DATE[a.targetType]).pluck().get(a.targetId) as string | undefined) ?? a.on;
  const allocatedOn = a.on > targetDate ? a.on : targetDate;
  stmt(db, `INSERT INTO allocation (id, business_id, party_type, party_id, source_type, source_id, target_type, target_id, amount_paise, allocated_at,
      allocated_on, created_at, updated_at, created_by, device_id)
    VALUES (@id, @businessId, @partyType, @partyId, @sourceType, @sourceId, @targetType, @targetId, @amountPaise, @t, @allocatedOn, @t, @t, @created_by, @device_id)`)
    .run({
      id, businessId: a.businessId, partyType: a.partyType, partyId: a.partyId, sourceType: a.sourceType, sourceId: a.sourceId, targetType: a.targetType,
      targetId: a.targetId, amountPaise: a.amountPaise, allocatedOn, ...s,
    });
  return { id, allocatedOn };
}

export interface AllocationRow { id: string; targetType: string; targetId: string; docNumber?: string; amountPaise: number; voided: boolean; allocatedOn: string }

// Allocations made from one settlement, with the number of the document each one settled.
export function allocationsOfSource(db: Db, sourceType: AllocationSource, sourceId: string): AllocationRow[] {
  const rows = stmt(db, `SELECT a.id, a.target_type, a.target_id, a.amount_paise, a.voided_at IS NOT NULL AS voided, a.allocated_on
      FROM allocation a WHERE a.source_type = ? AND a.source_id = ? ORDER BY a.rowid`).all(sourceType, sourceId) as {
    id: string; target_type: string; target_id: string; amount_paise: number; voided: number; allocated_on: string;
  }[];
  const numbers = docNumbers(db, rows.map((r) => ({ type: r.target_type, id: r.target_id })));
  return rows.map((r) => {
    const docNumber = numbers.get(`${r.target_type}:${r.target_id}`);
    return {
      id: r.id, targetType: r.target_type, targetId: r.target_id, amountPaise: r.amount_paise, voided: r.voided === 1, allocatedOn: r.allocated_on, ...(docNumber && { docNumber }),
    };
  });
}

// Voiding is the only change an allocation allows; the triggers give the amount back to both documents.
export function voidAllocation(db: Db, id: string, on: string, actor: Actor): void {
  stmt(db, `UPDATE allocation SET voided_at = @t, voided_on = @on, updated_at = @t, version = version + 1, sync_state = 'pending'
    WHERE id = @id AND voided_at IS NULL`).run({ id, on, t: syncColumns(actor).t });
}

export const liveAllocationsOnTarget = (db: Db, targetType: AllocationTarget, targetId: string): number =>
  stmt(db, 'SELECT COUNT(*) FROM allocation WHERE target_type = ? AND target_id = ? AND voided_at IS NULL').pluck().get(targetType, targetId) as number;
