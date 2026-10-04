# ADR-0043 — Returns and credit notes

**Status:** Accepted, 2026-10-04

## Context
Stage 3 deferred sale cancel and returns; GSTR-1 needs credit notes (CDNR/CDNUR). The sale table already has `doc_type = credit_note` and `original_sale_id`.

## Decision
- **What a return is:** a return against a posted sale is a `credit_note` document. It has its own per-terminal
  series and references the original sale and lines.
- **Limits:** the quantity returned is capped at what was sold less what was already returned.
- **What it writes:**
  - stock comes back at the sale line's stored cost;
  - a party credit for credit sales, or a refund tender otherwise;
  - a journal mirroring the sale's for the returned part (sales returns, output tax, COGS reversal);
  - a GSTR-1 bucket of CDNR or CDNUR.
- **Cancelling a sale** is a full credit note on the same day. A sale is never deleted.

## Consequences
- Built in Stage 8 (8b); amended with an "As built" note if reality differs.

## As built (Stage 8b, 2026-10-04)
- **Storage:** credit notes have their own tables, `credit_note` and `credit_note_item` (migration 0016), not `sale`
  rows with `doc_type = credit_note`. Every query that reads `sale` (the register's X/Z report, the output-tax tie-out,
  party documents, the journal backlog, the stock reconciliation, the cloud's census) counts sales; mixing returns
  into it would have needed a filter in each of them. The unused `sale` columns (`original_sale_id`,
  `returned_qty_flag`, `sale_item.returned_qty_milli`) stay empty. Each item names its `sale_item_id` and how much of
  the line was returned before it; a trigger refuses more than was sold on the line.
- **Numbers:** a per-terminal series with the kind letter `C` (ADR-0028), e.g. `T1C/2627/00001`; `credit_note`
  left the invoice-format document types, so a credit note never shares an invoice's number.
- **Amounts:** `computeReturn` (domain, ported to Go in `cloud/internal/domain/returns`) gives each returned line its
  cumulative share of the sale line's taxable value, each tax head and its COGS, so a line returned in any number of
  parts adds up to the line exactly. Part returns carry no round-off; the note that completes the whole bill takes
  back the sale's. Golden vectors: `packages/domain/fixtures/returns/return-golden.json`.
- **Refunds:** the part of the note that covers what the customer still owes on the bill goes to their account and is
  allocated to the bill; the rest is refunded by cash, UPI or card (the bill's own method by default), or all of it is
  credited to the account when asked. A cash refund needs an open register and lowers its expected cash; it is read
  from the credit note, not written as a `cash_movement`. Any credit left over is an ordinary settlement that
  `payments.allocate` can apply later.
- **Journal:** `SALE_RETURN_RULE` reverses revenue in 4100 itself, output tax by head and round-off, credits the
  refund account or AR, and moves the goods back Dr Inventory, Cr COGS at their stored cost (posting matrix).
  `allocation.source_type` and `party_ledger_entry.ref_type` gained `credit_note`; SQLite cannot widen a CHECK, so
  0016 rebuilds both tables with the same columns, indexes and triggers.
- **Cancel:** `sales.cancel` (permission `sales.cancel`, managers and owners) is a credit note of kind `cancel` for
  every line, dated today; it is refused once any part of the bill has been returned. Returns need `sales.edit`. A
  sale's own status never changes.
- **GSTR-1:** the note stores `gstr1_bucket` = `cdnr` (customer GSTIN) or `cdnur`, `na` outside the regular scheme.
- **Sync:** entity `credit_note` in the documents stream. The payload carries each line's sale-line snapshot (`sold`),
  so the cloud recomputes every line from the sale's own tax, then checks the totals, refund + credit = total, and
  the journal against the note's amounts.
