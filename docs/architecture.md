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
  records every outcome and never throws. Printer settings are per device.
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
  adjustments and stock takes (adjustment documents, ADR-0021). Purchases join in Stage 5.
- **Policy** (ADR-0020): `inventory.negativeStock` block / warn / allow, with a per-product override; quotes carry stock
  warnings; a negative sale is audited.
- **Integrity**: Diagnostics and a 6-hourly timer replay the movements against the cache and rebuild any drift.

## Identity and trust

- Cloud is authoritative for users, roles and permissions; the device caches a **permission snapshot** and enforces
  it in the main process, never from the renderer's copy.
- Each installation has an Ed25519 key pair; the private key lives in the OS credential store via Electron
  `safeStorage`. Requests are signed (see ADR-0003).
- Offline login verifies against an Argon2id hash computed on the device from the entered password; the server's hash
  is never sent down.

## What is not built yet

Purchases, payments, accounting, reports and the sync worker. In inventory: transfers, multiple warehouses per branch,
batch/serial tracking and the GL tie-out (Stage 6). In billing: sale cancel, returns/credit
notes, credit sales and manager PIN override (ADR-0013); USB/Windows printers and non-ASCII receipt text. Product
variants, weighed barcodes and label printing are deferred (ADR-0008). See `build-stages.md`.
