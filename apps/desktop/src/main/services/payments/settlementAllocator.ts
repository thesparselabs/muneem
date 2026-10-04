import { AppError, type AllocationChoice } from '@muneem/contracts';
import { allocateAsChosen, allocateOldestFirst, DomainError, type OpenItem, type PartyType } from '@muneem/domain';
import { insertAllocation, openItems, type AllocationSource, type AllocationTarget } from '@muneem/db-sqlite';
import type { PosContext } from '../pos/posContext.js';

export interface Party { partyType: PartyType; partyId: string }
// `on`: the settling document's date when allocated with it, else today (5h #5).
export interface Settlement { type: AllocationSource; id: string; openPaise: number; on: string }
export interface Applied { id: string; targetType: AllocationTarget; targetId: string; amountPaise: number; allocatedOn: string }

// Applies a settlement to the party's open charges, oldest due first or as chosen (ADR-0025); the rest stays unallocated.
export class SettlementAllocator {
  constructor(private readonly ctx: PosContext) {}

  apply(party: Party, source: Settlement, choice: AllocationChoice): Applied[] {
    const db = this.ctx.db();
    const businessId = this.ctx.businessId();
    const charges = openItems(db, { businessId, partyType: party.partyType, partyId: party.partyId }).filter((i) => i.role === 'charge');
    const types = new Map(charges.map((c) => [c.id, c.type as AllocationTarget]));
    const items: OpenItem[] = charges.map((c) => ({ id: c.id, dueDate: c.dueDate, docDate: c.docDate, outstandingPaise: c.openPaise }));
    let picked;
    try {
      if (choice === 'auto') picked = allocateOldestFirst(items, source.openPaise);
      else {
        const wrongType = choice.find((c) => types.has(c.id) && types.get(c.id) !== c.type);
        if (wrongType) throw new DomainError('INVALID_INPUT', `document ${wrongType.id} is not a ${wrongType.type}`);
        picked = allocateAsChosen(items, source.openPaise, choice.map((c) => ({ itemId: c.id, amountPaise: c.amountPaise })));
      }
    } catch (e) {
      if (e instanceof DomainError) throw new AppError('VALIDATION_FAILED', e.message, { allocation: e.message });
      throw e;
    }
    return picked.allocations.map((a) => {
      const targetType = types.get(a.itemId)!;
      const { id, allocatedOn } = insertAllocation(db, {
        businessId, partyType: party.partyType, partyId: party.partyId, sourceType: source.type, sourceId: source.id, targetType, targetId: a.itemId, amountPaise: a.amountPaise, on: source.on,
      }, this.ctx.actor());
      return { id, targetType, targetId: a.itemId, amountPaise: a.amountPaise, allocatedOn };
    });
  }
}
