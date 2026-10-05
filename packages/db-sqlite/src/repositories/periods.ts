import { AppError } from '@muneem/contracts';
import type { Db } from '../open.js';
import { stmt } from '../statements.js';
import { nowIso, withTransaction } from '../uow.js';
import type { Actor } from './business.js';
import { recordChange } from './catalogWrite.js';
import { ensurePeriod } from './journal.js';
import { isFyClosed } from './yearEnd.js';

export interface PeriodRow {
  id: string; fy: string; periodStart: string; periodEnd: string; status: 'open' | 'locked'; lockedAt: string | null; lockedBy: string | null;
  unlockReason: string | null; journals: number; latePostings: number;
}

export function listPeriods(db: Db, businessId: string): PeriodRow[] {
  return stmt(db, `SELECT p.id, p.fy, p.period_start AS periodStart, p.period_end AS periodEnd, p.status, p.locked_at AS lockedAt, p.locked_by AS lockedBy,
      p.unlock_reason AS unlockReason, (SELECT COUNT(*) FROM journal_entry j WHERE j.period_id = p.id) AS journals,
      (SELECT COUNT(*) FROM journal_entry j WHERE j.period_id = p.id AND j.late_posting = 1) AS latePostings
    FROM accounting_period p WHERE p.business_id = ? ORDER BY p.period_start DESC`).all(businessId) as PeriodRow[];
}

// ADR-0033: only a month that has ended can be locked, so there is always an open month after a locked one.
export function lockPeriod(db: Db, businessId: string, periodStart: string, today: string, actor: Actor): PeriodRow {
  return withTransaction(db, () => {
    if (!/^\d{4}-\d{2}-01$/u.test(periodStart)) throw new AppError('VALIDATION_FAILED', 'Choose a month', { periodStart: 'the first day of a month' });
    if (periodStart > today || `${today.slice(0, 7)}-01` === periodStart) {
      throw new AppError('INVALID_STATE', 'Only a month that has ended can be locked');
    }
    const id = ensurePeriod(db, businessId, periodStart, actor);
    const t = nowIso();
    stmt(db, `UPDATE accounting_period SET status = 'locked', locked_at = ?, locked_by = ?, updated_at = ?, version = version + 1, sync_state = 'pending'
      WHERE id = ? AND status = 'open'`).run(t, actor.userId, t, id);
    const row = listPeriods(db, businessId).find((p) => p.id === id)!;
    recordChange(db, businessId, actor, { action: 'period.lock', entityType: 'accounting_period', entityId: id, operationType: 'update', after: row });
    return row;
  });
}

export function unlockPeriod(db: Db, businessId: string, periodStart: string, reason: string, actor: Actor): PeriodRow {
  return withTransaction(db, () => {
    const id = stmt(db, "SELECT id FROM accounting_period WHERE business_id = ? AND period_start = ? AND status = 'locked'").pluck().get(businessId, periodStart) as string | undefined;
    if (!id) throw new AppError('INVALID_STATE', 'That month is not locked');
    const fy = stmt(db, 'SELECT fy FROM accounting_period WHERE id = ?').pluck().get(id) as string;
    if (isFyClosed(db, businessId, fy)) throw new AppError('INVALID_STATE', `${fy} is closed; its months stay locked (ADR-0045)`);
    stmt(db, `UPDATE accounting_period SET status = 'open', unlock_reason = ?, updated_at = ?, version = version + 1, sync_state = 'pending' WHERE id = ?`)
      .run(reason, nowIso(), id);
    const row = listPeriods(db, businessId).find((p) => p.id === id)!;
    recordChange(db, businessId, actor, { action: 'period.unlock', entityType: 'accounting_period', entityId: id, operationType: 'update', after: { ...row, reason } });
    return row;
  });
}

export interface LatePosting { id: string; entryNo: string; source: string; refType: string | null; refId: string | null; docDate: string; entryDate: string; totalPaise: number }
export function listLatePostings(db: Db, businessId: string): LatePosting[] {
  return stmt(db, `SELECT id, entry_no AS entryNo, source, ref_type AS refType, ref_id AS refId, doc_date AS docDate, entry_date AS entryDate,
      debit_total_paise AS totalPaise FROM journal_entry WHERE business_id = ? AND late_posting = 1 ORDER BY entry_date DESC, id DESC`).all(businessId) as LatePosting[];
}
