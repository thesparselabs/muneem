# ADR-0017 — Tender rules and register sessions

**Status:** Accepted, 2026-10-02

## Context
FR-031 (as clarified) requires Σ tender = total, change from cash only and UPI/card references. FR-099 asks for
X/Z reports, denomination counts, optional blind close, a variance threshold and "no close with an unfinished bill",
but the design gives no expected-cash formula, no Z numbering and no threshold.

## Decision
- **Tenders:** cash, UPI, card, other. Every tender is positive; non-cash tenders together may not exceed the total; only
  cash may over-tender and the change is taken from the cash tenders; `paid − change = total` (also a DB CHECK). Credit
  tenders arrive with customer balances in Stage 5.
- **Sessions:** one open session per terminal (DB-enforced). A sale needs an open session on its terminal.
- **Expected cash** = opening float + cash tendered − change given + cash in − cash out − safe drops.
- **Close:** counted cash (optional denomination breakdown); variance = counted − expected. A variance above
  `pos.varianceThresholdPaise` (default ₹100) needs `pos.approve` (managers), otherwise the close is refused with "a
  manager must close this register". Optional blind close (`pos.blindClose`) hides the expected figure until counted.
  Close is refused while held bills exist on the terminal.
- **Reports:** the X report is the live totals of the open session; the Z report is frozen into `z_report_json` at close
  and numbered by the terminal's session number.

## Consequences
- Variance postings to the books (short/over accounts) arrive with accounting in Stage 6.
