# ADR-0020 — Negative stock policy

**Status:** Accepted, 2026-10-02

## Context
FR-088: configurable per business and per product as block / warn and allow / allow silently, default warn and allow.
Negative-stock events are audited. Only a 0/1 `product.allow_negative_stock` column exists.

## Decision
- Business setting `inventory.negativeStock` = `block` | `warn` | `allow`, default `warn`.
- Per product, `allow_negative_stock` = 1 always allows, 0 always blocks, and NULL follows the business setting.
- `sales.quote` returns a warning for each line that would take stock below zero.
  - **block:** the warnings are issues, and the commit refuses with `STOCK_INSUFFICIENT`.
  - **warn:** the cashier sees the warning, and the sale goes through.
  - **allow:** nothing is shown.
- A committed sale that takes any level below zero writes a `stock.negative` audit row in the same transaction.

## Consequences
- Offline terminals can still oversell each other's stock (FR-087); Stage 7 reconciles at sync.
