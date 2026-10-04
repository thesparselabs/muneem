import type { CustomerSnapshot, QuoteLine, SaleTotals } from '@muneem/contracts';
import { financialYearOf, type SettledTender } from '@muneem/domain';
import { getBusiness, getTerminal } from '../../repositories/business.js';
import { insertSale, saleItemId } from '../../repositories/sale.js';
import { resolver } from './aliases.js';
import type { ApplyContext, Payload } from './context.js';
import { applyPartyEntry, str, type DocumentApplier } from './documents.js';
import { applyJournal } from './journals.js';
import { applyMovements } from './stock.js';

interface MovementCost { refLineId: string | null; unitCostPaise: number; valuePaise: number }

// ADR-0040: each line's cost is the stored movement's, never a fresh issue from this device's stock.
const lineCosts = (saleId: string, lines: readonly QuoteLine[], movements: readonly MovementCost[]) => lines.map((l) => {
  const m = movements.find((x) => x.refLineId === saleItemId(saleId, l.lineNo));
  return { unitCostPaise: m?.unitCostPaise ?? 0, cogsPaise: m ? -m.valuePaise : 0 };
});

function createSale(ctx: ApplyContext, p: Payload): void {
  const id = ctx.change.entityId;
  const lines = (p.lines ?? []) as QuoteLine[];
  const movements = (p.movements ?? []) as MovementCost[];
  const terminal = getTerminal(ctx.db, String(p.terminalId));
  insertSale(ctx.db, {
    id, businessId: ctx.businessId, branchId: str(p.branchId) ?? terminal!.branchId, terminalId: String(p.terminalId), sessionId: String(p.sessionId),
    commandId: str(p.commandId) ?? id, seriesId: String(p.seriesId), docNumber: String(p.docNumber), docSeq: Number(p.docSeq), docDate: String(p.docDate),
    fy: str(p.fy) ?? financialYearOf(String(p.docDate)), taxScheme: str(p.taxScheme) ?? getBusiness(ctx.db, ctx.businessId)!.taxScheme,
    customerId: str(p.customerId), customer: (p.customer ?? { walkIn: true }) as CustomerSnapshot, placeOfSupplyReason: str(p.placeOfSupplyReason),
    priceListId: resolver(ctx.db, ctx.businessId)('price_list', p.priceListId), totals: p.totals as SaleTotals, paidPaise: Number(p.paidPaise),
    changePaise: Number(p.changePaise ?? 0), creditPaise: Number(p.creditPaise ?? 0), dueDate: str(p.dueDate),
    lines: lines.map((l) => ({ ...l, uomId: resolver(ctx.db, ctx.businessId)('uom', l.uomId)! })),
    tenders: (p.tenders ?? []) as SettledTender[], lineCosts: lineCosts(id, lines, movements), ...(str(p.createdAt) && { createdAt: String(p.createdAt) }),
  }, ctx.actor);
  applyMovements(ctx, p.movements);
  applyPartyEntry(ctx, p.partyEntry);
  applyJournal(ctx, p.journal);
}

export const SALE: DocumentApplier = { table: 'sale', create: createSale };
