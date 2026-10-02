# ADR-0021 — Warehouses, opening stock, adjustments and stock take

**Status:** Accepted, 2026-10-02

## Context
Movements and levels need a `warehouse_id`, but no warehouse table is defined and multi-warehouse is deferred from
MVP-1. FR-022 lists adjustment reasons, but no adjustment document or stock take is designed. The user chose to start
stock from an opening count rather than back-fill earlier sales.

## Decision
- **Warehouses:** one default warehouse per branch, created on first use. Transfers and more warehouses stay
  deferred; the columns are ready.
- **Opening stock:** a document per warehouse (`stock_adjustment` kind `opening`) with quantity and unit cost per
  product. It can be entered by hand or imported from CSV/XLSX through the Stage 2 import pipeline.
  - *Amended before merge:* the quantity means **what is on the shelf now**. The entry receives the gap between that
    count and the current level, at the given cost, so sales made before it are re-costed at that cost (ADR-0018).
  - **Limits:** once per product. A count at or below what the system already holds is refused; that difference is
    an adjustment.
  - **Why:** the earlier rule refused opening stock for any product with movements, and the default "warn" policy lets
    sales come first, so those products could never get a real cost.
- **Adjustments:** a document (kind `adjustment`) with a reason per line: damage, theft, expiry, counting error or
  other.
  - **Losses:** issued at average cost.
  - **Gains:** received at the current average, else the last known cost.
  - **Rules:** permission `inventory.adjust`; audited and synced.
- **Stock take:** counted quantities are compared with the level at the moment of posting; a product may be counted
  once per stock take. One `stock_take` adjustment
  is posted for the differences, with reason counting error.
- **Low stock:** on hand ≤ reorder level.
- **Where stock is shown:** on-hand stock in search, the stock list and the stock take is this branch's warehouse,
  the same one sale warnings use. The valuation is business-wide.
- **Batch:** the `batch` table exists, but batch and serial tracking are deferred.

## Consequences
- An opening stock entered after sales have already happened still records them correctly: the earlier sales stay
  without movements (ADR-0019), and stock starts from the opening count.
