# Muneem PRD v1.0 — Review & Recommended Changes

**Reviewed:** 2026-09-26 · **Against:** `muneem-prd.md` v1.0 · **Companions:** `muneem-hld.md`, `muneem-lld.md`

The PRD is unusually strong on offline durability, Electron security and audit posture. The gaps are concentrated in three places, all of which are **data-model-forcing** — they cannot be deferred to Phase 2 without a migration later:

1. **GST arithmetic is under-specified.** Rounding policy, bill-discount apportionment, place-of-supply determination, tax treatment classes and rate history are all missing. These decide column types and invoice-line shape.
2. **Inventory has no valuation method and no oversell policy.** FR-019 tracks *quantity* only, but FR-054 promises Stock Valuation and P&L. Gross profit is currently undefined.
3. **Sync is one-directional in the spec.** FR-066 describes device→cloud only. There is no down-sync, no new-device hydration, and no story for *two POS terminals in one shop with the internet down* — which is the exact ICP in §2.1 ("1–3 outlets", "POS terminals" plural in FR-010).

Below: blocking corrections, then new FRs (numbered FR-085+ to avoid renumbering), then clarifications and NFR additions.

---

## 1. Blocking corrections to existing requirements

### C-1 — §17 inventory invariant is arithmetically wrong (and contradicts FR-019)

§17 says:

```text
Opening + Purchases + Transfers In - Sales - Transfers Out - Returns - Adjustments = Closing
```

FR-019 says `+ Stock Adjustments` and `- Returns`. Both are wrong, because:

- **Sales returns increase** stock; **purchase returns decrease** it. "Returns" is not a single sign.
- **Adjustments are signed** — a positive recount and a damage write-off cannot share one term.

**Replace both with a signed-movement definition** (this is also the only version that survives sync, per §21):

```text
Closing(product, warehouse, t) = Σ signed_qty of all stock_movements up to t

movement_type          sign
opening_stock          +
purchase               +
purchase_return        -
sale                   -
sale_return            +
transfer_in            +
transfer_out           -
adjustment             ± (explicit)
```

Stock level is a **cached projection** of that ledger, never an independently mutated number. Add: "the system must be able to rebuild any stock level by replaying movements, and a nightly self-check must compare cache vs replay."

### C-2 — FR-035 invoice numbering is unimplementable alongside FR-064 (offline, multi-device)

A single gap-free `INV-2026-000001` sequence cannot be shared by two terminals that are both offline. Reserving blocks creates permanent gaps; renumbering at sync breaks FR-064 ("ID must remain stable") and breaks printed customer copies.

**Change FR-035 to mandate one series per (branch, terminal, financial year).** GST law permits multiple concurrent series as long as each is unique and consecutive within itself, so this is compliant:

```text
Series key:  <branch_code>/<terminal_code>/<FY>
Number:      MUN/DEL1/T01/26-27/000123
```

Rules to add: number is allocated **inside** the local commit transaction; never reissued; never changed by sync; a gap is an integrity alert, not a normal state; series resets on financial-year rollover; credit notes, debit notes, purchase invoices, payment receipts and delivery challans each get their **own** series (GST requires distinct document series, and GSTR-1 "Documents Issued" reports from-to ranges per series).

### C-3 — FR-046/§17 do not define rounding, so two devices can compute different totals

`Subtotal - Discount + Tax = Total` is not enough to be deterministic. Specify, as requirements:

