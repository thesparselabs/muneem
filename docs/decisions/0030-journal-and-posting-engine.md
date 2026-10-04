# ADR-0030 — The journal and the posting engine

**Status:** Accepted, 2026-10-04

## Context
LLD §2.4 gives the journal tables and §5.3 says postings are declared as data, not hand-coded per call site. Stages
3–5 already store every amount a journal needs. The user decided (2026-10-04) that journals are written inside each
document's own transaction, with a one-time backfill for documents saved before Stage 6.

## Decision
- **Pure rules.** Posting rules are data in `@muneem/domain`: lines of `{ side, account, amount, when?, party? }`.
  `buildJournal(rule, facts)`:
  - drops zero lines;
  - moves a negative (signed) amount to the other side, so no line is ever negative;
  - throws `LEDGER_IMBALANCE` unless Σ debit = Σ credit.

  It is pure, so the cloud can run the same rules later.
- **One writer.** `journal_entry` and `journal_line` are append-only, and `account_balance` (per account and period)
  is their cache. All three are written only by `postJournal`, in the document's transaction — the same pattern as
  `stock_level` (ADR-0018).
- **Guards in the database.**
  - **CHECKs:** an entry balances and is non-zero; a line has exactly one side and is never negative.
  - **A trigger** refuses a posting to a group account.
  - **`ux_je_ref`** allows one journal per document plus at most one reversal.
- **Cancelling** posts a reversal that points at the original (`is_reversal_of`). Nothing is ever edited.
- **Numbers.** A document's journal carries the document's number. Manual journals are numbered `T1J/2627/00001`
  (ADR-0028 gains the `J` kind).
- **Sync.** The journal travels in its document's outbox aggregate; manual journals are their own aggregate.

## Consequences
- An unbalanced journal cannot exist in the database (FR-052), and a document and its journal commit or fail
  together.
- Every new kind of document needs a rule and a `postJournal` call in its transaction. The integrity check (ADR-0034)
  finds any document without a journal.
