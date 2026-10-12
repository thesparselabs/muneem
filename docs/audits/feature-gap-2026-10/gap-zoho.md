# Zoho Invoice / Zoho Books (India) vs Muneem — option-level gap list

Inputs: [catalog-zoho.md](catalog-zoho.md) (Zoho catalog, crawled 2026-10-11) and [muneem-baseline.md](muneem-baseline.md) (Muneem at HEAD 7f3e450), spot-checked against the repo (migrations, report definitions, renderer). Rows list only things Zoho has that Muneem lacks fully (❌) or partly (⚠️). 📝 means a Muneem FR is planned but not built, so it still counts as ❌.

Columns: **Plan** = where Zoho offers it: ZI = Zoho Invoice (free); ZB-Free/Std/Pro/Prem/Elite/Ult = lowest Zoho Books India tier from the pricing matrix (§4.3); "ZB" alone = Books, tier not stated. **Value** = value to an Indian retail/wholesale SMB (H/M/L). **Effort** = rough Muneem build size (S ≤ few days, M ≈ 1–3 weeks, L > 3 weeks or needs external integration/certification). **Src** = short source key, resolved in the Sources table at the end (all zoho.com/in/... help URLs).

## Summary

**414 gap rows**: 306 ❌ and 108 ⚠️, of which 62 are high value (H) for an Indian shop; 239 are effort S. Rows per module (total: ❌/⚠️, H):

Sales documents 25 (22/3, H 4) · Invoice fields & options 37 (20/17, H 5) · Templates / printing 30 (21/9, H 7) · Customers (and vendors as contacts) 33 (25/8, H 3) · Items / catalog 20 (12/8, H 2) · Payments & collections 22 (16/6, H 4) · Reminders / communication 18 (16/2, H 7) · GST & compliance 28 (22/6, H 11) · TDS / TCS (income tax) 10 (10/0, H 3) · Purchases / expenses 25 (22/3, H 2) · Inventory 13 (10/3, H 1) · Banking 11 (8/3, H 3) · Accounting 18 (12/6, H 0) · Reports (missing reports by name, then report features) 48 (34/14, H 2) · Automation / workflows / AI 10 (10/0, H 0) · Customization 14 (8/6, H 2) · Users / roles / approvals 10 (6/4, H 1) · Customer / vendor portal & sharing 7 (7/0, H 1) · Integrations / API 11 (11/0, H 1) · Mobile 8 (6/2, H 1) · Data / backup / import 11 (8/3, H 0) · Pricing / limits / service 5 (0/5, H 2)

- **Biggest H clusters.** (1) GST compliance: GSTR-1 JSON or direct filing, 2A/2B reconciliation and IMS, e-invoice, e-way bill, CMP-08, QRMP, reverse charge. (2) Collections: payment receipts, UPI QR on the invoice, email/WhatsApp sharing, automated reminders, TDS deducted by the customer, PDC cheques. (3) Sales flow: quotes, delivery challans, editing an issued invoice, payment terms with due date, PO reference, shipping charges. (4) Purchases: POs, custom expense categories, TDS on bills. (5) Banking: statement import and reconciliation. (6) Platform: inviting users, a mobile app, global search, Tally export, an edit-business screen.
- **Mostly paid tiers in Zoho.** Workflow automation, custom modules and buttons, multi-currency, approvals, the vendor portal and BI are Pro or higher (₹1,499–7,999/mo). Most are L value for a single-shop retailer.
- **Many small fixes.** 239 gaps are effort S: invoice header fields, print-template toggles, settings that exist only in the backend, and missing reports such as Sales by Customer, Time to Get Paid, Inventory Aging and Horizontal P&L/BS.

---

## 1. Sales documents

| Feature / option | Zoho detail (concrete sub-options) | Plan | Muneem today | Value | Effort | Src |
|---|---|---|---|---|---|---|
| Quotes / Estimates module | Statuses Draft→Sent→Customer Viewed→Accepted/Declined→Invoiced, Expired; Reference#, Quote date, Expiry date, Salesperson, Project; shipping & adjustment; notes, T&C, attachments | ZI, ZB-Free | ❌ 📝 FR-086 | H | M | ZI-quote, ZB-quote |
| Quote → Invoice conversion | One-way convert; retain Customer Notes / T&C / Address on convert; quote custom fields carry over when names match | ZI | ❌ | H | S | ZI-quote |
| Auto-convert accepted quote | Don't convert / Convert to draft invoice / Convert and email invoice (or Create, Push and Send with e-invoicing) | ZI | ❌ | M | S | ZI-quote, ZB-quote |
| Quote accept/decline by customer | Via public link, portal or WhatsApp quick-reply; status auto-updates; Mark as Accepted/Declined manually | ZI | ❌ | M | M | ZB-quote, ZB-wa |
| Quote preferences | Allow editing of accepted quotes; hide zero-value lines on PDF; default T&C and notes | ZI | ❌ | L | S | ZI-quote |
| Quote → Sales Order conversion | Convert accepted quote to SO | ZB-Free | ❌ | M | S | ZB-quote |
| Quote → Retainer invoice | Auto retainer of N% on portal acceptance; or manual retainer from accepted quote | ZB-Pro | ❌ | L | M | ZB-quote |
| Progress invoicing | From accepted quote: invoice entire amount / custom amount or % / per-line % / remaining balance; amount-based toggle; quote status Partially Invoiced; Progress Invoice Summary report | ZB-Std | ❌ | M | M | ZB-prog |
| Sales Orders module | Draft→Open→Invoiced→Closed, Void; shipment date; custom statuses (e.g. "To be shipped"); convert to invoice (full/partial); Cancel Items / Reopen; convert to Purchase Order; SO on portal | ZB-Free | ❌ | M | M | ZB-so |
| Delivery Challan module | Challan Type (job work, supply on approval, liquid gas, semi-assembled…); Place of Supply; statuses Draft/Open/Delivered/Returned/Partially Invoiced; Convert to Invoice (full or sold items only); Mark Returned / partial returns; e-way bill from DC; print N copies | ZI, ZB-Free | ⚠️ enum only, 📝 FR-087 | H | M | ZI-dc, ZB-dc |
| Proforma / retainer (advance) invoice | Retainer Invoice with liability account (Unearned Revenue); statuses Draft/Sent/Paid/Partially Drawn/Drawn; apply one or many retainers to invoices; refund; Retainer Invoice Details report | ZB-Pro | ❌ | M | M | ZB-ret |
| Recurring invoices | Profile name; Repeat every week/month/year/custom; start/end or never expires; generated 6 AM; payment terms; salesperson; Create as Draft / Create and Send / Create, Charge and Send; stop/resume; manual off-cycle invoice; Next Invoice preview; child-invoice list | ZI, ZB-Free | ❌ 📝 FR-097 | M | M | ZI-rec, ZB-rec |
| Recurring: auto-apply credits | Auto-apply excess payments and/or credit notes to child invoices before sending | ZI | ❌ | L | S | ZI-rec |
| Recurring: auto-charge & retries | Saved card / mandate; on failure notify / notify+retry / silent retry; up to 3 retries with day gaps; suspend after failure | ZI | ❌ | L | L | ZI-rec |
| Payment links (ad-hoc collection) | Customer, amount, optional tax + Place of Supply, expiry (default 15 days), description; statuses Generated/Viewed/Paid/Expired/Cancelled; send by email/SMS/copy; auto-records payment as advance | ZI, ZB-Free | ❌ 📝 FR-095 | M | M | ZI-plink, ZB-plink |
| Customer debit note (sales side) | Debit note to customer for price increase / short-billing; pushed to IRP and GSTR-1 CDNR | ZB | ❌ (debit note exists only as purchase return) | M | S | ZB-einv, ZB-itds |
| Draft documents | Save as Draft (not in reports, no number consumed until sent); Mark as Sent | ZI | ⚠️ hold/park only on POS | M | S | ZI-inv |
| Void invoice | Void with reason, number retained, no effect on accounts; Convert to Draft (un-void) with reason | ZI | ⚠️ whole-bill cancel only via credit note | M | S | ZI-invm, ZB-inv |
| Edit issued invoice | "Allow editing of Sent invoice" preference; re-send after edit | ZI | ❌ cannot edit a posted bill | H | M | ZI-invpref |
| Clone document | Clone invoice / quote / credit note / bill / expense / journal / PO | ZI | ❌ | M | S | ZI-invm |
| Schedule send | Save and Send Later (pick date/time) | ZI | ❌ | L | S | ZI-inv |
| Delivery note / packing slip print | Print from invoice; per-document field show/hide + label rename (title, number, date, item, qty, reference, bill-to, deliver-to, signature, balance due, notes) | ZI | ❌ | M | S | ZI-pref, ZI-invm |
| Payment retention | Retention name, rate %, receivable/payable accounts; computed on sub-total; claim invoice later | ZB (early access) | ❌ | L | M | ZB-retn |
| Projects & timesheets billing | Fixed / project-hours / task-hours / staff-hours / daily-rate billing; timers; weekly log; budgets; bill unbilled hours | ZI, ZB-Pro | ❌ | L | L | ZI-ts, ZB-proj |
| Billable expenses → invoice | Mark expense billable to a customer with markup %; pulled into invoice | ZI | ❌ | L | M | ZI-exp, ZB-exp |

## 2. Invoice fields & options

