import { AppError } from '@muneem/contracts';
import { getBusiness, stmt } from '@muneem/db-sqlite';
import type { PosContext } from '../pos/posContext.js';

// What the GST services ask about the business and its months.
export class GstContext {
  constructor(readonly pos: PosContext) {}

  regular(): boolean { return getBusiness(this.pos.db(), this.pos.businessId())?.taxScheme === 'regular'; }

  locked(month: string): boolean {
    return stmt(this.pos.db(), 'SELECT status FROM accounting_period WHERE business_id = ? AND period_start = ?').pluck()
      .get(this.pos.businessId(), month) === 'locked';
  }

  // GST documents never post late: a locked month is refused, as manual journals are (ADR-0035, ADR-0044).
  refuseLocked(date: string): void {
    const month = `${date.slice(0, 7)}-01`;
    if (this.locked(month)) throw new AppError('PERIOD_LOCKED', `${month.slice(0, 7)} is locked`);
  }
}
