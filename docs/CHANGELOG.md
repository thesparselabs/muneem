# Changelog

All notable changes, newest first. Each entry records **what** changed and **why**. Format follows
[Keep a Changelog](https://keepachangelog.com/); versions are project stages until the first release.

## [Unreleased]

### Added — Stage 9 hardening and pilot
- **Stage 9 plan (`docs/plans/stage-9-hardening.md`).** Three agents surveyed the designs, every deferred item and
  operational readiness. Decided with the user:
  - **Hosting:** one VM with Caddy, managed Postgres with point-in-time recovery, and managed S3.
  - **Before the pilot:** USB/Windows printing with ₹ and Indic text.
  - **Scale bar:** 500k transactions, 20k SKUs and 50k customers against the strict LLD §18 budgets.
  - **Monitoring:** self-hosted Prometheus, Loki and Grafana, with a self-hosted crash collector.
- **Every LLD §18 budget passes at 500k sales, 20k SKUs and 50k customers (9f).** Why: NFR-021 and the user's scale
  bar.

  | Budget | Before | After |
  |---|---|---|
  | Cold start | about 19 min | 2.1 s |
  | `sales.complete` p95 | 638 ms | 55 ms |
  | Dashboard | 506 ms | 154 ms |
  | A sale while checks run | billing frozen for minutes | 90 ms |

  Barcode lookup, search and cart recalculation stay at 0.1–4 ms.
  - **Indexes (migration 0021):** the sync queue's reads during a push fall from 145 s to 32 ms, sync status from
    397 ms to 0.01 ms, the dashboard's party totals and top products, and customer search.
- **The push heartbeat counts negative stock from a covering partial index (9f + 9c).** It had walked every stock row
  of the business on every push; the query-plan gate caught it once both parts were merged.
- **Reports and integrity checks run in a read worker (9f, ADR-0058).** The worker has its own read-only connection. At
  500k these checks had held the billing thread for minutes; the main thread now only applies a fix when one is
  needed.
- **Start-up runs `quick_check` only after an unclean exit (9f).** The worker checks the file once a day in the
  background. Cold start at 500k drops from about 19 minutes to 2.1 s.
- **Scale tests (9f):**
  - **The dataset:** a seeded builder for the 500k dataset.
  - **`pnpm scale`:** measures every budget on a 4 GB profile, plus the upgrade path, nightly in CI.
  - **Query-plan gate:** an `EXPLAIN QUERY PLAN` gate on the hot paths runs in the default suite.
  - **Open:** upgrading a 500k database takes about 24 minutes (a 9-minute pre-migration backup plus checks). This
    needs a file-copy backup and a scoped foreign-key check.
- **Chaos and fault suite (9g, ADR-0060).** Why: NFR-012, NFR-018 and NFR-019 must hold under real faults, not
  only in the happy path.
  - **What it covers:** disk full during commits and backups; power loss mid-commit for every posting command (returns,
    purchases, payments, GST set-off, year end); clock jumps across 31 March; a printer unplugged, cut off or hanging;
    the network flapping mid-sync; and the damaged-database journey.
  - **Where it runs:** CI at 20 kills per kind. The nightly `chaos` job runs 100 kills per kind, §37 and a 200-seed
    simulation. `docs/qa/chaos.md` lists each fault and what is asserted.
- **Fixed by the chaos suite (9g):**
  - **Disk full:** it now returns `DISK_FULL` with a clear message instead of "Something went wrong". LLD §17 gains
    the row.
  - **Damaged databases:** a damaged header, or pages so broken that `quick_check` itself throws, now reach the
    restore dialog instead of crashing start-up.
  - **Restoring an older backup:** after a device restores its own older backup (from Diagnostics or at start-up), the
    next bill no longer fails on a duplicate number. Series are realigned after the catch-up pull, and start-up
    restore now pulls back the device's own later work.
  - **Start-up recovery:** it keeps the damaged file, carries over audit rows that still link, and offers "Start empty
    and restore from the cloud".
  - **Known gaps:**
    - with a destroyed header, audit rows written after the backup cannot be recovered, so the cloud rejects that
      device's next rows; "start empty" avoids this;
    - NFR-018's date-window check is not built;
    - a printer that hangs and then prints late prints twice if retried.
- **Playwright + Electron UI suite (9j).** Why: the Stage 2–8 manual checklists had never been run, and unit tests
  cannot catch what only the built app does.
  - **How it runs:** `pnpm e2e:ui`, and the CI job `e2e-ui` under Xvfb. It drives the built app with a temp profile, a
    stub cloud over the reference sync server, and the printer simulator.
  - **What it covers:** 33 tests for the golden flow, keyboard-only POS (F2–F9, Esc, Tab), offline billing and
    recovery, and cashier permissions. Every one of the 34 screens is checked to fit 1366×768.
- **Fixed: every report and the GST returns page failed in the Electron app (9j).** The read-only report connection
  loaded the Node build of SQLite instead of Electron's. It affected packaged builds too, and it is in the Stage 8 code.
  It now reuses the main connection's native binding.
- **Fixed: keyboard-only POS gaps (9j).**
  - **Payment:** dialogs focus their first field, so F5 then Enter completes a sale instead of closing the payment
    dialog, and focus returns to the opener on close.
  - **Held bills:** F7 then Enter retrieves the first held bill.
  - **After a sale:** the search box takes focus again.
- **Fixed: stale data straight after a change (9j).** A completed sale or return refreshes every cached read; "Receive
  payment" had said "Nothing is open" just after a credit sale. The notification bell refetches when it appears.
- **One QA record (9j).** `docs/qa/manual-checklist.md` lists every Stage 2–8 manual step as automated (naming its
  test) or still manual, with a Windows-host section and a results table. The stage plans point to it.
- **Fixed: per-unit cess on an MRP (tax-inclusive) item was billed on top of the MRP (9h, ADR-0059).** A ₹150 pack with
  ₹10 per-unit cess billed ₹160. The per-unit cess now comes out of the gross before the back-calculation, in both
  the TypeScript and Go engines, with a HAND golden vector and a property test, and LLD §3.1 is updated. The golden
  scenario suite found it. Both engines had agreed on the wrong answer, so the cloud's check could not.
- **Fixed: the composition declaration now prints at the top of the bill of supply (9h),** as CGST rule 5(1)(g)
  requires. It used to print at the bottom.
- **Golden tax scenario suite (9h).** Why: the GST, returns and posting treatment is pinned before the CA reviews it.
  - **Scenarios:** 12 hand-checked business days, covering intra- and inter-state; B2B, B2CS and B2CL; composition;
    exempt, nil and non-GST lines mixed on one bill; rounding and bill discounts; cess; four kinds of credit note;
    purchases with eligible and blocked ITC; debit notes; expenses; a rule-88A set-off; and a year-end close.
  - **What is checked:** HSN = Σ invoice lines, GSTR-1 = invoices − credit notes, GSTR-3B ties to the tax accounts,
    and every journal balances.
  - **Go** reproduces the invoices, credit notes and set-offs from the same file.
- **CA review pack (9h).** `docs/compliance/ca-review-pack.md` puts 29 yes/no or choose-one questions to the CA, each
  with our current choice, plus a sign-off section. The posting tables and a scenario workbook are generated from the
  code, and a drift test keeps the pack from going stale.
- **Operator tooling (9i, ADR-0057).** Why: during the pilot, operators must see and fix shops without raw SQL, and
  every action must be audited.
  - **API and page:** a cross-shop operator API (`/v1/admin`) and a plain server-rendered admin page (`/admin/`) on a
    loopback-only listener, reached through an SSH tunnel.
  - **What operators can do:** see shop health; revoke devices; resend or dismiss dead letters; read review items,
    audit-chain breaks and backups.
  - **Grants:** operators are granted only from the server CLI (`grant-operator`/`revoke-operator`). Their tokens use
    derived keys and an `op` scope, so shop and operator tokens never open each other's routes.
  - **Cross-shop reads** go through a least-privilege `muneem_admin` role (Go migration 0009). Actions run in the
    shop's own RLS scope, need a reason, and are audited.
  - **Probe fix:** the business-health probe now skips dismissed dead letters, so the alert clears.
  - **Runbooks:** `docs/runbooks/ops-*.md` covers onboarding, device replacement, dead letters, audit-chain breaks,
    restores, key rotation and silent devices.
- **Security scanning in CI (9k).** Why: what ships must have no known reachable vulnerability and no committed
  secret.
  - **The `security` job** runs `pnpm audit --prod` at moderate and above, `govulncheck`, and a gitleaks scan of the
    whole history. Fixtures are allowlisted in `.gitleaks.toml`, and all nine findings were deliberate test or dev
    values.
- **Go toolchain pinned to 1.26.8 (9k).** `go.mod` said `go 1.26.0`, so CI and the release build compiled with a
  toolchain that `govulncheck` found 21 reachable standard-library vulnerabilities in (crypto/x509, net/http, net/url
  and others). It is now `toolchain go1.26.8`, with the Docker build image pinned to match: 0 reachable.
- **`uuid` overridden to ^11.1.1 (9k).** `exceljs` pulled in a `uuid` with a missing bounds check (moderate). The
  override is in `pnpm-workspace.yaml`, where pnpm 11 reads it, and the Excel import/export tests pass.
- **Security checklist and pilot runbook (9k).** `docs/security/checklist.md` marks each item as built, an ops task, or
  later. `docs/operations/pilot-runbook.md` covers what must be ready before day 1, shop criteria, onboarding, the
  daily review, the proposed support SLA, known risks with mitigations, and the exit.
- **Release pipeline (9e, ADR-0056).** Why: HLD §12/§13 ask for signed, staged and checkable updates.
  - **`release.yml`:** it builds the Windows NSIS installer, Azure-signed when the signing secrets are set. Without
    them, the build is unsigned, marked as a prerelease and published to dev only.
  - **What it publishes:** CycloneDX SBOMs (pnpm and Go), SHA-256 checksums, the channel's `latest.yml`, an immutable
    `releases/<version>/` archive and a GitHub Release.
  - **Channels:** a fresh build never goes straight to stable.
- **`promote.yml` (9e).** It moves a built release between channels, or changes its rollout, without rebuilding, so
  beta and stable get the same bytes. A rollout of 0 halts it, promoting from the archive rolls back, and unsigned
  builds never reach stable.
- **Crash DSN and symbols (9e).** The release build bakes in the crash collector's address from `vars.MUNEEM_CRASH_DSN`.
  It stays empty outside a vite build, which the kill -9 suite's plain-Node child caught. Hidden source maps are kept
  as a symbols artifact and never shipped.
- **Observability (9c, ADR-0053).** Why: production must be measurable and must alert before a shop notices, using
  the self-hosted stack the user chose.
  - **Cloud metrics:** on an internal port only. They cover requests and latency per route, ingest outcomes, dead
    letters, jobs, readiness and the database pool.
  - **Business-health probes:** they run every minute, through Go migration 0008's security-definer functions, so the
    RLS-bound API role sees counts but no tenant rows. They cover silent devices, outbox depth and age, negative
    stock, dead letters, audit breaks, rejections, backup age and unbalanced journals.
  - **Push heartbeat:** each push carries one. Each device's nightly integrity report (tie-outs, replay, audit chain,
    journal totals) is compared with the cloud's journals, which gives ADR-0054 its data.
  - **Monitoring stack:** `deploy/monitoring` provisions Prometheus, Loki, Alloy and Grafana. Dashboards and 19 alert
    rules are files, and each rule has a runbook in `docs/runbooks/`.
  - **Crash collector:** self-hosted and Sentry-compatible (`muneem-api crash-collector`), with no extra database to
    run.
  - **Desktop crash reports (NFR-025):** opt-in per business and owner-controlled, with allow-list scrubbing (no
    names, phones, GSTINs, amounts or free text). Minidumps stay on the machine.
  - **Docs:** HLD §11 now says traces are deferred.
- **Windows printing (9d, ADR-0055).** Why: pilot shops use USB printers installed through Windows.
  - **RAW mode:** receipts print on any installed Windows printer as RAW ESC/POS, through a fixed PowerShell
    `WritePrinter` helper. There is no shell, the name must be one Windows lists, and size and time are bounded.
  - **Image mode:** printers without ESC/POS print a page through their driver.
