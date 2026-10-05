# ADR-0064 — Whispr theme, full-screen layouts and an onboarding tour

**Status:** Accepted, 2026-10-05

## Context
The renderer used a hand-rolled slate/blue palette with no dark mode, and most screens were narrow centred cards that
wasted desktop space. The owner asked for a themed (light + dark) full-screen desktop experience, icons throughout, and
a guided onboarding tour, referencing Zoho Invoice and modern SaaS.

## Decision
- **Theme:** adopt the **Whispr** tweakcn/shadcn theme (teal primary, lilac accent) as CSS variables in `styles.css`
  for both light and `.dark`, mapped into Tailwind v4 via `@theme inline`. `@custom-variant dark` ties the `dark:`
  variant to the `.dark` class (set by a header toggle, remembered in `localStorage`, no-flash init in `index.html`).
  A base rule sets the default border colour to the theme border.
- **Tokens everywhere:** the shared component classes (`btn-*`, `input`, `select`, `card`, `table-modern`, …) and ~76
  route/component files use theme tokens (`bg-card`, `text-foreground`, `bg-primary`, `border-border`, …) instead of
  hardcoded slate/blue, so dark mode works across the app.
- **Full-screen layouts:** list and report pages run full width; long tables/lists use a `min-h-0 flex` column with an
  internal scroll container and a sticky header, which fixes the usual Chromium double-scrollbar/scroll-jump problems.
  Auth/setup screens stay centred.
- **Icons:** lucide icons on headings, primary and row-action buttons, empty states and status chips.
- **Onboarding tour:** a lightweight custom engine (no new dependency) — a spotlight overlay plus a narrated tooltip
  that navigates across screens, scrolls the target into view, and recomputes on resize/scroll. It auto-starts once on
  first run (never under automation — guarded on `navigator.webdriver`), with a floating "Take a tour" button to replay,
  and honours reduced motion.

## Consequences
- Built by two agents (screens; tour) and integrated by the lead; the lead owns `styles.css`, the theme toggle and the
  shell.
- Verified: typecheck, lint, build clean; all 33 Playwright UI tests pass.
- New screens should use theme tokens and the full-screen layout pattern, not hardcoded colours or narrow cards.
