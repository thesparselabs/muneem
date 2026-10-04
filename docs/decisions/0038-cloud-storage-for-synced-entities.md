# ADR-0038 — Cloud storage for synced entities

**Status:** Accepted, 2026-10-04

## Context
Stage 7 must store every entity the devices push (33 types, LLD §2.6) so it can verify them, hand them to other
devices and build hydration bundles. The cloud does not report on them until Stage 8. Giving every entity a typed
Postgres table now would double the schema work, and it would have to change whenever a payload gains a field.

## Decision
- **Every entity** is stored as its latest payload in
  `entity_state(business_id, entity_type, entity_id, version, payload jsonb, origin_device_id, deleted_at)`.
  - **Financial documents** are insert-only: a cancel is a new version whose payload records the cancel.
  - **Masters and config** are updated in place under the conflict rules (ADR-0041).
- **Journals** are also projected into typed `journal_entry` and `journal_line` tables in the same transaction. This
  lets the cloud compute a Trial Balance, and lets §37 compare it with each device's.
- **Every accepted write** appends one `change_log` row in the same transaction. Its `BIGSERIAL` seq is the pull cursor
  and the hydration watermark.
- **Rejected operations** keep their full payload in `dead_letter`. Nothing is dropped and nothing is silently fixed.

## Consequences
- Verification reads the payload JSON. Typed tables for reports (sales, stock, parties) are added in Stage 8, built
  from `entity_state`, which already holds everything.
- A payload that gains a field needs no cloud migration.
- Hydration bundles are a straight read of `entity_state` (ADR-0042, 7f).

## As built (7b)
- **Documents keep every version in `change_log`.** `entity_state` holds only the latest version, so for a cancelled
  document it holds the cancel. A hydration bundle (7f) must therefore send the documents stream from `change_log`
  (create, then cancel or close), and masters, config and control from `entity_state`.
- **`writer_device_id`** on `entity_state` is the last signed pusher, even when the change went out with a null
  origin. It breaks last-writer-wins ties (ADR-0041).
- **Cloud-made entities** share the tables: `review_item` (one per `conflict_log` row) and `device` (a revocation),
  both on the control stream.
- **Idempotency rows** (`sync_operation`) are kept for applied and rejected operations. A rejected operation sent again
  with the same payload is verified again rather than answered as a duplicate, so a fixed cloud can accept a resend.
- **Writes serialize per business.** Each operation's transaction takes a per-business advisory lock before it reads
  anything, so `change_log` seqs commit in seq order and a device paging by seq never steps past a change still in
  flight. Two pushes of the same operation (a double submit) therefore apply it once.
