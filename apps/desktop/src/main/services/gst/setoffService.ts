import { AppError, type GstHeads, type GstSetoff, type GstSetoffPreview, type PostGstSetoffInput } from '@muneem/contracts';
import { computeSetoff, docSeriesPrefix, financialYearOf, monthEnd, newUlid, taxOf } from '@muneem/domain';
import {
  allocateDocNumber, documentKeys, findOrCreateSeries, getGstSetoff, getTerminal, gstBalancesAt, gstSetoffIdByCommand, insertGstSetoff, latestSetoffMonth,
  postDocumentJournal, recordChange, setoffIdsForMonth, withTransaction,
} from '@muneem/db-sqlite';
import type { GstContext } from './gstContext.js';

const positive = (h: GstHeads): GstHeads =>
  ({ igstPaise: Math.max(0, h.igstPaise), cgstPaise: Math.max(0, h.cgstPaise), sgstPaise: Math.max(0, h.sgstPaise), cessPaise: Math.max(0, h.cessPaise) });

// ADR-0044: one set-off per month, dated its last day, from the tax accounts' balances at that day; months go in order.
export class GstSetoffService {
  constructor(private readonly ctx: GstContext) {}

  preview(month: string): GstSetoffPreview {
    const db = this.ctx.pos.db();
    const docDate = monthEnd(month);
    const books = gstBalancesAt(db, this.ctx.pos.businessId(), docDate);
    const r = computeSetoff(positive(books.output), positive(books.input));
    return { month, docDate, ...r, cashTotalPaise: taxOf(r.cash), blockers: this.blockers(month) };
  }

  post(input: PostGstSetoffInput): GstSetoff {
    const db = this.ctx.pos.db();
    const businessId = this.ctx.pos.businessId();
    const done = gstSetoffIdByCommand(db, businessId, input.commandId);
    if (done) return getGstSetoff(db, done)!;
    const id = withTransaction(db, () => gstSetoffIdByCommand(db, businessId, input.commandId) ?? this.write(input));
    return getGstSetoff(db, id)!;
  }

  private blockers(month: string): string[] {
    const db = this.ctx.pos.db();
    const businessId = this.ctx.pos.businessId();
    const out: string[] = [];
    if (!this.ctx.regular()) out.push('Only a business under the regular scheme sets off GST');
    if (month >= `${this.ctx.pos.today().slice(0, 7)}-01`) out.push('Only a month that has ended can be set off');
    if (this.ctx.locked(month)) out.push(`${month.slice(0, 7)} is locked`);
    const existing = setoffIdsForMonth(db, businessId, month)[0];
    if (existing) out.push(`${month.slice(0, 7)} is already set off (${getGstSetoff(db, existing)!.docNumber})`);
    const latest = latestSetoffMonth(db, businessId);
    if (latest && latest > month) out.push(`${latest.slice(0, 7)} is already set off; months are set off in order`);
    return out;
  }

  private write(input: PostGstSetoffInput): string {
    const db = this.ctx.pos.db();
    const preview = this.preview(input.month);
    if (preview.blockers.length > 0) {
      throw new AppError(this.ctx.locked(input.month) ? 'PERIOD_LOCKED' : 'INVALID_STATE', preview.blockers[0]!);
    }
    const till = this.ctx.pos.till();
    const actor = this.ctx.pos.actor();
    const fy = financialYearOf(preview.docDate);
    const seriesId = findOrCreateSeries(db, { ...till, docType: 'gst_setoff', fy }, docSeriesPrefix(getTerminal(db, till.terminalId)!.invoicePrefix, 'gst_setoff'), actor, 5);
    const number = allocateDocNumber(db, seriesId);
    const id = newUlid();
    insertGstSetoff(db, {
      id, businessId: till.businessId, branchId: till.branchId, terminalId: till.terminalId, seriesId, docNumber: number.number, docSeq: number.seq,
      docDate: preview.docDate, fy, month: input.month, liability: preview.liability, credit: preview.credit, utilisation: preview.utilisation,
      cash: preview.cash, commandId: input.commandId,
    }, actor);
    const journal = postDocumentJournal(db, 'gst_setoff', id, till, actor);
    recordChange(db, till.businessId, actor, {
      action: 'gst.setoff', entityType: 'gst_setoff', entityId: id, operationType: 'create',
      after: { ...getGstSetoff(db, id), ...documentKeys(db, 'gst_setoff', id), journal },
    });
    return id;
  }
}
