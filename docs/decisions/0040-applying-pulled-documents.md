# ADR-0040 — Applying another terminal's documents

**Status:** Accepted, 2026-10-04

## Context
Every device pulls every document (Stage 7 decision). The stock costing, the party sub-ledger and the books are
derived on each device, so a pulled sale must change them exactly as the original did. Moving-average costing depends
on order, and two offline terminals see different orders.

## Decision
- **Stored values are facts.** A pulled document is inserted with its own lines, tenders, movements (with their stored
  values and unit costs), party entries, allocations and journal. It is never re-costed, and it never generates cost
  corrections. Only the device that posted a receipt corrects costs for it, and those corrections travel inside that
  document's payload. So two devices can never both correct the same receipt.
- **The projections follow.** Stock levels, party balances and the `account_balance` cache are updated by the same
  code local writes use, from the inserted rows. Stock value is the sum of movement values, so it is the same on every
  device whatever the order of arrival. Each device's tie-outs hold by construction.
- **Movement order:** pulled movements replay by `(occurred_at, origin device, local seq)`, the same order everywhere,
  so every device's replay check agrees. This settles the Stage 4 note.
- **`postJournal` stays the only journal writer.** It gains a synced mode that takes the journal's id, number and
  entry date as given, and still writes the lines and the balance cache.
- **Natural keys:** rows each device makes on demand are matched by natural key, not id: periods by month, accounts by
  code, units, categories and expense categories by code, and the default price list by kind. A pulled journal finds
  this device's period for its month, and seeding never duplicates a row that came from the cloud.
- **Locks:** periods are cloud-authoritative and travel on the control stream, so a lock on one terminal reaches the
  others. A document from a device that had not yet heard of a lock keeps its entry date, and the cloud lists it as a
  late arrival for review rather than refusing it.
- **Echoes:** applying a pulled change writes no outbox row and no local audit row. A change whose origin is this
  device is skipped, unless the cloud merged it (its origin is then null).

## Consequences
- Two terminals can oversell the same last unit offline (FR-087). Both sales stand; stock goes negative and the stock
  reconciliation screen shows it.
- Per-product average cost is computed from the combined movement values, so a device's next sale after a sync may cost
  slightly differently than it would have alone. Both results are recorded facts.
- A Go port of costing is not needed for Stage 7 (deferred).
