# ADR-0006 — Outbox rows written from Stage 1; the sync worker waits for Stage 7

**Status:** Accepted, 2026-09-26

## Context
PRD Constraint 8: sync must be designed in from the start. The LLD warns that retrofitting outbox writes means
rewriting the commit transaction everything depends on. Yet the user chose "foundation first", and a real sync engine
(retry, ordering, dead-letter, pull, hydration) is a stage of its own.

## Decision
Every business write in `@muneem/db-sqlite` inserts its `sync_outbox` row inside the same transaction from Stage 1.
No worker drains it until Stage 7. The status badge already reads the outbox so the UI is honest ("N waiting").

## Consequences
- Businesses created on the desktop stay local until Stage 7; device registration and login do hit the server directly.
- Stage 7 adds the worker without touching any existing transaction.
