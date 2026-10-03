# ADR-0022 — The party sub-ledger

**Status:** Accepted, 2026-10-03

## Context
The Stage 5 exit criterion is "party ledgers reconcile to the control accounts", but the journal and the AR 1300 / AP
2100 accounts arrive in Stage 6. LLD §9 says party balances are derived from documents and allocations and are never
synced as a number. LLD has no table that records, document by document, what each party owes.

## Decision
- `party_ledger_entry` is the sub-ledger: one append-only, signed entry per document that changes what a party owes,
  written in the document's own transaction. **Positive means the party owes the business.** A customer's credit sale
  or receivable opening is positive; a supplier's purchase or payable opening is negative; payments, debit notes and
  write-offs move the other way. A cancellation writes a second entry of kind `cancel` that reverses the first.
- Documents are either **charges** (credit sales, purchases, credit expenses, openings in the business's favour for
  customers and in the supplier's favour for suppliers) or **settlements** (payments, debit notes, write-offs, openings
  the other way). Allocations apply settlements to charges (ADR-0025).
- Invariant, per party: **Σ entries = sign × (Σ open charge amounts − Σ unallocated settlement amounts)**, where sign
  is +1 for customers and −1 for suppliers. `reconcileParties` in `@muneem/domain` checks it and also names
  over-allocated documents, allocations onto cancelled documents and allocations across parties. It runs as a
  property test, as a database check after every party test and the kill -9 suite, and in the integrity check.
- No balance is stored as the truth. A cached balance, if one is ever needed for speed, gets one writer, like
  `stock_level`.
- Until Stage 6 this is the proof. Stage 6 posts the same documents and ties Σ customer balances to 1300 and
  Σ supplier balances to 2100.

## Consequences
- A party statement (FR-039) is a scan of one index; a balance is a sum.
- Every new party-affecting document must write its entry in the same transaction; the reconciliation catches one
  that does not.
