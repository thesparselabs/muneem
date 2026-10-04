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
packages/domain   Pure engines: money, GST, ids, financial year, catalog rules (names, barcodes, units, prices).
                  Money and GST give the same results as cloud/internal/domain (Go).
packages/contracts IPC registry (zod), errors, permissions, OpenAPI HTTP contract → TS + Go types
packages/db-sqlite Local DB: pragmas, migrator, schema, audit hash chain, outbox, repositories, sync apply path
packages/sync-reference In-memory reference implementation of the sync protocol, for tests (ADR-0042)
cloud/            Go + Echo API, Postgres with row-level security, Go port of the engines; cloud/Dockerfile = the image
deploy/           Production kit for one VM: compose (api + Caddy), deploy.sh, roles.sql, S3 lifecycle (ADR-0051)
deploy/monitoring Prometheus, Loki, Grafana (dashboards + alert rules as files), crash collector, Alloy (ADR-0053)
docs/runbooks/    Operator procedures (ops-*.md, Stage 9i) beside one page per alert (Stage 9c)
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
| Shop ↔ operator | No shop user reaches `/v1/admin` or `/admin`; no operator token opens a shop route; only `muneem_admin` reads across shops | operator grants written only by the owner role; operator tokens under derived keys with scope `op`; `muneem_admin` SELECT policies (ADR-0057) |
| Hardware / network | Never inside the commit path | (Stage 3+) design rule, HLD §8 |
| Sync transport ↔ SQLite | The utility process does HTTP only; main alone writes, and a pulled change never writes an outbox or audit row | process split (HLD §3.1); round-trip no-echo test |
| TS ↔ Go sync servers | Same answers to the same requests | shared protocol fixtures in both suites (ADR-0042) |
| Billing thread ↔ history-wide reads | Reports and integrity checks read in a worker thread on its own read-only connection; main only heals | read worker (ADR-0058); `pnpm scale` sells within budget while the checks run at 500k |
| Hot-path SQL ↔ table size | No scan of a growing table, no walk of a whole business's rows | `EXPLAIN QUERY PLAN` gate on the SQL the hot paths really run (`test/queryPlans`) |

## Invariants checked by tests

- `Σ debit = Σ credit` (Stage 6 will add the ledger; the CHECK constraint is in the LLD schema)
- `Σ apportion(total, w) = total`, always
- `cgst + sgst = pctOf(taxable, rate)`; `|cgst − sgst| ≤ 1`
- `total = taxable + taxes + round_off`
- `replay(audit rows) → hash chain verifies`, gap-free `seq` per device, on the device and again on the cloud (8g)
- After a SIGKILL mid-write: no orphan audit or outbox row, `local_sequence` consistent
- A failed product save or import leaves no product, barcode, price, category, audit or outbox row behind
- An inclusive selling price never exceeds MRP; one live barcode code per business
- Barcode lookup p95 < 30 ms and search p95 < 60 ms at 5,000 SKUs
- A sale's total = taxable + taxes + round-off, intra-state sales carry no IGST and vice versa, and paid − change =
  total (database CHECKs); sales, lines and tenders are append-only (triggers)
- After repeated SIGKILLs mid-billing: no sale without its lines, tenders, audit row, outbox row and print job; no
  orphan rows; invoice numbers gap-free per series with no number consumed by an unsaved sale
- `sales.complete` p95 < 250 ms at 5,000 SKUs
- replay(movements) = projection, for every (product, warehouse); Σ movement values = Σ stock levels (valuation
  sub-ledger); a stock level never has value without quantity; movements are append-only
- After repeated SIGKILLs mid-billing: one movement per sale line and no stock drift
- Σ party ledger entries = open charges − unallocated settlements, per party (domain property and `reconcilePartiesDb`);
  a settlement never allocates more than it holds and a document is never settled past its amount (triggers + CHECKs);
  an allocation only joins live documents of one party; a debit note never returns more than was bought on a line
