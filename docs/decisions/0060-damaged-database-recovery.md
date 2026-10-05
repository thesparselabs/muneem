# ADR-0060 — Recovering from a damaged database at start-up

**Status:** Accepted, 2026-10-05

## Context
NFR-019 asks for a documented "database corrupted" journey ending in cloud restore. The 9g chaos suite found that
most damage (a broken header, or pages too broken for `quick_check` to walk) crashed start-up instead of reaching the
restore dialog; that a restored local backup never pulled back this device's own later work; that the next bill then
failed on a stale series number; and that the restore overwrote the damaged file and forked the device's audit chain.

## Decision
- **Detection:** `openDatabase` reports `SQLITE_CORRUPT*` and `SQLITE_NOTADB` raised while opening or checking as
  `DB_CORRUPT`, as well as a failing `quick_check`.
- **Choices:** the start-up dialog offers "Restore latest backup" (when one is on disk), "Start empty and restore from
  the cloud", and "Quit".
- **The damaged file is kept** as `muneem.sqlite.corrupt-<time>` (with its WAL) for support, in both cases; it is
  never overwritten.
- **Restore latest backup** treats the backup as this device's own: it must pass `quick_check`, it gets the 8f
  catch-up flag so the first pull brings back what this device synced after it, and this device's audit rows written
  after the backup are carried over from the damaged file where they still read and still link (ADR-0048).
- **Start empty** opens a new database, which is a new installation and so a new device to the cloud; after sign-in the
  owner restores the newest cloud backup (8f) and a pull brings the rest.
- **Series after a catch-up:** when a catch-up pull ends, every series moves past the highest number held for it
  (`realignDocSeries`), so this device never reissues a number it used after the backup. This also applies to the 8f
  Diagnostics restore.

## Consequences
- If the damaged file cannot be read at all, audit rows the cloud took after the backup cannot come back; the
  restored device's next rows are refused as `AUDIT_CHAIN_BROKEN` (a review item). The books are unaffected. Closing
  this needs the cloud to return a device's chain tip, or a new chain after such a restore; until then "Start empty"
  avoids the fork.
- The journey and its tests are listed in `docs/qa/chaos.md`.
