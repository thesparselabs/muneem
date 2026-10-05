# ADR-0053 — Observability

**Status:** Accepted, 2026-10-05

## Context
HLD §11 asks for RED metrics, sync lag, dead-letter depth, backup and Postgres health, and above all
**business-health alerts**: outbox depth, silent devices, verification mismatches, Trial Balance imbalance and
negative-stock spikes. NFR-011 asks for logs, metrics and error tracking; NFR-025 asks for opt-in crash reporting
with PII scrubbing and no invoice contents. ADR-0054 adds the pilot's checks, which need each device's integrity
results on the cloud. ADR-0051 warns that a shop which stops backing up loses its cloud copies after 60 days. The user
chose (2026-10-05) self-hosted Prometheus, Loki and Grafana, and a self-hosted crash collector, with no SaaS.

## Decision
- **Cloud metrics** (`cloud/internal/metrics`, `prometheus/client_golang`):
  - RED per route **template** (`muneem_http_requests_total`, `muneem_http_request_duration_seconds`); unmatched
    paths share one `unmatched` label, so scanners cannot grow the label set.
  - Ingest outcomes by status and code, dead letters by code, job runs and durations (snapshot builds, backup
    confirmations, each health probe), readiness per check (refreshed by the container healthcheck every 10 s), the
    pgx pool, and the Go and process collectors.
  - `/metrics` is served on its own listener, `MUNEEM_METRICS_ADDR` (default `127.0.0.1:9090`). The public Echo
    server never mounts it and Caddy never proxies it. In production the container listens on `0.0.0.0:9090` and
    compose publishes it only on `MUNEEM_METRICS_BIND`, the VM's WireGuard or private address.
  - Domain packages declare small observer interfaces (`IngestObserver`, `JobObserver`, `RequestObserver`,
    `ReadyObserver`); only `metrics` imports Prometheus.
