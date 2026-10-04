# Domain golden vectors — the cross-language contract

These JSON files are the **single source of truth** for what the domain engines must compute.
Two implementations exist (HLD §5.1):

- `packages/domain` (TypeScript, runs on the shop's computer)
- `cloud/internal/domain` (Go, runs on the server for sync-ingest verification)

Both test suites load these exact files. A paise-level difference fails CI in either language.

## Provenance

- Cases named `HAND …` have expected values typed in by a human and are asserted inside
  `scripts/gen-fixtures.ts` before the file is written.
- All other cases are engine-generated and then **frozen**. Regenerating this file is a
  behaviour change: review the diff line by line, never regenerate to "make it green".

## Changing an engine

Land the TS change, the Go change, and the fixture extension in the **same PR**.

## Numeric domain (both implementations must agree)

All values are integers with `|v| <= 2^53 - 1` (JS safe-integer range). `divRound(n, d)` additionally
requires `2|n| + |d| <= 2^53 - 1` and throws `OVERFLOW` otherwise. The Go port enforces the same bounds
even though `int64` could go higher — the two engines must accept and reject exactly the same inputs.

## Compliance scenarios (`compliance/scenarios.json`)

Twelve whole business days (Stage 9h, for CA review), built in `scripts/compliance/`. Every scenario is `HAND`: its key
invoice totals, tax heads, GSTR-1 rows, HSN rows and journals are typed in from a worked calculation and asserted before the
file is written. TypeScript checks the whole result (returns, journals, tie-outs); Go (`cloud/internal/domain/compliance`)
checks the parts it ports — invoice tax, credit notes and set-off. After regenerating, run
`pnpm --filter @muneem/domain gen:compliance` so the CA pack's generated tables in `docs/compliance/` follow.
