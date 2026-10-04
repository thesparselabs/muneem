# ADR-0047 — Backups and key escrow

**Status:** Accepted, 2026-10-04

## Context
FR-071 asks for encrypted cloud backup and restore; its clarification leaves the key holder open. Local backups today are plain copies with no retention. The user chose a cloud-escrowed key (2026-10-04).

## Decision
- **Format:** a backup is the online-backup SQLite copy, `quick_check`ed and encrypted with AES-256-GCM using a
  per-business data key. A signed manifest records the hash, schema version and row counts.
- **The key:** generated on first backup, kept in the OS credential store, and escrowed to the cloud. The cloud
  stores it wrapped by a server master key, from env/KMS.
- **Retention:** 7 daily, 4 weekly and 3 monthly backups locally; the cloud keeps the last 30.
- **Restore order:** first a local backup, then a cloud backup (fetch the escrowed key, download, verify, swap),
  then hydration.

## Consequences
- Built in Stage 8 (8f); amended with an "As built" note if reality differs.
