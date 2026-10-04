import { AppError, type DebitNote, type Purchase, type ReturnPurchaseInput } from '@muneem/contracts';
import { cumulativeShare, docSeriesPrefix, financialYearOf, newUlid } from '@muneem/domain';
import {
  allocateDocNumber, appendAudit, debitNoteCount, debitNoteIdByCommand, findOrCreateSeries, getDebitNote, getProduct, getPurchase, getTerminal,
  insertAllocation, insertDebitNote, markPurchaseCancelled, movementsForRef, postCorrections, postDocumentJournal, postMovement, postPartyEntry, recordChange,
  returnedQtyByItem, reverseDocumentJournal,
  stockState, withTransaction, type StoredPurchase,
} from '@muneem/db-sqlite';
import { negativeStockRule } from '../inventory/negativeStock.js';
import type { PosContext } from '../pos/posContext.js';

interface Outgoing { productId: string; baseQtyMilli: number; landedValuePaise: number; refLineId: string }

const SHARED = ['taxablePaise', 'cgstPaise', 'sgstPaise', 'igstPaise', 'cessPaise', 'landedValuePaise', 'chargesPaise', 'baseQtyMilli'] as const;

// Debit notes and cancellation (ADR-0024): goods go back at what they were bought for.
export class PurchaseReturnService {
  constructor(private readonly ctx: PosContext) {}

  returnGoods(input: ReturnPurchaseInput): DebitNote {
    const db = this.ctx.db();
    const done = debitNoteIdByCommand(db, this.ctx.businessId(), input.commandId);
    if (done) return this.note(done);
    const id = withTransaction(db, () => debitNoteIdByCommand(db, this.ctx.businessId(), input.commandId) ?? this.writeNote(input));
    return this.note(id);
  }

  cancel(id: string, reason: string): Purchase {
    const db = this.ctx.db();
    withTransaction(db, () => {
      const p = this.purchase(id);
      if (p.status !== 'posted') throw new AppError('INVALID_STATE', `${p.docNumber} is already cancelled`);
      if (p.settledPaise > 0) throw new AppError('INVALID_STATE', `${p.docNumber} has payments allocated to it; cancel or re-allocate them first`);
      if (debitNoteCount(db, id) > 0) throw new AppError('INVALID_STATE', `${p.docNumber} has goods returned on a debit note; it cannot be cancelled`);
      const outgoing = p.lines.map((l) => ({ productId: l.productId, baseQtyMilli: l.baseQtyMilli, landedValuePaise: l.landedValuePaise, refLineId: l.id }));
      this.guardStock(p.warehouseId, outgoing);
      const actor = this.ctx.actor();
      markPurchaseCancelled(db, id, reason, actor);
      this.moveOut(p, outgoing, p.id, 'purchase');
      const entry = postPartyEntry(db, {
        businessId: p.businessId, partyType: 'supplier', partyId: p.supplierId, refType: 'purchase', refId: id, kind: 'cancel',
        amountPaise: p.totals.totalPaise, docDate: this.ctx.today(), dueDate: p.dueDate,
      }, actor);
      const journal = reverseDocumentJournal(db, 'purchase', id, this.ctx.today(), actor);
      const corrections = postCorrections(db, p.businessId, 'purchase_return', id, this.ctx.tillIfAny(), actor);
      recordChange(db, p.businessId, actor, {
        action: 'purchase.cancel', entityType: 'purchase', entityId: id, operationType: 'cancel',
        after: { id, status: 'cancelled', reason, movements: movementsForRef(db, p.businessId, 'purchase_return', id), entry, journal, corrections },
      });
    });
    return this.purchase(id);
  }

