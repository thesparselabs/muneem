# ADR-0027 — An issue takes its share of the value, not a rounded average

**Status:** Accepted, 2026-10-03. Supersedes the issue-costing rule of ADR-0018 for stock on hand.

## Context
ADR-0018 (LLD §4.1) costs an issue as `qty × unit_cost`, with the unit cost rounded to whole paise per base unit.
For cheap items that rounding is large. 1,000 units bought for ₹15 cost 1.5 paise each, which rounds to 2 paise; selling
999 of them books ₹19.98 of cost and leaves the last unit worth −₹4.98. The sub-ledger still balances, because every
movement stores its exact change, but cost of goods sold is overstated and a positive stock count carries a negative
value. A property added in Stage 5a ("value ≥ 0 while stock is on hand") found it.

## Decision
- An issue that leaves stock on hand takes **its share of the value**: `divRound(value × qty issued, qty on hand)`.
  It can never take more than the stock is worth, so the value stays ≥ 0 while quantity is positive.
- Everything else in ADR-0018 is unchanged:
  - an issue that empties the stock takes all of its value;
  - stock going below zero is costed at the rounded average, provisionally, and corrected by the next receipt;
  - `unit_cost_paise` on a movement is still the rounded average, kept for display and replay.
- Replay uses the same engine, so `replay = projection` holds. The costing property test now draws unit costs up to
  ₹1 lakh per base unit. Beyond that, the money kernel refuses the intermediate values with `OVERFLOW`, by design,
  rather than storing a wrong number.

## Consequences
- Movements written before this change can be reported as cost mismatches by the integrity check where the two rules
  disagree. Only development databases have such movements; no shop runs Stage 4 yet.
- COGS on cheap items is now right to the paisa per document line, not per unit.
