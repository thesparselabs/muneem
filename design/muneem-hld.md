# Muneem — High-Level Design (HLD)

**Version:** 1.0 · **Date:** 2026-09-26 · **Source of truth:** `muneem-prd.md` · **See also:** `muneem-prd-review.md`, `muneem-lld.md`

---

## 1. Architectural drivers

Every significant decision below traces to one of these:

| # | Driver | From | Consequence |
|---|---|---|---|
| D1 | A completed sale must never be lost | P7, NFR-003, C9 | Local DB commit is the durability boundary; outbox pattern; no network in the commit path |
| D2 | Core POS works with zero connectivity | P1, FR-063, C4 | Full domain engines (GST, inventory, accounting) run **on the device**, not the server |
| D3 | Financial correctness is provable | P4, §17, NFR-004 | Integer money, append-only documents, double-entry enforced at the DB level, ledger-derived projections |
| D4 | The renderer is untrusted | §5, NFR-006 | All privilege in main process behind a narrow, schema-validated IPC surface |
| D5 | Hardware is unreliable and vendor-diverse | P2, NFR-012, §11 | Hardware sits behind interfaces + adapters, *outside* the transaction boundary |
| D6 | Sync must be idempotent and auditable | NFR-009, §21 | Every operation carries a stable client-generated id; server dedupes; no last-write-wins on money |
| D7 | Two terminals, one shop, no internet | §2.1, FR-010, FR-087 | Documents are partitioned per terminal; stock is eventually consistent with reconciliation |
| D8 | Same arithmetic on device and cloud | D3 + D6 | Domain engines are specified by a **shared golden-vector suite**; implemented in TypeScript on the device and ported to Go on the cloud; CI proves byte-identical results |

---

## 2. System context

```text
┌──────────────┐   barcode / weight        ┌────────────────────────┐
│  Shop staff  │◄─────────────────────────►│  Retail hardware       │
└──────┬───────┘   receipt / drawer        │  scanner, printer,     │
       │ keyboard-first UI                 │  drawer, scale, labels │
       ▼                                   └───────────┬────────────┘
┌──────────────────────────────────────────────────────┴────────────┐
│                      MUNEEM DESKTOP (Windows, Electron)           │
│   Authoritative for: billing, stock movements, local ledger       │
│   Works fully offline · SQLite is the system of record on-site    │
└───────────────┬──────────────────────────────┬────────────────────┘
                │ HTTPS sync (batched)         │ telemetry / crash
                ▼                              ▼
┌───────────────────────────────────────────────────────────────────┐
│                          MUNEEM CLOUD                             │
│  Identity · Sync ingest · Consolidation · Reporting · Backup      │
│  PostgreSQL (multi-tenant) · Redis · Object storage · Workers     │
└───┬───────────────┬──────────────────┬──────────────────┬─────────┘
    │               │                  │                  │
    ▼               ▼                  ▼                  ▼
 Web admin      Mobile app         GSP / IRP          Messaging
 (Phase 2)      (Phase 2/3)     e-invoice, e-way    SMS / WhatsApp
```

**Authority model:** the device is authoritative for documents it creates (sales, receipts, sessions). The cloud is authoritative for identity, entitlement, master-data conflict resolution, and consolidated reporting across devices. Neither side silently rewrites the other's authoritative data.

---

## 3. Desktop architecture (layered)