- Money stored and computed as **integer paise**; quantity as integer milli-units (3 dp) to support weighed goods.
- Tax rate stored as **basis points** (`1800` = 18%) so 0.25%, 1.5%, 3% are exact.
- Rounding mode **HALF_UP**, applied at **line level** for taxable value and per-line tax, then summed. (Line-level is what GSTN's own validations and every incumbent do; invoice-level rounding will produce mismatches against buyer books.)
- `CGST = round(taxable × rate_bp / 2 / 10000)` and `SGST = total_tax − CGST`, so the halves always re-sum. Never round both independently.
- Invoice-level **round-off to nearest rupee is optional per business**, and the delta posts to a dedicated `Round Off` ledger account — it must never be absorbed into revenue or tax.
- Inclusive-price back-calculation is a first-class path: `taxable = round(inclusive × 10000 / (10000 + rate_bp))`.

### C-4 — FR-028 does not say how discounts interact with GST (currently a compliance defect)

A bill-level discount must be **apportioned pro-rata across lines before tax**, because tax is computed per line at per-line HSN rates. Add to FR-028/FR-046: line discounts apply first; bill discount is distributed over line taxable values with the **largest-remainder method** so the apportioned amounts sum exactly to the bill discount; the discount is printed on the invoice. Post-tax "cash discounts" are a separate, explicitly non-GST-reducing concept — decide and state which one the POS `F4` key does.

### C-5 — FR-048 (e-invoice) contradicts P1/FR-063 and needs an honest scope statement

An IRN can only be obtained online, and for a business above the AATO threshold a B2B supply legally requires the IRN before the invoice is valid. "Offline-first" cannot cover it.

**Add to FR-048:** "Offline-first applies to B2C/retail billing. For businesses where e-invoicing is applicable, B2B tax invoices require connectivity; when offline, Muneem shall either (a) block the B2B tax-invoice path with a clear message, or (b) issue a *delivery challan* and generate the tax invoice on reconnect — configurable per business." Also add: IRN cancellation is only possible within 24 hours; after that, cancellation must be modelled as a credit note (this affects FR-079).

### C-6 — FR-041 (sales returns) is missing the hard parts

Add: returns must reference the original **line**, not just the invoice; returned quantity validated against `sold − already_returned`; the line's **proportional share of line and bill discount** is reversed; tax reversed at the **rate stored on the original line** (not the product's current rate); stock returns at the **original issue cost** (not current cost) so COGS reverses cleanly; credit note gets its own series; refund tender is recorded explicitly (cash / to-credit / exchange) and may differ from the original tender; a configurable return window and a "return without original invoice" path (manager-approved, zero-cost-basis) must exist because it happens daily in retail.

---

## 2. New functional requirements to add

### FR-085 — Cloud→device synchronization (down-sync)

Currently absent. The device must pull changes it did not originate: products and prices edited on the web dashboard or another terminal, new customers, tax config, users/permissions, device revocation, subscription state.

- Server maintains a monotonic per-business change sequence; device stores a cursor and pulls deltas (`since_seq`) in pages.
- Pull is idempotent and resumable; applying a page is atomic.
- Down-sync must never overwrite un-synced local financial documents.
- Cursor and last-success timestamp surface in the FR-068 status UI.

### FR-086 — New-device hydration / re-installation

A freshly installed device must bootstrap a working offline dataset before POS is allowed: business + branch config, tax config, users/permissions, full product catalogue with barcodes, customers, suppliers, current stock levels, open invoices for payment allocation, and N days of recent transactions. Requirements: progress UI, resumable download, snapshot-based (not row-by-row API calls) for 5,000+ SKUs, and an explicit "ready to bill offline" state.

### FR-087 — Multi-terminal branch operation (and the offline stock-authority decision)

Two terminals in one shop with no internet cannot see each other's sales through the cloud. The PRD must take a position. Recommended:

- **MVP:** terminals are independent offline. Stock is eventually consistent. Overselling is possible and **allowed** (see FR-088), detected at sync, and surfaced in a *Stock Reconciliation* report. Registers, invoice series and sessions are strictly per-terminal, so no financial document ever conflicts.
- **Phase 2:** optional **LAN hub mode** — one node at the branch is elected primary, others connect over LAN (discovery + local API) and fall back to independent mode if the hub disappears.

State this in §4 and §21 explicitly; silence here will be read by engineering as "the cloud keeps stock consistent", which it does not.

### FR-088 — Negative stock and oversell policy

Configurable per business (and overridable per product): `block` / `warn and allow` / `allow silently`. Default **warn and allow** — blocking a sale because a stale offline count says zero is worse for the ICP than a negative number. Requirements: negative levels are visible and reportable; a costing fallback applies (last known unit cost) with automatic cost correction when stock is replenished; negative-stock events are audited.

### FR-089 — Inventory valuation method and COGS posting

Missing entirely, yet required by FR-054 (Stock Valuation, P&L) and §17.

- MVP: **moving weighted average** per (product/variant, warehouse), maintained in integer paise; batch/serial items value at their own layer.
- Perpetual costing: every sale posts `Dr COGS / Cr Inventory` at issue cost in the same local transaction as the sale.
- Method is fixed at business setup; changing it later requires an explicit revaluation run (not silent).
- Purchase landed cost: freight/other charges apportionment policy stated (MVP: exclude and treat as expense, or apportion by value — pick one, state it).
- Non-ITC-eligible tax on purchases capitalizes into cost; eligible tax does not.

### FR-090 — Unit of measure and pack conversions

FR-016 models "Pack size" as a *variant*, which is wrong — a case of 24 is the same SKU in a different UOM and must share stock. Add: base UOM per product, additional purchase/sale UOMs with integer conversion factors, fractional quantity support for weight/volume, per-line UOM captured on invoices, and stock always stored in base UOM.

