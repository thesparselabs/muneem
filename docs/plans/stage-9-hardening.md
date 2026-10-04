# Stage 9 — Hardening and pilot: implementation plan

## Context

Stage 8 closes with the restore-to-new-device exit green. Stage 9 (LLD §20) is "Hardening: soak, chaos, CA compliance
review, pilot with 5 real shops". Its exit criterion is **30 days, zero lost transactions, zero unexplained
imbalances**. The designs give it no section of its own. Its scope is gathered from:
- LLD §18 (budgets) and §19 (testing);
- HLD §11–15 (observability, backup and DR, release, risks);
- the PRD's NFRs, §37 and "Production Hardening";
- the PRD review §4 and §6.

Three research agents surveyed the designs, every deferred item in the docs, and operational readiness (2026-10-05).

**Where the code stands:**
- **Ready:** the product is functionally complete for an MVP shop. The data-level safeguards are strong: server
  re-verification, the audit chain, nightly integrity checks, encrypted backups, hydration and the simulation suite.
- **Not ready to deploy:**
  - no container image, production deploy, readiness probe or TLS;
  - no metrics, alert rules or desktop crash reporting;
  - no signed installer or release pipeline;
  - no operator tooling or runbooks;
  - no Postgres point-in-time recovery, and single unrotatable secrets.
- **Never validated by hand:** no screen has been clicked through. Every manual checklist since Stage 2 is unrun.
- **Compliance unsigned:** the posting matrix and ADR-0044's six GST interpretations await a CA.

**Decisions (user, 2026-10-05):**
- **Hosting:** one VM running the Go API in a container behind Caddy (automatic TLS), with **managed Postgres**
  (point-in-time recovery) and **managed S3-compatible storage**. Deploys are scripted, and the path to scale is
  documented.
- **Before the pilot:** **USB / Windows-spooler receipt printing, with ₹ and Indic text.** Not chosen now, and so
  explicit pilot risks with mitigations in the runbook: manager PIN override, GST set-off safety (two offline devices
  could double-clear a month), and printing payment receipts and debit notes.
- **Scale bar:** **500k transactions, 20k SKUs and 50k customers**, measured against the **strict LLD §18 budgets** on
  a 4 GB-RAM-class profile:
  - barcode lookup < 30 ms;
  - product search < 60 ms;
  - cart recalculation < 10 ms;
  - `sales.complete` < 250 ms p95;
  - dashboard < 300 ms;
  - cold start to billable < 3 s.
- **Monitoring:** **self-hosted Prometheus, Loki and Grafana** on our own VM, with alert rules for the HLD §11 business
  signals, and a **self-hosted crash collector** (Sentry-protocol compatible, PII scrubbed, no invoice contents).

**Settled by default** (each gets an ADR, can be changed):
- Windows 10/11 **64-bit only** (NFR-024).
- The cloud supports protocols **N and N−1**, following the LLD, as Stage 8i built it.
- The NFR-022 window stays at **10 minutes**.
- The outbox-depth alert fires at **more than 500 operations, or the oldest older than 1 hour**.
- A device is "silent" after **24 hours**.

## Design (ADRs written in 9a)
- **ADR-0051 — Production topology:**
  - the API container on one VM behind Caddy;
  - managed Postgres with point-in-time recovery and daily snapshots;
  - managed object storage with lifecycle rules (hydration bundles 2 days, backup objects past 30);
  - secrets from the host's secret manager, never committed;
  - the deploy sequence: migrate first, as the owner role, then start under the RLS app role;
  - readiness separate from liveness;
  - the path to scale: a second VM behind a load balancer, with rate limits moved to Redis.
- **ADR-0052 — Keys and rotation:**
  - `MUNEEM_BACKUP_MASTER_KEY` becomes a versioned keyring: the active id plus old ids for unwrapping, with a
    re-wrap job, and is itself backed up out of band;
  - JWT signing keys get a `kid`, a keyring and overlap during rotation;
  - device keys are unchanged.
