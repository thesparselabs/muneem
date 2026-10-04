export interface RetentionPolicy { daily: number; weekly: number; monthly: number; safetyCopies: number }

// ADR-0047: 7 daily, 4 weekly and 3 monthly routine backups; safety copies (pre-migration, pre-restore) keep their last few.
export const DEFAULT_RETENTION: RetentionPolicy = { daily: 7, weekly: 4, monthly: 3, safetyCopies: 3 };

export interface Retainable { id: string; kind: string; createdAt: string }

const SAFETY_KINDS = new Set(['pre_migration', 'pre_restore']);

const day = (iso: string) => iso.slice(0, 10);
const month = (iso: string) => iso.slice(0, 7);

// ISO week (Monday start) as "YYYY-Www", in UTC like the timestamps.
function week(iso: string): string {
  const d = new Date(`${day(iso)}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const n = Math.ceil(((d.getTime() - Date.UTC(d.getUTCFullYear(), 0, 1)) / 86_400_000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(n).padStart(2, '0')}`;
}

// The newest backup of each of the most recent `count` buckets.
function newestPerBucket(sorted: Retainable[], bucket: (iso: string) => string, count: number): string[] {
  const kept: string[] = [];
  const seen = new Set<string>();
  for (const b of sorted) {
    const k = bucket(b.createdAt);
    if (seen.has(k)) continue;
    if (seen.size === count) break;
    seen.add(k);
    kept.push(b.id);
  }
  return kept;
}

// Which backups to delete: everything no rule keeps. The newest backup is always kept.
export function backupsToPrune(backups: readonly Retainable[], policy: RetentionPolicy = DEFAULT_RETENTION): string[] {
  const newestFirst = [...backups].sort((a, b) => (a.createdAt === b.createdAt ? b.id.localeCompare(a.id) : b.createdAt.localeCompare(a.createdAt)));
  const routine = newestFirst.filter((b) => !SAFETY_KINDS.has(b.kind));
  const keep = new Set<string>([
    ...newestPerBucket(routine, day, policy.daily),
    ...newestPerBucket(routine, week, policy.weekly),
    ...newestPerBucket(routine, month, policy.monthly),
    ...newestFirst.filter((b) => SAFETY_KINDS.has(b.kind)).slice(0, policy.safetyCopies).map((b) => b.id),
  ]);
  return newestFirst.filter((b) => !keep.has(b.id)).map((b) => b.id);
}