- A purchase's total = taxable + taxes + charges + round-off (|round-off| ≤ ₹1); a line's landed value = taxable +
  its charges + tax that cannot be claimed (CHECK); party entries, purchases, debit notes, payments, allocations and
  expenses are append-only apart from status and allocation totals
- A supplier return leaves at its landed cost and replay = projection still holds; an issue that leaves stock on hand
  never takes more than the stock is worth (ADR-0027)
- After repeated SIGKILLs mid-billing: one ledger entry per credit sale and the party ledgers reconcile
- A sale line returned in any number of parts adds up to the line exactly, and a whole bill returned is exactly the
  bill (domain properties, Go-shared golden vectors); a credit note never returns more than was sold on a line
  (trigger); output tax in the ledger = sales tax − credit-note tax (tie-out); after SIGKILLs mid-return no credit note
  is missing its lines, stock movements, party entry, journal, receipt, audit or outbox row (ADR-0043)
- `purchases.create` (200 lines) p95 < 1 s; a payment settling 500 bills < 250 ms; reconciliation of 10,000 documents
  < 2 s
- Every journal balances (engine + CHECK) and equals its lines; a document has one journal and at most one reversal; no
  group account is posted to; the balance cache equals the lines
- The general ledger ties out: 1400 = stock valuation, 1300 = Σ customer balances, 2100 = Σ supplier balances, each tax
  account = its documents — after every document test, the golden flows, the soak run and the kill -9 suite
- On the soak dataset: the Trial Balance and Balance Sheet balance, and P&L = Δ equity

## Catalog (Stage 2)

- **Where it lives:** the device only, until Stage 7 ships the outbox (ADR-0008). Tables: `uom`, `category`, `brand`,
  `product`, `product_variant` (no API yet), `barcode`, `uom_conversion`, `price_list`, `price_list_item`, and the
  search index `product_fts` keyed by `product_search_key`.
- **One product save = one transaction:** the product, its barcodes, unit conversions, selling price and search row,
  one audit row, and outbox rows for each part that depend on the product's row.
- **Prices:** there is no price column on `product`. The selling price is an item in the business's default `Retail`
  list, and every price is chosen by `resolvePrice` (quantity break, effective date, unit conversion) (ADR-0011).
- **Scan path:** `barcode` unique index → cached prepared statement → 500-entry LRU in `ProductSearch`, cleared on any
  catalog write (ADR-0012). Search order: barcode, SKU, name prefix, then word match (ADR-0009).
- **Import:** file bytes over IPC → preview kept in main memory → one-transaction commit, idempotent on `commandId`
  (ADR-0010).
- **Main-process services:** `CatalogContext` (actor, business, business date, default seeding) is shared by
  `ProductService`, `ProductSearch`, `CatalogService`, `PricingService` and `ImportService`.

## Billing (Stage 3)

- **The commit** (HLD §8, ADR-0013): one `BEGIN IMMEDIATE` transaction made of named steps — invoice number, sale +
  lines (tax snapshot per line) + tenders, receipt print job, one audit row, one outbox row for the whole sale. Stage 4
  adds a stock step and Stage 6 a journal step; nothing else changes.
- **Authority** (ADR-0016): the renderer totals the cart instantly with the same GST engine; the main process re-prices
  and recomputes, and refuses a total the cashier did not see (`TOTAL_MISMATCH`). A repeated `commandId` returns the
  first sale.
- **Numbering** (ADR-0014): one series per terminal and financial year, created on first use, allocated inside the
  commit (`DEL1/T01/2026-27/000001`).
- **Registers** (ADR-0017): one open session per terminal; expected cash, X/Z reports, variance needing a manager.
- **Printing** (ADR-0015): the print job is part of the sale; printing and the drawer run afterwards from a queue that
  records every outcome and never throws. Printer settings are per device. Since 9d (ADR-0055) an installed Windows
  printer takes RAW ESC/POS jobs through a PowerShell `WritePrinter` helper (name in the environment, bytes on stdin,
  no shell) or, in image mode, a silent driver print of the receipt page; lines the code page cannot carry (Indic, ₹)
  go as `GS v 0` raster lines drawn in a hidden page. Every transport is time-boxed and a failure only fails the job.
