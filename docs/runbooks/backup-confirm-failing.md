# Backup confirmations failing

**Alert:** `muneem-backup-confirm-failing` (warning) fires when `sum(increase(muneem_job_runs_total{job="backup_confirm",outcome=~"failed|checksum_mismatch"}[1h]))` > 0 for 1m.

## What it means
Backup confirmations failed or the uploaded object did not match its declared size and SHA-256.

## How to check
- Backups dashboard → confirmations by outcome.
- API logs for `/backups/` with status ≥ 400.
- Object storage health and credentials (readiness `object_store`).

## How to fix
- `checksum_mismatch`: the upload was truncated or corrupted; the device retries the next day. Repeated for one device: check its disk and network.
- `failed`: storage or database errors; see [readiness-failing](readiness-failing.md).
