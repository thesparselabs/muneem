import type { RefundMethod } from '@muneem/contracts';
import { financialYearOf } from '@muneem/domain';
import { insertCreditNote, type CreditNoteLineRecord, type CreditNoteRecord } from '../../repositories/creditNote.js';
import { resolver } from './aliases.js';
import type { ApplyContext, Payload } from './context.js';
import { applyPartyEntry, str, type DocumentApplier } from './documents.js';
import { applyJournal } from './journals.js';
import { applyAllocations } from './settlements.js';
import { applyCorrections, applyMovements } from './stock.js';

const num = (v: unknown): number => Number(v ?? 0);

// ADR-0040: a pulled credit note keeps the origin's amounts, stock values, party entry, settlement and journal.
function createCreditNote(ctx: ApplyContext, p: Payload): void {
  const id = ctx.change.entityId;
  const customerId = str(p.customerId);
  insertCreditNote(ctx.db, {
    id, businessId: ctx.businessId, branchId: String(p.branchId), terminalId: String(p.terminalId), sessionId: str(p.sessionId),
    warehouseId: resolver(ctx.db, ctx.businessId)('warehouse', p.warehouseId)!, saleId: String(p.saleId), customerId, seriesId: String(p.seriesId),
    docNumber: String(p.docNumber), docSeq: num(p.docSeq), docDate: String(p.docDate), fy: str(p.fy) ?? financialYearOf(String(p.docDate)),
    kind: p.kind as CreditNoteRecord['kind'], reason: String(p.reason), supplyType: p.supplyType as CreditNoteRecord['supplyType'],
    stateTaxKind: (str(p.stateTaxKind) ?? 'sgst') as CreditNoteRecord['stateTaxKind'], placeOfSupplyState: String(p.placeOfSupplyState),
    gstr1Bucket: p.gstr1Bucket as CreditNoteRecord['gstr1Bucket'], taxablePaise: num(p.taxablePaise), cgstPaise: num(p.cgstPaise), sgstPaise: num(p.sgstPaise),
    igstPaise: num(p.igstPaise), cessPaise: num(p.cessPaise), roundOffPaise: num(p.roundOffPaise), totalPaise: num(p.totalPaise), costPaise: num(p.costPaise),
    refundMethod: p.refundMethod as RefundMethod, refundPaise: num(p.refundPaise), creditPaise: num(p.creditPaise), commandId: str(p.commandId) ?? id,
    lines: (p.lines ?? []) as CreditNoteLineRecord[], ...(str(p.createdAt) && { createdAt: String(p.createdAt) }),
  }, ctx.actor);
  applyMovements(ctx, p.movements);
  applyPartyEntry(ctx, p.entry);
  if (customerId) applyAllocations(ctx, { partyType: 'customer', partyId: customerId, sourceType: 'credit_note', sourceId: id }, p.allocations, String(p.docDate));
  applyJournal(ctx, p.journal);
  applyCorrections(ctx, p);
}

export const CREDIT_NOTE: DocumentApplier = { table: 'credit_note', create: createCreditNote };
