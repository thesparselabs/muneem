# ADR-0066 — Customer and supplier import, exports on every list, and icon-only actions

**Status:** Accepted, 2026-10-07

## Context
An audit of the desktop app found that only Reports and GST returns could export (GST without PDF), that customers and
suppliers could only be typed in one at a time, that the three existing file imports said little about the file they
expect, and that many repeated actions were text-only buttons.

## Decision
- **Party import** follows the product import (ADR-0010): bytes over IPC, a preview held in main memory, one
  transaction on commit, a stored summary under the `commandId`. `customers.importPreview/Commit` and
  `suppliers.importPreview/Commit` share one `PartyImportService`; a `PartyImportTarget` carries what differs (schema,
  create, set-opening, the permission for openings). Rows are validated with the same `CustomerInput` / `SupplierInput`
  schemas as the forms and written through the existing services, so audit, outbox and journals are unchanged.
- **Duplicates are skipped, never updated.** A row matches an existing party by exact GSTIN or exact phone; names are
  not compared, because two real customers often share one. There is no "update" policy: a wrong match would overwrite
  someone's details, and the file has no key as reliable as a product's SKU.
- **Opening balances** come from two optional columns. A positive amount is the usual side (customer owes us, we owe
  the supplier); a negative one is the other side. Setting one needs the party's `edit` permission on top of `create`,
  the same as doing it by hand; without it the row is refused in the preview. Dates accept `YYYY-MM-DD` and
  `DD/MM/YYYY`, default to today and may not be in the future.
- **Supplier tax scheme** is inferred when the column is blank: `regular` with a GSTIN, `unregistered` without. A
  spreadsheet from another package rarely has that column, and the form's default would refuse every unregistered row.
- **Exports reuse the report catalogue (ADR-0046)** rather than a new channel. Five definitions were added
  (`sales.register`, `catalog.products`, `parties.customers`, `parties.suppliers`, `accounting.chartOfAccounts`) and a
  shared `ExportMenu` (CSV / Excel / PDF) calls `reports.export` from each list, ledger and statement screen. The
  product list uses the product import's column names, so an export can be edited and imported back.
- **Format help is data.** `lib/importFormats.ts` describes each import's columns, accepted header names and value
  formats; `ImportFormatHelp` renders it above the file chooser on all five imports.
- **Icon-only buttons** are limited to actions that read the same everywhere (close, back, remove, rename, print, view,
  refresh, sign out). Each keeps its old text as `aria-label` and gains a `title`. Posting, payment and destructive
  actions keep their words and gain an icon.

## Consequences
- The new list reports also appear in Reports, under "Lists" and "Sales".
- Exports stay capped at 50,000 rows and behind `reports.export`, which cashier and inventory roles do not hold, so
  those roles see no export buttons.
- Screens without a matching report (stock reconciliation, price lists, GST set-off and payments, audit, notifications)
  still have no export.
- Expenses, payments, purchases-as-whole-bills and journals have no file import: each is a numbered financial document
  with its own journal, and a bulk path for them needs its own decision.
