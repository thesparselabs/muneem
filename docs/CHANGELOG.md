# Changelog

All notable changes, newest first. Each entry records **what** changed and **why**. Format follows
[Keep a Changelog](https://keepachangelog.com/); versions are project stages until the first release.

## [Unreleased]

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
