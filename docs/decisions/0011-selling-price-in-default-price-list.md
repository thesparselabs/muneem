# ADR-0011 — Selling price lives in the default price list, not on `product`

**Status:** Accepted, 2026-09-30

## Context
FR-014 lists a single "selling price" on the product. FR-091 (PRD review) adds named price lists, quantity breaks and
effective dates, because one price cannot serve retail and wholesale customers. Keeping both a product column and
price lists would give two sources for the same number.

## Decision
- Each business gets a default `Retail` price list (seeded with the standard units). The product form's selling price
  writes a `price_list_item` in that list, in the same transaction as the product.
- `product.mrp_paise` and `product.purchase_price_paise` stay on the product.
- An inclusive price above MRP is rejected. An exclusive price is not checked against MRP, since that needs the tax.
- Price choice is a pure function, `resolvePrice` in `@muneem/domain`: highest quantity break at or below the
  quantity, effective on the date, newest first; a missing unit price falls back to the base-unit price times the
  conversion factor.
- `resolvePrice` exists in TypeScript only for now. The cloud does not price anything until Stage 7; when it does, it
  gets a Go port checked by shared fixtures, as ADR-0001 requires.

## Consequences
- "What does this cost?" always goes through `resolvePrice`; there is no shortcut column to read.
- LLD §2.1 is updated to say so.
