# ADR-0012 — Cached prepared statements and a barcode LRU for the scan path

**Status:** Accepted, 2026-09-30

## Context
The Stage 2 exit criterion is barcode lookup under 30 ms (LLD §18), measured at 5,000 SKUs. Repositories so far call
`db.prepare` on every call, which recompiles the SQL each time.

## Decision
- `stmt(db, sql)` in `@muneem/db-sqlite` caches compiled statements per connection in a `WeakMap`. Barcode lookup and
  search use it; other repositories may keep `db.prepare` until they become hot.
- The product service keeps a 500-entry LRU of barcode → search hit. Any product, barcode or price write clears it.

## Consequences
- A cached statement lives as long as its connection; closing the connection releases it.
- Clearing the whole LRU on any catalog write is simple and correct; catalog writes are rare compared with scans.
