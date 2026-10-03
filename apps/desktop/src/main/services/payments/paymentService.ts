import { AppError, type AllocateInput, type AllocateResult, type OpenItems, type Payment, type PaymentInput, type PaymentListInput, type PaymentPage } from '@muneem/contracts';
import { docSeriesPrefix, financialYearOf, newUlid, type PartyType } from '@muneem/domain';
import {
  allocateDocNumber, allocationsOfSource, appendAudit, documentCashMovements, findOrCreateSeries, getPayment, getTerminal, insertPayment, listPayments,
  markPaymentCancelled, openItems, paymentIdByCommand, postPartyEntry, recordChange, voidAllocation, withTransaction, type AllocationSource,
} from '@muneem/db-sqlite';
import type { PosContext } from '../pos/posContext.js';
import type { Drawer } from './drawer.js';
import { requireParty } from './parties.js';
import type { SettlementAllocator } from './settlementAllocator.js';

// A customer's payment lowers what they owe; a payment to a supplier lowers what the business owes (ADR-0022 signs).
const paymentEntry = (partyType: PartyType, amountPaise: number): number => (partyType === 'customer' ? -amountPaise : amountPaise);

export class PaymentService {
  constructor(private readonly ctx: PosContext, private readonly allocator: SettlementAllocator, private readonly drawer: Drawer) {}

  create(input: PaymentInput): Payment {
    const db = this.ctx.db();
    const done = paymentIdByCommand(db, this.ctx.businessId(), input.commandId);
    if (done) return this.get(done);
    const party = requireParty(this.ctx, input.partyType, input.partyId);
    const paymentDate = input.paymentDate ?? this.ctx.today();
    if (paymentDate > this.ctx.today()) throw new AppError('VALIDATION_FAILED', 'A payment cannot be dated in the future', { paymentDate: 'after today' });
    const id = withTransaction(db, () => paymentIdByCommand(db, this.ctx.businessId(), input.commandId) ?? this.write(input, paymentDate, party.name));
    return this.get(id);
  }

  get(id: string): Payment {
    const p = getPayment(this.ctx.db(), id);
    if (!p || p.businessId !== this.ctx.businessId()) throw new Error('NOT_FOUND');
    return p;
  }

  list(f: PaymentListInput): PaymentPage { return listPayments(this.ctx.db(), this.ctx.businessId(), f); }

  openItems(partyType: PartyType, partyId: string): OpenItems {
    requireParty(this.ctx, partyType, partyId);
    const rows = openItems(this.ctx.db(), { businessId: this.ctx.businessId(), partyType, partyId });
    const item = (r: (typeof rows)[number]) => ({
      type: r.type, id: r.id, docDate: r.docDate, dueDate: r.dueDate, amountPaise: r.amountPaise, openPaise: r.openPaise,
      ...(r.docNumber !== null && { docNumber: r.docNumber }),
    });
    return { charges: rows.filter((r) => r.role === 'charge').map(item), credits: rows.filter((r) => r.role === 'settlement').map(item) };
  }

  // Applies credit already on the party's account (an advance, a debit note's excess, an opening advance) to open charges.
  allocate(input: AllocateInput): AllocateResult {
    requireParty(this.ctx, input.partyType, input.partyId);
    const db = this.ctx.db();
    return withTransaction(db, () => {
      const credit = openItems(db, { businessId: this.ctx.businessId(), partyType: input.partyType, partyId: input.partyId })
        .find((r) => r.role === 'settlement' && r.type === input.creditType && r.id === input.creditId);
      if (!credit) throw new AppError('INVALID_STATE', 'This credit has nothing left to allocate');
      const applied = this.allocator.apply(input, { type: input.creditType as AllocationSource, id: credit.id, openPaise: credit.openPaise, on: this.ctx.today() }, input.allocation);
      if (applied.length === 0) throw new AppError('INVALID_STATE', 'Nothing is open to allocate this credit to');
      recordChange(db, this.ctx.businessId(), this.ctx.actor(), {
        action: 'allocation.create', entityType: 'allocation', entityId: applied[0]!.id, operationType: 'create',
        after: { creditType: input.creditType, creditId: credit.id, allocations: applied },
      });
      const allocated = applied.reduce((s, a) => s + a.amountPaise, 0);
      const lines = allocationsOfSource(db, input.creditType as AllocationSource, credit.id).filter((a) => applied.some((x) => x.id === a.id));
      return { allocatedPaise: allocated, unallocatedPaise: credit.openPaise - allocated, allocations: lines };
    });
  }

