import {
  AppError, ESTIMATE_DEFAULT_VALID_DAYS, type CreateEstimateInput, type Estimate, type EstimateListInput, type EstimatePage,
} from '@muneem/contracts';
import { addDays, docSeriesPrefix, financialYearOf, formatRupees as rupees, newUlid } from '@muneem/domain';
import {
  allocateDocNumber, documentKeys, estimateIdByCommand, findOrCreateSeries, getEstimate, getTerminal, insertEstimate, listEstimates, markEstimateConverted,
  nowIso, recordChange, withTransaction,
} from '@muneem/db-sqlite';
import type { PosContext } from '../pos/posContext.js';
import type { PricedSale, SalePricing } from '../pos/salePricing.js';

export interface ConvertingSale { id: string; docNumber: string }

// FR-086 (ADR-0068): an estimate is priced by the sale engine and stored with its own Q number; it posts nothing.
export class EstimateService {
  constructor(private readonly ctx: PosContext, private readonly pricing: SalePricing) {}

  create(input: CreateEstimateInput): Estimate {
    const db = this.ctx.db();
    const done = estimateIdByCommand(db, this.ctx.businessId(), input.commandId);
    if (done) return this.get(done);
    const today = this.ctx.today();
    const validUntil = input.validUntil ?? addDays(today, ESTIMATE_DEFAULT_VALID_DAYS);
    if (validUntil < today) throw new AppError('VALIDATION_FAILED', 'An estimate must be valid until today or later', { validUntil: 'on or after today' });
    const priced = this.priced(input);
    const id = withTransaction(db, () => estimateIdByCommand(db, this.ctx.businessId(), input.commandId) ?? this.write(input, priced, today, validUntil));
    return this.get(id);
  }

  get(id: string): Estimate {
    const e = getEstimate(this.ctx.db(), id, this.ctx.today());
    if (!e || e.businessId !== this.ctx.businessId()) throw new AppError('NOT_FOUND', 'Estimate not found');
    return e;
  }

  list(f: EstimateListInput): EstimatePage {
    return listEstimates(this.ctx.db(), this.ctx.businessId(), f, this.ctx.today());
  }

  // Runs inside the sale's transaction, so the bill and the conversion commit or fail together.
  convert(estimateId: string, sale: ConvertingSale): void {
    const e = this.get(estimateId);
    if (e.status === 'converted') throw new AppError('INVALID_STATE', `This estimate was already billed as ${e.saleDocNumber ?? 'another bill'}`);
    const conversion = { saleId: sale.id, saleDocNumber: sale.docNumber, convertedAt: nowIso() };
    markEstimateConverted(this.ctx.db(), estimateId, conversion);
    recordChange(this.ctx.db(), this.ctx.businessId(), this.ctx.actor(), {
      action: 'estimate.convert', entityType: 'estimate', entityId: estimateId, operationType: 'update', after: { status: 'converted', ...conversion },
    });
  }

  // The same checks a bill would get, so an estimate never promises what the till would refuse.
  private priced(input: CreateEstimateInput): PricedSale {
    const priced = this.pricing.price(input);
    const { totals, issues } = priced.quote;
    if (issues.length > 0) {
      throw new AppError('VALIDATION_FAILED', 'Some lines cannot be quoted', Object.fromEntries(issues.map((i) => [`lines.${i.lineNo - 1}`, i.message])));
    }
    const limit = this.ctx.maxDiscountBp();
    if (limit !== undefined && totals.discountBp > limit) {
      throw new AppError('PERMISSION_DENIED', `Discount of ${totals.discountBp / 100}% is above your limit of ${limit / 100}%`);
    }
    if (totals.totalPaise !== input.expectedTotalPaise) {
      throw new AppError('TOTAL_MISMATCH', `The estimate total is now ${rupees(totals.totalPaise)}; check the lines and save again`);
    }
    return priced;
  }

  private write(input: CreateEstimateInput, priced: PricedSale, today: string, validUntil: string): string {
    const db = this.ctx.db();
    const till = this.ctx.till();
    const actor = this.ctx.actor();
    const fy = financialYearOf(today);
    const seriesId = findOrCreateSeries(db, { ...till, docType: 'estimate', fy }, docSeriesPrefix(getTerminal(db, till.terminalId)!.invoicePrefix, 'estimate'), actor, 5);
    const number = allocateDocNumber(db, seriesId);
    const id = newUlid();
    insertEstimate(db, {
      id, businessId: till.businessId, branchId: till.branchId, terminalId: till.terminalId, commandId: input.commandId, seriesId, docNumber: number.number,
      docSeq: number.seq, docDate: today, fy, validUntil, customerId: priced.customer?.id ?? null, placeOfSupplyReason: priced.placeOfSupplyReason,
      billDiscount: input.billDiscount, totals: priced.quote.totals, lines: priced.quote.lines, notes: input.notes ?? null,
    }, actor);
    const e = getEstimate(db, id, today)!;
    recordChange(db, till.businessId, actor, {
      action: 'estimate.create', entityType: 'estimate', entityId: id, operationType: 'create',
      after: {
        id, businessId: till.businessId, terminalId: till.terminalId, docNumber: e.docNumber, docDate: e.docDate, validUntil: e.validUntil,
        customerId: e.customerId ?? null, status: 'open', lines: e.lines, totals: e.totals, billDiscount: input.billDiscount, createdAt: e.createdAt,
        createdBy: e.createdBy, ...documentKeys(db, 'estimate', id),
      },
    });
    return id;
  }
}
