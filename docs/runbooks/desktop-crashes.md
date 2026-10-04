# Desktop crashes rising

**Alert:** `muneem-desktop-crashes` (warning) fires when `sum(count_over_time({service="crash"} |= "crash report" [1h]))` > 5 for 0s.

## What it means
More than 5 desktop crash or error reports arrived in an hour, from shops that opted in (ADR-0053). Reports carry no invoice or customer data.

## How to check
- Loki: `{service="crash"} |= "crash report" | json` groups by `report_release`, `report_kind` and the top frame.
- Native crashes keep a minidump in the `crash_dumps` volume, named by the logged id.

## How to fix
- One release: pause its rollout on the release channel and fix forward.
- Symbolicate a minidump with the release's symbols (9e keeps them per build).
