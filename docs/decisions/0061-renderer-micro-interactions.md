# ADR-0061 — Micro-interactions, icons and a token layer in the renderer

**Status:** Accepted, 2026-10-05

## Context
The renderer was plain Tailwind with a few hand-rolled component classes. The owner asked for a simple, minimal, sleek
UI with small animations that a first-time or low-literacy shopkeeper can follow. Three agents surveyed Magic UI,
Wensity UI and opensourceui.in. All three are MIT, ship component source into the repo, work with Tailwind v4 and make
no network calls at run time. All three are also young (Wensity, opensourceui.in) or effect-heavy (Magic UI), and all
assume shadcn's `cn()` helper and CSS-variable tokens.

## Decision
- **Own the source, take no library as a dependency.** Six components were adapted from those patterns into
  `src/renderer/src/components/`: NumberTicker, SuccessCheck, Skeleton, ShimmerButton, HoldToDelete, and a toast store
  with ToastViewport.
- **New dependencies:** `motion` (animation), `lucide-react` (icons), `clsx` + `tailwind-merge` (the `cn()` helper).
  Everything bundles at build time, so the app stays offline.
- **A shadcn-style token layer** (`--background`, `--primary`, `--border`, …) in `styles.css`, mapped onto the existing
  slate/blue palette. It changes nothing on screen; it lets copied components resolve to our look.
- **Motion explains, it does not decorate:** transform/opacity only, about 140–200 ms, used where it tells the user
  something (an item went into the bill, the total changed, the sale is done, keep holding to cancel). One accent only:
  the sheen on "Complete sale". No 3D, particles, marquees or confetti.
- **Reduced motion is honoured twice:** a CSS floor under `prefers-reduced-motion` (and `data-reduce-motion="true"` for
  tests or a kiosk), and `usePrefersReducedMotion()` in the components.
- **The billing path stays fast:** removing a cart line stays one click; hold-to-confirm is only for "Cancel whole bill",
  which cannot be undone. The cart rows animate with CSS once, when added, not on every edit.
- **Toasts are a polite live region**, not one `role="status"` per toast, so a toast never competes with a screen's own
  status line.

## Consequences
- The renderer bundle grows about 440 KB before compression, mostly `motion` and the icon modules.
- Copied components are our code: we test and fix them; there is no upstream to pull from.
- New screens should use the tokens and `cn()`, and reuse these components rather than add new effects.

## Addendum, 2026-10-05 — design-system refresh
The same approach was taken further into a full visual refresh: a logo, modernised button/input/select/table/card
styles in `styles.css` (so every screen lifts at once), a redesigned login, and a `DatePicker` calendar replacing
native date inputs. Four agents applied the shared `DatePicker`, `.select` and `.table-modern` across the accounts,
parties, inventory, purchases, payments, GST, expenses and catalog screens; summary and key-value tables were left
alone. No new runtime dependency beyond the ones this ADR already lists. Labels, roles and button text were preserved
so the Playwright suite still passes.
