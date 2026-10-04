import type { Payment } from '@muneem/contracts';
import { financialYearOf, type PartyType } from '@muneem/domain';
import { getTerminal } from '../../repositories/business.js';
import { insertPayment, markPaymentCancelled } from '../../repositories/payment.js';
import { insertWriteOff } from '../../repositories/writeOff.js';
import { stmt } from '../../statements.js';
import type { ApplyContext, Payload } from './context.js';
import { applyDrawerMovements, applyPartyEntry, statusIs, str, type DocumentApplier } from './documents.js';
import { applyJournal } from './journals.js';
import { exists, insertRow, updateRow } from './rows.js';

interface Source { partyType: PartyType; partyId: string; sourceType: 'payment' | 'debit_note' | 'credit_note' | 'write_off' | 'opening'; sourceId: string }
interface AllocationLine { id: string; targetType: string; targetId: string; amountPaise: number; allocatedOn?: string }

const TARGET_DATE: Record<string, string> = {
  sale: 'SELECT doc_date FROM sale WHERE id = ?', purchase: 'SELECT doc_date FROM purchase WHERE id = ?',
  expense: 'SELECT expense_date FROM expense WHERE id = ?', opening: 'SELECT as_of_date FROM party_opening WHERE id = ?',
};

// ADR-0025: allocations keep their ids and dates; the triggers move both documents' totals exactly as on the origin.
export function applyAllocations(ctx: ApplyContext, s: Source, lines: unknown, on?: string): void {
  if (!Array.isArray(lines)) return;
  for (const a of lines as AllocationLine[]) {
    if (exists(ctx.db, 'allocation', a.id)) continue;
    const targetDate = (stmt(ctx.db, TARGET_DATE[a.targetType] ?? TARGET_DATE.sale!).pluck().get(a.targetId) as string | undefined) ?? on ?? '';
    const allocatedOn = a.allocatedOn ?? ((on ?? '') > targetDate ? on! : targetDate);
    const at = new Date().toISOString();
    insertRow(ctx.db, 'allocation', {
      id: a.id, business_id: ctx.businessId, party_type: s.partyType, party_id: s.partyId, source_type: s.sourceType, source_id: s.sourceId,
      target_type: a.targetType, target_id: a.targetId, amount_paise: a.amountPaise, allocated_at: at, allocated_on: allocatedOn, created_at: at, updated_at: at,
      created_by: ctx.actor.userId, device_id: ctx.actor.deviceId, sync_state: 'synced',
    });
  }
}

function voidAllocations(ctx: ApplyContext, sourceType: string, sourceId: string, on: string): void {
  const at = new Date().toISOString();
  stmt(ctx.db, `UPDATE allocation SET voided_at = ?, voided_on = ?, updated_at = ?, version = version + 1
    WHERE business_id = ? AND source_type = ? AND source_id = ? AND voided_at IS NULL`).run(at, on, at, ctx.businessId, sourceType, sourceId);
}

function createPayment(ctx: ApplyContext, p: Payload): void {
  const id = ctx.change.entityId;
  const terminalId = str(p.terminalId);
  insertPayment(ctx.db, {
    id, businessId: ctx.businessId, branchId: str(p.branchId) ?? getTerminal(ctx.db, terminalId ?? '')!.branchId, terminalId: terminalId!,
    sessionId: str(p.sessionId), commandId: str(p.commandId) ?? id, partyType: p.partyType as PartyType, partyId: String(p.partyId), seriesId: String(p.seriesId),
    docNumber: String(p.docNumber), docSeq: Number(p.docSeq), paymentDate: String(p.paymentDate), fy: str(p.fy) ?? financialYearOf(String(p.paymentDate)),
    method: p.method as Payment['method'], amountPaise: Number(p.amountPaise), reference: str(p.reference), note: str(p.note),
    ...(str(p.createdAt) && { createdAt: String(p.createdAt) }),
  }, ctx.actor);
  applyPartyEntry(ctx, p.entry);
  applyAllocations(ctx, { partyType: p.partyType as PartyType, partyId: String(p.partyId), sourceType: 'payment', sourceId: id }, p.allocations, String(p.paymentDate));
  applyDrawerMovements(ctx, p.drawerMovements, 'payment', id);
  applyJournal(ctx, p.journal);
}

