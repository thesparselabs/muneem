# Stage 7 — Sync: implementation plan

## Context

Stages 0–6 are built; Stage 6 (PR pending) is done on `feat/stage-6-accounting`. Stage 7 (LLD §20) is "Sync: outbox,
push, pull, hydration, dead-letter, status UI, Go cloud ingest with verification". The exit criteria are **the
deterministic simulation suite green** and **the PRD §37 scenario green**.

**What already exists:**
- **Device:**
  - every write since Stage 1 appends an outbox row in its own transaction (ADR-0006). The row has a ULID operation id,
    a canonical JSON payload with a sha256 hash, and `depends_on_operation_id`. There are 33 entity types.
  - `sync_cursor` (one row per stream: masters, config, documents, control), `sync_log`, and a `sync_state` column on
    most tables.
  - `readSyncStatus` derives the state for the badge.
  - a signed cloud client (`cloudClient.ts`), a health-probe connectivity monitor, and a `refreshAccessToken` that is
    not yet retried on 401.
- **Cloud:**
  - auth, businesses, branches, terminals and devices, with Ed25519 request signing and RLS.
  - `device.last_push_seq`, `last_pull_seq`, `outbox_depth` and `clock_skew_ms` columns.
  - `GET /health` reports sync protocol 1.
  - Go ports of money and GST only, checked against the shared fixtures in `packages/domain/fixtures`.
- **Nothing drains the outbox yet.** There are no `/sync/*` routes, no `change_log`, no dead-letter, no conflict log,
  and no hydration.

**What the design gives:**
- the push and pull protocol (LLD §7.1–7.2) and hydration (§7.3);
- the operation state machine, backoff, ordering, scheduler and status model (§8);
- the conflict matrix (§9);
- the utility-process split, where transport is out of process and main is the only writer (HLD §3.1);
- the simulation suite (LLD testing table);
- the §37 scenario, with the additions in the PRD review §6.

**What the design does not cover:**
- **The device's id on the cloud:** how the local `installation_id` maps to the cloud device id (ADR-0005 left this to
  Stage 7).
- **Cloud storage:** how documents are stored in Postgres when the cloud does not yet report on them.
- **Applying another terminal's documents** to a device's stock, party ledgers and books: what is recomputed and what
  is taken as stored.
- **Movement order:** the order in which pulled movements replay (carried from Stage 4).
- **Business-wide locks:** whether period locks hold across terminals.
- **Businesses created offline:** how a business created on the desktop before it ever synced reaches the cloud
  (ADR-0006).

**Decisions (user, 2026-10-04):**
- **Verification:** the cloud recomputes GST and document totals with the Go GST port. It also checks that every
  journal balances and agrees with its document's amounts. **Allocation gets a Go port** with shared fixtures
  (ADR-0025). Posting rules and costing stay TypeScript-only; their output is stored and checked for balance, not
  rebuilt.
- **Pull scope:** **everything** flows down: masters, config, control and other terminals' documents. Pulled documents
  are applied through the repositories, so stock, party ledgers and journals stay derived on every device.
- **Transport:** an **Electron utility process** handles HTTP, compression and retry timers. Main alone writes SQLite.
- **Hydration:** the cloud builds a **gzipped NDJSON bundle** per business into **S3-compatible storage** (MinIO in
  docker-compose). The device downloads it with resume from a presigned URL and imports it through the same apply
  path as pull.

## Design (ADRs written in 7a)

- **ADR-0038 — Cloud storage for synced entities.**
  - **Every entity:** stored as its latest payload in `entity_state(business_id, entity_type, entity_id, version,
    payload jsonb, origin_device_id, deleted_at)`. Financial documents are insert-only; a cancel is a new version
    whose payload records the cancel.
  - **Journals:** also projected into typed `journal_entry` and `journal_line` tables in the same transaction, so the
    cloud can compute a Trial Balance and §37 can compare it with each device's.
  - **Reports:** typed tables for the rest wait for Stage 8.
- **ADR-0039 — Device identity on the wire.**
  - **Mapping:** the device pushes as its cloud device id (from registration); the `installation_id` stays on local
    rows.
  - **Idempotency:** the key is `(business_id, cloud_device_id, operation_id)`.
  - **Businesses created offline:** pushed first as a `business` operation. Branches, terminals and series follow as
    operations that depend on it.
