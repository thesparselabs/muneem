# Stage 8 — Reports, compliance, backup and update: implementation plan

## Context

Stages 0–7 are merged (PR #1, #3–#8). Stage 8 (LLD §20) is "Reports + exports, dashboard, notifications, audit chain
verification, backup/restore, auto-update". Its exit criterion is **restore-to-new-device produces a byte-identical
Trial Balance**. Earlier stages also deferred these to it:
- the year-end closing journals;
- GST returns with set-off (ADR-0033, 0035);
- attachments (FR-075);
- typed cloud report tables;
- payment reminders, with consent (ADR-0026);
- exports and printing of statements and party reports.

**What already exists** (research by three agents, 2026-10-04):
- **Reports:** statements, books and ledgers (Stage 6), party ledgers and outstanding with ageing (Stage 5), X/Z
  reports (Stage 3), stock valuation, low stock and reconciliation (Stages 4 and 7), and document lists.
- **Exports:** none. CSV and XLSX exist only for import.
- **Backups:** `diagnostics.backupNow` writes an unencrypted SQLite copy every 6 hours, with no retention and no
  upload. Restore is only the DB-corrupt dialog at start-up, and `restoreDatabaseFile` leaves stale `-wal`/`-shm`
  files behind (a likely bug).
- **Audit chain:** `verifyAuditChain` runs in Diagnostics. Device audit rows never reach the cloud.
- **Updates:** `electron-builder.yml` names a generic update URL, but there is no `electron-updater`. Stage 7 shows
  "update required" when the cloud refuses a protocol.
- **Restore groundwork:** Stage 7f hydration already rebuilds a device from the cloud, and tests compare books and
  Trial Balances.
- **GST data:** every sale stores its doc type, place of supply, supply type, GSTR-1 bucket, tax heads and line HSN.
  Purchases store ITC eligibility and place of supply; debit notes their ITC reversal; expenses their vendor GSTIN and
  ITC. Accounts 1600 GST Credit Ledger, 2300 GST Payable and 3300 Retained Earnings are seeded but unused.
- **Year end:** document series are keyed by FY, so the series reset already happens.

**What the designs leave open:**
- the GSTR-3B table mapping;
- the set-off order and its document;
- GST export formats (deferred by FR-094);
- how closing is triggered and what happens to late postings after it;
- who holds the backup key (FR-071 clarification);
- protocol support: N−2 (FR-105) or N and N−1 (LLD §7).

**Decisions (user, 2026-10-04):**
- **Compliance:** year-end close **and** GST returns (GSTR-1, HSN summary, documents issued, GSTR-3B, ITC register)
  with a set-off and payment document, exported as CSV and XLSX (portal JSON later). **Sale returns and credit notes
  are built**, so GSTR-1's credit-note sections are real.
- **Backups:**
  - **Local copies** are encrypted, kept by a retention rule, and can be restored from a screen.
  - **Cloud copies:** a nightly encrypted SQLite backup uploads to object storage, with **the key escrowed by the
    cloud**.
  - **Restore to a new device** is Stage 7 hydration; the SQLite backup is the fallback.
- **Notifications:** an **in-app notification centre** now. DPDP consent is captured on customers now; SMS and
  WhatsApp reminders come later.
- **Updates:** the **full updater**:
  - `electron-updater` with signed manifests;
  - dev, beta and stable channels, with a staged rollout by cohort;
  - resumable downloads;
  - a pre-migration backup with automatic rollback;
  - the cloud supports protocols N and N−1, checked by a contract test.

## Design (ADRs written in 8a)

- **ADR-0043 — Returns and credit notes.**
  - **What a return is:** a return against a posted sale is a `credit_note` document. It has its own per-terminal
    series and references the original sale and lines.
  - **Limits:** the quantity returned is capped at what was sold less what was already returned.
  - **What it writes:**
    - stock comes back at the sale line's stored cost;
    - a party credit for credit sales, or a refund tender otherwise;
    - a journal mirroring the sale's for the returned part (sales returns, output tax, COGS reversal);
    - a GSTR-1 bucket of CDNR or CDNUR.
  - **Cancelling a sale** is a full credit note on the same day. A sale is never deleted.
- **ADR-0044 — GST returns and set-off.**
  - **Reading from documents:** GSTR-1 buckets are aggregated **per line** (nil, exempt and non-GST lines leave
    mixed invoices). The HSN summary carries UQC, documents issued come from the series, and the GSTR-3B summary
    covers 3.1(a)(c)(e), 4A/4B/4D and 5.
  - **Checking against the books:** the returns reconcile with the tax accounts (ADR-0034's tie-out).
  - **Set-off:** a `gst_setoff` document per month moves output tax against input tax in the statutory order: IGST
    credit first to IGST, then CGST, then SGST; CGST credit to CGST then IGST; SGST to SGST then IGST; cess only to
    cess. The balance moves to 2300 GST Payable.
  - **Payment:** a `gst_payment` document clears 2300 from the bank.
  - **Locking:** both are refused once the month is locked, and they never touch AR, AP or Inventory.
- **ADR-0045 — Year-end close.**
  - **The closing journal:** an `fy_close` document is business-wide, keyed by (business, fy), and cloud-authoritative
    on the control stream like periods. It posts one closing journal dated 31 March: each income and expense account
    to 3300 Retained Earnings.
  - **No opening journal:** the ledger is continuous, so balance-sheet accounts need none.
  - **Statements:** they stop computing earlier years' profit for closed years, and a closed year's P&L leaves out
    its closing journal, so prior-year reports stay readable.
  - **Late postings:** a document posting late into a closed FY (via ADR-0033) gets an **adjusting closing journal**
    for that FY, and a review item.
- **ADR-0046 — Reports and exports.**
  - **Definitions:** a `ReportDefinition` registry (LLD §14) gives each report its params schema, a run function,
    columns and totals.
  - **Where they run:** on a read-only SQLite connection in a `reports` utility process, streamed and cancellable.
  - **Exports:** CSV (UTF-8 BOM), XLSX (one maintained library) and PDF (printed from a hidden window), all through
    one writer interface.
  - **Source:** device reports read local data. The cloud gains typed daily aggregates for future owner reports
    (Stage 7 carry), and FR-103's cloud fallback outside the retention window waits for Stage 9.
- **ADR-0047 — Backups and key escrow.**
  - **Format:** a backup is the online-backup SQLite copy, `quick_check`ed and encrypted with AES-256-GCM using a
    per-business data key. A signed manifest records the hash, schema version and row counts.
  - **The key:** generated on first backup, kept in the OS credential store, and escrowed to the cloud. The cloud
    stores it wrapped by a server master key, from env/KMS.
  - **Retention:** 7 daily, 4 weekly and 3 monthly backups locally; the cloud keeps the last 30.
  - **Restore order:** first a local backup, then a cloud backup (fetch the escrowed key, download, verify, swap),
    then hydration.
- **ADR-0048 — Audit chain on the cloud.**
  - **Upload:** audit rows sync as an append-only `audit_entry` stream.
  - **Verification:** the cloud verifies each device's chain on ingest (`seq` with no gaps, `prev_hash` linkage,
    recomputed hash). A break is `AUDIT_CHAIN_BROKEN`: the batch is refused, dead-lettered and alerted, and the device
    shows it.
  - **On the device:** Diagnostics verifies on demand and every 6 hours.
- **ADR-0049 — Updates and protocol support.**
  - **Updates:** a generic-provider `electron-updater` with a signed `latest.yml` per channel.
  - **Staged rollout:** the cohort is a stable hash of the installation id, against the rollout percentage in the
    manifest.
  - **Installing:** the download resumes. The install happens on restart, after a pre-migration backup, and a failed
    migration restores it and reports.
  - **Protocols:** the cloud accepts sync protocols N and N−1 (LLD §7, which takes precedence over FR-105's N−2), and
    a contract test runs the previous protocol's fixtures against the current server.
- **ADR-0050 — Notifications and consent.**
  - **Storage:** notifications are local rows (kind, severity, entity, message, read/dismissed) raised by triggers.
    The triggers are:
    - low stock;
    - customer and supplier dues;
    - sync blocked;
    - backup failed or stale;
    - audit chain broken;
    - late arrivals;
    - update ready.
  - **Consent:** customers carry DPDP consent (purpose, channel, given at, withdrawn at), with profile export and
    erasure that keeps statutory invoices.
  - **Later:** SMS and WhatsApp sending is designed but not built.

## Parts (one commit each; details below, written before building)

| Part | What | Who |
|---|---|---|
| 8a | ADRs 0043–0050, the report and export foundation, the restore WAL fix | lead |
| 8b | Sale returns and credit notes (device, sync payloads, Go verification) | agent "billing" |
| 8c | GST returns, set-off and payment documents, exports | agent "gst" |
| 8d | Year-end close | agent "gst" (after 8c) |
| 8e | Reports catalogue and dashboard | agent "reports" |
| 8f | Backups: encryption, retention, cloud upload with key escrow, restore UI | agent "platform" |
| 8g | Audit chain on the cloud | agent "platform" (after 8f) |
| 8h | Notifications and consent | agent "reports" (after 8e) |
| 8i | Auto-update and protocol N/N−1 | agent "platform" (after 8g) |
| 8j | Exit: restore-to-new-device byte-identical TB, speed at scale, close-out | lead |

**Phases** (at most two agents at a time, with the Stage 7 load rules: `nice`, vitest `--maxWorkers=2`, no 365-day
soak, a load watchdog):
1. 8a, by the lead;
2. 8b beside 8f;
3. 8c beside 8e;
4. 8d beside 8g;
5. 8h beside 8i;
6. 8j, by the lead.

## Part details

### 8a — Foundations (lead)
- **ADRs:** 0043–0050, as in Design.
- **`packages/reports`** (or `apps/desktop/src/main/reports/`):
  - a `ReportDefinition` type and a registry;
  - a runner on a **read-only** better-sqlite3 connection, with paging and cancellation;
  - export writers (`CsvWriter`, `XlsxWriter`, `PdfWriter`) behind one interface, with tests on golden outputs;
  - IPC `reports.listDefinitions`, `reports.run` and `reports.export`, which returns a file handle saved through a
    dialog.
- **The restore WAL fix:** `restoreDatabaseFile` removes `-wal` and `-shm` before the swap. A test restores over a
    database with a live WAL.
- **Pre-migration backups** write a `backup_log` row.

### 8b — Sale returns and credit notes (agent "billing")
- **Schema:** migration for `sale_return` links, or reuse of `sale` with `doc_type='credit_note'` and
  `original_sale_id` (the columns exist). Pick one in 8a's ADR-0043 and follow it.
- **Domain:** a `computeReturn` that mirrors the GST engine for the returned quantities, keeping each line's
  original tax snapshot, plus golden vectors. **Go port:** verification of credit notes in `verify/`, with the
  shared fixtures extended.
- **Services:**
  - `returns.quote` and `returns.complete`: by line or whole bill, with a refund tender (cash/UPI/card) or a credit
    to the customer.
  - `sales.cancel`: a full return on the same day, with a manager permission and a reason.
  - Stock comes back at the stored cost; a party credit note entry; the journal via a new `SALE_RETURN_RULE`.
- **Credit-note series** per terminal (letter `C`), printing a credit note receipt.
- **Sync:** the payload schema and the census, the reference server's verify, and Go verification.
- **Tie-outs and the crash suite** are extended.
- **Screens:** "Return / cancel" from the sale list and receipt search, and a return dialog.

### 8c — GST returns, set-off, payment (agent "gst")
- **The builder** (`packages/domain/src/gst/returns/` with pure functions; queries in db-sqlite):
  - GSTR-1: b2b by GSTIN and invoice, b2cl, b2cs by state and rate, cdnr and cdnur (from 8b), exports, nil/exempt
    and non-GST at line level, the HSN summary with UQC, and documents issued.
  - GSTR-3B: 3.1, 4 and 5, and the ITC register.
- **Product data:**
  - HSN is required for regular businesses on new products, with a warning on existing ones, plus a UQC map per
    unit.
  - The B2CL threshold becomes an effective-dated setting.
- **Documents:**
  - `gst_setoff` follows ADR-0044's order, through domain functions with property tests.
  - `gst_payment` posts from the bank.
  - Both sync like documents (payloads, reference verify, Go verify of the set-off order and balance).
- **Reconciliation:** each month's return totals = the tax account movements, as a tie-out.
- **Screens:** GST → Returns (month picker, sections, totals, CSV/XLSX export of each section in the offline tool's
  column order), Set-off (preview, post), and Payment.

### 8d — Year-end close (agent "gst", after 8c)
- **The document:** an `fy_close` keyed by (business, fy). It needs a manager permission, every month of that FY
  locked, and every GST set-off posted.
- **The closing journal:** posted with a source of `closing`, dated 31 March.
- **Sync:** it travels as control, Go verifies the journal, and it can only be posted once per (business, fy).
- **Statements:** they respect closings (retained earnings, and a closed FY's P&L leaves out its closing journal).
- **Late postings** into a closed FY raise an adjusting closing journal and a review item, through ADR-0033's path.
- **Tests:** a two-year soak run closes FY1, the books still balance, the prior-year P&L is unchanged, and a late
  document re-closes.

### 8e — Reports catalogue and dashboard (agent "reports")
- **Definitions** for FR-054 and PRD §25, on the 8a engine:
  - sales by day, product, category and payment method;
  - purchases;
  - expenses;
  - receivables and payables as of a date, with ageing (closing the Stage 5 carry);
  - stock valuation and movement;
  - cash and payment reports;
  - day-end and monthly sales;
  - product profit;
  - GST summary (linking to 8c);
  - all statements and ledgers from Stage 6.

  Each has date and branch filters and exports to CSV, XLSX and PDF. **Printed headers** carry the business, GSTIN,
  period and generated time.
- **Dashboard (FR-072, offline):** today's sales, purchases, cash, UPI and credit, receivables and payables, low
  stock, top sellers, expenses and profit indicators, with a 30-day trend and payment-split charts.
  - **Speed:** it is served from `daily_sales_summary`, `daily_payment_summary` and `product_sales_daily`, written in
    the sale, payment and return transactions, with a rebuild check. The budget is under 300 ms at 200k sales.
- **Cloud typed tables** (Stage 7 carry): the same daily aggregates and `party_outstanding`, projected from
  `entity_state` on ingest, with a read endpoint `GET /reports/daily?businessId&from&to` and a test. There is no web UI
  in Stage 8.
- **Screens:** Reports (catalogue, params, table with totals, export or print) and Home (the dashboard).

### 8f — Backups (agent "platform")
- **Encryption:**
  - AES-256-GCM in streaming chunks (Node `crypto`) with a per-business data key in the OS secret store.
  - A manifest {hash, schemaVersion, rowCounts, createdAt, deviceId}, signed with the device key.
  - Decryption verifies the tag and the manifest before restore.
- **Retention:** 7 daily, 4 weekly and 3 monthly, pruned after each backup. `backup_log` covers every kind,
  pre-migration included.
- **Cloud:**
  - `objectstore.PresignPut` and `POST /backups/presign`, `/backups/confirm` (checksum), `GET /backups`, and
    `GET /backups/{id}` (presigned GET);
  - `POST /backups/key` escrows the data key, wrapped by `MUNEEM_BACKUP_MASTER_KEY`, and a member's device can fetch
    it back;
  - the cloud keeps 30 per business.
- **Upload:** in the utility process, resumable, nightly and after a Z report, with the status in Diagnostics.
- **Restore UI** (Diagnostics → Backups):
  - list local and cloud backups, verify, and "Restore" (it confirms, takes a safety backup of the current
    database, swaps, and restarts);
  - from setup on a new device, "Restore from cloud backup" next to Stage 7's "Add this device".
- **Monitoring (NFR-010/011):** backup health: last success, age, last error.
- **Tests:**
  - encrypt and decrypt round trips and tamper detection;
  - retention pruning;
  - restore over a live WAL;
  - a Go test of escrow and presign;
  - an end-to-end test of upload, then restore on a fresh device with books equal.

### 8g — Audit chain on the cloud (agent "platform", after 8f)
- **Device:** audit rows enter the outbox as `audit_entry` operations (append-only, per device, in seq order), on a
  new `audit` stream that is push-only and never pulled.
- **Cloud:** migration `audit_entry` (business, device, seq, prev_hash, hash, row). Ingest verifies `seq` continuity
  and the hash recomputed over the canonical JSON (a Go port of `canonicalJson` with shared fixtures). A break gets
  `AUDIT_CHAIN_BROKEN`, a dead letter and an alert, and the device turns blocked with a Diagnostics entry.
- **Device verification:** on demand and every 6 hours. A `diagnostics.verifyAudit` report lists breaks.
- **Tests:** a tampered row is caught on both sides, a gap is caught, and a resend is idempotent.

### 8h — Notifications and consent (agent "reports", after 8e)
- **Storage and triggers:**
  - a `notification` table and a `NotificationService` with idempotent raise-or-update per (kind, entity), run by
    triggers;
  - the triggers come from repository hooks or the 6-hourly timer, as each fits;
  - a renderer notification centre (bell, list, mark read, deep links) and `notifications.*` IPC;
  - a `notification.new` event.
- **Consent:**
  - customer fields (purpose `payment_reminders`, channel `sms|whatsapp`, given_at, withdrawn_at, captured_by), synced
    as part of the customer;
  - `customers.exportProfile`, and `customers.erase`, which anonymises the profile and keeps invoices and their
    snapshot GSTIN as the law requires.
- **Later:** the reminder sender is designed (cloud worker, templates), not built.

### 8i — Auto-update (agent "platform", after 8g)
- **The updater:** `electron-updater` (generic provider) behind an `Updater` interface.
  - **Channels** from settings, and the **staged rollout cohort** from the installation id.
  - **Download** in the background, resumable, with progress events.
  - **Install** on restart. **Never mid-sale:** it waits for an idle POS and a closed or idle register.
- **The migration guard:** before migrating, take a backup (8f), then run `quick_check`, migrate in one transaction,
  `foreign_key_check`, and row counts. A failure restores the backup, reports, and keeps the old version.
- **Release tooling:** `scripts/release-manifest.ts` writes a signed `latest.yml` per channel with a rollout
  percentage. A dev update server (a static folder) serves tests.
- **Protocol N/N−1:** the cloud accepts `X-Sync-Protocol` N and N−1, with the minimum in config. The previous
  protocol's fixtures are kept and replayed in a Go contract test.
- **Tests:** cohort selection, the update gate waiting for idle, migration-failure rollback (a broken migration
  fixture), and the protocol contract.

### 8j — Exit and close-out (lead)
- **The exit test** (`test/exit/restoreTrialBalance.test.ts`, plus a Go-backed variant in `e2eCloud`):
  1. Device A trades: the soak generator, returns, GST set-off and payment, and an FY close.
  2. A new device B restores from the cloud (hydration), and C from the cloud SQLite backup.
  3. The Trial Balance as of several dates, **serialised to canonical JSON**, is **byte-identical** on A, B, C and
     the cloud.
- **Speed at scale:** at 200k sales, 20k SKUs and 50k customers, the dashboard is under 300 ms, and report runs and
  exports are measured.
- **Close-out:** the as-built notes, architecture (Reports, Compliance, Backup and Update sections), build-stages
  evidence, the CHANGELOG, and the manual checklists for the new screens.

## Verification
- **The exit:** the byte-identical Trial Balance across devices and the cloud, after a restore by hydration and by
  cloud backup.
- **GST:** GSTR-1 and GSTR-3B totals equal the tax account movements each month. The set-off follows the statutory
  order (property tests). Credit notes appear in CDNR and CDNUR.
- **Year end:** closing keeps the Balance Sheet balanced and prior-year P&L readable, and a late posting re-closes.
- **Backups:** an encrypted backup round-trips, tampering is detected, and restore works over a live WAL.
- **Audit:** a tampered or gapped chain is caught on the device and the cloud.
- **Updates:** a failed migration rolls back, and the cloud accepts N and N−1.
- **Regression:** the existing suites, simulation, §37 and e2e-cloud still pass.

## Carried to later stages
- **Messaging:** SMS and WhatsApp sending and template approval.
- **E-invoicing:** e-invoice (IRN) and e-way bill (FR-048/049, deferred out of the MVP).
- **GST portal:** JSON export and GSTR-4/CMP-08 for composition businesses.
- **Purchases:** reverse-charge purchases.
- **Cloud web:** the owner reports web UI and FR-103 retention pruning with a cloud fallback.
- **Attachments** (FR-075) move to Stage 9 unless 8f's object-storage work makes them cheap; that is decided at 8f.
