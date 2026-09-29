# ADR-0008 — Catalog is device-local until Stage 7; variants, weighed barcodes and labels deferred

**Status:** Accepted, 2026-09-30

## Context
Stage 2 builds products, barcodes, units, categories, brands and price lists. The LLD puts the sync engine in Stage 7,
and the Go API has no catalog endpoints. The PRD review suggests leaving variants (FR-016) out of MVP-1, and weighed
barcodes (FR-101) and label printing (FR-107) are not assigned to any stage.

## Decision
- The catalog lives in the local SQLite only. Every catalog write adds its `sync_outbox` row in the same transaction
  (ADR-0006), with new entity types `uom`, `category`, `brand`, `product`, `barcode`, `uom_conversion`, `price_list`
  and `price_list_item`. No OpenAPI or Go changes in Stage 2.
- `product_variant` is created and `barcode.variant_id` / `price_list_item.variant_id` exist, but there is no variant
  API or screen.
- Weighed barcodes and label printing are out of Stage 2.

## Consequences
- A catalog created on one device is not visible on another until Stage 7 ships the outbox.
- Adding variants later needs no table rebuild, only an API and a screen.
- Grocery shops that sell weighed goods by embedded-price barcodes must key the weight manually until FR-101 lands.