- **ADR-0040 — Applying pulled documents.**
  - **Stored values are facts.** A pulled sale, purchase or adjustment is inserted with its stored movement values,
    party entries and journal. It is never re-costed and never generates cost corrections. Only the device that posted
    a receipt corrects costs for it, so two devices can never both correct the same receipt.
  - **The projections follow.** Stock levels and party balances are rebuilt from the inserted rows, and the
    `account_balance` cache from the inserted lines.
  - **Movement order:** pulled movements replay by `(occurred_at, origin device, local seq)`, the same everywhere, so
    every device's replay check agrees. This settles the Stage 4 note.
  - **Locks:** a pulled journal keeps its entry date. Periods are cloud-authoritative config on the control stream, so
    a lock taken on one terminal reaches the others. A document from a device that had not heard of the lock is
    stored as sent and listed as a late arrival for review.
- **ADR-0041 — The conflict matrix as built** (LLD §9).
  - **Masters:** field-level last-writer-wins by `updated_at`, ties broken by device id.
  - **Cloud wins:** on price and tax fields, the credit limit, users and roles, and config. The losing edit is kept in
    `conflict_log`.
  - **Deletes:** a tombstone wins over a concurrent update.
  - **Duplicates:** a barcode created on two devices becomes a duplicate-candidate review item.
  - **Recording:** every non-trivial resolution writes `conflict_log` on the cloud, which is pulled to devices as
    review items.
- **ADR-0042 — How sync is tested.**
  - **The simulation:** two or more virtual devices (real `App` instances on SQLite) talk to an in-memory reference
    server written in TypeScript. A seeded fault injector drops, duplicates, reorders and delays requests,
    partitions the network, returns 500s and skews clocks. The run is deterministic per seed, with many seeds in CI.
  - **Keeping the two servers equal:** shared protocol fixtures (request/response pairs) run against both the
    reference server and the Go server.
  - **The real thing:** the §37 scenario and a smaller simulation run end to end against the Go server and Postgres in
    a CI job.

## Schema

**Cloud migration `0002_sync`:**
- `sync_operation`: the idempotency record, unique on (business, device, operation). It holds the status (applied,
  rejected, deferred) and the server seq.
- `change_log`: a per-business `BIGSERIAL` seq, with stream, entity type and id, op, version, payload and origin
  device.
- `entity_state`, plus the typed `journal_entry` and `journal_line`.
- `dead_letter`: the full payload and error.
- `conflict_log`.
- `snapshot`: a bundle per business, with `as_of_seq`, the object key and its expiry.
- All with RLS.

**Device migration `0014_sync`:**
- `conflict_log` (review items pulled from the cloud);
- `hydration_state` (the download offset and import progress);
- `sync_device` (the cloud device id, protocol and schema versions);
- in `sync_outbox`, `in_flight` rows older than 5 minutes are reclaimed at start-up. This is code, not schema.

## Existing code to reuse

- **On the device:**
  - `appendOutbox`, `recordChange`, `queueJournal` and the outbox indexes;
  - `readSyncStatus` and the `sync.status` event;
  - `cloudClient.signRequest`, `connectivity`, and the auth refresh;
  - the repositories' insert functions, which become the apply path;
  - `replayCheck`, `reconcilePartiesDb`, `tieOutFailures` and `rebuildAccountBalances` as convergence checks.
- **On the cloud:** the Go `gst` and `money` ports, `DeviceVerifier`, the RLS roles, oapi-codegen from
  `packages/contracts/openapi/muneem-v1.yaml`, and the fixture loaders used by the GST tests.

## Parts (tests first; one commit each; details written and reviewed before each)

- **7a — Protocol, payloads and decisions.**
  - **Contracts:** the OpenAPI paths for `sync/push`, `sync/pull` and `sync/bootstrap`, and zod payload schemas for
    every outbox entity type.
  - **Payload round trip:** for each entity type, the outbox payload applied to an empty database must reproduce the
    original rows. Any payload that misses a field is fixed here.
  - **Decisions:** ADRs 0038–0042.
- **7b — Cloud ingest.**
  - **Schema:** migration 0002.
  - **The push handler:** per-operation results, `duplicate` treated as success, dependencies deferred, one Postgres
    transaction per operation, and `change_log` appended.
  - **Verification:** GST and totals by the Go port, journal balance, and journal = document amounts. A mismatch is
    `rejected/permanent` and goes to dead-letter with the full payload.
  - **Allocation:** the Go port with shared fixtures.
  - **Tests:** integration tests against Postgres from docker-compose.
