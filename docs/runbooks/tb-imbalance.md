# Trial Balance imbalance

**Alert:** `muneem-tb-imbalance` (critical) fires when `max by (business_id) (muneem_business_unbalanced_journals)` > 0 for 1m.

## What it means
The cloud holds journals whose lines do not balance. Ingest verifies every journal, so this should be impossible: it is a defect or direct database tampering.

## How to check
- `psql "$MUNEEM_OWNER_DATABASE_URL" -c "SELECT journal_id, SUM(debit_paise), SUM(credit_paise) FROM journal_line WHERE business_id = '<id>' GROUP BY 1 HAVING SUM(debit_paise) <> SUM(credit_paise)"`.
- Find the operation that wrote it: `journal_entry.server_seq` → `change_log`.

## How to fix
- Treat as a sev-1 data incident: stop deploys, keep the evidence, and compare with the device's journal (its integrity report and support bundle).
- Never edit journal rows in place; a correction is a reversing journal from the device.
