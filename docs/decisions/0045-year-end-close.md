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

## As built (Stage 8d, 2026-10-05)
- **The document:** `fy_close` (migration 0019), one live row per (business, fy); `accounting.closeYear` /
  `accounting.recloseYear` need the new action **`accounting.close`** (owner by the full grant, accountant by preset;
  managers hold no accounting permission in the presets, so they cannot). The checklist (`accounting.getYearEnd`):
  the year has ended, every one of its twelve months is locked (lockPeriod makes missing months), and under the
  regular scheme the last month with GST activity is settled (`latestSetoffMonth` at or after it, 8c's rule).
  Composition and unregistered businesses skip the GST item. A closed year's months cannot be unlocked.
- **The journal:** source `closing`, `ref_type 'fy_close'`, dated 31 March, built by `closingLines` from each income
  and expense account's movement over the year (from the balance cache, closings included, so a re-close takes only
  what is left). **The one sanctioned posting into a locked month** is `postClosingJournal`, which only takes a
  `closing` journal dated a year's last day: the journal has to land in March for the per-month balance cache to stay
  exact (ADR-0036), and moving it to April would put last year's profit into this year. Every other path keeps
  ADR-0033's late-posting rule.
- **Numbering:** business-level, `CL/2526` and then `CL/2526/2`, `CL/2526/3` for adjustments, and no terminal is
  needed. Unlike documents (ADR-0037) two devices cannot both issue one: the cloud accepts one close per year and one
  adjustment per version.
- **Cloud-authoritative, so the journal waits for the cloud:** on a device that has synced (`sync_device` exists), a
  close or adjustment is stored as *requested* and pushed on the control stream with its journal already numbered and
  dated; the journal posts when the accepted version comes back, on every device the same way. A device that has
  never synced posts at once (nothing else can hold the business). So journals stay append-only and identical across
  devices — nothing ever has to be reversed when a close loses.
- **Payload:** the whole close each time — `{ id, businessId, fy, fyEnd, version, closings: [{ version, journal,
  balances: [{ code, type, netPaise }] }] }`; version 1 closes, each later version adds exactly one closing.
- **Cloud rules (reference and Go agree; fixture `year-close-once`):** a create is refused `INVALID_STATE` (new
  permanent code) when the year already has a close or not all twelve months are locked on the cloud; an update is
  refused unless it is the next version and keeps every earlier closing. Verification: each closing journal is
  `closing`, dated the year end, touches only the accounts its balances name (income or expense) plus
  `retained_earnings`, zeroes each of them, and puts the profit in 3300. Its journals are projected like documents'.
- **On the losing device:** the cloud's close arrives on the control stream; the device's own requested close is
  marked `superseded`, its unsent operations are superseded, and a local `fy_close_superseded` review item records it.
  A stale adjustment is dropped the same way.
- **Statements:** the P&L leaves out closing journals (subtracted from the cached months, filtered from the lines),
  so a closed year's P&L and its year-end Balance Sheet are unchanged by the close. The Balance Sheet leaves out the
  current year's own closing; its retained earnings are 3300 (closed years) plus the computed profit of earlier years
  not closed (shown as "Retained earnings (years not closed)"). The Trial Balance includes everything.
- **Late postings:** a local document dated in a closed year cannot reach it (its months are locked), so ADR-0033
  posts it in the next open month — in the new year — and the closed year is untouched. The only way income or
  expense lands in a closed year is a document synced in from a device that had not heard of the locks (ADR-0040);
  the cloud already lists it as a `late_arrival` review item, and the Year end screen shows the year as needing a
  re-close with the amount left. An adjusting closing journal is then posted by someone holding `accounting.close`
  (not automatically: a background apply has no user to post as, and every device would race to post it).
- **Hydration:** `fy_close` is a latest-state control type after `accounting_period`; a hydrated device posts the same
  closing journals and its Trial Balance matches.

