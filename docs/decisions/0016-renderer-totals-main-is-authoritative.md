# ADR-0016 — The renderer shows totals instantly; the main process is authoritative

**Status:** Accepted, 2026-10-02

## Context
Cart recalculation must take under 10 ms with no database round-trip per keystroke (LLD §18), yet HLD §8 says the commit
must recompute totals and never trust renderer maths. Quantity-break prices depend on the quantity.

## Decision
- The renderer runs the same pure `computeInvoice` on the cart for instant totals.
- `sales.quote` (main) prices the cart from product data — current price list, quantity breaks, unit conversions — and is
  called when a line is added or its quantity or unit changes.
- `sales.complete` re-prices and recomputes everything and compares with the renderer's `expectedTotalPaise`. A
  difference is refused with `TOTAL_MISMATCH`; the UI re-quotes and shows the new total. The customer is never charged
  an amount they were not shown.
- Discount limits are checked in main on the effective discount (total discount ÷ pre-discount taxable, to the nearest basis point — per-line rounding can push an exact 5% a fraction of a paisa over)
  against the user's `sales.create` `maxDiscountBp`.

## Consequences
- A price change between quote and payment surfaces as a clear "total changed" prompt instead of a silent difference.
