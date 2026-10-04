# ADR-0037 — Who numbers a journal, and when a terminal is needed

**Status:** Accepted, 2026-10-04

## Context
Stage 6 made every journal take a terminal's branch and terminal, even when the journal had a number of its own. So
cancelling a payment, expense or purchase, setting a party opening and posting a write-off all started needing a
terminal. They had not needed one in Stage 5 (review point 6g-1). The app sends a session with no terminal to Setup,
but the API does not.

## Decision
- **A journal with a document number** (sale, purchase, debit note, payment, expense) takes that number. Its branch
  and terminal are the document's own.
- **A reversal** takes the original journal's number with "(rev)", and the original's branch and terminal. So a
  cancel never needs the session's terminal.
- **A journal without a document number** (write-off, party opening, stock document, cost correction, cash movement,
  manual journal) gets a `J` number from the posting terminal's journal series. Without a terminal it is refused with
  "Select a terminal for this device first". This also covers a cost correction that a purchase cancel causes, which is
  rare.
- **A business-level `J` series was rejected.** Two offline devices would issue the same numbers. That is the reason
  every series is per terminal (ADR-0014, ADR-0028).

## Consequences
- Cancels work again without a terminal, as they did in Stage 5.
- Write-offs and party openings still need a terminal. In the app this is always true once Setup is done.
- The backlog captures its terminal and user when a run starts and stops if the session moves to another business.
  The journals it numbers are therefore always numbered by a terminal of their own business.
