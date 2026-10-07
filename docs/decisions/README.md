# Architecture Decision Records

One file per decision, numbered, never edited after acceptance (write a new ADR that supersedes it).
Template: Context → Decision → Consequences → Status.

| # | Decision |
|---|---|
| [0001](0001-go-echo-cloud-with-fixture-contract.md) | Cloud in Go/Echo; engine equality enforced by shared fixtures |
| [0002](0002-integer-money-and-shared-numeric-bounds.md) | Integer paise, one rounding primitive, identical numeric bounds in TS and Go |
| [0003](0003-device-signature-convention.md) | Device request signature: unix-seconds timestamp, Ed25519 over METHOD/PATH/TS/body-hash |
| [0004](0004-ci-reads-go-version-from-go-mod.md) | CI takes the Go version from `cloud/go.mod` |
| [0005](0005-local-device-id-is-installation-id.md) | Local `device_id` is the installation id; cloud id kept separately |
| [0006](0006-outbox-from-day-one-sync-worker-in-stage-7.md) | Outbox rows written from Stage 1; the worker waits for Stage 7 |
| [0007](0007-openapi-single-source-for-http-types.md) | One OpenAPI 3.0 document generates Go and TS HTTP types |
| [0008](0008-catalog-device-local-until-sync.md) | Catalog is device-local until Stage 7; variants, weighed barcodes and labels deferred |
| [0009](0009-product-search-prefix-plus-fts5.md) | Product search: `name_norm` prefix index plus a repository-maintained FTS5 table |
| [0010](0010-product-import-two-phase.md) | Product import: file bytes over IPC, preview in memory, one-transaction commit |
| [0011](0011-selling-price-in-default-price-list.md) | Selling price lives in the default price list, not on `product` |
| [0012](0012-hot-path-statement-cache-and-barcode-lru.md) | Cached prepared statements and a barcode LRU for the scan path |
| [0013](0013-stage-3-commit-scope-and-step-seam.md) | The Stage 3 sale commit, with seams for stock and journal |
| [0014](0014-document-numbering-per-terminal.md) | Invoice numbering: one series per terminal and FY, created on first use |
| [0015](0015-print-job-inside-commit-hardware-after.md) | The print job is part of the sale; printing and the drawer happen after commit |
| [0016](0016-renderer-totals-main-is-authoritative.md) | The renderer shows totals instantly; the main process is authoritative |
| [0017](0017-tenders-and-register-sessions.md) | Tender rules and register sessions |
| [0018](0018-inventory-ledger-and-costing.md) | Inventory ledger and moving-average costing |
| [0019](0019-stock-step-in-the-sale-commit.md) | Where stock happens in the sale commit (supersedes ADR-0013's placement) |
| [0020](0020-negative-stock-policy.md) | Negative stock policy |
| [0021](0021-warehouses-opening-adjustments-stock-take.md) | Warehouses, opening stock, adjustments and stock take |
| [0022](0022-party-sub-ledger.md) | The party sub-ledger |
| [0023](0023-purchase-invoice-and-landed-cost.md) | Purchase invoice and landed cost |
| [0024](0024-supplier-returns-and-cancellation.md) | Supplier returns and cancelling a purchase |
| [0025](0025-payments-allocation-expenses-write-off.md) | Payments, allocation, advances, write-offs and expenses |
| [0026](0026-customer-credit-at-the-pos.md) | Customer credit at the POS |
| [0027](0027-issue-cost-by-share-of-value.md) | An issue takes its share of the value, not a rounded average (amends ADR-0018) |
| [0028](0028-document-numbers-with-kind-letter.md) | Numbers for purchases, debit notes and other documents |
| [0029](0029-payments-drawer-and-who-may-pay.md) | Cash payments and the drawer, and who may pay suppliers |
| [0030](0030-journal-and-posting-engine.md) | The journal and the posting engine |
| [0031](0031-chart-of-accounts-and-posting-accounts.md) | Chart of accounts and the accounts each posting uses |
| [0032](0032-posting-matrix-as-built.md) | The posting matrix as built (for CA review) |
| [0033](0033-posting-dates-periods-late-postings.md) | Posting dates, periods and late postings |
| [0034](0034-tie-outs-backfill-integrity.md) | Tie-outs, backfill and integrity |
| [0035](0035-manual-journals-and-control-accounts.md) | Manual journals and control accounts |
| [0036](0036-statements-read-the-balance-cache.md) | Statements read the balance cache for whole months |
| [0037](0037-who-numbers-a-journal.md) | Who numbers a journal, and when a terminal is needed |
| [0038](0038-cloud-storage-for-synced-entities.md) | Cloud storage for synced entities |
| [0039](0039-device-identity-on-the-wire.md) | Device identity on the wire, and businesses created offline |
| [0040](0040-applying-pulled-documents.md) | Applying another terminal's documents |
| [0041](0041-conflict-matrix-as-built.md) | The conflict matrix as built |
| [0042](0042-how-sync-is-tested.md) | How sync is tested |
| [0043](0043-returns-and-credit-notes.md) | Returns and credit notes |
| [0044](0044-gst-returns-and-set-off.md) | GST returns and set-off |
| [0045](0045-year-end-close.md) | Year-end close |
| [0046](0046-reports-and-exports.md) | Reports and exports |
| [0047](0047-backups-and-key-escrow.md) | Backups and key escrow |
| [0048](0048-audit-chain-on-the-cloud.md) | Audit chain on the cloud |
| [0049](0049-updates-and-protocol-support.md) | Updates and protocol support |
| [0050](0050-notifications-and-consent.md) | Notifications and consent |
| [0051](0051-production-topology.md) | Production topology |
| [0052](0052-keys-and-rotation.md) | Keys and rotation |
| [0053](0053-observability.md) | Observability: metrics, business-health probes, logs, alerts and crash reports |
| [0054](0054-pilot-health-measures.md) | What "zero lost, zero unexplained" means for the pilot |
| [0055](0055-windows-printing.md) | Windows printing: spooler RAW jobs, an image fallback, and ₹ and Indic text as raster lines |
| [0056](0056-release-and-installer.md) | Release and installer: CI-built, Azure-signed, promoted between channels without a rebuild |
| [0057](0057-operator-tooling.md) | Operator tooling: operator grants and tokens, the muneem_admin role (addendum to 0051), the admin listener |
| [0058](0058-heavy-reads-off-the-billing-thread.md) | Heavy reads off the billing thread: a read worker for reports and integrity checks; quick_check after an unclean exit only |
| [0059](0059-per-unit-cess-inside-inclusive-prices.md) | Per-unit cess inside a tax-inclusive price |
| [0060](0060-damaged-database-recovery.md) | Recovering from a damaged database at start-up: keep the file, restore and catch up, or start empty and restore from the cloud |
| [0061](0061-renderer-micro-interactions.md) | Micro-interactions, icons and a token layer in the renderer: own the source, motion that explains, reduced motion honoured |
| [0062](0062-landing-site-in-monorepo.md) | A marketing landing site as a standalone Vite app in the monorepo, reusing existing deps |
| [0063](0063-invoice-templates-and-branded-pdf.md) | Invoice templates & branded PDF: an `invoice.*` namespace, 10 A4/thermal templates, branding as a setting, page sizes, Electron printToPDF |
| [0064](0064-whispr-theme-fullscreen-onboarding.md) | Whispr (tweakcn) light/dark theme, full-screen token-based layouts, icons, and a custom onboarding tour |
| [0065](0065-help-manual-and-dashboard-periods.md) | In-app EN/HI manual + help drawer, and a Today/Week/Month dashboard with more KPIs and SVG charts |
| [0066](0066-party-import-and-screen-exports.md) | Customer/supplier file import, exports on every list via the report catalogue, import format help, icon-only universal actions |
