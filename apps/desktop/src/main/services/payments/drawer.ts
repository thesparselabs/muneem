import { getOpenSession, insertDocumentCashMovement, isSessionOpen, type DocumentCash } from '@muneem/db-sqlite';
import type { PosContext } from '../pos/posContext.js';

// 5d details: cash goes through the drawer only when this terminal's register is open; otherwise it was outside the drawer.
export class Drawer {
  constructor(private readonly ctx: PosContext) {}

  openSessionId(): string | null {
    const till = this.ctx.till();
    const s = getOpenSession(this.ctx.db(), till.businessId, till.terminalId);
    return s?.status === 'open' ? s.id : null;
  }

  record(sessionId: string | null, m: DocumentCash): void {
    if (sessionId) insertDocumentCashMovement(this.ctx.db(), sessionId, m, this.ctx.actor());
  }

  // A cancellation reverses the cash only while the register it went through is still open.
  reverse(original: { sessionId: string; kind: string; amountPaise: number } | undefined, m: Omit<DocumentCash, 'kind' | 'amountPaise'>): 'reversed' | 'outside_drawer' {
    if (!original || !isSessionOpen(this.ctx.db(), original.sessionId)) return 'outside_drawer';
    insertDocumentCashMovement(this.ctx.db(), original.sessionId, { ...m, kind: original.kind === 'cash_in' ? 'cash_out' : 'cash_in', amountPaise: original.amountPaise }, this.ctx.actor());
    return 'reversed';
  }
}
