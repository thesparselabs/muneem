# ADR-0014 — Invoice numbering: one series per terminal and financial year, created on first use

**Status:** Accepted, 2026-10-02

## Context
Offline terminals must never issue the same number (C-2). The LLD's credit-note example has no terminal in its key,
FR-035 shows a different format, and the FY appears as both `2026-27` and `26-27`. `doc_series`' table UNIQUE includes
nullable columns, which SQLite treats as distinct.

## Decision
- A series is keyed by (business, document type, branch, terminal, FY). The sale commit finds it or creates it on first
  use with prefix `<BRANCH CODE>/<TERMINAL CODE>`, so numbers read `DEL1/T01/2026-27/000123`. The FY is the
  `financialYearOf` format, `2026-27`.
- The number is allocated inside the sale transaction with the optimistic `next_seq` guard, so a rollback or a crash
  hands it back; `ux_sale_doc` makes a duplicate impossible.
- Regular businesses issue `tax_invoice`. Composition **and unregistered** businesses issue `bill_of_supply` with no tax;
  composition receipts carry the FR-095 declaration.
- A `COALESCE` unique index closes the NULL gap on `doc_series`.

## Consequences
- A new FY starts a new series at 000001 automatically.
- Moving a terminal to another branch starts a new series, which is correct for GST "documents issued".
