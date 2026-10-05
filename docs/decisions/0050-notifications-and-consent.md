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

## As built (8h)
- **Storage:** `notification` (migration 0020) with one open row per (business, kind, entity), enforced by a partial
  unique index. Device-wide kinds (sync, backups, audit chain, updates) are stored under the `_device` scope and show
  in whichever business is open. A raise is idempotent: the open row is refreshed in place (`unchanged` when nothing
  differs); a worse severity clears `read_at` and `dismissed_at` so a dismissed warning that turns critical comes
  back. A detector returns its kind's whole answer and `reconcileNotifications` resolves every open row it no longer
  names. A resolved condition that recurs opens a new row.
- **Local, not synced:** every trigger is derived from data the device already has (stock, the party sub-ledger,
  conflict_log pulled from the cloud) or is about the device itself (its outbox, backups, audit check, installed
  version). Syncing the rows would duplicate what each device computes, and read/dismissed is a per-till courtesy,
  not business data. Nothing is lost if the table is emptied: the next run raises what is still true.
- **Kinds and triggers** (`apps/desktop/src/main/notifications/detectors.ts`):
  - `low_stock` per product at or below its reorder level in this branch's warehouse (info; warning at or below
    zero); resolves when restocked.
  - `customer_overdue` per customer with open charges past their due date, net of unapplied credit (warning after 30
    days); `supplier_due` per supplier with charges due within 7 days (warning once overdue). Both read
    `partyDues` over the party-document union.
  - `sync_blocked` for a revoked or too-old device and for dead outbox operations (critical).
  - `audit_chain_broken` from the sync status (local check or a cloud `AUDIT_CHAIN_BROKEN`) (critical).
  - `backup_failed` for a local backup newer than the last good one (critical) and a failing upload (warning);
    `backup_stale` when the last good local backup is over 26 hours old, or none exists and the business is.
  - `review_items`: one count notification linking to Settings → Review (warning when late arrivals are among them).
  - `update_ready`: raised only through the hook below.
- **When they run:** every detector at start-up (device kinds), when a session opens a business that is not still
  being imported, and on the 6-hourly timer; the sync and audit detectors whenever the `sync.status` event's
  device status, dead count or audit flag changes; low stock 30 s after a commit that moves stock (one run per quiet
  spell). A failing detector is logged and the others still run.
- **The hook for 8i and later work:** `app.notifications.service.notify(kind, { severity, entityType, entityId,
  title, body, link })` raises or refreshes one notification and `resolve(kind, entityType, entityId)` closes it.
  The updater calls `notify('update_ready', { severity: 'info', entityType: 'release', entityId: version, ... })`
  when a download is verified and `resolve` once it is installed. Both emit `notification.new` only for a new or
  escalated row.
- **IPC and permissions:** `notifications.list` (open or all, cursor paging, most recently changed first),
  `notifications.counts`, `notifications.markRead` and `notifications.dismiss` (by id, or all visible when no ids).
  The channels need `business.view`, which every role holds; each kind is then filtered by what its subject needs:
  stock `inventory.view`, dues `customers.view`/`suppliers.view`, sync and review `sync.view`, backups and the audit
  chain `diagnostics.view`, updates nobody. Marking and dismissing touch only what the caller can see.
- **Consent:** `customer_consent` rows (purpose `payment_reminders`, channel `sms|whatsapp`, method, given_at,
  withdrawn_at, captured_by). A consent needs a phone number; one active consent per purpose and channel is the
  service's rule, not a constraint, so two tills recording one at the same time cannot make a pulled change fail.
  Consents travel inside the customer payload (`consents`), and a consent change bumps the customer's version. The
  apply path merges them by id and never undoes a withdrawal. Cashiers may record and withdraw consent
  (`customers.create`): withdrawal must be as easy as giving it.
- **Export:** `customers.exportProfile` (owner/manager, `customers.approve`) writes JSON or CSV through the 8a
  `saveFile` port: the profile, every consent with its history, and every document made out to the customer (cash
  sales included), with numbers, dates, amounts and status.
- **Erasure:** `customers.erase` (owner/manager, with a reason) is refused while the party ledger is not zero either
  way. It replaces the name with `Erased customer <id suffix>`, clears phone, email, GSTIN, address, city, PIN and
  the credit limit, withdraws every consent and sets `erased_at`; the payload sends the cleared fields as explicit
  nulls. The row, the state code and the ledger stay, so sales, credit notes, receipts and every tie-out are
  unchanged and each sale keeps its `customer_snapshot_json`. The audit row records the reason, not the old profile.
  An erased customer cannot be edited, given consent, or found by search. **On the cloud** (Go conflict matrix and
  the reference server alike) an erased customer stays erased: a write without `erasedAt` keeps the cloud's payload
  and leaves an `erasedAt` cloud-wins review item. **Limit:** audit rows written before the erasure keep the old
  profile, because the hash chain cannot be rewritten; they are the statutory trail and are not shown in the app.

## Reminder sender (designed, not built)
- **Where:** a cloud worker (Go, `cloud/internal/reminders/`), never the till, so a reminder goes out once however
  many devices hold the customer, and keys stay off devices.
- **What it sends:** a daily job reads the synced documents for customers with an overdue balance and an active
  `payment_reminders` consent on the channel, and queues at most one reminder per customer per channel per N days
  (setting, default 7), never on a customer erased or whose consent was withdrawn before the send.
- **Provider:** behind a `Sender` interface: an Indian SMS gateway registered on DLT (sender id and template ids
  approved by the operator) and the WhatsApp Business Platform through a BSP, with message templates approved by
  Meta. Both are per-business settings with credentials held by the cloud.
- **Templates:** fixed, pre-approved texts with variables only (business name, amount, oldest due date, a pay link
  later); the owner picks one per channel and cannot send free text, which is what DLT and WhatsApp require.
- **Opt-out:** every message says how to stop ("Reply STOP" for SMS; the WhatsApp opt-out button). An inbound STOP
  webhook withdraws the consent on the cloud as a cloud-authored customer update, which reaches every till by the
  normal pull; the till's withdraw button does the same in the other direction.
- **Records:** a `reminder_log` per send (customer, channel, template, amount, provider id, delivery status) for
  disputes and DPDP accountability, kept by the cloud only.
