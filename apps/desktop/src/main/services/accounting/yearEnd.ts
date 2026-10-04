import { AppError, type FinancialYear } from '@muneem/contracts';
import { financialYearOf, fyBounds, newUlid, nextMonthStart, profitOf } from '@muneem/domain';
import {
  fyBalances, fyCloseFor, fyClosePayload, getBusiness, getSyncDevice, gstActiveMonths, insertFyClose, latestSetoffMonth, listAccounts, nextClosing, nowIso,
  postClosing, profitAndLoss, recordChange, stmt, unsentFyCloseError, updateFyClose, withTransaction, type Closing, type FyCloseRow,
} from '@muneem/db-sqlite';
import type { PosContext } from '../pos/posContext.js';

const monthsOf = (fy: string): string[] => {
  const { start, end } = fyBounds(fy);
  const out: string[] = [];
  for (let m = start; m <= end; m = nextMonthStart(m)) out.push(m);
  return out;
};
const monthName = (m: string): string => m.slice(0, 7);

// ADR-0045: a year closes once every month is locked and, under the regular scheme, its GST is set off; then its income and
// expense go to 3300 Retained Earnings. On a device that syncs, the cloud decides which device's close stands, so the
// journal posts when the close comes back accepted; a device that has never synced posts it at once.
export class YearEndService {
  constructor(private readonly ctx: PosContext) {}

  list(): FinancialYear[] {
    const db = this.ctx.db();
    const years = new Set(stmt(db, 'SELECT DISTINCT fy FROM accounting_period WHERE business_id = ?').pluck().all(this.ctx.businessId()) as string[]);
    years.add(financialYearOf(this.ctx.today()));
    return [...years].sort().reverse().map((fy) => this.year(fy));
  }

  close(fy: string): FinancialYear {
    const db = this.ctx.db();
    withTransaction(db, () => {
      const year = this.year(fy);
      if (year.status !== 'open') throw new AppError('INVALID_STATE', `${fy} is already ${year.status === 'closed' ? 'closed' : 'waiting for the cloud to accept its close'}`);
      if (year.blockers.length > 0) throw new AppError('INVALID_STATE', year.blockers[0]!);
      const id = newUlid();
      const closing = nextClosing(db, this.ctx.businessId(), fy, id, 1, this.ctx.actor());
      this.write({ id, fy, version: 1, closings: [], closedAt: null, closedBy: null }, closing, 'insert');
    });
    return this.year(fy);
  }

  // A document that reached a closed year after its close (synced in from a device that had not heard of the locks) leaves
  // income or expense behind; an adjusting closing journal moves it to 3300 as well.
  reclose(fy: string): FinancialYear {
    const db = this.ctx.db();
    withTransaction(db, () => {
      const row = fyCloseFor(db, this.ctx.businessId(), fy);
      if (!row || row.status !== 'closed') throw new AppError('INVALID_STATE', `${fy} is not closed`);
      if (row.pending) throw new AppError('INVALID_STATE', `An adjustment of ${fy} is waiting for the cloud`);
      if (fyBalances(db, this.ctx.businessId(), fy).length === 0) throw new AppError('INVALID_STATE', `Nothing has posted to ${fy} since it was closed`);
      const closing = nextClosing(db, this.ctx.businessId(), fy, row.id, row.version + 1, this.ctx.actor());
      this.write(row, closing, 'update');
    });
    return this.year(fy);
  }

