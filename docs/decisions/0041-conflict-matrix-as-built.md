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
  - **The payload of a later version** is the create payload with the later operation's payload under its operation
    type: `{ ...create, cancel: {...} }`, or `update` for a register close. A device that missed the create can still
    file the whole document, and hydration needs nothing else (amended in 7d/7e).
- **Masters:** simple fields use field-level last-writer-wins by the payload's `updatedAt`, ties broken by device id.
  - **The baseline:** a push based on an older `version` than the cloud's is merged field by field against the version
    it was based on.
- **The cloud keeps its value** for price and tax fields (`sellingPricePaise`, `mrpPaise`, `gstRateBp`,
  `cessRateBp`, `taxTreatment`, price list items), the credit limit, users and roles, and config (settings, series,
  terminals). A device's losing edit is kept in `conflict_log`.
  - **Price list items** carry no version. A product's items in one list are replaced whole, and the operation names
    the items it replaced (`retired`). When those are not the cloud's current items, the edit was made from a stale
    copy: the cloud keeps its items and sends them back with a null origin (amended in 7d).
- **Deletes:** a tombstone wins over a concurrent update.
- **Duplicates:** a barcode created for two different products from two devices keeps both rows and adds a
  duplicate-candidate review item.
- **Recording:** every non-trivial resolution writes `conflict_log` (both versions, the rule, the winner). When the
  stored result differs from what a device sent, the change goes out with a null origin, so the sender applies the
  merge too.
- **On the wire** (amended in 7d): review items are `conflict_log` changes on the control stream, with
  `{ id, kind, entityType, entityId, deviceId, rule, winner, field?, cloudValue?, deviceValue?, at }`. `kind` is
  `conflict`, `tombstone`, `duplicate_barcode` or `late_arrival`. A revocation is a `device` change on the control
  stream, `{ deviceId, status: 'revoked' }`.

## Consequences
- The device never resolves conflicts itself. It applies what the cloud sends, except that it leaves alone an entity
  with an unsent outbox row until that push lands.
- A pulled barcode whose code is already live on another product on this device is not stored here; the review item
  explains the clash (the device's unique index allows one live code).
- Review items are pulled to devices and listed under Settings → Review (7g).

## As built (7c)
- **Versions:** a payload's `version` is the version it creates, so it was based on `version − 1`. A write based on
  the cloud's current version (or newer, after superseded edits) replaces it and keeps the device's version. A write
  based on an older one is merged against the stored payload of that version (from `change_log`), and the result is
  stamped with the cloud's next version. Payloads without a `version` (accounts, warehouses, series, settings, price
  list items) cannot be compared, so they replace in arrival order.
- **Fields** are a payload's top-level keys; arrays such as a product's barcodes compare whole. `updatedAt` follows the
  winner and is not listed as a conflict.
- **Tombstones:** an operation of type `void`, or a payload with `deletedAt`/`deleted_at`, deletes. A later write to a
  deleted entity changes nothing; the delete goes out again with a null origin and a `tombstone_wins` review item.
- **Review items:** `conflict_log.kind` is `field_conflict`, `tombstone_wins`, `duplicate_barcode` or `late_arrival`.
  Each row also goes down the control stream as a `review_item` change with `{id, kind, entityType, entityId,
  deviceId, operationId, serverSeq, detail}`.
- **Late arrivals:** a document whose journal is dated in a month whose latest pushed `accounting_period` row is
  `locked` is stored as sent, and a `late_arrival` review item is added (ADR-0040).
