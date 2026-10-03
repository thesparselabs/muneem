# ADR-0026 — Customer credit at the POS

**Status:** Accepted, 2026-10-03

## Context
FR-040 asks for credit sales, limits, outstanding and due dates. Stage 3 left out the credit tender, although
`sale.credit_paise` and the `credit` tender method exist in the schema. LLD §9 makes the credit limit a cloud-wins
control value, and LLD §17 names `CREDIT_LIMIT_EXCEEDED`.

## Decision
- `credit` joins the POS tenders and needs a customer on the bill.
- `customer` gains `credit_limit_paise` and `credit_days`. **A NULL limit means no credit**; there is no "unlimited"
  value. Changing a limit needs `customers.approve` and is cloud-wins at sync.
- `sales.quote` returns the customer's outstanding and a `credit_limit` issue when outstanding + this bill's credit
  portion exceeds the limit. The commit refuses with `CREDIT_LIMIT_EXCEEDED`, unless the user holds
  `customers.approve`. Then the sale goes through and a `credit.limit_override` audit row is written in its
  transaction. (User decision, 2026-10-03; manager PIN override stays deferred.)
- The credit portion writes a customer ledger entry in the sale's transaction, as a new commit step after `document`
  (ADR-0019's order is otherwise unchanged), with due date = sale date + the customer's credit days.
- Payment reminders (FR-040) wait for consent capture and message templates (Stage 8).

*Amended before merge (5e, 2026-10-04):*
- **Where the limit is enforced.** The quote cannot refuse, because it has no tenders. It returns the customer's
  `credit` (balance, limit, available) for the payment screen, and the commit enforces the limit.
- **No limit set** counts as a ₹0 limit, so any credit for such a customer needs the override. It never means
  unlimited.
- **The balance is the customer's ledger balance,** so an advance on account adds room.
- **Where the entry is written.** The ledger entry is written by a `party` step after `stock`, which sales without
  credit skip.

## Consequences
- Cashiers (no `customers.approve`) cannot exceed a limit; managers and owners can, on the record.