- **ADR-0053 — Observability:**
  - **Cloud:** Prometheus metrics (RED per route; ingest rejections by code; dead-letter depth; snapshot and backup
    jobs) and structured logs to Loki.
  - **Business-health probes:** a scheduled SQL job exporting gauges for outbox depth and age per device, silent
    devices, dead letters, audit-chain breaks, verification-mismatch rate, Trial Balance imbalance count,
    negative-stock spikes and backup freshness.
  - **Alerts:** Grafana rules with a runbook link each.
  - **Desktop:** crash and error reports to a self-hosted collector, **opt-in per business**, with PII scrubbing and no
    invoice contents (NFR-025), plus a heartbeat with outbox depth and lag carried on sync.
- **ADR-0054 — The pilot's measures of "zero lost, zero unexplained":**
  - **Lost:** every device's outbox drains (`sent`/`superseded` only), no dead letters left unresolved, document
    numbers have no gaps per series, and cloud document counts equal device counts.
  - **Imbalance:** cloud Trial Balance = each device's (exact), every tie-out green, replay = projection, and the audit
    chains verify.
  - **Explained differences:** oversells and late arrivals are explained only when they are listed as review items.
  - **The report:** a nightly pilot health report computes all of these per shop and stores the history, which is the
    exit evidence.
- **ADR-0055 — Windows printing:**
  - receipts go to an installed Windows printer through the spooler in RAW (ESC/POS) mode, via a small native helper;
  - a fallback renders the receipt as an image or GDI page for printers without ESC/POS;
  - ₹ and Indic text are rendered as a raster image line where the printer's code page lacks them;
  - the cash drawer opens through the printer's kick-out;
  - a printer failure never blocks a sale (NFR-012; the print queue exists).
- **ADR-0056 — Release and installer:**
  - a Windows CI runner builds the NSIS installer, signed with Azure Trusted Signing (or EV) from CI secrets;
  - an SBOM is produced;
  - `release-manifest` publishes per-channel `latest.yml` to the update host with a rollout percentage;
  - a staged rollout runs dev → beta (pilot shops) → stable, and the rollback procedure is documented.

## Parts

| Part | What | Who |
|---|---|---|
| 9a | ADRs 0051–0056; pilot health report spec; manual QA plan | lead |
| 9b | Cloud production: Dockerfile, deploy scripts, Caddy, readiness probe, migrations at deploy, prod RLS role, lifecycle rules, key rings | agent "ops" |
| 9c | Observability: Prometheus metrics, business-health probes, Loki, Grafana dashboards and alert rules, desktop crash reporting | agent "obs" |
| 9d | Windows printing: spooler RAW + image fallback, ₹/Indic raster, drawer kick | agent "device" |
| 9e | Release pipeline: Windows CI, signed installer, SBOM, manifest publishing, channels | agent "ops" (after 9b) |
| 9f | Scale and speed: a 500k / 20k / 50k dataset generator, every LLD §18 budget measured (4 GB profile), fixes, main-thread checks moved off the UI thread (dashboard drift, reports utility process) | agent "perf" |
| 9g | Chaos suite: disk full, power loss mid-commit (kill loop on Windows too), clock −1 day / +1 week, printer unplugged, network flaps mid-sync, DB-corruption journey (NFR-019), nightly §37 with every review §6 addition | agent "chaos" |
| 9h | CA compliance pack: posting matrix and GST interpretations as a review document; the tax scenario suite (intra/inter, B2B/B2C, composition, exempt mixes, credit notes, round-off, HSN = invoice sums) as golden tests | agent "gst" |
| 9i | Operator tooling: admin endpoints and a minimal admin page (shops, devices, outbox lag, dead letters with resend, review items, chain breaks, backups); runbooks for every alert | agent "ops" |
| 9j | Manual QA pass: a Playwright + Electron suite for the golden flows and keyboard-only POS; every unrun checklist executed and recorded | agent "qa" |
| 9k | Pilot readiness: dependency audit (`pnpm audit`, `govulncheck`) in CI, a security checklist, the pilot runbook (onboarding, support SLA, known risks and mitigations) | lead |
| 9l | Pilot operation and exit: deploy, onboard 5 shops, 30 days of nightly pilot health reports, fix-forward through the beta channel, exit evidence | lead + user |

**Phases** (at most two agents at a time, with the same load rules):
1. 9a, by the lead;
2. 9b beside 9d;
3. 9c beside 9f;
4. 9e beside 9g;
5. 9h beside 9i;
6. 9j, then 9k, by the lead;
7. 9l with the user (real shops, real time).

