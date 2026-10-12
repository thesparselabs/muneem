import { AppError, type Challan, type ChallanDraft, type ChallanListInput, type ChallanPage, type CreateChallanInput, type SaleDraft } from '@muneem/contracts';
import { docSeriesPrefix, financialYearOf, formatRupees as rupees, newUlid, stateOfGstin } from '@muneem/domain';
import {
  allocateDocNumber, challanIdByCommand, documentKeys, findOrCreateSeries, getChallan, getTerminal, insertChallan, listChallans, markChallanBilled,
  nowIso, recordChange, withTransaction,
} from '@muneem/db-sqlite';
import type { PosContext } from '../pos/posContext.js';
import type { PricedSale, SalePricing } from '../pos/salePricing.js';

// A challan is valued as a bill with no discounts; a typed consignee's GSTIN in another state makes it inter-state.
export function saleDraftOf(d: ChallanDraft): SaleDraft {
  const gstin = d.customerId ? undefined : d.consignee?.gstin;
  return {
    lines: d.lines.map((l) => ({ ...l, lineDiscount: { kind: 'amount', value: 0 } })), billDiscount: { kind: 'amount', value: 0 },
    ...(d.customerId && { customerId: d.customerId }),
    ...(gstin && { placeOfSupplyOverride: { stateCode: stateOfGstin(gstin), reason: 'Consignee GSTIN' } }),
  };
}

// FR-087 (ADR-0069): a challan is valued by the sale engine and numbered with kind letter H; it posts nothing, and only a
// challan sent for supply is later invoiced, by billing it at the till.
export class ChallanService {
  constructor(private readonly ctx: PosContext, private readonly pricing: SalePricing) {}

  create(input: CreateChallanInput): Challan {
    const db = this.ctx.db();
    const done = challanIdByCommand(db, this.ctx.businessId(), input.commandId);
    if (done) return this.get(done);
    if (!input.customerId && !input.consignee) {
      throw new AppError('VALIDATION_FAILED', 'Say who receives the goods', { consignee: 'choose a customer or type the consignee' });
    }
    const priced = this.priced(input);
    const id = withTransaction(db, () => challanIdByCommand(db, this.ctx.businessId(), input.commandId) ?? this.write(input, priced));
    return this.get(id);
  }

  get(id: string): Challan {
    const c = getChallan(this.ctx.db(), id);
    if (!c || c.businessId !== this.ctx.businessId()) throw new AppError('NOT_FOUND', 'Challan not found');
    return c;
  }

  list(f: ChallanListInput): ChallanPage {
    return listChallans(this.ctx.db(), this.ctx.businessId(), f);
  }

  // Runs inside the sale's transaction, so the invoice and the challan's link commit or fail together.
  bill(challanId: string, sale: { id: string; docNumber: string }): void {
    const c = this.get(challanId);
    if (c.status === 'billed') throw new AppError('INVALID_STATE', `This challan was already invoiced as ${c.saleDocNumber ?? 'another bill'}`);
    if (c.purpose !== 'supply') throw new AppError('INVALID_STATE', 'Only a challan sent for supply is invoiced');
    const billing = { saleId: sale.id, saleDocNumber: sale.docNumber, billedAt: nowIso() };
    markChallanBilled(this.ctx.db(), challanId, billing);
    recordChange(this.ctx.db(), this.ctx.businessId(), this.ctx.actor(), {
      action: 'challan.bill', entityType: 'delivery_challan', entityId: challanId, operationType: 'update', after: { status: 'billed', ...billing },
    });
  }

  private priced(input: CreateChallanInput): PricedSale {
    const priced = this.pricing.price(saleDraftOf(input));
    const { totals, issues } = priced.quote;
    if (issues.length > 0) {
      throw new AppError('VALIDATION_FAILED', 'Some lines cannot be valued', Object.fromEntries(issues.map((i) => [`lines.${i.lineNo - 1}`, i.message])));
    }
    if (totals.totalPaise !== input.expectedTotalPaise) {
      throw new AppError('TOTAL_MISMATCH', `The challan value is now ${rupees(totals.totalPaise)}; check the lines and save again`);
    }
    return priced;
  }

  private write(input: CreateChallanInput, priced: PricedSale): string {
    const db = this.ctx.db();
    const till = this.ctx.till();
    const actor = this.ctx.actor();
    const today = this.ctx.today();
    const fy = financialYearOf(today);
    const seriesId = findOrCreateSeries(db, { ...till, docType: 'delivery_challan', fy }, docSeriesPrefix(getTerminal(db, till.terminalId)!.invoicePrefix, 'delivery_challan'), actor, 5);
    const number = allocateDocNumber(db, seriesId);
    const id = newUlid();
    const consignee = input.customerId ? null : input.consignee ?? null;
    insertChallan(db, {
      id, businessId: till.businessId, branchId: till.branchId, terminalId: till.terminalId, commandId: input.commandId, seriesId, docNumber: number.number,
      docSeq: number.seq, docDate: today, fy, purpose: input.purpose, customerId: priced.customer?.id ?? null, consignee,
      placeOfSupplyReason: priced.placeOfSupplyReason, totals: priced.quote.totals, lines: priced.quote.lines, transport: input.transport, notes: input.notes ?? null,
    }, actor);
    const c = getChallan(db, id)!;
    recordChange(db, till.businessId, actor, {
      action: 'challan.create', entityType: 'delivery_challan', entityId: id, operationType: 'create',
      after: {
        id, businessId: till.businessId, terminalId: till.terminalId, docNumber: c.docNumber, docDate: c.docDate, purpose: c.purpose,
        customerId: c.customerId ?? null, consignee, status: 'open', lines: c.lines, totals: c.totals, transport: c.transport, createdAt: c.createdAt,
        createdBy: c.createdBy, ...documentKeys(db, 'delivery_challan', id),
      },
    });
    return id;
  }
}