### FR-091 — Multi-tier and customer-specific pricing

The ICP includes wholesalers and distributors (§2.2). One `selling_price` (FR-014) cannot serve retail + wholesale. Add: named price lists (Retail / Wholesale / Distributor), per-customer price-list assignment, quantity-break pricing, MRP-vs-selling-price validation, and effective-dated price changes. POS must show which list is in effect.

### FR-092 — Tax treatment classes and rate history

Add a `tax_treatment` on products: `taxable | nil_rated | exempt | non_gst | zero_rated`. These are *not* "0%" — they land in different GSTR-1 buckets. Also add **effective-dated tax rates**: GST rates change; historical invoices must retain the rate applied, and every invoice line must store its own HSN, rate, treatment and computed amounts as a **snapshot** independent of the current product row. Add cess (ad-valorem and per-unit) fields even if unused at MVP.

### FR-093 — Place-of-supply determination

Add explicit rules: supplier state = the branch's GSTIN state; place of supply for goods = delivery location, defaulting to the customer's state, defaulting to the supplier's state for walk-in B2C. `POS state == supplier state → CGST+SGST` (UTGST for UTs without legislature), else `IGST`. Place of supply is stored on the invoice, is user-overridable with a reason, and drives B2CS/B2CL classification.

### FR-094 — GSTR-1 / GSTR-3B data buckets (make FR-047 concrete)

FR-047 defers everything, but the *buckets* determine the schema. Require at minimum that every sale/credit-note is classifiable at commit time into: B2B, B2CL (inter-state B2C above threshold), B2CS, CDNR, CDNUR, Exports, Nil/Exempt/Non-GST, HSN Summary, Documents Issued. Also require an ITC register from purchases and expenses. Export format can be deferred; classification cannot.

### FR-095 — Composition scheme and non-registered businesses

FR-008 mentions "tax scheme" with no behaviour. Add: composition dealers issue a **Bill of Supply** (not a tax invoice), collect no GST, claim no ITC, and must print the prescribed declaration. Unregistered businesses issue plain invoices with no GSTIN/tax. The POS, printing and reporting layers must all key off this flag.

### FR-096 — Accounting period lock and financial-year rollover

Missing entirely; every accountant will ask for it on day one. Add: periods can be **locked** after filing; postings into a locked period are rejected; late-arriving offline transactions dated into a locked period are accepted but **flagged for review** rather than silently posted or dropped (define this — it is a real offline consequence). Year-end rollover: close P&L to retained earnings, carry forward balances, reset document series, and keep prior-year reports readable.

### FR-097 — Offline authentication lifetime, user switching and revocation

FR-004 says "previously authenticated users" without bounds. Add: per-user offline credential cache (salted hash, not the password), a **maximum offline period** after which re-authentication is required (e.g. 30 days, configurable), fast cashier switching via short PIN on a shared terminal, enforced re-verification for sensitive actions, and revocation semantics — when a device or user is revoked in the cloud, the next successful sync must lock the app and, for device revocation, wipe local business data after the outbox has drained (and define behaviour when it cannot drain).

### FR-098 — Offline approval overrides

FR-013 approvals are unreachable offline. Add: approval-requiring actions support an **in-person override** by a user holding the permission (PIN entry at the terminal), recorded in the audit trail with the approver identity; cloud-routed approval is Phase 2.

### FR-099 — Register X/Z reports and cash counting

Extend FR-032 with: mid-shift **X report** (non-resetting), end-of-shift **Z report** (immutable, numbered), denomination-wise cash count, optional **blind close** (cashier cannot see expected cash), variance threshold requiring manager approval, petty-cash in/out with reasons, and safe-drop. A session must not be closable with an unfinalized bill.

### FR-100 — Print queue, reprints and duplicate control

NFR-012 says "user retries printing" but there is no queue. Add: durable print jobs with status and retry, reprints recorded with a counter and printed as **"DUPLICATE"**, receipt content reproducible byte-for-byte from stored data (never regenerated from current master data), and a printer-offline indicator that does not block billing.

### FR-101 — Weight-embedded barcodes and scale workflow

Grocery ICP depends on this. Add: configurable parsing of EAN-13 price/weight-embedded barcodes (prefix 20–29), mapping to product + embedded weight or price; manual weight entry fallback; stable-weight detection from the scale before capture; tare handling.

### FR-102 — Subscription/licence enforcement while offline

