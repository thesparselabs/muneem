# ADR-0062 — A marketing landing site inside the monorepo

**Status:** Accepted, 2026-10-05

## Context
The product needed a public landing page that looks like a modern fintech SaaS site, built on the stack the team
already knows and without a second toolchain to maintain.

## Decision
- The landing page is a **standalone Vite + React 18 app at `apps/landing`** (`@muneem/landing`), not a route inside the
  Electron renderer — a desktop app and a marketing site are different artifacts with different lifecycles.
- It **reuses the workspace's existing dependencies** (`react`, `vite`, `tailwindcss` v4, `motion`, `lucide-react`,
  `clsx`, `tailwind-merge`). No new runtime dependency was added.
- It has its own `src/` and a self-contained design system (its own tokens and components), deliberately separate from
  the desktop renderer's, so marketing styling never leaks into the product and vice versa.
- Content and the product name live in `src/site.ts`; **"Lekha" is a working brand name** pending the final choice and
  a trademark/domain check — changing one constant renames the whole page.
- Honesty: no fake customer logos, testimonials or invented statistics. The figures shown are real product
  capabilities (500k invoices, sub-60 ms sale, 4 GB RAM, zero lost transactions), and the mock screens are clearly a
  product demo.

## Consequences
- `turbo run build` / `typecheck` now include the landing app; it has no tests and no `lint`/`gen` tasks, so those runs
  skip it.
- The final product name must be decided and swapped in `site.ts`, with the trademark/MCA/domain/store checks done
  before any public launch.