- **7c — Cloud pull and conflicts.**
  - **Pull:** paged by stream, skipping the caller's own changes only on the device side.
  - **Conflicts:** the matrix resolution on master and config writes, with `conflict_log` rows and duplicate-barcode
    review items.
  - **Control messages:** device revoked, period lock and unlock.
- **7d — Device push.**
  - **Transport:** the utility process (signed HTTP, gzip, batches of 200 or 2 MB) behind an interface, so tests can
    swap in the reference server.
  - **In main:** the scheduler and the state machine (claim, backoff with jitter, `max_attempts` 12, then `dead`;
    `superseded`; reclaim at start-up).
  - **Wire rules:** the cloud device id mapping, retry on 401 with refresh, and the version handshake (FR-105).
- **7e — Device pull and apply.**
  - **Pages:** each page applied in one SQLite transaction with its cursor, idempotent on `(id, version)`. The device's
    own changes are skipped while the cursor still advances.
  - **Masters and config:** upserted with the matrix.
  - **Documents:** inserted under ADR-0040, with projections and the balance cache following.
  - **Read-only data:** review items and control messages.
- **7f — Hydration.**
  - **Cloud:** a bundle builder writes to MinIO, presigns the URL, and records `as_of_seq`.
  - **Device:** a resumable download, an import through the 7e apply path, the cursor set to `as_of_seq`, then the
    delta pulled.
  - **Setup flow:** a "Restore / add this device" option with progress and a ready-to-bill-offline gate (FR-086).
- **7g — Screens.**
  - **The status badge:** the FR-068 states, plus "stock last updated N minutes ago" when another terminal exists.
  - **Diagnostics:** the dead-letter list with resend, and outbox depth and lag.
  - **Review Items:** conflicts and late arrivals.
  - **Stock reconciliation:** oversell across terminals (FR-087).
- **7h — The simulation suite and the exit.**
  - **The suite:** the reference server, the fault injector, and two or three virtual devices over seeded workloads
    (reusing the Stage 6 soak generator). It asserts no loss, no duplicates, convergence (identical documents, stock,
    party balances and Trial Balance on every device and the cloud) and deterministic conflict outcomes.
  - **The protocol fixtures,** run against both servers.
  - **The §37 scenario** against the Go server, with the review additions:
    - double submit;
    - kill -9 mid-sync;
    - a clock jump;
    - two terminals selling the last unit.
  - **Speed:** NFR-022, 5,000 queued operations draining over a 512 kbps link.
  - **Close-out:** docs and the build-stages evidence.

## Part details (written 2026-10-04, before building)

**How the work runs.** The user asked for Stage 7 to be planned and built end to end, with agents in parallel, without
loading the machine. So:
- **Agents:** at most two build at once, each in its own worktree. Tests run under `nice` with at most 3 vitest
  workers, and the 365-day soak is not run.
- **The lead** (this session) writes the details, integrates each agent's commits and runs the full suite between
  phases.
- **Phases:**
  1. 7a, by the lead;
  2. 7b+7c (cloud) beside 7d+7e (device);
  3. 7f beside 7g;
  4. 7h, by the lead.

### 7a — Protocol, payloads and decisions

**The wire** (`packages/contracts/openapi/muneem-v1.yaml` and `src/sync/`). All bodies are camelCase JSON; push is
gzipped.
- **`POST /v1/sync/push`**
  - Request:
    `{ businessId, protocol: 1, schemaVersion, clientTime, operations: [{ operationId, seq, entityType, entityId,
    operationType, dependsOn, payloadHash, payload }] }`
  - Limits: one business per request; at most 200 operations or 2 MB.
  - Response:
    `{ serverTime, nextPullSeq, results: [{ operationId, status: applied|duplicate|rejected|deferred, serverSeq?,
    error?: { code, class: transient|permanent|dependency, detail } }] }`
  - The pushing device is the authenticated, signed device. The body never names it.
- **`GET /v1/sync/pull?businessId&stream&since&limit`**
  - Response:
    `{ changes: [{ seq, stream, entityType, entityId, op: upsert|delete, version, originDeviceId, payload }],
    nextSeq, hasMore, serverTime }`
  - `limit` ≤ 500.
- **`POST /v1/sync/bootstrap { businessId }`** and **`GET /v1/sync/bootstrap/{snapshotId}`** both return
  `{ snapshotId, status: building|ready|failed, url?, asOfSeq?, bytes?, expiresAt? }`.
