# Deploying the Muneem cloud

This is the production topology from ADR-0051: one VM runs the API container behind Caddy, with managed Postgres and
managed S3-compatible storage. The deploy kit is in `deploy/`, and keys follow ADR-0052.

| File | What it is |
|---|---|
| `cloud/Dockerfile` | The API image. Build it from the repo root: `docker build -f cloud/Dockerfile -t muneem-api .` |
| `deploy/docker-compose.prod.yml` | `api` and `caddy` only. Postgres and storage are external. |
| `deploy/Caddyfile` | TLS, the reverse proxy, security headers and the 2 MiB body cap. |
| `deploy/.env.example` | Every variable, with a comment. Copy it to `deploy/.env` (mode 600) on the VM. |
| `deploy/deploy.sh` | `up <tag>`, `rollback`, `rewrap` and `status`. |
| `deploy/roles.sql` | Creates the `muneem_app` login role and sets its password from the environment. |
| `deploy/s3-lifecycle.json` | Bundles expire after 2 days, backups have a 60-day safety net, and stale multipart uploads are aborted. |
| `deploy/monitoring/` | Prometheus, Loki, Grafana, alert rules, the crash collector and the log agent (section 8). |

## 1. Provision (once)

**Managed Postgres (16)**
- Enable point-in-time recovery: continuous WAL archiving, with at least 7 days' retention. With it, RPO is minutes,
  well inside NFR-010's 15.
- Enable daily automated snapshots, kept for 30 days.
- Create the database `muneem` and an **owner** role that owns it and has `CREATEROLE`. Migration 0001 creates the
  `muneem_api` and `muneem_readonly` roles, and `roles.sql` creates `muneem_app`.
- Restrict network access to the VM's IP or a private network, and require TLS (`sslmode=require`, or
  `verify-full` with the provider's CA).

**Managed object storage**
- Create one private bucket, with no public access, in the same region as the VM. The API creates the bucket if it
  is missing, but its credentials should not need to.
- Create an access key scoped to that bucket, with object read, write and delete, and `ListBucket` (the readiness
  check calls `BucketExists`).
- Apply the lifecycle rules:
  `aws s3api put-bucket-lifecycle-configuration --bucket <bucket> --lifecycle-configuration file://deploy/s3-lifecycle.json --endpoint-url <endpoint>`.
  The prefixes are `snapshots/<business>/` for hydration bundles and `backups/<business>/` for device backups.
- **The 60-day backup expiry is a safety net.** A shop that sends no backup for 60 days loses its cloud copies. The
  backup-freshness alert (9c) must fire long before that.

**The VM**
- Use a small Linux VM (2 vCPU and 4 GB is plenty for the pilot) with Docker Engine and the compose plugin.
- Open only ports 22, 80 and 443 (443 for both TCP and UDP).
- Enable unattended security upgrades.
- Point an `A` (and `AAAA`) record for `MUNEEM_API_DOMAIN` at the VM. Caddy gets and renews the Let's Encrypt
  certificate on first start, which needs ports 80 and 443 reachable. Certificates live in the `caddy_data` volume.

**Secrets on the VM**
- Clone the repo, or copy `deploy/`, to `/opt/muneem`. Then `cp deploy/.env.example deploy/.env` and
  `chmod 600 deploy/.env`.
- Fill in every value from the host's secret manager. Generate secrets with `openssl rand -base64 32`.
- Store the backup master keys and JWT keys in the password manager as well. **A lost master key version makes the
  backups it wrapped unrecoverable.**
- `deploy/.env` and `deploy/state/` are gitignored. Never commit them.

## 2. First deploy

```sh
cd /opt/muneem/deploy
docker login <registry>                 # read-only token for the image repository
./deploy.sh up <git-sha>                # the tag CI pushed for that commit
curl -fsS https://$MUNEEM_API_DOMAIN/v1/ready
```

`up` runs these steps:
1. Pulls `MUNEEM_IMAGE:<tag>`.
2. Runs `migrate-up` as `MUNEEM_OWNER_DATABASE_URL`.
3. Applies `roles.sql`, which creates or updates `muneem_app` with `MUNEEM_APP_DB_PASSWORD`.
4. Recreates the `api` container and makes sure `caddy` runs.
5. Waits up to 120 s (`MUNEEM_READY_TIMEOUT`) for the container to report healthy. Health is the API's own
   `/v1/ready`: Postgres and object storage answer within 2 s.

The API container receives only the variables listed in the compose file, so the owner URL never reaches it.

## 3. Upgrade

```sh
./deploy.sh up <new-sha>
```

