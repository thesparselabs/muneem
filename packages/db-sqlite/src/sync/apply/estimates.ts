import type { DiscountInput, QuoteLine, SaleTotals } from '@muneem/contracts';
import { financialYearOf } from '@muneem/domain';
import { getTerminal } from '../../repositories/business.js';
import { insertEstimate, markEstimateConverted } from '../../repositories/estimate.js';
import { resolver } from './aliases.js';
import type { ApplyContext, Payload } from './context.js';
import { str, type DocumentApplier } from './documents.js';

// ADR-0068: a pulled estimate keeps the origin's number and prices; units are matched by natural key, as for sales.
function createEstimate(ctx: ApplyContext, p: Payload): void {
  const id = ctx.change.entityId;
  const docDate = String(p.docDate);
  const lines = (p.lines ?? []) as QuoteLine[];
  const resolve = resolver(ctx.db, ctx.businessId);
  insertEstimate(ctx.db, {
    id, businessId: ctx.businessId, branchId: str(p.branchId) ?? getTerminal(ctx.db, String(p.terminalId))!.branchId, terminalId: String(p.terminalId),
    commandId: str(p.commandId) ?? id, seriesId: String(p.seriesId), docNumber: String(p.docNumber), docSeq: Number(p.docSeq), docDate,
    fy: str(p.fy) ?? financialYearOf(docDate), validUntil: String(p.validUntil), customerId: str(p.customerId),
    placeOfSupplyReason: str(p.placeOfSupplyReason), billDiscount: p.billDiscount as DiscountInput, totals: p.totals as SaleTotals,
    lines: lines.map((l) => ({ ...l, uomId: resolve('uom', l.uomId)! })), notes: str(p.notes), ...(str(p.createdAt) && { createdAt: String(p.createdAt) }),
  }, ctx.actor);
}

// The cloud keeps the latest conversion, so every device ends on the same sale even if two tills converted it offline.
function convertEstimate(ctx: ApplyContext, update: Payload): void {
  markEstimateConverted(ctx.db, ctx.change.entityId, {
    saleId: String(update.saleId), saleDocNumber: String(update.saleDocNumber), convertedAt: String(update.convertedAt),
  });
}

export const ESTIMATE: DocumentApplier = { table: 'estimate', create: createEstimate, update: convertEstimate };
