# ADR-0065 — In-app bilingual manual and a period-aware dashboard

**Status:** Accepted, 2026-10-05

## Context
New shopkeepers needed help understanding each screen, and the dashboard only showed "today". The owner asked for a
multi-language manual, contextual guidance, and Today/Week/Month views with richer charts (à la Zoho / TallyPrime).

## Decision
- **In-app manual:** a right-side help drawer, driven by a typed content map (`lib/help/content.ts`) keyed by route,
  with an **English and a Hindi** variant per entry (what the tab is for, how it works, keyboard shortcuts). Language is
  remembered in `localStorage`. The floating help button (bottom-right) is a menu: **User manual** or **Take a tour**;
  the drawer's "Show me" launches the existing guided tour. Content is data, not a full i18n framework — the app UI
  itself stays English for now.
- **Dashboard periods:** `reports.dashboard` takes `period: 'today' | 'week' | 'month'` (default today, so `{}` still
  works). Week = last 7 days, Month = last 30 days (rolling, labelled "Last 30 days"); figures aggregate the existing
  daily-summary tables over the window, each shown against the previous window (delta). New figures: average bill,
  products sold, new customers, top categories, expense breakdown, receivables vs payables. All new schema fields are
  optional for back-compatibility.
- **Charts:** inline SVG only (no chart dependency), themed with the Whispr tokens and a small fixed series palette —
  a net-sales area/line, a payment-method donut, and horizontal bars for categories, expenses and receivables.

## Consequences
- Built by two agents and integrated by the lead; typecheck, lint, build clean and the dashboard/report tests pass.
- The manual's non-POS copy was written from route names/headings and should get a wording review over time.
- Dashboard period windows are rolling (not calendar week/month); if a calendar month is wanted later it is a small
  change in the service.
