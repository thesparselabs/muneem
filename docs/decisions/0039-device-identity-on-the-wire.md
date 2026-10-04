# ADR-0039 — Device identity on the wire, and businesses created offline

**Status:** Accepted, 2026-10-04

## Context
Local rows carry the `installation_id` as `device_id` (ADR-0005). The cloud knows the device by the id it issued at
registration. A business can be created on the desktop before it ever syncs (ADR-0006).

## Decision
- **Identity:** the device pushes and pulls as its **cloud device id**, kept in `sync_device`. The request is signed
  with that device's key; the body never names the device, because the signed identity is the only trusted one. Local
  rows keep the `installation_id`.
- **Idempotency:** the key is `(business_id, cloud_device_id, operation_id)`.
  - A repeat with the same payload hash returns `duplicate` and the original `serverSeq`.
  - A repeat with a different hash is `rejected` with `PAYLOAD_INVALID`.
- **A business created offline** reaches the cloud as its own `business` create, pushed first. The cloud creates it,
  with the pushing user as owner, if that user belongs to the payload's organization. Any other operation for a
  business the cloud has not seen is deferred as `BUSINESS_UNKNOWN`. Branches, terminals, series and the chart follow
  as ordinary operations.

## Consequences
- A device must be registered (Stage 1) before it can sync. One that is not shows "Needs attention" in the status
  badge.
- The cloud never trusts a device id written in a payload. `origin_device_id` on `change_log` is always the signed
  pusher.
