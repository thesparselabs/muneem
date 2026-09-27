# ADR-0005 — Local `device_id` is the installation id; the cloud device id is kept separately

**Status:** Accepted, 2026-09-27

## Context
Audit rows and outbox rows need a stable `device_id` from the very first local write, but the cloud only assigns a
device id after the first online login. Business setup may legally happen before that.

## Decision
- `device_id` on local audit/outbox rows is the `installation_id` (a ULID minted at first run, stored in `app_meta`).
- The cloud-assigned device id is stored in `app_meta` separately and sent as `X-Device-Id`.

## Consequences
- The audit hash chain is continuous from install time, with no re-keying after registration.
- Stage 7's sync worker must map installation id → cloud device id when pushing, and the server's idempotency key
  `(business_id, device_id, operation_id)` uses the header value.
