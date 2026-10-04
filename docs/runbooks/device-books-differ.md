# Device books differ from the cloud

**Alert:** `muneem-device-books-differ` (critical) fires when `max by (business_id, device_id) (abs(muneem_device_journal_diff))` > 0 for 7h.

## What it means
A device's journal totals (count, debits, credits, as of its documents cursor) differ from the cloud's journals up to the same seq, for more than one integrity run. ADR-0054 counts this as an unexplained imbalance.

## How to check
- Business health dashboard → Device journals minus cloud: which `kind` differs and by how much.
- Is the device fully synced (outbox 0, recent pull)? A device that pushed after its last pull can differ until its next run.
- Cloud side: `psql "$MUNEEM_OWNER_DATABASE_URL" -c "SELECT count(*), sum(l.debit_paise), sum(l.credit_paise) FROM journal_entry e JOIN journal_line l ON l.journal_id = e.id WHERE e.business_id = '<id>' AND e.server_seq <= <documentsSeq>"`.

## How to fix
- A count difference: a journal exists on one side only; find it by comparing journal ids (support bundle vs `journal_entry`).
- Same count, different totals: a journal was altered after sync; check the audit chain and review items.
- Record the cause in the pilot log; a product defect resets the shop's pilot day count (ADR-0054).