| Feature / option | Zoho detail (concrete sub-options) | Plan | Muneem today | Value | Effort | Src |
|---|---|---|---|---|---|---|
| Payment terms picker on invoice | Net 15/30/45/60, Due end of month, Due end of next month, Due on receipt, Custom date; "Configure Terms" (name + days); default term; contact-level default | ZI | ⚠️ credit days on customer feed `sale.due_date`; no terms picker | H | S | ZI-inv, ZB-terms |
| Due date shown on invoice | Due Date field on form and PDF | ZI | ❌ not on A4 | H | S | ZI-inv |
| Order / PO number reference | Order Number field on invoice; Reference# on quote/CN; SO-number-on-invoice preference | ZI | ❌ | H | S | ZI-inv, ZB-inv |
| Salesperson | Salesperson dropdown + "Manage Salespersons"; feeds Sales by Salesperson report; toggle in General prefs | ZI | ❌ | M | S | ZI-pref |
| Shipping charges line | Shipping Charges field; "Apply tax on shipping charge"; Shipping Charges SAC on PDF | ZI | ❌ | H | S | ZI-pref, ZB-inv |
| Adjustment line | Free +/- Adjustment with renamable label | ZI | ⚠️ only auto round-off | M | S | ZI-pref |
| Round-off preference | Round to nearest rupee / No rounding (org setting) | ZI | ⚠️ `pos.roundToRupee` key exists, no UI | M | S | ZI-pref |
| Discount mode preference | No discount / line-level (incl. or excl. tax) / transaction-level (before or after tax) / both | ZI | ⚠️ line + bill discount fixed behaviour; no before/after-tax choice | M | S | ZI-pref, ZB-genpref |
| Tax-inclusive per transaction | Tax Inclusive / Exclusive / choose per transaction | ZI | ⚠️ per-product toggle only | M | S | ZI-pref |
| Customer Notes field | Per-document notes printed on PDF; default notes | ZI | ❌ | M | S | ZI-inv |
| Terms & Conditions per document | Default T&C per module, editable per document, "use this in future" | ZI | ⚠️ template-level terms only | M | S | ZI-invpref |
| Custom fields on invoice | ZI: 3 single-line text fields/module; ZB: text, email, URL, phone, number, date, decimal, amount, %, dropdown, multi-select, checkbox, lookup, attachment, formula, auto-number; mandatory, default, show in PDF, PII flag | ZI (3), ZB-Std | ❌ | M | M | ZI-pref, ZB-cf |
| Attachments on invoice | ZI 3×10 MB; ZB 5×5 MB from desktop / cloud / Documents; show in portal & emails | ZI | ❌ (FR-075) | M | M | ZI-invm, ZB-inv |
| Billing vs shipping address on invoice | Bill To + Ship To blocks, each with its own address format | ZI | ❌ single address | M | S | ZI-pdf |
| Place of supply on invoice | POS auto from GSTIN / shipping address, editable | ZB | ⚠️ override exists, no UI | M | S | ZB-cust |
| Price list selection on invoice | "Select Price List" header + "Apply Price List" per line | ZB-Pro | ⚠️ price lists exist; POS always uses default list | H | S | ZB-inv, ZB-pl |
| Inline "+ Add New Item" / "+ New Customer" | Create item/customer from the invoice line without leaving | ZI | ⚠️ inline customer only (verify); no inline item | M | S | ZI-inv |
| Item description per line | Description under item name, editable per line | ZI | ❌ no item description field | M | S | ZI-items |
| Header rows in item table | Insert New Header to group lines | ZB | ❌ | L | S | ZB-inv |
| Add items in bulk | Multi-select items + qty dialog | ZB | ❌ (barcode scan covers retail) | L | S | ZB-inv |
| Bulk update line items | Set project/account/tag on many lines | ZB | ❌ | L | S | ZB-inv |
| Manual number override | Gear icon: switch to manual numbering per document; edit prefix / next number | ZI | ❌ auto only; ⚠️ no series UI | M | S | ZI-inv |
| Multiple number series | Series with prefix + suffix + start number + yearly restart, per branch/location, per module | ZB-Prem | ⚠️ one series per terminal, backend `createSeries` only | M | S | ZB-series |
| Transaction posting date | Separate posting date driving journals and locks | ZB | ❌ | L | S | ZB-series |
| Expected payment date | Date + note on invoice/bill; drives reminders | ZI | ❌ | M | S | ZI-invm |
| Write-off per invoice | Write Off with date + reason → Bad Debt; Cancel Write Off; Bad Debts report | ZI | ⚠️ party-level write-off; no per-invoice write-off/cancel | M | S | ZI-invm |
| Invoice status lifecycle | Draft / Sent / Viewed / Partially Paid / Unpaid / Overdue / Paid / Void | ZI | ⚠️ paid/credit derived; no Viewed/Draft/Void | M | S | ZI-invm |
| Hide zero-value lines | Hide zero-value lines on PDF | ZI | ❌ | L | S | ZI-quote |
| Profit margin on invoice | Per-line and total margin; cost from purchase rate / valuation / item / custom; role-gated | ZB-Prem | ⚠️ product-profit report only, not on the bill | M | S | ZB-genpref |
| Credit note QR | QR with custom message ≤250 chars | ZI | ❌ | L | S | ZI-cn |
| Credit note draft/void | CN Draft → Open; Void with reason; Convert to Draft | ZI | ❌ | L | S | ZI-cn |
| Credit note import | CSV/TSV/XLS with auto-number | ZB | ❌ | L | S | ZB-cn |
| Comments & history per document | Internal comments ("display in portal" option) + action log with user | ZI | ⚠️ audit log exists, not shown per document | M | S | ZI-invm |
| View journal from transaction | "View Journal" on bills, expenses, payments, invoices | ZB | ⚠️ ledger exists; drill-to-voucher unverified | M | S | ZB-bills |
| Bulk actions on invoice list | Mark sent, bulk email, bulk reminders, bulk PDF (single PDF or ZIP), bulk print, bulk delete, bulk update field | ZI | ❌ | M | M | ZI-invm, ZB-inv |
| Invoice list status filters | All / Draft / Viewed / Partially Paid / Unpaid / Overdue / Payment Initiated / Paid / Void | ZI | ⚠️ sales list with limited filters | M | S | ZI-invm |
| Invoice list sorting | Created, modified, date, number, customer, due date, amount, balance due | ZI | ⚠️ | L | S | ZI-invm |

## 3. Templates / printing

| Feature / option | Zoho detail (concrete sub-options) | Plan | Muneem today | Value | Effort | Src |
|---|---|---|---|---|---|---|
| UPI / payment QR on invoice | "Invoice QR Code" linking to a URL or payment page; payment options block | ZI | ❌ | H | S | ZI-invpref, ZI-pdf |
| e-Invoice IRN + signed QR on PDF | QR, IRN, Ack No, Ack Date checkboxes; placeholders %IRN%, %EInvoiceQRImg% | ZB-Std | ❌ (columns only) | H | S | ZB-einv |
| e-Way Bill number on PDF | Document Details checkbox | ZB | ❌ | M | S | ZB-ewb |
| Template editor: fonts & colours | PDF font, label/font colour, font size, table header/row colours, table border | ZI | ⚠️ accent colour only | M | M | ZI-pdf |
| Template editor: header/footer | Header/footer image (≤1 MB) or colour; custom content with placeholders, tables, links; "apply to first page only"; page numbers | ZI | ⚠️ footer text only | M | M | ZI-pdf |
| Background image / watermark | Background image + position, or colour | ZI | ❌ | L | S | ZI-pdf |
| Orientation & margins | Portrait/Landscape; margins in inches | ZI | ❌ fixed | L | S | ZI-pdf |
| Rename labels / document title | Rename "Invoice"→"Tax Invoice", rename column/field labels on PDF only | ZI | ❌ | M | S | ZI-pdf |
| Column toggles & widths | Line #, item, description, HSN/SAC (column or below description), qty (+unit), rate, tax %, tax amt, discount, amount; widths | ZI | ⚠️ fixed per template; print field toggles partial | M | S | ZI-pdf |
| HSN/SAC summary table | "Show HSN/SAC Summary" / tax summary table at end of invoice | ZI | ⚠️ tax split shown; HSN-wise summary block not confirmed | H | S | ZI-pdf, ZB-pdf |
| Payment details block | Payment made, credits applied, amount withheld, write-off, balance due | ZI | ⚠️ | M | S | ZI-pdf |
| Total quantity | "Show Quantity" total | ZI | ⚠️ | L | S | ZI-pdf |
| Export/SEZ endorsement | "Supply meant for export/SEZ with/without payment of IGST" text (Rule 46(q)) | ZI | ❌ | M | S | ZI-pdf, ZB-inv |
| Annexure | Annexure content appended; attach annexure documents as pages | ZI | ❌ | L | S | ZI-pdf, ZB-pdf |
| Additional signature / attention block | Second signature; "Attention" content above item table | ZI | ❌ | L | S | ZI-pdf |
| Org address format with placeholders | Placeholder editor: Company ID, Tax ID, MSME/Udyam No, additional label/value fields | ZI | ❌ fixed layout | M | S | ZI-pref, ZI-msme |
| Customer address format | Billing/Shipping address format via placeholders; per-template override | ZI | ❌ | L | S | ZI-cust |
| Per-customer default template | Associate PDF template (and email template) per customer per document type | ZI | ❌ | L | S | ZI-cust |
| PDF export file name pattern | Configure export file name with placeholders | ZI | ❌ | L | S | ZI-pdf |
| Copies labels | Original / Duplicate / Triplicate (Zoho: DC "number of copies") | ZB | ❌ on A4 (thermal has DUPLICATE) | H | S | ZB-dc |
| HTML/CSS template editor | Full HTML+CSS PDF templates | ZB | ❌ | L | M | ZB-pdf |
| Multi-language templates | Template language dropdown, 10+ invoice languages | ZI | ⚠️ Hindi+EN "bharat" only | M | M | ZI-pdf |
| Print/PDF for payment receipt | Payment Receipt template (received from, amount, invoice details, signature) | ZI | ❌ | H | S | ZI-pdf |
| Print/PDF for statement | Customer Statement template; vendor statement | ZI | ⚠️ ledger report export, not a statement document | H | S | ZI-cust |
| Print/PDF for purchase docs | Bills, POs, vendor credits/debit notes, vendor payments, journals, adjustments | ZB | ❌ | M | S | ZB-pdf |
| Print debit note | Vendor credit template | ZB | ❌ | M | S | ZB-vc |
| Cheque printing template | Field positions, tamper-proof toggle, preview | ZB-Prem | ❌ | M | M | ZB-cheque |
| Item barcode labels template | "Item Barcodes" PDF template; barcode generation | ZB-Elite | ❌ | H | M | ZB-pdf, ZB-matrix |
| Colour themes per template | Select colour theme; clone; set default; mark inactive | ZI | ⚠️ accent only; no clone/inactive | L | S | ZI-pdf |
| Encrypted PDF | "Encrypt the PDF files I send" | ZI | ❌ | L | S | ZI-pref |

## 4. Customers (and vendors as contacts)

