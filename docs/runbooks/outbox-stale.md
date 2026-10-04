# Outbox not draining

**Alert:** `muneem-outbox-stale` (critical) fires when `max by (business_id) (muneem_business_outbox_oldest_age_seconds)` > 3600 for 5m.

## What it means
The oldest operation waiting on some device of the shop is more than an hour old. Either the device cannot reach the cloud, or an operation is stuck (a dependency never arrives, or a failure repeats).

## How to check
- `muneem_device_outbox_oldest_age_seconds` names the device.
- Diagnostics → Sync on that device lists failed and dead operations with their error codes.
- Dead letters for the device: `psql "$MUNEEM_OWNER_DATABASE_URL" -c "SELECT operation_id, error_code, error_detail, created_at FROM dead_letter WHERE device_id = '<id>' ORDER BY id DESC LIMIT 20"`.

## How to fix
- `DEPENDENCY_MISSING`: the operation it depends on is on another device that has not synced; get that device online.
- `dead` on the device (12 failed attempts): it never retries by itself. Fix the cause, then resend from Diagnostics (or the operator tooling, 9i).
- Nothing failing but the device is offline: treat as [device-silent](device-silent.md).
