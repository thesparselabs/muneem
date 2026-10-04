import type { LatePosting, Period } from '@muneem/contracts';
import { listLatePostings, listPeriods, lockPeriod, unlockPeriod } from '@muneem/db-sqlite';
import type { PosContext } from '../pos/posContext.js';

export class PeriodService {
  constructor(private readonly ctx: PosContext) {}

  list(): Period[] { return listPeriods(this.ctx.db(), this.ctx.businessId()); }
  lock(periodStart: string): Period { return lockPeriod(this.ctx.db(), this.ctx.businessId(), periodStart, this.ctx.today(), this.ctx.actor()); }
  unlock(periodStart: string, reason: string): Period { return unlockPeriod(this.ctx.db(), this.ctx.businessId(), periodStart, reason, this.ctx.actor()); }
  latePostings(): LatePosting[] { return listLatePostings(this.ctx.db(), this.ctx.businessId()); }
}
