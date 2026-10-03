# Changelog

All notable changes, newest first. Each entry records **what** changed and **why**. Format follows
[Keep a Changelog](https://keepachangelog.com/); versions are project stages until the first release.

## [Unreleased]

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
