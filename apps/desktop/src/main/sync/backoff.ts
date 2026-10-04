export const MAX_ATTEMPTS = 12;
const CAP_MS = 15 * 60_000;
const JITTER = 0.2;

// LLD §8.2: min(2^n s, 15 min) ± 20%, n being the attempt that just failed.
export function backoffMs(attempt: number, random: () => number): number {
  const base = Math.min(2 ** Math.max(1, attempt) * 1000, CAP_MS);
  return Math.round(base * (1 - JITTER + 2 * JITTER * random()));
}

export const nextAttemptAt = (nowMs: number, attempt: number, random: () => number): string => new Date(nowMs + backoffMs(attempt, random)).toISOString();
