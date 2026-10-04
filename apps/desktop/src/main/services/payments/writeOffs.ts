import { AppError, type WriteOff, type WriteOffInput } from '@muneem/contracts';
import { newUlid } from '@muneem/domain';
import { documentKeys, getWriteOff, insertWriteOff, postDocumentJournal, postPartyEntry, recordChange, withTransaction, writeOffIdByCommand } from '@muneem/db-sqlite';
import type { PosContext } from '../pos/posContext.js';
import { requireParty } from './parties.js';
import type { SettlementAllocator } from './settlementAllocator.js';

// ADR-0025: a write-off clears chosen customer items at once; Stage 6 posts it to 5470 Bad Debts.
export class WriteOffService {
  constructor(private readonly ctx: PosContext, private readonly allocator: SettlementAllocator) {}

  create(input: WriteOffInput): WriteOff {
    const db = this.ctx.db();
    const businessId = this.ctx.businessId();
    const done = writeOffIdByCommand(db, businessId, input.commandId);
    if (done) return getWriteOff(db, done)!;
    requireParty(this.ctx, 'customer', input.customerId);
    const amountPaise = input.items.reduce((s, i) => s + i.amountPaise, 0);
    const id = withTransaction(db, () => {
      const again = writeOffIdByCommand(db, businessId, input.commandId);
      if (again) return again;
      const actor = this.ctx.actor();
      const docDate = this.ctx.today();
      const writeOffId = newUlid();
      insertWriteOff(db, { id: writeOffId, businessId, customerId: input.customerId, docDate, amountPaise, reason: input.reason, commandId: input.commandId }, actor);
      const party = { partyType: 'customer' as const, partyId: input.customerId };
      const allocations = this.allocator.apply(party, { type: 'write_off', id: writeOffId, openPaise: amountPaise, on: docDate }, input.items);
      if (allocations.reduce((s, a) => s + a.amountPaise, 0) !== amountPaise) throw new AppError('INVALID_STATE', 'The write-off must clear exactly the chosen amounts');
      const entry = postPartyEntry(db, { businessId, ...party, refType: 'write_off', refId: writeOffId, kind: 'post', amountPaise: -amountPaise, docDate }, actor);
      const journal = postDocumentJournal(db, 'write_off', writeOffId, this.ctx.till(), actor);
      recordChange(db, businessId, actor, {
        action: 'write_off.create', entityType: 'write_off', entityId: writeOffId, operationType: 'create', after: { ...getWriteOff(db, writeOffId), ...documentKeys(db, 'write_off', writeOffId), entry, allocations, journal },
      });
      return writeOffId;
    });
    return getWriteOff(db, id)!;
  }
}
