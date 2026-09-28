# muneem

## Code style

- Follow SOLID: one responsibility per module/class, small focused functions, depend on abstractions (interfaces/injection) at boundaries, favor composition over inheritance.
- Comments are minimal. A short one-liner only where intent is genuinely non-obvious. No multi-line explanatory blocks, no restating what the code says, no section banners.
- Let naming and structure carry the explanation.

## Agent skills

Skills from [addyosmani/agent-skills](https://github.com/addyosmani/agent-skills) are installed in `.agents/skills/` and symlinked into `.claude/skills/`. Versions are pinned in `skills-lock.json`.

```sh
npx skills list      # show installed skills
npx skills update    # pull upstream updates
npx skills add <repo> # add another collection
```

Prefer an installed skill over an improvised workflow: `test-driven-development`, `code-review-and-quality`, `code-simplification`, `planning-and-task-breakdown`, `debugging-and-error-recovery`, `security-and-hardening`, `api-and-interface-design`, `frontend-ui-engineering`, and others in `.agents/skills/`.

## Project documentation (keep it current)

`docs/` is the living record of what exists and why; `design/` is the intent. Every PR that changes code must:

- add a line to `docs/CHANGELOG.md` under `[Unreleased]` saying **what** changed and **why** (CI job `docs` fails otherwise);
- add an ADR in `docs/decisions/` for any choice a future engineer could reasonably question (next number, never edit an accepted one — supersede it);
- update `docs/build-stages.md` when a stage starts or finishes, and `docs/architecture.md` when a package, boundary or invariant changes;
- change the design doc in the same PR if reality now differs from `design/`, and say so in the changelog.
