# ADR-0058 — Heavy reads off the billing thread

**Status:** Accepted, 2026-10-05

## Context
Stage 9f measured the device at NFR-021's ceiling (500,000 sales, 20,000 SKUs, 50,000 customers; a 15.7 GiB file
once every sent outbox row and audit entry is counted). Billing itself stayed fast, but everything that reads the whole
history ran on the Electron main thread, the same thread that completes sales:

- the 6-hourly checks: journals and tie-outs 84 s, the audit chain 72 s, the stock slice 14 s, the 35-day summary
  drift 8 s, the party reconciliation 3 s;
- `diagnostics.getHealth`, polled every 15 s while Diagnostics is open, re-verified this device's whole audit chain
  (74 s);
- reports (ADR-0046 left the utility process "to come"): stock valuation 12.5 s, sales by product 5 s, balance sheet
  3.8 s;
- start-up ran `PRAGMA quick_check` on the main connection, and the report connection ran it again on first use:
  each reads the whole file, 6–7 minutes here.

## Decision
- **A read worker.** One `worker_threads` worker (`src/read-worker`, a third main-process entry) opens its own
  read-only connection and runs named, read-only jobs (`src/main/background/jobs.ts`): report runs, the summary
  drift, the party reconciliation, the journal checks, audit chains, stock keys and replay, `quick_check` and
  `foreign_key_check`. Each job reads one snapshot (a read transaction). Jobs queue in order; the worker starts on
  first use. In-memory databases (tests) run the same jobs inline.
- **Main keeps the writes.** A check reads in the worker and only heals on the main connection when it found
  something (summary rebuild, balance rebuild, stock levels, the audit-check record), as before.
- **Health shows the last audit verification** for this device's chain, recorded by `verifyAudit` (scheduled, or
  from Diagnostics); only with no verification yet does it verify, in the worker.
- **quick_check after an unclean exit only.** A normal quit writes `muneem.sqlite.clean-exit` after the database
  closes; start-up consumes the marker and skips `quick_check` when it was there. After a crash, a power cut or a
  restore swap there is no marker, so start-up checks as LLD §12 says. The read worker runs `quick_check` 15 minutes
  after start, at most once a day; a failure is logged as `DB_CORRUPT`, shown in Health, and the next start checks
  again (and offers the restore).
- **Dashboard stays on its read connection** in the main process: about 150 ms at 500k sales after the 9f query
  fixes, inside the 300 ms budget.

## Consequences
- Billing completes inside its 250 ms p95 while the scheduled checks and a whole-history drift check run.
- `ReportService.run`, the diagnostics checks and `getHealth` are async; IPC handlers already were.
- A corrupt page found by SQLite during the day still raises `SQLITE_CORRUPT` on the statement that touches it;
  the background check finds pages nothing has touched yet.
- LLD §12's start-up `quick_check` is now conditional; the LLD carries an as-built note.
- Still on the main thread: the notification detectors (due payments about 0.6 s per party type at 500k, low stock
  about 0.1 s) and the pre-migration backup and migration checks on an upgrade (about 21 minutes at 500k).
