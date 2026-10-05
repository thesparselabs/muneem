import type { Statement } from 'better-sqlite3';
import type { Db } from '@muneem/db-sqlite';

type Method = 'run' | 'get' | 'all' | 'iterate';
const METHODS: readonly Method[] = ['run', 'get', 'all', 'iterate'];

// Records the SQL a path really executes on one connection, so the plan check follows the code instead of a copied list.
export class StatementRecorder {
  private readonly seen = new Map<string, Set<string>>();
  private readonly originals = new Map<Method, (...args: unknown[]) => unknown>();
  private label: string | null = null;

  constructor(private readonly dbs: readonly Db[]) {
    const proto = Object.getPrototypeOf(dbs[0]!.prepare('SELECT 1')) as Record<Method, (...args: unknown[]) => unknown>;
    for (const m of METHODS) {
      const original = proto[m];
      this.originals.set(m, original);
      const note = (s: Statement) => { if (this.label && this.dbs.includes(s.database)) this.note(this.label, s.source); };
      proto[m] = function (this: Statement, ...args: unknown[]) {
        note(this);
        return original.apply(this, args);
      };
    }
  }

  async during<T>(label: string, fn: () => T | Promise<T>): Promise<T> {
    this.label = label;
    try { return await fn(); } finally { this.label = null; }
  }

  statements(): Map<string, Set<string>> { return this.seen; }

  restore(): void {
    const proto = Object.getPrototypeOf(this.dbs[0]!.prepare('SELECT 1')) as Record<Method, unknown>;
    for (const [m, original] of this.originals) proto[m] = original;
  }

  private note(label: string, sql: string): void {
    const labels = this.seen.get(sql) ?? new Set<string>();
    labels.add(label);
    this.seen.set(sql, labels);
  }
}

// Unbound parameters plan the same as bound ones; NULL stands in for each.
function placeholders(sql: string): unknown[] | Record<string, null> {
  const named = [...sql.matchAll(/[@:$]([A-Za-z_]\w*)/g)].map((m) => m[1]!);
  if (named.length > 0) return Object.fromEntries(named.map((n) => [n, null]));
  const positional = sql.replace(/'[^']*'/g, '').split('?').length - 1;
  return Array.from({ length: positional }, () => null);
}

export function queryPlan(db: Db, sql: string): string[] {
  const s = db.prepare(`EXPLAIN QUERY PLAN ${sql}`);
  const args = placeholders(sql);
  const rows = (Array.isArray(args) ? s.all(...args) : s.all(args)) as { detail: string }[];
  return rows.map((r) => r.detail);
}
