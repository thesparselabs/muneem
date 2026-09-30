# ADR-0010 — Product import: file bytes over IPC, preview in memory, one-transaction commit

**Status:** Accepted, 2026-09-30

## Context
FR-017 asks for CSV/XLSX import with validation, preview, error reporting, duplicate handling and a summary. The Stage 2
exit criterion is 5,000 SKUs imported. The IPC registry forbids path-like channels, so the main process must not open a
file path chosen by the renderer.

## Decision
- The renderer reads the chosen file and sends its bytes as base64 (at most 10 MB and 20,000 rows). CSV is parsed with
  `papaparse`, XLSX with `exceljs` (the npm build of SheetJS is unmaintained).
- `products.importPreview` parses, suggests a column mapping from common header names, and validates every row with
  the same `ProductInput` schema and `productFieldErrors` rules as the product form. The parsed table stays in main
  memory under an `importId` for 15 minutes; changing the mapping re-sends only the `importId`.
- Duplicates are matched by SKU, then barcode. A barcode that belongs to a different product than the SKU match is a
  row error. The user chooses `skip` or `update`; `update` overwrites only the columns present in the file and never
  changes the base unit, because stock is counted in it.
- `products.importCommit` re-validates against the current database and writes everything in **one** transaction.
  Rows with errors are skipped and counted (the user saw them in the preview); any exception rolls back the whole
  import. Missing categories, brands and unit codes are created. The summary is stored under the `commandId`, so a
  retried commit returns the same result instead of importing twice.
- The gateway's audit copy of any input string over 1,000 characters is replaced by `[N chars]`, so a file never
  lands in `audit_log`.

- For a row that matches an existing product, the preview validates the **merged** product (existing values plus the
  file's columns), not just the file row. Rows that would break a rule are shown as "can't update" and skipped by an
  update commit, so a preview that looks clean cannot fail at commit time.

## Consequences
- A 5,000-row file commits in about 3 s on the dev machine. The test fails above 10 s.
- The file is never written to disk by Muneem; restarting the app during a preview means choosing the file again.
