# ADR-0045 — Year-end close

**Status:** Accepted, 2026-10-04

## Context
FR-096 asks for closing P&L to retained earnings with prior-year reports readable; ADR-0033 deferred closing journals to Stage 8. Statements today compute earlier years' profit.

## Decision
- **The closing journal:** an `fy_close` document is business-wide, keyed by (business, fy), and cloud-authoritative
  on the control stream like periods. It posts one closing journal dated 31 March: each income and expense account
  to 3300 Retained Earnings.
- **No opening journal:** the ledger is continuous, so balance-sheet accounts need none.
- **Statements:** they stop computing earlier years' profit for closed years, and a closed year's P&L leaves out
  its closing journal, so prior-year reports stay readable.
- **Late postings:** a document posting late into a closed FY (via ADR-0033) gets an **adjusting closing journal**
  for that FY, and a review item.

## Consequences
- Built in Stage 8 (8d); amended with an "As built" note if reality differs.
