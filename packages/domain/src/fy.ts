import { DomainError } from './errors.js';
import { addDays } from './parties/ageing.js';

/**
 * Indian financial year: 1 April – 31 March. '2026-04-01' → '2026-27'; '2026-03-31' → '2025-26'.
 * Input is a business date 'YYYY-MM-DD' (or an ISO timestamp, of which only the date part is used).
 * No timezone maths here: the caller decides the business date.
 */
export function financialYearOf(businessDate: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(businessDate);
  if (!m) throw new DomainError('INVALID_INPUT', `bad business date: ${businessDate}`);
  const year = Number(m[1]);
  const month = Number(m[2]);
  if (month < 1 || month > 12) throw new DomainError('INVALID_INPUT', `bad month in ${businessDate}`);
  const startYear = month >= 4 ? year : year - 1;
  return `${startYear}-${String((startYear + 1) % 100).padStart(2, '0')}`;
}

export function fyBounds(fy: string): { start: string; end: string } {
  const m = /^(\d{4})-(\d{2})$/.exec(fy);
  if (!m) throw new DomainError('INVALID_INPUT', `bad FY: ${fy}`);
  const y = Number(m[1]);
  return { start: `${y}-04-01`, end: `${y + 1}-03-31` };
}

// Calendar arithmetic on business dates 'YYYY-MM-DD', in UTC so no timezone can shift a day.
export const dayBefore = (date: string): string => addDays(date, -1);
export const monthStart = (date: string): string => `${date.slice(0, 7)}-01`;
export const monthEnd = (date: string): string => new Date(Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)), 0)).toISOString().slice(0, 10);
export const nextMonthStart = (date: string): string => addDays(monthEnd(date), 1);
export const fyStartOf = (date: string): string => fyBounds(financialYearOf(date)).start;
