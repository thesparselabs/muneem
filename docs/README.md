# Muneem project docs

Living documentation of **what the project is, what has been added, and why**. The design intent lives in
`design/` (PRD, PRD review, HLD, LLD); this folder records how that intent is actually being realised.

| Doc | Purpose | Update when |
|---|---|---|
| [CHANGELOG.md](CHANGELOG.md) | Every change that lands, with the reason behind it | every PR (CI fails a code PR that does not touch it) |
| [architecture.md](architecture.md) | The whole system in plain terms: parts, boundaries, invariants | a boundary, package or invariant changes |
| [build-stages.md](build-stages.md) | Status of each LLD §20 stage and what "done" meant | a stage starts, finishes, or changes scope |
| [decisions/](decisions/) | Architecture Decision Records: the non-obvious choices and their trade-offs | any decision a future engineer could reasonably question |

## Rules

1. **What + why, always.** A changelog line says what was added and the reason it was needed, not just a file list.
2. **Decisions get an ADR** the moment they are made, numbered sequentially, never edited after acceptance
   (supersede with a new ADR instead).
3. **The design docs stay the source of intent.** If reality diverges from `design/`, either fix the code or
   change the design doc in the same PR and say why in the changelog.
4. Plain language first, then the precise term. A shop owner should be able to follow the changelog headings.