If the new tag never becomes ready, `deploy.sh` prints its last logs, starts the previous tag again, waits for it, and
exits non-zero. Requests that arrive during the restart are held by Caddy for up to 30 s, and devices retry sync
anyway.

**Migrations must keep the previous binary working.** Expand first (add columns, tables and nullable fields), and
contract in a later release. A rollback changes the program, never the schema.

## 4. Rollback

```sh
./deploy.sh rollback      # back to the previous tag; it swaps current and previous
./deploy.sh status
```

If the schema itself must go back, restore the database to a point in time (section 6) rather than running
`migrate-down`. Down migrations are for development only.

## 5. Key rotation (ADR-0052)

**JWT signing key** (access tokens live 15 minutes, and refresh tokens are not JWTs):
1. Add the new key **second**: `JWT_SECRETS=k2:<new>,k1:<old>`, then deploy, or restart with
   `./deploy.sh up <current tag>`. With one VM you can skip this step and put it first straight away.
2. Move it first: `JWT_SECRETS=k1:<old>` becomes `k2:<new>,k1:<old>`, then restart. New tokens carry `kid=k2`.
3. After at least 15 minutes, remove `k1` and restart.

**Moving from the legacy `JWT_SECRET`:** set `JWT_SECRETS=k1:<new>` and keep `JWT_SECRET=<old>`, then restart. After
15 minutes, empty `JWT_SECRET` and restart again. No one is logged out.

**Backup master key:**
1. Generate the new key and store it offline first.
2. Put it first in the ring: `MUNEEM_BACKUP_MASTER_KEYS=v2:<new>,v1:<old>`, then restart. New escrows are wrapped
   under `v2`.
3. Run `./deploy.sh rewrap`. Every key not under `v2` is re-wrapped. Check the log for `failed=0`; the command exits
   non-zero otherwise.
4. Only after a clean rewrap, remove `v1` from the ring and restart. Keep `v1` offline until the next restore drill
   has proved that `v2` alone restores a backup.

**Legacy `MUNEEM_BACKUP_MASTER_KEY`:** it acts as `v1`. To rotate it, set `MUNEEM_BACKUP_MASTER_KEYS=v2:<new>` and keep
the legacy variable, then follow steps 3 and 4 above. Empty the legacy variable last.

**Database and storage credentials:**
- For `muneem_app`, change `MUNEEM_APP_DB_PASSWORD` and `DATABASE_URL` together, then run `./deploy.sh up <current tag>`.
  `roles.sql` resets the password before the restart. Pool connections that are already open stay up until the
  restart.
- For S3 keys, create a second access key, switch the variables, deploy, then delete the old key.

## 6. Restore drill (NFR-010: RPO ≤ 15 min, RTO ≤ 4 h; monthly, per HLD §12)

1. **Pick a target time** a few minutes ago, and note the newest `change_log.seq` and `backup.confirmed_at`
   committed before it.
2. **Restore** the managed Postgres to that time as a *new* instance, using the provider's point-in-time restore. Note
   the elapsed time.
3. **Check RPO:** the restored instance has every row committed up to the target, and the gap to the target is
   ≤ 15 min.
4. **Point a staging VM** (or `deploy.sh` with a staging `.env`) at the restored instance and a copy of the bucket.
   Then run `deploy.sh up <tag>` and confirm `/v1/ready`.
5. **Prove the data:**
   - a test device hydrates (`/v1/sync/bootstrap`), and its Trial Balance equals the cloud's;
   - a cloud backup restores with the escrowed key, using the current master key ring.
6. **Record** the elapsed times, end to end against RTO ≤ 4 h, along with what was slow, in
   `docs/operations/drills/<date>.md`. A backup that has never been restored is not a backup.

To restore for real, follow the same steps with the production `.env`. Then repoint `DATABASE_URL` and
`MUNEEM_OWNER_DATABASE_URL` at the restored instance, and run `./deploy.sh up <current tag>`. Devices re-push anything
newer than the restore point from their outboxes, because operations are idempotent.

## 7. Path to scale

