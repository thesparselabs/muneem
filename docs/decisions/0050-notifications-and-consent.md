# ADR-0050 — Notifications and consent

**Status:** Accepted, 2026-10-04

## Context
FR-074 lists notification triggers; FR-104 (DPDP) requires consent, export and erasure; ADR-0026 deferred reminders until consent and templates exist. The user chose in-app now, SMS/WhatsApp later.

## Decision
- **Storage:** notifications are local rows (kind, severity, entity, message, read/dismissed) raised by triggers.
  The triggers are:
  - low stock;
  - customer and supplier dues;
  - sync blocked;
  - backup failed or stale;
  - audit chain broken;
  - late arrivals;
  - update ready.
- **Consent:** customers carry DPDP consent (purpose, channel, given at, withdrawn at), with profile export and
  erasure that keeps statutory invoices.
- **Later:** SMS and WhatsApp sending is designed but not built.

## Consequences
- Built in Stage 8 (8h); amended with an "As built" note if reality differs.
