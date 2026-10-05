# Cloud backup stale

**Alert:** `muneem-backup-stale` (critical) fires when `max by (business_id) (muneem_business_backup_age_seconds)` > 93600 for 10m.

## What it means
The shop has no confirmed cloud backup for more than 26 hours (devices upload one a day). Object-storage lifecycle deletes backups after 60 days (ADR-0051), so a shop that stays silent eventually has none.

## How to check
- `psql "$MUNEEM_OWNER_DATABASE_URL" -c "SELECT id, device_id, status, created_at, confirmed_at FROM backup WHERE business_id = '<id>' ORDER BY created_at DESC LIMIT 5"`.
- Pending rows without confirmation mean uploads start but never finish; see [backup-confirm-failing](backup-confirm-failing.md).
- No rows: the device is offline (check [device-silent](device-silent.md)) or backups fail locally (Diagnostics → Backups).

## How to fix
- Ask the shop to run Diagnostics → Backups → Back up now while online.
- A new shop with no backup yet shows its age since creation: the first upload clears it.