| Feature / option | Zoho detail (concrete sub-options) | Plan | Muneem today | Value | Effort | Src |
|---|---|---|---|---|---|---|
| Shipping address | Separate billing & shipping; "copy billing address" | ZI | ❌ | M | S | ZI-cust |
| Multiple additional addresses | Add Additional Address, selectable on transactions | ZB | ❌ | L | S | ZB-cust |
| Per-address GSTIN | Manage Tax Information: extra GSTIN/UIN per address, POS auto | ZB | ❌ | L | S | ZB-cust |
| Contact persons | Multiple people per customer (name, email, phone, designation, dept) | ZI | ❌ | M | S | ZI-cust |
| Company vs display name; type | Business / Individual; Company Name; Display Name; website; social | ZI | ⚠️ single name | L | S | ZB-cust |
| PAN on customer + validate | PAN with Validate (PAN–Aadhaar link) | ZB | ❌ | M | S | ZB-cust |
| GST treatment field | Registered / Unregistered / Consumer / Composition / Overseas / SEZ / Deemed export / Tax Deductor / ISD | ZB | ⚠️ inferred from GSTIN; no explicit SEZ/overseas/deemed | M | S | ZI-gst |
| Fetch details from GSTIN | "Get Taxpayer details" / "Fetch from GSTIN" | ZI | ❌ | H | M | ZI-gst |
| Default price list per customer | Assigned price list auto-applies | ZB-Pro | ❌ | H | S | ZB-pl |
| Credit-limit mode | Restrict vs Warn-and-proceed; include SO amount; breach popup with "Update credit limit" | ZB | ⚠️ check exists; mode/override UI unclear | M | S | ZB-climit |
| Remarks / internal notes | Remarks shown when billing; Comments tab | ZI | ❌ | L | S | ZI-cust |
| Customer attachments | 3×10 MB, show-in-portal toggle | ZI | ❌ | L | S | ZI-cust |
| Customer custom fields | Per module | ZI (3), ZB-Std | ❌ | M | M | ZI-cust |
| Statement send/print | Period picker; PDF / print / email; "Attach unpaid invoices list"; bulk send/print 25 at a time | ZI | ⚠️ ledger export only | H | S | ZI-cust |
| Merge customers | Pick master; transactions move; others inactive | ZI | ❌ | M | S | ZI-cust |
| Clone customer | Prefilled copy | ZI | ❌ | L | S | ZI-cust |
| Mark inactive / bulk inactive | Single or bulk | ZI | ⚠️ unverified | M | S | ZI-cust |
| Duplicate display name guard | "Allow duplicates" toggle; Duplicate Customers view | ZI | ⚠️ | M | S | ZI-cust |
| Link customer ↔ vendor | Same party as both; net settlement against one bank entry | ZB | ❌ separate masters | M | M | ZB-link |
| Customer hierarchy | Parent/sub-customers up to 5 levels; consolidated balance; pay across subs; statements incl. subs | ZB | ❌ | L | M | ZB-hier |
| Stop/enable reminders per customer | Suppress automated reminders | ZI | ❌ | M | S | ZI-cust |
| Activity timeline / mails tab | Recent activities; email log; linked Gmail/Outlook | ZI | ❌ | L | M | ZI-cust |
| Customer owner / assigned customers | Role "Staff – Assigned Customers Only" | ZI | ❌ | L | M | ZI-users |
| Saved filters / custom views | Overdue, Unpaid, Inactive, Duplicate, Portal-enabled; custom criteria + columns + sharing | ZI | ❌ | M | M | ZI-cust |
| Bulk update customers | Payment terms, currency, custom fields | ZI | ❌ | L | S | ZI-cust |
| Branch-wise opening balance | Opening balance split by branch | ZB | ❌ | L | S | ZB-ob |
| Write-off opening balance | Write off with date + reason; cancel | ZB | ⚠️ party write-off (opening part unverified) | L | S | ZB-ob |
| Multi-currency per customer | Bill same customer in several currencies | ZB-Prem | ❌ | L | L | ZB-cust |
| MSME flag on vendor | "Vendor is MSME registered" + Udyam type/no; bulk update wizard | ZB | ❌ | M | S | ZB-tax |
| Vendor TDS certificates | Lower/nil deduction certificate with section, rate, dates | ZB | ❌ | L | S | ZB-cust |
| Vendor bank accounts | Store vendor IFSC/account for payouts | ZB | ❌ | M | S | ZB-bankint |
| Customer reviews | Request review, 1–5 stars, report | ZI | ❌ | L | M | ZI-portal |
| Export contact persons / addresses | Separate exports; include-PII toggle; password | ZB | ⚠️ party export only | L | S | ZB-cust |

## 5. Items / catalog

| Feature / option | Zoho detail (concrete sub-options) | Plan | Muneem today | Value | Effort | Src |
|---|---|---|---|---|---|---|
| Goods vs Service item type | Type field; service items without stock | ZI | ⚠️ SAC allowed; no service type / non-stock item | H | S | ZI-items |
| Item image | Upload, shown on transactions | ZI | ❌ | M | S | ZI-items |
| Item description | Sales & purchase descriptions | ZI | ❌ | M | S | ZB-items |
| Separate purchase description & account | Sales account, purchase (COGS) account per item | ZB | ❌ | L | S | ZB-items |
| Preferred vendor | Per item, used for reorder | ZB | ❌ | M | S | ZB-items |
| Tax exemption reason | Mandatory reason for non-taxable items; bulk create reasons | ZI | ⚠️ exempt/nil types exist, no reason | L | S | ZI-gst |
| HSN digit validation & bulk fix | 4/6-digit rule by turnover; Validate HSN/SAC in bulk; HSN update history | ZB | ⚠️ missing-HSN report only | M | S | ZB-hsn |
| GST rate change migration tool | Review updates by HSN, schedule rate change date, export/import tax update file | ZB | ⚠️ via import round-trip only | M | M | ZB-tax |
| Quantity decimal places preference | Configurable (default 2) | ZI | ⚠️ fixed 3dp | L | S | ZI-items |
| Allow duplicate item names | Requires mandatory SKU | ZI | ❌ | L | S | ZI-items |
| Clone item | Prefilled copy | ZI | ❌ | M | S | ZI-items |
| Item custom fields | Per module | ZI (3), ZB-Std | ❌ | M | M | ZI-items |
| Item custom views / column chooser | Criteria, columns, pin 2 columns, wrap/clip | ZI | ❌ | L | M | ZB-items |
| Export templates | Choose/rename fields; 25k rows | ZI | ❌ fixed columns | L | S | ZI-items |
| Composite items / kits / assemblies | Assemblies and kits with own price; component stock | ZB-Elite | ❌ | M | L | ZB-adv |
| Price list: markup/markdown % | Price list as % up/down vs per-item rates; sales & purchase types | ZB-Pro | ⚠️ per-item rates, qty breaks, dates; no % mode, no purchase lists | M | S | ZB-pl |
| Price list import/export | CSV/TSV/XLS | ZB-Pro | ❌ | L | S | ZB-pl |
| Item variants | (Zoho Inventory item groups) | ZB-Elite | ⚠️ schema only | M | M | ZB-adv |
| Barcode generation & scanning | Generate barcodes, print labels | ZB-Elite | ⚠️ scanning ✅, generation/labels ❌ | H | M | ZB-matrix |
| Item reporting tags | Tags auto-applied on transactions | ZB-Std | ❌ | L | M | ZB-tags |

## 6. Payments & collections

| Feature / option | Zoho detail (concrete sub-options) | Plan | Muneem today | Value | Effort | Src |
|---|---|---|---|---|---|---|
| Payment receipt document | Print/PDF/email receipt; receipt template; thank-you note | ZI | ❌ | H | S | ZI-pay, ZB-pr |
| TDS deducted by customer | "Tax Deducted?" + amount + TDS account on receipt; TDS-only receipt (amount 0) | ZI | ❌ | H | S | ZI-pay, ZB-invpay |
| Bank charges on receipt | Bank Charges field | ZI | ❌ | M | S | ZI-pay |
| Payment attachments & notes | Attach proof; notes | ZI | ⚠️ reference ✅, attachments ❌ | L | S | ZI-pay |
| Configurable payment modes | "+ Configure Payment Mode" | ZI | ⚠️ fixed cash/UPI/card/bank/cheque/other | L | S | ZI-pay |
| Deposit-to account choice | Pick bank/cash account receiving the money | ZB | ⚠️ method maps to account; multiple bank accounts unclear | M | S | ZB-pr |
| Refund customer advance / excess | Refund full/partial; refund history; edit/delete | ZB | ❌ | M | S | ZB-pr |
| GST on customer advance | Customer Advance with Place of Supply, description of supply, tax | ZB | ❌ | M | M | ZB-pr |
| Vendor advance with RCM/TDS | Destination of supply, description, RCM checkbox, TDS section; apply to bills; refund | ZB | ⚠️ advances exist; no GST/TDS on advance | M | M | ZB-pm |
| Bulk payment across many bills/vendors | Filter open bills, pay many vendors in one go | ZB | ⚠️ single party per payment | M | S | ZB-bills |
| Payment import | Import payments / applied excess payments | ZB | ❌ | L | S | ZB-pr |
| Bulk actions on payments | Bulk PDF/print/email/delete/update | ZB | ❌ | L | S | ZB-pr |
| Payment custom fields | Label/type/PII/mandatory/show in PDF | ZB | ❌ | L | M | ZB-invpay |
| Notify via SMS on payment | "Notify via SMS" checkbox | ZB | ❌ | M | M | ZB-pr |
| Cheque lifecycle / PDC | Cheque statuses To Be Printed / Uncleared / Cleared / Void; cleared on bank match | ZB-Prem | ❌ (cheque is a mode only) | H | M | ZB-cheque |
| Cheque printing | Save & print now/later; auto cheque number; bulk print 100; void cheque | ZB-Prem | ❌ | M | M | ZB-cheque |
| Online gateways | Zoho Payments, Razorpay, Paytm, PayPal, Stripe, Verifone, ICICI eazypay; per-invoice payment options; partial payments allowed toggle | ZI, ZB-Free | ❌ 📝 FR-095 | H | L | ZI-gw, ZB-gw |
| Gateway clearing & fees | Clearing account, fee account, payout matching | ZB | ❌ | M | M | ZB-gw |
| Saved card / auto-charge | Charge Customer with card on file | ZI | ❌ | L | L | ZI-gw |
| Vendor payouts via connected bank | IMPS/NEFT/RTGS from ICICI, SBI, Axis, HSBC, Kotak, SC, Yes Bank | ZB-Free | ❌ | L | L | ZB-bankint |
| Bharat Connect B2B payments | Send/receive invoices, POs, notes; pay via network | ZB-Free | ❌ | L | L | ZB-bharat |
| Bad debt account on write-off | Write-off posts to Bad Debt; excluded from payments report | ZI | ⚠️ write-off exists (account mapping unverified) | L | S | ZI-invm |

## 7. Reminders / communication

