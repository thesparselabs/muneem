# ADR-0033 — Posting dates, periods and late postings

**Status:** Accepted, 2026-10-04

## Context
FR-096 asks for period locks, and LLD §5.4 says a document dated into a locked period is neither rejected nor
silently posted. Stage 5 left open which period a purchase belongs to when its bill is dated in one FY and entered
in the next (ADR-0023 amendment). Year-end closing journals are deferred to Stage 8 (user decision, 2026-10-04).

## Decision
- **Posting dates.**
  - Each journal posts on its **document's date**.
  - A purchase posts on the **supplier bill date** — the accrual date and the ITC period — which settles the Stage 5
    question.
  - A cancellation posts on the day of the cancel.
- **Periods** are calendar months per FY, made on demand, either `open` or `locked`.
  - Locking needs `accounting.manage`.
  - Unlocking is allowed with a reason, and audited.
- **Late postings.** A document dated into a locked period posts into the **earliest open period after it**, with
  `late_posting = 1` and both dates kept. It is listed for review (`accounting.listLatePostings`). Nothing is
  refused, dropped or moved silently.
- **Retained earnings.** Until Stage 8's closing journal, the Balance Sheet computes retained earnings as the profit
  of all earlier years plus this year's.

## Consequences
- Filed periods never change, and every late document is visible.
- Stage 7 uses the same rule for documents synced in from other devices.
