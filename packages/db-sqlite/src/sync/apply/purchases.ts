import type { PurchaseChargeInput, PurchaseQuoteLine, PurchaseTotals, SupplierSnapshot } from '@muneem/contracts';
import { financialYearOf } from '@muneem/domain';
import { insertDebitNote } from '../../repositories/debitNote.js';
import { insertPurchase, markPurchaseCancelled } from '../../repositories/purchase.js';
import { resolver } from './aliases.js';
import type { ApplyContext, Payload } from './context.js';
import { applyPartyEntry, statusIs, str, type DocumentApplier } from './documents.js';
import { applyJournal } from './journals.js';
import { applyAllocations } from './settlements.js';
import { applyCorrections, applyMovements } from './stock.js';

const num = (v: unknown): number => Number(v ?? 0);

function createPurchase(ctx: ApplyContext, p: Payload): void {
  const ref = resolver(ctx.db, ctx.businessId);
  const lines = (p.lines ?? []) as (PurchaseQuoteLine & { id: string })[];
  insertPurchase(ctx.db, {
    id: ctx.change.entityId, businessId: ctx.businessId, branchId: String(p.branchId), warehouseId: ref('warehouse', p.warehouseId)!, commandId: str(p.commandId) ?? ctx.change.entityId,
    supplierId: String(p.supplierId), supplier: p.supplier as SupplierSnapshot, supplierInvoiceNo: String(p.supplierInvoiceNo), supplierInvoiceDate: String(p.supplierInvoiceDate),
    seriesId: String(p.seriesId), docNumber: String(p.docNumber), docSeq: num(p.docSeq), docDate: String(p.docDate),
    fy: str(p.fy) ?? financialYearOf(String(p.supplierInvoiceDate)), placeOfSupplyState: String(p.placeOfSupplyState), isReverseCharge: p.isReverseCharge === true,
    dueDate: String(p.dueDate), note: str(p.note), totals: p.totals as PurchaseTotals, lines: lines.map((l) => ({ ...l, uomId: ref('uom', l.uomId)! })),
    charges: (p.charges ?? []) as PurchaseChargeInput[], ...(str(p.createdAt) && { createdAt: String(p.createdAt) }),
  }, ctx.actor);
  applyMovements(ctx, p.movements);
  applyPartyEntry(ctx, p.entry);
  applyJournal(ctx, p.journal);
  applyCorrections(ctx, p);
}

// ADR-0024: the goods go back at the values the origin stored, with its reversal and corrections.
function cancelPurchase(ctx: ApplyContext, c: Payload): void {
  markPurchaseCancelled(ctx.db, ctx.change.entityId, String(c.reason ?? ''), ctx.actor);
  applyMovements(ctx, c.movements);
  applyPartyEntry(ctx, c.entry);
  applyJournal(ctx, c.journal);
  applyCorrections(ctx, c);
}

export const PURCHASE: DocumentApplier = { table: 'purchase', create: createPurchase, cancel: cancelPurchase, cancelled: statusIs('purchase', 'cancelled') };

interface NoteLine { id: string; purchaseItemId: string; productId: string; qtyMilli: number; baseQtyMilli: number; taxablePaise: number; cgstPaise: number; sgstPaise: number; igstPaise: number; cessPaise: number; totalPaise: number; landedValuePaise: number }

function createDebitNote(ctx: ApplyContext, p: Payload): void {
  const ref = resolver(ctx.db, ctx.businessId);
  insertDebitNote(ctx.db, {
    id: ctx.change.entityId, businessId: ctx.businessId, branchId: String(p.branchId), warehouseId: ref('warehouse', p.warehouseId)!, purchaseId: String(p.purchaseId),
    supplierId: String(p.supplierId), seriesId: String(p.seriesId), docNumber: String(p.docNumber), docSeq: num(p.docSeq), docDate: String(p.docDate),
    fy: str(p.fy) ?? financialYearOf(String(p.docDate)), commandId: str(p.commandId) ?? ctx.change.entityId, reason: String(p.reason), supplyType: p.supplyType as 'intra' | 'inter',
    taxablePaise: num(p.taxablePaise), cgstPaise: num(p.cgstPaise), sgstPaise: num(p.sgstPaise), igstPaise: num(p.igstPaise), cessPaise: num(p.cessPaise),
    chargesPaise: num(p.chargesPaise), roundOffPaise: num(p.roundOffPaise), totalPaise: num(p.totalPaise), itcReversedPaise: num(p.itcReversedPaise),
    lines: (p.lines ?? []) as NoteLine[],
  }, ctx.actor);
  applyMovements(ctx, p.movements);
  applyPartyEntry(ctx, p.entry);
  applyAllocations(ctx, { partyType: 'supplier', partyId: String(p.supplierId), sourceType: 'debit_note', sourceId: ctx.change.entityId }, p.allocations);
  applyJournal(ctx, p.journal);
  applyCorrections(ctx, p);
}

export const DEBIT_NOTE: DocumentApplier = { table: 'debit_note', create: createDebitNote };