```text
┌──────────────────────────────────────────────────────────────────┐
│ RENDERER  (React 18 + TS, Vite)          untrusted, no Node      │
│   POS screen · Masters · Purchases · Reports · Settings          │
│   State: TanStack Query (server-state semantics over IPC)        │
│          + Zustand for cart/session UI state                    │
└───────────────────────────┬──────────────────────────────────────┘
                            │ window.muneem.<module>.<method>()
                            │ contextBridge, no ipcRenderer exposure
┌───────────────────────────▼──────────────────────────────────────┐
│ PRELOAD                                   thin, generated        │
│   Method allowlist derived from the IPC contract registry        │
└───────────────────────────┬──────────────────────────────────────┘
                            │ ipcRenderer.invoke(channel, payload)
┌───────────────────────────▼──────────────────────────────────────┐
│ MAIN PROCESS                                      privileged     │
│                                                                  │
│  ┌── IPC Gateway ─────────────────────────────────────────────┐  │
│  │ zod validate → authenticate → authorize (RBAC) → rate-limit│  │
│  │ → correlate (trace id) → dispatch → audit → error envelope │  │
│  └───────────────────────────┬────────────────────────────────┘  │
│                              ▼                                   │
│  ┌── Application Services (use cases, transaction owners) ────┐  │
│  │ CompleteSale · RecordPayment · ReceivePurchase · AdjustStock│  │
│  │ OpenRegister · CloseRegister · ReturnSale · PostJournal     │  │
│  └───────────────────────────┬────────────────────────────────┘  │
│                              ▼                                   │
│  ┌── Domain Engines (pure, deterministic, no I/O) ────────────┐  │
│  │ PricingEngine · GstEngine · MoneyKernel · InventoryEngine  │  │
│  │ CostingEngine · AccountingEngine · NumberingEngine         │  │
│  │        ↑ @muneem/domain (TS); Go port on cloud, same fixtures│  │
│  └───────────────────────────┬────────────────────────────────┘  │
│                              ▼                                   │
│  ┌── Infrastructure ─────────────────────────────────────────┐   │
│  │ Repositories (SQL) · UnitOfWork · Migrator · OutboxWriter │   │
│  │ SyncEngine · HardwareManager · PrintQueue · UpdateManager │   │
│  │ SecretStore · Logger · Backup · Telemetry                 │   │
│  └──────┬──────────────────┬──────────────────┬──────────────┘   │
└─────────┼──────────────────┼──────────────────┼──────────────────┘
          ▼                  ▼                  ▼
   ┌────────────┐    ┌──────────────┐   ┌──────────────┐
   │  SQLite    │    │  Hardware    │   │  Cloud API   │
   │  (WAL)     │    │  USB/COM/NET │   │  HTTPS       │
   └────────────┘    └──────────────┘   └──────────────┘
```

### 3.1 Process topology

| Process | Contains | Why |
|---|---|---|
| **Main** | IPC gateway, app services, domain engines, SQLite writer, hardware, sync scheduler | Single writer to SQLite (D3); `better-sqlite3` is synchronous and sub-millisecond for POS queries |
| **Renderer** | React UI only | D4 |
| **Utility process: `reports`** | Heavy/long read queries, exports, imports | Prevents a 3-second report from freezing the till; opens SQLite **read-only** |
| **Utility process: `sync`** | HTTP transport, compression, retry/backoff timers | Network stalls must never block a commit (D1) |

The `sync` process never writes business tables directly; it hands results back to main, which applies them transactionally. This keeps "one writer" true.

### 3.2 Why the domain engines are on the device

A cloud-side GST engine would make offline billing impossible (D2). The engines live in `@muneem/domain` — pure functions over integers, no I/O — on the device. The cloud (Go) carries a **port** of the same engines in `cloud/internal/domain`, and sync ingest recomputes totals with it as a **verification step**. A mismatch is a hard sync error, not a silent overwrite.

Because the two implementations are in different languages, equality is not assumed — it is enforced: both test suites load the *same* golden-vector fixture files (`packages/domain/fixtures/**`), CI fails on any paise-level difference, and a nightly differential fuzz run feeds random invoices through both engines and asserts identical output. That fixture suite, not shared source code, is what makes D3 credible.

---

## 4. Module map (modular monolith, both sides)

```text
@muneem/domain     money, gst, pricing, costing, inventory, accounting, numbering, ids
@muneem/contracts  IPC schemas (zod) + OpenAPI 3 HTTP contract → TS + Go codegen, error codes, sync protocol types
@muneem/db-sqlite  schema, migrations, repositories
@muneem/hardware   interfaces + adapters (escpos, serial, hid, windows-print)
@muneem/desktop    electron main, preload, services, sync engine
@muneem/ui         react renderer
cloud/             go (echo) modular monolith — cmd/api, internal/<module>
cloud/internal/domain  Go port of @muneem/domain, tested against packages/domain/fixtures
cloud/migrations   golang-migrate SQL files, RLS policies
```