- **Main-process services:** `PosContext` (till, settings, permissions) is shared by `CustomerService`,
  `RegisterService`, `SalePricing`, `SaleService`, `HeldBillService`; `PrintQueue` owns printing.

## Inventory (Stage 4)

- **Ledger** (ADR-0018): `stock_movement` is the source of truth and append-only; `stock_level` is a cache written only
  by `postMovement`, in the same transaction, through the pure moving-average engine (`@muneem/domain`). Each movement
  stores the exact change it made to the stock value, so Σ movement values = Σ levels and `replayMovements` can
  re-run the engine to verify every level and every movement.
- **Below zero**: issues use the last known cost and are marked provisional; the next receipt re-costs them with a
  value-only `cost_correction` movement.
- **Writers**: sales (a cost step before the append-only lines and a stock step after them, ADR-0019), opening stock,
  adjustments and stock takes (adjustment documents, ADR-0021), purchases at landed cost and supplier returns at
  their own cost (Stage 5, ADR-0023/0024).
- **Policy** (ADR-0020): `inventory.negativeStock` block / warn / allow, with a per-product override; quotes carry stock
  warnings; a negative sale is audited.
- **Integrity**: Diagnostics and a 6-hourly timer replay the movements against the cache and rebuild any drift.

## Parties and purchases (Stage 5)

- **Sub-ledger** (ADR-0022): `party_ledger_entry` is append-only and written only by `postPartyEntry`, in the same
  transaction as its document. Positive means the party owes the business. Documents are charges (credit sales,
  purchases, credit expenses, openings) or settlements (payments, debit notes, credit notes, write-offs, opening advances).
  `PARTY_DOCUMENTS_SQL` reads them all in one shape, and `reconcilePartiesDb` checks entries against them.
  Diagnostics and the 6-hourly timer run it and report a mismatch; they never heal it.
- **Allocation** (ADR-0025): settlements are applied to charges in `allocation` rows, oldest due date first or as
  chosen. Triggers keep `allocated_paise`/`settled_paise` on both documents, and allocations end only by being
  voided.
- **Purchases** (ADR-0023/0024/0028): priced through the GST engine with the supplier's state; ITC only when both
  sides are regular. Freight is landed by taxable value, stock is received at landed cost, and the bill total is
  checked to ±₹1. Debit notes return goods at their own cost in cumulative shares. Cancel reverses a wrong entry.
  Numbers are per terminal with a kind letter.
- **Payments and expenses** (ADR-0025/0029): receipts in, supplier payments out; cash through an open drawer moves
  the register's expected cash. Paying a supplier needs `suppliers.view`. Expenses use seeded categories mapped to
  LLD expense accounts.
- **Credit at the POS** (ADR-0026): the `credit` tender, the limit checked inside the sale (no limit = ₹0) with an
  audited override, and a `party` step in the sale commit.
- **Screens**: the session carries permissions so menus hide what a user cannot do; main stays authoritative.

## Accounting (Stage 6)

- **Journals** (ADR-0030): every document posts its journal **in its own transaction**, built from the document as
  stored by one builder per document type (`documentJournals.ts`), using posting rules written as data in
  `@muneem/domain` (ADR-0032 is the as-built matrix, `docs/accounting/posting-matrix.md`).
  - **The writer:** `postJournal` is the only writer of journals and the `account_balance` cache.
  - **Database guards:** an unbalanced, two-sided, negative, group-account or second journal for a document cannot be
    stored.
  - **Cancels** post the mirror journal under the original's number, branch and terminal.
  - **Numbering** (ADR-0037): a journal takes its document's number. One without a document number (write-off, party
    opening, stock document, manual journal) takes a `J` number from the posting terminal's series and needs a terminal.
- **Accounts** (ADR-0031): LLD §5.1 plus one input and one output account per tax head, seeded with the business. Rules
  name accounts by role. Card/UPI takings wait in 1250 Clearing.