- **₹ and Indic text on receipts (9d).** These lines print as ESC/POS raster images drawn with bundled Noto Devanagari
  and Tamil fonts (OFL, about 300 KB); ASCII lines stay text. The printer's code page used to print "Rs" and "?". ₹
  versus "Rs" is a per-printer option.
- **A hung printer never blocks a sale (9d, NFR-012).** The print queue has a deadline over every transport, and the
  cash drawer kicks through the spooler too.
- **Printer settings (9d):** pick an installed printer, the mode, the paper width and the ₹ option, then test-print and
  test the drawer. The real Windows path has not run on Windows yet; it is part of the 9j manual checks.
- **The cloud is deployable (9b, ADR-0051).** Why: production needs one reproducible artifact and a scripted, safe
  deploy.
  - **Image:** a distroless, non-root container and a CI `cloud-image` job.
  - **Deploy kit:** `deploy/` holds the Caddy TLS proxy, a production compose file, `roles.sql` and the S3 lifecycle
    rules. `deploy.sh` migrates as the owner, restarts only once healthy, and rolls back to the previous image.
  - **Runbook:** `docs/operations/deploy.md`.
  - **Readiness:** `GET /v1/ready` checks Postgres and object storage. Snapshot builds drain on shutdown.
  - **Rate limits:** `X-Forwarded-For` is trusted only from private-network proxies.
- **Rotatable secrets (9b, ADR-0052).** Why: both secrets can now change without logging users out or orphaning
  backups.
  - **JWT:** signing keys carry a `kid` (`JWT_SECRETS`).
  - **Backups:** the master key is a versioned keyring (`MUNEEM_BACKUP_MASTER_KEYS`, Go migration 0007), with a
    `rewrap` command.
  - **Compatibility:** the legacy single variables still work.

