import type { LedgerInput, LedgerPage, OpeningBalanceInput, Outstanding, OutstandingInput, PartyOpening } from '@muneem/contracts';
import type { PartyType } from '@muneem/domain';
import {
  liveOpening, partyOutstanding, partyStatement, postDocumentJournal, queueJournal, reverseDocumentJournal, setPartyOpening, usualSide, withTransaction,
} from '@muneem/db-sqlite';
import type { PosContext } from '../pos/posContext.js';

// Opening balances, statements and ageing for one kind of party; `requireParty` throws NOT_FOUND outside this business.
export class PartyLedgerService {
  constructor(private readonly ctx: PosContext, private readonly partyType: PartyType, private readonly requireParty: (id: string) => unknown) {}

  setOpening(input: OpeningBalanceInput): PartyOpening {
    this.requireParty(input.partyId);
    const db = this.ctx.db();
    const businessId = this.ctx.businessId();
    const actor = this.ctx.actor();
    return withTransaction(db, () => {
      const old = liveOpening(db, businessId, this.partyType, input.partyId);
      const opening = setPartyOpening(db, businessId, this.partyType, input.partyId, {
        side: input.side ?? usualSide(this.partyType), amountPaise: input.amountPaise, asOfDate: input.asOfDate,
      }, actor);
      if (old) queueJournal(db, businessId, actor, reverseDocumentJournal(db, 'party_opening', old.id, this.ctx.today(), actor), { entityType: 'party_opening', entityId: old.id });
      queueJournal(db, businessId, actor, postDocumentJournal(db, 'party_opening', opening.id, this.ctx.till(), actor), { entityType: 'party_opening', entityId: opening.id });
      return opening;
    });
  }

  ledger(input: LedgerInput): LedgerPage {
    this.requireParty(input.partyId);
    return partyStatement(this.ctx.db(), { businessId: this.ctx.businessId(), partyType: this.partyType, partyId: input.partyId }, input);
  }

  outstanding(input: OutstandingInput): Outstanding {
    if (input.partyId) this.requireParty(input.partyId);
    const today = this.ctx.today();
    return partyOutstanding(this.ctx.db(), this.ctx.businessId(), this.partyType, input.asOf ?? today, input.partyId, today);
  }
}
