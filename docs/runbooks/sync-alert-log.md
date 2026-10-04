# Sync alert logged

**Alert:** `muneem-sync-alert-log` (critical) fires when `sum by (service) (count_over_time({service="api", alert="true"} [5m]))` > 0 for 0s.

## What it means
The API wrote a log line marked `"alert": true`: an operation was rejected into dead letter, or a hydration bundle build failed.

## How to check
- Loki: `{service="api", alert="true"}` shows the line, with business, device and operation ids.

## How to fix
- Rejections: [dead-letters](dead-letters.md).
- Snapshot builds: [snapshot-build-failing](snapshot-build-failing.md).
