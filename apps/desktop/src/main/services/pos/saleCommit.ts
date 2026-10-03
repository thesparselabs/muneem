import type { CompleteSaleInput, CustomerSnapshot, RegisterSession } from '@muneem/contracts';
import { financialYearOf, newUlid, type SettledTender } from '@muneem/domain';
import {
  allocateDocNumber, appendAudit, ensureDefaultWarehouse, findOrCreateSeries, getSale, getTerminal, insertPrintJob, insertSale, movementsForRef,
  partyBalance, planIssues, postMovement, postPartyEntry, recordChange, saleItemId, type Actor, type Db, type PartyEntry, type Till,
} from '@muneem/db-sqlite';
import { buildReceiptDoc } from '../print/receiptDoc.js';
import type { PricedSale } from './salePricing.js';

export interface SaleCommitInput {
  db: Db; actor: Actor; till: Till; session: RegisterSession; input: CompleteSaleInput; priced: PricedSale;
  tenders: SettledTender[]; paidPaise: number; changePaise: number; docDate: string; cashier: string; receiptFooter: string[];
  credit: SaleCredit | null;
}

// The part of the bill put on the customer's account (ADR-0026); `override` is set when a permitted user went past the limit.
export interface SaleCredit {
  amountPaise: number; dueDate: string;
  override?: { balancePaise: number; limitPaise: number | null; approvedBy: string };
}

export interface CommitState extends SaleCommitInput {
  saleId: string;
  printJobId: string;
  terminalCode: string;
  number?: { seriesId: string; seq: number; number: string };
  warehouseId?: string;
  costs?: { unitCostPaise: number; cogsPaise: number; qtyAfterMilli: number }[];
  partyEntry?: PartyEntry;
}

interface Step { name: string; run(s: CommitState): void }

function customerSnapshot(p: PricedSale): CustomerSnapshot {
  const c = p.customer;
  if (!c) return { walkIn: true };
  const address = [c.addressLine1, c.city, c.pinCode].filter(Boolean).join(', ');
  return {
    walkIn: false, name: c.name,
    ...(c.phone && { phone: c.phone }), ...(c.gstin && { gstin: c.gstin }), ...(c.stateCode && { stateCode: c.stateCode }),
    ...(address && { address }),
  };
}

const allocateNumber: Step = {
  name: 'number',
  run(s) {
    const prefix = getTerminal(s.db, s.till.terminalId)!.invoicePrefix;
    const seriesId = findOrCreateSeries(s.db, {
      businessId: s.till.businessId, branchId: s.till.branchId, terminalId: s.till.terminalId,
      docType: s.priced.quote.totals.docType, fy: financialYearOf(s.docDate),
    }, prefix, s.actor);
    s.number = { seriesId, ...allocateDocNumber(s.db, seriesId) };
  },
};

// ADR-0019: the cost is known before the append-only lines are written.
const costLines: Step = {
  name: 'cost',
  run(s) {
    s.warehouseId = ensureDefaultWarehouse(s.db, s.till.businessId, s.till.branchId, s.actor);
    s.costs = planIssues(s.db, s.till.businessId, s.warehouseId, s.priced.quote.lines.map((l) => ({ productId: l.productId, qtyMilli: l.baseQtyMilli })));
  },
};

const moveStock: Step = {
  name: 'stock',
  run(s) {
    s.priced.quote.lines.forEach((l, i) => {
      const [posted] = postMovement(s.db, {
        businessId: s.till.businessId, warehouseId: s.warehouseId!, productId: l.productId, type: 'sale', qtyMilli: -l.baseQtyMilli,
        refType: 'sale', refId: s.saleId, refLineId: saleItemId(s.saleId, l.lineNo),
      }, s.actor);
      if (posted!.unitCostPaise !== s.costs![i]!.unitCostPaise) throw new Error('STOCK_PROJECTION_DRIFT: issue cost changed inside the sale transaction');
    });
    const negative = s.priced.quote.lines.filter((_, i) => s.costs![i]!.qtyAfterMilli < 0);
    if (negative.length > 0) {
      appendAudit(s.db, {
        businessId: s.till.businessId, deviceId: s.actor.deviceId, userId: s.actor.userId, terminalId: s.actor.terminalId,
        action: 'stock.negative', entityType: 'sale', entityId: s.saleId,
        after: negative.map((l) => ({ productId: l.productId, qtyAfterMilli: s.costs![s.priced.quote.lines.indexOf(l)]!.qtyAfterMilli })),
      });
    }
  },
};

