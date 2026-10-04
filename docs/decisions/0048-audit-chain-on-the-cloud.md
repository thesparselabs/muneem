# ADR-0048 — Audit chain on the cloud

**Status:** Accepted, 2026-10-04

## Context
LLD §16 says the server verifies each device's audit hash chain on ingest; device audit rows never reach the cloud today.

## Decision
- **Upload:** audit rows sync as an append-only `audit_entry` stream.
- **Verification:** the cloud verifies each device's chain on ingest (`seq` with no gaps, `prev_hash` linkage,
  recomputed hash). A break is `AUDIT_CHAIN_BROKEN`: the batch is refused, dead-lettered and alerted, and the device
  shows it.
- **On the device:** Diagnostics verifies on demand and every 6 hours.

## Consequences
- Built in Stage 8 (8g); amended with an "As built" note if reality differs.
