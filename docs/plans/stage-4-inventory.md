# Stage 4 — Inventory: implementation plan

## Context

Stages 0–3 are merged (PR #1, #3, #4). Stage 4 (LLD §20) is "Inventory: movements, projections, costing, adjustments,
low stock"; exit criterion **`replay = projection` property green; valuation ties to inventory account**. The design
gives the movement/level DDL (LLD §2.3), the moving-average algorithm (LLD §4.1) and the signed-movement rule (C-1),
but has no warehouse table, no adjustment document, no place for the negative-stock policy or provisional-cost
correction, and its average-cost clamp breaks "Σ movement value = stock value" unless movements record exact deltas.
The sale commit today has a seam for a stock step (ADR-0013), but `sale_item` is append-only, so cost must be known
before the lines are written.

**Decisions (user, 2026-10-02):**
- **No back-fill.** Stock starts from an opening count (manual or CSV/XLSX); sales made before Stage 4 stay as they
  are, with no movements.
- **Valuation:** Stage 4 proves the inventory sub-ledger — valuation report = Σ movement values = Σ stock levels — and
  stores every value the journal will need (COGS per sale line, adjustment values, cost corrections). Stage 6 posts
  them and adds the GL tie-out to account 1400.
- **Scope extras:** stock take (count screen), opening stock import, stock ledger screen + valuation report, stock in
  POS (on-hand in search, warning or block on negative).
- **Negative stock:** default **warn and allow** (FR-088); per-product override.

Delivery as before: plan copied to `docs/plans/stage-4-inventory.md`, branch `feat/stage-4-inventory`, parts 4a–4f as
commits, each green with a CHANGELOG line; nothing pushed until the user reviews.

## Design (ADRs 0018–0021)

| ADR | Decision |
|---|---|
| 0018 Inventory ledger and costing | `stock_movement` is the source of truth; `stock_level` is a cache updated in the same transaction by one repository function (`postMovement`). Moving weighted average per (product, warehouse) in integer paise, exactly LLD §4.1, as a pure `@muneem/domain` engine. **Each movement stores the exact change it made to the level's value** (`value_paise` = value after − value before), so the clamp at zero and negative-quantity revaluation never leave residue: Σ movement value = level value always, and replaying movements through the engine reproduces each level and each stored delta. Issues at qty ≤ 0 use the last known unit cost (`stock_level.last_unit_cost_paise`, else product purchase price, else 0) and are marked `cost_provisional`. The next receipt books the difference for the units that were negative as a **`cost_correction` movement** (quantity 0, value only), which Stage 6 posts as COGS ↔ Inventory. Quantities in base units. Valuation sub-ledger now; GL tie-out in Stage 6. |
| 0019 Stock step in the sale commit (supersedes ADR-0013's step placement) | Order becomes number → **cost** (compute issue cost per line from the level, apply the negative-stock policy) → document (sale lines written with `unit_cost_paise`/`cogs_paise`, sale `cogs_paise`) → **stock** (movements + levels) → receipt → record. The sale's outbox aggregate includes its movements. Sales from before Stage 4 have no movements and are not back-filled. |
| 0020 Negative stock policy | Business setting `inventory.negativeStock` = `block` / `warn` / `allow` (default `warn`). `product.allow_negative_stock`: 1 = always allow, 0 = always block, NULL = business policy. `sales.quote` returns per-line stock warnings; `block` turns them into issues and the commit refuses with `STOCK_INSUFFICIENT`. A sale that takes any level negative writes a `stock.negative` audit row in the same transaction. |
| 0021 Warehouses, opening stock, adjustments, stock take | One default warehouse per branch, created on first use (multi-warehouse and transfers stay deferred; schema keeps `warehouse_id`). Opening stock is a document per warehouse, allowed only for products with no movements yet (later changes are adjustments). Adjustments are documents (`stock_adjustment` header + movement lines) with a reason per line (damage, theft, expiry, counting error, other), at current average cost, permission `inventory.adjust`, audited. A stock take records counted quantities and posts one adjustment of kind `stock_take` for the differences against the level at commit time. Low stock = on hand ≤ reorder level. |

## Schema — migration `0005_inventory`

- `warehouse` (business, branch, code, name, is_default; sync columns; one default per branch).
- `stock_movement` (LLD §2.3 + sync columns, `warehouse_id` FK, `cost_provisional` 0/1; `movement_type` adds
  `cost_correction`; CHECK qty ≠ 0 except `cost_correction`; `ref_type` in sale/opening/adjustment/stock_take/
  purchase/…; unique `(business, ref_type, ref_id, COALESCE(ref_line_id,''), movement_type)`; append-only triggers).
- `stock_level` (LLD + `last_unit_cost_paise`; PK business/warehouse/product/variant `''`).
- `stock_adjustment` (header: warehouse, kind `adjustment|stock_take|opening`, note, created by/at, sync columns;
  append-only).
- `batch` table created schema-ready (no API; batch/serial deferred).

## Existing code to reuse

- `divRound`, `toBaseQty` (`packages/domain`); `withTransaction`, `stmt`, `recordChange`/`queueChild`
  (`packages/db-sqlite/src/repositories/catalogWrite.ts`); `PosContext` (till, settings, permissions) and
  `SETTING_SCHEMAS` (`packages/contracts/src/ipc/settings.ts`) for `inventory.negativeStock`.
- Sale commit steps (`apps/desktop/src/main/services/pos/saleCommit.ts`), `SalePricing` quote issues
  (`salePricing.ts`), `QuoteLine.baseQtyMilli` (already computed).
- Import pipeline (`apps/desktop/src/main/services/import/`: `tableReader`, `columnMapping`, `PreviewStore`) for the
  opening-stock import.
- Crash suite (`apps/desktop/test/crash/`), perf tests (`test/perf/`), golden flow (`test/goldenFlow.test.ts`).
- `diagnostics.integrityCheck` for the replay check; `ProductHit` / `hitByBarcode` for on-hand in POS.

## IPC surface

`inventory.getStock / getMovements / valuation / listLowStock / setOpeningStock / adjust / stockTake /
rebuildProjections / importOpeningPreview / importOpeningCommit / listWarehouses` (view: `inventory.view`; writes:
`inventory.adjust` or `inventory.create`; rebuild: `inventory.manage`). `ProductHit` gains `stockMilli`;
`SaleQuote` gains `warnings`.

## Parts (tests first; one commit each)

**4a — Costing engine, schema, docs**
1. `@muneem/domain` `inventory/costing.ts`: `receive(level, qty, value)`, `issue(level, qty, fallbackCost)`,
   `correct` — return new level + exact value delta + unit cost + provisional flag + correction. fast-check
   properties: **replay(movements) = projection** (fold of the engine over any sequence equals the incrementally kept
   level), Σ deltas = final value, value is 0 whenever qty is 0, issue cost never negative.
2. Migration `0005_inventory` + triggers; migration tests (append-only, uniqueness, CHECKs).
3. ADRs 0018–0021, `docs/plans/stage-4-inventory.md`, build-stages (Stage 3 → Done (PR #4), Stage 4 → In progress),
   LLD §2.3/§4.1 notes where the build differs.

**4b — Ledger repository and the sale's stock step**
4. `postMovement` (insert movement + update level atomically, through the engine), `ensureDefaultWarehouse`,
   `rebuildStockLevels(productIds?)`, `replayCheck` (compare cache vs replay; report drift).
5. Sale commit: cost step + stock step (ADR-0019); negative-stock policy and quote warnings; `stock.negative` audit.
   Tests: sale reduces stock and records COGS on lines and header; block policy → `STOCK_INSUFFICIENT`; warn →
   warning + sale saved + audit row; provisional cost then correction on the next receipt; a failure leaves no
   movement.
6. Kill -9 suite asserts every sale since Stage 4 has one movement per line and replay = projection after the kills;
   perf test keeps `sales.complete` p95 < 250 ms with the stock step.

**4c — Opening stock, adjustments, stock take**
7. `InventoryService`: opening stock (refused for products with movements), adjustments with reasons, stock take
   (differences against level at commit), all audited and outboxed. Opening-stock import (SKU/barcode/name, qty,
   unit cost) reusing the Stage 2 import reader, mapping and preview store; preview errors per row, one-transaction
   commit.

**4d — Queries, POS stock, integrity**
8. `getStock`, `getMovements` (running qty/value, keyset paging), `valuation` (per product qty, avg cost, value;
   totals; sub-ledger check Σ movements = Σ levels), `listLowStock`. `ProductHit.stockMilli`; quote warnings.
   `diagnostics.integrityCheck` includes the stock replay; the 6-hourly backup timer also runs it; drift is logged
   as `STOCK_PROJECTION_DRIFT` and healed by rebuild.

**4e — Screens**
9. `/inventory`: stock list with low-stock filter and badges; product stock ledger (movements, running qty and value);
   adjust stock (lines + reasons); stock take (filter by category, enter counts, review differences, post); opening
   stock (manual grid + import from file); valuation report. POS: on-hand in search results and cart, warning banner
   or block message per policy. Home: low-stock card. Enable the Inventory nav item. Pure helpers (count diffs,
   ledger running totals) with node tests.

**4f — Close-out**
10. Golden flow extended: opening stock → sale → stock and valuation checked. Docs: build-stages Stage 4 → Done with
    numbers, architecture (Inventory section + invariants), LLD §10.2 surface, CHANGELOG, plan "as built".

## Verification

- `pnpm turbo run gen build typecheck lint test`, `pnpm schema-lint`, Go job green.
- Exit criterion evidence: domain property `replay = projection` (fast-check), DB-level replay check after the sale,
  adjustment and stock-take tests, kill -9 suite with replay check; valuation report = Σ movement values = Σ levels
  in tests (GL tie-out recorded as a Stage 6 item).
- **9j:** the manual step below moved to [docs/qa/manual-checklist.md](../qa/manual-checklist.md) (Inventory), where it is automated or kept manual with results.
- Manual (`pnpm --filter @muneem/desktop dev`): enter opening stock, sell, see stock fall and the ledger line; sell
  past zero and see the warning; do a stock take; check valuation and low stock.

## As built (2026-10-02)

- The costing engine's movements record the exact value change they made; LLD §4.1's clamp otherwise leaves residue
  between Σ movement values and the stock value.
- The provisional-cost correction is a value-only `cost_correction` movement, not a journal (Stage 6 posts it).
- Stock warnings reference cart lines by position, like quote issues; `block` makes them blocking.
- The Stage 2 barcode cache now refreshes stock on every hit; it had been returning stale on-hand quantities.
- The import preview store and column matching were generalised so the product and opening-stock imports share them.
- Screens are checked by typecheck, build and unit tests of their logic, not by clicking through the running app.
- A review pass (Part 4g) changed costing below zero (no re-valuing of earlier oversold units), made opening stock
  "on the shelf now" (allowed after sales, re-costing them), showed this branch's stock, refused duplicate counts,
  reported too-small quantities, and made the integrity check batched and sliced.
