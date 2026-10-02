import { AppError, type CashMovementInput, type RegisterReport, type RegisterSession } from '@muneem/contracts';
import { expectedCash, newUlid } from '@muneem/domain';
import type { Db } from '../open.js';
import { stmt } from '../statements.js';
import { nowIso, withTransaction } from '../uow.js';
import type { Actor } from './business.js';
import { recordChange, syncColumns } from './catalogWrite.js';

type SessionRow = {
  id: string; business_id: string; branch_id: string; terminal_id: string; session_no: number; status: RegisterSession['status'];
  opened_at: string; opened_by: string; opening_cash_paise: number; closed_at: string | null; z_report_json: string | null;
};
const toSession = (r: SessionRow): RegisterSession => ({
  id: r.id, terminalId: r.terminal_id, sessionNo: r.session_no, status: r.status, openedAt: r.opened_at, openedBy: r.opened_by,
  openingCashPaise: r.opening_cash_paise, ...(r.closed_at !== null && { closedAt: r.closed_at }),
});

export interface Till { businessId: string; branchId: string; terminalId: string }

function sessionRow(db: Db, id: string): SessionRow | undefined {
  return stmt(db, 'SELECT * FROM pos_session WHERE id = ?').get(id) as SessionRow | undefined;
}

export function getSession(db: Db, id: string): (RegisterSession & { businessId: string; branchId: string }) | null {
  const r = sessionRow(db, id);
  return r ? { ...toSession(r), businessId: r.business_id, branchId: r.branch_id } : null;
}

export function getOpenSession(db: Db, businessId: string, terminalId: string): RegisterSession | null {
  const r = stmt(db, "SELECT * FROM pos_session WHERE business_id = ? AND terminal_id = ? AND status <> 'closed'").get(businessId, terminalId) as SessionRow | undefined;
  return r ? toSession(r) : null;
}

export function lastClosedSession(db: Db, businessId: string, terminalId: string): RegisterSession | null {
  const r = stmt(db, "SELECT * FROM pos_session WHERE business_id = ? AND terminal_id = ? AND status = 'closed' ORDER BY session_no DESC LIMIT 1")
    .get(businessId, terminalId) as SessionRow | undefined;
  return r ? toSession(r) : null;
}

