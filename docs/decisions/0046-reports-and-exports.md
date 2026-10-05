# ADR-0046 — Reports and exports

**Status:** Accepted, 2026-10-04

## Context
FR-054 and PRD §25 list the reports; LLD §14 sketches a ReportDefinition engine run in a read-only utility process; FR-077 asks for CSV, XLSX and PDF exports. Nothing exports today.

## Decision
- **Definitions:** a `ReportDefinition` registry (LLD §14) gives each report its params schema, a run function,
  columns and totals.
- **Where they run:** on a read-only SQLite connection in a `reports` utility process, streamed and cancellable.
- **Exports:** CSV (UTF-8 BOM), XLSX (one maintained library) and PDF (printed from a hidden window), all through
  one writer interface.
- **Source:** device reports read local data. The cloud gains typed daily aggregates for future owner reports
  (Stage 7 carry), and FR-103's cloud fallback outside the retention window waits for Stage 9.

## Consequences
- Built in Stage 8 (8a/8e); amended with an "As built" note if reality differs.

## As built (8e)
- **Catalogue:** 25 definitions in `apps/desktop/src/main/reports/definitions/` (sales, purchases and expenses, cash and
  payments, stock, parties, accounts); their SQL lives in `packages/db-sqlite/src/reports/`. Reports read the
  documents and the journal, never the dashboard's summary tables. Statements, books and ledgers reuse the Stage 5/6
  queries. Report runs happen on the read-only connection in the main process; the utility process is still to come.
- **Permissions:** sales, purchases, expenses, payments, stock and party reports need `reports.view`; anything that
  shows profit, cost of sales or the journal (statements, books, ledger, day book, cash report, product profit) needs
  `reports.financial`.
- **Netting rule:** a credit note reduces sales **on its own date**, never back-dated to the sale it returns, in every
  sales report, the dashboard and the cloud aggregates — the same date GSTR-1 and the P&L give it. Sales by product
  and category net the returned lines; by payment method nets refunds by their refund method (the credited part as
  `credit`). Purchases show debit notes as negative rows. Product profit is revenue less the cost the sale issued and
  the note took back; it equals the P&L's gross profit unless stock cost corrections or purchase-return losses
  posted to cost of sales in the period.
- **Params:** report parameters gain `customer` and `supplier` kinds (a party picker); the general ledger takes an
  account code as text so users without `accounting.view` can still run it.
- **Dashboard (FR-072):** `reports.dashboard` reads `daily_sales_summary`, `daily_payment_summary` and
  `product_sales_daily` (migration 0018), plus two indexed sums (today's purchases; party balances from the party
  sub-ledger) and this branch's low stock. About 30–40 ms at 200k sales against the 300 ms budget (LLD §18).
- **Summary upkeep:** the daily tables are kept by **SQLite triggers** on `sale`, `sale_item`, `sale_tender`,
  `credit_note`, `credit_note_item`, `payment` and `expense` (insert, and a payment's or expense's cancel), so every
  writer — the sale and return commits, payments, expenses, the pull appliers and hydration — updates them in its
  own transaction without each having to remember to (the allocation totals' precedent). Their definition is the
  `v_*` views of the same migration, which back the backfill, `rebuildDailySummaries` and `dailySummaryDrift`.
  A drift is logged (`SUMMARY_DRIFT`) and rebuilt by the integrity check (whole history) and the 6-hourly check
  (last 35 days, about 1 s at 200k sales).
- **Cloud:** the same three tables plus `party_outstanding`, projected in the push transaction from each applied
  operation (Go migration 0006), read by `GET /reports/daily`.
