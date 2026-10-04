import type { Branch, Business, RefundMethod } from '@muneem/contracts';
import { creditNoteBucket, docSeriesPrefix, financialYearOf, newUlid, type ReturnResult } from '@muneem/domain';
import {
  allocateDocNumber, allocationsOfSource, appendAudit, correctionMovementsFor, documentKeys, ensureDefaultWarehouse, findOrCreateSeries, getCreditNote, getTerminal,
  insertAllocation, insertCreditNote, insertPrintJob, movementsForRef, postCorrections, postDocumentJournal, postMovement, postPartyEntry, recordChange, stockState,
  type Actor, type Db, type PartyEntry, type PostedJournal, type Till,
} from '@muneem/db-sqlite';
import { buildCreditNoteDoc } from '../print/creditNoteDoc.js';
import type { ReturnPlan } from './returnPlanner.js';

export interface CreditNoteCommitInput {
  db: Db; actor: Actor; till: Till; sessionId: string | null; plan: ReturnPlan; result: ReturnResult;
  kind: 'return' | 'cancel'; reason: string; commandId: string; docDate: string;
  business: Business; branch: Branch; cashier: string; receiptFooter: string[];
}

export interface CreditNoteState extends CreditNoteCommitInput {
  id: string;
  printJobId: string;
  lineIds: string[];
  number?: { seriesId: string; seq: number; number: string };
  warehouseId?: string;
  entry?: PartyEntry;
  journal?: PostedJournal | null;
  corrections?: PostedJournal[];
}

interface Step { name: string; run(s: CreditNoteState): void }

const refundMethod = (s: CreditNoteState): RefundMethod => s.plan.refundMethod;

const allocateNumber: Step = {
  name: 'number',
  run(s) {
    const prefix = docSeriesPrefix(getTerminal(s.db, s.till.terminalId)!.invoicePrefix, 'credit_note');
    const seriesId = findOrCreateSeries(s.db, { ...s.till, docType: 'credit_note', fy: financialYearOf(s.docDate) }, prefix, s.actor, 5);
    s.number = { seriesId, ...allocateDocNumber(s.db, seriesId) };
  },
};

const insertDocument: Step = {
  name: 'document',
  run(s) {
    const { sale } = s.plan;
    const t = sale.totals;
    s.warehouseId = ensureDefaultWarehouse(s.db, s.till.businessId, s.till.branchId, s.actor);
    insertCreditNote(s.db, {
      id: s.id, businessId: s.till.businessId, branchId: s.till.branchId, terminalId: s.till.terminalId, sessionId: s.sessionId, warehouseId: s.warehouseId,
      saleId: sale.id, customerId: sale.customerId ?? null, seriesId: s.number!.seriesId, docNumber: s.number!.number, docSeq: s.number!.seq, docDate: s.docDate,
      fy: financialYearOf(s.docDate), kind: s.kind, reason: s.reason, supplyType: t.supplyType, stateTaxKind: t.stateTaxKind, placeOfSupplyState: t.placeOfSupplyState,
      gstr1Bucket: creditNoteBucket(s.business.taxScheme, sale.customer.gstin) as 'cdnr' | 'cdnur' | 'na',
      taxablePaise: s.result.taxablePaise, cgstPaise: s.result.cgstPaise, sgstPaise: s.result.sgstPaise, igstPaise: s.result.igstPaise, cessPaise: s.result.cessPaise,
      roundOffPaise: s.result.roundOffPaise, totalPaise: s.result.totalPaise, costPaise: s.result.costPaise, refundMethod: refundMethod(s),
      refundPaise: s.plan.refundPaise, creditPaise: s.plan.creditPaise, commandId: s.commandId,
      lines: s.plan.lines.map((l, i) => ({
        id: s.lineIds[i]!, saleItemId: l.item.id, productId: l.item.productId, qtyMilli: l.share.qtyMilli, baseQtyMilli: l.share.baseQtyMilli,
        returnedBeforeMilli: l.returnedBeforeMilli, taxablePaise: l.share.taxablePaise, cgstPaise: l.share.cgstPaise, sgstPaise: l.share.sgstPaise,
        igstPaise: l.share.igstPaise, cessPaise: l.share.cessPaise, totalPaise: l.share.totalPaise, costPaise: l.share.costPaise,
      })),
    }, s.actor);
  },
};

