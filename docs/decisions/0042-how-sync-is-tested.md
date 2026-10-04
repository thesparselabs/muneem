# ADR-0042 — How sync is tested

**Status:** Accepted, 2026-10-04

## Context
The Stage 7 exit is a deterministic simulation suite (LLD testing table) and the PRD §37 scenario. The server is Go;
the devices are Electron with SQLite. Running hundreds of seeded fault scenarios against Postgres would be slow and
hard to make deterministic.

## Decision
- **The reference server:** `packages/sync-reference` implements the protocol and the conflict matrix in TypeScript,
  over in-memory maps. It is fast and deterministic.
- **The simulation:** two or three real `App` instances on SQLite talk to it through a seeded fault injector covering:
  - drop, duplicate, reorder and delay;
  - partition;
  - 500s;
  - clock skew;
  - kill -9 between claim and result.

  It asserts no loss, no duplicates, convergence, and the same conflict winners for the same seed.
- **Keeping the two servers equal:** shared protocol fixtures (`packages/contracts/fixtures/sync`), recorded from a
  real flow and frozen, run against both the reference server and the Go server. This is the same pattern as the GST
  golden fixtures.
- **The real server:** the §37 scenario and a smaller simulation also run against the Go server with Postgres and
  MinIO, in a CI job with those services. Locally they run when `MUNEEM_E2E_CLOUD` is set.

## Consequences
- The reference server's behaviour beyond the fixtures could drift from Go's. Every new protocol rule gets a fixture.
- The simulation runs 20 seeds in CI and 500 with `pnpm sim`.