Cloud modules mirror §15 of the PRD (`auth, business, users, roles, products, inventory, customers, suppliers, pos, sales, purchases, payments, expenses, gst, accounting, reports, sync, notifications, audit, documents, settings, billing`), each its own Go package with handler/service/store and **no cross-package DB access** — package A talks to package B through its service interface. That discipline is what makes a later extraction possible without forcing microservices now (Constraint 5).

---

## 5. Cloud architecture

```text
                        Internet
                           │
                    ┌──────▼──────┐
                    │  CDN / WAF  │  (static, rate limiting, geo)
                    └──────┬──────┘
                    ┌──────▼──────────────┐
                    │  Load balancer      │
                    └──┬──────────────┬───┘
         ┌─────────────▼───┐   ┌──────▼─────────────┐
         │ API (stateless) │   │ Sync ingest (same  │
         │ Go/Echo ×N      │   │ binary, own pool)  │
         └──┬───────┬──────┘   └──────┬─────────────┘
            │       │                 │
   ┌────────▼──┐ ┌──▼────────┐ ┌──────▼────────────────┐
   │PostgreSQL │ │  Redis    │ │ Worker pool (asynq)   │
   │ primary   │ │ cache,    │ │ e-invoice, e-way,     │
   │ + replica │ │ locks,    │ │ notifications, GSTR   │
   │ (reports) │ │ queues    │ │ aggregates, backups   │
   └────────┬──┘ └───────────┘ └──────┬────────────────┘
            │                          │
      ┌─────▼──────┐            ┌──────▼──────┐
      │ Object     │            │ External:   │
      │ storage    │            │ GSP/IRP,    │
      │ (S3-compat)│            │ SMS/WA, pay │
      └────────────┘            └─────────────┘
```

### 5.1 Language decision: **Go (Echo)**

The PRD leaves it open. The team chose Go with the Echo framework: a single static binary, low memory footprint, simple deployment, and existing team expertise.

**The cost, stated honestly:** D8 wants the GST/costing/accounting engines to produce identical results on device and server. With TypeScript on the device and Go on the server, those engines exist **twice**, and arithmetic divergence in exactly the area where divergence is unacceptable becomes a real risk that shared source code would have removed.

**Mitigation (non-negotiable, CI-enforced):**

- `packages/domain/fixtures/**` golden vectors are the **single contract**. The TypeScript suite and the Go suite load the same files; a paise-level difference fails the build.
- A nightly **differential fuzz** job generates random invoices, runs the TS engine, and asserts the Go port returns identical output.
- The HTTP contract is one OpenAPI 3 document in `packages/contracts/openapi/`; Go types (`oapi-codegen`) and TS types (`openapi-typescript`) are generated from it, so request/response shapes cannot drift either.
- Any change to a domain engine must land in both implementations in the same PR, with the fixture suite extended.

Sync ingest is a batched, DB-bound workload, so Go's throughput is not the reason for the choice — the reason is operational simplicity and team preference, accepted with the two-engine obligation above.

### 5.2 Multi-tenancy (NFR-008)

Single database, shared schema, **`business_id` on every tenant table** + Postgres **Row-Level Security** as defence-in-depth. Each request opens a transaction in which Echo middleware runs `SET LOCAL app.business_id` / `app.user_id`; RLS policies compare against them, so a query mistake cannot leak across tenants. Authorization resolves `user → org → business → branch → permission` once per request and caches it in Redis with a short TTL, invalidated on role change.

Sharding by business is deferred; the partitioning strategy (§LLD 11) buys the runway.

### 5.3 Read/write split

Writes and sync ingest go to primary. Reports, dashboards and exports go to the replica. Pre-aggregated daily summary tables (per business/branch/day) are maintained by workers so a 3-year P&L is not a full scan of `sale_item`.

---

