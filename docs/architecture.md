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
- Σ party ledger entries = open charges − unallocated settlements, per party (domain property and `reconcilePartiesDb`);
  a settlement never allocates more than it holds and a document is never settled past its amount (triggers + CHECKs);
  an allocation only joins live documents of one party; a debit note never returns more than was bought on a line
- A purchase's total = taxable + taxes + charges + round-off (|round-off| ≤ ₹1); a line's landed value = taxable +
  its charges + tax that cannot be claimed (CHECK); party entries, purchases, debit notes, payments, allocations and
  expenses are append-only apart from status and allocation totals
- A supplier return leaves at its landed cost and replay = projection still holds; an issue that leaves stock on hand
  never takes more than the stock is worth (ADR-0027)
- After repeated SIGKILLs mid-billing: one ledger entry per credit sale and the party ledgers reconcile
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
  adjustments and stock takes (adjustment documents, ADR-0021), purchases at landed cost and supplier returns at
  their own cost (Stage 5, ADR-0023/0024).
- **Policy** (ADR-0020): `inventory.negativeStock` block / warn / allow, with a per-product override; quotes carry stock
  warnings; a negative sale is audited.
- **Integrity**: Diagnostics and a 6-hourly timer replay the movements against the cache and rebuild any drift.

## Parties and purchases (Stage 5)

- **Sub-ledger** (ADR-0022): `party_ledger_entry` is append-only and written only by `postPartyEntry`, in the same
  transaction as its document. Positive means the party owes the business. Documents are charges (credit sales,
  purchases, credit expenses, openings) or settlements (payments, debit notes, write-offs, opening advances).
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
  - **Cancels** post the mirror journal.
- **Accounts** (ADR-0031): LLD §5.1 plus one input and one output account per tax head, seeded with the business. Rules
  name accounts by role. Card/UPI takings wait in 1250 Clearing.
- **Periods** (ADR-0033): calendar months, lockable once ended. A document dated into a locked month posts late into
  the earliest open month, flagged and listed. Purchases post on the supplier's bill date.
- **Tie-outs and integrity** (ADR-0034):
  - **The tie-outs:** 1400 = stock valuation, 1300 = customer balances, 2100 = supplier balances, and each tax account
    = its documents.
  - **The backfill** posts anything saved before Stage 6.
  - **Diagnostics and the 6-hourly timer** rebuild a drifted balance cache and report everything else.
- **Manual journals** (ADR-0035) never touch AR, AP, Inventory or tax accounts, so the tie-outs hold by construction.
- **Statements:** Trial Balance, P&L and Balance Sheet read the journal. Retained earnings are computed until Stage 8's
  closing journal, and customer advances and supplier debits are presented apart.

## Identity and trust

- Cloud is authoritative for users, roles and permissions; the device caches a **permission snapshot** and enforces
  it in the main process, never from the renderer's copy.
- Each installation has an Ed25519 key pair; the private key lives in the OS credential store via Electron
  `safeStorage`. Requests are signed (see ADR-0003).
- Offline login verifies against an Argon2id hash computed on the device from the entered password; the server's hash
  is never sent down.

## What is not built yet

Reports and exports, and the sync worker. In accounting: the year-end closing and opening journals, and GST returns with
set-off (Stage 8). In inventory: transfers, multiple warehouses per branch, batch/serial tracking. In billing: sale
cancel, returns/credit notes and manager PIN override; USB/Windows printers and non-ASCII receipt text. In purchases and
payments: purchase orders and GRN, reverse charge, debit-note cancellation, refunding a customer's advance, payment
reminders, TDS/TCS. Product variants, weighed barcodes and label printing are deferred (ADR-0008). See
`build-stages.md`.
