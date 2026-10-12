# ADR-0067 — Sharing documents by WhatsApp and email

**Status:** Accepted, 2026-10-12

## Context
FR-085 (PRD §6B, Phase 1 Tier A) asks for an invoice, a credit note or a party statement to reach the customer as a
PDF over WhatsApp or email, queued while offline, with what was sent kept against the document. Every document can
already be rendered (invoice templates, ADR-0063; the credit note's receipt; the party ledger report, ADR-0046), and
the till is often offline. Sending real WhatsApp messages needs a WhatsApp Business provider account, approved
templates and opt-in (ADR-0050's reminder sender); sending real email needs an SMTP relay.

## Decision
- **WhatsApp is a hand-off, not a send.** Muneem saves the PDF to Downloads and opens `https://wa.me/<number>?text=…`
  with the message; the user attaches the file and presses send in WhatsApp. It works with no account, no template
  approval and no opt-in, and costs nothing. The share is recorded as `opened`, since Muneem cannot know whether the
  message went. A 10-digit mobile is read as Indian (`91…`); any other number needs `+` and its country code. The main
  process opens only links that start with `https://wa.me/`, and only ones it built.
- **Email goes through the cloud.** The device posts the PDF (base64) with the recipient, subject and message to
  `POST /v1/share/email` (OpenAPI, ADR-0007). The Go API relays it over SMTP (`cloud/internal/mail`: STARTTLS on
  `smtp://`, TLS on `smtps://`) from `MUNEEM_MAIL_FROM`, with the shop's name as the display name and the shop's
  address as `Reply-To`. The shopkeeper configures nothing, and SMTP credentials never sit on a till.
- **The device keeps a queue.** `share_log` (migration 0023) records every share; an email waits there with its PDF as
  `queued` and is claimed (`sending`) before each attempt, so the immediate try and the 60-second drain never send it
  together. A send succeeds → `sent` and the PDF is dropped. Offline, a busy or unconfigured relay, an expired token
  (refreshed once), or a business the cloud has not seen yet → back to `queued` after 30 s, 1 min, 2 min … up to an
  hour, for 24 attempts. A refusal the cloud will never accept (validation, permission, a revoked device) → `failed` at
  once. A crash mid-send puts `sending` rows back in the queue at start-up. Only the open business's emails are sent,
  because the cloud checks the signed-in user's membership.
- **The cloud sends each share at most once once it is acknowledged.** `share_email` (Postgres migration 0010, RLS
  per business) is keyed by (business, share id): a share already `sent` answers 200 with its first `sentAt` and no
  second email; one left `sending` by a relay failure is sent again (at-least-once until the device hears back). The
  PDF is never stored. The route needs a member's registered, signed device; checks every header field for line
  breaks, one bare recipient address, a ULID share id, a plain `.pdf` name and real PDF bytes; caps the PDF at 1 MiB
  (its base64 must fit the API's 2 MiB body limit; the device checks first and says so); and allows 500 emails per
  business per 24 hours (429, retried later). Without `MUNEEM_SMTP_URL` it answers 503 and devices keep their emails.
- **Local and never synced**, like notifications (ADR-0050): `share_log` is this till's delivery record. It is in the
  device's backups but not in other devices' history.
- **What can be shared, and by whom.** `share.preview`, `share.send` and `share.history` need `business.view`; the
  service then requires `sales.view` for an invoice or credit note, `customers.view` for a customer statement and
  `suppliers.view` for a supplier statement, so a cashier can send a customer their bill or udhaar statement. The
  invoice uses the business's chosen template and page size; a credit note is its 80 mm receipt; a statement is the
  party ledger report under a "Statement of account" title, for the whole history or the range on screen. The dialog
  starts from the party's phone or email on file and a standard message, both editable. `share.send` is audited.

## Consequences
- Phase 1 ships without a WhatsApp provider. True attach-and-send on WhatsApp (and SMS) needs a BSP account and
  approved templates; it can be added as another channel behind the same queue when the business takes one on.
- Operations must provide an SMTP relay with SPF and DKIM for the sending domain (docs/operations/deploy.md);
  deliverability is the relay's.
- The cloud learns recipients' addresses and keeps `share_email` rows (recipient, size, time), not the documents.
- FR-088 reminders will reuse this path for their WhatsApp hand-off and emailed statements.
