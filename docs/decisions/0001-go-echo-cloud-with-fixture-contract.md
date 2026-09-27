# ADR-0001 — Cloud in Go (Echo); engine equality enforced by shared fixtures

**Status:** Accepted, 2026-09-26

## Context
HLD §5.1 originally chose NestJS so the GST/costing/accounting engines would be literally the same TypeScript code on
the device and the server, letting sync ingest re-verify every document with zero risk of arithmetic divergence.
The team prefers Go (single static binary, low memory, existing expertise).

## Decision
Cloud API in Go with Echo. The engines exist twice: TypeScript in `packages/domain`, Go in `cloud/internal/domain`.
Equality is **enforced**, not assumed:
- `packages/domain/fixtures/**` golden vectors are loaded by both test suites; a paise-level difference fails CI.
- `scripts/diff-fuzz.ts` compares random invoices nightly.
- Any engine change lands in both languages in the same PR with the fixture suite extended.

## Consequences
- Two implementations to keep in lockstep (the accepted cost).
- Fixture files are frozen contracts: a diff is a behaviour change to review, never regenerated to get green.
- Design docs updated to state the trade-off honestly (HLD §3.2, §5.1, AD-2, risk register).