- **Streams** are fixed by entity type (`STREAM_OF`):
  - **control:** `accounting_period`, plus control messages;
  - **config:** `business`, `branch`, `terminal`, `doc_series`, `setting`, `user_pin`, `account`, `expense_category`;
  - **masters:** `uom`, `category`, `brand`, `product`, `barcode`, `uom_conversion`, `price_list`, `price_list_item`,
    `customer`, `customer_credit_limit`, `supplier`, `warehouse`;
  - **documents:** everything else.
- **Error codes:**
  - permanent: `TOTAL_MISMATCH`, `JOURNAL_IMBALANCE`, `JOURNAL_MISMATCH`, `PAYLOAD_INVALID`, `UNKNOWN_ENTITY`;
  - transient: `DEPENDENCY_MISSING`, `BUSINESS_UNKNOWN`, `VERSION_UNSUPPORTED`.

  An unknown entity type is permanent-but-retryable after an upgrade (FR-105). It is treated as `transient` with a
  long backoff.

**Payloads keep their current shapes, plus what sync needs.** No shop runs the app yet (the pilot is Stage 9), so
payloads can gain fields freely, and old development databases are reset rather than migrated. Every payload gets a
zod schema in `src/sync/payloads.ts`:
- **Fields:** the known fields are typed, and unknown fields pass through.
- **Gaps closed in 7a:**
  - a journal payload also carries `source`, `refType`, `refId`, `docDate`, `narration`, `branchId`, `terminalId`,
    `latePosting` and `reversalOf`;
  - a movement carries `occurredAt` and `warehouseId`.
- **Gaps found later:** the device agent closes any gaps 7e uncovers.
- **Census test:** a desktop test runs a short soak and the golden flows, and every outbox payload must parse with its
  schema.

**Protocol fixtures** (`packages/contracts/fixtures/sync/`): JSON request/response pairs for:
- push applied;
- duplicate;
- rejected for a tampered total;
- deferred for a missing dependency;
- a business created offline;
- a pull page;
- a merged master edit that comes back to its sender.

The TS reference server (7d) and the Go server (7b/7c) both load and pass them.

**Decisions:** ADRs 0038–0042, as in Design. ADR-0040 adds two rules:
- **The journal writer:** `postJournal` stays the only journal writer, gaining a synced mode with a given id, number
  and entry date.
- **Natural keys:** rows each device makes on demand under its own ids are matched by natural key, not id:
  - periods by month;
  - accounts by code;
  - units, categories and expense categories by code;
  - the default price list by kind.

  So a pulled journal finds this device's period for its month, and seeding never duplicates a row that came from
  the cloud.

### 7b — Cloud ingest (agent "cloud")

- **Migration `0002_sync`:** as in Schema, with RLS like 0001's. `change_log.seq` is one `BIGSERIAL` shared across
  businesses; monotonic per business is enough.
- **The push handler** (`internal/devicesync/push.go`, service + store split like `business/`):
  - **Per operation, in its own transaction:**
    1. idempotency;
    2. dependency check: `dependsOn` must be applied, and so must any referenced party, session or document the
       verifier needs — otherwise `deferred`;
    3. verify;
    4. upsert `entity_state` (insert-only for documents);
    5. project journals;
    6. append `change_log`;
    7. record `sync_operation`.
  - **Business created offline:** a `business` create from a device whose user belongs to the payload's organization
    creates the business and the owner membership. Anything else for an unknown business gets `BUSINESS_UNKNOWN`.
  - **Device bookkeeping:** `device.last_push_seq` and `clock_skew_ms` are updated.
- **Verification** (`internal/devicesync/verify/`):
  - **Sales and purchases:** each line's GST is recomputed with the Go `gst` port from the payload's line inputs. The
    totals must equal Σ lines ± round-off, and tenders must equal total + change.
  - **Every journal:** debits = credits. For each document type, the tax heads, party control line and stock lines
    must equal the document's amounts (`JOURNAL_MISMATCH`).
  - **Payments, write-offs and allocations:** Σ allocations ≤ amount, and every target exists.
  - **A failure** is `rejected/permanent`, with a `dead_letter` row holding the full payload and an `alert` log line.
- **Allocation port:** `internal/domain/parties/allocate.go` ports `allocateOldestFirst`. Shared fixtures go in
  `packages/domain/fixtures/parties/allocation.json`, generated by `gen-fixtures`; TS and Go both test against them.
