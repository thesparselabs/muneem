# ADR-0013 — The Stage 3 sale commit, with seams for stock and journal

**Status:** Accepted, 2026-10-02

## Context
HLD §8 puts stock movements, the stock projection and journal entries inside the sale's transaction, and FR-089 wants
COGS posted in the same transaction. The LLD schedules the inventory engine for Stage 4 and accounting for Stage 6, and
`journal_entry` needs accounting periods that do not exist yet. The LLD also warns that retrofitting writes into the
commit means rewriting it.

## Decision
- A Stage 3 sale writes, in one `BEGIN IMMEDIATE` transaction: validation, server-side pricing and GST, the document
  number, `sale` + `sale_item` (with per-line tax snapshots) + `sale_tender`, the `print_job` row, one audit row and one
  outbox row carrying the whole sale aggregate.
- The commit is an ordered list of named steps. Stage 4 adds "stock" and Stage 6 adds "journal" between the tender and
  print-job steps; nothing else in the transaction changes.
- `sale.cogs_paise` and `sale_item.unit_cost_paise` stay 0 until Stage 4.
- Cancel, returns/credit notes, credit tender and manager PIN override are not in Stage 3.

## Consequences
- Until Stage 4, stock on hand is not reduced by sales; Stage 4 must not back-fill movements for Stage 3 sales silently.
- The kill -9 suite asserts "no partial sale, no orphan audit/outbox/print job, no consumed number"; Stages 4 and 6
  extend it to movements and journal lines.
