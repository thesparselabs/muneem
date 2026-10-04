# ADR-0041 — The conflict matrix as built

**Status:** Accepted, 2026-10-04

## Context
LLD §9 sets a strategy per class of entity. Stage 7 implements it on the cloud, which sees every write in order.

## Decision
- **Financial documents** (sale, purchase, debit note, payment, write-off, expense, stock document, session, cash
  movement, allocation, journal) are append-only. Ids are ULIDs and numbers come from per-terminal series, so two
  devices can never collide.
  - **Cancels:** a cancel is a new version. Two cancels are idempotent, and a cancel of an unknown document is
    deferred.
- **Masters:** simple fields use field-level last-writer-wins by the payload's `updatedAt`, ties broken by device id.
  - **The baseline:** a push based on an older `version` than the cloud's is merged field by field against the version
    it was based on.
- **The cloud keeps its value** for price and tax fields (`sellingPricePaise`, `mrpPaise`, `gstRateBp`,
  `cessRateBp`, `taxTreatment`, price list items), the credit limit, users and roles, and config (settings, series,
  terminals). A device's losing edit is kept in `conflict_log`.
- **Deletes:** a tombstone wins over a concurrent update.
- **Duplicates:** a barcode created for two different products from two devices keeps both rows and adds a
  duplicate-candidate review item.
- **Recording:** every non-trivial resolution writes `conflict_log` (both versions, the rule, the winner). When the
  stored result differs from what a device sent, the change goes out with a null origin, so the sender applies the
  merge too.

## Consequences
- The device never resolves conflicts itself. It applies what the cloud sends, except that it leaves alone an entity
  with an unsent outbox row until that push lands.
- Review items are pulled to devices and listed under Settings → Review (7g).
