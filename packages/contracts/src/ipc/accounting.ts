import { z } from 'zod';
import { BusinessDate, IsoDateTime, Ulid } from './schemas.js';

const Int = z.number().int();
const MonthStart = BusinessDate.refine((d) => d.endsWith('-01'), 'the first day of a month');

export const Period = z.object({
  id: Ulid, fy: z.string(), periodStart: BusinessDate, periodEnd: BusinessDate, status: z.enum(['open', 'locked']),
  lockedAt: IsoDateTime.nullable(), lockedBy: z.string().nullable(), unlockReason: z.string().nullable(), journals: Int, latePostings: Int,
});
export type Period = z.infer<typeof Period>;
export const LockPeriodInput = z.object({ periodStart: MonthStart });
export const UnlockPeriodInput = z.object({ periodStart: MonthStart, reason: z.string().trim().min(1).max(200) });

export const LatePosting = z.object({
  id: Ulid, entryNo: z.string(), source: z.string(), refType: z.string().nullable(), refId: z.string().nullable(),
  docDate: BusinessDate, entryDate: BusinessDate, totalPaise: Int,
});
export type LatePosting = z.infer<typeof LatePosting>;

export const BacklogResult = z.object({ posted: Int, remaining: Int });
export type BacklogResult = z.infer<typeof BacklogResult>;
