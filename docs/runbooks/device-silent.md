# Device silent

**Alert:** `muneem-device-silent` (warning) fires when `max by (business_id) (muneem_business_devices{state="silent"})` > 0 for 30m.

## What it means
An active device has neither pushed nor pulled for more than 24 hours. It may be switched off, offline, or replaced without being revoked.

## How to check
- `psql "$MUNEEM_OWNER_DATABASE_URL" -c "SELECT id, name, last_seen_at, outbox_depth, app_version FROM device WHERE business_id = '<id>' AND status = 'active' ORDER BY last_seen_at"`.
- Ask the shop whether the computer is in use.

## How to fix
- Shop closed or holiday: silence for the expected period.
- Offline: anything it holds is unsynced; ask them to connect it. Its outbox drains on its own.
- Retired or replaced: revoke the device so it stops counting (and so it can never sync again).
