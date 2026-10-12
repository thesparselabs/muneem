# Phase-1 Tier A — implementation plan

Scope: FR-085 sharing, FR-086 estimates, FR-087 delivery challan, FR-088 payment reminders
(see `design/muneem-prd.md` §6B and `docs/competitive-audit.md`). Each reuses existing engines and keeps the app
offline-first — online actions queue and complete when connectivity returns.

## Sequencing & dependencies
1. **FR-085 Sharing** — build first; FR-088 reminders depend on it, and it's the highest value-to-effort.
2. **FR-086 Estimates** → **FR-087 Delivery challan** — share one "non-posting document" pattern (doc series +
   line items, no journals/stock), so build estimate first and have challan reuse it.
3. **FR-088 Reminders** — last; depends on sharing (channels) and the existing party ageing.

---

## FR-085 — Invoice & statement sharing (WhatsApp / email)

**Reuse:** `invoice.renderHtml` + `invoice.savePdf` already produce the PDF; party statements already render.

- **Contracts:** `share.send({ docType:'invoice'|'credit_note'|'statement', id, channel:'email'|'whatsapp', to })` →
  `{ status:'sent'|'queued', ref }`; `share.history({ docType, id })`.
- **Main service** `services/share/`:
  - **Email:** hand the PDF to the Go cloud mailer (we already have the cloud + S3), or a device SMTP config as a
    fallback. Cloud mailer is preferred (no SMTP setup for the shopkeeper).
  - **WhatsApp:** two options — (a) a WhatsApp Business provider via our cloud (true attach-and-send; needs a cloud
    account + opt-in), or (b) desktop fallback: save the PDF and open a `wa.me/<phone>?text=…` chat with a prefilled
    message for the user to attach. Ship (b) first; add (a) as the cloud piece.
  - **Offline:** queue sends in a local `share_outbox`, retry on reconnect (mirror the sync outbox worker pattern).
- **Migration (local):** `0023_share_log` — `share_log(id, business_id, doc_type, doc_id, channel, to, status,
  error, created_at, sent_at)`.
- **Renderer:** a "Share" action (Mail/MessageCircle icons) on the Sales list, POS last bill, and a party's
  statement; a small dialog to pick channel + confirm the number/email; show history.
- **Tests:** service sends/queues through a fake mailer/provider; offline → queued then sent; e2e-ui: share dialog
  opens and records a send.
- **Effort:** M. **Note:** true WhatsApp file-send needs the provider (cloud); the desktop fallback ships without it.
- **As built (ADR-0067):** doc types are `invoice`, `credit_note`, `customer_statement` and `supplier_statement`; the
  contract is `share.preview` / `share.send` / `share.history`. WhatsApp is option (b) only. Email is the cloud relay
  (`POST /v1/share/email`, Go SMTP), with no device SMTP fallback. The queue is the `share_log` table itself
  (migration 0023), not a separate outbox.

---

## FR-086 — Estimates / Quotations

**Reuse:** the sales **quote** engine (pricing + GST) computes an estimate without posting; `doc_series` already keys
by `doc_type`.

- **Contracts:** `estimates.create(draft)`, `estimates.get/list`, `estimates.convert({ id }) → { saleId }`.
- **Main service** `services/estimates/`: build from a sale-like draft, price via the quote engine, store as an
  estimate (NO journals, NO stock movement). `convert` creates a real sale from the stored estimate (then normal POS
  posting applies). Status: `open | converted | expired`.
- **Migration:** `0024_estimates` — `estimate`, `estimate_item`; add `doc_type='estimate'` series. Syncable like other
  documents.
- **Renderer:** Estimates route (list + new form reusing the cart/line UI), a **Convert to invoice** button, and
  print/share via the invoice renderer with a "QUOTATION" header variant.
- **Tests:** create → price matches a sale quote; convert → produces a posting sale with the same lines/total;
  estimate itself touches no journals/stock.
- **Effort:** M.
- **As built (ADR-0068):** migration 0024, Q kind letter. There is no `estimates.convert`: "Bill it" loads the estimate
  into the POS cart, and `sales.complete({ …, estimateId })` converts it inside the sale's transaction. `expired` is
  derived from `valid_until`. The quotation prints through an `InvoiceData.document` variant. Estimates sync on the
  documents stream, with Go GST verification.

---

## FR-087 — Delivery Challan

**Reuse:** the FR-086 non-posting-document pattern (series + line items), plus transport fields for later e-way-bill
reuse (FR-090).

- **Contracts:** `challans.create(draft)`, `challans.get/list`, optional `challans.linkInvoice({ id, saleId })`.
- **Main service** `services/challans/`: items + quantities, optional stock-out flag, transporter/vehicle/distance
  fields; no tax posting. Optional link to a later invoice.
- **Migration:** `0025_delivery_challan` — `delivery_challan`, `delivery_challan_item`; `doc_type='delivery_challan'`.
- **Renderer:** Challan route; print (A4 + thermal) and share.
- **Tests:** create + print; link to invoice; no journals.
- **Effort:** S–M (reuses estimate scaffolding).
- **As built (ADR-0069):** migration 0025 (not 0025_delivery_challan), H kind letter. There is no stock-out flag:
  stock moves only when the invoice bills it. There is no `challans.linkInvoice`: a supply challan is invoiced with
  "Bill it" at the till, linked inside the sale's transaction. A consignee can be a customer or typed by hand.

---

## FR-088 — Payment reminders (udhaar)

**Reuse:** the party **ageing/outstanding** we already compute; notification **consent** already captured; the
FR-085 channels for delivery.

- **Contracts:** `reminders.due({ overdueDays? }) → [{ partyId, name, outstandingPaise, oldestDueDate }]`;
  `reminders.send({ partyId, channel })`; `reminders.history({ partyId })`.
- **Main service** `services/reminders/`: from receivables + ageing, list parties past due; send via `share.send`
  with a reminder message + optional statement PDF; respect consent; suppress if paid since.
- **Migration:** `0026_reminder_log` — `reminder_log(id, business_id, party_id, channel, amount_paise, status,
  created_at, sent_at)`.
- **Renderer:** "Send reminder" on Parties → Outstanding (per party and bulk); a reminders screen with history.
- **Tests:** due list matches ageing; sending records a reminder and goes through the share channel; consent gating.
- **Effort:** M.

---

## Suggested build (master + agents)
- **Lead (me):** the shared `doc_series` / non-posting-document scaffolding, the migrations' numbering, the
  `share` service contract, and integration/verification.
- **Agent 1:** FR-085 sharing (service + outbox + renderer dialog).
- **Agent 2:** FR-086 estimates + FR-087 challan (they share the pattern).
- Then FR-088 reminders (small, by the lead or a short agent) once sharing + ageing are in place.

## Cross-cutting
- **Migrations** continue the sequence after 0022 (0023–0026); migrators reject gaps.
- **Offline-first:** sharing/reminders queue; estimates/challans are fully local documents that sync like any other.
- **Docs per PR:** CHANGELOG line (what + why), ADRs for the non-posting-document model and the share/queue design,
  and `build-stages.md` updated for the Phase-1 track.
