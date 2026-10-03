# ADR-0029 — Cash payments and the drawer, and who may pay suppliers

**Status:** Accepted, 2026-10-04

## Context
A customer often pays an old bill in cash at the counter, and small expenses are paid from the drawer. The register's
expected cash (Stage 3) counts only `cash_in`, `cash_out` and `safe_drop` movements, so cash that moves for a
payment or an expense would make the Z report short or over. Separately, the role presets give cashiers
`payments.create` (to take a customer's payment) but nothing on suppliers. A single `payments.create` permission
would therefore also let a cashier pay suppliers.

## Decision
- **The drawer:** a cash payment or cash expense on a terminal whose register is open writes a `cash_movement` that
  points at its document (`ref_type`, `ref_id`):
  - `cash_in` for a customer's cash;
  - `cash_out` for paying a supplier or an expense.

  The X/Z arithmetic is unchanged. With no register open, the cash is taken to be outside the drawer and no
  movement is written.
- **Cancelling** writes the opposite movement only while the register it went through is still open. Otherwise
  nothing moves, and an audit row (`payment.cancel_cash_outside_drawer`) records it.
- **Who may pay:** a payment needs `payments.create` and the right to see its party (`customers.view` or
  `suppliers.view`). So a cashier can receive from customers but cannot pay suppliers; managers, owners and
  accountants can. Write-offs need `payments.approve`.

## Consequences
- A drawer counted after a cash receipt matches its expected cash, and the movement shows which receipt it was.
- Cash taken in or paid out with no register open has to be accounted for outside the drawer; Stage 6 posts it to
  1100 Cash in Hand either way.
- If a role should pay suppliers without seeing them (unlikely), the rule needs revisiting.
