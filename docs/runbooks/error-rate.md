# API error rate

**Alert:** `muneem-error-rate` (critical) fires when `sum(rate(muneem_http_requests_total{status=~"5.."}[5m])) / clamp_min(sum(rate(muneem_http_requests_total[5m])), 0.001)` > 0.02 for 10m.

## What it means
More than 2% of API requests answered 5xx for 10 minutes.

## How to check
- API dashboard → Responses by status and the error log panel.
- Did a deploy just happen?

## How to fix
- A deploy: `./deploy.sh rollback`.
- Database pressure: check pool waits and slow queries.
- Devices retry sync with backoff; nothing is lost while the API is failing.
