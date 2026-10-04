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
  - **As built (7e):** a movement's payload carries its origin's `deviceId` (the installation id), stored as its
    `device_id`. The replay orders by `(occurred_at, device_id, id)`; ids are monotonic ULIDs per device, so `id` is
    the origin's own order.
- **`postJournal` stays the only journal writer.** It gains a synced mode that takes the journal's id, number and
  entry date as given, and still writes the lines and the balance cache.
- **Natural keys:** rows each device makes on demand are matched by natural key, not id: periods by month, accounts by
  code, units, categories and expense categories by code, and the default price list by kind. A pulled journal finds
  this device's period for its month, and seeding never duplicates a row that came from the cloud.
  - **As built (7e):** a pulled row that matches a local one by natural key is not inserted; `sync_id_alias` maps its
    id to the local id, and every reference to it in later payloads resolves through the alias. Brands (by name),
    other price lists (by name) and warehouses (by code, the branch's code) are matched the same way, since their
    unique indexes would refuse a second row.
  - **A device that has not got the business yet** pulls the config stream first, so the control stream's locks and
    review items have a business to belong to.
- **Locks:** periods are cloud-authoritative and travel on the control stream, so a lock on one terminal reaches the
  others. A document from a device that had not yet heard of a lock keeps its entry date, and the cloud lists it as a
  late arrival for review rather than refusing it.
- **Echoes:** applying a pulled change writes no outbox row and no local audit row. A change whose origin is this
  device is skipped, unless the cloud merged it (its origin is then null).

- **As built (7f-2):**
  - **Own echoes:** a document's own echo is skipped; a master's or config's is applied. The device adopts the cloud's
    version, and a merged (null-origin) version pulled on the same page no longer overwrites what the device sent
    last. Without this, prices and product versions diverged between terminals (found by the 7h simulation).
  - **Cost corrections travel as movements too:** a receipt's payload carries `correctionMovements` (the zero-qty
    `cost_correction` rows it made) beside the `corrections` journals, so stock value matches on every device.
  - **Unique clashes:** a pulled customer or supplier GSTIN, product SKU, terminal code or invoice prefix, or branch
    code held by another row here goes to the lower id on every device. The other row's value is cleared (a supplier
    becomes unregistered, as the schema requires) or replaced by the next free variant (codes, prefixes), and a local
    `unique_clash` review item records both. Rows are never merged by GSTIN: parties are referenced by id everywhere.
  - **Nothing blocks a stream:** each change applies in its own savepoint. One that still fails is rolled back,
    recorded as an `apply_failed` review item with its error, and skipped; the cursor advances. It surfaces in Review
    Items, in the sync status detail (`sync_log.last_error`) and in the sync log.
  - **Hydration (7f):** a device adds a business from a bundle (ADR-0038) through the same apply functions, in pages
    of 500. Each page and `hydration_state.lines_imported` commit together. Config is imported first, then the rest in
    bundle order. Own changes are applied too (`includeOwn`). At the end every cursor is set to `asOfSeq`, then a
    normal pull runs. Until then the business is *held*: sync does not run for it, IPC other than sign-in, sync,
    diagnostics and `business.get` is refused, and nothing is seeded (FR-086). In the app a business not on the
    device is held until hydrated; tests may still cold-pull it (`coldStart: 'pull'`).
  - **Who may start it:** `sync.hydrationStart` has no RBAC permission, because grants belong to the session's business
    and a device being added has none open. The handler requires a session and a cached membership of the chosen
    business, and the cloud checks membership again on bootstrap.

## Consequences
- Two terminals can oversell the same last unit offline (FR-087). Both sales stand; stock goes negative and the stock
  reconciliation screen shows it.
- Per-product average cost is computed from the combined movement values, so a device's next sale after a sync may cost
  slightly differently than it would have alone. Both results are recorded facts.
- A Go port of costing is not needed for Stage 7 (deferred).
