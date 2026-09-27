import type { Db } from './open.js';

/**
 * The transaction boundary. `BEGIN IMMEDIATE` takes the write lock up front so two writers cannot
 * interleave; better-sqlite3 rolls back automatically if fn throws. Nested calls join the outer txn.
 */
export function withTransaction<T>(db: Db, fn: () => T): T {
  if (db.inTransaction) return fn();
  return db.transaction(fn).immediate();
}

export function nowIso(): string {
  return new Date().toISOString();
}
