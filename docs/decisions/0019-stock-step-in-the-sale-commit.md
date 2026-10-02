# ADR-0019 — Where stock happens in the sale commit

**Status:** Accepted, 2026-10-02. Supersedes the step placement in ADR-0013.

## Context
ADR-0013 reserved a "stock" step after the sale document. But `sale_item` is append-only, and its `unit_cost_paise`
and `cogs_paise` (and the sale's `cogs_paise`) must be known when the lines are written.

## Decision
- The commit steps are: number → **cost** → document → **stock** → receipt → record.
  - **Cost:** works out each line's issue cost from the current level and applies the negative-stock policy.
  - **Document:** writes the lines with cost and COGS.
  - **Stock:** posts one `sale` movement per line and updates the levels.
- The sale's outbox aggregate includes its movements.
- Sales made before Stage 4 have no movements and are not back-filled. Stock starts from opening stock.
- Stage 6 adds a journal step after "stock".

## Consequences
- The kill -9 suite also checks that every sale since Stage 4 has one movement per line, and that replay = projection.