const cancelDate = (c: Payload): string => String((c.entry as Payload | null)?.docDate ?? (c.journal as Payload | null)?.docDate ?? new Date().toISOString().slice(0, 10));

function cancelPayment(ctx: ApplyContext, c: Payload): void {
  const id = ctx.change.entityId;
  voidAllocations(ctx, 'payment', id, cancelDate(c));
  markPaymentCancelled(ctx.db, id, String(c.reason ?? ''), ctx.actor);
  applyPartyEntry(ctx, c.entry);
  applyDrawerMovements(ctx, c.drawerMovements, 'payment', id);
  applyJournal(ctx, c.journal);
}

export const PAYMENT: DocumentApplier = { table: 'payment', create: createPayment, cancel: cancelPayment, cancelled: statusIs('payment', 'cancelled') };

function createWriteOff(ctx: ApplyContext, p: Payload): void {
  const id = ctx.change.entityId;
  insertWriteOff(ctx.db, {
    id, businessId: ctx.businessId, customerId: String(p.customerId), docDate: String(p.docDate), amountPaise: Number(p.amountPaise), reason: String(p.reason),
    commandId: str(p.commandId) ?? id,
  }, ctx.actor);
  applyAllocations(ctx, { partyType: 'customer', partyId: String(p.customerId), sourceType: 'write_off', sourceId: id }, p.allocations, String(p.docDate));
  applyPartyEntry(ctx, p.entry);
  applyJournal(ctx, p.journal);
}

export const WRITE_OFF: DocumentApplier = { table: 'write_off', create: createWriteOff };

const SOURCE_PARTY: Record<string, string> = {
  payment: 'SELECT party_type, party_id FROM payment WHERE id = ?', debit_note: "SELECT 'supplier' AS party_type, supplier_id AS party_id FROM debit_note WHERE id = ?",
  credit_note: "SELECT 'customer' AS party_type, customer_id AS party_id FROM credit_note WHERE id = ?",
  write_off: "SELECT 'customer' AS party_type, customer_id AS party_id FROM write_off WHERE id = ?", opening: 'SELECT party_type, party_id FROM party_opening WHERE id = ?',
};

// A later allocation of credit already on the account (payments.allocate): its lines, under the credit's party.
export function applyAllocationEntity(ctx: ApplyContext): void {
  const p = ctx.change.payload;
  const sourceType = String(p.creditType) as Source['sourceType'];
  const party = stmt(ctx.db, SOURCE_PARTY[sourceType] ?? SOURCE_PARTY.payment!).get(p.creditId) as { party_type: PartyType; party_id: string } | undefined;
  if (!party) return;
  applyAllocations(ctx, { partyType: party.party_type, partyId: party.party_id, sourceType, sourceId: String(p.creditId) }, p.allocations);
}

function createOpening(ctx: ApplyContext, p: Payload): void {
  const o = (p.opening ?? {}) as Payload;
  const at = new Date().toISOString();
  insertRow(ctx.db, 'party_opening', {
    id: ctx.change.entityId, business_id: ctx.businessId, party_type: o.partyType, party_id: o.partyId, side: o.side, amount_paise: o.amountPaise, as_of_date: o.asOfDate,
    created_at: at, updated_at: at, created_by: ctx.actor.userId, device_id: ctx.actor.deviceId, version: ctx.change.version, sync_state: 'synced',
  });
  applyPartyEntry(ctx, p.entry);
}

function cancelOpening(ctx: ApplyContext, c: Payload): void {
  const at = new Date().toISOString();
  updateRow(ctx.db, 'party_opening', ctx.change.entityId, { status: 'cancelled', cancelled_at: at, cancelled_by: ctx.actor.userId, updated_at: at });
  applyPartyEntry(ctx, c.entry);
}

export const PARTY_OPENING: DocumentApplier = { table: 'party_opening', create: createOpening, cancel: cancelOpening, cancelled: statusIs('party_opening', 'cancelled') };