- **Business-health probes** (`cloud/internal/health`):
  - A job in the API, every `MUNEEM_HEALTH_PROBE_INTERVAL` (60 s), one run at a time: a run still going when the
    next is due is skipped.
  - The API role is bound by RLS, and the probes read across shops. So they call **SECURITY DEFINER** functions
    (migration 0008) that return only counts, ages and ids. The role still cannot read a tenant row.
  - **Fast probes:** per shop, active and silent devices (not seen for 24 h), the deepest outbox and its oldest
    operation, negative stock, unresolved dead letters, audit-chain breaks in the last 24 h, the newest confirmed
    backup's age, and rejections by code in the last hour. Per device, for the top `MUNEEM_HEALTH_TOP_DEVICES` (50)
    ranked by oldest waiting operation, then staleness.
  - **Slow probes**, every `MUNEEM_HEALTH_LEDGER_INTERVAL` (15 min), because they read every journal line:
    - journals whose lines do not balance (the cloud's Trial Balance imbalance count);
    - each device's integrity report against the cloud.
  - Gauges are reset on every run, so a shop or device that drops out leaves no stale series. Shop and device ids
    are opaque ULIDs. Names, GSTINs and amounts are never labels.
  - With two API instances, both export the same gauges, and alert queries aggregate with `max`.
- **Device heartbeat** (on `POST /v1/sync/push`, optional, so old clients and old servers are unaffected):
  - `outboxDepth` and `oldestPendingAt`: what still waits once this batch lands. Dead operations count, because they
    never drain by themselves. A device that stops pushing keeps its last values, so its oldest-operation age keeps
    growing and alerts.
  - `negativeStockCount`: the stock levels below zero. The cloud keeps no stock levels (HLD: stock is derived on the
    device), so this is the cheapest honest signal. The alert is a rise of more than 10 within an hour.
  - `integrity` (ADR-0054): the last 6-hourly integrity run, with tie-out failures, replay mismatches, the audit
    chain, and the raw journal totals (count, Σdebit, Σcredit) at the device's documents cursor. It is stored in
    `device_integrity`, keeping the newest. The slow probe compares the totals with the cloud's journals up to that
    seq, and only when the device had nothing unsent.
  - Values are clamped, and a malformed heartbeat never fails a push.
- **Logs:** slog JSON on stdout as before. Grafana Alloy on each VM ships the `api`, `caddy` and `crash` containers to
  Loki (30 days), with `level` and the existing `"alert": true` flag as labels. The flag becomes the `sync-alert-log`
  rule.
- **Grafana:** datasources, four dashboards (API RED, ingest and sync, business health per shop, backups) and the
  alert rules are provisioned from `deploy/monitoring/grafana/`. Each rule's `runbook_url` points at
  `docs/runbooks/<alert>.md`, and a test fails if either side is missing.
- **Alerts and thresholds:**

  | Alert | Fires when |
  |---|---|
  | outbox-backlog | worst outbox > 500 operations for 15 min |
  | outbox-stale | oldest waiting operation > 1 h |
  | device-silent | an active device not seen for 24 h |
  | dead-letters | any unresolved dead letter |
  | verification-rejections | > 10 rejections per shop per hour |
  | audit-chain-break | any break in the last 24 h |
  | tb-imbalance | any unbalanced journal |
  | device-books-differ | device journals ≠ cloud journals for 7 h (about two integrity runs) |
  | device-integrity-failing | any tie-out, replay or chain failure |
  | negative-stock-spike | more than 10 more products below zero within an hour |
  | backup-stale | newest confirmed backup > 26 h (the 60-day expiry is far behind) |
  | backup-confirm-failing | any failed or mismatched confirmation in an hour |
  | snapshot-build-failing | any failed build in an hour |
  | api-down | the scrape fails |
  | readiness-failing | a readiness check fails |
  | error-rate | 5xx > 2% for 10 min |
  | health-probe-stale | no probe success for 10 min |
  | sync-alert-log | an `"alert": true` log line |
  | desktop-crashes | more than 5 crash reports an hour |

  Alerts go to the `ops` e-mail contact point.
- **Crash collector:** our own ingest (`muneem-api crash-collector`, `cloud/internal/crashes`), not GlitchTip.
  - It speaks Sentry's `store`, `envelope` and `minidump` endpoints with the DSN key, so a Sentry-compatible server can
    replace it by changing the DSN.
  - It needs no database, Redis or workers. It is the API image with another command, and reports become log lines
    in Loki beside everything else. GlitchTip would add Postgres, Redis and two services to run, back up and patch,
    for grouping that one Loki query gives us at pilot scale.
  - It scrubs again on the server by allow-list, rate-limits per IP, caps bodies (256 KiB events, 10 MiB minidumps),
    and prunes minidumps after 30 days or 2,000 files.
- **Desktop crash reporting** (NFR-025):
  - **Consent:** off by default. The `telemetry.crashReports` business setting can be changed only with
    `settings.manage` (the owner), and syncs to the shop's devices like any setting. With no business open, nothing
    is sent.
  - **What is captured:**
    - main-process uncaught exceptions (`uncaughtExceptionMonitor`, which leaves Electron's own handling unchanged)
      and unhandled rejections;
    - renderer `error` and `unhandledrejection` events, forwarded over IPC;
    - `render-process-gone` and `child-process-gone`;
    - native crashes through Electron `crashReporter`, which writes minidumps **locally only**
      (`uploadToServer: false`). A minidump holds process memory, which can include invoice or customer data, so the
      next start reports only "a native crash happened", with the process and reason. A minidump leaves the machine
      only in a support bundle that a person sends.
  - **Scrubbing by allow-list:** an event carries only:
    - the error type;
    - the redacted message, with quoted values, e-mails, GSTINs, digit runs of 6 or more and paths removed;
    - stack frames as `function (file:line)`, with the file's base name only;
    - the kind and process;
    - the app version, the schema version and the OS;
    - a hash of the installation id: sha256 with a fixed prefix, 16 hex.

    No user, request, breadcrumbs, extras, contexts, invoice contents, customer names, phone numbers, GSTINs or free
    text fields are sent.
  - **Never in the way:** the reporter never throws into the app and never blocks it. Sends are fire-and-forget with a
    5 s timeout, at most 10 an hour, and the same error at most once in 10 minutes.
  - Diagnostics shows whether reporting is on and when the last report was sent.

## Consequences
- The monitoring stack needs about 2 vCPU, 4 GB of RAM and 40 GB of disk (Prometheus about 0.5 GB of RAM, Loki 0.5 GB,
  Grafana 0.3 GB, Alloy 0.1 GB, the collector under 50 MB). It can share the API VM for the pilot, but a separate VM
  keeps the alerts alive when the API VM dies. `docs/operations/deploy.md` §8 has both layouts.
- Metrics and Loki travel over WireGuard or a private network. Only Grafana and the crash ingest are public, both
  behind Caddy with TLS.
- Without native minidumps, a native crash can be diagnosed only from its reason and a support bundle. Uploading
  minidumps needs its own consent wording and a decision on memory scrubbing, and would be a later ADR.
- A device's journal comparison is approximate around a push that lands after its last pull. The 7-hour window
  absorbs that, and the nightly pilot report (ADR-0054, 9l) makes the exact daily check from the stored rows.
- Per-device series are bounded by the top-N. Per-shop series grow with the number of shops, which is fine for
  hundreds of shops. A larger fleet would need recording rules or fewer gauges per shop.
- OpenTelemetry traces (HLD §11) are not built. Request ids in the logs, and operation ids in the alert lines, stand
  in for them. The HLD notes this.
