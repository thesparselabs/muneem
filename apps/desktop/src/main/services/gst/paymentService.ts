import { AppError, type GstLedgerView, type GstPayment, type GstPaymentInput } from '@muneem/contracts';
import { docSeriesPrefix, financialYearOf, newUlid } from '@muneem/domain';
import {
  allocateDocNumber, documentKeys, findOrCreateSeries, getGstPayment, getTerminal, gstPayableBalance, gstPaymentIdByCommand, insertGstPayment, listGstPayments,
  listGstSetoffs, postDocumentJournal, recordChange, withTransaction,
} from '@muneem/db-sqlite';
import type { GstContext } from './gstContext.js';

// A challan paid from the bank clears 2300 GST Payable (ADR-0044).
export class GstPaymentService {
  constructor(private readonly ctx: GstContext) {}

  record(input: GstPaymentInput): GstPayment {
    const db = this.ctx.pos.db();
    const businessId = this.ctx.pos.businessId();
    const done = gstPaymentIdByCommand(db, businessId, input.commandId);
    if (done) return getGstPayment(db, done)!;
    if (input.paymentDate > this.ctx.pos.today()) throw new AppError('VALIDATION_FAILED', 'This payment cannot be saved yet', { paymentDate: 'cannot be after today' });
    this.ctx.refuseLocked(input.paymentDate);
    const id = withTransaction(db, () => gstPaymentIdByCommand(db, businessId, input.commandId) ?? this.write(input));
    return getGstPayment(db, id)!;
  }

  ledger(): GstLedgerView {
    const db = this.ctx.pos.db();
    const businessId = this.ctx.pos.businessId();
    return { setoffs: listGstSetoffs(db, businessId), payments: listGstPayments(db, businessId), payablePaise: gstPayableBalance(db, businessId) };
  }

  private write(input: GstPaymentInput): string {
    const db = this.ctx.pos.db();
    const till = this.ctx.pos.till();
    const actor = this.ctx.pos.actor();
    const fy = financialYearOf(input.paymentDate);
    const seriesId = findOrCreateSeries(db, { ...till, docType: 'gst_payment', fy }, docSeriesPrefix(getTerminal(db, till.terminalId)!.invoicePrefix, 'gst_payment'), actor, 5);
    const number = allocateDocNumber(db, seriesId);
    const id = newUlid();
    const heads = { igstPaise: input.igstPaise, cgstPaise: input.cgstPaise, sgstPaise: input.sgstPaise, cessPaise: input.cessPaise };
    insertGstPayment(db, {
      id, businessId: till.businessId, branchId: till.branchId, terminalId: till.terminalId, seriesId, docNumber: number.number, docSeq: number.seq,
      docDate: input.paymentDate, fy, month: input.month ?? null, challanRef: input.challanRef, ...heads,
      totalPaise: heads.igstPaise + heads.cgstPaise + heads.sgstPaise + heads.cessPaise, note: input.note ?? null, commandId: input.commandId,
    }, actor);
    const journal = postDocumentJournal(db, 'gst_payment', id, till, actor);
    recordChange(db, till.businessId, actor, {
      action: 'gst.payment', entityType: 'gst_payment', entityId: id, operationType: 'create',
      after: { ...getGstPayment(db, id), ...documentKeys(db, 'gst_payment', id), month: input.month ?? null, journal },
    });
    return id;
  }
}
