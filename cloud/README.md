# Muneem cloud (Go + Echo)

Stage 1 surface: identity (register/login/refresh/logout/me), device registration + revocation,
business/branch/terminal setup, health. The HTTP contract is `packages/contracts/openapi/muneem-v1.yaml`;
`make gen` regenerates `api/openapi.gen.go` from it (gitignored).

`internal/domain` is the Go port of `@muneem/domain`. Its tests load the **same** fixture files as the
TypeScript suite (`packages/domain/fixtures/**`) — see HLD §5.1 for why this matters.

## Run locally

```bash
docker compose up -d postgres            # from the repo root
cd cloud
make migrate-up                          # applies migrations/*.sql (golang-migrate, embedded)
make db-roles                            # dev login role that inherits muneem_api (so RLS applies)
DATABASE_URL='postgres://muneem_app:muneem_app@localhost:5433/muneem?sslmode=disable' make run
curl -i localhost:8080/v1/health
```

Environment: `DATABASE_URL`, `JWT_SECRET` (required), `PORT` (8080), `LOG_LEVEL` (`info`|`debug`).
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
