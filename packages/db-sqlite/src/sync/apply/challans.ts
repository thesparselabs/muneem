import type { ChallanPurpose, Consignee, QuoteLine, SaleTotals, Transport } from '@muneem/contracts';
import { financialYearOf } from '@muneem/domain';
import { getTerminal } from '../../repositories/business.js';
import { insertChallan, markChallanBilled } from '../../repositories/deliveryChallan.js';
import { resolver } from './aliases.js';
import type { ApplyContext, Payload } from './context.js';
import { str, type DocumentApplier } from './documents.js';

// ADR-0069: a pulled challan keeps the origin's number, values and transport; units are matched by natural key.
function createChallan(ctx: ApplyContext, p: Payload): void {
  const id = ctx.change.entityId;
  const docDate = String(p.docDate);
  const lines = (p.lines ?? []) as QuoteLine[];
  const resolve = resolver(ctx.db, ctx.businessId);
  const consignee = p.consignee && typeof p.consignee === 'object' ? (p.consignee as Payload) : null;
  insertChallan(ctx.db, {
    id, businessId: ctx.businessId, branchId: str(p.branchId) ?? getTerminal(ctx.db, String(p.terminalId))!.branchId, terminalId: String(p.terminalId),
    commandId: str(p.commandId) ?? id, seriesId: String(p.seriesId), docNumber: String(p.docNumber), docSeq: Number(p.docSeq), docDate,
    fy: str(p.fy) ?? financialYearOf(docDate), purpose: p.purpose as ChallanPurpose, customerId: str(p.customerId),
    consignee: consignee ? ({ name: String(consignee.name), ...(str(consignee.address) && { address: String(consignee.address) }),
      ...(str(consignee.gstin) && { gstin: String(consignee.gstin) }) } as Consignee) : null,
    placeOfSupplyReason: str(p.placeOfSupplyReason), totals: p.totals as SaleTotals, transport: p.transport as Transport,
    lines: lines.map((l) => ({ ...l, uomId: resolve('uom', l.uomId)! })), notes: str(p.notes), ...(str(p.createdAt) && { createdAt: String(p.createdAt) }),
  }, ctx.actor);
}

// The cloud keeps the latest invoice link, so every device ends on the same sale.
function billChallan(ctx: ApplyContext, update: Payload): void {
  markChallanBilled(ctx.db, ctx.change.entityId, { saleId: String(update.saleId), saleDocNumber: String(update.saleDocNumber), billedAt: String(update.billedAt) });
}

export const DELIVERY_CHALLAN: DocumentApplier = { table: 'delivery_challan', create: createChallan, update: billChallan };
