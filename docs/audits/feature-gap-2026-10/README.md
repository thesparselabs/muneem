# Feature-gap audit — Muneem vs Zoho Invoice/Books vs TallyPrime

**Date:** 2026-10-11 · **Muneem baseline:** `main` at `7f3e450` · **Supersedes the gap lists in**
[../../competitive-audit.md](../../competitive-audit.md) (2026-10-06), which used public marketing sources only.

**Question answered:** what features and options do Zoho Invoice/Books and TallyPrime have that Muneem does not, down
to the individual field, toggle and report, and which of them matter for an Indian shop?

## How this was done

| Step | Who | Output |
|---|---|---|
| Inventory Muneem from code (IPC registry, handlers, routes, migrations, OpenAPI), not from plans | code-explorer agent | [muneem-baseline.md](muneem-baseline.md) |
| Crawl Zoho's India help docs with Playwright (Invoice + Books, every module, pricing matrix) | crawler agent | [catalog-zoho.md](catalog-zoho.md): ~2,100 options from 413 pages |
| Crawl TallyPrime help with Playwright, then a sitemap/search pass for missed topics (release 1.0 → 7.1) | crawler agent | [catalog-tally.md](catalog-tally.md): ~1,690 options from 785 pages |
| Diff each catalog against the baseline, row per missing option, spot-checked in the repo | two analyst agents | [gap-zoho.md](gap-zoho.md), [gap-tally.md](gap-tally.md) |
| Merge, de-duplicate, prioritise | lead | this file |

**Limits.** Neither product was driven live. Zoho needs a signed-up organisation and TallyPrime is a Windows desktop
app, so the agents read the screen-by-screen help pages instead. Those pages describe each field and toggle, so the
option detail is real, but UX quality (speed, clicks) is not measured here. In the Tally catalog, the stock-item master
page returned HTTP 500 on every attempt; rows based on it are tagged `UNVERIFIED`. Zoho Books help pages rarely name a
plan tier, so tiers come from the Books plan-comparison matrix. No account was created and no form was submitted.

## Headline numbers

| | Gap rows | Missing (❌) | Partial (⚠️) | High value for a shop | Small effort (≤ a few days) |
|---|---|---|---|---|---|
| Zoho Invoice/Books | 414 | 306 | 108 | 62 | 239 |
| TallyPrime | 523 | 379 | 144 | 89 | 340 |

The two lists overlap heavily (GST connectors, challans, quotes, banking, reminders), so the combined set of distinct
high-value gaps is about **95**. About **60 %** of all gaps are small. Many are fields on existing documents, print
toggles, or settings the backend already honours but no screen exposes.

## Corrections to the 2026-10-06 audit

- **Thermal ₹ and Indic text** print only in raster mode through the Windows spooler. ESC/POS text mode prints "Rs"
  and "?". The earlier ✅ is a ⚠️.
- **"GSTR JSON groundwork"** does not exist. GSTR-1 exports are offline-tool CSV, XLSX and PDF; there is no JSON.
- **"Inventory (1 warehouse/branch)"** is true in the schema, but there is no warehouse screen at all.

## Already built, but the app has no screen for it (fix first)

These are the cheapest wins: the backend is done and tested, and only a screen is missing.

| Backend that exists | Missing screen | Both rivals have it as |
|---|---|---|
| `business.update` | Edit business profile (address, email, PAN, website) | Organisation profile / F3 company alter |
| `auth.setPin` | Set or reset a cashier's PIN (so "Switch user" works) | User security |
| `settings.createSeries` / `listSeries` | Number series: prefix, suffix, restart yearly, per branch | Zoho series · Tally voucher numbering |
| `pos.roundToRupee`, `inventory.negativeStock`, `pos.blindClose`, `pos.varianceThresholdPaise`, `pos.receiptFooter`, `gst.b2clThresholds` | A settings page | Zoho General prefs · Tally F11/F12 |
| Price lists (qty breaks, effective dates) | Pick a list per sale; default list per customer | Zoho price list on invoice · Tally price levels |
| Place-of-supply override | Field on the bill | Both |
| Cess fields, per-product negative stock | Fields on the product form | Both |
| `business.createBranch` / `createTerminal` | Branch and terminal management after setup | Zoho branches · Tally multi-company/branch |
| Hash-chained audit log | An audit-log viewer with filters (who, what, when, before/after) | Zoho activity log · Tally Edit Log |
| Warehouse table | Warehouse list (single warehouse until FR-093) | Zoho warehouses · Tally godowns |

