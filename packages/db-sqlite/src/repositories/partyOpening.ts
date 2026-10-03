import { AppError, type PartyOpening } from '@muneem/contracts';
import { newUlid, type PartyType } from '@muneem/domain';
import type { Db } from '../open.js';
import { stmt } from '../statements.js';
import { withTransaction } from '../uow.js';
import type { Actor } from './business.js';
import { recordChange, syncColumns } from './catalogWrite.js';
import { postPartyEntry } from './partyLedger.js';

type Side = PartyOpening['side'];
type OpeningRow = {
  id: string; party_type: PartyType; party_id: string; side: Side; amount_paise: number; as_of_date: string; allocated_paise: number; settled_paise: number;
};
const toOpening = (r: OpeningRow): PartyOpening => ({
  id: r.id, partyType: r.party_type, partyId: r.party_id, side: r.side, amountPaise: r.amount_paise, asOfDate: r.as_of_date,
  allocatedPaise: r.allocated_paise, settledPaise: r.settled_paise,
});

// The side a party usually owes on: customers owe the business, the business owes suppliers.
export const usualSide = (t: PartyType): Side => (t === 'customer' ? 'receivable' : 'payable');
const signedAmount = (side: Side, amountPaise: number): number => (side === 'receivable' ? amountPaise : -amountPaise);

export function liveOpening(db: Db, businessId: string, partyType: PartyType, partyId: string): PartyOpening | null {
  const r = stmt(db, `SELECT * FROM party_opening WHERE business_id = ? AND party_type = ? AND party_id = ? AND status = 'posted'`)
    .get(businessId, partyType, partyId) as OpeningRow | undefined;
  return r ? toOpening(r) : null;
}

function cancelOpening(db: Db, businessId: string, old: PartyOpening, actor: Actor): void {
  if (old.allocatedPaise > 0 || old.settledPaise > 0) {
    throw new AppError('INVALID_STATE', 'Payments are allocated to the current opening balance; cancel or re-allocate them first');
  }
  const s = syncColumns(actor);
  stmt(db, `UPDATE party_opening SET status = 'cancelled', cancelled_at = @t, cancelled_by = @by, updated_at = @t, version = version + 1,
      sync_state = 'pending' WHERE id = @id`).run({ id: old.id, t: s.t, by: actor.userId });
  const entry = postPartyEntry(db, {
    businessId, partyType: old.partyType, partyId: old.partyId, refType: 'opening', refId: old.id, kind: 'cancel',
    amountPaise: -signedAmount(old.side, old.amountPaise), docDate: old.asOfDate, dueDate: old.asOfDate,
  }, actor);
  recordChange(db, businessId, actor, { action: 'party_opening.cancel', entityType: 'party_opening', entityId: old.id, operationType: 'cancel', before: old, after: { entry } });
}

// One live opening per party; entering a new one replaces the old in the same transaction (5b details, ADR-0022).
export function setPartyOpening(
  db: Db, businessId: string, partyType: PartyType, partyId: string, o: { side: Side; amountPaise: number; asOfDate: string }, actor: Actor,
): PartyOpening {
  return withTransaction(db, () => {
    const old = liveOpening(db, businessId, partyType, partyId);
    if (old) cancelOpening(db, businessId, old, actor);
    const id = newUlid();
    const s = syncColumns(actor);
    stmt(db, `INSERT INTO party_opening (id, business_id, party_type, party_id, side, amount_paise, as_of_date, created_at, updated_at, created_by, device_id)
      VALUES (@id, @businessId, @partyType, @partyId, @side, @amountPaise, @asOfDate, @t, @t, @created_by, @device_id)`)
      .run({ id, businessId, partyType, partyId, ...o, ...s });
    const entry = postPartyEntry(db, {
      businessId, partyType, partyId, refType: 'opening', refId: id, kind: 'post', amountPaise: signedAmount(o.side, o.amountPaise),
      docDate: o.asOfDate, dueDate: o.asOfDate,
    }, actor);
    const opening = liveOpening(db, businessId, partyType, partyId)!;
    recordChange(db, businessId, actor, { action: 'party_opening.create', entityType: 'party_opening', entityId: id, operationType: 'create', after: { opening, entry } });
    return opening;
  });
}
