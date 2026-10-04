# Build stages (LLD §20)

| Stage | Deliverable | Exit criterion | Status |
|---|---|---|---|
| 0 | Monorepo, `@muneem/domain` + `@muneem/contracts`, money kernel, GST engine + golden vectors, Go port, CI | Golden suite green in TS **and** Go; `divRound`/`apportion` property tests pass | **Done** 2026-09-27 — 89 vectors, 11,000 fuzz cases identical |
| 1 | Electron shell, generated preload, IPC gateway, SQLite + migrator, auth (online + offline), business/branch/terminal, device registration, minimal Go API | Install, register a device, log in, log in again with the network unplugged | **Done** 2026-09-27 — proven by `apps/desktop/test/e2e-live.test.ts` (5/5) |
| 2 | Products/barcodes/UOM/price lists, import wizard, search | 5,000 SKUs imported; barcode lookup < 30 ms | **Done** 2026-09-30 (PR #3) — 5,000-row import in ~3 s; barcode p95 0.10 ms cold; search p95 < 3 ms. Plan: [plans/stage-2-catalog.md](plans/stage-2-catalog.md) |
| 3 | POS: cart, discounts, GST, tenders, sessions, numbering, the §8 commit, receipt print, drawer | Golden flow end-to-end offline; kill -9 suite green | **Done** 2026-10-02 (PR #4) — offline golden-flow test green; kill -9 suite 200 kills / 578 sales PASS (20 in CI); `sales.complete` p95 9.9 ms. Plan: [plans/stage-3-pos.md](plans/stage-3-pos.md) |
| 4 | Inventory: movements, projections, costing, adjustments, low stock | `replay = projection` property green; valuation ties to inventory account | **Done** 2026-10-02 (PR #5) — replay property 500 runs green; DB replay check after sales, adjustments, stock takes and kills (20 in CI; 200 kills / 431 sales PASS locally); valuation sub-ledger balances (GL tie-out to account 1400 in Stage 6, ADR-0018); `sales.complete` p95 13 ms. Plan: [plans/stage-4-inventory.md](plans/stage-4-inventory.md) |
| 5 | Purchases, suppliers, expenses, payments + allocation, customer credit | Party ledgers reconcile to control accounts | **Done** 2026-10-04 (PR #6) — party reconciliation property 500 runs green; `reconcilePartiesDb` clean after every party test, the offline parties golden flow and the kill -9 suite (20 in CI; 200 kills / 435 sales with credit PASS locally); GL tie-out to 1300/2100 in Stage 6 (ADR-0022). `purchases.create` 200 lines p95 62 ms; a payment settling 500 bills 62 ms; credit `sales.complete` p95 14 ms; reconciliation over 12,500 documents 0.2 s; a statement page at 22,500 documents 2.5 ms. Review fixes 5h-1…4 done. Plan: [plans/stage-5-purchases.md](plans/stage-5-purchases.md) |
| 6 | Accounting: COA seed, posting rules, periods, Trial Balance, P&L, Balance Sheet | Trial balance balances on the soak dataset | **Done** 2026-10-04 (PR #7) — the 365-day soak (`pnpm soak`: 98,550 sales, 931 purchases, 4,505 payments, 106,379 journals, 624,710 lines, 54 late postings) balances the Trial Balance today and at every month end, balances the Balance Sheet, and holds every tie-out to 1400/1300/2100 and the tax heads, the party reconciliation, replay = projection and the journal checks; CI runs 14 days. Trial Balance under 50 ms and Balance Sheet under 0.5 s at about 1M lines (ADR-0036); `sales.complete` p95 12 ms. Plan: [plans/stage-6-accounting.md](plans/stage-6-accounting.md) |
| 7 | Sync: outbox worker, push, pull, hydration, dead-letter, status UI, Go ingest with verification | Deterministic simulation suite green; PRD §37 scenario green | **In progress** — plan: [plans/stage-7-sync.md](plans/stage-7-sync.md) |
| 8 | Reports + exports, dashboard, notifications, audit chain verification, backup/restore, auto-update | Restore-to-new-device gives an identical trial balance | Planned |
| 9 | Hardening: soak, chaos, CA compliance review, pilot with 5 shops | 30 days, zero lost transactions, zero unexplained imbalances | Planned |

## Notes carried forward

- Stage 6 must also post Stage 5's documents: purchases (inventory, eligible input tax, AP, round-off), debit notes
  (the reverse, plus the freight share not refunded as a loss), payments and receipts, write-offs (to a new **5470 Bad
  Debts** account), expenses (category account, input tax, cash/bank/AP) and opening balances. It must then tie
  Σ customer balances to 1300 and Σ supplier balances to 2100 (ADR-0022), and post cash moved through the drawer for
  payments and expenses to 1100.
- Stage 6 must decide the posting period of a purchase whose bill is dated in one FY and entered in the next:
  `purchase.fy` is the bill's FY and its number uses the entry FY (ADR-0023 amendment). Reverse-charge purchases are
  refused until Stage 6 can book the tax as output and input.
- Stage 7 needs supplier, purchase, debit-note, payment, allocation, write-off and expense endpoints. It also needs a
  Go port of `allocateOldestFirst` with shared fixtures before the cloud verifies payments (ADR-0001), and must keep
  the credit limit cloud-wins (LLD §9).
- Not in Stage 5: purchase orders and GRN, debit-note cancellation, refunding a customer's advance, cancelling or
  returning a credit sale (sale cancel and credit notes are still deferred), payment reminders (Stage 8, with consent
  capture), custom expense categories, cheque clearing, TDS/TCS, and printing payment receipts or debit notes.
- The Stage 5 screens are checked by typecheck, build and helper tests. The manual checklist in the Stage 5 plan has
  not been run yet.
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
- Not in Stage 3: sale cancel, returns/credit notes, credit tender (added in Stage 5e), manager PIN override, USB/Windows spooler printing,
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