- **Periods** (ADR-0033): calendar months, lockable once ended. A document dated into a locked month posts late into
  the earliest open month, flagged and listed. Purchases post on the supplier's bill date.
- **Tie-outs and integrity** (ADR-0034):
  - **The tie-outs:** 1400 = stock valuation, 1300 = customer balances, 2100 = supplier balances, and each tax account
    = its documents.
  - **The backfill** posts anything saved before Stage 6. Each business gets it once per run, with the terminal and user
    fixed when it starts, and each journal is queued for sync after its document.
  - **Diagnostics and the 6-hourly timer** rebuild a drifted balance cache and report everything else.
- **Year end** (ADR-0045): a closing journal moves the year's income and expense to 3300. `postClosingJournal` is the
  only posting into a locked month, and statements leave closing journals out of P&L.
- **Manual journals** (ADR-0035) never touch AR, AP, Inventory or tax accounts, so the tie-outs hold by construction.
- **Statements:** Trial Balance, P&L and Balance Sheet read the journal. Retained earnings are computed until Stage 8's
  closing journal, and customer advances and supplier debits are presented apart.

## Sync (Stage 7)

- **The wire** (LLD §7, `packages/contracts` `protocol.ts`):
  - **Push:** per-operation results; a duplicate is a success.
  - **Pull:** paged, one of four streams (control, config, masters, documents).
  - **Bootstrap:** hands out a gzipped NDJSON bundle for a new device.
  - **Payloads:** each outbox payload is a whole document with its movements, party entry and journal, typed per
    entity in `payloads.ts`.
- **Cloud** (`cloud/internal/devicesync`, ADRs 0038, 0039 and 0041):
  - **Storage:** each operation is applied in its own transaction into `entity_state`, with journals also in typed
    tables and every accepted write in `change_log`.
  - **Verification:** GST and totals are recomputed with the Go port, and every journal is checked against its
    document. A failure goes to `dead_letter` whole.
  - **Conflicts:** masters merge by field, the cloud wins on price, tax and config, a tombstone wins, and every
    resolution is logged.
  - **Ordering:** pushes for one business are serialized.
  - **Audit chain** (8g, ADR-0048): audit rows arrive as push-only `audit_entry` operations and are kept per device
    chain in `audit_entry`, never in `change_log`. `devicesync/auditchain` recomputes each hash with a Go port of
    `canonicalJson` (shared fixtures in `packages/contracts/fixtures/canonical`); a break is `AUDIT_CHAIN_BROKEN`.
- **Device** (`apps/desktop/src/main/sync`, ADR-0040):
  - **Push:** the `SyncEngine` claims the outbox in seq order and settles each result: sent, retry with backoff,
    failed, dead after 12 attempts, or superseded. HTTP and gzip run in a utility process.
  - **Pull:** applies a page and its cursor in one transaction. Other terminals' documents are stored with their
    stored values (no re-costing) through `postSyncedJournal` and the same projections local writes use.
  - **Natural keys:** rows each device makes on demand (periods, accounts, units) are matched by natural key.
  - **Movement order:** every device replays movements in the same order.
- **Hydration:** a new device downloads the bundle with resume and applies it through the pull path. The bundle's
  documents carry every version, from `change_log`.
- **Invariants checked:**
  - the simulation suite: three devices behind a seeded fault injector, with no loss, no duplicates, the same books
    and catalog everywhere, and deterministic conflict outcomes;
  - the §37 scenario;
  - the protocol fixtures on both servers;
  - NFR-022 throughput.

## Reports, compliance, backup and update (Stage 8)

- **Reports** (ADR-0046, ADR-0058): a `ReportDefinition` catalogue of 25 business, statement and GST reports runs in
  the read worker on its own read-only connection. CSV, XLSX and PDF writers share one document shape with the business header. The user picks
  where an export goes, so the renderer never sees a path.