  cancel(id: string, reason: string): Payment {
    const db = this.ctx.db();
    withTransaction(db, () => {
      const p = this.get(id);
      if (p.status !== 'posted') throw new AppError('INVALID_STATE', `${p.docNumber} is already cancelled`);
      requireParty(this.ctx, p.partyType, p.partyId);
      const actor = this.ctx.actor();
      for (const a of p.allocations.filter((x) => !x.voided)) voidAllocation(db, a.id, this.ctx.today(), actor);
      markPaymentCancelled(db, id, reason, actor);
      const entry = postPartyEntry(db, {
        businessId: this.ctx.businessId(), partyType: p.partyType, partyId: p.partyId, refType: 'payment', refId: id, kind: 'cancel',
        amountPaise: -paymentEntry(p.partyType, p.amountPaise), docDate: this.ctx.today(),
      }, actor);
      const drawer = p.method === 'cash'
        ? this.drawer.reverse(documentCashMovements(db, 'payment', id)[0], { reason: `Cancelled ${p.docNumber}`, refType: 'payment', refId: id })
        : 'not_cash';
      if (drawer === 'outside_drawer') {
        appendAudit(db, {
          businessId: this.ctx.businessId(), deviceId: actor.deviceId, userId: actor.userId, terminalId: actor.terminalId,
          action: 'payment.cancel_cash_outside_drawer', entityType: 'payment', entityId: id, after: { amountPaise: p.amountPaise },
        });
      }
      recordChange(db, this.ctx.businessId(), actor, {
        action: 'payment.cancel', entityType: 'payment', entityId: id, operationType: 'cancel', after: { id, status: 'cancelled', reason, entry, drawer },
      });
    });
    return this.get(id);
  }

  private write(input: PaymentInput, paymentDate: string, partyName: string): string {
    const db = this.ctx.db();
    const till = this.ctx.till();
    const actor = this.ctx.actor();
    const kind = input.partyType === 'customer' ? 'receipt' : 'payment';
    const fy = financialYearOf(paymentDate);
    const prefix = docSeriesPrefix(getTerminal(db, till.terminalId)!.invoicePrefix, kind);
    const seriesId = findOrCreateSeries(db, { ...till, docType: kind, fy }, prefix, actor, 5);
    const number = allocateDocNumber(db, seriesId);
    const sessionId = input.method === 'cash' ? this.drawer.openSessionId() : null;
    const id = newUlid();
    insertPayment(db, {
      id, businessId: till.businessId, branchId: till.branchId, terminalId: till.terminalId, sessionId, commandId: input.commandId,
      partyType: input.partyType, partyId: input.partyId, seriesId, docNumber: number.number, docSeq: number.seq, paymentDate, fy,
      method: input.method, amountPaise: input.amountPaise, reference: input.reference ?? null, note: input.note ?? null,
    }, actor);
    const entry = postPartyEntry(db, {
      businessId: till.businessId, partyType: input.partyType, partyId: input.partyId, refType: 'payment', refId: id, kind: 'post',
      amountPaise: paymentEntry(input.partyType, input.amountPaise), docDate: paymentDate,
    }, actor);
    const allocations = this.allocator.apply(input, { type: 'payment', id, openPaise: input.amountPaise, on: paymentDate }, input.allocation);
    this.drawer.record(sessionId, {
      kind: input.partyType === 'customer' ? 'cash_in' : 'cash_out', amountPaise: input.amountPaise,
      reason: `${number.number} ${partyName}`, refType: 'payment', refId: id,
    });
    recordChange(db, till.businessId, actor, {
      action: 'payment.create', entityType: 'payment', entityId: id, operationType: 'create', after: { ...getPayment(db, id), entry, allocations },
    });
    return id;
  }
}