## Where Muneem already leads (keep and market)

1. **Works offline, with sync and cloud backup included.** Zoho is online-only. Tally's sync, remote access and
   cloud storage need TSS plus paid Cloud Access (₹450–600 per user per month) and TallyDrive.
2. **A real counter.** Register sessions (float, cash in/out, safe drop, X/Z, blind close, variance), hold/park, a
   duplicate-bill warning, F-key POS, native ESC/POS thermal with drawer kick and a print queue. Zoho has none of this.
   Tally's own FAQ says its POS has no cash-register or pole-display support.
3. **Cashier money limits.** Maximum discount, maximum refund and backdate days per role. Both rivals can only allow
   or deny an action.
4. **Barcode billing in the base product.** 20 barcodes per item. Zoho keeps barcodes in Elite (₹4,999/mo).
5. **Paid-tier features at no extra cost.** Compared with Zoho: price lists with quantity breaks, landed cost,
   credit-limit checks, period lock and year-end close.
6. **Tamper-evident audit.** The audit log is always on and hash-chained. Tally's Edit Log can be switched off, and
   Zoho's audit trail is a viewer only.
7. **Immutable GST numbering.** Tally's automatic numbering renumbers later vouchers when one is deleted or inserted.
8. **DPDP privacy tools** (consent, export, erase): neither rival has them.
9. **No invoice caps and no compliance paywall.** Zoho caps invoices per year on every plan. Tally stops receiving
   GST updates when TSS lapses.
10. **Modern bilingual UX.** Light/dark theme, a guided tour, an English/Hindi manual, and the Hindi+English "bharat"
    invoice.

## Combined gap matrix (high and medium value)

Z = Zoho, T = Tally. ✔ means the rival has it (plan in brackets), — means it doesn't. **Value** is for an Indian
retail/wholesale shop. **Effort** is for Muneem: S ≤ a few days, M 1–3 weeks, L > 3 weeks or an external
integration. Full option detail and sources are in the per-rival gap lists.

### A. Sales documents and invoice fields

| Gap | Z | T | Muneem today | Value | Effort |
|---|---|---|---|---|---|
| Quotation / estimate → convert to invoice (statuses, expiry, accept/decline) | ✔ free | ✔ | ❌ FR-086 | H | M |
| Delivery challan → invoice against challans (partial, returns, types incl. job work/approval) | ✔ free | ✔ | ⚠️ enum only, FR-087 | H | M |
| Edit/alter a posted invoice (with audit), void with reason | ✔ | ✔ | ❌ cancel + re-bill only | H | M |
| Payment terms + due date on the invoice (Net 15/30/…, end of month) | ✔ | ✔ bill-wise credit period | ⚠️ credit days only, no due date printed | H | S |
| Bill-to vs ship-to (consignee) addresses | ✔ | ✔ | ❌ one address | H | S |
| Dispatch details (doc no, through, destination, vehicle, LR no) | ✔ via e-way | ✔ | ❌ | H | S |
| Shipping/freight and other additional charges on a sale, taxable | ✔ | ✔ | ❌ | H | S |
| Order/PO reference no. on the invoice | ✔ | ✔ | ❌ | H | S |
| Free quantity (actual vs billed qty) | — | ✔ | ❌ | H | S |
| Salesperson on bill + sales-by-salesperson | ✔ | ✔ cost centre | ❌ | M | S |
| Customer notes, T&C per document | ✔ | ✔ narration | ⚠️ template-level terms only | M | S |
| Free +/- adjustment line; round-off on/off | ✔ | ✔ | ⚠️ auto round-off, no UI | M | S |
| Discount mode (before/after tax, line/bill) | ✔ | ✔ | ⚠️ fixed behaviour | M | S |
| Sales orders (pending orders, partial fulfilment) | ✔ free | ✔ | ❌ | M | M |
| Proforma / advance (retainer) invoice | ✔ Pro | ✔ | ❌ | M | M |
| Recurring invoices (schedule, auto-send) | ✔ free | — | ❌ FR-097 | M | M |
| Customer-side debit note (price increase) | ✔ | ✔ | ❌ | M | S |
| Draft documents; clone a document | ✔ | ✔ | ⚠️ hold/park on POS only | M | S |
| Custom fields on documents (3 free in Zoho, many types in Books) | ✔ | ✔ TDL | ❌ | M | M |
| Attachments on documents and parties | ✔ | ✔ | ❌ FR-075 | M | M |
| Post-dated vouchers | — | ✔ | ❌ | H | M |
| Stock Query from the bill (stock, last rate sold to this party) | — | ✔ | ❌ | H | S |