  private writeNote(input: ReturnPurchaseInput): string {
    const db = this.ctx.db();
    const p = this.purchase(input.purchaseId);
    if (p.status !== 'posted') throw new AppError('INVALID_STATE', `${p.docNumber} is cancelled`);
    const returned = returnedQtyByItem(db, p.id);
    const fields: Record<string, string> = {};
    const seen = new Set<string>();
    let exceeded = false;
    const lines = input.lines.flatMap((r, i) => {
      const item = p.lines.find((l) => l.id === r.purchaseItemId);
      if (!item) { fields[`lines.${i}.purchaseItemId`] = 'not a line of this purchase'; return []; }
      if (seen.has(item.id)) { fields[`lines.${i}.purchaseItemId`] = `${item.name} is listed twice`; return []; }
      seen.add(item.id);
      const before = returned.get(item.id)?.qtyMilli ?? 0;
      if (before + r.qtyMilli > item.qtyMilli) {
        fields[`lines.${i}.qtyMilli`] = `only ${(item.qtyMilli - before) / 1000} ${item.uomCode} of ${item.name} is left to return`;
        exceeded = true;
        return [];
      }
      const share = Object.fromEntries(SHARED.map((k) => [k, cumulativeShare(item[k], item.qtyMilli, before, r.qtyMilli)])) as Record<(typeof SHARED)[number], number>;
      if (share.baseQtyMilli <= 0) { fields[`lines.${i}.qtyMilli`] = `too small to return of ${item.name}`; return []; }
      const tax = share.cgstPaise + share.sgstPaise + share.igstPaise + share.cessPaise;
      return [{ item, qtyMilli: r.qtyMilli, share, tax, itc: item.itcEligible ? tax : 0 }];
    });
    if (Object.keys(fields).length > 0) throw new AppError(exceeded ? 'RETURN_QTY_EXCEEDED' : 'VALIDATION_FAILED', 'These goods cannot be returned', fields);

    const outgoing = lines.map((l) => ({ productId: l.item.productId, baseQtyMilli: l.share.baseQtyMilli, landedValuePaise: l.share.landedValuePaise, refLineId: newUlid() }));
    this.guardStock(p.warehouseId, outgoing);
    const sum = (f: (l: (typeof lines)[number]) => number) => lines.reduce((s, l) => s + f(l), 0);
    const chargesPaise = input.refundCharges ? sum((l) => l.share.chargesPaise) : 0;
    // The note that completes the return of every line also takes back the bill's round-off, so nothing is left owed.
    const thisNote = new Map(lines.map((l) => [l.item.id, l.qtyMilli]));
    const completes = p.lines.every((l) => (returned.get(l.id)?.qtyMilli ?? 0) + (thisNote.get(l.id) ?? 0) === l.qtyMilli);
    const roundOffPaise = completes ? p.totals.roundOffPaise : 0;
    const totalPaise = sum((l) => l.share.taxablePaise + l.tax) + chargesPaise + roundOffPaise;
    if (totalPaise <= 0) throw new AppError('VALIDATION_FAILED', 'Nothing of value is being returned', { lines: 'the returned goods are worth ₹0' });

    const actor = this.ctx.actor();
    const till = this.ctx.till();
    const docDate = this.ctx.today();
    const fy = financialYearOf(docDate);
    const prefix = docSeriesPrefix(getTerminal(db, till.terminalId)!.invoicePrefix, 'debit_note');
    const seriesId = findOrCreateSeries(db, { ...till, docType: 'debit_note', fy }, prefix, actor, 5);
    const number = allocateDocNumber(db, seriesId);
    const id = newUlid();
    insertDebitNote(db, {
      id, businessId: p.businessId, branchId: p.branchId, warehouseId: p.warehouseId, purchaseId: p.id, supplierId: p.supplierId, seriesId,
      docNumber: number.number, docSeq: number.seq, docDate, fy, commandId: input.commandId, reason: input.reason, supplyType: p.totals.supplyType,
      taxablePaise: sum((l) => l.share.taxablePaise), cgstPaise: sum((l) => l.share.cgstPaise), sgstPaise: sum((l) => l.share.sgstPaise),
      igstPaise: sum((l) => l.share.igstPaise), cessPaise: sum((l) => l.share.cessPaise), chargesPaise, roundOffPaise, totalPaise, itcReversedPaise: sum((l) => l.itc),
      lines: lines.map((l, i) => ({
        id: outgoing[i]!.refLineId, purchaseItemId: l.item.id, productId: l.item.productId, qtyMilli: l.qtyMilli, baseQtyMilli: l.share.baseQtyMilli,
        taxablePaise: l.share.taxablePaise, cgstPaise: l.share.cgstPaise, sgstPaise: l.share.sgstPaise, igstPaise: l.share.igstPaise,
        cessPaise: l.share.cessPaise, totalPaise: l.share.taxablePaise + l.tax, landedValuePaise: l.share.landedValuePaise,
      })),
    }, actor);
    this.moveOut(p, outgoing, id, 'debit_note');
    const entry = postPartyEntry(db, {
      businessId: p.businessId, partyType: 'supplier', partyId: p.supplierId, refType: 'debit_note', refId: id, kind: 'post',
      amountPaise: totalPaise, docDate,
    }, actor);
    const owed = p.totals.totalPaise - p.settledPaise;
    const allocated = Math.min(owed, totalPaise);
    if (allocated > 0) {
      insertAllocation(db, {
        businessId: p.businessId, partyType: 'supplier', partyId: p.supplierId, sourceType: 'debit_note', sourceId: id,
        targetType: 'purchase', targetId: p.id, amountPaise: allocated, on: docDate,
      }, actor);
    }
    const journal = postDocumentJournal(db, 'debit_note', id, till, actor);
    const corrections = postCorrections(db, p.businessId, 'purchase_return', id, till, actor);
    recordChange(db, p.businessId, actor, {
      action: 'debit_note.create', entityType: 'debit_note', entityId: id, operationType: 'create',
      after: { ...getDebitNote(db, id), movements: movementsForRef(db, p.businessId, 'purchase_return', id), entry, journal, corrections },
    });
    return id;
  }

