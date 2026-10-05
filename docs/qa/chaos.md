# Chaos and fault suite (Stage 9g)

The faults a shop's computer meets — a full disk, a power cut, a wrong clock, a printer pulled out, a flaky network and
a damaged database file — each injected on purpose, with what must still hold afterwards. The tests live in
`apps/desktop/test/chaos/`; they run in the normal desktop suite (CI job `node`) at CI settings, and harder in the
nightly CI job `chaos` and by hand with `pnpm chaos`.

## Faults, assertions and where they run

| Fault | How it is injected | What is asserted | Test | CI | Nightly / `pnpm chaos` |
|---|---|---|---|---|---|
| Disk full during a sale, purchase or return | `PRAGMA max_page_count` pinned to the file's size, so the commit gets `SQLITE_FULL` exactly as on ENOSPC | IPC answers `DISK_FULL` (transient) with a clear message; no row in any table changed; no open transaction; `quick_check` ok; after space returns the same `commandId` posts once and a replay returns the same document; the whole-document check passes | `diskFull.test.ts` | yes | yes |
| Disk full during a backup | `node:fs/promises` `open` mocked so the sealed `.mbk` write fails with `ENOSPC` part-way | the backup fails and is logged; health is `failing` with the reason; no partial `.mbk` or `.plain-*` file; the earlier backup still verifies; the database is untouched; the next backup succeeds | `backupDiskFull.test.ts` | yes | yes |
| Power loss mid-commit: returns, purchases (with debit notes and cancels), receipts and supplier payments (with cancels and write-offs), GST set-off with challans, year-end close (with set-offs and month locks) | a child posts one kind in a loop and is `SIGKILL`ed 0–`window` ms after it is ready, again and again; it resumes from the database | `checkDocuments`: `quick_check`, foreign keys; every document has its audit row, outbox row and journal(s) (two for a cancelled purchase or payment, none for a set-off with nothing to move); no orphan audit/outbox/journal/stock movement/party entry/allocation/cash movement; no gap, duplicate or consumed-but-unused number in any series; each document's FY is its series' FY; journals balance; tie-outs, stock replay, party reconciliation and every audit chain are green | `powerLoss.test.ts` (+ `documentsChild.ts`, `checkDocuments.ts`) | 20 kills per kind (~2.5 min) | 100 kills per kind |
| Power loss mid-sale | the Stage 3 kill loop | as above, for sales and credit notes | `test/crash/sales.crash.test.ts` | 20 kills | 100 kills |
| Device clock a week fast, then a day slow, across 31 March / 1 April | fake `Date` jumped on device A while B keeps true time | bills are dated by the device clock and filed in that date's FY (2025-26 and 2026-27 series side by side); the 2025-26 series carries on 1, 2, 3, 4 with no gap or duplicate after the jumps; a bill dated into locked March posts late into April and is listed as a late posting, and only it; both devices sync to equal books, healthy, no dead letters | `clockJumps.test.ts` | yes | yes |
| Printer unplugged mid-shift | a real TCP 9100 listener closed and reopened on the same port | each sale commits in well under a second while the printer is gone; jobs are `failed` with the reason; after re-plugging, each retry prints exactly one copy; a printed job cannot be retried | `printerUnplugged.test.ts` | yes | yes |
| Printer cut off mid-job, or hanging | an injected `ReceiptPrinter` that fails after reading the job, or never answers | the job fails (with the reason, or "did not respond in time" at the deadline); sales commit while it hangs; the retry prints once | `printerUnplugged.test.ts` | yes | yes |
| Network flapping mid-sync | the reference server behind the fault injector: requests dropped, answers lost after the server applied them, 500s, duplicates, and an offline round in four; pulls capped at five changes a page | drops and lost answers hit both pushes and pulls; afterwards every sale is held once by the cloud and by both tills, credit notes too; books equal and healthy; no dead letters, nothing unsent, no duplicate number; each device's audit chain on the cloud equals its own | `networkFlaps.test.ts` | yes | yes |
| Database file damaged (pages, or the header) | bytes overwritten in the closed file | start-up refuses it with `DB_CORRUPT`; the latest local backup is offered and restored; the damaged file is kept beside the database; the restored device pulls back what it synced after the backup, its books equal the original's, it bills on with the next number, and (pages) its audit chain on the cloud carries on unforked | `corruption.test.ts` | yes | yes |
| Database damaged and no local backup | as above, backups deleted | the device starts empty with the damaged file kept; after sign-in a cloud restore and a pull bring the books back to the original's | `corruption.test.ts` | yes | yes |
| Double submit; kill during a sync claim; clock jump back an hour; two terminals selling the last unit | §37 with the review additions | nothing lost or duplicated; books, stock, payments and audit agree | `test/sync/scenario37.test.ts` | yes | yes |
| Sync faults over many seeds | the seeded simulation (ADR-0042) | no loss, no duplicates, convergence, deterministic conflicts | `test/sync/simulation.test.ts` | 20 seeds | 200 seeds |
| Server refuses a skewed clock, then recovers | a device clock 10 minutes out against the real Go cloud; the reference transport for the push engine | the push is refused with `DEVICE_CLOCK_SKEW` without losing or counting anything and without spending a refresh token; it syncs once the clock is right | `test/sync/e2eCloud.test.ts` (`pnpm e2e:cloud`), `test/sync/pushEngine.test.ts` | `e2e-cloud`; push engine in `node` | — |

