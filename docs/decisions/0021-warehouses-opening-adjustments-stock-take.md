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
  product. It is allowed only for products with no movements yet; later changes are adjustments. It can be entered by
  hand or imported from CSV/XLSX through the Stage 2 import pipeline.
- **Adjustments:** a document (kind `adjustment`) with a reason per line: damage, theft, expiry, counting error or
  other.
  - **Losses:** issued at average cost.
  - **Gains:** received at the current average, else the last known cost.
  - **Rules:** permission `inventory.adjust`; audited and synced.
- **Stock take:** counted quantities are compared with the level at the moment of posting. One `stock_take` adjustment
  is posted for the differences, with reason counting error.
- **Low stock:** on hand ≤ reorder level.
- **Batch:** the `batch` table exists, but batch and serial tracking are deferred.

## Consequences
- An opening stock entered after sales have already happened still records them correctly: the earlier sales stay
  without movements (ADR-0019), and stock starts from the opening count.