| Feature / option | Zoho detail (concrete sub-options) | Plan | Muneem today | Value | Effort | Src |
|---|---|---|---|---|---|---|
| Email documents | Send invoice/quote/CN/receipt/statement by email with PDF attached (or link); CC/BCC | ZI | ❌ 📝 FR-085 (Save-as-PDF only) | H | M | ZI-email |
| Email templates per notification | Per module; subject/body with placeholders; From/CC/BCC; default; 5×5 MB attachments; clone | ZI | ❌ | H | M | ZI-email |
| Template placeholders | Customer name, invoice #, amount, balance, due date, portal link, org fields… | ZI | ❌ | H | S | ZI-email |
| Sender identity | Add/verify senders; DKIM domain auth; public-domain replacement | ZI | ❌ | M | M | ZI-email |
| Custom SMTP relay | Server, port, TLS, auth, daily limit | ZB | ❌ | M | S | ZB-email |
| Email open tracking | Sent / opened / viewed-in-portal icons; "Client Viewed" filter | ZI | ❌ | L | M | ZI-email |
| WhatsApp send | Send > WhatsApp Message (click-to-chat) with editable message; requires country code | ZI | ❌ 📝 FR-085 | H | S | ZI-invm |
| WhatsApp Business API | Approved templates (utility/marketing), dynamic PDF attachment, CTA & quick-reply buttons, quote accept/reject, bulk send, two-way chat inbox, opt-out, credits, delivery report | ZB-Free | ❌ 📝 FR-088 (consent only) | H | L | ZB-wa |
| SMS notifications (DLT) | Balance, quote, invoice, reminder, thank-you, payment-link SMS; DLT registration (entity ID, sender ID, chain IDs, template IDs); free/credit packs; Twilio | ZI, ZB | ❌ | M | L | ZI-sms, ZB-sms |
| Automated due-date reminders | 3 defaults; N days before / on / after due date; recipient me/customer/both; enable per reminder; add more | ZI | ❌ 📝 FR-088 | H | M | ZI-rem, ZB-rem |
| Manual reminders | Reminder for Overdue / Sent invoices templates; Send Now; bulk reminders | ZI | ❌ | H | S | ZI-rem |
| Expected-payment-date reminders | Remind self N days before/after; pause dunning until then | ZI | ❌ | M | S | ZI-rem |
| Stop reminders per invoice | Stop Reminders action | ZI | ❌ | M | S | ZI-invm |
| Bill due reminders to user | Remind on bill due / expected payment date | ZB | ⚠️ in-app supplier-due notification | L | S | ZB-rem |
| Weekly summary email | Weekly income/expense, cash flow, alerts to admins (Slack optional) | ZI | ❌ | M | S | ZI-pref |
| Communication preferences per contact | Enable/disable SMS/WhatsApp per contact person; bulk update | ZI | ⚠️ DPDP consent per channel exists | L | S | ZI-sms |
| Notifications report | SMS / WhatsApp / system mail logs | ZI | ❌ | L | S | ZI-rpt |
| AI-drafted email content | "Generate with Zia" tone/content | ZI | ❌ | L | M | ZI-ai |

## 8. GST & compliance

| Feature / option | Zoho detail (concrete sub-options) | Plan | Muneem today | Value | Effort | Src |
|---|---|---|---|---|---|---|
| GSTR-1 JSON export | Export As JSON for portal upload | ZB | ❌ CSV/XLSX only | H | M | ZB-gst |
| Direct GSTR-1 push & file | Online filing settings (GSTN username, API access), OTP session, Push to GSTN, Check Status, Failed Transactions, File with PAN+OTP/EVC, Mark as Filed/Unfiled, filing history | ZI, ZB-Free | ❌ 📝 FR-092 | H | L | ZI-gstfile, ZB-gst |
| Documents Issued editor | Edit/clone document series rows | ZI | ⚠️ DOCS auto-generated, not editable | L | S | ZI-gstfile |
| Supplies through e-commerce operator | GSTR-1 table 14/15 (sec 9(5)) | ZB | ❌ | L | M | ZB-gst |
| GSTR-1 e-invoice reconciliation | Pull IRP auto-drafts; Excluded / Partial / Missing | ZB | ❌ | M | M | ZB-gst |
| QRMP / quarterly reporting | Reporting period Monthly or Quarterly (IFF) | ZI | ⚠️ monthly screen only | H | S | ZI-gst |
| GSTR-2A reconciliation | Missing in GSTN / Missing in Books / Partial / Matched / Reconciled; Add to GSTN, Create & Match, Modify & Match | ZB | ❌ | H | L | ZB-gst |
| GSTR-2B reconciliation | Fetch 2B; regenerate after IMS; auto-categorise | ZB | ❌ | H | L | ZB-gst |
| IMS (Invoice Management System) | Accept / Reject / Pending per supplier invoice; push actions; reset | ZB-Free | ❌ | H | L | ZB-gst |
| GSTR-3B push/file & ITC edits | Edit ITC reversed 4(B), reclaimed 4(D); push; pay; mark filed with auto journal | ZB | ⚠️ 3B summary + set-off + challan recording; no push/ITC edit | H | M | ZB-gst |
| GST payment via bank | Pay challan (CPIN) through ICICI/HSBC/Yes integration | ZB | ❌ (recording only ✅) | L | L | ZB-bankint |
| GSTR-9 annual return | Generate, fetch auto-calculated summary, mismatch compare, edit tables, push, mark filed | ZB | ❌ | M | L | ZB-gst |
| CMP-08 (composition quarterly) | Summary at composition %, interest, push, pay, mark filed; JSON export | ZB | ❌ | H | M | ZB-gst |
| GSTR-4 (composition annual) | Bill of supply mapped to GSTR-4 tables | ZB | ❌ | M | M | ZB-inv |
| GST filing approval | Approvers (≤5); submit / recall / approve / reject | ZI | ❌ | L | S | ZB-gst |
| e-Invoicing (IRN) | Zoho as GSP; per-GSTIN IRP connect; push invoices/CN/DN; statuses; bulk push; JSON export; associate IRN manually; cancel within 24 h / mark cancelled; lock after push; 30-day rule warning; optional-field config | ZB-Std | ❌ 📝 FR-089 | H | L | ZB-einv |
| e-Way Bill | Thresholds per state; transporter master; Part A/B (mode, vehicle, doc no); distance auto; generate from invoice/CN/DC; cancel 24 h; extend validity; change transporter/vehicle; multi-vehicle; exclude; bulk JSON/Excel; gold rules; print with QR; 180-day rule | ZB-Free | ❌ 📝 FR-090 | H | L | ZB-ewb |
| Reverse charge on purchases | RCM checkbox on bills/expenses/vendor advance; RCM liability in 3B | ZB | ⚠️ refused today | H | M | ZB-exp, ZB-gst |
| RCM self-invoice | Print Self-Invoice for unregistered-vendor RCM | ZB | ❌ | M | S | ZB-bills |
| Reverse charge in sales | "Enable reverse charge in sales transactions" | ZI | ❌ | L | S | ZI-gst |
| Export / SEZ / LUT supplies | GST treatment Overseas/SEZ; with/without IGST; endorsement on PDF | ZI | ❌ (EXP section exists in GSTR-1) | M | M | ZI-gst, ZB-inv |
| Bill of Entry (imports) | Port code, assessable value, customs duty, IGST, landed-cost allocation, from bills | ZB | ❌ | L | M | ZB-boe |
| Multi-GSTIN per branch/location | Each location its own GSTIN, series, IRP connection, returns per GSTIN | ZB-Pro (Locations ₹600/mo) | ❌ GSTIN inherited from business | M | L | ZB-branch, ZB-loc |
| GST TDS (sec 51) | Enable for customers/vendors; 2% (1+1 / IGST); GST TDS on invoice; record at payment | ZI | ❌ | L | M | ZI-gtds |
| ISD returns (GSTR-6/6A) | ISD GSTIN; credit distribution; GSTR-6 | ZB | ❌ | L | L | ZB-gst |
| MSME / Udyam | Org Udyam type + number on PDF; vendor MSME flag; "MSME bills unpaid 40+ days" view (43B(h)) | ZI | ❌ | M | S | ZI-msme, ZB-tax |
| Composition % setting | Composition scheme % used for liability | ZI | ⚠️ composition scheme ✅; % liability calc absent | M | S | ZI-gst |
| GST registration date & legal/trade name | Registered-on date, legal vs trade name | ZI | ⚠️ legal name ✅, reg date ❌ | L | S | ZI-gst |

## 9. TDS / TCS (income tax)

| Feature / option | Zoho detail (concrete sub-options) | Plan | Muneem today | Value | Effort | Src |
|---|---|---|---|---|---|---|
| TDS on purchases/bills | TDS rate on bill sub-total; amount withheld at payment; TDS account | ZB | ❌ 📝 FR-098 | H | M | ZB-bills, ZB-itds |
| TDS on sales (receivable) | TDS on quotes, invoices, CNs, recurring, receipts; transaction or line level | ZI | ❌ 📝 FR-098 | H | M | ZI-tds |
| TDS section master | Sections & rates incl. 2025 Act renumbering (e.g. 194C/194J→392/393), effective dates | ZB | ❌ | H | S | ZB-tdsupd |
| TDS override | Edit computed TDS amount | ZI | ❌ | M | S | ZI-tds |
| TDS surcharge / cess / groups | New TDS Surcharge, TDS Cess, TDS Group | ZI | ❌ | L | S | ZI-tds |
| TDS on vendor advance | Section + % on advance | ZB | ❌ | M | S | ZB-pm |
| TDS liabilities & challans | Monthly liability; Record Challan (challan no, BSR, date, interest, penalty, auto-allocate); associate challans; import/export (cess, surcharge) | ZB | ❌ | M | M | ZB-tdsch |
| TDS Receivables Summary | By section/customer, verify vs Form 26AS | ZB | ❌ | M | S | ZB-rpt |
| Lower-deduction certificates | Vendor TDS certificates | ZB | ❌ | L | S | ZB-cust |
| TCS on bills/invoices | 206C(1H) rate with override; 2025 TCS rate changes (206C(1), 206C(1G)) | ZB | ❌ | M | M | ZB-bills, ZB-tdsupd |

## 10. Purchases / expenses

| Feature / option | Zoho detail (concrete sub-options) | Plan | Muneem today | Value | Effort | Src |
|---|---|---|---|---|---|---|
| Purchase Orders | Vendor, deliver-to (org or customer), expected delivery, shipment preference; Draft/Open/Partially Billed/Billed/Closed/Cancelled; convert to bill; cancel items; email | ZB-Free | ❌ | H | M | ZB-po |
| PO acceptance by vendor | Public link accept/decline; secure link | ZB | ❌ | L | M | ZB-po |
| PO close rule | Close on receive / bill / both | ZB | ❌ | L | S | ZB-po |
| Purchase receive (GRN) | Partial/full receive vs PO | ZB-Elite (Inventory) | ❌ | M | M | ZB-adv |
| Pull open POs into bill | Include open POs when creating bill | ZB | ❌ | M | S | ZB-bills |
| Recurring bills | Profile with schedule | ZB-Pro | ❌ | M | S | ZB-matrix |
| Recurring expenses | Profile name, start/end, repeat every | ZB-Std | ❌ | M | S | ZB-exp |
| Custom expense categories | New/edit/inactive categories (accounts) | ZI | ❌ 8 fixed | H | S | ZI-exp |
| Itemized expense | Split one expense across categories | ZI | ❌ | M | S | ZI-exp |
| Bulk add expenses | Grid entry of many expenses | ZI | ❌ | L | S | ZI-exp |
| Expense employee | Employee field; Expenses by Employee | ZB | ❌ | L | S | ZB-exp |
| Mileage | Distance or odometer; rate by date; vehicles; default unit | ZI | ❌ | L | M | ZI-exp |
| Expense receipt attachment | Attach photo/upload; with/without receipt filters | ZI | ❌ | M | S | ZI-exp |
| Receipt autoscan (OCR) | Extract date, amount, merchant, lines; inbox; email-forward receipts | ZB-Free (50/mo) | ❌ | M | L | ZB-docs |
| Expense import / export | CSV/XLS import with mapping | ZI | ❌ import | L | S | ZI-exp |
| Expense statuses | Non-billable / Unbilled / Invoiced / Reimbursed | ZI | ❌ | L | S | ZB-exp |
| Bill approval | Submit for approval; Pending Approval status | ZB-Pro | ❌ | L | M | ZB-appr |
| Bill PDF template & print | Bill PDF | ZB | ❌ | L | S | ZB-bills |
| Vendor credit refund | Refund vendor credit full/partial; refund history | ZB | ⚠️ debit note ✅; supplier refund flow unverified | M | S | ZB-vc |
| Debit note cancel | Void/cancel vendor credit | ZB | ❌ | M | S | ZB-vc |
| Landed cost from a separate bill | Pull freight agency bill cost into another bill's lines; allocate by value/qty | ZB-Pro | ⚠️ landed-cost charges on same purchase only | M | S | ZB-bills |
| Bill calendar view | Overdue bills by month | ZB | ❌ | L | S | ZB-bills |
| Vendor statement | Statement PDF/email to vendor | ZB | ⚠️ ledger export | M | S | ZB-cust |
| Payment Made email to vendor | Notification with PDF | ZB | ❌ | L | S | ZB-bills |
| Vendor portal | Vendors view POs, upload invoices, accept/reject POs | ZB-Prem | ❌ | L | L | ZB-matrix |

