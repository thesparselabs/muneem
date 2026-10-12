# ADR-0068 — Estimates (quotations) and billing them at the till

**Status:** Accepted, 2026-10-12

## Context
FR-086 (PRD §6B, Phase 1 Tier A) asks for estimates that never touch stock or the books until converted, keep a series of
their own, carry lines, customer, pricing and GST into the invoice, and print and share like one. The user chose to sync
them through the cloud so any till can see and bill them (the plan's "syncable like other documents"). Delivery
challans (FR-087) will follow the same non-posting pattern.

## Decision
- **Priced by the sale engine, stored like a sale, posting nothing.** `estimates.create` takes a sale draft plus
  `validUntil` (default 15 days) and a note. It prices the draft through `SalePricing`, the same path as `sales.quote`,
  and applies a bill's checks: no line with an issue, the user's discount limit, and the total the user saw
  (`TOTAL_MISMATCH`). It stores `estimate` and `estimate_item` (migration 0024), which mirror `sale`/`sale_item` with the
  same total and supply-type CHECKs. Lines are append-only and estimates are never deleted (triggers). There is no
  journal, stock movement or party entry. It is idempotent on `commandId` and needs `sales.create`; reading needs
  `sales.view`.
- **Numbered per terminal with kind letter Q** (`DE01Q/2627/00001`, ADR-0028), from a series created on first use. A
  restore realigns the series like other documents.
- **Status:** `open` or `converted` is stored. `expired` is derived on read when an open estimate's `valid_until` has
  passed; listing can filter on it. An expired estimate can still be billed, because the till prices it again.
- **No customer copy.** An estimate is not a tax document, so it keeps only `customer_id` and shows the customer as
  on file today. An erased customer (ADR-0050) leaves nothing personal behind on their estimates. Estimates are listed
  in the customer's data export.
- **Converting is billing.** "Bill it" opens the POS with `?estimate=<id>`. The till loads the estimate's draft (lines,
  units, discounts, customer, place-of-supply override) at today's prices and says so if the total moved. The sale
  carries `estimateId`, and `SaleService.complete` marks the estimate converted (sale id and number) inside the sale's
  own transaction, after the commit steps. The bill and the conversion are saved or lost together; an estimate already
  converted refuses the sale whole. Converting needs an open register, as every sale does. There is no separate
  `estimates.convert` channel.
- **Printed on the invoice templates.** `InvoiceData` gained an optional `document` variant (title, number label, extra
  rows, whether the invoice declaration applies). An estimate prints as "Quotation" with "Quotation No", "Valid until"
  and its note, and without the declaration, on whichever template the shop chose. `estimates.renderHtml` and
  `estimates.savePdf` mirror `invoice.*`, and the FR-085 share dialog sends estimates (doc type `estimate`) like
  invoices.
- **Synced as a document.** Entity `estimate` is on the documents stream. `create` carries the lines, totals, discount
  inputs and filing keys (series, sequence, FY, command, branch, terminal), and no customer copy. `update` carries only
  the conversion (`status: converted`, `saleId`, `saleDocNumber`, `convertedAt`).
  - **Go:** the cloud recomputes an estimate's GST with the sale verifier (no tenders, no journal), refuses a
    conversion that is anything else, and stores it in `entity_state` like any document.
  - **Reference server:** it checks the totals add up.
  - **Pull:** a pulled estimate is filed under its origin's number. Units are matched by natural key, as for sales.
- **Two tills converting the same estimate offline** both make valid sales. The cloud keeps the later conversion, so
  every device ends up showing the same sale on the estimate. Both bills stand, as two bills always do. `sale_id` has
  no foreign key, because a conversion may arrive before its sale.

## Consequences
- An estimate cannot be edited or cancelled. A wrong one is left to expire and a new one is made.
- Holding a bill that came from an estimate drops the link; billing it later does not convert the estimate.
- Prices are not guaranteed: the till re-prices at conversion and shows the difference. Honouring an old quoted price
  needs line price overrides, which the POS does not have.
- `InvoiceData.document` is the extension point FR-087 uses for delivery challans.