FR-074 only notifies. Add: cached entitlement with expiry, an **offline grace period** (e.g. 14 days) during which billing continues, then a defined degraded state — recommended: **billing stays enabled, admin/reports/sync restricted**, because bricking a shop's till is unacceptable and will generate refunds. Never lock the user out of their own data or exports.

### FR-103 — Local data retention and archival

At 1,000 txn/day the local DB grows ~400k sale lines/year. Define: hot window kept locally in full (e.g. current + previous FY), older data archived/pruned locally only **after** confirmed cloud sync, archived-period reports served from cloud with a clear offline message, and a local DB size/health indicator. §13's "Recent transactions" must be given a number.

### FR-104 — Customer data protection (DPDP) and messaging compliance

FR-040 promises payment reminders and FR-038 stores phone numbers. Add: consent capture for marketing/reminder messages, purpose limitation, customer data export and erasure requests (with the constraint that GST records must be retained — erase profile, keep the statutory invoice), and the fact that SMS/WhatsApp reminders require registered templates/sender approval. This is a legal requirement in India now, not a nice-to-have.

### FR-105 — Sync protocol versioning and mixed-fleet compatibility

Devices update at different times. Add: every sync request carries app version, local schema version and protocol version; the server supports N−2 protocol versions; a device too old to sync is told to update instead of failing silently; server rejects unknown entity types with a retryable, non-poisoning error.

### FR-106 — Delivery challans, quotations and proforma (wholesale reality)

Wholesalers and distributors in §2.2 need a non-GST-document path: quotation → order → delivery challan → tax invoice. Minimum for MVP: **delivery challan** (because goods often move before the invoice) with conversion to invoice. Quotation/estimate is a cheap win for the same segment.

### FR-107 — Barcode/label printing data source

FR-027 exists but is unspecified. Add: label templates with MRP, selling price, product name, barcode symbology, batch/expiry; print from purchase receipt (print labels for received quantity); label printer is separate from the receipt printer in config.

### FR-108 — Duplicate-transaction prevention at the UI layer

The most common real-world data error is a double-tap "Complete Sale" or a re-click after a slow print. Require: idempotency at the command layer (a client-generated operation id per commit attempt), UI lockout during commit, and a near-duplicate warning (same customer, same total, within N seconds).

---

## 3. Clarifications to existing requirements

| FR | Issue | Recommended text change |
|---|---|---|
| FR-005 | Five IDs listed with no relationships | Define the hierarchy and cardinality: `Organization 1—N Business 1—N Branch 1—N Terminal`; `Installation` = one app install on one machine, `Device` = registered identity of that install. State which ID scopes data isolation (business). |
| FR-009 | "Business data must remain isolated" | State whether one *installation* can hold two businesses offline at once. Recommended: **one active business per installation** for MVP (separate SQLite file per business either way). |
| FR-010 | Branch with its own GSTIN | Say explicitly that a different-GSTIN branch transfer is a **taxable supply** needing a tax invoice, and defer it to Phase 2 with a guard rail preventing it in MVP. |
| FR-012 | Flat permission list | Split into `resource × action` (view/create/edit/cancel/approve) and add value thresholds (e.g. discount up to 5%). Flat booleans will be re-modelled within a month. |
| FR-031 | Mixed payment | Add the invariant `Σ tender = invoice total`, over-tender→change-due (cash only), UPI/card reference capture, and a **card/UPI settlement clearing account** rather than posting straight to bank. |
| FR-033 | Four invoice "types" | These are mostly one document with flags (`is_tax_invoice`, `customer_type`, `is_credit`). Collapse to avoid four code paths. |
| FR-036 | "Templates shall be configurable" | Bound it for MVP: fixed 58mm/80mm/A4 templates with configurable header/footer/logo/fields. A template engine is Phase 2. |
| FR-043 | PO → GRN → Invoice | Confirm whether **partial receipts** and **three-way matching** are in MVP. Recommended: GRN optional at MVP (purchase invoice increases stock directly), PO is informational; state it. |
| FR-055/056 | Payments | Add: advance/on-account receipts (unallocated), auto-allocation strategy (FIFO by due date, user-overridable), and explicit **write-off / bad debt** handling. |
| FR-064 | ID structure | Recommend **ULID** (sortable, no coordination) + `(business_id, device_id, local_seq)` for human traceability, and name the idempotency key used against the API. |
| FR-070 | "Detect conflicts" | Replace with a per-entity conflict matrix (see `muneem-lld.md` §9). "Detect" is not a policy. |
| FR-071 | Backups | State who holds the encryption key, whether Muneem can read customer data, and what the downloadable backup format is (recommended: SQLite file + signed manifest). |
| FR-078 | "Immutable audit log" | Name the mechanism: append-only, no UPDATE/DELETE grants, per-device **hash chain** (`prev_hash`), server-side chain verification, and a tamper alert. Immutability is not achieved by intent. |
| FR-084 | AI on business data | Add explicit data-boundary requirements: what leaves the device, retention, opt-in, and never training on customer books. |
| §35 | Permissions matrix "Optional/Configurable" | Ship named **role presets** with concrete defaults; "configurable" without defaults is an onboarding tax. |