### Added — Stage 8 reports, compliance, backup and update
- **Stage 8 plan (`docs/plans/stage-8-reports.md`).** Three agents surveyed the designs, what earlier stages deferred,
  and the GST and year-end gaps; the plan's details of every part come from that. Decided with the user:
  - **Compliance:** GST returns (GSTR-1, HSN, documents issued, GSTR-3B) with set-off and payment documents, the
    year-end close, and sale returns and credit notes.
  - **Backups:** encrypted, uploaded nightly, with the key escrowed by the cloud.
  - **Notifications:** in-app now, with consent captured; SMS and WhatsApp later.
  - **Updates:** the full updater, with channels, staged rollout and rollback.

  Build stages now show Stage 7 merged (PR #8) and Stage 8 in progress.
- **Report engine and exports (8a, ADR-0046).** Why: FR-054 and FR-077; nothing could be exported before.
  - **Definitions:** each report declares its parameters, columns and permission. It runs on a read-only database
    connection, and validates its options.
  - **Exports:** CSV (UTF-8 with a BOM, numbers in rupees), XLSX (numeric cells with Indian number formats) and PDF
    (printed from a hidden, script-free window). Each carries the business, GSTIN, title, options and time.
  - **Files:** the user picks where an export goes in a save dialog, and the screen never sees a path.
  - **First report:** the Trial Balance; 8e adds the rest.
  - **IPC:** `reports.listDefinitions`, `reports.run`, `reports.export`.
- **In-app notification centre (8h, ADR-0050 as built).** Why: FR-074; the owner sees problems without hunting for
  them.
  - **Where they appear:** a bell with the unread count, a notifications page, and a "Needs attention" card on the
    dashboard.
  - **What raises them:** low stock, overdue customers, suppliers due, blocked sync, backup failures or staleness, a
    broken audit chain, review items and a ready update. Each is raised and resolved automatically, at start-up,
    every 6 hours and after relevant commands.
  - **Local only:** notifications are kept per device and filtered by each user's permissions.
- **DPDP consent, profile export and erasure (8h, FR-104).** Why: consent and erasure rights must exist before
  reminders are sent.
  - **Consent:** customer consent (purpose, channel, given or withdrawn, by whom) syncs with the customer. Withdrawing
    is as easy as giving.
  - **Export:** owners and managers can export a profile as JSON or CSV.
  - **Erasure:** it anonymises the profile and keeps statutory invoices and their customer snapshots. It is refused
    while a balance remains. Neither cloud server lets a stale edit un-erase a customer.
  - **Not built:** the SMS/WhatsApp reminder sender is designed in ADR-0050 only.
  - **Migration:** SQLite 0020.
- **Auto-update (8i, ADR-0049 as built).** Why: NFR-013; a shop must get fixes without losing data or a sale.
  - **Channels and rollout:** dev, beta and stable channels, with a staged rollout by a stable installation-id cohort.
    Settings → Updates and an update-ready banner.
  - **Download:** in the background. A finished download is reused across restarts, but an interrupted transfer starts
    again.
  - **Install:** only when the POS is idle: an empty cart, no command running, and the register closed or 10 minutes
    quiet. Quitting the app always installs a downloaded update.
  - **Integrity:** the installer's sha512 is always checked, and on Windows its Authenticode signer too. `latest.yml`
    itself is not signed (signing certificates are an ops task).
  - **Release tooling:** `scripts/release-manifest.ts` writes a channel's `latest.yml` with its rollout percentage.
- **Start-up migration guard (8i).** Why: a failed upgrade must never lose data.
  - **Before migrating:** an encrypted pre-migration backup when a business and key exist, otherwise a verified plain
    copy.
  - **The migration:** every pending migration runs in one transaction, with a foreign-key check inside and no core
    table allowed to lose rows.
  - **On failure:** the backup is restored and the failure recorded. The data rolls back; the program does not, so
    the user reinstalls the previous version, and ops sets the rollout to 0.
- **The cloud accepts sync protocols N and N−1 (8i).** `MUNEEM_SYNC_MIN_PROTOCOL` sets the minimum; anything else gets
  426. The v1 protocol fixtures are frozen and replayed against a protocol-2 server. Why: shops on mixed versions
  during a rollout (LLD §12 takes precedence over FR-105's N−2).
- **Year-end close (8d, ADR-0045 as built).** Why: FR-096 and the Stage 6 deferral.
  - **The close:** an `fy_close` closes the year's income and expense to 3300 Retained Earnings with one `CL/` journal
    dated 31 March, posted into the locked March. `postClosingJournal` is the only path allowed to post into a locked
    month.
  - **Before closing:** every month of the year must be locked, and a regular-scheme business must have set off GST.
    A new permission, `accounting.close`, is held by the owner and the accountant preset; managers do not have it.
  - **Sync:** the close is cloud-authoritative on the control stream, one per year. A device that has synced posts its
    closing journal only when the cloud accepts it, so two devices can never both close a year.
  - **Late arrivals:** a late journal synced into a closed year shows "needs re-close" with the amount, and an
    adjusting closing journal follows. The adjustment is posted by a user, not automatically.
  - **Screen:** Accounts → Year end.
  - **Statements:** the P&L leaves out closing journals. The Balance Sheet's retained earnings are 3300 plus years not
    yet closed, so a closed year's reports read exactly as before.
  - **Docs:** LLD §5.2 now says there is no opening journal.
- **Reports catalogue (8e, ADR-0046 as built).** Why: FR-054 and PRD §25; every report exports and prints from one
  place.
  - **What is in it:** 25 reports on the 8a engine: sales by day, month, product, category and payment method; credit
    notes; day-end; purchases; expenses; payments; cash; stock valuation and movement; product profit; receivables and
    payables as of a date with ageing (closing the Stage 5 carry); customer and supplier ledgers; and every Stage 6
    statement and book. A Reports screen lists them.
  - **Returns:** a credit note reduces sales on its own date, never back-dated, everywhere.
- **Offline dashboard (8e, FR-072).** Why: the owner sees today's business offline, inside the 300 ms budget.
  - **What it shows:** today's net sales, the cash/UPI/credit split, gross profit, purchases, expenses, low stock,
    receivables and payables, top sellers and a 30-day trend.
  - **Speed:** about 30 ms at 200k sales.
  - **Data:** it reads daily summary tables (SQLite 0018) that triggers keep current on sales, credit notes, payments
    and expenses, pulled documents included. Diagnostics rebuilds and heals any drift.
- **Cloud daily aggregates (8e, Go 0006).** Why: the Stage 7 carry, for owner reports. Each pushed document updates the
  same daily tables and `party_outstanding` on the cloud. `GET /reports/daily` is members only, and a test shows the
  cloud's figures equal the device's.
- **GST returns from documents (8c, ADR-0044 as built).** Why: FR-047/FR-094; filed figures must always match the books.
  - **What is built:** the GSTR-1 sections (B2B, B2CL, B2CS, CDNR/CDNUR, exports, nil/exempt per line), the HSN
    summary with UQC, documents issued, GSTR-3B (3.1, 4, 5) and the ITC register.
  - **Reconciliation:** each month's figures must equal that month's tax-account movements exactly. That check is now
    part of the integrity checks.
  - **CA review:** six statutory interpretations are listed in ADR-0044 for a CA to confirm before the pilot.
- **GST set-off and payment documents (8c).** Why: tax is set off without manual journals on control accounts
  (ADR-0035).
  - **Set-off:** a `gst_setoff` per month (letter `S`) uses credit in the statutory order. IGST credit goes first (rule
    88A), CGST and SGST are never crossed, and cess only against cess. The rest goes to 2300.
  - **Payment:** a `gst_payment` (letter `G`) records a challan: Dr 2300 GST Payable, Cr Bank.
  - **Sync:** both sync, and the Go cloud verifies the set-off order and the journal (Go port with shared vectors).
  - **Migration 0017.**
  - **Known gap:** two offline devices can both set off the same month. Both are kept, a review item is raised, and
    there is no set-off cancel yet.
- **GST exports and screens (8c).** GST → Returns, Set-off and Payments. Each GSTR-1 section exports as bare CSV/XLSX in
  the GST offline tool's column order, through a `bare` option on report definitions.
- **HSN is required on new products** of a GST-registered regular business, and a "Products missing HSN" report lists
  older ones. The B2CL threshold is effective-dated. Why: returns need HSN, and thresholds change by notification.
- **The audit chain is verified on the cloud (8g, ADR-0048 as built).** Why: FR-078 and LLD §16; a tampered audit trail
  must not go unnoticed.
  - **Upload:** each audit row is pushed as an `audit_entry` operation on a push-only stream, exactly as stored.
    Rows written before this change are queued once at start-up.
  - **Cloud checks:** both servers check every row's sequence, link to the previous row and recomputed hash, with
    `canonicalJson` ported to Go and shared fixtures. A break is rejected as `AUDIT_CHAIN_BROKEN`, dead-lettered,
    alerted and listed as a review item.
  - **On the device:** `diagnostics.verifyAudit` runs on demand, in the integrity check and every 6 hours. Any break,
    found locally or reported by the cloud, turns the badge to "Needs attention · audit trail check failed".
  - **Restore:** restoring this device's own backup carries its newer audit rows over, so its chain on the cloud is
    not forked.
  - **Migrations:** Go migration 0005 `audit_entry`; no SQLite migration.
- **Sale returns and cancellation as credit notes (8b, ADR-0043 as built).** Why: Stage 3 deferred them, and GSTR-1
  needs credit notes.
  - **Storage:** credit notes have their own tables and a `C` number series.
  - **Pricing:** each line takes its share of the sale line's own tax and cost (golden vectors run in TS and Go). The
    note that completes a bill takes back its round-off.
  - **What a return writes:** stock comes back at the stored cost; what the customer still owes on the bill is settled
    first, and the rest is refunded by cash, UPI or card, or credited to the account. The journal posts through
    `SALE_RETURN_RULE`.
  - **Sync:** credit notes sync, with Go verification.
  - **Cancel** is a full credit note dated today (`sales.cancel`, managers). Returns need `sales.edit`, so cashiers
    cannot make them by default.
  - **Register report:** it counts credit notes, and cash refunds lower expected cash, so the drawer reconciles after
    refunds.
  - **Migration 0016** rebuilds `allocation` and `party_ledger_entry` to accept credit notes, because SQLite cannot
    widen a CHECK.
  - **Tie-out:** output tax is now sales tax minus credit-note tax.
  - **Workloads:** the crash suite, soak and simulation all make returns.
- **Encrypted backups with a cloud-escrowed key (8f, ADR-0047 as built).** Why: FR-071 and NFR-010/011; backups were
  plain local copies with no retention.
  - **Format:** each backup is a `.mbk` archive of the SQLite copy, AES-256-GCM in 1 MiB chunks with a
    device-signed manifest. Tampering with any byte, the order of the chunks, the manifest or the key is refused before
    restore.
  - **Retention:** 7 daily, 4 weekly and 3 monthly backups locally.
  - **Upload:** nightly and after a Z report, to object storage. The data key is escrowed with the cloud, wrapped under
    `MUNEEM_BACKUP_MASTER_KEY`, and the cloud keeps the newest 30.
  - **Restore:** from Diagnostics, or onto a new device ("Restore from cloud backup"). A device that restores its own
    older backup pulls back what it synced since.
  - **Cloud:** `/backups` endpoints, Go migration 0004, and `objectstore.PresignPut`, `Get` and `Delete`.
  - **Permissions:** managers gain `diagnostics.manage`, and `diagnostics.backupNow` is replaced by `backups.*`.
  - **Not encrypted:** pre-migration copies stay plain, because they are taken before the secret store opens.
- **Restoring a database removes any leftover WAL first** instead of overwriting it with the backup's bytes. A test
  shows the old code was not actually corrupting: SQLite ignores a WAL with an invalid header. Deleting is the
  intended behaviour, and the test guards it.
- **Pre-migration backups are recorded in `backup_log`,** like scheduled and manual ones, so backup health sees them.
- **Decisions for Stage 8:** ADRs 0043–0050 cover returns and credit notes, GST returns and set-off, year-end close,
  reports and exports, backups and key escrow, the audit chain on the cloud, updates and protocol support, and
  notifications and consent.

### Added — Stage 7 sync
- **Stage 7 plan (`docs/plans/stage-7-sync.md`).** Decided with the user:
  - **Verification:** the cloud recomputes totals and checks journals; allocation gets a Go port.
  - **Pull scope:** everything flows down, including other terminals' documents.
  - **Transport:** sync runs in a utility process.
  - **Hydration:** NDJSON bundles via S3-compatible storage.

  Build stages now show Stage 6 merged (PR #7) and Stage 7 in progress.
- **Sync protocol and payloads (7a).**
  - **The wire:** `POST /sync/push`, `GET /sync/pull` and `POST|GET /sync/bootstrap` in the OpenAPI spec, the zod
    wire types in `@muneem/contracts` (`protocol.ts`), and a fixed stream per entity type. The Go server answers 501
    until 7b.
  - **Payload schemas:** every outbox payload has a schema (`payloads.ts`). A census test checks every payload a
    seeded run records against its schema.
  - **What payloads gained:** journals carry their source, reference, document date, narration, branch, terminal,
    late flag and reversal; movements carry their warehouse and time. Another device needs these to store the same
    rows.
  - **Protocol fixtures** (`packages/contracts/fixtures/sync`) were recorded from a real flow: applied and duplicate,
    a tampered total, a missing dependency, another device's pull, and a price conflict. Both servers must pass them.
  - **Decisions:** ADRs 0038–0042 cover cloud storage, device identity, applying pulled documents, the conflict
    matrix and the test approach.
- **Cloud ingest (7b).** Migration `0002_sync` and `POST /sync/push`. Why: the cloud must never store an unverified
  document, and never lose or double-apply one.
  - **Each operation** runs in its own transaction: idempotency (a duplicate returns its original seq; a reused id
    with a different payload is rejected), then the dependency and unknown-business deferrals, then verification.
  - **Offline businesses:** a business created offline is accepted when its owner's organization matches.
  - **Ordering:** pushes for one business are serialized with an advisory lock, so `change_log` seqs commit in order.
  - **Verification:** sale and purchase GST is recomputed with the Go port. Totals, tenders and every journal are
    checked against their document, and cancels must reverse the original in full.
  - **Narrowed checks:** supply type is taken as declared, expense GST is not recomputed, allocations are checked
    within one document, and the payload hash is not recomputed.
  - **Rejections** are kept whole in `dead_letter`.
  - **Evidence:** about 4,600 real operations from two seeded soaks, plus a variety set, all applied, and the cloud
    Trial Balance came to zero each time.
- **Allocation has a Go port** (`internal/domain/parties`). 55 shared fixture cases are generated by `gen-fixtures`
  and tested in both languages, so oldest-first allocation agrees across them (ADR-0025).
- **Cloud pull, conflicts and control (7c).** Why: every device converges on what the cloud stores.
  - **Pull:** `GET /sync/pull` serves one stream at a time.
  - **Conflicts:** the LLD §9 matrix resolves master and config edits. Merged results go out with a null origin, and
    review items cover field conflicts, tombstones, duplicate barcodes and late arrivals.
  - **Control:** revoking a device locks it out and tells the others.
  - **Tests:** CI's `go` job now runs Postgres, so every protocol fixture and one integration test per matrix row run
    there.
- **Cloud hydration bundles (7f-1).** Why: a new or replaced device must start from a consistent copy of the
  business, not by pulling row by row.
  - **The bundle:** `POST/GET /sync/bootstrap` builds a gzipped NDJSON bundle per business in the background, from
    one consistent read, and streams it into S3-compatible storage.
  - **Delivery:** the device fetches it from a presigned URL that can resume (HTTP Range).
  - **What it holds:** documents come from `change_log` with every version, so a cancelled document arrives whole;
    the other streams carry each entity's latest state.
  - **Reuse:** a ready bundle is reused until it is 1,000 changes behind.
  - **Storage:** MinIO is in docker-compose and in CI's `go` job. The image is `bitnamilegacy/minio`, because
    `minio/minio` left Docker Hub; it is frozen, for development and CI only.
  - **Migration 0003** lets a member read a snapshot row before a business scope is set.
- **Sync reference server** (`packages/sync-reference`). It implements the protocol and the conflict matrix in
  memory, passes every protocol fixture, and has a seeded fault injector that drives the sync tests. Why: ADR-0042.
- **The device pushes (7d).** Why: Stage 7d, HLD §3.1.
  - **The engine:** a sync engine in main claims, pushes and settles the outbox, with backoff, dead-letter after 12
    attempts and recovery at start-up.
  - **Transport:** HTTP, gzip and signing run in an Electron utility process; the retry timers stay in main.
  - **When it runs:** a scheduler runs it at start-up, when the device comes back online, after each command, every
    60 s, and on `sync.retry`.
  - **Recovery:** a 401 refreshes the token once. A revoked device or one that needs an update shows as blocked.
  - **Speed:** `sales.complete` p95 is 13.9 ms idle and 14.3 ms while pushing.
- **The device pulls and applies (7e).** Why: Stage 7e, ADR-0040.
  - **Pages:** each stream is applied a page at a time, together with its cursor, writing no outbox or audit rows.
  - **Other terminals' documents** are filed with their stored values, through the new `postSyncedJournal` and the
    same stock and party projections local writes use.
  - **Natural keys:** units, accounts, periods and the default price list are matched through `sync_id_alias`.
  - **Movement order:** every device replays stock movements in one order, (time, device, id).
  - **Evidence:** a soak and both golden flows on device A reach device B, and the two agree on documents, stock,
    party balances, the Trial Balance and prices.
- **Payloads carry what filing needs.** Products gain their version and update time. Numbered documents gain their
  series, number, command id and place. Payments and expenses carry their drawer movements, movements their device,
  and allocations their date. The protocol fixtures are regenerated, plus a new one: a stale edit of a product's
  prices loses to the cloud's prices. The Go server gained that rule too.
- **The catalog converges on every device.** The simulation found product prices that stayed different between
  devices.
  - **Cause:** a device skipped its own echo after a merged version from the cloud had overwritten its later edit.
  - **Fix:** masters and config now apply their own echo, which also adopts the cloud's version. Documents still
    skip theirs.
  - **Failures no longer block:** a pulled change that fails to apply becomes a review item and the stream moves on.
- **Receipts carry their cost-correction movements.** Without them, stock value differed on devices that pulled a
  receipt which corrected costs. A soak caught it.
- **Devices apply the Go cloud's review items** (`review_item` on the control stream). They had been ignored as an
  unknown type.
- **Pulled unique clashes never block a stream.** A pulled customer or supplier GSTIN, product SKU, terminal code,
  invoice prefix or branch code that clashes with another row is settled the same way on every device:
  - **The rule:** the lower id keeps the value. The other row's value is cleared or given the next free variant, and
    a local review item records it.
  - **Suppliers:** one that loses its GSTIN becomes unregistered, as the schema requires.
  - **Other failures:** any change that still fails to apply is listed for review and skipped.
- **Adding a device to an existing business (7f-2).** Why: FR-086, the device-replacement and restore path.
  - **Setup** offers "Add this device to an existing business".
  - **Download:** the device fetches the cloud's bundle through the utility process and resumes it across restarts
    (HTTP Range), renewing an expired link once.
  - **Import:** pages of 500 go through the pull path, and an interrupted import resumes. Then the device catches up
    by pulling.
  - **The hold:** billing, seeding and sync are held for that business until it is ready to bill offline.
  - **New IPC:** `sync.listCloudBusinesses`, `sync.hydrationStart` and `sync.hydrationStatus` check the session and
    the membership themselves, because a device being added has no business open yet.
  - **Managers** gain `sync.manage` on the cloud as well.
- **Sync runs end to end against the real Go cloud** (`pnpm e2e:cloud`, CI job `e2e-cloud`). Why: ADR-0042 requires the
  exit to pass against the real server, not only the reference one.
  - **Tests:** the §37 scenario, a faulty-network simulation, a skewed clock, and a new device hydrating from the Go
    bundle in MinIO all run against the Go API, Postgres and MinIO.
  - **Cloud Trial Balance:** computed from `journal_line`, it equals every device's.
  - **Shared steps:** the same steps and assertions also run against the reference server.
- **Fixed: a document cancel synced from the Go cloud could not be applied.** The cloud stored the cancel payload
  alone. It now stores the whole document with the cancel under `cancel`, as the reference server and the device
  expect. Hydrating a new device against Go found it, a new protocol fixture covers it, and the simulation now
  cancels receipts.
- **Fixed: the Go bootstrap endpoint refused the device's gzipped request.** It now reads bodies like push does.
- **Fixed: a sync refused for clock skew no longer refreshes the access token.** Every tick had rotated the refresh
  token for nothing, risking a reuse revocation.
- **Fixed (tests): simulated devices keep their keychain across restarts.** The §37 step where an answer is lost and
  the device is killed had silently not run. It now runs and is asserted.
- **Sync screens (7g).**
  - **The status badge** shows the FR-068 states, the lag and why sync is blocked, and opens Diagnostics.
  - **The POS** shows when stock was last updated once another terminal exists.
  - **Diagnostics → Sync** lists outbox counts, pull cursors, and failed and dead changes with a payload preview. A
    manager can resend them (`sync.resend`; `sync.manage` added to the manager preset).
  - **Settings → Review items** shows each conflict, tombstone, duplicate barcode and late arrival with both versions,
    so a losing edit is visible rather than silent.
  - **Inventory → Stock reconciliation** (FR-087) names the sales and terminals that took stock below zero.
- **Simulation suite and exit scenarios (7h).** Why: the Stage 7 exit criteria.
  - **The simulation:** three devices behind a seeded fault injector covering drops, lost answers, duplicates, 500s,
    reordering, partitions and reclaimed in-flight rows. Over 20 seeds there is no loss and no duplicate, and every
    device ends with the same books and catalog. The same seed gives the same conflict outcomes.
  - **The §37 scenario** runs offline sales, a restart, a clock jump, a double submit, a kill mid-sync, and two
    terminals selling the last unit, which stock reconciliation then names.
  - **NFR-022:** 5,525 operations drain in about 40 s at 512 kbps, against a 10-minute window.

### Added — Stage 6 accounting
- **Stage 6 plan (`docs/plans/stage-6-accounting.md`).** Decided with the user:
  - **Journals:** written in each document's own transaction, with a one-time backfill for documents saved before
    Stage 6.
  - **Periods:** monthly periods with lock and late postings now; the year-end closing journals in Stage 8.
  - **Soak data:** a seeded generator — about two weeks in CI and a year locally.
  - **Reports:** the core statements, account ledger, day book, cash and bank books, and manual journals.

  Build stages now show Stage 5 merged (PR #6) and Stage 6 in progress.
- **6a details written into the plan before building,** reviewed by the user first.
- **Posting engine** (`@muneem/domain/accounting`, ADR-0030):
  - **The rules:** written as data, for every document Stages 3–5 store (sale, purchase, debit note, receipt,
    supplier payment, write-off, expense, opening stock, adjustment and stock take, cost correction, party opening,
    register variance, cash in/out).
  - **`buildJournal`:** drops zero lines and moves signed amounts to the other side. It refuses an unbalanced journal
    with `LEDGER_IMBALANCE` before anything is written.
  - **Tests:** a 500-run property per rule (balanced, no negative or two-sided line, a reversal nets to zero), and
    unit tests that pin each rule to the posting matrix.
- **Chart of accounts** (ADR-0031): LLD §5.1 as data, with one input and one output account per tax head, 1199 Cash to
  classify, 3400 Opening Balance Equity, 5110 Purchase-return Losses and 5470 Bad Debts. Rules name accounts by role,
  so renaming an account keeps its postings. It is seeded per business on first use; system accounts cannot be
  retyped or deleted.
- **Migration `0012_accounting`:** accounts, periods, journals, journal lines and the `account_balance` cache. CHECKs
  and triggers refuse the following:
  - an unbalanced or empty journal;
  - a line on both sides or below zero;
  - a posting to a group account;
  - a second journal for one document (a reversal is allowed once);
  - a late posting dated before its document;
  - any change to a journal.
- **ADRs 0030–0034** (engine, accounts, posting matrix, dates and periods, tie-outs) and
  **`docs/accounting/posting-matrix.md`**, the as-built matrix with worked examples for a CA to sign. It marks every
  departure from LLD §5.2 (customer receipts wholly to 1300, freight kept on returns to 5110, manual cash to 1199,
  openings against 3400).
- **6b details written into the plan;** the user asked for 6b to be built straight after.
- **Every document now posts its journal in its own transaction** (ADR-0030). This covers:
  - sales (a new `journal` step after `party`);
  - purchases, debit notes and purchase cancels;
  - receipts, supplier payments and payment cancels;
  - write-offs;
  - expenses and expense cancels;
  - opening stock, adjustments and stock takes;
  - every cost correction;
  - party openings (a replacement reverses the old one);
  - register close (the variance);
  - cash in/out.
- **How journals are built and written:**
  - **One builder per document,** reading the document as stored, so the 6c backfill will post exactly what live
    posting does.
  - **Cancels** post the mirror journal, dated on the day of the cancel.
  - **Numbers:** documents without a number get a `J` number (ADR-0028 gains the kind).
  - **Sync:** journals travel in their document's sync payload, or as a child row where the repository records the
    document.
- **The chart of accounts is seeded with the business,** alongside the catalog defaults. Seeding it on the first
  posting would have put its 47 audit rows inside a sale. The setup test now counts the account rows separately, the
  way it already counted units and the price list.
- **`accountingTieOuts`** compares 1400 with the stock valuation, 1300 and 2100 with the party balances, each input
  and output tax account with its documents, and the balance cache with the lines.
  - **Document tests:** 15 cover each document type, pinning the journal's accounts and amounts to the posting
    matrix, and every one ends with all tie-outs holding.
  - **Crash suite:** it now checks one journal per sale, no orphan journals, journals equal to their lines, and the
    tie-outs. 20 kills run in CI; 200 kills / 239 sales passed locally.
- **The whole-business ageing speed test times the median of five calls.** A single call could land on a
  garbage-collection pause of the test process: after 6b the bigger test database showed one-off 300–800 ms stalls,
  while the query itself takes 50–110 ms. The budgets are unchanged.
- **6c details written into the plan and built straight after,** as the user asked. *These 6c lines were left out of
  the 6c commit by a scripting slip and were added with 6d.*
- **Accounting periods** (ADR-0033): `accounting.getPeriods`, `lockPeriod` and `unlockPeriod` (`accounting.manage`,
  audited).
  - **Locking:** only a month that has ended can be locked, so there is always an open month after a locked one.
  - **Unlocking:** needs a reason, which is kept on the period.
- **Late postings:** a document dated into a locked month posts into the earliest open month after it, on that month's
  first day. It is flagged `late_posting`, keeps its own date, writes a `journal.late_posting` audit row, and is listed
  by `accounting.listLatePostings`. Nothing is refused or silently moved (LLD §5.4).
- **Backfill** (ADR-0034): `unpostedDocuments` finds every document without a journal.
  - **Cancelled before Stage 6:** these get their journal and then the reversal, dated the day they were cancelled.
  - **Running it:** `accounting.postBacklog` posts them in batches of 200 through the same builders as live posting.
    It runs once per app run, as soon as a session has a business and a terminal.
  - **Tested:** documents saved with posting switched off — every kind, cancels included — are all posted, the
    tie-outs hold, and a second run posts nothing.
- **The integrity check reports journals** (`journals: ok | healed | mismatch | not_run`); the 6-hourly timer runs it
  too.
  - **Rebuilt:** a drifted balance cache (`JOURNAL_BALANCE_DRIFT`).
  - **Reported and never rewritten** (`JOURNAL_MISMATCH`): a tie-out failing, a journal whose lines do not add up, or
    a document without a journal.
  - **Diagnostics screen:** now shows the journal line.
- **6d details written into the plan and built straight after,** as the user asked.
- **Statements** (`accounting.getTrialBalance/getProfitAndLoss/getBalanceSheet`, `reports.financial`, optional branch):
  - **Trial Balance** as at a date, with `balanced`.
  - **P&L** for a range: revenue (41xx/42xx), cost of sales (51xx) and gross profit, then other income and expenses to
    net profit.
  - **Balance Sheet** as at a date, with retained earnings from earlier years' profit and this year's profit shown
    apart (no closing journals until Stage 8). Customers with credit balances are shown as *Advances from customers*
    and suppliers with debit balances as *Advances to suppliers*; the books are unchanged (ADR-0032).
  - **Tested:** after a month's trading the TB balances, the Balance Sheet balances, its "profit for the year" equals
    the P&L, last year's rent shows as retained earnings, and a customer's overpayment is a liability.
- **Books:**
  - **Ledger** (`accounting.getLedger`): any account with opening balance, running balance and paging.
  - **Cash and bank books** (`getCashBook`, `getBankBook`): the 1100 and bank ledgers.
  - **Day book** (`getDayBook`): journals with their lines.
- **Manual journals** (`accounting.postManualJournal`, `reverseJournal`, ADR-0035):
  - **Posting:** balanced, numbered `T1J/…`, once per command.
  - **Refused:** on AR, AP, Inventory and the tax accounts, which change only through documents so their tie-outs
    always hold; on group accounts; and in a locked month (`PERIOD_LOCKED`).
  - **Reversal:** a manual journal can be reversed once.
- **Chart of accounts** (`accounting.listAccounts/createAccount/updateAccount`): accounts with balances, new accounts
  under a group (code in the group's range, type from the group), and renaming any account.
- **6e details written into the plan and built straight after,** as the user asked.
- **Accounts screens** (menu item shown with `accounting.view`):
  - **Chart of accounts:** grouped, with balances as of a date; add an account under a group; rename.
  - **Account ledger:** links to purchases and payments.
  - **Statements:** Trial Balance, P&L with gross and net profit, and a two-sided Balance Sheet, each with a balanced
    badge and a branch filter.
  - **Books:** cash, bank (choose the account) and day book, with late-posting and reversal badges and a "Reverse"
    action on manual journals.
  - **Manual journal form:** shows the running difference, never offers control or group accounts, and keeps Post
    disabled until it balances.
  - **Periods:** lock and unlock with a reason, the late-postings list, and buttons to post the backlog and rebuild
    balances.
- **Helpers and checking:** the journal form, statement layout and chart grouping have node tests. The screens are
  checked by typecheck and build, with a manual checklist in the plan.
- **6f details written into the plan;** at the user's request, 6f was built by three agents in parallel worktrees and
  integrated by the lead.
- **Soak generator and exit test (6f-A).** A seeded, deterministic generator drives the real services day by day through
  a controllable clock. It covers:
  - openings on both sides and opening stock;
  - cash, UPI, split and credit sales, including audited limit overrides;
  - purchases with freight, inter-state and ITC-ineligible lines;
  - debit notes;
  - receipts and supplier payments, auto and chosen, including advances;
  - cash, bank and credit expenses with and without GST;
  - adjustments and stock takes;
  - register close with variance, and cash in/out;
  - cancels, write-offs, card settlements and drawings;
  - month-end locks with backdated late postings.

  **The exit test** checks that the Trial Balance balances (today and at each month end) and the Balance Sheet
  balances. Each year's P&L equals the Balance Sheet's profit for the year, and P&L over the run equals the change in
  equity apart from the owner's own money. Every tie-out holds, the party ledgers reconcile, replay = projection, and
  no document is without a journal. CI runs 14 days (840 sales, crossing a month lock and 1 April); `pnpm soak` runs a
  year locally.
- **The 365-day soak passes** (Stage 6 exit): 98,550 sales, 106,379 journals, 624,710 lines and 54 late postings in
  23 minutes, with every check green. The full-check test now has 2 minutes on runs longer than a month. Its 6.8 s of
  checks had overrun the 5 s default, so the first run reported a timeout, not a wrong figure.
- **Statements read the balance cache for whole months** (6f-B, ADR-0036).
  - **Before:** at a year of data (983,831 journal lines) the Balance Sheet took 5.1 s, the Trial Balance 1.8 s and a
    ledger page about 1 s.
  - **The change:** whole months now come from `account_balance` and only part-month edges from the lines. Ledgers
    walk the journal by date through a new index (migration `0013_accounting_indexes`).
  - **After:** the Trial Balance takes under 50 ms, the P&L under 200 ms, the Balance Sheet 160–490 ms, and ledger and
    day-book pages under 10 ms.
  - **Unchanged results:** proved on 120 random ranges and 60 paged ledgers against the old implementation.
  - **Not covered:** branch-filtered whole-year statements are still line-based (1–5 s) with no budget yet.
  - **Sales speed:** `sales.complete` p95 with the journal step is 12 ms.
- **The golden flows check the books (6f-C).** Both end with the Trial Balance and Balance Sheet balanced, profit
  agreeing, every tie-out holding, and the key account balances pinned. A wrong comment in the Stage 5 flow (it said
  the bill was ₹735; it is ₹700 including GST) is corrected.
- **Opening cash is documented.** Opening a register posts nothing, because the float comes from cash the business
  already holds. The cash a shop starts with is recorded once by manual journal (Dr 1100, Cr 3400); until then 1100
  can read below zero. Noted in the posting matrix after the golden flow showed it.

### Fixed — Stage 6 review (6g)
- **Cancels need no terminal again** (ADR-0037). Stage 6 had made cancelling a payment, expense or purchase need the
  session's terminal, which Stage 5 did not. A reversal now takes the original journal's number, branch and terminal.
  A journal without a document number (write-off, party opening) still needs a terminal for its `J` number and says
  so. A business-level series was rejected because two offline devices would issue the same numbers.
- **A business made before Stage 6 can open its books.** Its cash book threw and its chart page was empty until
  something posted. The chart is now seeded when a session first has the business, and before the statement and chart
  services read.
- **Reversing a manual journal twice says "already reversed"** instead of showing a database UNIQUE error. The day book
  row carries `reversedBy`, so Reverse is hidden even when the reversal is on another page.
- **Backfilled journals reach the sync outbox,** each queued after its document's row. They had been written without
  one, so the cloud would never have received them.
- **The backlog keeps its terminal and user.** It read the session afresh each batch, so a business switch or logout
  mid-run numbered journals with the wrong terminal. It now captures them when it starts and stops if the session
  moves to another business. Each business opened in a run gets its own backlog, not only the first.
- **Faster lookups.** Stock-document and cost-correction lookups now include `business_id`, so they use `ix_mov_ref`.
  `queueJournal` filters by business and entity type, so it uses `ix_outbox_entity` instead of scanning the outbox.
  Documents that post nothing (a register that closed exact, stock documents and corrections with no value) are left
  out in SQL, so they are not rebuilt on every backlog and integrity run. A posting resolves its accounts with one
  query and seeds the chart only on a miss. The tie-outs read every role balance in one grouped pass instead of eleven.
  On the 365-day soak (same figures as 6f), the full integrity check went from 6.8 s to 5.9 s.
- **One copy of shared rules.** The roles manual journals cannot touch (`MANUAL_JOURNAL_BLOCKED_ROLES`) and the date
  helpers (`monthStart`, `monthEnd`, `nextMonthStart`, `dayBefore`, `fyStartOf`) live in `@muneem/domain`. They replace
  the copies in db-sqlite, the renderer and the soak test, and the date helpers reuse the existing `addDays`.

### Fixed — Stage 5
- **Cheap items were over-costed when sold** (ADR-0027, amends ADR-0018). An issue was costed at the average rounded
  to whole paise per unit: 1,000 units bought for ₹15 were costed at 2 paise each, so selling 999 booked ₹19.98 and
  left the last unit worth −₹4.98. An issue that leaves stock on hand now takes its share of the value, so COGS is
  right to the paisa and stock on hand never has a negative value. Found by the value-≥-0 property added in 5a,
  which had passed only by luck of the random seed.
- **The costing property draws realistic unit costs** (up to ₹1 lakh per base unit). A 30,000-run soak found that
  absurd ones (₹1.8 crore per unit) overflow the money kernel. The kernel refuses them with `OVERFLOW` by design,
  so the property no longer passes or fails on the seed.

### Fixed — Stage 5 review (5h)
- **Editing a customer no longer wipes their saved details** (#1). The Parties form sent only name, phone, GSTIN and
  credit days, and the update replaced the whole record, so email, address, city, PIN and a set state were erased.
  The form now carries and shows every field.
- **A new owner sees the Stage 5 screens straight after setup** (#2). Setup now gives the session the owner preset's
  permissions; before, they stayed empty until the next login.
- **Importing a supplier file with more than 20 lines works** (#3). The screen looked up each line's product at once
  and hit the 20-a-second limit. The import preview now returns the matched products itself.
- **The series list no longer breaks after the first purchase or expense** (#11, found while checking #9). The series
  contract allowed only 1–4 character prefixes and no `expense` type, so `DE01P`/`DE01E` failed output validation.
  Creating a series still takes a 1–4 character prefix.
- **New Purchase rows show their own figures** (#4). The quote leaves out rows with problems, and the screen read its
  lines by position, so every row after a bad one showed the next row's taxable and landed cost. Quote lines now carry
  `draftLineNo`.
- **A full return leaves nothing owed** (#6). The debit note that completes the return of every line now takes back
  the bill's round-off; before, up to ₹1 stayed open on the supplier.
- **Reverse-charge purchases are refused** (#7, ADR-0023 amended). The flag was saved but GST was still added to the
  bill and the supplier's balance. No screen sends it.
- **A sale series given pad width 5 no longer stops billing** (#9). The number format was chosen by pad width; it is
  now chosen by document type.
- **Outstanding and ageing "as of" a past date are right** (#5, ADR-0025 amended).
  - **The bug:** a past date subtracted payments made, and counted cancellations done, after that date.
  - **The fix:** migration `0009_allocation_dates` dates every allocation (`allocated_on`, never earlier than the
    document it settles) and every void (`voided_on`). The report counts only documents dated by the date and not
    cancelled by it, and only the allocations made and not voided by it.
  - **Proof:** tests check that on every date the net equals the statement's balance, including a payment cancelled
    later and a backdated payment that predates its bill. Today's numbers are unchanged.
- **Statements, open items and payments read one party's documents, not the shop's** (#10).
  - **The cause:** each statement page and each `payments.get` joined against every document of every party and built
    a temporary index each time.
  - **The fix:** the shared document query filters every branch by business and party (and runs only the branches for
    that party type). Document numbers are looked up only for the rows shown. Migration `0010_party_indexes` indexes
    the party columns that lacked one.
  - **Result:** at 22,500 documents a statement page takes 2.5 ms, open items 3.2 ms and `payments.get` 3.1 ms (before:
    13 ms per page at 3,000 purchases).
- **Whole-business ageing is fast again** (5i #1).
  - **The problem:** the 5h as-of query picked allocation columns with a `CASE`, which defeated both indexes, and it
    evaluated every document. Supplier ageing for the Home card took 9.5 s on 22,500 documents.
  - **The fix:** charges and settlements now use separate indexed lookups, and a request for today reads the
    documents' current totals directly (a test proves this equals the as-of formula). At 42,500 documents and 12,500
    allocations, today takes 75 ms and a past date 84 ms.
  - **The test gap:** the 5h speed test had timed only single-party queries; the new one times the whole business.
- **Old allocations are re-dated correctly** (5i #2).
  - **The problem:** migration 0009 had filled them with the UTC day each row was written, so ageing between a
    backdated payment and its entry showed the bill open.
  - **The fix:** `0011_allocation_dates_backfill` re-dates only those rows. One made with its payment takes the later
    of the payment's and the bill's dates; one made later takes that day, never before the bill; a void takes its
    cancellation's date. 0009 is not edited.
- **A hand-made series can always number its documents** (5i #3). `settings.createSeries` took any 1–4 characters, so
  a purchase series `DE01` failed on every bill, `DE01P` was refused, and `DE01D` was accepted for purchases. Series
  creation now requires 1–4 characters for sale documents, and the terminal prefix plus the type's own letter for
  the others.
- **Documented, not changed** (#8): a purchase's `fy` is the supplier bill's year, while its number uses the year it
  was entered. Stage 6 decides the posting period.

### Added — Stage 5 purchases
- **Stage 5 plan (`docs/plans/stage-5-purchases.md`).** Decided with the user: the party sub-ledger is proved now and
  the GL tie-out to AR 1300 / AP 2100 waits for Stage 6; purchase invoices receive stock directly (no PO or GRN);
  credit sales over the limit are refused unless the user holds the override grant; opening balances, landed cost,
  write-off and purchase-line import are in scope. Build stages now show Stage 4 merged (PR #5) and Stage 5 in
  progress, because the Stage 4 row still said it was awaiting review.
- **Party, purchase and landed-cost engines** (`@muneem/domain`): `allocateOldestFirst` / `allocateAsChosen` (oldest
  due date first, never over the payment or an item), `reconcileParties` (Σ ledger entries = open charges − unallocated
  settlements, per party; names over-allocations, cross-party and dead-document allocations), `landedValues` and
  `billRoundOff`. A 500-run property test proves the reconciliation over any sequence of charges, payments, later
  allocations and cancellations — the Stage 5 exit criterion at the domain level.
- **Supplier returns leave at what was paid** (`returnToSupplier`, ADR-0024), not the moving average, so a debit note
  reverses exactly what the purchase booked; any leftover value is a `cost_correction`. Replay = projection covers it.
- **Migration `0006_parties`:** suppliers, purchases with lines and charges, debit notes, payments, allocations,
  opening balances, write-offs, expenses and the append-only party ledger; customer credit limit and days. Triggers
  keep allocation totals on both documents and refuse over-allocation, cross-party allocation, and returning more
  than was bought, so those mistakes cannot be stored.
- **ADRs 0022–0026** and LLD notes where Stage 5 differs: `payment_allocation` generalised to `allocation`, purchase
  returns at landed cost (not §4.1's average), a 5470 Bad Debts account, `purchases.receive` dropped (no GRN),
  `expenses.update` replaced by cancel and re-create.
- **5b details written into the plan before building:** how an opening balance is corrected (cancel and re-enter),
  ageing from the due date, ledger entries syncing inside their document, permissions, and the 5b tests. Settling
  them first kept the build from guessing.
- **Suppliers** (`suppliers.search/get/create/update`): GST details are checked together, so a GSTIN from another
  state or a registered supplier without one is refused with the field named. Search with an empty query lists all
  suppliers for the coming supplier list. Audited and queued for sync like customers.
- **Customer credit terms:** `creditDays` on the customer (kept when an edit leaves it out), and
  `customers.setCreditLimit` on its own path with `customers.approve`, audited and queued as
  `customer_credit_limit`, so a limit can't change as a side effect of a profile edit (ADR-0026).
- **Opening balances** (`customers.setOpening`, `suppliers.setOpening`): one live opening per party, on the party's
  usual side unless told otherwise. Re-entering one cancels the old in the same transaction, and is refused while
  payments are allocated to it.
- **Party ledger:** `postPartyEntry` is the only writer. It refuses a zero amount and a cancel that does not reverse
  its post, and a repeat of the same entry is a no-op.
  - **Statement:** `customers.getLedger` / `suppliers.getLedger` list entries in date order with a running balance,
    paged, with opening and closing balances for a date range (FR-039).
  - **Outstanding:** `customers.getOutstanding` / `suppliers.getOutstanding` age open items by days past due
    (0–30 / 31–60 / 61–90 / 90+) and show advances apart.
  - **Shared query:** credit sales, purchases, expenses, payments, debit notes and write-offs are all read through one
    query (`PARTY_DOCUMENTS_SQL`), so later parts only write documents.
- **`reconcilePartiesDb`** runs the Stage 5 exit check against the database. Every 5b test ends reconciled, and a
  planted entry is named.
- **5c details written into the plan before building** (numbering, ITC rules, freight on returns, cancel limits,
  `purchases.quote`, import that only fills the form), reviewed by the user first.
- **Purchase invoices** (`purchases.quote/create/get/list`):
  - **Tax:** the bill's rate and units go through the same GST engine as sales, with the supplier's state against the
    branch's, so intra/inter and the tax-split CHECKs hold. A line may carry the GST rate the bill charged without
    changing the product.
  - **ITC:** claimable only when both supplier and business are on the regular scheme; a line can be marked
    ineligible, and its tax becomes stock cost.
  - **Freight and charges** are spread by taxable value into each line's landed cost, and stock is received at that
    cost, which also re-costs anything sold before the bill was entered.
  - **Bill total:** within ±₹1 of the computed total it is kept as round-off; beyond, it is refused with the field
    named. `purchases.quote` shows the difference before saving.
  - **Due date:** the bill date plus the supplier's credit days, unless entered.
  - **Refused:** a supplier invoice number already used in the year (in any letter case, naming the purchase), a
    future bill date, and bad lines (with the line named). A repeated command id returns the first purchase.
  - **Atomic:** a failure part-way leaves nothing.
- **Debit notes** (`purchases.return`, ADR-0024):
  - **Amounts:** each line's amounts are its cumulative share of the purchase line, so returns always add up to the
    line exactly.
  - **Stock:** goods leave at their own landed cost (`returnToSupplier`, through a new `postMovement` path that replay
    understands).
  - **Freight:** the freight share is refunded only if the user says so.
  - **Settlement:** the note settles its purchase first, and any excess is credit from the supplier.
  - **Refused:** returning more than is left (`RETURN_QTY_EXCEEDED`, line named); goods already sold when the
    negative-stock policy is `block`.
- **Cancelling a purchase** (`purchases.cancel`) takes the goods back out at landed cost and reverses the ledger
  entry. It is refused while the purchase is paid or has a debit note.
- **Purchase-line import** (`purchases.importLinesPreview`) turns a supplier's CSV/XLSX into form lines. It matches
  SKU or barcode, unit, rate, GST % and discount %, and names bad rows. Nothing is saved until `purchases.create`.
- **Numbers** (ADR-0028): `T1P/2627/00001` for purchases and `T1D/2627/00001` for debit notes, per terminal.
  Debit notes are GST documents and must stay within 16 characters.
- **Migration `0007_purchase_commands`:** a command id on purchases and debit notes, unique and frozen. `0006` was
  not edited, because a database that already ran it would never see the change.
- **The negative-stock rule** moved into one helper shared by sales and purchase returns.
- **Every purchase test ends** with the party sub-ledger reconciled and `replay = projection`.
- **5d details written into the plan before building** (who may pay, cash and the drawer, GST on expenses, numbers,
  migration 0008), reviewed by the user first.
- **Payments** (`payments.create/get/list/openItems/allocate/cancel`):
  - **Numbering:** customer receipts are `T1R/…` and supplier payments `T1Y/…`.
  - **Settling:** a payment settles the oldest due item first, or exactly the items chosen, and anything over that
    is an advance. Allocating more than an item owes or the payment holds is refused, and so is choosing a document
    of the wrong type.
  - **Later allocation:** `payments.allocate` applies an advance, a debit note's excess or an opening advance to
    bills that arrive later.
  - **Cancelling** voids the payment's allocations, giving the amounts back to the bills, and reverses the ledger.
  - **Repeats:** a repeated command id returns the first payment.
- **Cash and the drawer** (ADR-0029): with a register open, a cash receipt is a `cash_in` and a cash payment to a
  supplier is a `cash_out`, so expected cash stays right. Cancelling reverses it while that register is still open.
- **Who may pay** (ADR-0029): paying also needs the right to see the party, so a cashier can take a customer's
  payment but not pay suppliers.
- **Write-offs** (`payments.writeOff`, `payments.approve`) clear the chosen customer items at once, for Stage 6 to post
  to 5470 Bad Debts.
- **Expenses** (`expenses.listCategories/create/get/list/cancel`):
  - **Categories:** eight are seeded on first use, mapped to the LLD expense accounts.
  - **Numbering:** `T1E/…`.
  - **GST** is worked out by the GST engine when there's a rate. It needs the vendor's GSTIN, and input tax credit
    is claimed only by a regular business.
  - **On credit,** an expense is a charge on the supplier's ledger, due after the supplier's credit days, and a
    supplier payment settles it.
  - **Cash** with a register open leaves the drawer.
  - **Cancelling** is refused once something is allocated to it.
- **Migration `0008_payment_commands`:** a unique, frozen command id on payments, write-offs and expenses.
- **Every 5d test ends** with the party sub-ledger reconciled.
- **5e details written into the plan before building** (no limit = ₹0, the limit checked at the commit, the
  payment-dialog change), reviewed by the user first.
- **Credit sales at the POS** (ADR-0026, amended):
  - **The tender:** `credit` is a tender, allowed only with a customer on the bill, on one line, and never more than
    the bill.
  - **What the sale stores:** what was paid now, the credit portion and a due date (sale date + the customer's credit
    days).
  - **The ledger:** the credit goes on the customer's ledger in a new `party` step inside the sale, which sales
    without credit skip. Later receipts settle it.
  - **The limit** is checked inside the sale's transaction against the customer's ledger balance, so an advance adds
    room. A customer with no limit set counts as ₹0, so "no limit" can't mean unlimited.
  - **Over the limit:** a cashier is refused with `CREDIT_LIMIT_EXCEEDED`, naming the balance, the limit and the
    shortfall, and nothing is written. A user with `customers.approve` goes through, with a `credit.limit_override`
    audit row.
  - **What the quote shows:** the customer's balance, limit and available credit. The payment dialog shows the credit
    row only when a customer is on the bill.
  - **The receipt** prints "On credit", the due date and "Balance now". The Z report lists credit by tender, and
    expected cash ignores it.
- **The kill -9 suite now mixes in credit sales** and checks one ledger entry per credit sale, no orphan entries and a
  clean party reconciliation after the kills (20 in CI; 200 kills / 435 sales PASS locally). Credit sales complete with
  p95 14 ms (cash sales 12 ms; budget 250 ms).
- **The over-tender message now names credit** alongside card, UPI and other.
- **5f details written into the plan before building,** reviewed by the user first.
- **The screens know the user's permissions** (`Session.permissions`) and use them only to hide menus and buttons
  (5f details). Main still checks every call.
- **Parties screens (5f-1):**
  - **Lists:** customers and suppliers with search and balances. Customer search with an empty query now lists
    everyone, as supplier search does, so the list can show all parties.
  - **Forms:** add and edit; the supplier's state follows its GSTIN.
  - **Party page:** statement with a date range and running balance, ageing and unapplied credit, with actions for
    payment, applying credit, opening balance, credit limit (managers) and write-off (`payments.approve`).
  - **Outstanding report:** receivables and payables by ageing bucket.
- **Payments screens (5f-1):**
  - **List and page:** a filtered list, and a payment page with its allocations and a cancel.
  - **New payment:** an allocation grid whose "oldest due first" preview uses the same domain function as the server.
    "Choose" shows the advance left and names over-allocation before saving. One command id per form makes a retry
    safe.
- **Home cards:** what customers owe (and the part over 30 days) and what is owed to suppliers (and the part
  overdue).
  - **Change from the 5f details:** the card shows *overdue*, not "due within 7 days", because the ageing buckets do
    not separate the next 7 days.
- **Speed tests:** they get an explicit 60 s test timeout. Under a fully parallel run the credit test took 7 s in
  total and hit the 5 s default, while its p95 stayed far inside the 250 ms budget, which is unchanged.
- **Helpers:** party forms and the allocation grid have node tests. The screens are checked by typecheck and build,
  not clicked through.
- **Purchase screens (5f-2):**
  - **List:** filtered, showing what is still owed.
  - **New purchase:** supplier picker; lines in any of the product's units with rate, inclusive toggle, discount, GST
    rate and ITC tick; bill discount and charges; a CSV/XLSX import that fills the grid and lists bad rows.
  - **Live quote:** shows tax, ITC, landed cost per unit and whether the typed bill total fits. Save stays off until
    it does.
  - **Purchase page:** landed costs and returned quantities, a return-goods dialog that issues a debit note (with the
    "supplier refunds freight" tick), and cancel for a wrong entry.
- **Expense screens (5f-2):** a list with cancel, and a form whose GST box appears only once a supplier or vendor
  GSTIN is known.
  - **Cancel reason:** asked in a dialog, because Electron does not support `window.prompt`.
- **Menus:** Purchases and Expenses join the menu, each shown only to users who may view them.
- **Helpers:** purchase and expense form helpers have node tests.
- **Manual checklist:** added to the plan, because the screens have not been clicked through yet.
- **5g details written into the plan before building,** reviewed by the user first.
- **Parties golden flow, offline:** supplier opening → purchase with freight → credit sale → receipt leaving an advance
  → debit note → cash supplier payment, oldest first → cash expense → Z report. It checks both ledgers, outstanding,
  valuation, the drawer to the paisa, reconciliation, replay, and that every document's sync row carries its ledger
  entry.
- **The integrity check reports party ledgers** (`parties: ok | mismatch | not_run`), and the 6-hourly timer runs it.
  A mismatch is logged as `PARTY_LEDGER_MISMATCH` and never rewritten, because entries are the record, not a cache.
  The Diagnostics screen now shows the stock and party results too.
- **Speed tests for Stage 5:**
  - a 200-line purchase: p95 62 ms;
  - a payment settling 500 bills: 62 ms;
  - reconciliation over 12,500 documents: 0.1–0.2 s.
- **Stage 5 is done, awaiting review:** build-stages, architecture (a Parties and purchases section, new invariants,
  "not built yet") and the plan's "As built" list are updated.

### Added — Stage 4 inventory
- **Stage 4 plan (`docs/plans/stage-4-inventory.md`) and ADRs 0018–0021.** Decided with the user: no back-fill (stock
  starts from an opening count); the inventory sub-ledger is proved now and the GL tie-out to account 1400 waits for
  Stage 6; stock take, opening-stock import, stock ledger and stock in POS are in scope; negative stock is "warn and
  allow" by default.
- **Moving-average costing engine** (`@muneem/domain` `receiveStock`/`issueStock`/`replayMovements`), exactly LLD §4.1,
  with each movement recording the exact change it made to the stock value. That is what makes
  `replay(movements) = projection` hold: as the design was written, clamping at zero left residue. A 500-run property
  test proves the replay reproduces every level and every movement. Issues below zero use the last known cost and are
  corrected on the next receipt by a value-only movement.
- **Migration `0005_inventory`:** warehouses, stock movements (append-only, idempotent per document line), cached stock
  levels, adjustment documents, and a schema-ready batch table.
- **Stock ledger repository** (`postMovement`, the only writer of cached stock levels; `planIssues`; `replayCheck`;
  `rebuildStockLevels`; one default warehouse per branch, made on first use).
- **Sales now move stock** (ADR-0019). The commit works out each line's cost before writing the append-only lines, so
  sale lines and the sale carry COGS. It posts one sale movement per line and puts the movements in the sale's sync
  payload.
  - **Negative stock** (ADR-0020): the quote warns when a line would take stock below zero, and the policy
    (`inventory.negativeStock`: block / warn / allow, default warn; per-product override) can refuse the sale with
    `STOCK_INSUFFICIENT`. A sale that goes negative is audited.
  - **Crash suite:** it now also checks one movement per sale line and replay = projection after the kills.
  - **Speed:** `sales.complete` p95 is 13 ms with the stock step.
- **Opening stock, adjustments and stock take** (`inventory.setOpeningStock/adjust/stockTake`, ADR-0021). Each is a
  document with one movement per line, audited and queued for sync.
  - **Opening stock:** quantity and cost, allowed only once per product.
  - **Adjustments:** a reason per line; losses leave at average cost and gains enter at it.
  - **Stock take:** posts only the differences, measured when it is posted, so sales during the count are respected.
  - **Permissions:** `inventory.adjust` is needed for adjustments and stock takes (cashiers don't have it).
- **Opening-stock import** (`inventory.importOpeningPreview/importOpeningCommit`). It matches products by SKU or
  barcode, uses the product's purchase price when there is no cost column, and reports bad, duplicate or
  already-stocked rows. The commit is one transaction and safe to retry. The preview store and column matching from
  the Stage 2 import are now generic so both imports share them.
- **Stock queries** (`inventory.getStock/getMovements/valuation/listLowStock/rebuildProjections`):
  - **Stock list:** with low stock (on hand ≤ reorder level).
  - **Product ledger:** each movement with the running quantity and value after it (FR-024).
  - **Valuation:** proves the inventory sub-ledger, with Σ stock levels equal to Σ movement values.
  - **Product search:** results show on-hand stock in the base unit.
- **Stock integrity check** — Diagnostics' integrity check, and a 6-hourly timer, replay the movements against the
  cached levels. Any drift is logged as `STOCK_PROJECTION_DRIFT` and rebuilt from the movements.
- **Inventory screens** (`/inventory`, now in the menu):
  - **Stock list:** low-stock badges and filter.
  - **Valuation:** stock value, products below zero, and a ledger check that the sub-ledger balances.
  - **Product ledger:** every movement with running balances and provisional-cost markers.
  - **Adjust stock:** add or remove, with a reason per line.
  - **Stock take:** count by category, review differences, post.
  - **Opening stock:** by hand, or imported from a file with column matching.
- **Stock in POS and Home:**
  - **Search:** POS results show on-hand stock.
  - **Cart:** cart lines show stock warnings, and payment is stopped when the policy blocks a sale.
  - **Home:** a low-stock card.
  - **Tests:** the logic behind these screens (count differences, warnings on cart lines) has node tests.

- **Offline golden flow now covers stock**: opening stock, the sale reduces stock at average cost, COGS is recorded and
  the valuation sub-ledger balances.

### Fixed — Stage 4 review
- **The integrity check could undo a sale.** The rebuild wrote back levels worked out before its pauses, so a sale made
  during a pause was overwritten. It now replays again inside the write transaction. A rebuilt level is now always the
  sum of the stored movements, so the valuation balances. Movements costed from a drifted level are reported for
  review (`STOCK_COST_MISMATCH`) instead of being "healed" on every run.
- **A bad count hidden by the stock take's filter blocked posting with no explanation;** every bad count is now named next
  to the button.
- **The cost of goods sold landed on the wrong sale.** After stock went negative, the next sale picked up the
  re-costing of every earlier oversold unit. For example: sell 5 at ₹10 provisional, receive 2 at ₹20, then sell 1;
  that sale recorded ₹50 instead of ₹20. Units below zero now keep their cost, and a receipt re-costs only the units it
  covers, as its own correction (ADR-0018 amended).
- **Shops that billed before entering opening stock could never record its cost.** Opening stock was refused for any
  product with movements. It now means "on the shelf now, at this cost", is allowed once per product even after
  sales, and re-costs those earlier sales (ADR-0021 amended).
- **A stock take that listed a product twice applied the difference twice.** It is now refused.
- **Stock shown in search, the stock list and the stock take added up every branch,** while warnings and blocking used
  this branch only. All of them now show this branch's warehouse; the valuation stays business-wide.
- **The stock take screen** could only count the first 500 products and dropped counts when the category changed. It
  now has search and "load more", and keeps every count until it is posted.
- **A quantity too small for the base unit** (0.4 g of a product sold by the kg) crashed the sale. It is now a clear
  quote issue.
- **The stock integrity check could freeze the app.** It now works in batches that yield to the UI, scheduled runs
  check a rotating slice, and drift is rebuilt in one transaction without replaying twice.
- **Average cost had two definitions:** the stock list used its own SQL and showed ₹0.00 at zero stock. It now uses the
  costing engine's, which falls back to the last unit cost.
- **Search on products and customers** used an invisible literal U+FFFF character as the prefix upper bound; it is now
  the visible `\uffff` escape.

### Fixed — Stage 4
- **Scanned products showed stale stock.** The Stage 2 barcode cache kept whole search results, including on-hand
  quantity, which changes with every sale. The cache now keeps product and price but reads stock afresh on each hit,
  and warm scans still take about 0.01 ms.

### Added — Stage 3 POS billing
- **Stage 3 plan (`docs/plans/stage-3-pos.md`) and ADRs 0013–0017** — the design disagreed on whether stock and the
  journal belong in the Stage 3 commit, and left numbering, tenders, sessions and printing details open. Decided with
  the user: stock and books join the commit in Stages 4/6 through a step seam; basic customers without credit;
  hold/retrieve bills; no printer yet (simulator + network ESC/POS).
- **Migration `0003_pos`** — customers, register sessions, cash movements, sales with lines and tenders, held bills and
  print jobs. The database itself refuses a sale whose tax split or payments do not add up, makes sales, lines and
  tenders append-only, allows one open register per terminal, and fixes `doc_series` letting duplicate business-wide
  series through (SQLite treats NULLs as distinct in a UNIQUE).
- **POS rules in `@muneem/domain`**: `settleTenders` (change only from cash; paid − change = total), `effectiveDiscountBp`
  (to the nearest basis point, so an exact 5% stays 5% after per-line rounding), `expectedCash`, GSTIN state and UTGST helpers.

- **Customers** (`customers.search/get/create/update`): name, phone, GSTIN, state and address. The state is taken
  from the GSTIN, and a contradicting state is refused, because the state decides IGST vs CGST/SGST on the invoice.
- **Register sessions** (`pos.openRegister/getSession/cashMovement/xReport/zReport/closeRegister`): one open register
  per terminal, cash in/out/safe drop with reasons, live X report, close with counted cash (optional denominations
  that must add up) and a frozen Z report. A variance above the threshold (default ₹100) needs a manager; blind close
  hides the expected cash from cashiers; a register with held bills cannot be closed (ADR-0017).

- **The sale commit** (`sales.quote/complete/get/list/getReceipt`). Lines are priced in the main process from product
  data (current price list, quantity breaks, unit conversions) and run through the GST engine. The commit then
  allocates the terminal's invoice number (`DEL1/T01/2026-27/000001`, a new series per financial year) and saves the
  sale with a tax snapshot per line, its tenders and its receipt print job. It writes one audit row and one outbox row
  holding the whole sale, all in one transaction. The commit is a list of named steps so Stage 4 (stock) and Stage 6
  (journal) slot in without rewriting it (ADR-0013).
- **Safety checks at commit:** the total must equal the one the cashier saw (`TOTAL_MISMATCH` otherwise), payments must
  balance with change only from cash, the effective discount must be within the user's limit (cashier 5%), and the
  register must be open. A repeated `commandId` returns the original sale instead of billing twice.
- **B2B and place of supply:** a customer's GSTIN state drives IGST vs CGST/SGST and the GSTR-1 bucket; an override needs a
  reason and is stored on the sale. Composition and unregistered businesses issue a bill of supply with no tax.
- **`sales.complete` performance test**: p95 9.9 ms for 10-line sales at 5,000 SKUs (budget 250 ms).

- **Receipt printing** (ADR-0015). Each sale's receipt is a stored document laid out at print time for 32, 42 or 48
  columns and encoded as ESC/POS: alignment, bold, double width, feed and cut, and the drawer kick for cash sales.
  - **Printers:** a simulator writes each receipt to `userData/receipts/` as text and raw bytes, which is the default
    until a printer is set up; a network printer adapter covers TCP 9100.
  - **Queue:** jobs print one at a time after commit and retry from the queue. A failure is recorded on the job and
    never affects the sale, and jobs left queued by a crash print on the next start.
  - **Reprints** are new jobs marked "DUPLICATE (copy n)".
  - **Calls:** `printer.getConfig/setConfig/testPrint/getQueue/retryJob/reprint` and `drawer.open`. Printer settings
    are per device and never sync.
  - **Limitation:** the plain ESC/POS code page has no ₹ or Indic characters, so ₹ prints as "Rs" and non-ASCII text
    as "?" until bitmap text is added.
- **`hardware` log** — the Diagnostics log viewer offered "hardware" but no such log was written; printer and drawer
  events now go there, and it is included in support bundles.

- **Held bills** (`pos.holdBill/listHeldBills/retrieveBill/discardBill`, F6/F7). A held cart keeps products and
  quantities only; prices are worked out again when it comes back. Held bills stay on the till and block closing the
  register.
- **POS screen** (`/pos`, keyboard-first): register gate with opening float; scanner detection (a burst of 4+
  characters ending in Enter within the LLD timings) on the page and the search box. Keys: F2 search, F3 customer,
  F4 bill discount, F5 payment, F6 hold, F7 retrieve, F9 reprint last, Esc clear.
  - **Cart and totals:** quantity and line-discount editing, with instant totals from the same GST engine and the main
    process re-pricing after each change.
  - **Payment:** split payment with live change due.
  - **Safeguards:** a near-duplicate warning (same amount and customer within a minute), a printer-failure banner with
    retry, and cash in/out, X report and close with a Z report.
  - **Printer settings:** `/settings/printer` for simulator or network, paper width, drawer, test print.
- **Quote context** (`sales.quote` returns the supplier state, tax scheme and rounding setting) so the renderer can total
  the cart itself between quotes (ADR-0016).

- **Kill -9 suite for billing** (Stage 3 exit criterion): a child process completes sales until it is SIGKILLed at a
  random moment; afterwards every sale must have its lines, tenders, audit row, outbox row and print job, with no
  orphan rows. Invoice numbers must be gap-free per series, no number consumed by an unsaved sale, and the audit
  chains intact. 20 kills run in CI; `crash-loop --scenario sales 200` passed with 578 sales.
- **Offline golden-flow test** (PRD §8): with the cloud down, it logs in offline, opens the register, scans, adds a
  customer, applies a bill discount, takes UPI + cash with change and prints. It then does a cash out and closes with
  a Z report, and finally checks the sale is queued for sync and the audit chain verifies.

### Fixed — Stage 3 review
- **The desktop app failed to start when its database needed an upgrade** ("better_sqlite3.node was compiled against
  a different Node.js version"). The pre-migration backup was verified by opening it with the Node build of SQLite
  instead of the Electron build the app uses; the scheduled backup had the same flaw. The backup check now reuses
  the connection's own SQLite build. Present since Stage 1; it surfaced once a desktop database had migrations to apply.
- **Invoice numbers were too long for GST.** `DEL1/T01/2026-27/000001` is 23 characters; CGST Rule 46(b) allows 16, so
  GSTR-1 and e-invoicing would reject every bill. Numbers now read `DE01/2627/000001`: each terminal has a 1–4
  character invoice prefix, unique in the business, suggested at setup. Migration `0004` gives existing terminals one
  (ADR-0014 amended).
- **A retried payment could bill twice.** Each press of "Complete sale" sent a new command id, so after a timeout a
  second sale could be recorded. The id now stays the same while the cart is unchanged, and the server returns the
  first sale.
- **Retrieving a held bill could lose it.** The bill was deleted before it was re-priced, so any failure lost it. Now
  it is read, rebuilt in the cart and only then discarded. A deleted customer becomes walk-in with a note, and a cart
  already in use is held first.
- **Retry could reprint a finished receipt** as an original and open the drawer. Only failed jobs of the current
  business can be retried, and the drawer opens only on a job's first attempt.
- **A crash mid-print reprinted on restart.** Interrupted jobs and jobs queued on an earlier day are now marked failed
  for the cashier to retry, instead of being sent again.
- **Scanning while the search box had text** also added the first search match; the scan now stops the Enter event
  and clears the box.
- **Settings were not validated.** `settings.set` accepted any value for any key, so `"false"` counted as true and a
  string footer broke every receipt. Keys now have schemas, bad values are refused, and readers fall back to defaults
  if a stored value is invalid.
- **A discount typo silently removed the discount.** Unreadable text is now an error. `10,5` is rejected instead of
  read as 105: commas are only accepted as thousands grouping. "%" in the amount field asks for Percent.
- **Sales could be missing from the sales list** when several shared a timestamp at a page boundary; `sales.list` now
  pages by (time, id) and returns `nextCursor`.
- **Negative amounts printed without their sign** (−₹0.50 as ₹0.50) in two separate copies of the rupee formatter.
  There is now one, `formatRupees` in `@muneem/domain`.

### Fixed
- **The crash tests never killed the process doing the writing.** They SIGKILLed the `tsx` launcher, which runs the
  script in a second Node process, so the writer kept running and the checks proved nothing about crashes. This
  affected the Stage 1 `crash-loop` too. Children now run as `node --import tsx`. Re-run for real, the Stage 1 loop
  passes (30 kills) and the new sales suite passes (200 kills).
- **The print queue could crash the app** if recording a job's status failed (for example a busy database). It now
  logs the problem and retries the job at the next start.
- **`pnpm dev` showed a blank window** ("@vitejs/plugin-react can't detect preamble"). The renderer's Content Security
  Policy blocks inline scripts, and Vite's dev server injects one for React hot reload. When loading from the dev server
  only, the policy now allows inline scripts and the HMR websocket; the packaged app keeps the strict policy.

### Added — Stage 2 catalog
- **Stage 2 plan (`docs/plans/stage-2-catalog.md`)** — the LLD had tables and targets for the catalog but no task
  breakdown, and left category/brand, the import wizard, scope and cloud involvement open. The plan settles them.
- **Catalog domain helpers** (`@muneem/domain` `catalog/`): `normalizeName`, barcode check-digit validation and
  symbology detection, integer unit conversion, `resolvePrice` and `exceedsMrp` — pure functions so search, import and
  POS all agree on the same rules.
- **Migration `0002_catalog`** — units, categories, brands, products, variants (table only), barcodes, unit
  conversions, price lists and the `product_fts` search index, with the standard sync columns so Stage 7 can ship them.
- **`stmt()` statement cache** in `@muneem/db-sqlite` — the barcode path must stay under 30 ms, and recompiling SQL on
  every scan wastes most of that budget. See [ADR-0012](decisions/0012-hot-path-statement-cache-and-barcode-lru.md).
- **Outbox entity types for the catalog**, and `appendOutbox` now only accepts known entity types, so a typo cannot
  queue rows the Stage 7 server will reject.
- **Desktop tests read the schema version from `MIGRATIONS`** instead of hard-coding `1`, so adding a migration does
  not break unrelated auth tests.

- **Catalog repositories** (`@muneem/db-sqlite`): units, categories, brands, products, price lists, search queries and
  `ensureCatalogDefaults`. A product save writes the product, its barcodes, unit conversions, selling price and search
  row in one transaction, with **one** audit row for the whole product and child outbox rows that depend on it, so
  Stage 7 can replay them in order.
- **Effective-dated selling price** — changing the price closes the old price at today and opens the new one, so
  yesterday's bills still resolve to yesterday's price.
- **Catalog IPC surface**: `products.*` (search, lookupBarcode, list, get, create, update, deactivate, reactivate),
  `catalog.*` (units, categories, brands) and `pricing.*` (price lists and items). Price lists use the `pricing`
  namespace because IPC namespaces must be lowercase.
- **Search order** in `ProductSearch`: exact barcode → exact SKU → name prefix → word match, plus a 500-entry
  barcode cache cleared on any catalog write ([ADR-0012](decisions/0012-hot-path-statement-cache-and-barcode-lru.md)).
- **New businesses are seeded with 9 standard units and a `Retail` price list**; businesses created in Stage 1 get
  them on first catalog use, so nobody has to set up units before adding the first product.
- **Registry test now requires `audit: true` on deactivate/reactivate/import channels** too — they change data just
  like `create`/`update`.

- **Catalog performance test** (`apps/desktop/test/perf/catalog.perf.test.ts`) at 5,000 SKUs / 7,500 barcodes, run in
  normal CI: barcode lookup p95 0.14 ms cold and 0.006 ms warm (budget 30 ms), search p95 0.98 ms (budget 60 ms) on
  the dev machine. It turns the Stage 2 exit criterion into a test that fails if a change slows the scan path.

- **CSV/XLSX product import** (`products.importPreview` / `products.importCommit`) — FR-017 and the Stage 2 exit
  criterion. Headers such as "Item Name", "Sale Price" or "GST %" are mapped automatically; every row is checked with
  the same rules as the product form, and bad rows are listed with the reason. Existing products (same SKU or barcode)
  are skipped or updated, as the user chooses. The commit is one transaction that can be safely retried. A 5,000-row
  file imports in about 3 s. See [ADR-0010](decisions/0010-product-import-two-phase.md).
- **`parseScaled`** (`@muneem/domain`) turns "₹1,234.50" or "18%" into integer paise or basis points using string digits
  only, so imported money never passes through a float.

- **Products screens** — `/products` (search as you type or scan, filter by category, show deactivated),
  `/products/new` and `/products/:id` (details, GST, prices, barcodes, other units, price lists, deactivate),
  `/products/import` (choose file → match columns → review rows → import) and `/settings/catalog` (units, categories,
  brands, price lists). The Products menu item is now enabled. The form logic (rupee parsing and display, form to
  `ProductInput`, price rows) lives in `src/renderer/src/lib/` with node tests, because the renderer has no DOM test
  setup yet.

### Changed
- **Stage 2 marked done in `build-stages.md`** with the measured numbers. Also updated: the architecture overview
  (catalog section and invariants), LLD §10.2 (the `products`/`catalog`/`pricing` surface as built), and the plan's
  "as built" notes.

### Fixed — Stage 2 second review
- **MRP could be lowered below the selling price**, and **changing "Prices include GST" or the base unit left the
  stored price behind** — both came from the form no longer sending an unchanged price. The rules now live in the
  database layer: an update without a price keeps the stored one (re-dated under the new unit and tax flag), a base-unit
  change closes the old base-unit price, and after every update each current or future price in every list must be
  within MRP for its unit. This also covers API callers and imports.
- **Editing a barcode could make the product unsaveable** (a recoded EAN kept its old symbology; a case barcode moved
  to PCS kept its pack of 12). The form now sends symbology and pack quantity only for rows the user did not touch.
- **An import could still fail at commit**: two rows updating the same product, a pack price in another list above the
  file's new MRP, or a barcode belonging to a deleted product. The preview now flags all three, and as a last guard
  each row is applied in a savepoint, so a row refused at commit is skipped and listed (`skippedAtCommit`) instead of
  rolling back the whole import.
- **CSV rows of only commas shifted the reported line numbers**, and **16-digit numeric codes in .xlsx were rounded**.
  Every physical CSV row is now counted, and only non-integers are rounded.

### Fixed — Stage 2 review
- **Pack prices were checked against the single-piece MRP.** A BOX of 24 with MRP ₹20 per piece could not be priced
  at ₹450. The ceiling is now MRP × the unit's conversion, and a price for a unit with no conversion on the product is
  refused with a field error, because it could never be applied.
- **"Update existing products" could pass the preview and then fail the whole import.** The preview checked only the
  file row, while the commit checked the file row merged with the existing product. The preview now checks the merged
  product and marks such rows "can't update: …"; the commit skips them and imports the rest.
- **An .xlsx with an empty header cell could not be imported**, and **formula prices like `=0.1+0.2` were rejected** as
  `0.30000000000000004`. Empty cells now fill their column, and numbers are read at 15 significant digits, as Excel
  shows them.
- **Saving the product form could undo a price just saved in "Price lists"**, and Enter in a price field submitted the
  product. The price editor is now outside the product form, the selling price is sent only when edited, and fields
  you have not touched pick up the latest saved values.
- **An "Until" date before "From" (or two identical price rows) showed "Something went wrong".** Both are now checked
  in the shared schema and reported on the field, in the form and over IPC.
- **Adding an invalid unit code (e.g. `PKT.`) did nothing visible**; catalog settings now show validation messages.
- **Import previews expired while in use** — the 15-minute timer now restarts on every use.
- **CSV preview row numbers drifted** after blank lines or cells spanning lines; they now match the file's line numbers.
- **Product lists ran two queries per row** (101 for a 50-row page); prices for a page are now fetched in one query,
  and the list query uses the cached-statement helper (ADR-0012).
- **The product form dropped a barcode's pack quantity and symbology** on save; both now survive.

### Changed — Stage 2 review
- Removed the unused `findCategoryByName` / `findBrandByName`, and the section-banner comments in the IPC registry
  (CLAUDE.md: no section banners).

### Fixed
- **Saving a product got slower as the catalog grew.** Re-indexing a product for search deleted from FTS5 by an
  unindexed column, which scans the whole index. Each product now has an integer search key (`product_search_key`),
  and saving 5,000 products dropped from 5.7 s to 2.2 s. Audit, outbox and sequence writes also reuse compiled
  statements now.
- **Large IPC inputs no longer land in `audit_log`** — strings over 1,000 characters are stored as `[N chars]`, so an
  uploaded file does not bloat the audit chain.

### Changed — design
- **LLD §2.1**: adds `category`, `brand` and `product_fts`, and states that the selling price lives in the default price
  list, not on `product` ([ADR-0011](decisions/0011-selling-price-in-default-price-list.md)); search normalisation keeps
  Indic vowel signs ([ADR-0009](decisions/0009-product-search-prefix-plus-fts5.md)). Scope decisions for Stage 2 are in
  [ADR-0008](decisions/0008-catalog-device-local-until-sync.md).

### Added
- **`docs/` folder: changelog, architecture overview, build-stage status, ADRs** — the user asked for the project
  to be documented continuously with reasons, not just code. A CI job (`docs`) fails a PR that changes code without
  touching this changelog so the habit cannot lapse.
- **Merged `main` into the branch** — brings in the teammate's `CLAUDE.md` code-style rules and the
  `addyosmani/agent-skills` collection so the branch and main share one set of working rules.

## [Stage 0–1] — Foundation — 2026-09-27

Pull request: https://github.com/thesparselabs/muneem/pull/1

### Changed — design
- **Cloud backend switched from NestJS to Go (Echo)** in PRD, HLD and LLD — team decision. The HLD had chosen NestJS so
  the GST/costing/accounting engines could be literally shared between device and server. With Go they exist twice,
  so the docs now say how equality is *enforced* instead: one golden-vector fixture suite run by both languages, a
  nightly differential fuzz, and one OpenAPI document generating both sides' HTTP types. See [ADR-0001](decisions/0001-go-echo-cloud-with-fixture-contract.md).

### Added — shared foundation (`packages/`)
- **`@muneem/domain` money kernel** (`divRound`, `pctOf`, `apportion`) — money is integer paise and rounding is
  HALF_UP in exactly one place, because NFR-004 forbids float money and two devices must compute the same total.
  `apportion` uses BigInt because a 500-line wholesale invoice overflows 2^53 in `total × weight`. See [ADR-0002](decisions/0002-integer-money-and-shared-numeric-bounds.md).
- **GST engine `computeInvoice`** — LLD §3.1 step order verbatim (inclusive back-calc divides by `10000+gst+cess`;
  `sgst = total − cgst` so halves re-sum; bill discount apportioned before tax; optional rupee round-off to its own
  field; GSTR-1 bucket). Percent discounts are taken in basis points so no float ever enters.
- **89 golden invoices** (19 hand-verified, rest engine-generated then frozen) — the cross-language contract; a diff
  in the fixture file is a behaviour change to review, never something to regenerate to get green.
- **ESLint rule banning `Math.round`, `toFixed` and float division on financial identifiers** in domain code —
  turns a design rule into a build error.
- **`@muneem/contracts`**: zod IPC registry (the preload is generated from it), LLD §17 error taxonomy, resource×action
  permissions with grant limits, concrete role presets (no "optional" grants), OpenAPI 3.0 HTTP contract — one source
  of truth for method shape, permission and rate limit.
- **`@muneem/db-sqlite`**: LLD §2 pragmas on every open, migrator with pre-migration verified backup and rollback,
  Stage 1 schema, append-only triggers on `audit_log`, sha256 hash-chained audit writer, transactional outbox writer,
  repositories where every write is one transaction (row + local sequence + audit + outbox). Outbox rows are written
  from day one because retrofitting them means rewriting the transaction everything depends on (Constraint 8).
  See [ADR-0006](decisions/0006-outbox-from-day-one-sync-worker-in-stage-7.md).
- **`scripts/schema-lint.ts`** fails CI on any REAL/FLOAT/NUMERIC financial column in SQLite or Postgres migrations.
- **`scripts/diff-fuzz.ts`** runs random invoices through the TypeScript and Go engines and fails on a single paise
  of difference; 11,000 cases across three seeds were identical.

### Added — cloud (`cloud/`, Go + Echo)
- Go port of money and GST engines, tested against the *same* fixture files; `cmd/verify-fixture` for the fuzz.
- Postgres migrations (golang-migrate, embedded) with row-level security on every tenant table and least-privilege
  roles (`muneem_api` cannot delete or update audit rows) — NFR-008 multi-tenant isolation as a database guarantee.
- Identity: Argon2id passwords in PHC format (so the desktop can verify the same string offline), HS256 access tokens
  (15 min), rotating refresh tokens with family reuse detection.
- Devices: Ed25519 request signatures, registration idempotent on `installation_id`, revocation.
- Business/branch/terminal endpoints idempotent on the client-minted ULID, so an offline device can create them and
  sync later without duplicates.

### Added — desktop (`apps/desktop`, Electron + React)
- Secure renderer (contextIsolation, sandbox, CSP, navigation denied); preload **generated** from the contract
  registry with a test asserting the exposed surface equals the registry.
- IPC gateway per LLD §10.3: validate → session → RBAC → rate limit → dispatch → audit → envelope; errors carry a
  code and never a stack or SQL text.
- Online login registers the device and caches an Argon2id hash of the entered password; offline login verifies it
  and enforces `max_offline_days`; PIN switch with 5-attempt lockout; `auth.login` falls back to offline when the
  server is unreachable (FR-004).
- Business setup wizard, settings, diagnostics (health, integrity check incl. audit-chain verify, backup, support
  bundle handle, log tail).
- `scripts/crash-loop.ts` — 50 SIGKILLs mid-write left no partial rows; `test/e2e-live.test.ts` — spawns the real Go
  API and proves the Stage 1 exit criterion end to end.

### Fixed — during integration
- Desktop signed requests with an RFC 3339 timestamp while the Go verifier expected unix seconds; would have rejected
  every signed request. Convention now written into the OpenAPI doc and `SYNC_HEADERS`. See [ADR-0003](decisions/0003-device-signature-convention.md).
- Dev Postgres moved from host port 5432 to 5433 — clashed with a locally installed Postgres.
- OpenAPI downgraded 3.1 → 3.0.3 — `oapi-codegen` does not fully support 3.1 and no 3.1 feature was used.
- CI: pnpm version now comes from `package.json` `packageManager` (the action refuses two sources); Go API types are
  generated before `go build` (they are gitignored); Go version is read from `cloud/go.mod` because the module ended
  up on Go 1.26 and setup-go v7 no longer auto-upgrades. See [ADR-0004](decisions/0004-ci-reads-go-version-from-go-mod.md).
- GitHub Actions bumped to Node 24 majors to clear runner deprecation warnings.

### Deferred (deliberately)
- Sync worker (Stage 7): local businesses sit in `sync_outbox`; device registration and login do hit the server.
- Token auto-refresh on 401, Playwright UI test, NSIS installer build, Windows-host validation.
