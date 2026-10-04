# ADR-0048 — Audit chain on the cloud

**Status:** Accepted, 2026-10-04

## Context
LLD §16 says the server verifies each device's audit hash chain on ingest; device audit rows never reach the cloud today.

## Decision
- **Upload:** audit rows sync as an append-only `audit_entry` stream.
- **Verification:** the cloud verifies each device's chain on ingest (`seq` with no gaps, `prev_hash` linkage,
  recomputed hash). A break is `AUDIT_CHAIN_BROKEN`: the batch is refused, dead-lettered and alerted, and the device
  shows it.
- **On the device:** Diagnostics verifies on demand and every 6 hours.

## Consequences
- Built in Stage 8 (8g); amended with an "As built" note if reality differs.

## As built (8g)
- **Wire:** each `audit_log` row is an `audit_entry` `create` operation whose payload is the row exactly as stored
  (snake_case, `before_json`/`after_json` as the stored strings), on a push-only `audit` stream: `STREAM_OF` maps it
  to `audit`, which is no pull stream, and the cloud never writes it to `change_log`. `appendAudit` queues it in the
  same transaction, depending on the chain's previous row so seqs leave in order. Device-scope rows (`_device`, no
  business) stay local. Rows written before 8g, or carried in by a restore, are queued once by `queueUnsentAudit` at
  sync start-up (idempotent). A business's own create is queued before its first audit row.
- **Verification (both servers):** the row's hash is recomputed first; then a seq already held is a `duplicate` if
  the hash matches and `AUDIT_CHAIN_BROKEN` if not; a seq past the next one is `deferred` `DEPENDENCY_MISSING`; the
  next seq must link `prev_hash` to the last hash. The chain is keyed by the row's `device_id`, not the pusher.
  A break is rejected (permanent), dead-lettered, logged with `alert`, and listed once per operation as an
  `audit_chain_broken` review item on the control stream. The batch is not refused: other operations still apply
  and the chain carries on with the genuine row.
- **Go:** `cloud/internal/devicesync/auditchain` ports `canonicalJson` (JavaScript number formatting, array-index
  keys first, UTF-16 key order, `JSON.stringify` escapes) and the hash; shared fixtures in
  `packages/contracts/fixtures/canonical/` are written by the device's code and checked by TS, the reference server
  and Go. Table `audit_entry` (migration 0005), append-only by grant, under RLS.
- **Device:** `diagnostics.verifyAudit` checks every chain held (gap, link, hash), runs on demand, in the integrity
  check and on the 6-hourly timer, and keeps the last result in `app_meta`; a local break or a cloud
  `AUDIT_CHAIN_BROKEN` turns the sync badge to "Needs attention · audit trail check failed". No SQLite migration.
- **Restore:** restoring a backup carries this device's newer audit rows into the restored file, so the chain the
  cloud already holds is not forked.
