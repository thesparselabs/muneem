# Muneem cloud (Go + Echo)

Stage 1 surface: identity (register/login/refresh/logout/me), device registration + revocation,
business/branch/terminal setup, health. The HTTP contract is `packages/contracts/openapi/muneem-v1.yaml`;
`make gen` regenerates `api/openapi.gen.go` from it (gitignored).

`internal/domain` is the Go port of `@muneem/domain`. Its tests load the **same** fixture files as the
TypeScript suite (`packages/domain/fixtures/**`) — see HLD §5.1 for why this matters.

## Run locally

```bash
docker compose up -d postgres minio      # from the repo root
cd cloud
make migrate-up                          # applies migrations/*.sql (golang-migrate, embedded)
make db-roles                            # dev login role that inherits muneem_api (so RLS applies)
DATABASE_URL='postgres://muneem_app:muneem_app@localhost:5433/muneem?sslmode=disable' make run
curl -i localhost:8080/v1/health
```

Environment: `DATABASE_URL`, `JWT_SECRET` (required), `PORT` (8080), `LOG_LEVEL` (`info`|`debug`), and for hydration
`MUNEEM_S3_ENDPOINT` (a URL; `http://` turns TLS off), `MUNEEM_S3_BUCKET` (created if missing), `MUNEEM_S3_ACCESS_KEY`,
`MUNEEM_S3_SECRET_KEY`, `MUNEEM_S3_REGION`. Without an endpoint the bootstrap routes answer 503. The Makefile defaults
point at the docker-compose MinIO.
Logs are JSON via `log/slog`.

## Request conventions

- Every response carries `X-Server-Time` (RFC 3339 UTC) — devices compute clock skew from it.
- `Authorization: Bearer <access>` on everything except `/health` and `/auth/{register,login,refresh}`.
- Once a device is registered, requests that name a device (`X-Device-Id` header or `device` claim)
  must carry `X-Device-Timestamp` (unix seconds, ±5 min) and `X-Device-Signature` =
  base64(Ed25519 over `METHOD\nPATH\nTIMESTAMP\nsha256hex(body)`).
- Passwords are Argon2id in PHC format (`$argon2id$v=19$m=65536,t=3,p=4$salt$hash`) so the desktop
  can verify the same string offline.
- Refresh tokens rotate; replaying a rotated token revokes the whole family.
- Business/branch/terminal creation is idempotent on the client-minted ULID `id`.

## Tenant isolation

Every tenant table carries `business_id` and has Row-Level Security policies for the `muneem_api`
and `muneem_readonly` roles. The API runs each request in a transaction and sets
`app.user_id` / `app.business_id` / `app.device_id` with `set_config(..., true)`; handlers still
check membership explicitly — RLS is defence-in-depth, not the only guard.

## Sync (Stage 7)

`internal/devicesync` serves `POST /v1/sync/push` and `GET /v1/sync/pull` (LLD §7). Push applies each operation in
its own transaction: idempotency, dependencies, verification (`verify/`, GST through the Go port), then
`entity_state`, the journal projection and `change_log`. Masters and config go through the conflict matrix
(`conflict/`, ADR-0041); review items and device revocations travel on the control stream.

`POST /v1/sync/bootstrap` and `GET /v1/sync/bootstrap/{id}` serve hydration bundles (`devicesync/snapshot`, ADR-0038
"As built (7f)"): built in the background into object storage (`internal/objectstore`) and handed out by presigned
URL.

Integration tests use Postgres and skip without it; the hydration tests use MinIO when `MUNEEM_TEST_S3_ENDPOINT` is
set (with `MUNEEM_TEST_S3_ACCESS_KEY`, `MUNEEM_TEST_S3_SECRET_KEY`, optional `MUNEEM_TEST_S3_BUCKET`), else an
in-memory store served over HTTP:

```bash
docker compose up -d postgres minio
MUNEEM_TEST_DATABASE_URL='postgres://muneem:muneem@localhost:5433/muneem?sslmode=disable' \
MUNEEM_TEST_S3_ENDPOINT=http://localhost:9000 MUNEEM_TEST_S3_ACCESS_KEY=muneem MUNEEM_TEST_S3_SECRET_KEY=muneem-dev-secret \
  go test ./...
```

They include the shared protocol fixtures (`packages/contracts/fixtures/sync`). To push a real seeded soak through
the whole pipeline, dump one with `MUNEEM_SYNC_CENSUS_OUT=<dir> pnpm --filter @muneem/desktop exec vitest run
test/sync/dumpCensus.test.ts`, then set `MUNEEM_SYNC_CENSUS=<dir>/soak.json` for `go test ./internal/devicesync/...`.