  private write(row: Pick<FyCloseRow, 'id' | 'fy' | 'version' | 'closings' | 'closedAt' | 'closedBy'>, closing: Closing, how: 'insert' | 'update'): void {
    const db = this.ctx.db();
    const actor = this.ctx.actor();
    const businessId = this.ctx.businessId();
    const synced = getSyncDevice(db) !== null;
    if (!synced) postClosing(db, businessId, closing, actor);
    const next = synced
      ? { version: row.version, closings: row.closings, pending: closing }
      : { version: closing.version, closings: [...row.closings, closing], pending: null };
    if (how === 'insert') {
      const done = synced ? { status: 'requested' as const, closedAt: null, closedBy: null } : { status: 'closed' as const, closedAt: nowIso(), closedBy: actor.userId };
      insertFyClose(db, { id: row.id, businessId, fy: row.fy, ...next, ...done }, actor);
    } else {
      updateFyClose(db, row.id, { ...next, status: 'closed', closedAt: row.closedAt, closedBy: row.closedBy });
    }
    recordChange(db, businessId, actor, {
      action: how === 'insert' ? 'accounting.close_year' : 'accounting.reclose_year', entityType: 'fy_close', entityId: row.id,
      operationType: how === 'insert' ? 'create' : 'update', after: fyClosePayload(fyCloseFor(db, businessId, row.fy)!),
    });
  }

  private year(fy: string): FinancialYear {
    const db = this.ctx.db();
    const businessId = this.ctx.businessId();
    const { start, end } = fyBounds(fy);
    const ended = end < this.ctx.today();
    const locked = new Map(stmt(db, 'SELECT period_start, status FROM accounting_period WHERE business_id = ? AND fy = ?').raw().all(businessId, fy) as [string, string][]);
    const months = monthsOf(fy).map((month) => ({ month, status: locked.get(month) === 'locked' ? 'locked' as const : 'open' as const }));
    const gst = this.gst(start, end);
    const close = fyCloseFor(db, businessId, fy);
    const residue = close?.status === 'closed' ? fyBalances(db, businessId, fy) : [];
    return {
      fy, start, end, ended, status: close ? (close.status === 'closed' ? 'closed' : 'requested') : 'open', months, gst,
      blockers: close ? [] : this.blockers(ended, months, gst), profitPaise: profitAndLoss(db, { businessId, from: start, to: end }).netProfitPaise,
      residuePaise: profitOf(residue), needsReclose: residue.length > 0 && !close?.pending, closeId: close?.id ?? null, closedAt: close?.closedAt ?? null,
      closedBy: close?.closedBy ?? null, closings: close ? this.closingViews(close.closings, end) : [], pending: close !== null && (close.status === 'requested' || close.pending !== null),
      syncError: close ? unsentFyCloseError(db, businessId, close.id) : null,
    };
  }

  private gst(start: string, end: string): FinancialYear['gst'] {
    const db = this.ctx.db();
    const regular = getBusiness(db, this.ctx.businessId())?.taxScheme === 'regular';
    const lastActiveMonth = gstActiveMonths(db, this.ctx.businessId()).filter((m) => m >= start && m <= end).at(-1) ?? null;
    return { required: regular && lastActiveMonth !== null, lastActiveMonth, settledThrough: latestSetoffMonth(db, this.ctx.businessId()) };
  }

  private blockers(ended: boolean, months: FinancialYear['months'], gst: FinancialYear['gst']): string[] {
    const out: string[] = [];
    if (!ended) out.push('The year has not ended yet');
    const open = months.filter((m) => m.status === 'open').map((m) => monthName(m.month));
    if (open.length > 0) out.push(`Lock every month first; still open: ${open.join(', ')}`);
    if (gst.required && (gst.settledThrough === null || gst.settledThrough < gst.lastActiveMonth!)) {
      out.push(`Set off GST through ${monthName(gst.lastActiveMonth!)} first`);
    }
    return out;
  }

  private closingViews(closings: readonly Closing[], end: string): FinancialYear['closings'] {
    const names = new Map(listAccounts(this.ctx.db(), this.ctx.businessId()).map((a) => [a.code, a.name]));
    const nameOf = (account: object): [string, string] => ('code' in account ? [String(account.code), names.get(String(account.code)) ?? ''] : ['3300', names.get('3300') ?? 'Retained Earnings']);
    return closings.map((c) => ({
      version: c.version, entryNo: c.journal?.entryNo ?? null, entryDate: c.journal?.entryDate ?? end, profitPaise: profitOf(c.balances),
      lines: (c.journal?.lines ?? []).map((l) => { const [code, name] = nameOf(l.account); return { code, name, debitPaise: l.debitPaise, creditPaise: l.creditPaise }; }),
    }));
  }
}