## 11. Inventory

| Feature / option | Zoho detail (concrete sub-options) | Plan | Muneem today | Value | Effort | Src |
|---|---|---|---|---|---|---|
| Batch tracking & expiry | Batch no, manufacturer batch, mfg/expiry date, MRP, selling price per batch | ZB-Elite | ⚠️ schema only, 📝 FR-091 | H | M | ZB-adj |
| Serial numbers | Track per unit | ZB-Elite | ❌ | M | M | ZB-matrix |
| Warehouses / multiple locations | Warehouse locations under business locations; stock per warehouse | ZB-Elite | ⚠️ one warehouse per branch, no UI, 📝 FR-093 | M | M | ZB-loc |
| Transfer orders | Move stock between warehouses/branches | ZB-Elite | ❌ | M | M | ZB-adv |
| Bin locations | 2,000–5,000 bins per location | ZB-Elite | ❌ | L | M | ZB-matrix |
| Value adjustment (revaluation) | Increase/decrease stock value | ZB | ❌ quantity adjustments only | L | S | ZB-adj |
| Adjustment approvals & drafts | Draft / Pending Approval / Adjusted; bulk approve | ZB | ❌ | L | S | ZB-adj |
| FIFO valuation | FIFO cost lots | ZB | ❌ moving WAC only | L | M | ZB-items |
| Replenishment / auto-PO | Scheduled replenishment incl. in-transit; create PO/TO | ZB-Elite | ❌ (low stock alert only) | M | M | ZB-adv |
| Committed / available-for-sale stock | From SOs/DCs | ZB | ❌ | L | M | ZB-rpt |
| Packages, picklists, shipments | Packages from SO, picklists, carrier shipping & tracking, shipping labels | ZB-Elite | ❌ | L | L | ZB-adv |
| Online channels | Amazon, Etsy, Shopify (2 stores) sync | ZB-Elite | ❌ | M | L | ZB-matrix |
| Out-of-stock bell notification | Bell on negative stock | ZB | ⚠️ policy key, no UI | L | S | ZB-items |

## 12. Banking

| Feature / option | Zoho detail (concrete sub-options) | Plan | Muneem today | Value | Effort | Src |
|---|---|---|---|---|---|---|
| Multiple bank / credit-card accounts | Bank: name, code, account no, bank, IFSC, users, locations; credit cards; PayPal | ZB-Free | ⚠️ bank book exists; account setup UI limited | M | S | ZB-bankacc |
| Statement import | CSV, TSV, OFX, QIF, CAMT.053, PDF (password-protected); amount column modes; mapping memory; undo last import | ZB-Free | ❌ 📝 FR-094 | H | M | ZB-banktx |
| Automatic bank feeds | Yodlee/Token aggregators; direct feeds SBI, ICICI, Axis, Kotak, HSBC, SC; daily refresh | ZB-Free/Std | ❌ | M | L | ZB-feeds |
| Match & categorise | Match found / best matches / multi-select match; create adjustment while matching; unmatch; uncategorise; exclude duplicates | ZB-Free | ❌ | H | M | ZB-match |
| Transaction rules | Deposit/withdrawal rules on payee/description/reference/amount; recognized vs auto-categorise | ZB-Free | ❌ | M | M | ZB-rules |
| Bank reconciliation | Start/end date, closing balance, tick cleared, difference 0, save later, undo, history | ZB-Free | ❌ | H | M | ZB-recon |
| Record deposits (cash → bank) | Deposit slip grouping cash receipts, bank charges | ZB | ⚠️ safe drop + journal | M | S | ZB-deposit |
| Fund transfer / owner drawings | Transfer between accounts, owner's drawing/contribution, card payment, loans | ZB | ⚠️ via manual journal only | M | S | ZB-lock |
| Auto-forward statements by email | Unique inbox address | ZB-Free | ❌ | L | M | ZB-docs |
| AI categorisation suggestions | Suggest category/contact/account | ZB | ❌ | L | M | ZB-ai |
| Virtual account per customer | SC virtual account suffix on invoice for auto-matching | ZB | ❌ | L | L | ZB-bankint |

## 13. Accounting

| Feature / option | Zoho detail (concrete sub-options) | Plan | Muneem today | Value | Effort | Src |
|---|---|---|---|---|---|---|
| Sub-accounts / parent accounts | Account hierarchy | ZB-Free | ⚠️ add/rename; hierarchy unverified | M | S | ZB-coa |
| Account code & description | Unique code ≤50 chars | ZB | ⚠️ | L | S | ZB-coa |
| COA import / bulk update / inactive | Import CSV; bulk update type/parent/code (1,000); mark inactive; delete unused | ZB-Std | ❌ | L | S | ZB-coa |
| Account watchlist on dashboard | Flag accounts | ZB | ❌ | L | S | ZB-coa |
| Draft journals & bulk publish | Draft / Published; approvals | ZB | ❌ | L | S | ZB-mj |
| Journal contact & type per line | Contact + Sales/Purchases type per line; reporting tags | ZB | ⚠️ unverified | L | S | ZB-mj |
| Journal import/export | CSV with auto-number | ZB | ❌ | L | S | ZB-mj |
| Journal templates | Reusable templates | ZB-Std | ❌ | L | S | ZB-matrix |
| Recurring journals | Scheduled journals | ZB-Pro | ❌ | L | S | ZB-matrix |
| Cash-basis reporting | Report basis Accrual / Cash; journal reporting method | ZB | ❌ accrual only | M | M | ZB-mj, ZB-rpt |
| Per-module lock dates & partial unlock | Lock individual modules or all; partial unlock window with reason | ZB-Std | ⚠️ monthly period lock (all modules) | L | S | ZB-lock |
| Budgets | Budget vs actuals | ZB-Prem | ❌ | L | M | ZB-matrix |
| Fixed assets & depreciation | Asset register, depreciation | ZB-Prem | ❌ | M | M | ZB-matrix |
| Multi-currency & exchange rates | Currencies, auto rates feed, base currency adjustment, realized/unrealized gain/loss | ZB-Pro | ❌ INR only | L | L | ZB-cur, ZB-fx |
| Reporting tags (cost centres) | Up to 5-level options; transaction/line level; mandatory; visibility conditions; access control | ZB-Std | ❌ | L | M | ZB-tags |
| Opening balance wizard | Opening balance date; all accounts grid; difference to Opening Balance Adjustment | ZB | ⚠️ party & stock openings; general accounts via journal | M | S | ZB-ob |
| Invite accountant | Accountant user seat (free on every plan) | ZB-Free | ⚠️ accountant role preset; no invite flow | M | S | ZB-matrix |
| Multi-organisation switcher | Many orgs per login | ZI | ❌ | M | M | ZI-platform |

## 14. Reports (missing reports by name, then report features)

