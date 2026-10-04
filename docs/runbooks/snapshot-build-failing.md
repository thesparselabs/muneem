# Hydration bundle builds failing

**Alert:** `muneem-snapshot-build-failing` (warning) fires when `sum(increase(muneem_job_runs_total{job="snapshot_build",outcome="failed"}[1h]))` > 0 for 1m.

## What it means
Building a hydration bundle failed. A new or restored device cannot be set up from the cloud until one builds.

## How to check
- Loki: `{service="api"} | json | msg="snapshot build failed"` gives the error.
- Object storage reachability and free space.

## How to fix
- Storage errors: fix storage, then the device asks again.
- Timeouts on a large shop: raise the build timeout (`snapshot.Options.BuildTimeout`) in a release.