### B. Printing and templates

| Gap | Z | T | Muneem today | Value | Effort |
|---|---|---|---|---|---|
| UPI/payment QR printed on invoice | ✔ | ✔ | ❌ | H | S |
| Original / Duplicate / Triplicate copy labels on A4 | ✔ | ✔ | ❌ (thermal reprint only) | H | S |
| Previous and current party balance on the invoice | — | ✔ | ❌ | H | S |
| HSN-wise tax summary table on the invoice | ✔ | ✔ | ⚠️ tax split only | H | S |
| Print/PDF of payment receipt, statement, purchase, debit note, PO, challan | ✔ | ✔ | ❌ sales + CN thermal only | H | M |
| e-Invoice IRN/Ack + signed QR, e-way bill no. on PDF | ✔ | ✔ | ❌ (columns only) | H | S (after e-invoice) |
| Barcode label printing | ✔ Elite | ✔ | ❌ | H | M |
| Template editor: fonts/colours, header/footer image, column toggles, label rename, margins | ✔ | ✔ F12 | ⚠️ accent, logo, footer only | M | M |
| Export/SEZ endorsement text (Rule 46(q)) | ✔ | ✔ | ❌ | M | S |
| Multi-language invoice | ✔ 10+ | ✔ | ⚠️ Hindi+EN only | M | M |

### C. Customers, credit and collections

| Gap | Z | T | Muneem today | Value | Effort |
|---|---|---|---|---|---|
| Share invoice/statement by WhatsApp (click-to-chat) and email | ✔ | 💰 add-on | ❌ FR-085 | H | S/M |
| Automated payment reminders (N days before/on/after due), per-customer stop | ✔ | ✔ reminder letters | ❌ FR-088 (consent only) | H | M |
| Statement as a document (period, PDF, email, bulk) | ✔ | ✔ | ⚠️ ledger export | H | S |
| Fetch party details from GSTIN; validate GSTINs in bulk | ✔ | ✔ | ❌ | H | M |
| Default price level per customer | ✔ Pro | ✔ | ❌ | H | S |
| Payment links / UPI collect / gateways (Razorpay, Paytm…) | ✔ free | ✔ + TSS | ❌ FR-095 | H | L |
| TDS deducted by customer on a receipt | ✔ | ✔ | ❌ | H | S |
| Post-dated cheques and cheque lifecycle | ✔ Prem | ✔ | ❌ | H | M |
| Contact persons, multiple addresses, PAN validation | ✔ | ✔ | ❌ | M | S |
| Interest on overdue bills (rate, grace, simple/compound) | — | ✔ | ❌ | M | M |
| Confirmation of accounts letter | — | ✔ | ❌ | M | S |
| Refund customer advance / excess; GST on advance received | ✔ | ✔ | ❌ | M | M |
| Same party as customer and supplier (net settlement) | ✔ | ✔ single ledger | ❌ separate masters | M | M |
| Merge duplicate customers | ✔ | — | ❌ | M | S |
| Customer portal / public share link with expiry | ✔ | — | ❌ | M/H | M |

### D. GST and statutory