| Feature / option | Zoho detail (concrete sub-options) | Plan | Muneem today | Value | Effort | Src |
|---|---|---|---|---|---|---|
| Cash Flow Statement | Operating / investing / financing; compare | ZB | ❌ | M | M | ZB-rptbo |
| Horizontal (T-format) P&L | Expense vs income sides, opening/closing stock | ZB | ❌ | M | S | ZB-rptbo |
| Horizontal Balance Sheet | Side-by-side | ZB | ❌ | M | S | ZB-rptbo |
| Business Performance Ratios | Current, gross profit, debt, net profit, acid test, receivable turnover, D/E, operating cost | ZB | ❌ | L | S | ZB-rptbo |
| Cash Flow Forecasting | From recurring docs + assumptions | ZB-Prem | ❌ | L | M | ZB-rptbo |
| Movement of Equity | Opening, changes, closing | ZB | ❌ | L | S | ZB-rptbo |
| Sales by Customer | Count, sales, sales with tax; incl. returns | ZI | ❌ | H | S | ZI-rpt |
| Sales by Salesperson | Invoices − credit notes per person | ZI | ❌ | M | S | ZI-rpt |
| Customer Balance Summary | Invoiced, received, closing; exclude zero; GST-treatment filter; credit limit column | ZB | ⚠️ ageing + ledger | M | S | ZB-rptrec |
| AR Aging options | Aging by due/invoice date; custom interval length & count; show by amount or count; group by salesperson | ZI | ⚠️ fixed buckets | M | S | ZI-rpt |
| Invoice Details | By invoice/due date, status filter | ZI | ⚠️ sales register | L | S | ZI-rpt |
| Receivable Summary / Details | Per item across invoices, CNs, receipts | ZI | ⚠️ | L | S | ZI-rpt |
| Bad Debts | Customers written off in period | ZI | ❌ | L | S | ZI-rpt |
| Time to Get Paid | 0–15/16–30/31–45/>45 day buckets | ZI | ❌ | M | S | ZI-rpt |
| Refund History | CN/advance refunds | ZI | ❌ | L | S | ZI-rpt |
| Quote Details / SO Details / DC Details / Retainer Details / Progress Invoice Summary / Recurring Invoice Details | Per-module detail reports | ZI/ZB | ❌ (modules absent) | M | S | ZI-rpt, ZB-rptrec |
| Expenses by Category | Count, amount incl./excl. tax, drill-down | ZI | ⚠️ expense register | M | S | ZI-exp |
| Expenses by Customer / Project / Employee; Billable Expense Details; Mileage by Employee | — | ZI | ❌ | L | S | ZI-exp |
| Purchases by Vendor | — | ZB | ❌ | M | S | ZB-cdash |
| Purchases by Item | Qty, total, average price | ZB | ❌ | M | S | ZB-items |
| Vendor Balance Summary | Billed, paid, closing | ZB | ⚠️ payables ageing | L | S | ZB-rptpay |
| PO Details / POs by Vendor / PO by Item | — | ZB | ❌ | L | S | ZB-rptpay |
| Vendor Credits Details | — | ZB | ⚠️ | L | S | ZB-cdash |
| Inventory Summary | Qty ordered/in/out/on hand/committed/available/in-transit | ZB | ⚠️ stock movement + valuation | M | S | ZB-rptinv |
| Inventory Aging Summary | Age buckets, moving/not-moving | ZB | ❌ | M | S | ZB-rptinv |
| ABC Classification | By usage value or qty; A/B/C % | ZB | ❌ | L | S | ZB-rptinv |
| FIFO Cost Lot Tracking | Product in/out lots | ZB | ❌ | L | M | ZB-rptinv |
| Inventory Adjustment Summary / Details | By reason/type, qty & value | ZB | ⚠️ in stock movement | L | S | ZB-rptinv |
| Order Fulfillment by Item / Shipment by Item | — | ZB | ❌ | L | M | ZB-rptsales |
| Tax summary by rate | (Zoho: Show Tax Summary in 3B/1 sections) | ZB | ❌ standalone report | M | S | ZB-gst |
| GSTR-2A/2B, GSTR-9, CMP-08, TDS Receivables, TDS Liabilities | See §8–9 | ZB | ❌ | H | L | ZB-gst |
| Activity Logs viewer | Filter by date, module, contact, user, action, PII; export/print | ZB-Free | ⚠️ hash-chained log, no viewer | M | S | ZB-act |
| Audit trail version compare | Per-record versions side-by-side (yellow/pink/green) | ZB-Free | ❌ | M | M | ZB-act |
| System mails / portal activity reports | — | ZI | ❌ | L | S | ZI-rpt |
| Compare with periods | Previous periods/years, by tag/branch | ZB | ❌ | M | M | ZB-rptmgr |
| Schedule & email reports | Weekly/monthly/quarterly/yearly, time, recipients, format; scheduled reports page | ZB-Free (5) | ❌ | M | M | ZB-rptmgr |
| Custom report builder | Parent+child modules, group by, filters, columns, formula rows, account groups, permissions | ZB-Std (10)/Prem builder | ❌ | L | L | ZB-rptcust |
| Saved custom reports / favourites | Save as custom report; star favourites | ZI | ❌ | M | S | ZI-rpt |
| Show/hide & reorder columns | Available ↔ selected | ZI | ❌ | M | S | ZI-rpt |
| Group by / advanced filters | Field + comparator + value; group-by | ZI | ⚠️ range + branch filter only | M | S | ZI-rpt |
| Report layout settings | Density, table design, paper, orientation, font, margins, generated by/date/time, header on each page | ZI | ⚠️ | L | S | ZI-rpt |
| Charts, forecast, anomaly | Chart view with axes; forecast; anomaly | ZB-Prem | ❌ | L | M | ZB-rptmgr |
| Share report with users | View / view+export permissions | ZB | ❌ | L | S | ZB-rptmgr |
| Password-protected export | Password on XLSX/ZIP | ZI | ❌ | L | S | ZI-rpt |
| Drill-down to transaction | Click amount → detail → voucher | ZB | ⚠️ unverified | M | S | ZB-rptmgr |
| Dashboard: receivables/payables current vs overdue, cash-flow graph, top expenses, watchlist | Clickable panels | ZB | ⚠️ KPIs/charts exist; no payables/top-expenses/watchlist panels | M | S | ZB-dash |
| Custom dashboards | Named dashboards, report panels, chart type, sharing | ZB-Elite | ❌ | L | M | ZB-cdash |
| BI analytics | 50+ visualisations, KPIs (Zoho Analytics) | ZB-Ult | ❌ | L | L | ZB-matrix |

## 15. Automation / workflows / AI

| Feature / option | Zoho detail (concrete sub-options) | Plan | Muneem today | Value | Effort | Src |
|---|---|---|---|---|---|---|
| Workflow rules | Event-based (created/edited/deleted/approved…) or date-based (N days before/after, cycle); criteria with AND/OR | ZB-Pro (10) | ❌ | L | L | ZB-wf |
| Workflow actions | Email alerts, field updates, in-app notifications, WhatsApp alert, webhooks, custom functions | ZB-Pro/Prem | ❌ | L | L | ZB-wfa |
| Outgoing webhooks | URL, params, headers, auth, HMAC signature, retries | ZB-Prem | ❌ | L | M | ZB-wfa |
| Custom functions & schedulers | Deluge/CLI functions; scheduled jobs; logs | ZB-Prem | ❌ | L | L | ZB-wfa |
| Workflow logs & failure prefs | Logs, retry policy, failure digest | ZB-Pro | ❌ | L | M | ZB-wfl |
| Ask Zia assistant | Chat Q&A over data; create records | ZB | ❌ | M | L | ZB-ai |
| CoCreate agent / speech | Prompt-driven invoice creation; voice input | ZB-Prem | ❌ | L | L | ZB-ai |
| Invoice insights | Overdue balance, slow payers (<70% paid), late-days | ZI | ❌ | M | S | ZI-ai |
| MCP server | Connect ChatGPT/Claude/Cursor to account | ZI, ZB-Free | ❌ | L | M | ZI-ai |
| AI custom fields | Keyword extraction, sentiment, image-to-text | ZB-Prem | ❌ | L | M | ZB-ai |

## 16. Customization

| Feature / option | Zoho detail (concrete sub-options) | Plan | Muneem today | Value | Effort | Src |
|---|---|---|---|---|---|---|
| Custom fields (all modules) | Types & quotas per plan; help text, PII/ePHI, unique, input format/regex, default, mandatory, show in PDF, role access | ZI (3), ZB-Std | ❌ | M | M | ZB-cf |
| Custom views (all lists) | Criteria + pattern, columns, favourite, share with users/roles | ZI | ❌ | M | M | ZB-cv |
| Enable/disable modules | Module checklist hides sidebar items | ZI | ❌ | M | S | ZI-pref |
| Custom statuses | Sub-statuses under parent (SO, PO, retainer) | ZB | ❌ | L | S | ZB-so |
| Validation rules | Criteria + alert; subrules | ZB-Prem | ❌ | L | M | ZB-vr |
| Record locking | Lock configs per role, restrict actions/fields, lock with reason | ZB-Prem | ⚠️ period lock only | L | M | ZB-rl |
| Custom buttons / related lists / web tabs / custom modules / web forms | Deluge/URL buttons; related lists; embedded tabs; custom modules | ZB-Prem | ❌ | L | L | ZB-btn |
| Global keyboard shortcuts | Go-to (Shift+I etc.), create (C+I…), module & record actions; Shift+? cheat-sheet; custom key binding | ZI | ⚠️ POS keys only | M | S | ZB-kbd |
| Quick create (+) & recent history | Create any record from anywhere; recently visited | ZI | ❌ | M | S | ZI-platform |
| Global search / advanced search | Search across modules; advanced search per module | ZI | ❌ (FR-073) | H | M | ZI-platform |
| UI language | Hindi, Tamil, Telugu, Gujarati, Kannada, Marathi + ~25 | ZB | ⚠️ English UI only | M | M | ZB-org |
| Regional formats | Date format & separator; currency symbol/format/decimals/rounding; first day of week | ZI | ⚠️ fixed Indian format | L | S | ZI-org |
| Org profile extras | Industry, website, Company ID, additional label/value fields; address change "new vs all transactions" | ZI | ⚠️ edit business is backend-only | M | S | ZI-org |
| Edit business profile UI | — | ZI | ⚠️ `business.update` no UI | H | S | ZI-org |

## 17. Users / roles / approvals

| Feature / option | Zoho detail (concrete sub-options) | Plan | Muneem today | Value | Effort | Src |
|---|---|---|---|---|---|---|
| Invite users | Name, email, role, restrict to locations / tag options | ZI (2 users) | ❌ cloud creates owner only | H | M | ZB-users |
| Custom roles | New/clone role; per-module access; approve; edit/delete approved; report access; PII access | ZB-Pro | ⚠️ RBAC with presets; custom-role UI absent | M | M | ZB-users |
| Field-level access | Read/write / read-only / hidden per role | ZB | ❌ | L | M | ZB-cf |
| Segmented access | By location, bank account, reporting tag | ZB-Elite | ⚠️ branch-scoped (verify) | L | M | ZB-users |
| Deactivate / transfer super admin | Mark inactive; make super admin | ZI | ⚠️ device revoke ✅; user inactive unverified | M | S | ZI-users |
| MFA / 2FA | TOTP, passkey, security key, backup codes; org-enforced | ZI | ❌ | M | M | ZI-privacy |
| Transaction approvals | No / Simple / Multi-level (≤10) / Custom criteria approvals per module (quotes, SO, invoices, CN, PO, bills, payments, adjustments…); notifications; approve own | ZB-Pro | ❌ | M | M | ZB-appr |
| Digital signature (DSC) | USB-token signing of invoices/quotes/CN/PO; mandatory toggle | ZB-Pro | ❌ | L | L | ZB-dsc |
| e-Sign (Zoho Sign) | User signature on invoices; customer signature on quotes | ZI | ❌ | L | M | ZI-sign |
| PII protection | "Access to protected data" permission; restricted export | ZB | ⚠️ DPDP consent/erase ✅; no PII-export permission | L | S | ZB-privacy |

## 18. Customer / vendor portal & sharing

| Feature / option | Zoho detail (concrete sub-options) | Plan | Muneem today | Value | Effort | Src |
|---|---|---|---|---|---|---|
| Customer portal | Invite contacts; home (outstanding, credits, last payment, pending quotes); invoices + Pay Now; payments & receipts; statement self-service; quotes accept/decline; comments; update own details; forward docs | ZI | ❌ | M | L | ZI-portal, ZB-portal |
| Portal preferences | Portal name/URL, banner, activity notifications, allow edits, allow forward, reviews, SO/project visibility, custom domain, web tabs | ZI | ❌ | L | M | ZB-portal |
| Portal MFA | TOTP for customers; reset | ZI | ❌ | L | S | ZI-portal |
| Public share links | Share as link: public with expiry (15–90 days) or private via portal; disable all links | ZI | ❌ | H | M | ZI-invm |
| Identity verification on links | Verify email/phone (or contact ID) before viewing | ZI | ❌ | M | S | ZB-genpref |
| Viewed tracking | "Customer Viewed" status/eye icon | ZI | ❌ | L | S | ZI-invm |
| Vendor portal | POs, upload invoices, accept/reject | ZB-Prem | ❌ | L | L | ZB-matrix |

## 19. Integrations / API