- **Dashboard:** it reads daily summary tables that triggers keep current in the same transaction as each document,
  including pulled ones. Diagnostics checks for drift and heals it. The cloud keeps the same aggregates.
- **Returns** (ADR-0043): credit notes have their own tables and `C` series, price each line from the sale's own tax,
  and post through `SALE_RETURN_RULE`.
- **GST** (ADR-0044): GSTR-1, GSTR-3B, the HSN summary and the ITC register are built from documents and must equal
  each month's tax-account movements. `gst_setoff` and `gst_payment` documents clear the tax accounts in the
  statutory order.
- **Year end** (ADR-0045): see Accounting.
- **Backups** (ADR-0047): AES-256-GCM `.mbk` archives with a device-signed manifest, kept by retention and uploaded
  nightly. The data key is escrowed with the cloud, wrapped by a server master key. Restore works locally, from the
  cloud, or by hydration.
- **Audit chain** (ADR-0048): audit rows sync on a push-only stream. Both servers check sequence, link and hash, and
  a break is dead-lettered, alerted and shown on every device.
- **Updates** (ADR-0049): channels and a staged rollout by installation cohort; installs only when the POS is idle.
  The migration guard takes a backup, migrates in one transaction, checks, and restores on failure. The cloud accepts
  sync protocols N and N−1.
- **Invariants checked:**
  - a restored device (hydrated or from a cloud backup) has the **byte-identical** Trial Balance at every month end,
    equal to the cloud's;
  - each month's returns equal the tax accounts;
  - a closed year's reports are unchanged;
  - a tampered backup or audit row is refused.
## Notifications and customer privacy (Stage 8h)

- `apps/desktop/src/main/notifications/`: detectors (pure functions over injected sources) → `NotificationService`
  (raise-or-update and resolve per kind and entity, ADR-0050) → the `notification` table, which is **local and
  never synced**. The runner is driven by start-up, a business opening, the 6-hourly timer, `sync.status` changes
  and stock-moving commits; other modules raise through `notifications.service.notify(kind, …)`. The renderer reads
  it through `notifications.*` and hears `notification.new`.
- DPDP consent rides inside the customer master (`consents`); erasure blanks the profile, keeps the row, the ledger
  and every sale's customer snapshot, and the cloud refuses to un-erase a customer.
- Invariants (tests): a detector run twice changes nothing; at most one open notification per (business, kind,
  entity); erasure leaves the tie-outs and party reconciliation clean and is refused with a balance.

## Identity and trust

- Cloud is authoritative for users, roles and permissions; the device caches a **permission snapshot** and enforces
  it in the main process, never from the renderer's copy.
- Each installation has an Ed25519 key pair; the private key lives in the OS credential store via Electron
  `safeStorage`. Requests are signed (see ADR-0003).
- Offline login verifies against an Argon2id hash computed on the device from the entered password; the server's hash
  is never sent down.
- Server secrets are keyrings (ADR-0052):
  - access tokens carry a `kid` from `JWT_SECRETS`;
  - escrowed backup keys record the `master_key_version` that wrapped them, and `muneem-api rewrap` moves them to
    the active one.

## Production (Stage 9b)

- **Topology (ADR-0051):** one VM runs the API container behind Caddy, with managed Postgres (point-in-time recovery)
  and managed S3. The procedures are in `docs/operations/deploy.md`.
- **Database roles:** the API runs as `muneem_app` (inside `muneem_api`, so RLS applies). Migrations, `roles.sql` and
  `rewrap` run as the owner role, and the owner's credentials never reach the API container.
- **Probes:** `/v1/health` is liveness (devices use it); `/v1/ready` pings Postgres and object storage, and gates
  deploys.
- **Shutdown:** SIGTERM drains HTTP, then snapshot builds, within 25 s.
- **Per instance:** rate limits are per instance until they move to Redis.

## Observability (Stage 9c)

