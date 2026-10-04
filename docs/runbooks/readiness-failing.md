# Readiness failing

**Alert:** `muneem-readiness-failing` (critical) fires when `min by (check) (muneem_ready_check_ok)` < 1 for 2m.

## What it means
`/v1/ready` reports a dependency down: Postgres or object storage does not answer within 2 s.

## How to check
- API dashboard → Readiness checks names the check.
- API logs: `readiness check failed`.
- The provider's status page for managed Postgres / storage.

## How to fix
- Postgres: connection limits (`muneem_db_pool_*`), credentials, provider incident.
- Object storage: credentials (rotate per deploy.md §5) or provider incident.
