# Stage 3 — POS billing: implementation plan

## Context

Stages 0–2 are merged (PR #1, #3). Stage 3 (LLD §20) is "POS: cart, discounts, GST, tenders, sessions, numbering, the
§8 commit, receipt print, drawer"; exit criterion **golden flow end-to-end offline; kill -9 suite green**. "§8" is HLD §8
(the POS transaction boundary). The design is detailed (LLD §2.2/§2.6 DDL, §3 GST, §6 numbering, §13 hardware, HLD §8)
but contradicts itself on stock/journal inside the commit, and leaves customers, sessions maths, printing persistence
and several schema details open.

**Decisions (user, 2026-10-01):**
- **Stock and books deferred with a seam.** A Stage 3 sale writes sale, lines, tenders, number, audit, outbox and its
  print job. The commit is an ordered list of steps; Stage 4 inserts stock movements and Stage 6 the journal into the
  same transaction. `cogs_paise` stays 0 until Stage 4.
- **Basic customers, no credit.** Name, phone, GSTIN, state, address; searchable/creatable from POS (F3); snapshotted on
  the invoice; drives place of supply. Credit tender, limits and balances wait for Stage 5.
- **Extras:** hold/retrieve bills (F6/F7) only. Cancel, returns/credit notes and manager PIN override are **not** in
  Stage 3.
- **No printer yet:** receipt layout, ESC/POS bytes, durable print queue, reprint with DUPLICATE, a simulator adapter
  (writes receipts to files) and a network TCP 9100 adapter. USB / Windows spooler later.

Delivery as in Stage 2: plan copied to `docs/plans/stage-3-pos.md`; one branch `feat/stage-3-pos`; parts 3a–3f are
commits, each green with a CHANGELOG line; **nothing pushed and no PR until the user reviews**. The local
`fix/dev-csp` commit is merged into this branch first (or PR'd separately, as the user prefers).

## Defaults settled in this plan (each recorded in an ADR)

| Topic | Default |
|---|---|
| Document type | `tax_invoice` for regular businesses; `bill_of_supply` for composition **and unregistered** (no tax; composition prints the FR-095 declaration). |
| Numbering (ADR-0014) | One series per (business, doc type, branch, terminal, FY), created on first use. Number = `<BRANCH>/<TERMINAL>/<FY>/<seq>`, e.g. `DEL1/T01/2026-27/000123` (existing `allocateDocNumber` format, FY as `2026-27` per `fy.ts`). Fix: SQLite treats NULLs as distinct in `doc_series`' UNIQUE, so add a `COALESCE` unique index. Number is allocated inside the commit, so a rollback returns it. |
| Supplier state / place of supply | Supplier state = branch state. Place of supply = customer's state, else branch state (walk-in). Optional override with a mandatory reason, stored on the sale and audited (FR-093). UTGST label for UT-without-legislature codes (04, 26, 31, 35, 38). |
| Rounding / B2CL | Round to rupee per business setting `pos.roundToRupee` (default on). B2CL threshold setting `gst.b2clThresholdPaise` default ₹1,00,000. |
| Discounts | Line (amount or %) and bill (amount or %), both pre-tax (C-4). Effective discount bp = total discount ÷ pre-discount taxable; the service checks it against the user's `sales.create` `maxDiscountBp` (cashier 5%); over the limit → `PERMISSION_DENIED` (no override in Stage 3). |
| Tenders | cash, upi, card, other. Non-cash total ≤ bill total; only cash may over-tender, the excess is change; Σ tenders − change = total exactly. UPI/card reference optional. No credit. |
| Pricing authority (ADR-0016) | Renderer computes totals instantly with the same pure `computeInvoice` (cart recalculation < 10 ms, no IPC per keystroke). `sales.quote` (main) re-prices lines (quantity breaks, current price list) when a line is added or its qty/unit changes. `sales.complete` recomputes everything from product data and rejects with `TOTAL_MISMATCH` if it differs from the renderer's `expectedTotalPaise` — the customer is never charged a number they did not see. |
| Idempotency | Renderer mints `commandId` per attempt; `ux_sale_command` unique; a repeat returns the original result. UI locks during commit; near-duplicate warning (same customer and total within 60 s) (FR-108). |
| Register sessions | One open session per terminal (DB-enforced). Expected cash = opening + cash tendered − change + cash in − cash out − safe drops. Z number = session number per terminal. Close with counted cash (optional denomination breakdown, optional blind close setting); variance above `pos.varianceThresholdPaise` (default ₹100) needs `pos.approve` (manager), otherwise refused with "a manager must close". Close refused while held bills exist (FR-099). X report = same totals, non-final. |
| Print job (ADR-0015) | The `PrintDoc` is built and its `print_job` row inserted **inside** the commit (so `printJobId` is returned and the job survives a crash); actual printing and the drawer kick run after COMMIT, time-boxed, never throwing. Reprint creates a new job with `copy_no+1`, `is_duplicate=1`, "DUPLICATE" printed. Printer config is device-local (`app_meta`), not synced. |
| Append-only | Triggers forbid DELETE on `sale`, `sale_item`, `sale_tender`, and UPDATE on `sale_item`/`sale_tender`; `sale` UPDATE is allowed only for sync columns (cancel arrives later). Line CHECK `total = taxable + taxes`. |
| Sync | `customer`, `pos_session`, `cash_movement`, `sale` (one aggregate payload: header, items, tenders) get outbox rows; `held_bill` and `print_job` are device-local. |

ADRs: 0013 Stage 3 commit scope and step seam (stock/journal deferred) · 0014 numbering · 0015 print job inside the
commit, hardware after · 0016 renderer totals vs authoritative recompute · 0017 tenders and register-session rules.

## Existing code to reuse

- `computeInvoice` + types (`packages/domain/src/gst/`), Go port already mirrors it; `financialYearOf` (`fy.ts`);
  `resolvePrice`, `toBaseQty`, `mrpForUnit` (`domain/src/catalog/`).
- `allocateDocNumber`, `createDocSeries` (`packages/db-sqlite/src/repositories/docSeries.ts`) — extend with
  find-or-create per terminal/FY.
- Mutation recipe: `withTransaction`, `recordChange`/`queueChild` (`repositories/catalogWrite.ts`), `stmt()`,
  `appendAudit`, `appendOutbox`; settings via `getSetting`/`setSetting`; device-local `getMeta`/`setMeta`.
- Catalog: `hitByBarcode`/`ProductSearch.lookupBarcode`, `getPriceItemsByProduct`, `CatalogContext`
  (actor, business, `today()`); extend `ProductHit` with `cessRateBp`, `cessPerUnitPaise`.
- Desktop: gateway/handlers pattern (`apps/desktop/src/main/app.ts`), `Rbac.assert` (`src/main/rbac.ts`),
  `SessionService` (terminal/branch), `crash-loop.ts` + `crash-child.ts` (extend with a sales scenario).
- Tests: `freshDb`, `testApp`, fast-check; perf-test style from `test/perf/catalog.perf.test.ts`.

## IPC surface

- `customers.search / get / create / update` (perm customers.view/create/edit)
- `pos.openRegister / closeRegister / getSession / xReport / zReport / cashMovement / holdBill / listHeldBills /
  retrieveBill / discardBill`
- `sales.quote / complete / get / list / getReceipt` (`complete`: perm `sales.create`, `idempotent: 'commandId'`,
  audit; input `{ commandId, customerId?, placeOfSupplyOverride?, lines[{ productId, uomId, qtyMilli, lineDiscount }],
  billDiscount, tenders[], expectedTotalPaise }`; output `{ saleId, docNumber, totals, printJobId }`)
- `printer.getConfig / setConfig / testPrint / getQueue / retryJob / reprint`, `drawer.open` (namespaces must be lowercase)

## Parts (each: tests first; each one commit)

**3a — Schema, domain rules, docs**
1. `0003_pos.sql`: `customer`, `pos_session`, `cash_movement`, `sale`, `sale_item`, `sale_tender`, `held_bill`,
   `print_job` (LLD DDL adapted: standard sync columns, `place_of_supply_reason`, nullable-key unique indexes via
   `COALESCE`, line total CHECK, append-only triggers), plus the `doc_series` COALESCE unique index.
2. Domain (pure): `settleTenders` (Σ/change rules), `effectiveDiscountBp`, `expectedCash`, `isUtWithoutLegislature`,
   `stateOfGstin`. Property tests (tenders always balance; change only from cash).
3. Plan doc, ADRs 0013–0017, build-stages Stage 3 → In progress, LLD §2.2/§6 notes where the build differs.

**3b — Customers and register sessions**
4. Repositories + `CustomerService` (GSTIN validation, state derived from GSTIN, phone/name search) and
   `RegisterService` (open, cash movement, X report, close with variance rule, Z report JSON). Tests: one open session
   per terminal, expected-cash maths, variance needs manager, close blocked by held bills.

**3c — The sale commit**
5. `SaleCommit` as an ordered list of steps in one `withTransaction`: validate (session open, permission/discount
   limit, tenders) → price lines from product data → `computeInvoice` → compare `expectedTotalPaise` → allocate number →
   insert sale/items/tenders (line snapshots) → *[Stage 4: stock]* → *[Stage 6: journal]* → build PrintDoc + insert
   print_job → audit → outbox. After COMMIT: hand the job to the print queue, kick the drawer if cash was tendered.
6. `sales.quote`, `sales.get/list/getReceipt`. Tests: B2C intra/inter, B2B with customer GSTIN, composition bill of
   supply, round-off, bill discount apportioned, discount over limit refused, `TOTAL_MISMATCH`, duplicate `commandId`
   returns the same sale, numbering per terminal and FY rollover, register not open → `REGISTER_NOT_OPEN`, a failure
   anywhere leaves no sale, number, audit or outbox row.
7. Perf test: `sales.complete` p95 < 250 ms for a 10-line sale with 5,000 SKUs.

**3d — Printing and drawer**
8. `PrintDoc` builder (pure: header, customer block, lines, totals, tax summary by rate, tenders/change, footer,
   DUPLICATE, composition declaration), width-aware text layout (32/42/48 columns), ESC/POS encoder (init, align, bold,
   cut, drawer kick `ESC p`). Golden-bytes tests.
9. `ReceiptPrinter` / `CashDrawer` interfaces; `SimulatorPrinter` (writes `.txt` + `.bin` under
   `userData/receipts/`) and `NetworkEscPosPrinter` (TCP 9100, time-boxed); `PrintQueue` worker (status, retries,
   restart recovery of queued jobs); a `hardware` logger (currently missing, so `diagnostics.getLogsTail('hardware')` is
   always empty). Tests: printer failure never affects the sale; reprint marks DUPLICATE; queued jobs resume after
   restart.

**3e — POS screens**
10. `/pos`: register gate (open register if none), scan buffer hook (Enter within 120 ms, ≥ 4 chars, works regardless
    of focus), cart with qty/unit/line discount, F2 search, F3 customer (search/create), F4 bill discount, F5 payment
    dialog (split tenders, change due), F6 hold, F7 retrieve, F9 reprint last, Esc clear; UI lock during commit;
    near-duplicate warning; printer-offline banner. Register screens: open, cash in/out/safe drop, X report, close with
    count and Z report. `/settings/printer` (simulator / network, width, drawer, test print). Enable the POS nav item.
    Pure helpers (cart model, tender maths, scan-buffer state machine) get node tests.

**3f — Crash suite, golden flow, close-out**
11. Kill -9 suite: `crash-loop --scenario sales` (child loops `sales.complete` on a file DB; SIGKILL at random 150–550
    ms) asserting no partial sale (every sale has its items, tenders, audit and outbox rows), `doc_seq` gap-free per
    series with `next_seq = max + 1`, no orphan print job, `quick_check` ok, audit chain verifies. A 20-iteration
    version runs as a vitest test in CI; the 200-iteration script stays manual.
12. Golden-flow test (service level, cloud offline): login offline → open register → scan → add customer → bill
    discount → cash + UPI → complete → receipt file written by the simulator → cash movement → close with Z report.
    Playwright-driven Electron E2E is deferred (needs a display in CI); noted in build-stages.
13. Docs: build-stages Stage 3 → Done with measured numbers, architecture (POS section, invariants), LLD §10.2 surface,
    CHANGELOG, plan "as built".

## Verification

- `pnpm turbo run gen build typecheck lint test`, `pnpm schema-lint`, Go job green.
- Exit criterion evidence: golden-flow test and the 20-iteration kill -9 test in CI; 200-iteration
  `pnpm --filter @muneem/desktop crash-loop --scenario sales` run locally with its PASS output recorded.
- Manual: `pnpm --filter @muneem/desktop dev`, open register, scan/type products, F-key flow to payment, check the
  receipt file in `userData/receipts/`, close register and read the Z report; stop the Go API and bill again offline.

## As built (2026-10-02)

- Price-list calls stayed `pricing.*`; the drawer call is `drawer.open` (IPC namespaces must be lowercase).
- The effective discount is rounded to the nearest basis point, not up: an exact 5% became 5.01% after per-line
  rounding and was refused for cashiers.
- `sales.quote` also returns the supplier state, tax scheme and rounding setting so the renderer can total locally.
- The kill -9 suite found that its own children were never killed: the `tsx` binary forks a second Node process, so
  SIGKILL hit the wrapper while the writer kept running. Children now run as `node --import tsx`. The Stage 1
  crash loop had the same flaw; re-run for real it passes (30 kills, 492 entities).
- The print queue could throw (and crash the process) if recording a job's status failed; it now logs and retries at
  the next start.
- The scanner is detected on the page and the search box, not inside other inputs.
- 20 kills run in CI (about 20 s); `pnpm --filter @muneem/desktop crash-loop --scenario sales 200` passed with 578 sales.