| Feature / option | Zoho detail (concrete sub-options) | Plan | Muneem today | Value | Effort | Src |
|---|---|---|---|---|---|---|
| Tally XML export | Masters XML + Transactions XML from selected invoices | ZI (early access) | ❌ | H | M | ZI-tally |
| Public REST API | 1,000–10,000 calls/day by plan | ZB-Free | ❌ | M | L | ZB-matrix |
| Incoming webhooks / signals / widgets | Deluge endpoints, UI widgets | ZB-Prem | ❌ | L | L | ZB-dev |
| Zapier | Triggers (new invoice, payment, contact…) & actions | ZI | ❌ | L | M | ZI-zap |
| CRM sync (Zoho CRM / Bigin) | Two-way customers & items | ZI | ❌ | L | L | ZI-int |
| Google Workspace / Microsoft 365 | Import contacts, invite users, mail fetch | ZI | ❌ | L | M | ZI-int |
| Gmail / Outlook mailbox link | Fetch mails into contact; add mail to invoice | ZI | ❌ | L | M | ZI-int |
| Slack / Cliq notifications | View/accept/pay events to a channel | ZI | ❌ | L | S | ZI-int |
| Cloud storage pickers | Drive, Dropbox, OneDrive, WorkDrive, Evernote, Box for attachments | ZI | ❌ | L | M | ZB-docs |
| Payroll | Employees (10–20 incl.), ₹60/employee add-on | ZB-Prem | ❌ | L | L | ZB-price |
| Bitly short links | Short invoice links for SMS | ZI | ❌ | L | S | ZI-tally |

## 20. Mobile

| Feature / option | Zoho detail (concrete sub-options) | Plan | Muneem today | Value | Effort | Src |
|---|---|---|---|---|---|---|
| Native Android / iOS apps | Quotes, invoices, recurring, bills, expenses, bank feeds, contacts, 50+ reports, e-invoice/e-way bill | ZI, ZB | ❌ 📝 FR-096 | H | L | ZB-mob |
| Web app (browser access) | Any modern browser | ZI | ❌ desktop only (owner web view of daily report is API-only) | M | L | ZI-platform |
| macOS / Windows native apps | Desktop apps | ZI | ⚠️ Electron desktop (Windows focus) | L | M | ZI-platform |
| Push notifications | Payments, approvals | ZB | ❌ (no OS notifications either) | M | M | ZB-mob |
| Camera barcode scan on phone | Mobile scan | ZB | ⚠️ USB/wedge scanner only | M | M | ZB-mob |
| Receipt photo capture & business-card scan | Photo → expense/contact | ZB | ❌ | M | M | ZB-mob |
| GPS mileage | Track trip → expense | ZB | ❌ | L | M | ZB-mob |
| Widgets / Siri / watch / voice invoicing | iOS widgets, Apple Watch, voice | ZB | ❌ | L | L | ZB-mob |

## 21. Data / backup / import

| Feature / option | Zoho detail (concrete sub-options) | Plan | Muneem today | Value | Effort | Src |
|---|---|---|---|---|---|---|
| Import invoices | Map fields; auto-number; link to SO; map customer addresses | ZI | ❌ | M | M | ZB-inv |
| Import payments / CN / journals / COA / expenses / bills / POs / vendor credits / refunds / recurring | Module-specific importers | ZI/ZB | ❌ (products, parties, opening stock, purchase lines only) | M | M | ZB-imp |
| Import options | Duplicate handling skip / overwrite / add new; encoding; delimiter; date & decimal formats; save mapping | ZI | ⚠️ (mapping memory/encoding unverified) | M | S | ZI-imp |
| Import history | User, module, file, status, rows | ZB | ❌ | L | S | ZB-backup |
| Export templates & field choice | Named templates, add/rename fields; status & date range filters | ZI | ❌ | L | S | ZI-imp |
| Export current view | Export what is on screen | ZB | ❌ | L | S | ZB-imp |
| Include-PII toggle & password | Sensitive fields only when ticked; password-protected file | ZI | ❌ | L | S | ZI-imp |
| Human-readable full backup | CSV/XLS of every module as ZIP | ZI | ⚠️ encrypted DB backups only | M | S | ZI-backup |
| Documents backup / audit-trail backup | ZIP of attachments; audit trail ZIP | ZI | ⚠️ audit in DB backup | L | S | ZI-backup |
| Documents module | Inbox, folders with permissions, email-in, autoscan, convert to transaction, match suggestions, trash | ZB-Free | ❌ | M | L | ZB-docs |
| Attach files to any transaction/contact | 5×5 MB | ZB-Free | ❌ (FR-075) | M | M | ZB-matrix |

## 22. Pricing / limits / service

| Feature / option | Zoho detail (concrete sub-options) | Plan | Muneem today | Value | Effort | Src |
|---|---|---|---|---|---|---|
| Free forever tier | Zoho Invoice ₹0 (2 users, 3 custom fields); Books Free ₹0 if revenue < ₹25 L (1 user + 1 accountant, 1,000 invoices/yr) | ZI, ZB-Free | ⚠️ pricing TBD | H | S | ZI-price, ZB-price |
| Published tiered plans | ₹749 / 1,499 / 2,999 / 4,999 / 7,999 per org/month (annual); monthly billing option; 14-day Premium trial | ZB | ⚠️ TBD | H | S | ZB-price |
| Add-ons | Extra user ₹150/mo; location ₹600/mo (1 GSTIN + 10K invoices); SMS ₹75/credit; autoscans ₹419/50; payroll ₹60/employee | ZB | ⚠️ TBD | M | S | ZB-price |
| Support channels | Email 24/5 (ZI); email/voice/chat by tier; paid priority support with onboarding | ZI, ZB | ⚠️ in-app manual + diagnostics; support channel undefined | M | S | ZB-price |
| Migration help | Upgrade path Invoice → Books / Billing with data carried | ZI | ⚠️ import tools only | M | M | ZI-int |

---

## Where Muneem is ahead of Zoho

- **Works offline.** Local-first desktop with 30-day offline login and sync conflict review. Zoho is online-only.
- **Real counter POS.** Register sessions with float, cash in/out, safe drop, X/Z reports, blind close, variance, hold/park, duplicate-bill warning, and POS keys F2–F9. Zoho has POS-style PDF templates but no till workflow.
- **Thermal printing.** Native ESC/POS (network 9100, Windows spooler) at 32/42/48 columns, with cash-drawer kick, a print queue and DUPLICATE reprints. Zoho's 2/3/4-inch templates are PDF only.
- **Barcode scanning in the base product.** Up to 20 barcodes per product with wedge scanning. Zoho puts barcodes in Elite (₹4,999/mo).
- **Cashier controls.** Per-role max discount, max refund and backdate-days limits. Zoho has nothing comparable at the till.
- **Paid-tier features included.** Price lists with qty breaks and date-effective pricing (Zoho Pro+), landed cost on purchases (Pro+), credit-limit checks (Books only), period lock and year-end close (Std+), and unit conversions with custom units.
- **No volume caps.** Zoho caps invoices and bills per year: 1,000 on Free, up to 1,00,000 on Elite.
- **Data safety.** Encrypted scheduled backups with 7/4/3 retention, verify, restore and key escrow. Zoho allows one CSV backup per 15 days. Muneem also has a hash-chained, verifiable audit log.
- **DPDP privacy tools.** Consent per purpose/channel, data export and erase.
- **Offline-tool GSTR-1 CSV.** Covers B2B/B2CL/B2CS/CDNR/CDNUR/EXP/EXEMP/HSN/DOCS and works without GSTN API access. Also: GST set-off and challan recording on every plan, and the 40% rate already in the rate list.
- **Built for Indian retail.** Bilingual Hindi+English "bharat" template, in-app Hindi manual, 3-decimal quantities, MRP field, stock take and stock reconciliation.

## Out of scope (not relevant to Indian SMB billing)

Spain e-invoicing; GoCardless, Mercado Pago, PayTabs, ACH, Venmo and PayPal BNPL; QuickBooks Online sync (not in the India edition); Japanese seal and GCC bilingual templates; payment stub and snail mail (Postal Methods, US); Stripe cross-border, HSBC XACH and SC telegraphic transfers; overseas digital-services tax; pre-GST (2017) PO and the GST migration wizard; Zoho-ecosystem-only links (People, Desk, Cliq, Notebook, SalesIQ, Projects, Expense, Billing, Commerce, Zoho POS, Practice); Apple TV/Watch apps; subscription plans/addons/coupons reports; Zoho-branding removal.

## Sources