- **Metrics (ADR-0053):** `cloud/internal/metrics` owns the only Prometheus registry. It is served on its own
  listener (`MUNEEM_METRICS_ADDR`, loopback by default) and never on the public server or through Caddy. Domain
  packages report through small observer interfaces and do not import Prometheus. Labels are route templates, codes
  and opaque ids, never names or amounts.
- **Probes:** `cloud/internal/health` runs single-flight on a timer in the API. It reads cross-tenant aggregates only
  through migration 0008's SECURITY DEFINER functions, so the API role still cannot read another shop's rows. The
  gauges are replaced on every run.
- **Heartbeat:** every push may carry the device's outbox state, negative-stock count and last integrity report
  (ADR-0054). It is telemetry, so it is clamped and never fails a push. The device keeps its report in `app_meta`
  (`integrity_report:<business>`), written by `DiagnosticsService.scheduledChecks` every 6 hours.
- **Crash reports:** off unless the owner turns on `telemetry.crashReports`. The desktop scrubs by allow-list before
  sending, and the collector (`muneem-api crash-collector`) scrubs again. Minidumps stay on the machine.
- **Invariants checked by tests:**
  - `/metrics` is absent from the public server;
  - the probes see every shop through the RLS-bound role, and the role alone sees none;
  - every alert rule has a runbook, and every metric a rule or dashboard uses is exported;
  - scrubbed reports contain none of a PII fixture's values, on both the desktop and the collector.
## Operator tooling (Stage 9i)

- **Package:** `cloud/internal/admin` (ADR-0057). Its JSON API is `packages/contracts/openapi/muneem-admin-v1.yaml`,
  generated into `cloud/api/adminapi`, separate from the device contract. The admin page is `html/template`, with no
  JavaScript.
- **Listener:** the API serves `/v1/admin` and `/admin/` on `MUNEEM_ADMIN_ADDR` (port 8081, published only on the
  VM's loopback). It mounts them on the public server only when `MUNEEM_ADMIN_PUBLIC=true`.
- **Operators:** a row in `operator_grant`, written only by `muneem-api grant-operator` as the owner role. Operator
  tokens are signed with keys derived from the JWT ring (`Keyring.Derive`), carry scope `op`, live 15 minutes, and are
  re-checked against the grant on every request.
- **Database:** cross-shop reads run as `muneem_admin`, through the login role `muneem_admin_app`, in transactions that
  `SET LOCAL ROLE muneem_admin`. That role has SELECT policies on the tables it needs, and writes only dead-letter
  resolutions and `admin.*` audit rows. Revoke and resend run as the app role inside the one shop's scope, reusing
  `device.Revoke` and `devicesync.Ingest.Reapply`.
- **Audit:** every operator read and action, every sign-in and every failed sign-in is an `admin.*` row in `audit_log`.
  Actions carry a required reason.
- **Dead letters:** a dead letter is open until an operator resolves it (`resent` or `dismissed`) or the device's same
  operation applies.

## What is not built yet

Attachments upload (FR-075), SMS/WhatsApp reminders, e-invoice and e-way bill, GST portal JSON and composition
returns (GSTR-4/CMP-08), a cloud owner web UI and FR-103 retention. In inventory: transfers, multiple warehouses per
branch, batch/serial tracking. In billing: manager PIN override (USB/Windows printers and non-ASCII receipt text
landed in 9d). In purchases and payments: purchase orders and GRN, reverse charge, debit-note cancellation, refunding a
customer's advance, TDS/TCS. Product variants, weighed barcodes and label printing are deferred (ADR-0008). Production
deployment, monitoring, signed releases and the pilot are Stage 9. See `build-stages.md`.
branch, batch/serial tracking. In billing: manager PIN override; USB/Windows printers and non-ASCII receipt text
(Stage 9). In purchases and payments: purchase orders and GRN, reverse charge, debit-note cancellation, refunding a
customer's advance, TDS/TCS. Product variants, weighed barcodes and label printing are deferred (ADR-0008). Signed
releases and the pilot are Stage 9, as are the nightly pilot health report (ADR-0054) and uploading native minidumps
(ADR-0053). See `build-stages.md`.