// The goods come back at what they cost when sold; a receipt that covers units sold short books its correction (ADR-0019).
const returnStock: Step = {
  name: 'stock',
  run(s) {
    s.plan.lines.forEach((l, i) => {
      postMovement(s.db, {
        businessId: s.till.businessId, warehouseId: s.warehouseId!, productId: l.item.productId, type: 'sale_return', qtyMilli: l.share.baseQtyMilli,
        receiptValuePaise: l.share.costPaise, refType: 'sale_return', refId: s.id, refLineId: s.lineIds[i]!,
      }, s.actor);
    });
    const negative = s.plan.lines.map((l) => ({ productId: l.item.productId, qtyAfterMilli: stockState(s.db, s.till.businessId, s.warehouseId!, l.item.productId).qtyMilli }))
      .filter((x) => x.qtyAfterMilli < 0);
    if (negative.length > 0) {
      appendAudit(s.db, {
        businessId: s.till.businessId, deviceId: s.actor.deviceId, userId: s.actor.userId, terminalId: s.actor.terminalId,
        action: 'stock.negative', entityType: 'credit_note', entityId: s.id, after: negative,
      });
    }
  },
};

// The part credited to the customer goes on their ledger and settles this bill first (ADR-0025).
const creditCustomer: Step = {
  name: 'party',
  run(s) {
    if (s.plan.creditPaise === 0) return;
    const customerId = s.plan.sale.customerId!;
    s.entry = postPartyEntry(s.db, {
      businessId: s.till.businessId, partyType: 'customer', partyId: customerId, refType: 'credit_note', refId: s.id, kind: 'post',
      amountPaise: -s.plan.creditPaise, docDate: s.docDate,
    }, s.actor);
    const settles = Math.min(s.plan.outstandingPaise, s.plan.creditPaise);
    if (settles > 0) {
      insertAllocation(s.db, {
        businessId: s.till.businessId, partyType: 'customer', partyId: customerId, sourceType: 'credit_note', sourceId: s.id, targetType: 'sale',
        targetId: s.plan.sale.id, amountPaise: settles, on: s.docDate,
      }, s.actor);
    }
  },
};

const postJournal: Step = {
  name: 'journal',
  run(s) {
    s.journal = postDocumentJournal(s.db, 'credit_note', s.id, s.till, s.actor);
    s.corrections = postCorrections(s.db, s.till.businessId, 'sale_return', s.id, s.till, s.actor);
  },
};

const queueReceipt: Step = {
  name: 'receipt',
  run(s) {
    const note = getCreditNote(s.db, s.id)!;
    const doc = buildCreditNoteDoc(note, s.plan.sale, {
      business: s.business, branch: s.branch, terminalCode: getTerminal(s.db, s.till.terminalId)!.code, cashier: s.cashier, footer: s.receiptFooter, copyNo: 1,
    });
    insertPrintJob(s.db, s.printJobId, {
      businessId: s.till.businessId, docType: 'credit_note', docId: s.id, doc, copyNo: 1, isDuplicate: false, createdBy: s.actor.userId,
      openDrawer: refundMethod(s) === 'cash' && s.plan.refundPaise > 0,
    });
  },
};

// Everything another device needs to file the note as this one did, with each line's sale snapshot for the cloud's check (ADR-0040).
const recordNote: Step = {
  name: 'record',
  run(s) {
    const note = getCreditNote(s.db, s.id)!;
    const sold = new Map(s.plan.items.map((i) => [i.id, i]));
    const businessId = s.till.businessId;
    recordChange(s.db, businessId, s.actor, {
      action: s.kind === 'cancel' ? 'sale.cancel' : 'credit_note.create', entityType: 'credit_note', entityId: s.id, operationType: 'create',
      after: {
        ...note, ...documentKeys(s.db, 'credit_note', s.id), customerId: note.customerId ?? null,
        lines: note.lines.map((l) => {
          const i = sold.get(l.saleItemId)!;
          return { ...l, sold: { qtyMilli: i.qtyMilli, baseQtyMilli: i.baseQtyMilli, taxablePaise: i.taxablePaise, cgstPaise: i.cgstPaise, sgstPaise: i.sgstPaise, igstPaise: i.igstPaise, cessPaise: i.cessPaise, cogsPaise: i.cogsPaise } };
        }),
        movements: movementsForRef(s.db, businessId, 'sale_return', s.id), entry: s.entry ?? null, allocations: allocationsOfSource(s.db, 'credit_note', s.id),
        journal: s.journal, corrections: s.corrections ?? [], correctionMovements: correctionMovementsFor(s.db, businessId, 'sale_return', s.id),
      },
    });
  },
};

// ADR-0043: one transaction, in the sale commit's order.
export const CREDIT_NOTE_STEPS: readonly Step[] = [allocateNumber, insertDocument, returnStock, creditCustomer, postJournal, queueReceipt, recordNote];

export function runCreditNoteCommit(input: CreditNoteCommitInput, steps: readonly Step[] = CREDIT_NOTE_STEPS): CreditNoteState {
  const state: CreditNoteState = { ...input, id: newUlid(), printJobId: newUlid(), lineIds: input.plan.lines.map(() => newUlid()) };
  for (const step of steps) step.run(state);
  return state;
}
