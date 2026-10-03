import { newUlid, type PartyType } from '@muneem/domain';
import type { Db } from '../open.js';
import { stmt } from '../statements.js';
import type { Actor } from './business.js';
import { syncColumns } from './catalogWrite.js';
import { PARTY_DOCUMENTS_SQL } from './partyDocuments.js';

export type AllocationSource = 'payment' | 'debit_note' | 'write_off' | 'opening';
export type AllocationTarget = 'sale' | 'purchase' | 'expense' | 'opening';

export interface AllocationInput {
  businessId: string; partyType: PartyType; partyId: string;
  sourceType: AllocationSource; sourceId: string; targetType: AllocationTarget; targetId: string; amountPaise: number;
}

// The only writer of allocation; triggers keep both documents' totals and refuse over-allocation (ADR-0025).
export function insertAllocation(db: Db, a: AllocationInput, actor: Actor): string {
  const id = newUlid();
  const s = syncColumns(actor);
  stmt(db, `INSERT INTO allocation (id, business_id, party_type, party_id, source_type, source_id, target_type, target_id, amount_paise, allocated_at,
      created_at, updated_at, created_by, device_id)
    VALUES (@id, @businessId, @partyType, @partyId, @sourceType, @sourceId, @targetType, @targetId, @amountPaise, @t, @t, @t, @created_by, @device_id)`)
    .run({ id, ...a, ...s });
  return id;
}

export interface AllocationRow { id: string; targetType: string; targetId: string; docNumber?: string; amountPaise: number; voided: boolean }

// Allocations made from one settlement, with the number of the document each one settled.
export function allocationsOfSource(db: Db, sourceType: AllocationSource, sourceId: string): AllocationRow[] {
  return (stmt(db, `SELECT a.id, a.target_type, a.target_id, a.amount_paise, a.voided_at IS NOT NULL AS voided, d.doc_number
      FROM allocation a LEFT JOIN (${PARTY_DOCUMENTS_SQL}) d ON d.id = a.target_id AND d.type = a.target_type
      WHERE a.source_type = ? AND a.source_id = ? ORDER BY a.rowid`).all(sourceType, sourceId) as {
    id: string; target_type: string; target_id: string; amount_paise: number; voided: number; doc_number: string | null;
  }[]).map((r) => ({
    id: r.id, targetType: r.target_type, targetId: r.target_id, amountPaise: r.amount_paise, voided: r.voided === 1,
    ...(r.doc_number !== null && { docNumber: r.doc_number }),
  }));
}

// Voiding is the only change an allocation allows; the triggers give the amount back to both documents.
export function voidAllocation(db: Db, id: string, actor: Actor): void {
  stmt(db, 'UPDATE allocation SET voided_at = @t, updated_at = @t, version = version + 1, sync_state = \'pending\' WHERE id = @id AND voided_at IS NULL')
    .run({ id, t: syncColumns(actor).t });
}

export const liveAllocationsOnTarget = (db: Db, targetType: AllocationTarget, targetId: string): number =>
  stmt(db, 'SELECT COUNT(*) FROM allocation WHERE target_type = ? AND target_id = ? AND voided_at IS NULL').pluck().get(targetType, targetId) as number;
