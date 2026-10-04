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
- **Catalogue:** 29 definitions in `apps/desktop/src/main/reports/definitions/` (sales, purchases and expenses, cash and
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