## Part details (summary; expanded before each part is built, as in Stages 6–8)
- **9b:**
  - a multi-stage Dockerfile (distroless, non-root);
  - `deploy/` with Caddyfile, a systemd/compose unit and scripts (`deploy.sh`: build, push, migrate, health-gated
    swap);
  - `/v1/ready` pinging Postgres and S3;
  - snapshot workers drained on shutdown;
  - prod role SQL;
  - S3 lifecycle JSON;
  - key rings (backup master and JWT `kid`) with tests;
  - TLS through Caddy;
  - rate limits documented as per-instance.
- **9c:** Prometheus middleware and registry, `/metrics` on an internal port, a business-health probe job (Go,
  scheduled), Grafana dashboards as JSON plus alert rules as files, Loki shipping config, and a desktop crash reporter
  (Electron `crashReporter` plus an uncaught-error hook) behind a per-business opt-in setting, with a scrubber and
  tests.
- **9d:** a printer abstraction extended with a `spooler` kind (enumerate installed printers, RAW job), the image
  fallback, a code-page/raster renderer for ₹ and Indic text, drawer kick, and tests with a fake spooler. A Windows
  host check is part of 9j.
- **9e:** a GitHub Actions Windows job: build, sign, SBOM (CycloneDX), upload, `release-manifest`, channel promotion
  by workflow dispatch, and checksums.
- **9f:** a generator for the 500k dataset (fast bulk inserts through the real repositories), the budgets as perf
  tests with medians, `EXPLAIN QUERY PLAN` assertions as a CI gate, fixes where budgets fail, a memory ceiling check
  (4 GB profile), the report and integrity runs moved to the utility process, and the migration runtime on the big
  dataset.
- **9g:** a chaos harness (disk-full simulation through a size-limited temp FS or a SQLite VFS hook; kill loops; clock
  manipulation; printer and network fault injection), the NFR-019 journey test, and §37 with the review additions as a
  nightly CI job.
- **9h:** `docs/compliance/ca-review-pack.md` (generated tables from the posting rules and fixtures, worked examples,
  the six interpretations as questions, a sign-off section) and a golden tax scenario suite in domain, TS and Go.
- **9i:** an admin role (operator, cross-tenant, audited, separate from shop RLS), endpoints, a minimal admin web page
  served by the API (read-only plus resend), and `docs/runbooks/*.md` per alert.
- **9j:** Playwright with Electron (`_electron.launch`), the golden flows, keyboard-only F2…F9, 1366×768 screenshots
  (NFR-023), and the checklists from Stages 2–8 run and recorded in their plans.
- **9k:** CI jobs for `pnpm audit --prod` and `govulncheck`, a secrets scan, a security checklist doc, and the pilot
  runbook (shop selection criteria, onboarding steps, support SLA, the known risks listed above with mitigations).

## Pilot risks accepted (with mitigations in the runbook)
- **Set-off:** two offline devices can set off the same month. Mitigation: set off from one device, online, after
  filing; Diagnostics flags duplicates.
- **No manager PIN override:** managers act from their own login.
- **Printing:** payment receipts and debit notes can't be printed; statements and reports export to PDF instead.
- **Purchases:** reverse-charge purchases are refused (a pilot shop must not need them).
- **Composition businesses:** GSTR-4/CMP-08 are not generated, so pilot shops should be regular-scheme.
- **Inventory:** no batch or expiry tracking, so pilot shops should not be pharmacies.

## Verification
- **Scale:** every LLD §18 budget is green at 500k / 20k / 50k on the 4 GB profile.
- **Chaos:** the chaos suite and the nightly §37 are green.
- **Compliance:** the CA signs the pack, and the tax suite is green in TS and Go.
- **Operations:** the cloud is deployed with point-in-time recovery, metrics and alerts. A restore drill is done
  (NFR-010: RPO ≤ 15 min, RTO ≤ 4 h).
- **Release:** a signed installer is published through the beta channel.
- **Pilot:** 30 consecutive days of pilot health reports across 5 shops show zero lost transactions and zero
  unexplained imbalances.
