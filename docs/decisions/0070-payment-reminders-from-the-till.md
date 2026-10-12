# ADR-0070 — Payment reminders sent from the till

**Status:** Accepted, 2026-10-12

## Context
FR-088 (PRD §6B, Phase 1 Tier A) asks Muneem to remind customers of overdue udhaar balances, using the party ageing it
already computes. It also asks for:
- a reminder schedule;
- in-app, WhatsApp and SMS channels;
- respect for the consent captured for notifications;
- a reminder history, and no reminder when the customer has "paid since".

ADR-0050 records `payment_reminders` consent per channel (`sms`, `whatsapp`). It also designed, but did not build, a
cloud reminder sender: a daily job using DLT-registered SMS and WhatsApp Business templates, which needs provider
accounts the business does not have yet. FR-085 (ADR-0067) gave the till a WhatsApp click-to-chat hand-off and a way
to send a party statement.

## Decision
- **Who is due:** `reminders.due` lists customers past due with `partyDues`, the same query behind the
  `customer_overdue` notifications. It returns overdue amount, oldest due date, days overdue and bills for each, with
  their ledger balance, phone, last reminder and last receipt.
- **Channel:** WhatsApp, through the FR-085 share path. `reminders.send` shares the customer's statement
  (`customer_statement`) by WhatsApp hand-off with the reminder message. The PDF goes to Downloads and a `wa.me` chat
  opens for the user to attach and send.
  - The message is a standard text, editable in the dialog: amount overdue, since when, balance, a statement attached.
  - SMS waits for a DLT provider: the cloud sender in ADR-0050.
  - In-app is the existing `customer_overdue` notification, plus the Reminders screen it leads to.
- **Consent first:** a reminder needs the customer's active `payment_reminders` consent on WhatsApp (ADR-0050). Without
  it the customer is listed as `no_consent` and a send is refused. An erased customer has no balance, so is never due.
- **Schedule:** one setting, `reminders.everyDays` (1–90, default 7, as ADR-0050 proposed). A customer is
  - `reminded_recently` until that many days after the last reminder;
  - `paid_recently` until that many days after their last posted receipt (the "paid since" suppression);
  - otherwise `due`.

  `nextOn` says when. The service refuses a send that is not due, so the cadence holds whoever presses the button.
- **Records:** `reminder_log` (migration 0026) keeps each reminder with its recipient, the share that carried it, and
  the overdue amount, balance and oldest due date at the time. Like `share_log`, it is local to the device and never
  synced. `reminders.history` lists it.
- **Who may:** `reminders.due`, `reminders.preview` and `reminders.history` need `customers.view`. `reminders.send`
  needs `customers.edit`, because contacting customers about money is a manager's or owner's call. `reminders.send` is
  audited.

## Consequences
- Two tills of one shop do not see each other's reminders, so each keeps its own cadence. The cloud sender in ADR-0050
  is where cadence becomes shop-wide.
- There is no bulk send: each WhatsApp hand-off needs a person to press send. Bulk and unattended reminders come with
  the provider-based sender.
- Email reminders are not offered, because consent has no email channel.
- Schedules are per business, not per party or per invoice.