| Gap | Z | T | Muneem today | Value | Effort |
|---|---|---|---|---|---|
| GSTR-1 and GSTR-3B JSON export for portal upload | ✔ | ✔ | ❌ CSV/XLSX/PDF | H | M |
| Direct (connected) filing: push, status, file with OTP/EVC | ✔ free | ✔ + TSS | ❌ FR-092 | H | L |
| e-Invoice (IRN on save, cancel in 24 h, bulk, IRN on print) | ✔ Std | ✔ + TSS | ❌ FR-089 | H | L |
| e-Way bill (Part A/B, extend, cancel, vehicle change, from challan) | ✔ free | ✔ + TSS | ❌ FR-090 | H | L |
| GSTR-2A/2B reconciliation and IMS accept/reject | ✔ | ✔ | ❌ | H | L |
| Reverse charge on purchases (+ self-invoice) | ✔ | ✔ | ⚠️ refused | H | M |
| QRMP: quarterly GSTR-1 + IFF | ✔ | ✔ | ❌ monthly only | H | M |
| Composition CMP-08 and GSTR-4 | ✔ | ✔ | ❌ (bill of supply ✅) | H | M |
| Effective-dated GST rate history per item; slab-based rates; bulk rate update | ✔ tool | ✔ | ❌ | H | S |
| Mark return filed + lock the period's GST | ✔ | ✔ | ❌ | H | S |
| Exception/uncertain-transaction resolution (missing HSN, invalid GSTIN, PoS mismatch) | ⚠️ | ✔ | ⚠️ missing-HSN only | H | M |
| TDS on purchases and sales, section master, challans | ✔ | ✔ | ❌ FR-098 | H | M |
| TCS 206C | ✔ | ✔ | ❌ | M | M |
| MSME/Udyam on vendors, 45-day (43B(h)) payables tracking | ✔ | ✔ | ❌ | H | S |
| Export/LUT, SEZ treatments | ✔ | ✔ | ❌ (EXP section exists) | M | M |
| GSTR-9 annual | ✔ | ✔ | ❌ | M | L |
| Multi-GSTIN per branch | ✔ add-on | ✔ | ❌ | M | L |

### E. Inventory

| Gap | Z | T | Muneem today | Value | Effort |
|---|---|---|---|---|---|
| Batches with mfg/expiry, batch-wise MRP; expiry ageing | ✔ Elite | ✔ | ⚠️ schema only, FR-091 | H | M |
| Multiple godowns + transfers | ✔ Elite | ✔ | ⚠️ one per branch, FR-093 | H | M |
| Repacking / conversion journal (bulk → packs) | ⚠️ assemblies | ✔ | ❌ | H | M |
| Bulk price revision | ✔ % lists | ✔ | ❌ | H | S |
| Stock ageing / dead stock, reorder status report | ✔ | ✔ | ⚠️ low-stock list | H | S |
| Purchase orders → bill; reorder → auto-PO | ✔ free | ✔ | ❌ | H | M |
| Goods vs service item type (non-stock items) | ✔ | ✔ | ⚠️ SAC only | H | S |
| Item image, description, preferred vendor | ✔ | ✔ | ❌ | M | S |
| Variants, serial numbers | ✔ Elite | ✔ | ⚠️ variants schema only | M | M |
| BOM / manufacturing, job work | ✔ Elite | ✔ | ❌ | L | L |
| FIFO and other valuation methods | ✔ | ✔ | ❌ moving average | L | M |

### F. Banking and accounting

| Gap | Z | T | Muneem today | Value | Effort |
|---|---|---|---|---|---|
| Bank statement import (CSV/XLS/PDF/OFX) + match + reconcile (BRS) | ✔ free | ✔ | ❌ FR-094 | H | M |
| Vouchers created from bank statement lines; rules | ✔ | ✔ | ❌ | M | M |
| Contra / fund transfer, deposit slip | ✔ | ✔ | ⚠️ manual journal | M | S |
| Cash flow statement / projection | ✔ | ✔ | ❌ | M | S/M |
| Horizontal (T-form) P&L and Balance Sheet, ratio analysis | ✔ | ✔ | ❌ | M | S |
| Comparison and auto columns (periods, branches) in reports | ✔ | ✔ | ❌ | M | M |
| Full drill-down chain (report → ledger → voucher) | ✔ | ✔ | ⚠️ ledger → voucher | M | M |
| Cost centres / reporting tags, budgets | ✔ Std/Prem | ✔ | ❌ | L | M |
| Multi-currency | ✔ Pro | ✔ | ❌ | L | L |
| Fixed assets & depreciation | ✔ Prem | — | ❌ | M | M |
| Payroll | 💰 add-on | ✔ | ❌ | L | L |

### G. Reports (missing by name)

**High/medium:** Sales by customer, Sales by salesperson, Purchases by vendor, Purchases by item, Customer/Vendor
balance summary, Time to get paid, Inventory ageing, Stock ageing by expiry, Reorder status, Batch summary,
Cash flow, Horizontal P&L/BS, Ratio analysis, TDS receivable/payable, Bad debts, Refund history, Tax summary by rate,
Validate party GSTIN, BRS summary, Activity/edit log. **Report features:** saved views/favourites, show/hide and
reorder columns, group-by and advanced filters, scheduled emailed reports, comparison columns, custom AR ageing
buckets (by due date or invoice date). Full lists: [gap-zoho.md §14](gap-zoho.md), [gap-tally.md §16](gap-tally.md).