- **Tests:**
  - Go unit tests for the verifiers;
  - integration tests against the compose Postgres (`MUNEEM_TEST_DATABASE_URL`, skipped when unset, run in CI by a
    Postgres service on the `go` job);
  - the protocol fixtures.

### 7c — Cloud pull and conflicts (agent "cloud")

- **Pull** reads `change_log` for one stream after `since`. It is paged and RLS-scoped.
- **Conflicts** apply when a master or config push lands on a newer cloud version:
  - field-level last-writer-wins by `updatedAt`, ties broken by device id;
  - price and tax fields (`sellingPricePaise`, `mrpPaise`, `gstRateBp`, `taxTreatment`, price list items), the credit
    limit, config and users: the cloud keeps its value;
  - a tombstone wins.

  The resolution writes `conflict_log` and emits a change. Its `originDeviceId` is null when the result differs from
  what the device sent, so the sender applies the merged version too.
- **Duplicate barcodes:** the same barcode on two products from different devices creates a review item.
- **Control:**
  - revoking a device emits a control change, and that device's next push or pull gets `DEVICE_REVOKED`;
  - a period lock pushed from any device is the business's lock, and later document pushes into that month are
    stored but listed as late arrivals.
- **Tests:** integration tests for the matrix, one per row of LLD §9.

### 7d — Device push (agent "device")

- **The transport contract** (`apps/desktop/src/main/sync/transport.ts`): `push(batch)`, `pull(stream, since)`,
  `bootstrap(...)`. It has three implementations:
  - `HttpTransport`: signed, gzip, used in the utility process and directly in node tests;
  - `UtilityTransport`: a main-side proxy over `MessagePort` to the utility process (`src/sync-worker/`, built by
    electron-vite);
  - the in-memory reference server: `packages/sync-reference`, a TypeScript implementation of the protocol and the
    matrix over Maps, which passes the protocol fixtures.
- **`SyncEngine` in main:**
  - **Claiming:** `UPDATE … SET status='in_flight' … ORDER BY seq LIMIT 200` in a transaction. Batches stay within
    2 MB, and operations go out in seq order.
  - **Results:**
    - `applied` and `duplicate` → `sent`;
    - transient → `pending` with backoff `min(2^n s, 15 min) ± 20%`;
    - `dependency` → `pending`, behind its dependency;
    - permanent → `failed`, and after 12 attempts → `dead`.
  - **Recovery:** `in_flight` rows older than 5 minutes are reclaimed at start-up.
  - **Superseded:** an unsent master update replaced by a newer one becomes `superseded`.
- **The wire identity** is the cloud device id from `device.ensureIdentity`/registration, stored in `sync_device`. A
  401 refreshes the token and retries once. A `VERSION_UNSUPPORTED` or revoked device sets the status to `blocked`.
- **The scheduler:** start-up, connectivity back online, a nudge after each committed command, a 60 s timer and a
  manual retry. While billing is busy it pushes continuously and pulls every 5 minutes.
- **`sync_log`** is updated, and `sync.status` events are emitted.
- **Tests:**
  - the state machine under the fault-injecting reference server;
  - the backoff schedule;
  - reclaim after a kill;
  - no effect on `sales.complete` p95.

### 7e — Device pull and apply (agent "device")

- **Apply functions** (`packages/db-sqlite/src/sync/apply/`) exist per entity type, keyed by `STREAM_OF`:
  - **Each one:** idempotent on `(id, version)`, writes no outbox row and no local audit row, and runs inside the
    page transaction.
  - **Masters and config:** upserts. A local entity with an unsent outbox row is left alone; the cloud's merged
    version follows once the push lands.
  - **Documents** (ADR-0040): inserted with their stored lines, tenders, movements (stored values, no re-costing),
    party entries, allocations and journal. The journal goes through `postJournal`'s synced mode. Stock levels, party
    balances and `account_balance` are updated by the same projection code local writes use.
- **The pull loop:** for each stream in order (control, config, masters, documents), it pages from its cursor. Each
  page is applied with its cursor advance in one transaction, and changes whose origin is this device are skipped.
- **Round-trip test:** two `App` instances share the reference server. Everything device A does (the golden flows, a
  short soak) appears on device B, and both agree on documents, stock, party balances, the Trial Balance, tie-outs
  and the replay check.

