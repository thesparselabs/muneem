# ADR-0024 — Supplier returns and cancelling a purchase

**Status:** Accepted, 2026-10-03

## Context
FR-044 asks a supplier return to reduce stock and payable and record the tax impact. LLD §4.1 lists purchase returns
with the issues, at moving-average cost, but the posting matrix reverses the purchase (`Dr AP / Cr Inventory + Cr
Input tax`). Those disagree whenever the average has moved since the purchase.

## Decision
- A **debit note** is its own document against one purchase, numbered from a per-branch `debit_note` series. Its lines
  point at purchase lines; a trigger refuses a return that would take more than was bought on the line
  (`RETURN_QTY_EXCEEDED`). Tax reverses at the original line's rate.
- **Stock leaves at the original line's landed unit cost**, not the moving average, so the debit note reverses exactly
  what the purchase booked. This differs from LLD §4.1. The engine operation is `returnToSupplier(level, qty, value)`.
- If that leaves the level out of line with its quantity — empty with value left, value below zero with stock left —
  the remainder is a `cost_correction` movement, as with receipts. Goods returned past zero are valued at the return
  cost and marked provisional. `replayMovements` replays supplier returns, so `replay = projection` still holds.
- A debit note is a settlement: it is allocated to its purchase first, and any excess (the purchase was already paid)
  is an unallocated credit from the supplier.
- **Cancelling a purchase** is for an entry that should never have been made, not a return: the purchase's status
  becomes `cancelled`, every line's stock goes back out at its landed cost through `returnToSupplier` (movements of
  type `purchase_return` referencing the purchase), and a `cancel` ledger entry reverses the purchase's entry. No debit
  note is issued. It is refused while payments or debit notes are allocated to the purchase (cancel or re-allocate
  them first).

## Consequences
- The gross margin of goods already sold is not touched by a return; the correction says exactly how much the return
  moved inventory value beyond its own cost.