| Key | URL |
|---|---|
| ZI-platform | https://www.zoho.com/in/invoice/help/getting-started/exploring-zoho-invoice.html |
| ZI-org | https://www.zoho.com/in/invoice/help/settings/organization-settings.html |
| ZI-users | https://www.zoho.com/in/invoice/help/settings/users.html |
| ZI-pref | https://www.zoho.com/in/invoice/help/settings/preferences.html |
| ZI-cust | https://www.zoho.com/in/invoice/help/contacts/index.html (+ contact-actions, contact-details-page, contact-preferences) |
| ZI-portal | https://www.zoho.com/in/invoice/help/customer-portal/ |
| ZI-items | https://www.zoho.com/in/invoice/help/items/index.html (+ items-preferences, items-more) |
| ZI-quote | https://www.zoho.com/in/invoice/help/estimate/index.html (+ new-estimate, estimate-preferences) |
| ZI-inv | https://www.zoho.com/in/invoice/help/invoice/new-invoice.html |
| ZI-invm | https://www.zoho.com/in/invoice/help/invoice/managing-invoices.html ; .../more-with-invoice.html |
| ZI-invpref | https://www.zoho.com/in/invoice/help/invoice/invoice-preferences.html |
| ZI-pay | https://www.zoho.com/in/invoice/help/invoice/payments-received.html |
| ZI-pdf | https://www.zoho.com/in/invoice/help/pdf-templates/edit-template.html ; https://www.zoho.com/in/invoice/help/settings/templates.html |
| ZI-plink | https://www.zoho.com/in/invoice/help/payment-links/index.html |
| ZI-rec | https://www.zoho.com/in/invoice/help/recurring-invoice/index.html (+ recurring-invoice-preferences) |
| ZI-cn | https://www.zoho.com/in/invoice/help/credit-note/index.html (+ credit-note-preferences) |
| ZI-dc | https://www.zoho.com/in/invoice/help/delivery-challan/index.html |
| ZI-gst | https://www.zoho.com/in/invoice/help/gst/ |
| ZI-gstfile | https://www.zoho.com/in/invoice/help/gst/gst-filing.html |
| ZI-tds | https://www.zoho.com/in/invoice/help/settings/taxes.html |
| ZI-gtds | https://www.zoho.com/in/invoice/help/settings/gst-tds.html |
| ZI-msme | https://www.zoho.com/in/invoice/help/settings/msme-settings.html |
| ZI-email | https://www.zoho.com/in/invoice/help/settings/emails.html |
| ZI-sms | https://www.zoho.com/in/invoice/help/settings/sms-notifications.html |
| ZI-rem | https://www.zoho.com/in/invoice/help/settings/reminders.html |
| ZI-privacy | https://www.zoho.com/in/invoice/help/settings/privacy.html ; .../multi-factor-authentication.html |
| ZI-backup | https://www.zoho.com/in/invoice/help/settings/backup-your-data.html |
| ZI-imp | https://www.zoho.com/in/invoice/help/import-export/ |
| ZI-exp | https://www.zoho.com/in/invoice/help/expense/ |
| ZI-ts | https://www.zoho.com/in/invoice/help/timesheet/ |
| ZI-gw | https://www.zoho.com/in/invoice/help/online-payments/ |
| ZI-rpt | https://www.zoho.com/in/invoice/help/reports/report-functions.html ; .../reports/receivable.html ; .../reports/sales.html ; .../reports/activity.html |
| ZI-int | https://www.zoho.com/in/invoice/help/integrations/index.html |
| ZI-zap | https://www.zoho.com/in/invoice/help/integrations/zapier-integration.html |
| ZI-sign | https://www.zoho.com/in/invoice/help/integrations/sign-integration.html |
| ZI-tally | https://www.zoho.com/in/invoice/help/marketplace-extensions/export-tally-xml-format.html ; .../bitly-invoice-link.html |
| ZI-ai | https://www.zoho.com/in/invoice/help/ai/ai-features.html ; .../zoho-mcp-integration.html |
| ZI-price | https://www.zoho.com/in/invoice/pricing/ |
| ZB-price | https://www.zoho.com/in/books/pricing/ |
| ZB-matrix | https://www.zoho.com/in/books/pricing/pricing-comparison.html |
| ZB-mob | https://www.zoho.com/in/books/accounting-mobile-apps/ |
| ZB-cust | https://www.zoho.com/in/books/help/contacts/ (+ other-actions, contact-preferences) |
| ZB-climit | https://www.zoho.com/in/books/help/contacts/credit-limit.html |
| ZB-hier | https://www.zoho.com/in/books/help/contacts/customer-hierarchy.html |
| ZB-link | https://www.zoho.com/in/books/help/contacts/link-customer-and-vendor.html |
| ZB-cheque | https://www.zoho.com/in/books/help/cheque/ |
| ZB-cn | https://www.zoho.com/in/books/help/credit-note/ |
| ZB-portal | https://www.zoho.com/in/books/help/customer-portal/ ; .../preferences.html |
| ZB-dc | https://www.zoho.com/in/books/help/delivery-challan/ |
| ZB-dsc | https://www.zoho.com/in/books/help/digital-signature/ |
| ZB-einv | https://www.zoho.com/in/books/help/e-invoicing/ ; .../functions-einvoice.html |
| ZB-ewb | https://www.zoho.com/in/books/help/e-way-bill/ ; .../functions.html ; .../multiple-vehicles.html |
| ZB-inv | https://www.zoho.com/in/books/help/invoice/ ; .../other-actions.html ; .../bill-of-supply.html |
| ZB-invpay | https://www.zoho.com/in/books/help/invoice/record-payment-for-invoice.html ; .../payments-received.html |
| ZB-items | https://www.zoho.com/in/books/help/items/ ; .../item-preferences.html ; .../reports-for-items.html |
| ZB-hsn | https://www.zoho.com/in/books/help/items/hsn-sac-code.html |
| ZB-adj | https://www.zoho.com/in/books/help/items/item-adjustments.html |
| ZB-adv | https://www.zoho.com/in/books/help/items/advanced-inventory.html |
| ZB-pl | https://www.zoho.com/in/books/help/items/price-list.html |
| ZB-gw | https://www.zoho.com/in/books/help/online-payments/ |
| ZB-bankint | https://www.zoho.com/in/books/help/online-payments/icicibank-integration.html ; .../sbi.html ; .../axis.html ; .../standard-chartered.html |
| ZB-plink | https://www.zoho.com/in/books/help/payment-links/ |
| ZB-retn | https://www.zoho.com/in/books/help/payment-retention/ |
| ZB-pr | https://www.zoho.com/in/books/help/payments-received/ ; .../basic-functions.html ; .../functions.html |
| ZB-proj | https://www.zoho.com/in/books/help/projects/ |
| ZB-quote | https://www.zoho.com/in/books/help/quote/ ; .../preferences.html |
| ZB-prog | https://www.zoho.com/in/books/help/quote/progress-invoice.html |
| ZB-rec | https://www.zoho.com/in/books/help/recurring-invoice/ ; .../preferences.html |
| ZB-ret | https://www.zoho.com/in/books/help/retainer-invoice/ |
| ZB-so | https://www.zoho.com/in/books/help/sales-order/ |
| ZB-coa | https://www.zoho.com/in/books/help/accountant/chart-of-accounts.html |
| ZB-mj | https://www.zoho.com/in/books/help/accountant/manual-journal.html |
| ZB-fx | https://www.zoho.com/in/books/help/accountant/base-currency.html |
| ZB-lock | https://www.zoho.com/in/books/help/accountant/transaction-lock.html |
| ZB-ai | https://www.zoho.com/in/books/help/ai-features/ai-features.html |
| ZB-bankacc | https://www.zoho.com/in/books/help/banking/add-accounts.html |
| ZB-banktx | https://www.zoho.com/in/books/help/banking/add-transactions.html |
| ZB-feeds | https://www.zoho.com/in/books/help/banking/feeds.html |
| ZB-deposit | https://www.zoho.com/in/books/help/banking/deposits.html |
| ZB-match | https://www.zoho.com/in/books/help/banking/matching-transactions.html |
| ZB-rules | https://www.zoho.com/in/books/help/banking/transaction-rule.html |
| ZB-recon | https://www.zoho.com/in/books/help/banking/reconciliation.html |
| ZB-bills | https://www.zoho.com/in/books/help/bills/ ; .../basic-functions.html ; .../functions.html |
| ZB-boe | https://www.zoho.com/in/books/help/bills-of-entry/ |
| ZB-branch | https://www.zoho.com/in/books/help/branches/ |
| ZB-docs | https://www.zoho.com/in/books/help/documents/documents.html |
| ZB-exp | https://www.zoho.com/in/books/help/expense/ ; .../mileage-expenses.html |
| ZB-kbd | https://www.zoho.com/in/books/help/getting-started/keyboard-shortcuts.html |
| ZB-dash | https://www.zoho.com/in/books/help/home/ |
| ZB-cdash | https://www.zoho.com/in/books/help/home/custom-dashboards.html |
| ZB-imp | https://www.zoho.com/in/books/help/import-export/ ; .../export.html |
| ZB-backup | https://www.zoho.com/in/books/help/settings/developer-and-data/backup.html |
| ZB-bharat | https://www.zoho.com/in/books/help/integrations/bharat-connect.html |
| ZB-wa | https://www.zoho.com/in/books/help/integrations/whatsapp/integrate-with-whatsapp.html |
| ZB-pm | https://www.zoho.com/in/books/help/payments-made/vendor-advance.html ; .../vendor-payments.html |
| ZB-po | https://www.zoho.com/in/books/help/purchase-order/ ; .../preferences.html |
| ZB-tdsch | https://www.zoho.com/in/books/help/tds/tds-challans.html ; .../tds-liabilities.html |
| ZB-vc | https://www.zoho.com/in/books/help/vendor-credits/functions.html |
| ZB-gst | https://www.zoho.com/in/books/help/gst/ (+ gstr1-filing, gstr2-filing, gstr2b-reconcile, ims, gst-filing, gstr9-filing, gst-cmp-08, isd, filing-approval) |
| ZB-rptmgr | https://www.zoho.com/in/books/help/reports/manage-reports.html |
| ZB-rptcust | https://www.zoho.com/in/books/help/reports/custom-reports.html |
| ZB-rptbo | https://www.zoho.com/in/books/help/reports/business-overview.html |
| ZB-rptsales | https://www.zoho.com/in/books/help/reports/sales.html |
| ZB-rptrec | https://www.zoho.com/in/books/help/reports/receivables.html |
| ZB-rptpay | https://www.zoho.com/in/books/help/reports/payables.html |
| ZB-rptinv | https://www.zoho.com/in/books/help/reports/inventory.html ; .../inventory-valuation-reports.html |
| ZB-rpt | https://www.zoho.com/in/books/help/reports/direct-taxes.html |
| ZB-act | https://www.zoho.com/in/books/help/reports/activity.html ; https://www.zoho.com/in/books/audit-trail/ |
| ZB-wf | https://www.zoho.com/in/books/help/settings/automation/workflow-rules.html |
| ZB-wfa | https://www.zoho.com/in/books/help/settings/automation/workflow-actions/webhooks.html (+ email-alerts, field-updates, custom-functions, schedules) |
| ZB-wfl | https://www.zoho.com/in/books/help/settings/automation/workflow-logs.html |
| ZB-cf | https://www.zoho.com/in/books/help/settings/customization/custom-fields.html |
| ZB-cv | https://www.zoho.com/in/books/help/settings/customization/custom-views.html |
| ZB-btn | https://www.zoho.com/in/books/help/settings/customization/custom-buttons.html ; .../related-lists.html ; .../developer-and-data/web-forms.html |
| ZB-vr | https://www.zoho.com/in/books/help/settings/customization/validation-rules.html |
| ZB-rl | https://www.zoho.com/in/books/help/settings/customization/record-locking.html |
| ZB-dev | https://www.zoho.com/in/books/help/settings/developer-and-data/incoming-webhooks.html ; .../settings/connections.html |
| ZB-cur | https://www.zoho.com/in/books/help/settings/currencies.html |
| ZB-email | https://www.zoho.com/in/books/help/settings/emails.html |
| ZB-itds | https://www.zoho.com/in/books/help/settings/income-tds.html |
| ZB-ob | https://www.zoho.com/in/books/help/settings/opening-balances.html ; .../contacts/opening-balances-for-customers.html |
| ZB-org | https://www.zoho.com/in/books/help/settings/organization/organization-profile.html |
| ZB-loc | https://www.zoho.com/in/books/help/settings/organization/locations/ |
| ZB-terms | https://www.zoho.com/in/books/help/settings/payment-terms.html |
| ZB-genpref | https://www.zoho.com/in/books/help/settings/preferences.html |
| ZB-series | https://www.zoho.com/in/books/help/settings/preferences.html (Transaction Number Series / Posting Date) |
| ZB-privacy | https://www.zoho.com/in/books/help/settings/privacy.html |
| ZB-rem | https://www.zoho.com/in/books/help/settings/reminders.html |
| ZB-pdf | https://www.zoho.com/in/books/help/settings/pdf-templates/edit-templates.html |
| ZB-tax | https://www.zoho.com/in/books/help/settings/taxes.html |
| ZB-tdsupd | https://www.zoho.com/in/books/help/settings/tds-and-tcs-updates.html |
| ZB-sms | https://www.zoho.com/in/books/help/settings/sms-notifications.html |
| ZB-tags | https://www.zoho.com/in/books/help/settings/reporting-tag.html |
| ZB-users | https://www.zoho.com/in/books/help/settings/users.html |
| ZB-appr | https://www.zoho.com/in/books/help/transaction-approval/configure-approvals.html (+ simple, multi-level, custom) |
