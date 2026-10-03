import { newUlid, type PartyType } from '@muneem/domain';
import type { Db } from '../open.js';
import { stmt } from '../statements.js';
import type { Actor } from './business.js';
import { syncColumns } from './catalogWrite.js';

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
