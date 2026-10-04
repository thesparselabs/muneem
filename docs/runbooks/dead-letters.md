# Unresolved dead letters

**Alert:** `muneem-dead-letters` (critical) fires when `max by (business_id) (muneem_business_dead_letters_unresolved)` > 0 for 1m.

## What it means
The cloud rejected an operation (verification failed: totals, journal, payload, audit chain) and it has not been applied since. The cloud does not hold that document; this counts as a lost transaction until resolved (ADR-0054).

## How to check
- `psql "$MUNEEM_OWNER_DATABASE_URL" -c "SELECT id, device_id, entity_type, entity_id, error_code, error_detail, created_at FROM dead_letter WHERE business_id = '<id>' ORDER BY id DESC LIMIT 20"`.
- Loki: `{service="api", alert="true"} | json | business_id="<id>"` shows the rejection lines with operation ids.

## How to fix
- `TOTAL_MISMATCH` / `JOURNAL_MISMATCH` / `JOURNAL_IMBALANCE`: the device and cloud engines disagree. Reproduce with `cloud/cmd/verify-fixture` on the operation JSON, and treat it as a product defect (fix forward through the beta channel).
- `PAYLOAD_INVALID`: an older or newer app shape; check the device's app and schema version against ADR-0049.
- Once fixed, the device resends (Diagnostics → Sync → retry) and the operation applies; the alert clears on the next probe.