## 6. Synchronization architecture (the core of the system)

Two independent, ordered channels per device:

```text
UP (device → cloud)                 DOWN (cloud → device)
──────────────────                  ──────────────────────
sync_outbox (local table)           change_log (per-business seq)
        │ ordered by seq                    │ pull by cursor
        ▼                                   ▼
POST /v1/sync/push  ──►  ingest     GET /v1/sync/pull?since=<seq>
  batch, idempotent, per-entity        pages, resumable, atomic apply
        │                                   │
   server dedupes by operation_id      device applies, never over
   + re-verifies arithmetic            un-synced local documents
```

Key properties:

- **The commit path never touches the network.** A sale writes its own outbox rows inside the same SQLite transaction (transactional outbox). If the process dies immediately after, the sale and its intent to sync both exist or neither does.
- **Idempotency by construction.** `operation_id` is a client-generated ULID; the server has a unique index on `(business_id, device_id, operation_id)` and replays return the original result. Retries are free and safe (D6).
- **Ordering where it matters.** Operations are ordered per *entity* and per *device*, not globally. A payment cannot be ingested before the invoice it allocates to; the server holds it in a `waiting_dependency` state rather than failing it.
- **Financial documents are append-only.** There is no update path for a posted sale. Corrections are new documents (credit note, reversal journal), so "conflict" cannot arise for money (§21).
- **Master data uses versioned merge.** `version` + `updated_at` + field-level rules; detected conflicts that cannot be merged become a user-visible review item rather than a silent overwrite.
- **Stock is derived.** Never sync a stock *level*; sync stock *movements* and let both sides project. This is what makes offline multi-terminal survivable (D7).
- **Server-side verification.** Ingest recomputes totals, tax splits and journal balance with `@muneem/domain`. Mismatch → operation parked in a dead-letter queue with the full payload, visible to support, never dropped.

Full protocol, state machine, error taxonomy and conflict matrix: `muneem-lld.md` §7–§9.

---

## 7. Data architecture

| Store | Role | Contents |
|---|---|---|
| **SQLite (per business, per device)** | System of record on-site; authoritative for locally created documents | Full master data, full local transaction history within the retention window, stock movements + projections, local journal, outbox, sync cursors, print queue, audit chain |
| **PostgreSQL** | Consolidated system of record across devices/branches; source for cloud reporting, compliance, backup | Everything in §14 of the PRD + `sync_operations`, `change_log`, dead-letter, entitlement, aggregates |
| **Object storage** | Documents, images, backups, GSTR exports | Uploaded via presigned URLs, never through the API process |
| **Redis** | Auth/permission cache, rate limits, distributed locks, job queues | Never a source of truth |

**Money:** `INTEGER` paise everywhere (`BIGINT` in Postgres). **Quantity:** `INTEGER` milli-units (3 dp). **Tax rate:** `INTEGER` basis points. No `REAL`/`FLOAT`/`NUMERIC`-as-float anywhere in a financial column — enforced by a schema lint in CI (NFR-004).

**Identifiers:** ULID primary keys generated on the device. Sortable, collision-free without coordination, and stable through sync (FR-064). Human-facing document numbers are separate and per-series (C-2).

---

## 8. POS transaction boundary

```text
 UI: cart state (renderer, disposable)
      │  sales.complete({ cartSnapshot, tenders, operationId })
      ▼
 ── ONE SQLite transaction (IMMEDIATE, synchronous=FULL) ────────────
   1  validate (permissions, register open, tenders, stock policy)
   2  recompute totals server-side-of-IPC — never trust renderer maths
   3  allocate invoice number from the terminal's series
   4  insert sale + sale_items (tax snapshot per line)
   5  insert tenders / payment + allocations
   6  insert stock_movements (issue cost from CostingEngine)
   7  update stock_levels projection + moving-average cost
   8  insert journal_entry + lines   (assert Σdebit = Σcredit)
   9  insert daily aggregate deltas
  10  insert audit record (hash-chained)
  11  insert outbox rows (sale, payment, movements, journal)
 ── COMMIT  ← the transaction is now durable and complete ───────────
      │
      ├─► return success to UI (target < 300 ms, NFR-001)
      ├─► enqueue print job     (async, failures never roll back)
      ├─► kick cash drawer      (async, best effort)
      └─► nudge sync worker     (async, best effort)
```

