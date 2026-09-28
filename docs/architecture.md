# Architecture overview

Plain-language map of the system as built. The authoritative design is `design/muneem-hld.md` and
`design/muneem-lld.md`; this page tracks what exists in code today.

## In one paragraph

Muneem is a Windows program for Indian shops. The shop's computer is the **system of record**: sales, stock
movements and accounting entries are saved to a local SQLite database, and a sale is "done" the moment that local
transaction commits. Printing, the cash drawer and the internet all happen *after* that and can never undo it. When
the internet is available, an outbox of local changes is uploaded to a Go cloud service backed by Postgres, which
re-checks every document's arithmetic, consolidates across devices and branches, and keeps backups.

## Parts

```
apps/desktop      Electron (main = privileged, renderer = untrusted React UI, preload = generated bridge)
packages/domain   Pure engines: money, GST, ids, financial year. Same results as cloud/internal/domain (Go).
packages/contracts IPC registry (zod), errors, permissions, OpenAPI HTTP contract → TS + Go types
packages/db-sqlite Local DB: pragmas, migrator, schema, audit hash chain, outbox, repositories
cloud/            Go + Echo API, Postgres with row-level security, Go port of the engines
scripts/          schema-lint, diff-fuzz, gen-preload
design/           PRD, PRD review, HLD, LLD (intent)
docs/             this folder (reality, with reasons)
```

## Boundaries that must not be crossed

| Boundary | Rule | Enforced by |
|---|---|---|
| Renderer ↔ main | Renderer reaches only methods declared in the contract registry; every call is validated, permission-checked, rate-limited, audited | generated preload + surface test; gateway pipeline |
| Money | Integer paise; `divRound` is the only rounding; no float ever touches a financial value | ESLint rule; schema-lint on migrations; shared numeric bounds |
| TS ↔ Go engines | Byte-identical results | shared fixture files in both test suites; nightly differential fuzz |
| Financial documents & audit log | Append-only; corrections are new documents | SQLite `RAISE(ABORT)` triggers; Postgres triggers + role grants |
| Tenant data | A business never sees another's rows | Postgres RLS keyed on `app.business_id` set per transaction |
| Hardware / network | Never inside the commit path | (Stage 3+) design rule, HLD §8 |

## Invariants checked by tests

- `Σ debit = Σ credit` (Stage 6 will add the ledger; the CHECK constraint is in the LLD schema)
- `Σ apportion(total, w) = total`, always
- `cgst + sgst = pctOf(taxable, rate)`; `|cgst − sgst| ≤ 1`
- `total = taxable + taxes + round_off`
- `replay(audit rows) → hash chain verifies`, gap-free `seq` per device
- After a SIGKILL mid-write: no orphan audit or outbox row, `local_sequence` consistent

## Identity and trust

- Cloud is authoritative for users, roles and permissions; the device caches a **permission snapshot** and enforces
  it in the main process, never from the renderer's copy.
- Each installation has an Ed25519 key pair; the private key lives in the OS credential store via Electron
  `safeStorage`. Requests are signed (see ADR-0003).
- Offline login verifies against an Argon2id hash computed on the device from the entered password; the server's hash
  is never sent down.

## What is not built yet

Products, POS billing, printing, inventory, purchases, payments, accounting, reports, and the sync worker. See
`build-stages.md`.