- **A second API VM behind a load balancer** (the provider's L7 balancer, or Caddy on a small front VM) that
  health-checks `GET /v1/ready`. Deploy one VM at a time, so a deploy no longer blips.
- **Rate limits move to Redis.** The token buckets in `httpx.RateLimit` are per instance today, so two instances
  double the allowance. A managed Redis with a shared token bucket keyed by client IP fixes that.
- **Client IPs:** the API believes `X-Forwarded-For` only from private networks, so a balancer must forward from a
  private address or be added as a trusted proxy.
- **JWT rotation** across instances needs the add-second step (section 5).
- **Snapshot builds** run on whichever instance received the request. They are bounded per instance (two workers)
  and drained on shutdown, so nothing is shared.
- **Postgres:** scale up first. Add a read replica for reports only when the dashboards need it; the API's writes
  stay on the primary.

## 8. Monitoring (ADR-0053)

The kit is in `deploy/monitoring/`:

| File | What it is |
|---|---|
| `docker-compose.monitoring.yml` | Prometheus (30 days), Loki (30 days), Grafana, the crash collector and Caddy, for TLS on Grafana and the crash ingest. |
| `docker-compose.agent.yml` | Grafana Alloy. It ships the `api`, `caddy` and `crash` container logs to Loki. Run it on every VM. |
| `.env.example` | Every variable. Copy it to `deploy/monitoring/.env` (mode 600). |
| `prometheus/targets/api.yml.example` | Where the API's metrics port is reachable. Copy it to `api.yml` (gitignored). |
| `grafana/` | Provisioned datasources, dashboards and alert rules, with a runbook per alert in `docs/runbooks/`. |

**Sizing:** 2 vCPU, 4 GB of RAM and 40 GB of disk. A separate small VM is recommended, so the alerts survive the API
VM failing. For the pilot it can share the API VM, which then needs 4 GB more RAM.

**Network.** Only Grafana and the crash ingest are public. Prometheus scrapes the API, and the agents push to Loki,
over a private network:
- **Separate VMs (WireGuard):** give the API VM `10.80.0.1` and the monitoring VM `10.80.0.2` (`wg-quick`, UDP 51820
  open between the two only). Then set:
  - on the API VM, in `deploy/.env`: `MUNEEM_METRICS_BIND=10.80.0.1`, and run `./deploy.sh up <current tag>`;
  - on the monitoring VM: `LOKI_BIND=10.80.0.2`, and `api.yml` targets `10.80.0.1:9090`;
  - on both, for the agent: `LOKI_URL=http://10.80.0.2:3100/loki/api/v1/push`, with `MUNEEM_HOST` set to the VM's name.
- **One VM:** set `MUNEEM_METRICS_BIND=172.17.0.1` (the docker bridge), `api.yml` targets `host.docker.internal:9090`,
  `LOKI_BIND=127.0.0.1` and `LOKI_URL=http://127.0.0.1:3100/loki/api/v1/push`. Run the agent with
  `network_mode: host`, or put Loki on the bridge address too.
- Never open 9090 or 3100 in the firewall to the internet. `curl http://<public ip>:9090/metrics` must fail.

**Bring it up (on the monitoring VM):**
```sh
cd /opt/muneem/deploy/monitoring
cp .env.example .env && chmod 600 .env            # fill in the domains, passwords, MUNEEM_IMAGE/TAG and MUNEEM_CRASH_KEY
cp prometheus/targets/api.yml.example prometheus/targets/api.yml
docker compose -f docker-compose.monitoring.yml --env-file .env up -d
docker compose -f docker-compose.agent.yml --env-file .env up -d
```
Then, on the API VM, copy `deploy/monitoring/` and an `.env` with `LOKI_URL` and `MUNEEM_HOST`, and start only the
agent compose.

**Check it:**
- Grafana (`https://$GRAFANA_DOMAIN`): Muneem → API (RED) shows traffic. Alerting → Alert rules lists 19 rules.
- Prometheus target `muneem-api` is up: `docker compose exec prometheus wget -qO- localhost:9090/api/v1/targets`.
- Loki has the API logs: Explore → `{service="api"}`.
- The crash ingest answers only the Sentry paths: `curl -s -o /dev/null -w '%{http_code}' https://$CRASH_DOMAIN/` is
  `404`.
- Set the SMTP values and send a test notification from the `ops` contact point.

**The probes** run inside the API, configured by `MUNEEM_HEALTH_PROBE_INTERVAL` (60 s), `MUNEEM_HEALTH_LEDGER_INTERVAL`
(15 min) and `MUNEEM_HEALTH_TOP_DEVICES` (50). They read through migration 0008's SECURITY DEFINER functions, so the
API role still sees no tenant rows.

**Crash reports.** Desktops are built with `MUNEEM_CRASH_DSN=https://<MUNEEM_CRASH_KEY>@<CRASH_DOMAIN>/1`. A shop sends
reports only when its owner turns them on (Diagnostics → Crash reporting). Reports are log lines in Loki:
`{service="crash"} |= "crash report"`. Minidumps uploaded to the `minidump` endpoint are kept in the `crash_dumps`
volume for 30 days. The desktop does not upload them today (ADR-0053).

**Upgrading the stack:** bump the image tags in the compose file, then `docker compose ... pull && up -d`. Dashboards
and rules come from the files, so an edit is a file change plus `docker compose restart grafana`. Edits made in the UI
are refused.