Everything after COMMIT is **best-effort and retryable**; nothing after COMMIT can invalidate the sale (NFR-012, §28). This single diagram is the contract the whole product rests on.

---

## 9. Hardware architecture

```text
POS service  ──►  HardwareManager  ──►  DeviceInterface  ──►  Adapter  ──►  Transport
                       │                                                    USB / COM /
                       ├─ device registry (config, capabilities, health)     TCP / HID /
                       ├─ connection supervision + reconnect                 Win spooler
                       └─ event bus (scan, weight, status) → renderer
```

- Interfaces per PRD §11 (`Printer`, `Scanner`, `CashDrawer`, `Scale`, `LabelPrinter`, `CustomerDisplay`); vendor adapters behind them (Constraint 7).
- **Scanners** are keyboard-wedge by default: handled as a timing-based input filter in the renderer with a main-process fallback for HID mode — no driver work needed for Tier 1.
- **Receipt printing** targets ESC/POS raw bytes to the Windows spooler (deterministic, fast) with a PDF path for A4. The drawer is kicked through the printer's DK port.
- Every device has a **simulator adapter** used in CI and demos, so the full golden flow (§8 of the PRD) is testable without hardware.
- Hardware state is a *projection for the UI*, never a precondition for a sale.

---

## 10. Security architecture