  // ADR-0020 applies to goods going back too: 'block' refuses, otherwise a below-zero result is audited.
  private guardStock(warehouseId: string, outgoing: readonly Outgoing[]): void {
    const db = this.ctx.db();
    const businessId = this.ctx.businessId();
    const left = new Map<string, number>();
    const blocked: string[] = [];
    for (const o of outgoing) {
      const after = (left.get(o.productId) ?? stockState(db, businessId, warehouseId, o.productId).qtyMilli) - o.baseQtyMilli;
      left.set(o.productId, after);
      const product = getProduct(db, o.productId, this.ctx.today())!;
      if (after < 0 && negativeStockRule(this.ctx, product) === 'block') blocked.push(product.name);
    }
    if (blocked.length > 0) throw new AppError('STOCK_INSUFFICIENT', `Not enough stock to send back: ${[...new Set(blocked)].join(', ')}`);
  }

  private moveOut(p: StoredPurchase, outgoing: readonly Outgoing[], refId: string, entityType: 'purchase' | 'debit_note'): void {
    const db = this.ctx.db();
    const actor = this.ctx.actor();
    const negative: { productId: string; qtyAfterMilli: number }[] = [];
    for (const o of outgoing) {
      postMovement(db, {
        businessId: p.businessId, warehouseId: p.warehouseId, productId: o.productId, type: 'purchase_return', qtyMilli: -o.baseQtyMilli,
        returnValuePaise: o.landedValuePaise, refType: 'purchase_return', refId, refLineId: o.refLineId,
      }, actor);
      const after = stockState(db, p.businessId, p.warehouseId, o.productId).qtyMilli;
      if (after < 0) negative.push({ productId: o.productId, qtyAfterMilli: after });
    }
    if (negative.length > 0) {
      appendAudit(db, {
        businessId: p.businessId, deviceId: actor.deviceId, userId: actor.userId, terminalId: actor.terminalId,
        action: 'stock.negative', entityType, entityId: refId, after: negative,
      });
    }
  }

  private purchase(id: string): StoredPurchase {
    const p = getPurchase(this.ctx.db(), id);
    if (!p || p.businessId !== this.ctx.businessId()) throw new AppError('NOT_FOUND', 'Purchase not found');
    return p;
  }

  private note(id: string): DebitNote {
    return getDebitNote(this.ctx.db(), id)!;
  }
}