---

## 4. NFRs to add

| ID | Requirement |
|---|---|
| **NFR-018 — Clock integrity** | Server time returned on every API response; device stores skew; transactions record `device_time`, `skew_ms`, `server_received_at`. Reject/flag invoice dates outside `[last_txn_date, now + tolerance]`. A user changing the Windows clock must not corrupt the sequence or the FY attribution. |
| **NFR-019 — Local DB durability** | WAL + `synchronous=FULL` for financial commits (`NORMAL` is not enough on a power cut), one writer only, `PRAGMA foreign_keys=ON`, startup `quick_check`, automatic recovery path, and a documented "DB corrupted" user journey ending in cloud restore. |
| **NFR-020 — Local encryption at rest** | Decide explicitly: SQLCipher-style encrypted DB with the key in the OS credential store, vs. unencrypted DB + encrypted secrets only. State the consequence (encrypted DB is unreadable after OS profile loss unless the key is escrowed). |
| **NFR-021 — Scale ceilings** | Named targets: 20,000 SKUs, 50,000 customers, 500,000 transactions in the local DB with POS latency still meeting NFR-001. Without a ceiling, NFR-001 is untestable. |
| **NFR-022 — Sync throughput** | A device with 5,000 queued operations must drain within a stated window on a 512 kbps link; batched, compressed, resumable. |
| **NFR-023 — Accessibility & ergonomics** | Minimum font sizes and contrast for counter use, full keyboard reachability, no mouse-only paths in POS, works at 1366×768 (very common on Indian retail hardware). |
| **NFR-024 — Windows support matrix** | Named minimum: Windows 10 (64-bit), 4 GB RAM, HDD; state 32-bit support in/out. This drives Electron version choice. |
| **NFR-025 — Crash/error reporting** | Opt-in crash reporting with PII scrubbing; no invoice contents in telemetry. |

---

## 5. MVP scope recommendation

§7's 22-item MVP is roughly a 9–12 month build for a small team. To reach a billable, trustworthy product sooner, split it:

**MVP-1 (target: fastest credible launch)** — single branch, single terminal authority, GST retail invoicing, barcode + thermal print + cash drawer, products/customers/suppliers, purchase invoice (no PO/GRN), stock movements + moving-average valuation, cash/UPI/card/credit tenders, customer credit + receipts, register sessions with X/Z, double-entry ledger with automated postings, 8 core reports, offline + up-sync + down-sync + hydration, audit log, CSV/XLSX import.

**Defer out of MVP-1 (keep the schema ready):** batch/serial (FR-025), multi-warehouse + transfers (FR-020/021), e-invoice + e-way bill (FR-048/049), weighing scale (FR-062), approval workflows (FR-013), multi-branch (FR-010), variants (FR-016) if the launch segment is grocery/hardware.

**Do not defer, despite the temptation:** valuation method (FR-089), rounding policy (C-3), invoice series design (C-2), down-sync (FR-085), hydration (FR-086), audit hash chain, period lock (FR-096). Each of these is a schema or protocol decision that gets 10× more expensive after the first 100 live shops.

## 6. Additions to §37's critical end-to-end test

The scenario is good; it does not yet fail the things most likely to break:

- Fire the **same commit twice** (double-click / retried request) → exactly one sale.
- **Kill the process mid-commit** (`taskkill /f`) repeatedly → no partial sale, no orphan movement, no orphan outbox row, no phantom invoice number.
- **Move the Windows clock** backwards a day and forwards a week mid-run → no series break, correct FY attribution.
- Two terminals, both offline, **sell the last unit** → both sales survive, stock goes negative, reconciliation report flags it.
- Edit the same product **on the web dashboard and on the device** while offline → deterministic documented outcome.
- Fill the disk during a commit; pull the printer's USB mid-print; unplug mid-sync.
- Replay the stock ledger and re-derive the trial balance from journals, and assert equality with the cached projections.
- Soak: 200,000 historical transactions in the local DB, then re-measure NFR-001.