| Layer | Controls |
|---|---|
| Renderer | `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, strict CSP, no remote content, navigation + `window.open` denied by default, DevTools off in production builds |
| Preload | Generated allowlist of exactly the contract's methods; no `ipcRenderer`, no `require`, no path or shell surface |
| IPC | Zod validation on every payload, permission check **in main** against the server-issued role claims (never the renderer's copy), per-channel rate limits, correlation ids, uniform error envelope with no stack traces to the renderer |
| Local secrets | Tokens, device keys and the DB key in Electron `safeStorage` / Windows Credential Manager — never in SQLite or config files (NFR-007) |
| Local data | Optional encrypted SQLite (SQLCipher-family) with key escrow decision documented (NFR-020); file ACLs to the installing user |
| Transport | TLS 1.2+, certificate validation, signed device attestation header, short-lived access token + device-bound rotating refresh token |
| Cloud | RLS tenant isolation, per-endpoint authz, rate limits per device and per org, audit of privileged reads, secrets in a managed vault, least-privilege DB roles (the API role cannot `DELETE` from `audit_log` or `journal_line`) |
| Supply chain | Locked dependencies, SBOM, `npm audit`/Dependabot gate, signed Windows installer (EV / Azure Trusted Signing), signed update manifests |

---

## 11. Observability

- **Device:** structured rotating JSON logs (`app`, `sql-slow`, `sync`, `hardware`), a local `Diagnostics` screen (DB size, integrity check, outbox depth, oldest unsynced op, last sync, hardware health, clock skew), opt-in crash reports with PII scrubbing, and a one-click **support bundle** (logs + schema version + counts, no invoice contents).
- **Cloud:** OpenTelemetry traces spanning `device op_id → ingest → DB write`, RED metrics per endpoint, sync lag histograms per device, dead-letter depth, backup success, Postgres health. *(As built, ADR-0053: Prometheus metrics, Loki logs and scheduled business-health probes; traces are deferred, request ids in the logs stand in.)*
- **Business-health alerts** (these are what actually catch incidents): devices with outbox depth > N for > 1 hour, devices silent > 24 h, ingest verification-mismatch rate, trial-balance imbalance count, negative-stock spikes, e-invoice failure rate.

---

## 12. Backup, recovery, updates

- **Local:** rolling nightly SQLite backups via the online backup API (safe under WAL), integrity-verified, retained N copies, plus a pre-migration backup before every schema upgrade.
- **Cloud:** continuous WAL archiving, PITR (RPO ≤ 15 min, RTO ≤ 4 h per NFR-010), monthly restore drills — a backup that has never been restored is not a backup.
- **Restore-to-new-device** is the same code path as FR-086 hydration, which is why hydration cannot be Phase 2.
- **Updates:** `electron-updater`, signed manifests, staged rollout by cohort, forward-only DB migrations with a pre-migration backup and automatic rollback-to-backup if migration fails, and a version-compatibility handshake with the sync API (FR-105).

---

## 13. Environments & CI/CD

`local → dev → staging (prod-like, real GSP sandbox) → production`. Desktop channels: `dev`, `beta`, `stable`.

CI on every PR: typecheck, lint, unit tests (domain engines with golden vectors), migration up/down test, contract tests (IPC zod + OpenAPI-generated Go/TS types), the cross-language golden-vector run (TS and Go engines on the same fixtures), integration tests on a real SQLite file, simulated-hardware E2E, financial **property tests** (`Σdebit = Σcredit`, `stock = replay(movements)`, `Σallocations ≤ payment`), and the §37 offline/sync scenario as a nightly soak. Release: Windows build + sign + notarized manifest, cloud image + migration gate + canary.

---

## 14. Key decisions register

| ID | Decision | Rationale | Cost of being wrong |
|---|---|---|---|
| AD-1 | SQLite as on-site system of record, cloud as consolidator | D1, D2 | Low — this is the product |
| AD-2 | Cloud in Go/Echo; domain engines ported to Go; golden vectors are the cross-language contract | Team choice; D8 satisfied by fixture equality rather than shared code | Medium — two engines to keep in lockstep |
| AD-3 | Documents append-only; corrections are new documents | D3, §21 | High if reversed — retrofitting immutability is a data migration |
| AD-4 | Stock derived from an immutable movement ledger | D7 | High — the alternative loses stock accuracy offline |
| AD-5 | Per-terminal document series | C-2, GST legality | High — renumbering live invoices is not possible |
| AD-6 | Integer paise / milli-units / basis points | NFR-004 | High — every financial column and every stored total |
| AD-7 | Moving weighted average costing at MVP | Simplicity; FIFO needs layer tracking | Medium — a revaluation run |
| AD-8 | Oversell allowed by default, reconciled after sync | Shop reality beats false precision | Low — a policy flag |
| AD-9 | Multi-terminal is eventually consistent at MVP; LAN hub is Phase 2 | Scope | Medium — hub mode is additive |
| AD-10 | RLS + `business_id` single DB (no schema-per-tenant) | Ops simplicity at 10k tenants | Medium |
| AD-11 | ULID ids generated on device | Offline id generation without coordination | High |
| AD-12 | Hardware strictly outside the transaction boundary | NFR-012 | High |

---

## 15. Top risks

| Risk | Impact | Mitigation |
|---|---|---|
| Offline oversell across terminals erodes trust in stock | High | Movement ledger, reconciliation report, honest UI ("last synced 2h ago"), LAN hub in Phase 2 |
| E-invoice/e-way GSP integration slips (external API, changing spec) | High | Isolate behind an adapter + queue from day one; keep out of MVP-1; never in the commit path |
| Tax logic divergence device (TS) vs cloud (Go) | High | One fixture suite run by both engines in CI + nightly differential fuzz + server-side re-verification |
| SQLite corruption on cheap hardware / power cuts | High | `synchronous=FULL`, startup integrity check, rolling backups, cloud restore path, documented user journey |
| Electron footprint on 4 GB HDD machines | Medium | Startup budget in CI, lazy module loading, indexed queries, utility process for reports |
| Windows-only support burden (printers, drivers, AV false positives) | Medium | Signed installer, Tier-1 hardware certification list, simulator-based CI, remote diagnostics bundle |
| Accounting errors discovered after go-live | Very high | Double-entry assertions at commit, nightly self-audit, property tests, CA review of the posting matrix before launch |
| Scope creep toward "full ERP" | High | §39 boundary held; MVP-1 split in `muneem-prd-review.md` §5 |
