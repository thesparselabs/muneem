import type { GstHeads } from '@muneem/contracts';
import { financialYearOf, type SetoffUtilisation } from '@muneem/domain';
import { insertGstPayment, insertGstSetoff, setoffIdsForMonth } from '../../repositories/gstDocuments.js';
import type { ApplyContext, Payload } from './context.js';
import { str, type DocumentApplier } from './documents.js';
import { applyJournal } from './journals.js';
import { recordLocalReview } from './review.js';

const num = (v: unknown): number => Number(v ?? 0);
const heads = (v: unknown): GstHeads => {
  const h = (v ?? {}) as Payload;
  return { igstPaise: num(h.igstPaise), cgstPaise: num(h.cgstPaise), sgstPaise: num(h.sgstPaise), cessPaise: num(h.cessPaise) };
};
const numbering = (ctx: ApplyContext, p: Payload) => ({
  id: ctx.change.entityId, businessId: ctx.businessId, branchId: String(p.branchId), terminalId: String(p.terminalId), seriesId: String(p.seriesId),
  docNumber: String(p.docNumber), docSeq: num(p.docSeq), docDate: String(p.docDate), fy: str(p.fy) ?? financialYearOf(String(p.docDate)),
  commandId: str(p.commandId) ?? ctx.change.entityId, ...(str(p.createdAt) && { createdAt: String(p.createdAt) }),
});

// ADR-0040: a pulled set-off keeps the origin's amounts and journal. A second one for the same month (two devices offline) is kept too,
// so every device converges, and listed for review (ADR-0044 as built).
function createSetoff(ctx: ApplyContext, p: Payload): void {
  const month = String(p.month);
  const others = setoffIdsForMonth(ctx.db, ctx.businessId, month);
  insertGstSetoff(ctx.db, {
    ...numbering(ctx, p), month, liability: heads(p.liability), credit: heads(p.credit), cash: heads(p.cash),
    utilisation: Object.fromEntries(Object.entries((p.utilisation ?? {}) as Payload).map(([k, v]) => [k, num(v)])) as unknown as SetoffUtilisation,
  }, ctx.actor);
  applyJournal(ctx, p.journal);
  if (others.length > 0) {
    recordLocalReview(ctx.db, {
      id: `duplicate-setoff:${month}:${[...others, ctx.change.entityId].sort().join(':')}`, businessId: ctx.businessId, kind: 'duplicate_setoff',
      entityType: 'gst_setoff', entityId: ctx.change.entityId, rule: 'one_setoff_per_month', winner: 'device', field: 'month', cloudValue: month, deviceValue: others,
    });
  }
}

function createPayment(ctx: ApplyContext, p: Payload): void {
  insertGstPayment(ctx.db, {
    ...numbering(ctx, p), ...heads(p), month: str(p.month), challanRef: String(p.challanRef), totalPaise: num(p.totalPaise), note: str(p.note),
  }, ctx.actor);
  applyJournal(ctx, p.journal);
}

export const GST_SETOFF: DocumentApplier = { table: 'gst_setoff', create: createSetoff };
export const GST_PAYMENT: DocumentApplier = { table: 'gst_payment', create: createPayment };