`pnpm chaos` runs `test/chaos` and `test/crash` with 100 kills per kind on one worker (about 12 minutes). The nightly
job then runs §37 and the simulation with `MUNEEM_SIM_SEEDS=200`. By hand: `pnpm --filter @muneem/desktop crash-loop
--scenario purchases 50` (also `returns`, `payments`, `setoff`, `yearEnd`, `sales`) — the way to run the kill loop on
Windows.

## Bugs found and fixed

1. **A full disk said "Something went wrong".** `SQLITE_FULL` reached the cashier as `INTERNAL`. It is now
   `DISK_FULL` (transient): "The disk is full. Free some space on this computer, then try the same action again." The
   commit is rolled back whole, and retrying the same command posts it once.
2. **Most damaged files crashed start-up instead of offering a restore.** Only a `quick_check` that *returned* errors
   became `DB_CORRUPT`; a damaged header (`SQLITE_NOTADB`) or a page too broken to walk (`quick_check` itself throws
   `SQLITE_CORRUPT`) escaped as a plain error, so the app died at boot with no dialog. `openDatabase` now reports both
   as `DB_CORRUPT`.
3. **After a start-up restore the device never got back its own later work.** The start-up restore did not set the
   8f catch-up flag, so sales synced after the backup stayed only in the cloud. It now does, and verifies a plain
   pre-migration copy with `quick_check` before using it.
4. **After any restore of this device's own older backup, the next bill failed** (`UNIQUE constraint failed:
   sale.series_id, doc_seq`). The catch-up pull brought back the documents numbered after the backup, but the
   series still pointed at the backup's next number. When the catch-up pull ends, each series now moves past the
   highest number it holds (`realignDocSeries`), journals included. This affected the 8f Diagnostics restore too; the
   8f test now bills after the restore.
5. **The start-up restore forked the device's audit chain.** It now carries over this device's audit rows written
   after the backup from the damaged file, where they still read and still link (ADR-0048's rule for a restore). The
   damaged file is no longer overwritten: it is kept as `muneem.sqlite.corrupt-<time>`.

The start-up dialog (`askCorruptChoice` in `src/main/index.ts`) now offers "Restore latest backup", "Start empty and
restore from the cloud" and "Quit"; the logic is `recoverCorruptDatabase` in `src/main/backups/recovery.ts`.

## Known gaps (not fixed here)

- **Audit rows after the backup are lost if the damaged file cannot be read at all** (header gone). The restored
  device's next audit rows reuse seqs the cloud already holds, and the cloud rejects them as `AUDIT_CHAIN_BROKEN`
  (loudly, as a review item). The books are right; the audit trail on the cloud stops for that device. Closing it
  needs the cloud to hand a device its own chain tip, or the device to start a new chain after such a restore.
  Until then, "Start empty and restore from the cloud" avoids the fork (a new database is a new device).
- **A clock set back a day blocks selling what was added or repriced today** ("Tea has no selling price"): prices
  start on the day they were set, and the device's date decides which price applies.
- **NFR-018's "reject or flag invoice dates outside [last bill date, now + tolerance]" is not built.** A clock a week
  fast dates bills a week ahead (and in the next FY near 31 March); a clock running fast can also lock a month early.
  The cloud refuses a device more than 5 minutes off (`DEVICE_CLOCK_SKEW`), so such bills wait until the clock is put
  right, but they keep their dates.
- **A network printer can report "printed" for a receipt cut short.** Port 9100 has no acknowledgement; once the bytes
  are handed to the OS the job is done. The cashier reprints (marked DUPLICATE).
- **A printer that hangs and prints late** after the job was marked failed, and is then retried, prints twice; the
  failure message says to check the paper before retrying.
- **The IPC audit row is written after the command's own commit.** If only that write hits a full disk, the cashier
  sees `DISK_FULL` although the document was saved; the retry with the same command returns it, so nothing doubles.

## Only testable on Windows or real hardware (for the manual checklist)

- A real disk filling up on NTFS during a sale and during the nightly backup (SQLite's own ENOSPC path, and
  `db.backup()`'s copy, which the mock does not reach).
- A real power cut (not a process kill) while billing, on the target hardware: the database opens, `quick_check`
  passes, and the books tie out. Also `pnpm crash-loop --scenario <kind> 50` on Windows for each kind.
- Changing the Windows clock and time zone from Settings while the app runs (with and without automatic time).
- Pulling the USB cable of a spooler printer mid-job and turning it off: the Windows queue's paused/offline states,
  the job's outcome, and the retry.
- The "database problem" dialog itself: its buttons, the relaunch, and signing in to restore from the cloud.
- Pulling the network cable mid-sync against the real cloud over TLS.
- An antivirus or backup tool holding the database file open while the app writes.
