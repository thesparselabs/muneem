# Business-health probes stale

**Alert:** `muneem-health-probe-stale` (critical) fires when `time() - max(muneem_health_probe_last_success_timestamp_seconds{probe="businesses"}) or vector(1e9)` > 600 for 5m.

## What it means
The business-health probes have not completed for 10 minutes, so every business alert is blind.

## How to check
- API logs: `health probe failed` with the error.
- Database load: the probes use indexed SQL with a timeout of half their interval.

## How to fix
- Migration 0008 missing (functions absent): run `./deploy.sh up <tag>`, which migrates first.
- Timeouts on a large database: raise `MUNEEM_HEALTH_PROBE_INTERVAL` or `MUNEEM_HEALTH_LEDGER_INTERVAL` and restart.
