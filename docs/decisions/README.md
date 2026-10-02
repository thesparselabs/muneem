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
