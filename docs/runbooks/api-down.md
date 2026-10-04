# API down

**Alert:** `muneem-api-down` (critical) fires when `max(up{job="muneem-api"}) or vector(0)` < 1 for 2m.

## What it means
Prometheus cannot scrape the API's metrics port: the API is down, the VM is down, or the private network between them is broken.

## How to check
- `curl -fsS https://$MUNEEM_API_DOMAIN/v1/health` from outside.
- On the API VM: `./deploy.sh status`, `docker compose logs --tail=200 api`.
- WireGuard: `wg show` on both VMs.

## How to fix
- API down: `./deploy.sh up <current tag>`, or `rollback` if a deploy just happened.
- Only the scrape is broken: devices keep syncing; fix the tunnel.
- Shops keep selling offline either way (NFR-002).
