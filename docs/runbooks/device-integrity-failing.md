# Device integrity check failing

**Alert:** `muneem-device-integrity-failing` (critical) fires when `max by (business_id, device_id) (muneem_device_tie_out_failures + muneem_device_replay_mismatches + (1 - muneem_device_audit_chain_ok))` > 0 for 1m.

## What it means
The device's last scheduled integrity run (every 6 h) found failing tie-outs, stock that disagreed with its movements, or a broken audit chain.

## How to check
- Business health dashboard → Device integrity.
- The device's app.log: `JOURNAL_MISMATCH`, `STOCK_PROJECTION_DRIFT`, `AUDIT_CHAIN_BROKEN` lines name the details; ask for a support bundle.

## How to fix
- Stock drift is healed on the device (levels rebuilt from movements); a repeat means a defect in the projection.
- Tie-out failures are never auto-healed: compare the documents and the journal; fix forward.
- Audit chain: see [audit-chain-break](audit-chain-break.md).
