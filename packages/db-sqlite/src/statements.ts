import type { Statement } from 'better-sqlite3';
import type { Db } from './open.js';

const cache = new WeakMap<Db, Map<string, Statement>>();

// Hot-path queries (barcode lookup, search) reuse their compiled statement per connection (ADR-0012).
export function stmt(db: Db, sql: string): Statement {
  let perDb = cache.get(db);
  if (!perDb) {
    perDb = new Map();
    cache.set(db, perDb);
  }
  let s = perDb.get(sql);
  if (!s) {
    s = db.prepare(sql);
    perDb.set(sql, s);
  }
  return s;
}
