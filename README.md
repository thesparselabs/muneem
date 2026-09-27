# Muneem

Offline-first billing, inventory and accounting for Indian retail and wholesale shops.
The shop's computer is the system of record; the cloud consolidates, backs up and reports.

Design documents live in `design/` (PRD, PRD review, HLD, LLD). The LLD's §20 build order is the roadmap.

## Layout

| Path | What |
|---|---|
| `packages/domain` | Pure, deterministic engines: money kernel (integer paise, HALF_UP), GST, ids, financial year. **`fixtures/`** are the cross-language golden vectors. |
| `packages/contracts` | IPC contract registry (zod) — the preload is generated from it; error taxonomy; role presets; OpenAPI 3 HTTP contract. |
| `packages/db-sqlite` | Local SQLite: pragmas, migrator, schema, hash-chained audit log, transactional outbox, repositories. |
| `apps/desktop` | Electron + React desktop app (Windows target). |
| `cloud/` | Go (Echo) API: identity, devices, business setup, and the Go port of the domain engines used to re-verify synced documents. |
| `scripts/` | `schema-lint` (no float money columns), `diff-fuzz` (TS vs Go engine equality), `gen-preload`. |

## Run

```sh
pnpm install
pnpm turbo run gen build typecheck test      # all packages
docker compose up -d                          # postgres + redis for the cloud
make -C cloud migrate-up && make -C cloud run # API on :8080
pnpm --filter @muneem/desktop dev             # desktop (MUNEEM_API_URL=http://localhost:8080/v1)

# Stage 1 exit criterion, live: spawns the Go API, drives the real desktop services, kills the server, logs in offline
MUNEEM_LIVE_E2E=1 pnpm --filter @muneem/desktop exec vitest run test/e2e-live.test.ts
pnpm diff-fuzz --n 5000                       # TypeScript vs Go engine equality
```

## Non-negotiables (from the design)

- A sale is durable when the local SQLite transaction commits. Printing, sync and hardware happen after and can never undo it.
- Money is integer paise; `divRound` is the only rounding primitive; `Math.round`/`toFixed` are lint errors in domain code.
- The TypeScript and Go engines must produce byte-identical results on `packages/domain/fixtures`; CI runs both.
- Financial documents and the audit log are append-only (enforced by triggers, not convention).
- The renderer never touches Node, the filesystem, SQLite or hardware; only generated, schema-validated IPC methods.
