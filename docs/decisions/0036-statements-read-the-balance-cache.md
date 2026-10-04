# ADR-0036 — Statements read the balance cache for whole months

**Status:** Accepted, 2026-10-04

## Context
At a year of data (about 1M journal lines), statements summed every line on each request. That took the Trial
Balance to 1.8 s, the Balance Sheet to 5.1 s and a ledger page to about 1 s, against budgets of 1 s and 50 ms (Stage
6f). `account_balance` (ADR-0030) already holds each account's debits and credits per calendar month, written in the
same transaction as the journal.

## Decision
- **Statement totals** (`accountTotals`, and so the Trial Balance, P&L and Balance Sheet) read **whole calendar months
  from `account_balance`**. Only the part-month edges of a range are summed from `journal_line`. This is exact because
  a journal's entry date always falls in its own period; late postings are dated on the open month's first day
  (ADR-0033).
- **Branch-filtered statements and ranges inside one month** keep summing the lines, because the cache has no branch.
- **Ledgers** walk the journal by date through a new index (`journal_line(account_id, entry_id, line_no)`, migration
  0013). The running balance is the balance before the page plus the page's own lines. A sparse account (under 2,000
  lines) reads its own lines instead.

## Consequences
- **Speed:** at a year of data, the Trial Balance takes under 50 ms, the P&L under 200 ms, the Balance Sheet
  160–490 ms, and a ledger page under 10 ms.
- **The cache must stay correct.** If it ever drifted between integrity checks, statements would show the drift until
  the next check rebuilds it. `postJournal` remains its only writer, and the 6-hourly check and Diagnostics rebuild it
  (ADR-0034).
- **Branch-filtered whole-year statements** are still line-based: about 1–5 s at this volume, with no budget yet. A
  branch column on the cache would fix that if pilots need it.
- **Evidence the results are unchanged:** the old and new implementations were compared on 120 random ranges (with
  and without a branch) and 60 paged ledgers, with identical output. The 6d tests pass unchanged.
