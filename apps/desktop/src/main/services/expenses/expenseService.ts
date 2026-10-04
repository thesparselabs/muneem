import { AppError, type Expense, type ExpenseCategory, type ExpenseInput, type ExpenseListInput, type ExpensePage } from '@muneem/contracts';
import { addDays, computeInvoice, docSeriesPrefix, DomainError, financialYearOf, isUtWithoutLegislature, newUlid, stateOfGstin } from '@muneem/domain';
import {
  allocateDocNumber, documentCashMovements, documentKeys, drawerMovements, ensureExpenseCategories, expenseIdByCommand, findOrCreateSeries, getBranch, getBusiness, getExpense,
  getSupplier, getTerminal, insertExpense, listExpenseCategories, listExpenses, markExpenseCancelled, postDocumentJournal, postPartyEntry, recordChange,
  reverseDocumentJournal, withTransaction,
  type ExpenseRecord,
} from '@muneem/db-sqlite';
import type { Drawer } from '../payments/drawer.js';
import type { PosContext } from '../pos/posContext.js';

type Tax = Pick<ExpenseRecord, 'supplyType' | 'taxablePaise' | 'cgstPaise' | 'sgstPaise' | 'igstPaise' | 'cessPaise' | 'totalPaise'>;

export class ExpenseService {
  constructor(private readonly ctx: PosContext, private readonly drawer: Drawer) {}

  categories(): ExpenseCategory[] {
    const db = this.ctx.db();
    if (listExpenseCategories(db, this.ctx.businessId()).length === 0) {
      withTransaction(db, () => ensureExpenseCategories(db, this.ctx.businessId(), this.ctx.actor()));
    }
    return listExpenseCategories(db, this.ctx.businessId());
  }

  create(input: ExpenseInput): Expense {
    const db = this.ctx.db();
    const done = expenseIdByCommand(db, this.ctx.businessId(), input.commandId);
    if (done) return this.get(done);
    const id = withTransaction(db, () => expenseIdByCommand(db, this.ctx.businessId(), input.commandId) ?? this.write(input));
    return this.get(id);
  }

  get(id: string): Expense {
    const e = getExpense(this.ctx.db(), id);
    if (!e || e.businessId !== this.ctx.businessId()) throw new Error('NOT_FOUND');
    return e;
  }

  list(f: ExpenseListInput): ExpensePage { return listExpenses(this.ctx.db(), this.ctx.businessId(), f); }

  cancel(id: string, reason: string): Expense {
    const db = this.ctx.db();
    withTransaction(db, () => {
      const e = this.get(id);
      if (e.status !== 'posted') throw new AppError('INVALID_STATE', `${e.docNumber} is already cancelled`);
      if (e.settledPaise > 0) throw new AppError('INVALID_STATE', `${e.docNumber} has payments allocated to it; cancel them first`);
      const actor = this.ctx.actor();
      markExpenseCancelled(db, id, reason, actor);
      const entry = e.method === 'credit'
        ? postPartyEntry(db, {
          businessId: this.ctx.businessId(), partyType: 'supplier', partyId: e.supplierId!, refType: 'expense', refId: id, kind: 'cancel',
          amountPaise: e.totalPaise, docDate: this.ctx.today(), dueDate: e.dueDate ?? null,
        }, actor)
        : null;
      const drawer = e.method === 'cash'
        ? this.drawer.reverse(documentCashMovements(db, 'expense', id)[0], { reason: `Cancelled ${e.docNumber}`, refType: 'expense', refId: id })
        : 'not_cash';
      const journal = reverseDocumentJournal(db, 'expense', id, this.ctx.today(), actor);
      recordChange(db, this.ctx.businessId(), actor, {
        action: 'expense.cancel', entityType: 'expense', entityId: id, operationType: 'cancel', after: { id, status: 'cancelled', reason, entry, drawer, drawerMovements: drawerMovements(db, 'expense', id), journal },
      });
    });
    return this.get(id);
  }

