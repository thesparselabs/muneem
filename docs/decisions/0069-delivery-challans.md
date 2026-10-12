# ADR-0069 — Delivery challans

**Status:** Accepted, 2026-10-12

## Context
FR-087 (PRD §6B, Phase 1 Tier A) asks for delivery challans: goods sent without an immediate tax invoice, for supply
with the invoice to follow, job work, approval, or another branch. A challan needs its own series, an optional link to
a later invoice, transport details an e-way bill can reuse later (FR-090), and printing on A4 and the thermal roll,
plus sharing. CGST Rule 55 lists what it must carry:
- its date and serial number (at most 16 characters, unique in the financial year);
- the consignor's and the consignee's name, address and GSTIN;
- HSN, description and quantity;
- taxable value, tax rate and amount;
- the place of supply when the movement is inter-state.

Estimates (ADR-0068) already give a priced, non-posting, synced document that can be billed at the till. The user
chose cloud sync for both.

## Decision
- **Same pattern as estimates.**
  - `delivery_challan` and `delivery_challan_item` (migration 0025). The item table has the same columns as
    `estimate_item`, so `repositories/pricedLines.ts` now reads and writes both; the estimate repository was moved
    onto it.
  - Lines are valued by `SalePricing` at the selling price with no discounts, which gives the taxable value, rate and
    tax Rule 55 asks for.
  - Nothing posts: no journal, stock movement or party entry. Creating one is idempotent on `commandId` and refuses a
    total the user did not see. It needs `sales.create`; reading needs `sales.view`.
- **Purpose:** `supply` (invoice to follow), `job_work`, `approval`, `branch_transfer` or `other`.
- **Consignee:** a customer on file, shown as on file today, or a consignee typed on the challan (name, address,
  GSTIN) for a job worker or another branch. One of the two is required. A typed consignee's GSTIN in another state
  makes the movement inter-state: its state is the place of supply, stored as an override with the reason
  "Consignee GSTIN".
- **Transport:** mode, vehicle number, transporter name and GSTIN/TRANSIN, distance in km, and the LR/transport
  document number. These are what an e-way bill needs.
- **Kind letter H per terminal** (`DE01H/2627/00001`, 16 characters, ADR-0028). `delivery_challan` leaves
  `INVOICE_DOC_TYPES`. It was listed there only because the LLD once modelled a challan as a kind of sale, and the
  invoice format cannot take a kind letter.
- **Stock does not move on a challan.** Stock leaves when the invoice bills it; goods out on job work, approval or
  branch transfer stay on hand. Moving stock on the challan would count it twice when the linked sale moves it too.
  Transfers between warehouses (FR-093) and job-work stock are later work.
- **Invoicing is billing at the till, and only for supply.**
  - "Bill it" on an open supply challan opens `/pos?challan=<id>`. The cart loads its lines and customer at today's
    prices.
  - The sale carries `challanId`. The challan is marked `billed`, with the sale's id and number, inside the sale's
    transaction.
  - A challan already billed, or one sent for anything but supply, refuses the sale whole.
  - The sale's hook is now `MarkBilledFrom(input, sale)`, which serves estimates and challans alike.
- **Printing and sharing.**
  - A challan prints on the shop's invoice template as a `document` variant: "Delivery Challan", "Challan No",
    "Consignee" in place of "Bill To", and rows for purpose, transport, transporter, distance, the LR number and the
    note. There is no invoice declaration.
  - The list offers the shop's template and the 80 mm roll.
  - `challans.renderHtml/savePdf` mirror `invoice.*`, and the share dialog sends `delivery_challan`.
- **Synced as a document.**
  - Entity `delivery_challan` is on the documents stream. `create` carries the lines, totals, purpose, a typed
    consignee (null for a customer) and the transport. `update` carries the invoice link (`status: billed`, `saleId`,
    `saleDocNumber`, `billedAt`).
  - On the Go cloud, estimates and challans share `verify.PricedDocument` (GST recomputed with the sale verifier) and
    a link check. An estimate's update must set `converted`, a challan's `billed`.
  - The reference server checks the totals.
  - The pull path files a challan under the origin's number, and the latest link wins.

## Consequences
- A challan cannot be edited, cancelled or closed (for example when job-work goods come back). It stays `open`.
- One challan is invoiced by one bill. Several challans on one invoice is not supported.
- Stock out on job work or approval is not tracked as stock until FR-093.
- E-way bill generation (FR-090) can read the transport fields as they are.
