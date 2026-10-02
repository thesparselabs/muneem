# Build stages (LLD §20)

| Stage | Deliverable | Exit criterion | Status |
|---|---|---|---|
| 0 | Monorepo, `@muneem/domain` + `@muneem/contracts`, money kernel, GST engine + golden vectors, Go port, CI | Golden suite green in TS **and** Go; `divRound`/`apportion` property tests pass | **Done** 2026-09-27 — 89 vectors, 11,000 fuzz cases identical |
| 1 | Electron shell, generated preload, IPC gateway, SQLite + migrator, auth (online + offline), business/branch/terminal, device registration, minimal Go API | Install, register a device, log in, log in again with the network unplugged | **Done** 2026-09-27 — proven by `apps/desktop/test/e2e-live.test.ts` (5/5) |
| 2 | Products/barcodes/UOM/price lists, import wizard, search | 5,000 SKUs imported; barcode lookup < 30 ms | **Done** 2026-09-30 (PR #3) — 5,000-row import in ~3 s; barcode p95 0.10 ms cold; search p95 < 3 ms. Plan: [plans/stage-2-catalog.md](plans/stage-2-catalog.md) |
| 3 | POS: cart, discounts, GST, tenders, sessions, numbering, the §8 commit, receipt print, drawer | Golden flow end-to-end offline; kill -9 suite green | **Done** 2026-10-02 (PR #4) — offline golden-flow test green; kill -9 suite 200 kills / 578 sales PASS (20 in CI); `sales.complete` p95 9.9 ms. Plan: [plans/stage-3-pos.md](plans/stage-3-pos.md) |
| 4 | Inventory: movements, projections, costing, adjustments, low stock | `replay = projection` property green; valuation ties to inventory account | **Done** 2026-10-02 (awaiting review) — replay property 500 runs green; DB replay check after sales, adjustments, stock takes and kills (20 in CI; 200 kills / 431 sales PASS locally); valuation sub-ledger balances (GL tie-out to account 1400 in Stage 6, ADR-0018); `sales.complete` p95 13 ms. Plan: [plans/stage-4-inventory.md](plans/stage-4-inventory.md) |
| 5 | Purchases, suppliers, expenses, payments + allocation, customer credit | Party ledgers reconcile to control accounts | Next — purchases post receipts through `postMovement` (ADR-0018) |
| 6 | Accounting: COA seed, posting rules, periods, Trial Balance, P&L, Balance Sheet | Trial balance balances on the soak dataset | Planned |
| 7 | Sync: outbox worker, push, pull, hydration, dead-letter, status UI, Go ingest with verification | Deterministic simulation suite green; PRD §37 scenario green | Planned — outbox rows already written since Stage 1 |
| 8 | Reports + exports, dashboard, notifications, audit chain verification, backup/restore, auto-update | Restore-to-new-device gives an identical trial balance | Planned |
| 9 | Hardening: soak, chaos, CA compliance review, pilot with 5 shops | 30 days, zero lost transactions, zero unexplained imbalances | Planned |

## Notes carried forward

- Local `device_id` on audit/outbox rows is the `installation_id`; the cloud-assigned device id is sent as
  `X-Device-Id`. Stage 7 must map one to the other when pushing (see ADR-0005).
- Sales made before Stage 4 have no stock movements and are not back-filled; stock starts from opening stock
  (ADR-0019, ADR-0021).
- Stage 6 must post the stored inventory values: COGS per sale (`sale.cogs_paise`), adjustment and stock-take values,
  and `cost_correction` movements (COGS ↔ Inventory). It must also add the tie-out of Σ stock value to account 1400.
- Stock on hand is summed over the business's warehouses, one per branch for now. Multi-warehouse and transfers are
  deferred, and so are batch and serial tracking (ADR-0021).
- Replay orders movements by local insertion order; Stage 7 must define the order for movements pulled from other
  devices.
- Not in Stage 3: sale cancel, returns/credit notes, credit tender, manager PIN override, USB/Windows spooler printing,
  ₹ and Indic text on receipts (prints "Rs" / "?"), and a Playwright run of the Electron UI. The POS screens are
  covered by typecheck, build and unit tests of their logic, not by clicking through the running app.
- The scanner is picked up when focus is on the page or the search box, not inside other fields (quantity, dialogs).
- Catalog rows are outbox-only until Stage 7; the Stage 7 server needs catalog endpoints and the conflict rules in
  LLD §9 (price/tax fields: cloud wins; duplicate barcodes across devices: review item).
- `resolvePrice` has no Go port yet; add one with shared fixtures before the cloud prices anything (ADR-0011).
- Businesses created before Stage 2 get their default units and Retail list on their first catalog call, even a
  read by a view-only user, so those audit rows name whoever opened the catalog first. Harmless before the pilot;
  revisit if a Stage-1 database ever reaches a shop.
- The Stage 2 screens were checked by typecheck, build and unit tests of their form logic, not by clicking through
  the running app.
- Token auto-refresh exists (`AuthService.refreshAccessToken`) but is not wired into a retry on 401 — Stage 7.