export function openSession(db: Db, till: Till, openingCashPaise: number, actor: Actor): RegisterSession {
  return withTransaction(db, () => {
    if (getOpenSession(db, till.businessId, till.terminalId)) throw new AppError('INVALID_STATE', 'This register is already open');
    const sessionNo = (stmt(db, 'SELECT COALESCE(MAX(session_no), 0) + 1 FROM pos_session WHERE business_id = ? AND terminal_id = ?')
      .pluck().get(till.businessId, till.terminalId) as number);
    const id = newUlid();
    const s = syncColumns(actor);
    stmt(db, `INSERT INTO pos_session (id, business_id, branch_id, terminal_id, session_no, opened_by, opened_at, opening_cash_paise,
        created_at, updated_at, created_by, device_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(id, till.businessId, till.branchId, till.terminalId, sessionNo, actor.userId, s.t,
      openingCashPaise, s.t, s.t, s.created_by, s.device_id);
    const session = toSession(sessionRow(db, id)!);
    recordChange(db, till.businessId, actor, { action: 'register.open', entityType: 'pos_session', entityId: id, operationType: 'create', after: session });
    return session;
  });
}

export function addCashMovement(db: Db, sessionId: string, input: CashMovementInput, actor: Actor): void {
  withTransaction(db, () => {
    const session = sessionRow(db, sessionId);
    if (!session || session.status !== 'open') throw new AppError('REGISTER_NOT_OPEN', 'Open the register first');
    const id = newUlid();
    const s = syncColumns(actor);
    stmt(db, `INSERT INTO cash_movement (id, business_id, session_id, kind, amount_paise, reason, created_at, updated_at, created_by, device_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(id, session.business_id, sessionId, input.kind, input.amountPaise, input.reason, s.t, s.t, s.created_by, s.device_id);
    recordChange(db, session.business_id, actor, {
      action: `register.${input.kind}`, entityType: 'cash_movement', entityId: id, operationType: 'create', after: { id, sessionId, ...input },
    });
  });
}

export function heldBillCount(db: Db, businessId: string, terminalId: string): number {
  return stmt(db, 'SELECT COUNT(*) FROM held_bill WHERE business_id = ? AND terminal_id = ?').pluck().get(businessId, terminalId) as number;
}

// Live totals of a session: the X report while open, and the basis of the Z report at close.
export function sessionReport(db: Db, sessionId: string): RegisterReport {
  const s = sessionRow(db, sessionId);
  if (!s) throw new Error('NOT_FOUND');
  const sales = stmt(db, `SELECT COUNT(*) AS n, COALESCE(SUM(total_paise), 0) AS total, COALESCE(SUM(cgst_paise + sgst_paise + igst_paise + cess_paise), 0) AS tax,
      COALESCE(SUM(change_paise), 0) AS change FROM sale WHERE session_id = ? AND status = 'posted'`).get(sessionId) as { n: number; total: number; tax: number; change: number };
  const byTender = stmt(db, `SELECT t.method, SUM(t.amount_paise - t.change_paise) AS amountPaise
    FROM sale_tender t JOIN sale x ON x.id = t.sale_id WHERE x.session_id = ? AND x.status = 'posted' GROUP BY t.method ORDER BY t.method`)
    .all(sessionId) as { method: string; amountPaise: number }[];
  const cashTendered = stmt(db, `SELECT COALESCE(SUM(t.amount_paise), 0) FROM sale_tender t JOIN sale x ON x.id = t.sale_id
    WHERE x.session_id = ? AND x.status = 'posted' AND t.method = 'cash'`).pluck().get(sessionId) as number;
  const moved = (kind: string) =>
    stmt(db, 'SELECT COALESCE(SUM(amount_paise), 0) FROM cash_movement WHERE session_id = ? AND kind = ?').pluck().get(sessionId, kind) as number;
  const flows = {
    openingPaise: s.opening_cash_paise, cashTenderedPaise: cashTendered, changeGivenPaise: sales.change,
    cashInPaise: moved('cash_in'), cashOutPaise: moved('cash_out'), safeDropPaise: moved('safe_drop'),
  };
  return {
    sessionId, sessionNo: s.session_no, final: false, openedAt: s.opened_at, openingCashPaise: s.opening_cash_paise,
    salesCount: sales.n, salesTotalPaise: sales.total, taxPaise: sales.tax, byTender, changeGivenPaise: sales.change,
    cashInPaise: flows.cashInPaise, cashOutPaise: flows.cashOutPaise, safeDropPaise: flows.safeDropPaise,
    expectedCashPaise: expectedCash(flows),
  };
}

export function zReport(db: Db, sessionId: string): RegisterReport | null {
  const json = sessionRow(db, sessionId)?.z_report_json;
  return json ? (JSON.parse(json) as RegisterReport) : null;
}

export interface CloseInput { countedCashPaise: number; denominations?: Record<string, number> | undefined; approvedBy: string | null; varianceLimitPaise: number }

export function closeSession(db: Db, sessionId: string, input: CloseInput, actor: Actor): RegisterReport {
  return withTransaction(db, () => {
    const s = sessionRow(db, sessionId);
    if (!s || s.status !== 'open') throw new AppError('REGISTER_NOT_OPEN', 'This register is not open');
    if (heldBillCount(db, s.business_id, s.terminal_id) > 0) {
      throw new AppError('INVALID_STATE', 'Finish or discard the held bills before closing the register');
    }
    const live = sessionReport(db, sessionId);
    const expected = live.expectedCashPaise!;
    const variance = input.countedCashPaise - expected;
    if (Math.abs(variance) > input.varianceLimitPaise && !input.approvedBy) {
      throw new AppError('PERMISSION_DENIED', 'The cash is off by more than the allowed amount; a manager must close this register');
    }
    const closedAt = nowIso();
    const z: RegisterReport = { ...live, final: true, closedAt, countedCashPaise: input.countedCashPaise, variancePaise: variance };
    stmt(db, `UPDATE pos_session SET status = 'closed', closed_by = ?, closed_at = ?, expected_cash_paise = ?, counted_cash_paise = ?,
        variance_paise = ?, denomination_json = ?, variance_approved_by = ?, z_report_json = ?, updated_at = ?, version = version + 1, sync_state = 'pending'
      WHERE id = ? AND status = 'open'`).run(actor.userId, closedAt, expected, input.countedCashPaise, variance,
      input.denominations ? JSON.stringify(input.denominations) : null, Math.abs(variance) > input.varianceLimitPaise ? input.approvedBy : null,
      JSON.stringify(z), closedAt, sessionId);
    recordChange(db, s.business_id, actor, { action: 'register.close', entityType: 'pos_session', entityId: sessionId, operationType: 'update', after: z });
    return z;
  });
}
