# ADR-0014 — Invoice numbering: one series per terminal and financial year, created on first use

**Status:** Accepted, 2026-10-02

## Context
Offline terminals must never issue the same number (C-2). The LLD's credit-note example has no terminal in its key,
FR-035 shows a different format, and the FY appears as both `2026-27` and `26-27`. `doc_series`' table UNIQUE includes
nullable columns, which SQLite treats as distinct.

## Decision
- A series is keyed by (business, document type, branch, terminal, FY). The sale commit finds it or creates it on first
  use.
- **Format `PREFIX/2627/000123`.** CGST Rule 46(b) allows at most 16 characters (letters, digits, `-`, `/`), unique per
  GSTIN per financial year. Each terminal has an **invoice prefix** of 1–4 of `A-Z0-9`, unique in the business, chosen at
  terminal setup or suggested from the branch and terminal codes (`DEL1` + `T01` → `DE01`, else `T1`, `T2`…). The FY
  is written as four digits (`2026-27` → `2627`) and the sequence as six, so the longest number is exactly 16
  characters. The 1,000,000th invoice on one terminal in one year is refused with a clear error.
- *Amended before merge:* the first draft used `<BRANCH>/<TERMINAL>/<FY>/<seq>` (`DEL1/T01/2026-27/000123`, 23
  characters), which GSTR-1 and e-invoice validation would reject. Migration `0004` gives existing terminals a `T<n>`
  prefix and moves their series onto it.
- The number is allocated inside the sale transaction with the optimistic `next_seq` guard, so a rollback or a crash
  hands it back; `ux_sale_doc` makes a duplicate impossible.
- Regular businesses issue `tax_invoice`. Composition **and unregistered** businesses issue `bill_of_supply` with no tax;
  composition receipts carry the FR-095 declaration.
- A `COALESCE` unique index closes the NULL gap on `doc_series`.

## Consequences
- A new FY starts a new series at 000001 automatically.
- Moving a terminal to another branch starts a new series, which is correct for GST "documents issued".
