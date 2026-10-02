# ADR-0018 — Inventory ledger and moving-average costing

**Status:** Accepted, 2026-10-02

## Context
LLD §2.3/§4.1 give the movement and level tables and the moving-average algorithm, and the Stage 4 exit criterion is
`replay = projection`. As written, the algorithm clamps the value to zero when stock runs out and re-values negative
stock, so Σ of the movements' nominal values drifts from the cached level. The provisional-cost correction is described
as a journal, which does not exist until Stage 6. The journal and chart of accounts are Stage 6, so "valuation ties to
the inventory account" cannot be checked yet.

## Decision
- `stock_movement` is the source of truth and is append-only. `stock_level` is a cache, written only by `postMovement`
  in the same transaction as the movement.
- Moving weighted average per (product, warehouse), integer paise, as the pure `@muneem/domain` engine
  (`receiveStock`, `issueStock`, `replayMovements`), following LLD §4.1 exactly. Quantities are in base units.
- **A movement stores the exact change it made to the level's value** (`value_paise` = after − before). So
  Σ movement values = level value always, and the clamp and negative-stock re-valuation leave no residue.
- An issue at or below zero uses the last known unit cost, else the product's purchase price, else 0, and is marked
  `cost_provisional`. The next receipt re-costs those units at the receipt's cost. The difference is written as a
  **`cost_correction` movement** (quantity 0, value only), which Stage 6 posts as COGS ↔ Inventory.
- `replayMovements` re-runs the engine over stored movements and reports any movement whose stored delta it does
  not reproduce. This is the `replay = projection` check, run as a domain property test, a database check and a
  Diagnostics/integrity job.
- Until Stage 6 the valuation is the inventory sub-ledger: valuation report = Σ movement values = Σ cached levels.
  Every value the journal will need is stored: COGS per sale line and header, adjustment values and corrections.
  Stage 6 adds the tie-out to account 1400.

## Consequences
- Rebuilding a level is a fold over its movements; drift is detectable and healable at any time.
- Purchases (Stage 5) reuse `receiveStock` with landed cost excluding ITC-eligible tax.