### 7f — Hydration (agent "cloud" for the builder; the lead or the "device" agent for the import)

- **The cloud builder** (`internal/devicesync/snapshot/`):
  - **Documents come from `change_log`,** not `entity_state`, which keeps only a document's latest version. A
    cancelled sale would otherwise reach a new device as just its cancel (found in 7b).
  - **Contents:** the latest `entity_state` per entity as change records, in stream order then seq, written as gzipped
    NDJSON. A header line holds `{format, version: 1, businessId, asOfSeq, counts}`.
  - **Delivery:** uploaded to S3-compatible storage (`minio` added to docker-compose; `MUNEEM_S3_*` env), then a
    presigned GET URL is issued.
  - **Running:** built asynchronously by a goroutine worker with a status row. A ready snapshot is reused if no more
    than 1,000 changes have come since.
- **The device import:**
  - a resumable download (HTTP Range) to `userData/hydration/`;
  - streamed import through the 7e apply functions in pages of 500, with progress in `hydration_state`;
  - the cursors set to `asOfSeq`, then a normal pull.
- **The setup screen** offers "Add this device to an existing business": sign in, choose the business, download and
  import with progress. Billing is disabled until "ready to bill offline".
- **Tests:**
  - Go: the builder against Postgres and MinIO (skipped when unset);
  - device: hydrate from the reference server; a kill mid-import resumes; a hydrated device's books equal the
    source's.

### 7g — Screens (agent "screens")

- **The status badge:** the FR-068 states and lag. The POS gets "stock last updated N minutes ago" when another
  terminal is registered.
- **Diagnostics:** an outbox table by status, a dead/failed list with error, payload preview and Resend
  (`sync.resend`), and a pull cursor per stream.
- **Review Items** (Settings → Review): conflicts and late arrivals, each with both versions and the rule applied.
- **Stock reconciliation** (Inventory): products whose stock went below zero through another terminal's sales after
  sync (FR-087).
- **Checks:** helper tests, typecheck and build, and a manual checklist in this plan.

**Manual checklist (7g), not yet run:**
1. **Synced:** on a synced device the badge reads "✓ Synced · N min ago"; clicking it opens Diagnostics.
2. **Offline:** go offline and make sales. The badge reads "⚠ N waiting · offline", then adds "· oldest N min" after a
   minute. Back online, it drains to Synced.
3. **A permanent reject:** the badge goes to degraded, then blocked after 12 tries. Diagnostics shows the error and a
   payload preview. A manager's Resend sends it back to pending; a cashier sees no Resend button.
4. **A revoked device:** revoke it in the cloud and the badge reads "✕ Needs attention · device removed".
5. **Staleness:** a POS with one terminal shows no stock-staleness line; after a second terminal registers it shows
   "Stock last updated N min ago".
6. **A price conflict** between two devices appears under Review items → Field conflicts with both values. Mark
   reviewed moves it to Reviewed.
7. **Oversell:** two terminals sell the last unit offline, then sync. Inventory → Reconciliation lists both sales,
   with the synced one tagged.
8. **Sync now** in Diagnostics starts a sync, and the cursors show the last pull time.

### 7h — Simulation suite and exit (the lead)

- **`apps/desktop/test/sync/simulation.test.ts`:**
  - **Setup:** two or three devices (`testApp`) on one reference server. The fault injector covers drop, duplicate,
    reorder and delay, partition, 500, clock skew, and kill -9 between claim and result.
  - **Run:** seeded workloads from the soak generator, run in alternating slices, then the network heals and syncs
    until quiet.
  - **Asserts:** no lost operation, no duplicate, convergence (documents, stock, party balances, Trial Balance and
    review items identical everywhere), and the same conflict winners for the same seed.
  - **Scale:** 20 seeds in CI; `pnpm sim` runs 500.
- **The §37 scenario** (`test/sync/scenario37.test.ts`):
  - **Run:** against the reference server in CI, and against the Go server + Postgres when `MUNEEM_E2E_CLOUD` is set
    (a CI job with Postgres and MinIO services).
  - **Steps:** online sale; offline 100 sales, printing and an inventory change; restart; more sales; online; sync.
    Then: cloud TB = device TB, no lost or duplicate document, stock and party ledgers right, and the audit chain
    verifies.
  - **Review additions:** double submit, kill -9 mid-sync, a clock jump, and two terminals selling the last unit (shown
    in stock reconciliation).
