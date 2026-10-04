# Audit chain broken

**Alert:** `muneem-audit-chain-break` (critical) fires when `max by (business_id) (muneem_business_audit_chain_breaks_recent)` > 0 for 1m.

## What it means
The cloud refused an audit row of the shop because its hash chain did not continue the stored chain (ADR-0048). Someone or something altered or removed audit history on a device, or a restore went wrong.

## How to check
- `psql "$MUNEEM_OWNER_DATABASE_URL" -c "SELECT device_id, entity_id, detail, created_at FROM conflict_log WHERE business_id = '<id>' AND kind = 'audit_chain_broken' ORDER BY created_at DESC"`.
- On the device: Diagnostics → Audit trail → Verify.

## How to fix
- Do not "fix" the chain. It is evidence. Find out what happened on the device (restore from an old backup, manual database edit, disk fault).
- A restore of an older backup explains it: record that and resolve the review item on the device.
- Anything unexplained is an incident; keep the device's support bundle.
