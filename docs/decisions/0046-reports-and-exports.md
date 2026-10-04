# ADR-0046 — Reports and exports

**Status:** Accepted, 2026-10-04

## Context
FR-054 and PRD §25 list the reports; LLD §14 sketches a ReportDefinition engine run in a read-only utility process; FR-077 asks for CSV, XLSX and PDF exports. Nothing exports today.

## Decision
- **Definitions:** a `ReportDefinition` registry (LLD §14) gives each report its params schema, a run function,
  columns and totals.
- **Where they run:** on a read-only SQLite connection in a `reports` utility process, streamed and cancellable.
- **Exports:** CSV (UTF-8 BOM), XLSX (one maintained library) and PDF (printed from a hidden window), all through
  one writer interface.
- **Source:** device reports read local data. The cloud gains typed daily aggregates for future owner reports
  (Stage 7 carry), and FR-103's cloud fallback outside the retention window waits for Stage 9.

## Consequences
- Built in Stage 8 (8a/8e); amended with an "As built" note if reality differs.
