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

## As built (7f) — hydration bundles
- **Contents:** gzipped NDJSON. Line 1 is `BundleHeader {format: 'muneem-bundle', version: 1, businessId, asOfSeq,
  counts}`, where `counts` is change lines per stream. Every other line is a pull `Change`, in `STREAM_ORDER`
  (control, config, masters, documents).
  - **Control, config and masters** are each entity's latest `entity_state` row: `seq` is its `last_seq`, and a
    tombstone is sent as `op: "delete"` with its last payload, as pull would send it. Within a stream they go by entity
    type in `STREAM_OF`'s declaration order (referenced types first, so a barcode never precedes its product), then
    by seq. The cloud-made control types (`device`, `review_item`) follow `accounting_period`.
  - **Documents** are every `change_log` version in seq order: a cancelled document arrives as its create, then its
    cancel.
  - **Consistency:** one read-only repeatable-read transaction. Writes commit in seq order under the per-business
    lock, so `asOfSeq` (the highest seq read) has no gaps below it. The device sets every stream cursor to `asOfSeq`,
    then pulls.
- **Building:** `POST /sync/bootstrap` reuses a building row less than 15 minutes old, or a ready bundle at most
  1,000 changes behind whose expiry is more than an hour away. Otherwise it records a `building` row and builds in a
  goroutine, with at most 2 builds at once. The bundle streams from Postgres through a pipe into a multipart upload,
  so it is never held whole in memory. A ready bundle lives 24 hours. A build that fails, or runs past 15 minutes, is
  reported as `failed`.
- **Delivery:** `GET /sync/bootstrap/{id}` presigns a fresh GET URL on every call. Its `expiresAt` is the URL's
  expiry: one hour, or the bundle's expiry if that comes sooner. S3 serves `Range`, so a download resumes, and an
  expired URL is renewed by asking again.
- **Who may bootstrap:** a signed, active device of a user who is a member of the business. The device need not be
  bound to the business yet (a device being added), but one already bound to another business is refused.
  Bootstrapping does not bind it; its first push does. Migration 0003 lets a member read a snapshot row by id
  before any business scope is set.
- **Storage:** an S3-compatible bucket behind `snapshot.ObjectStore` (Put, PresignGet), using `minio-go`. Locally
  this is MinIO in docker-compose (`bitnamilegacy/minio`, because `minio/minio` is no longer on Docker Hub). Objects
  are not yet deleted after they expire; a bucket lifecycle rule is an operations task.

## As built (7h)
- **A document's later version** (a cancel, or a register close) is stored as the whole document with the operation's
  payload under its type (`cancel` or `update`), as the reference server and the device apply path expect. The first
  end-to-end hydration against Go found that the cloud stored the cancel payload alone, which a device could not
  apply. A protocol fixture (`document-cancel-version`) now holds both servers to the same shape.
- **Bootstrap bodies** are read through the same gzip-aware reader as pushes.