- **NFR-022:** 5,000 queued operations drain within budget through a 512 kbps throttle on the reference transport.
- **Close-out:** ADR amendments, architecture (a Sync section), build-stages evidence, and the as-built notes.

## Verification

- **The simulation suite:** green over N seeds in CI and more locally.
- **The §37 scenario:** green end to end against the Go server.
- **Convergence:** every device and the cloud agree on every Trial Balance, and every device passes its own tie-outs,
  replay check and party reconciliation after sync.
- **Ingest:** no operation is lost or applied twice under drop, duplicate, reorder and partition. A tampered total
  reaches dead-letter with its payload.
- **Speed:** 5,000 operations drain within the NFR-022 budget. The sync worker does not move `sales.complete` p95.

## Carried to later stages

- **Attachments** (FR-075, presign and upload queue): nothing produces attachments yet, so they move to Stage 8.
- **Cloud reports:** typed cloud tables beyond journals, and owner reports on the cloud, are Stage 8.
- **Go ports:** posting rules and costing (ADR-0040 relies on stored values), and `resolvePrice` (ADR-0011) before the
  cloud prices anything.
- **Restore and backup:** the Stage 8 restore-to-new-device exit reuses 7f.

## As built (2026-10-04)

**How it was built.** The lead wrote 7a and the details of every part, then ran agents in isolated worktrees, at most
two at a time:
- cloud 7b+7c, beside device 7d+7e;
- cloud 7f-1, beside screens 7g;
- device 7f-2 with the clash fixes, beside the Go end-to-end run.

The lead integrated each by cherry-pick, ran the full suite between phases, and wrote the simulation, §37 and NFR-022
tests and the close-out.

**Exit evidence:**
- **Simulation suite:** three devices behind a seeded fault injector, over 20 seeds in CI (`pnpm sim` runs 500). The
  faults are drop, lost answer, duplicate, 500, reorder, partition and reclaimed in-flight rows, and the workload
  includes concurrent price edits and receipt cancels. There is no loss and no duplicate, and books and catalog are
  identical on every device. The same seed gives the same conflict outcomes.
- **§37 scenario** against both the reference server and the real Go API + Postgres + MinIO:
  - 114 sales held once by the cloud and both terminals;
  - the cloud Trial Balance equals each device's;
  - the audit chains verify;
  - tie-outs, replay and party reconciliation are clean;
  - the oversold last unit is named in stock reconciliation.
- **Hydration:** a new device hydrates from the Go bundle to the same books, then bills and syncs back.
- **NFR-022:** 5,525 operations take about 40 s at 512 kbps, against a stated 10-minute window.
- **Billing speed:** `sales.complete` p95 is about 14 ms idle and up to 18 ms while syncing, within its test's limit.

**Bugs the tests found and fixed:**
- **Catalog drift:** a device skipped its own echo after a merge (simulation).
- **Stock value:** cost-correction movements did not travel with receipts (soak).
- **Review items:** devices ignored the Go cloud's review items.
- **Unique clashes:** a clashing GSTIN, SKU, terminal or branch code would block a stream.
- **Clock skew:** a skew refusal spent a refresh token.
- **Bootstrap:** the Go handler read the gzipped body raw.
- **Cancels:** the Go server stored a cancel in a shape devices could not apply.
- **The §37 test itself:** its lost-answer step had silently not run.

**Deviations from the plan:**
- **Retry timers** live in main; the utility process only does HTTP, gzip and signing.
- **Later document versions** carry the whole document with the operation under its type.
- **Unique clashes** go to the lower id, with a local review item.
- **Hydration IPC** checks the session and the membership itself (no RBAC permission), because a device being added
  has no business open.
- **MinIO** in development and CI uses `bitnamilegacy/minio` (`minio/minio` left Docker Hub).
- **The ADRs** gained "As built" notes: 0038, 0040, 0041 and 0042.

**Not done in Stage 7:**
- **Manual clicks:** the 7g manual checklist and the setup "Add this device" flow have not been clicked through. They
  are covered by helper tests, typecheck and the build.
- **Attachments** (FR-075) are in Stage 8.
- **Typed cloud report tables** are in Stage 8.
- **Expired bundles** in object storage are not cleaned up yet; that is a bucket lifecycle rule to set when the cloud
  is deployed.
- **Presigned URLs** use the API's S3 endpoint host, so a public-endpoint setting is needed if devices reach storage by
  another host.

