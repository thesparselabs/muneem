# ADR-0034 — Tie-outs, backfill and integrity

**Status:** Accepted, 2026-10-04

## Context
Stage 4 proved the inventory sub-ledger (ADR-0018) and Stage 5 the party sub-ledger (ADR-0022), each deferring its
tie-out to the general ledger. Documents saved before Stage 6 have no journals.

## Decision
- **The tie-outs:**
  - balance(1400) = Σ stock value;
  - balance(1300) = Σ customer balances;
  - balance(2100) = −Σ supplier balances;
  - each input and output tax account = Σ of the documents' tax for that head;
  - Σ `account_balance` = Σ journal lines (replay = projection).
- **The backfill** posts every document without a journal, in date order and in batches. It is idempotent through
  `ux_je_ref`, runs at start-up after migrating, and can be re-run from Diagnostics.
- **The integrity check** (Diagnostics and the 6-hourly timer) adds three checks: the journal replay, the tie-outs,
  and "documents without a journal".
  - **Drift in `account_balance`** is rebuilt.
  - **Anything else** is reported and never rewritten, because journals and documents are the record.

## Consequences
- The Stage 6 exit test checks all of these on the soak dataset and after the kill -9 suite.
