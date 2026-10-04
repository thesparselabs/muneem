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