const insertDocument: Step = {
  name: 'document',
  run(s) {
    insertSale(s.db, {
      id: s.saleId, businessId: s.till.businessId, branchId: s.till.branchId, terminalId: s.till.terminalId, sessionId: s.session.id,
      commandId: s.input.commandId, seriesId: s.number!.seriesId, docNumber: s.number!.number, docSeq: s.number!.seq, docDate: s.docDate,
      fy: financialYearOf(s.docDate), taxScheme: s.priced.business.taxScheme, customerId: s.priced.customer?.id ?? null,
      customer: customerSnapshot(s.priced), placeOfSupplyReason: s.priced.placeOfSupplyReason, priceListId: s.priced.priceListId,
      totals: s.priced.quote.totals, paidPaise: s.paidPaise, changePaise: s.changePaise, creditPaise: s.credit?.amountPaise ?? 0,
      dueDate: s.credit?.dueDate ?? null, lines: s.priced.quote.lines,
      tenders: s.tenders.map((t, i) => ({ ...t, reference: s.input.tenders[i]?.reference })),
      lineCosts: s.costs!,
    }, s.actor);
  },
};

// ADR-0026: the credit portion goes on the customer's ledger inside the sale; a sale with no credit skips this step.
const postCredit: Step = {
  name: 'party',
  run(s) {
    if (!s.credit) return;
    const customerId = s.priced.customer!.id;
    s.partyEntry = postPartyEntry(s.db, {
      businessId: s.till.businessId, partyType: 'customer', partyId: customerId, refType: 'sale', refId: s.saleId, kind: 'post',
      amountPaise: s.credit.amountPaise, docDate: s.docDate, dueDate: s.credit.dueDate,
    }, s.actor);
    if (s.credit.override) {
      appendAudit(s.db, {
        businessId: s.till.businessId, deviceId: s.actor.deviceId, userId: s.actor.userId, terminalId: s.actor.terminalId,
        action: 'credit.limit_override', entityType: 'sale', entityId: s.saleId,
        after: { customerId, creditPaise: s.credit.amountPaise, ...s.credit.override },
      });
    }
  },
};

const queueReceipt: Step = {
  name: 'receipt',
  run(s) {
    const sale = getSale(s.db, s.saleId)!;
    const doc = buildReceiptDoc(sale, {
      business: s.priced.business, branch: s.priced.branch, terminalCode: s.terminalCode, cashier: s.cashier, footer: s.receiptFooter, copyNo: 1,
      ...(s.credit && {
        credit: {
          amountPaise: s.credit.amountPaise, dueDate: s.credit.dueDate,
          balancePaise: partyBalance(s.db, { businessId: s.till.businessId, partyType: 'customer', partyId: s.priced.customer!.id }),
        },
      }),
    });
    insertPrintJob(s.db, s.printJobId, {
      businessId: s.till.businessId, docType: 'sale', docId: s.saleId, doc, copyNo: 1, isDuplicate: false, createdBy: s.actor.userId,
      openDrawer: s.tenders.some((t) => t.method === 'cash'),
    });
  },
};

const recordSale: Step = {
  name: 'record',
  run(s) {
    const sale = getSale(s.db, s.saleId)!;
    const movements = movementsForRef(s.db, s.till.businessId, 'sale', s.saleId);
    recordChange(s.db, s.till.businessId, s.actor, {
      action: 'sale.complete', entityType: 'sale', entityId: s.saleId, operationType: 'create',
      after: { ...sale, movements, ...(s.partyEntry && { partyEntry: s.partyEntry }) },
    });
  },
};

// HLD §8 / ADR-0019 / ADR-0026: Stage 6 adds a 'journal' step after 'party'.
export const SALE_COMMIT_STEPS: readonly Step[] = [allocateNumber, costLines, insertDocument, moveStock, postCredit, queueReceipt, recordSale];

export function runSaleCommit(input: SaleCommitInput, steps: readonly Step[] = SALE_COMMIT_STEPS): CommitState {
  const terminal = getTerminal(input.db, input.till.terminalId)!;
  const state: CommitState = { ...input, saleId: newUlid(), printJobId: newUlid(), terminalCode: terminal.code };
  for (const step of steps) step.run(state);
  return state;
}