  private write(input: ExpenseInput): string {
    const db = this.ctx.db();
    const till = this.ctx.till();
    const actor = this.ctx.actor();
    const today = this.ctx.today();
    const expenseDate = input.expenseDate ?? today;
    const fields: Record<string, string> = {};
    const category = this.categories().find((c) => c.id === input.categoryId);
    if (!category) fields.categoryId = 'not an expense category of this business';
    if (expenseDate > today) fields.expenseDate = 'cannot be after today';
    const supplier = input.supplierId ? getSupplier(db, input.supplierId) : null;
    if (input.supplierId && (!supplier || supplier.businessId !== till.businessId)) fields.supplierId = 'supplier not found';
    if (input.method === 'credit' && !supplier) fields.supplierId = 'an expense on credit needs a supplier';
    const gstin = supplier?.gstin ?? input.vendorGstin;
    if (input.gstRateBp !== undefined && !gstin) fields.gstRateBp = 'GST needs the vendor\'s GSTIN';
    if (Object.keys(fields).length > 0) throw new AppError('VALIDATION_FAILED', 'This expense cannot be saved yet', fields);

    const business = getBusiness(db, till.businessId)!;
    const tax = this.tax(input, gstin, getBranch(db, till.branchId)!.stateCode);
    const taxes = tax.cgstPaise + tax.sgstPaise + tax.igstPaise + tax.cessPaise;
    const itcPaise = business.taxScheme === 'regular' && gstin && (input.itcEligible ?? true) ? taxes : 0;
    const dueDate = input.method === 'credit' ? addDays(expenseDate, supplier!.creditDays) : null;
    const fy = financialYearOf(expenseDate);
    const seriesId = findOrCreateSeries(db, { ...till, docType: 'expense', fy }, docSeriesPrefix(getTerminal(db, till.terminalId)!.invoicePrefix, 'expense'), actor, 5);
    const number = allocateDocNumber(db, seriesId);
    const sessionId = input.method === 'cash' ? this.drawer.openSessionId() : null;
    const id = newUlid();
    insertExpense(db, {
      id, businessId: till.businessId, branchId: till.branchId, terminalId: till.terminalId, sessionId, categoryId: category!.id,
      supplierId: supplier?.id ?? null, vendorName: input.vendorName ?? null, vendorGstin: supplier ? null : input.vendorGstin ?? null, seriesId,
      docNumber: number.number, docSeq: number.seq, expenseDate, fy, description: input.description ?? null, method: input.method,
      reference: input.reference ?? null, ...tax, itcPaise, roundOffPaise: 0, dueDate, commandId: input.commandId,
    }, actor);
    const entry = input.method === 'credit'
      ? postPartyEntry(db, {
        businessId: till.businessId, partyType: 'supplier', partyId: supplier!.id, refType: 'expense', refId: id, kind: 'post',
        amountPaise: -tax.totalPaise, docDate: expenseDate, dueDate,
      }, actor)
      : null;
    this.drawer.record(sessionId, { kind: 'cash_out', amountPaise: tax.totalPaise, reason: `${number.number} ${category!.name}`, refType: 'expense', refId: id });
    const journal = postDocumentJournal(db, 'expense', id, till, actor);
    recordChange(db, till.businessId, actor, { action: 'expense.create', entityType: 'expense', entityId: id, operationType: 'create', after: { ...getExpense(db, id), ...documentKeys(db, 'expense', id), drawerMovements: drawerMovements(db, 'expense', id), entry, journal } });
    return id;
  }

  // A rate means a GST bill from a registered vendor: one line through the GST engine, vendor's state against the branch's.
  private tax(input: ExpenseInput, gstin: string | undefined, branchState: string): Tax {
    if (input.gstRateBp === undefined || !gstin) {
      return { supplyType: null, taxablePaise: input.amountPaise, cgstPaise: 0, sgstPaise: 0, igstPaise: 0, cessPaise: 0, totalPaise: input.amountPaise };
    }
    try {
      const r = computeInvoice({
        docType: 'tax_invoice', supplierStateCode: stateOfGstin(gstin)!, placeOfSupplyStateCode: branchState,
        isUnionTerritoryWithoutLegislature: isUtWithoutLegislature(branchState), taxScheme: 'regular', billDiscount: { kind: 'amount', value: 0 },
        roundToRupee: false, b2clThresholdPaise: Number.MAX_SAFE_INTEGER,
        lines: [{
          qtyMilli: 1000, unitPricePaise: input.amountPaise, priceIsInclusive: input.amountIsInclusive, lineDiscount: { kind: 'amount', value: 0 },
          gstRateBp: input.gstRateBp, cessRateBp: 0, cessPerUnitPaise: 0, taxTreatment: 'taxable',
        }],
      });
      return {
        supplyType: r.supplyType, taxablePaise: r.taxablePaise, cgstPaise: r.cgstPaise, sgstPaise: r.sgstPaise, igstPaise: r.igstPaise, cessPaise: r.cessPaise,
        totalPaise: r.totalPaise,
      };
    } catch (e) {
      if (e instanceof DomainError) throw new AppError('VALIDATION_FAILED', e.message, { amountPaise: e.message });
      throw e;
    }
  }
}
