import { AppError, type CreatePurchaseInput, type Purchase, type PurchaseDraft, type PurchaseListInput, type PurchasePage, type PurchaseQuote } from '@muneem/contracts';
import { docSeriesPrefix, financialYearOf, formatRupees as rupees, newUlid } from '@muneem/domain';
import {
  allocateDocNumber, ensureDefaultWarehouse, findOrCreateSeries, getPurchase, getTerminal, insertPurchase, listPurchases, movementsForRef,
  postedPurchaseByInvoice, postMovement, postPartyEntry, purchaseIdByCommand, recordChange, withTransaction,
} from '@muneem/db-sqlite';
import type { PosContext } from '../pos/posContext.js';
import type { PricedPurchase, PurchasePricing } from './purchasePricing.js';

export class PurchaseService {
  constructor(private readonly ctx: PosContext, private readonly pricing: PurchasePricing) {}

  quote(draft: PurchaseDraft): PurchaseQuote { return this.pricing.price(draft).quote; }

  create(input: CreatePurchaseInput): Purchase {
    const replay = purchaseIdByCommand(this.ctx.db(), this.ctx.businessId(), input.commandId);
    if (replay) return this.get(replay);
    const priced = this.pricing.price(input);
    this.validate(input, priced);
    const db = this.ctx.db();
    const id = withTransaction(db, () => {
      const again = purchaseIdByCommand(db, this.ctx.businessId(), input.commandId);
      return again ?? this.write(input, priced);
    });
    return this.get(id);
  }

  get(id: string): Purchase {
    const p = getPurchase(this.ctx.db(), id);
    if (!p || p.businessId !== this.ctx.businessId()) throw new Error('NOT_FOUND');
    return p;
  }

  list(f: PurchaseListInput): PurchasePage { return listPurchases(this.ctx.db(), this.ctx.businessId(), f); }

  private validate(input: CreatePurchaseInput, priced: PricedPurchase): void {
    const fields: Record<string, string> = Object.fromEntries(priced.quote.issues.map((i) => [`lines.${i.lineNo - 1}`, i.message]));
    const today = this.ctx.today();
    if (input.supplierInvoiceDate > today) fields.supplierInvoiceDate = 'the bill date cannot be after today';
    // Reverse charge keeps the tax out of the bill and the supplier's balance; that needs Stage 6, so it is refused for now.
    if (input.isReverseCharge) fields.isReverseCharge = 'reverse-charge purchases are not supported yet';
    if (input.dueDate && input.dueDate < input.supplierInvoiceDate) fields.dueDate = 'the due date cannot be before the bill date';
    const existing = postedPurchaseByInvoice(this.ctx.db(), this.ctx.businessId(), input.supplierId, financialYearOf(input.supplierInvoiceDate), input.supplierInvoiceNo);
    if (existing) fields.supplierInvoiceNo = `already recorded as ${existing.docNumber}`;
    if (!priced.quote.billTotalOk) {
      fields.billTotalPaise = `the lines add up to ${rupees(priced.quote.totals.computedTotalPaise)}; check the bill (a difference of up to ₹1 is kept as round-off)`;
    }
    if (Object.keys(fields).length > 0) throw new AppError('VALIDATION_FAILED', 'This bill cannot be saved yet', fields);
  }

  // 5c details: header, lines and charges; one landed-cost receipt per line; the supplier's ledger entry; one outbox aggregate.
  private write(input: CreatePurchaseInput, priced: PricedPurchase): string {
    const db = this.ctx.db();
    const till = this.ctx.till();
    const actor = this.ctx.actor();
    const docDate = this.ctx.today();
    const fy = financialYearOf(docDate);
    const warehouseId = ensureDefaultWarehouse(db, till.businessId, till.branchId, actor);
    const prefix = docSeriesPrefix(getTerminal(db, till.terminalId)!.invoicePrefix, 'purchase');
    const seriesId = findOrCreateSeries(db, { ...till, docType: 'purchase', fy }, prefix, actor, 5);
    const number = allocateDocNumber(db, seriesId);
    const id = newUlid();
    const { quote, supplier } = priced;
    const lines = quote.lines.map((l) => ({ ...l, id: newUlid() }));
    insertPurchase(db, {
      id, businessId: till.businessId, branchId: till.branchId, warehouseId, commandId: input.commandId, supplierId: supplier.id,
      supplier: { name: supplier.name, stateCode: supplier.stateCode, taxScheme: supplier.taxScheme, ...(supplier.gstin && { gstin: supplier.gstin }) },
      supplierInvoiceNo: input.supplierInvoiceNo, supplierInvoiceDate: input.supplierInvoiceDate, seriesId, docNumber: number.number,
      docSeq: number.seq, docDate, fy: financialYearOf(input.supplierInvoiceDate), placeOfSupplyState: priced.branch.stateCode,
      isReverseCharge: input.isReverseCharge, dueDate: quote.dueDate, note: input.note ?? null, totals: quote.totals, lines, charges: input.charges,
    }, actor);
    for (const l of lines) {
      postMovement(db, {
        businessId: till.businessId, warehouseId, productId: l.productId, type: 'purchase', qtyMilli: l.baseQtyMilli,
        receiptValuePaise: l.landedValuePaise, refType: 'purchase', refId: id, refLineId: l.id,
      }, actor);
    }
    const entry = postPartyEntry(db, {
      businessId: till.businessId, partyType: 'supplier', partyId: supplier.id, refType: 'purchase', refId: id, kind: 'post',
      amountPaise: -quote.totals.totalPaise, docDate, dueDate: quote.dueDate,
    }, actor);
    recordChange(db, till.businessId, actor, {
      action: 'purchase.create', entityType: 'purchase', entityId: id, operationType: 'create',
      after: { ...getPurchase(db, id), movements: movementsForRef(db, till.businessId, 'purchase', id), entry },
    });
    return id;
  }
}
