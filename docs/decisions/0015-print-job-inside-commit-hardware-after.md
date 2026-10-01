# ADR-0015 — The print job is part of the sale; printing and the drawer happen after commit

**Status:** Accepted, 2026-10-02

## Context
HLD §8 lists "enqueue print job" after COMMIT, while the `sales.complete` contract returns a `printJobId` and FR-100
wants durable, retryable jobs with reprint and "DUPLICATE" marking. A crash between commit and enqueue would lose the
receipt.

## Decision
- The structured receipt (`PrintDoc`) is built from the committed data and its `print_job` row (status `queued`) is
  inserted **inside** the sale transaction, so the job exists exactly when the sale does.
- After COMMIT the print queue renders the doc for the configured printer (32/42/48 columns, ESC/POS) and sends it,
  time-boxed. Failures mark the job `failed` with the error, show a banner and can be retried; they never touch the
  sale. Jobs still `queued` or `printing` at start-up are retried.
- Reprints are new jobs with `copy_no + 1`, `is_duplicate = 1`, and "DUPLICATE" printed.
- The drawer is kicked through the printer after a sale with a cash tender (or on demand), best effort.
- Printer configuration is device-local (`app_meta`), not synced. Adapters: a simulator that writes `.txt`/`.bin` files
  and a network ESC/POS printer on TCP 9100; USB / Windows spooler come later.
- The stored doc, not raw bytes, is kept, so a reprint on a different-width printer still lays out correctly.

## Consequences
- A receipt is never lost to a crash; at worst it prints after restart.
- `print_job` and `held_bill` are device-local and never reach the outbox.
