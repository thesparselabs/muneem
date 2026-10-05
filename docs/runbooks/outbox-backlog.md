# Outbox backlog

**Alert:** `muneem-outbox-backlog` (critical) fires when `max by (business_id) (muneem_business_outbox_depth_max)` > 500 for 15m.

## What it means
A device has more than 500 operations it has not yet sent. Sales are safe on the device, but the cloud, the owner's other devices and the cloud backup fall behind, and a lost device would lose them (ADR-0054 counts an operation unsent after 24 h as lost).

## How to check
- Business health dashboard: which device (`muneem_device_outbox_depth`) and whether the depth is still rising.
- `psql "$MUNEEM_OWNER_DATABASE_URL" -c "SELECT id, last_seen_at, heartbeat_at, outbox_depth, oldest_pending_at, app_version FROM device WHERE business_id = '<id>'"`.
- Logs: `{service="api"} | json | uri=~"/v1/sync/push.*"` for that device: are pushes arriving, and what do they answer?

## How to fix
- Pushes not arriving: the shop is offline or the device is blocked. Ask the shop to open Diagnostics → Sync; a `blocked` badge names the cause (revoked device, protocol too old, broken audit chain).
- Pushes arriving but the depth stays: the queue is waiting on a dependency or a transient error; see [outbox-stale](outbox-stale.md).
- A burst after a long offline spell drains on its own at 200 operations per push; silence the alert for an hour and re-check.
