# Build stages (LLD §20)

| Stage | Deliverable | Exit criterion | Status |
|---|---|---|---|
| 0 | Monorepo, `@muneem/domain` + `@muneem/contracts`, money kernel, GST engine + golden vectors, Go port, CI | Golden suite green in TS **and** Go; `divRound`/`apportion` property tests pass | **Done** 2026-09-27 — 89 vectors, 11,000 fuzz cases identical |
| 1 | Electron shell, generated preload, IPC gateway, SQLite + migrator, auth (online + offline), business/branch/terminal, device registration, minimal Go API | Install, register a device, log in, log in again with the network unplugged | **Done** 2026-09-27 — proven by `apps/desktop/test/e2e-live.test.ts` (5/5) |
| 2 | Products/barcodes/UOM/price lists, import wizard, search | 5,000 SKUs imported; barcode lookup < 30 ms | **In progress** — plan: [plans/stage-2-catalog.md](plans/stage-2-catalog.md) |
| 3 | POS: cart, discounts, GST, tenders, sessions, numbering, the §8 commit, receipt print, drawer | Golden flow end-to-end offline; kill -9 suite green | Planned |
| 4 | Inventory: movements, projections, costing, adjustments, low stock | `replay = projection` property green; valuation ties to inventory account | Planned |
| 5 | Purchases, suppliers, expenses, payments + allocation, customer credit | Party ledgers reconcile to control accounts | Planned |
| 6 | Accounting: COA seed, posting rules, periods, Trial Balance, P&L, Balance Sheet | Trial balance balances on the soak dataset | Planned |
| 7 | Sync: outbox worker, push, pull, hydration, dead-letter, status UI, Go ingest with verification | Deterministic simulation suite green; PRD §37 scenario green | Planned — outbox rows already written since Stage 1 |
| 8 | Reports + exports, dashboard, notifications, audit chain verification, backup/restore, auto-update | Restore-to-new-device gives an identical trial balance | Planned |
| 9 | Hardening: soak, chaos, CA compliance review, pilot with 5 shops | 30 days, zero lost transactions, zero unexplained imbalances | Planned |

## Notes carried forward

- Local `device_id` on audit/outbox rows is the `installation_id`; the cloud-assigned device id is sent as
  `X-Device-Id`. Stage 7 must map one to the other when pushing (see ADR-0005).
- Token auto-refresh exists (`AuthService.refreshAccessToken`) but is not wired into a retry on 401 — Stage 7.
