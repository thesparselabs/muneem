import { DomainError } from '../errors.js';

export type AgeingBucket = 'notDue' | 'days0to30' | 'days31to60' | 'days61to90' | 'over90';

const DAY_MS = 86_400_000;

function utcDay(date: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) throw new DomainError('INVALID_INPUT', `business date expected, got ${date}`);
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) / DAY_MS;
}

export const daysPastDue = (dueDate: string, asOf: string): number => utcDay(asOf) - utcDay(dueDate);

// Aged from the due date: a bill falling due today is 0 days past due.
export function ageingBucket(dueDate: string, asOf: string): AgeingBucket {
  const days = daysPastDue(dueDate, asOf);
  if (days < 0) return 'notDue';
  if (days <= 30) return 'days0to30';
  if (days <= 60) return 'days31to60';
  if (days <= 90) return 'days61to90';
  return 'over90';
}

export function addDays(date: string, days: number): string {
  if (!Number.isSafeInteger(days)) throw new DomainError('INVALID_INPUT', `whole days expected, got ${days}`);
  return new Date((utcDay(date) + days) * DAY_MS).toISOString().slice(0, 10);
}
