# ADR-0002 — Integer paise, one rounding primitive, identical numeric bounds in TS and Go

**Status:** Accepted, 2026-09-26

## Context
NFR-004 forbids float money. Two devices (and the server) must compute the same total for the same invoice.
JavaScript integers are exact only to 2^53−1; Go `int64` goes far higher. Different acceptance ranges would make the
two engines disagree on which inputs are valid.

## Decision
- Money in integer paise, quantity in integer milli-units, rates in integer basis points; percent discounts are given
  in basis points so no float enters the engine.
- `divRound` (HALF_UP on the absolute value, sign preserved, never `-0`) is the only rounding primitive; `pctOf` and
  `apportion` build on it. `apportion` uses BigInt intermediates.
- Both engines reject `|v| > 2^53−1` and `2|n|+|d| > 2^53−1` with `OVERFLOW`, even though Go could go higher.
- An ESLint rule makes `Math.round`, `toFixed` and float division on financial identifiers a build error;
  `scripts/schema-lint.ts` rejects float financial columns in migrations.

## Consequences
- ₹45 trillion in paise is the practical ceiling — far beyond any SMB.
- Every fixture value is exact and portable across languages.
