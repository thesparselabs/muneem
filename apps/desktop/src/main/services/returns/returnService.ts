import {
  AppError, type CancelSaleInput, type CompleteReturnInput, type CompleteReturnResult, type CreditNote, type CreditNoteListInput, type CreditNotePage,
  type ReceiptDoc, type ReturnDraft, type ReturnQuote,
} from '@muneem/contracts';
import { formatRupees as rupees, newUlid } from '@muneem/domain';
import {
  creditNoteIdByCommand, firstPrintJobFor, getBranch, getBusiness, getCreditNote, getOpenSession, listCreditNotes, returnedSoFar, soldItems, withTransaction,
} from '@muneem/db-sqlite';
import type { PosContext } from '../pos/posContext.js';
import { runCreditNoteCommit } from './creditNoteCommit.js';
import { assertReturnable, planReturn, quoteOf, type ReturnRequest } from './returnPlanner.js';

const DEFAULT_FOOTER = ['Thank you! Visit again.'];

export type AfterReturn = (result: CompleteReturnResult & { openDrawer: boolean }) => void;
interface Issue { request: ReturnRequest; commandId: string; reason: string; kind: 'return' | 'cancel'; expectedTotalPaise?: number }

// Sale returns, credit notes and same-document cancellation (ADR-0043).
export class ReturnService {
  constructor(private readonly ctx: PosContext, private readonly cashierName: () => string, private readonly afterCommit: AfterReturn = () => undefined) {}

  quote(draft: ReturnDraft): ReturnQuote {
    return quoteOf(planReturn(this.ctx.db(), this.ctx.businessId(), draft));
  }

  complete(input: CompleteReturnInput): CompleteReturnResult {
    return this.issue({ request: input, commandId: input.commandId, reason: input.reason, kind: 'return', expectedTotalPaise: input.expectedTotalPaise });
  }

  // A cancel is the whole bill back on one credit note; a bill with anything already returned is returned line by line instead.
  cancel(input: CancelSaleInput): CompleteReturnResult {
    const commandId = input.commandId ?? newUlid();
    const replay = this.replay(commandId);
    if (replay) return replay;
    if (returnedSoFar(this.ctx.db(), input.saleId).notes > 0) {
      throw new AppError('INVALID_STATE', 'Part of this bill has already been returned; return the rest line by line instead');
    }
    const lines = soldItems(this.ctx.db(), input.saleId).map((i) => ({ lineNo: i.lineNo, qtyMilli: i.qtyMilli }));
    return this.issue({ request: { saleId: input.saleId, lines, refundMethod: input.refundMethod }, commandId, reason: input.reason, kind: 'cancel' });
  }

  get(id: string): CreditNote {
    const note = getCreditNote(this.ctx.db(), id);
    if (!note || note.businessId !== this.ctx.businessId()) throw new AppError('NOT_FOUND', 'Credit note not found');
    return note;
  }

  list(f: CreditNoteListInput): CreditNotePage {
    return listCreditNotes(this.ctx.db(), this.ctx.businessId(), f);
  }

  receipt(id: string): ReceiptDoc {
    this.get(id);
    const job = firstPrintJobFor(this.ctx.db(), id);
    if (!job) throw new AppError('NOT_FOUND', 'No receipt for this credit note');
    return job.doc as ReceiptDoc;
  }

  private issue(i: Issue): CompleteReturnResult {
    const replay = this.replay(i.commandId);
    if (replay) return replay;
    const db = this.ctx.db();
    let openDrawer = false;
    const result = withTransaction(db, (): CompleteReturnResult => {
      const again = this.replay(i.commandId);
      if (again) return again;
      if (i.kind === 'cancel' && returnedSoFar(db, i.request.saleId).notes > 0) throw new AppError('INVALID_STATE', 'This bill has already been returned');
      const plan = planReturn(db, this.ctx.businessId(), i.request);
      const priced = assertReturnable(plan);
      if (i.expectedTotalPaise !== undefined && priced.totalPaise !== i.expectedTotalPaise) {
        throw new AppError('TOTAL_MISMATCH', `The return now comes to ${rupees(priced.totalPaise)}; check the lines and try again`);
      }
      const till = this.ctx.till();
      const session = getOpenSession(db, till.businessId, till.terminalId);
      const cashOut = plan.refundMethod === 'cash' && plan.refundPaise > 0;
      if (cashOut && session?.status !== 'open') throw new AppError('REGISTER_NOT_OPEN', 'Open the register to refund cash');
      const s = runCreditNoteCommit({
        db, actor: this.ctx.actor(), till, sessionId: session?.status === 'open' ? session.id : null, plan, result: priced, kind: i.kind, reason: i.reason,
        commandId: i.commandId, docDate: this.ctx.today(), business: getBusiness(db, till.businessId)!, branch: getBranch(db, till.branchId)!,
        cashier: this.cashierName(), receiptFooter: this.ctx.setting('pos.receiptFooter', DEFAULT_FOOTER),
      });
      openDrawer = cashOut;
      return {
        creditNoteId: s.id, docNumber: s.number!.number, totalPaise: priced.totalPaise, refundMethod: plan.refundMethod, refundPaise: plan.refundPaise,
        creditPaise: plan.creditPaise, printJobId: s.printJobId, replayed: false,
      };
    });
    if (!result.replayed) this.notify({ ...result, openDrawer });
    return result;
  }

  private replay(commandId: string): CompleteReturnResult | null {
    const id = creditNoteIdByCommand(this.ctx.db(), this.ctx.businessId(), commandId);
    if (!id) return null;
    const n = this.get(id);
    return {
      creditNoteId: id, docNumber: n.docNumber, totalPaise: n.totalPaise, refundMethod: n.refundMethod, refundPaise: n.refundPaise, creditPaise: n.creditPaise,
      printJobId: firstPrintJobFor(this.ctx.db(), id)!.id, replayed: true,
    };
  }

  // Printing and the drawer run after COMMIT and can never undo the credit note.
  private notify(result: CompleteReturnResult & { openDrawer: boolean }): void {
    try {
      this.afterCommit(result);
    } catch {
      /* hardware is best effort */
    }
  }
}
