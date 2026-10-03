# ADR-0028 — Numbers for purchases, debit notes and other documents

**Status:** Accepted, 2026-10-03

## Context
Sale invoices are numbered per terminal and FY as `PREFIX/2627/000123`, at most 16 characters (CGST Rule 46(b),
ADR-0014). Debit notes are GST documents too (Rule 53), so the same cap applies. Purchases, receipts, payments and
expenses need numbers that never collide between devices working offline. A 4-character terminal prefix, two
separators, the compact FY and 6 digits already use all 16 characters, so there is no room for a fourth part naming
the kind of document.

## Decision
- Every non-sale document is numbered per terminal and FY, like sales.
- The **kind letter joins the terminal prefix** and the sequence has **5 digits**: `T1P/2627/00001` (purchase),
  `T1D/2627/00001` (debit note). Receipts, payments and expenses get `R`, `Y` and `E` when they arrive.
  That allows 99,999 of each kind per terminal per FY.
- `docSeriesPrefix(terminalPrefix, kind)` and `formatDocNumber(prefix, fy, seq)` sit beside `formatInvoiceNumber`
  in `@muneem/domain`. A series row's `pad_width` (6 for sale invoices, 5 for other documents) selects the
  formatter, so `allocateDocNumber` is unchanged for sales.

## Consequences
- A terminal prefix ending in a letter (e.g. `DE0P`) could look like another terminal's purchase prefix, but the
  numbers stay distinct: each series has its own `doc_type`, and the kind letter is always the fifth or an earlier
  character followed by `/`.
- Running out of 99,999 numbers raises `OVERFLOW`, as sale invoices do at 999,999.