### H. Platform, users and connectivity

| Gap | Z | T | Muneem today | Value | Effort |
|---|---|---|---|---|---|
| Invite staff and assign roles in the app; deactivate a user | ✔ | ✔ | ❌ owner only | H | M |
| Accountant/CA seat or Tally XML export for the CA | ✔ free seat, Tally XML | ✔ Auditor edition | ❌ | H | M |
| Global search / Go To from anywhere | ✔ | ✔ | ❌ FR-073 | H | S/M |
| Keyboard: hotkeys and mouse-free entry on every screen, shortcut cheat-sheet | ✔ | ✔ (core strength) | ⚠️ POS only | H | S |
| Owner's reports in a browser or phone | ✔ | ✔ + TSS | ⚠️ `/reports/daily` API only | H | M |
| Mobile app (create bills, reports, scan) | ✔ | ⚠️ view-only | ❌ FR-096 | H | L |
| Voucher import from Excel (sales, payments, journals) and migration from other software | ✔ | ✔ | ⚠️ products, parties, opening stock, purchase lines | H | M |
| Approval workflows (bills, discounts, credit notes) | ✔ Pro | — | ❌ | M | M |
| 2FA / MFA | ✔ | ✔ TallyVault | ❌ | M | M |
| UI in Hindi and regional languages | ✔ | ✔ | ⚠️ English UI | M | M |
| Settings switchboard (enable/disable modules, F11-style) | ✔ | ✔ | ❌ | M | S |
| AI bill capture / OCR of supplier bills | ✔ autoscan | ✔ Docs by Ira | ❌ | M | L |
| Public API, webhooks, Zapier | ✔ | ✔ XML/ODBC | ❌ | L | L |

## Recommendation

Ordered by value per unit of effort, for an Indian retail/wholesale counter. Items already in the PRD keep their FR
number.

**P0: quick wins (mostly S, about 2–3 weeks in total).**
1. Screens for the existing backends: edit business, set PIN, number series, settings page, price list per
   sale/customer, place-of-supply override, cess on the product form, audit-log viewer.
2. Invoice fields: due date and payment terms, PO reference, ship-to/consignee, dispatch details, shipping and other
   charges, free quantity, notes, adjustment line.
3. Print: UPI QR, copy labels, previous/current balance, HSN summary block, payment-receipt and statement documents.
4. MSME vendor flag + 45-day payables; TDS deducted by customer on receipts; GST rate history + bulk price/rate update.
5. Reports: sales by customer, purchases by vendor/item, stock ageing, reorder status, time to get paid.
6. Keyboard: Go To / global search and hotkeys on every screen.

**P1: Phase-1 Tier A, confirmed by this audit.** WhatsApp/email sharing (FR-085), quotation → invoice (FR-086),
delivery challan → invoice (FR-087), reminders (FR-088). Add **edit a posted invoice** with audit, and **GSTR-1/3B
JSON export**. Both rivals treat them as basics.

**P2: compliance and distribution (Tier B).** e-Invoice (FR-089), e-way bill (FR-090), reverse charge, QRMP,
CMP-08, 2B/IMS reconciliation, TDS/TCS (FR-098), batches/expiry (FR-091), godowns/transfers (FR-093), purchase orders,
bank statement import + BRS (FR-094), invite users, Tally XML export for CAs.

**P3: later or never for a shop.** Payment gateways/portal (FR-095), mobile app (FR-096), recurring invoices,
multi-currency, payroll, cost centres/budgets, BOM/job work, workflow automation, custom modules, public API.

## Files in this audit

| File | What |
|---|---|
| [muneem-baseline.md](muneem-baseline.md) | What Muneem implements at `7f3e450`, verified from code |
| [gap-zoho.md](gap-zoho.md) | 414 option-level gaps vs Zoho, with plan tier, value, effort and source |
| [gap-tally.md](gap-tally.md) | 523 option-level gaps vs TallyPrime, with edition/TSS, value, effort and source |
| [catalog-zoho.md](catalog-zoho.md) | Raw Zoho feature catalog (~2,100 options) with URLs |
| [catalog-tally.md](catalog-tally.md) | Raw TallyPrime feature catalog (~1,690 options) with URLs |
