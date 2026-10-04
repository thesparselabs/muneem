# ADR-0032 — The posting matrix as built

**Status:** Accepted, 2026-10-04; for CA review before the pilot

## Context
LLD §5.2 is "the single most review-worthy artifact — get a CA to sign it". It covers sales, purchases, returns,
receipts, payments, expenses, adjustments and register variance. It has nothing for:
- Stage 5's landed cost, debit notes with freight kept, write-offs, credit expenses and opening balances;
- Stage 4's cost corrections;
- Stage 3's manual cash in/out.

## Decision
- **Where the matrix lives.** `docs/accounting/posting-matrix.md` is the as-built matrix, one table per document with
  a worked example taken from the unit tests. The rules in `@muneem/domain/accounting/rules.ts` are its only
  implementation.
- **Departures from LLD §5.2:**
  - **Customer receipts post wholly to 1300 AR,** not "Cr 2400 for the unallocated remainder". An advance is a credit
    balance on the customer. The Balance Sheet presents customers with credit balances as "Advances from customers",
    so a later allocation needs no reclassifying journal, and 1300 always equals Σ customer balances (ADR-0022).
  - **Debit notes:** the freight share the supplier keeps goes to **5110 Purchase-return Losses**, and the bill's
    round-off, when taken back, goes to 4900.
  - **Manual cash in/out** posts against **1199 Cash to classify**, with the reason as narration. The accountant
    reclassifies it by manual journal. A safe drop moves cash to cash, so it posts nothing.
  - **Openings** (party balances and opening stock) post against **3400 Opening Balance Equity.**
  - **Cost corrections** move value between 1400 Inventory and 5100 COGS.

## Consequences
- The matrix document is what a CA signs. Any change to a rule changes the document in the same PR.
