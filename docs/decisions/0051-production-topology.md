# ADR-0051 — Production topology

**Status:** Accepted, 2026-10-05

## Context
Stage 9 deploys the cloud for a five-shop pilot. NFR-002 asks for 99.9% availability, while the desktop keeps selling
through outages. NFR-010 asks for RPO ≤ 15 min and RTO ≤ 4 h with tested restores. HLD §12 asks for continuous WAL
archiving and point-in-time recovery. Until now the cloud had no image, no deploy and no readiness probe, and the API
connected as whatever role the URL named. The user chose the topology on 2026-10-05.

## Decision
- **One VM:** the API container behind **Caddy**, which terminates TLS with automatic certificates, holds requests
  for up to 30 s while the API restarts, adds security headers and caps request bodies at the API's own 2 MiB.
- **Managed Postgres** with point-in-time recovery (WAL archiving) and daily snapshots. That covers the RPO.
- **Managed S3-compatible storage**, with lifecycle rules:
  - hydration bundles (`snapshots/`) expire after 2 days;
  - backup objects (`backups/`) get a 60-day safety-net expiry, since the app already prunes past the newest 30 per
    business;
  - incomplete multipart uploads are aborted after a day.
- **Image:** `cloud/Dockerfile`, a static Go binary on distroless, running as non-root, with `migrate-up`, `rewrap` and
  `healthcheck` subcommands. CI builds it on every PR and pushes from `main` once registry secrets exist.
- **Roles:** migrations, `roles.sql` and `rewrap` run as the **owner** role. The API runs as `muneem_app`, a login role
  inside `muneem_api`, so RLS applies. Its password comes from the environment, and the owner URL never reaches the
  API container.
- **Deploy** (`deploy/deploy.sh`): pull the tag, migrate as owner, apply roles, restart, and wait for the container to
  report healthy. If it never does, start the previous tag again.
- **Migrations must work for the previous binary too** (expand, then contract in a later release), because rollback
  changes the program and never the schema.
- **Liveness and readiness are separate:**
  - `/v1/health` stays the cheap liveness probe that devices use to decide "online";
  - `/v1/ready` pings Postgres and object storage with a 2 s timeout, and the container health, the deploy gate and any
    future load balancer use it.
- **Shutdown:** on SIGTERM the API stops HTTP, then lets snapshot builds finish for up to 25 s. Builds still running
  after that are cancelled and recorded as failed. The container's stop grace is 30 s.
- **Secrets** live in `deploy/.env` on the VM (mode 600, from the host's secret manager), and are never committed.
- **Path to scale:**
  - a second VM behind a load balancer that checks `/v1/ready`;
  - rate limits moved to Redis, since today's token buckets are per instance and two VMs double the allowance;
  - the snapshot workers are stateless per build, so they need nothing extra.

## Consequences
- A deploy blips for a few seconds while the API container is recreated. Caddy's retry window hides most of it, and
  devices retry sync anyway. Zero-downtime deploys arrive with the second VM.
- One VM is a single point of failure for the API, but not for data. Restoring is reprovisioning the VM from
  `deploy/` and the secrets, which fits RTO ≤ 4 h. The desktop keeps selling meanwhile (NFR-002's core clause).
- **Risk in the 60-day backup expiry:** a shop that stops backing up for 60 days loses its cloud backups to the
  safety net, while the API still lists them. Monitoring backup freshness (9c) must alert long before then.
- Rate limits are per instance until the Redis move. That is documented, and acceptable for one VM.
- Real accounts are still to be created: the registry, managed Postgres, object storage, DNS and the VM.
