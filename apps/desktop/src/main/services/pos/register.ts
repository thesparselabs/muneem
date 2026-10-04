import { AppError, type CashMovementInput, type CloseRegisterInput, type RegisterReport, type RegisterSession } from '@muneem/contracts';
import {
  addCashMovement, closeSession, getOpenSession, getSession, lastClosedSession, openSession, postDocumentJournal, queueJournal, sessionReport, withTransaction, zReport,
} from '@muneem/db-sqlite';
import type { PosContext } from './posContext.js';

export const POS_SETTINGS = {
  varianceThresholdPaise: 'pos.varianceThresholdPaise',
  blindClose: 'pos.blindClose',
  roundToRupee: 'pos.roundToRupee',
  b2clThresholdPaise: 'gst.b2clThresholdPaise',
} as const;
export const INVENTORY_SETTINGS = { negativeStock: 'inventory.negativeStock' } as const;
const DEFAULT_VARIANCE_THRESHOLD_PAISE = 10_000;

export class RegisterService {
  constructor(private readonly ctx: PosContext) {}

  current(): RegisterSession | null {
    const till = this.ctx.till();
    return getOpenSession(this.ctx.db(), till.businessId, till.terminalId);
  }

  requireOpen(): RegisterSession {
    const s = this.current();
    if (!s) throw new AppError('REGISTER_NOT_OPEN', 'Open the register before billing');
    return s;
  }

  open(openingCashPaise: number): RegisterSession { return openSession(this.ctx.db(), this.ctx.till(), openingCashPaise, this.ctx.actor()); }

  // Cash in or out without a document waits in 1199 Cash to classify; a safe drop moves cash to cash and posts nothing (ADR-0032).
  cashMovement(input: CashMovementInput): void {
    const db = this.ctx.db();
    withTransaction(db, () => {
      const id = addCashMovement(db, this.requireOpen().id, input, this.ctx.actor());
      queueJournal(db, this.ctx.businessId(), this.ctx.actor(), postDocumentJournal(db, 'cash_movement', id, this.ctx.till(), this.ctx.actor(), this.ctx.today()), id);
    });
  }

  // With blind close on, only someone who may approve variances sees the expected cash before counting.
  xReport(): RegisterReport {
    const report = sessionReport(this.ctx.db(), this.requireOpen().id);
    const blind = this.ctx.setting(POS_SETTINGS.blindClose, false) && !this.ctx.can('pos.approve');
    return blind ? { ...report, expectedCashPaise: null } : report;
  }

  zReport(sessionId?: string): RegisterReport | null {
    const till = this.ctx.till();
    const id = sessionId ?? lastClosedSession(this.ctx.db(), till.businessId, till.terminalId)?.id;
    if (!id) return null;
    const session = getSession(this.ctx.db(), id);
    if (!session || session.businessId !== till.businessId) throw new Error('NOT_FOUND');
    return zReport(this.ctx.db(), id);
  }

  close(input: CloseRegisterInput): RegisterReport {
    const db = this.ctx.db();
    return withTransaction(db, () => {
      const sessionId = this.requireOpen().id;
      const report = this.closeSession(sessionId, input);
      const journal = postDocumentJournal(db, 'register_close', sessionId, this.ctx.till(), this.ctx.actor(), this.ctx.today());
      queueJournal(db, this.ctx.businessId(), this.ctx.actor(), journal, sessionId);
      return report;
    });
  }

  private closeSession(sessionId: string, input: CloseRegisterInput): RegisterReport {
    return closeSession(this.ctx.db(), sessionId, {
      countedCashPaise: input.countedCashPaise,
      denominations: input.denominations,
      approvedBy: this.ctx.can('pos.approve') ? this.ctx.userId() : null,
      varianceLimitPaise: this.ctx.setting(POS_SETTINGS.varianceThresholdPaise, DEFAULT_VARIANCE_THRESHOLD_PAISE),
    }, this.ctx.actor());
  }
}
