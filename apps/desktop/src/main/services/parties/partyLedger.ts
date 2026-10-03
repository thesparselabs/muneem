import type { LedgerInput, LedgerPage, OpeningBalanceInput, Outstanding, OutstandingInput, PartyOpening } from '@muneem/contracts';
import type { PartyType } from '@muneem/domain';
import { partyOutstanding, partyStatement, setPartyOpening, usualSide } from '@muneem/db-sqlite';
import type { PosContext } from '../pos/posContext.js';

// Opening balances, statements and ageing for one kind of party; `requireParty` throws NOT_FOUND outside this business.
export class PartyLedgerService {
  constructor(private readonly ctx: PosContext, private readonly partyType: PartyType, private readonly requireParty: (id: string) => unknown) {}

  setOpening(input: OpeningBalanceInput): PartyOpening {
    this.requireParty(input.partyId);
    return setPartyOpening(this.ctx.db(), this.ctx.businessId(), this.partyType, input.partyId, {
      side: input.side ?? usualSide(this.partyType), amountPaise: input.amountPaise, asOfDate: input.asOfDate,
    }, this.ctx.actor());
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
