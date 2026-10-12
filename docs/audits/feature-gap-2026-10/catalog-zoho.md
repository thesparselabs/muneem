# Zoho Invoice (India) & Zoho Books (India) — Option-level Feature Catalog

Crawled 2026-10-11 from zoho.com help docs and pricing pages (about 426 page loads, 413 OK), for a feature diff against Muneem.
Tags: **[ZI]** = Zoho Invoice (free; India edition). **[ZB]** = Zoho Books India (plans: Free ₹0 / Standard ₹749 / Professional ₹1,499 / Premium ₹2,999 / Elite ₹4,999 / Ultimate ₹7,999 per org/month, billed annually). The per-feature plan matrix for Books is in section 4.3. Each subsection ends with its source URL(s).

## Contents
1. Platform, Organization & General Settings (Invoice)
2. Zoho Invoice — Sales modules (customers, portal, items, quotes, invoices, payments, templates, sales receipts, payment links, recurring, credit notes, bill of supply, delivery challan)
3. Zoho Invoice — Taxes/GST, TDS, MSME, emails, SMS, reminders, privacy, backup, import/export, expenses, timesheets/projects, gateways, reports, integrations, AI
4. Pricing, plans & per-plan limits (Invoice + Books, with the full Books comparison matrix)
5. Zoho Books — Sales, inventory, e-invoicing, e-way bill, projects
6. Zoho Books — Purchases, banking, accounting, documents, dashboards, data
7. Zoho Books — GST compliance, reports, settings, customization & automation
8. Crawl coverage & gaps (unreachable / uncrawled pages)

## 1. Platform, Organization & General Settings (Zoho Invoice)

Legend: **[ZI]** = Zoho Invoice (free, India edition); **[ZB]** = Zoho Books India (paid tiers; see Pricing section); **[ZB-x]** = Books tier.

### 1.1 Platforms & navigation
- Web app on Chromium browsers (Chrome, Edge, Opera, Vivaldi, Arc, Ulaa…), Firefox, Safari, Amazon Silk. [ZI] — https://www.zoho.com/in/invoice/help/getting-started/exploring-zoho-invoice.html
- Native apps: iOS 16+, iPadOS, Android 8+, Windows, macOS, Apple TV, watchOS. [ZI]
- Sign-up: company name/email/password + business location; social sign-in (Google, Yahoo, Facebook, LinkedIn, Twitter, Outlook); data-centre auto-selected by IP (India DC `.in`), "Change Country" override.
- Org setup wizard: Organization Name, Portal Name, Business Location, address, Currency, Language, Time Zone, Logo upload.
- Sign-in with TFA/OTP; "Manage TFA".
- Shell UI: Dashboard, collapsible Sidebar, **Quick Create (+)** from any page, Gear (Settings), Help, Notifications (app + customer-portal events + what's new), Organization switcher, **Recent History** (recently visited transactions/contacts).
- Module list page: page filters (system + custom criteria), create button, hamburger menu (sort by created time/last modified/date/number; import; export; module preferences; FAQ), action buttons, bulk select.
- **Keyboard shortcuts** (Shift+? opens cheat-sheet): global (jump to search/advanced search, open Settings, switch organization); go-to (Invoices `shift+i`, Estimates, Credit Notes, Expenses); module-level (new, email selected, print selected, download PDFs of selected, import (`alt+i`), export, select all, range select); transaction-level (edit, mail, print, PDF, save, save & print); creation (`c+i` new invoice, new estimate/credit note/expense). — https://www.zoho.com/in/invoice/help/getting-started/keyboard-shortcuts.html

### 1.2 Dashboard [ZI] — https://www.zoho.com/in/invoice/help/dashboard/
- Total Receivables widget split Current vs Overdue → drills to AR Aging Details report.
- Sales & Expenses: Total Sales (YTD, tax-inclusive) → Sales by Customer; Total Receipts → Payments Received; Total Expenses → Expense Details.
- Projects widget: project, client, unbilled hours, unbilled expenses → project details.
- Top Expenses pie chart (from Expense by Category).
- Sales, Receipts & Dues by period (selectable time period).

### 1.3 Organization Profile [ZI] — https://www.zoho.com/in/invoice/help/settings/organization-settings.html
- Permission: Admin or custom role with "Update Organisation Profile".
- Changes sync across Zoho Finance apps sharing the org (Inventory, Expense, Payroll, Commerce, Checkout, Practice, Vikra, Zakya).
- Basic: Organization Name (≤100 chars); Logo (240×240 @72 DPI, ≤1 MB, JPG/JPEG/PNG/BMP/GIF; shown on PDFs + emails; delete); Company Seal/Hanko (Japan only); Industry; Organization Location (fixed for country editions like India — must create new org + export/import to change).
- Address: Organisation Address with apply choice **Update New Transactions** vs **Update All Transactions**; separate **remittance address for payment stubs** (≤255 chars; shown when template "Include Payment Stub" is on).
- Contact: Primary Contact email (Zoho notifications + default From address) → Sender Email Preferences (add/verify sender, domain authentication; unauthenticated or public-domain senders replaced with message-service@sender.zohoinvoice.com unless overridden); Website URL.
- Regional: Base Currency (changeable only in Global edition and only with no transactions); currency format settings — symbol (e.g. ₹→Rs), name, decimal places, number grouping format (e.g. 12,34,567.89); Fiscal Year (month range e.g. April–March + start day); Language (UI; templates/email templates/payment modes/default tax names stay in original language); Time Zone; Date Format (e.g. dd-MM-yyyy) + separator (-, /, .).
- Additional: Company ID (label + number), Tax ID (label + number; India = GSTIN, now under Taxes for new orgs), **Additional Fields** (custom label/value pairs) — all printable via placeholders in the Organization Address Format.

### 1.4 Users & Roles [ZI] — https://www.zoho.com/in/invoice/help/settings/users.html
- **Zoho Invoice: max 2 users per organization.**
- Fixed roles: Admin, Super Admin (org creator; one per org across all Zoho Finance apps; only one who can set up the org in other Finance apps (approve admin requests) and delete org; transferable via "Make Super Admin"), Staff (all modules except Reports, Settings, Accountant), Timesheet Staff (log time only), Staff (Assigned Customers Only).
- Custom roles NOT supported in Invoice (upsell to Zoho Billing/Books).
- Invite user (email, name, role → join link); delete user (admin only, not self, at least one admin); Mark Inactive/Active.
- Multi-Factor Authentication settings page (org-level MFA enforcement) — https://www.zoho.com/in/invoice/help/settings/multi-factor-authentication.html

### 1.5 General Preferences [ZI] — https://www.zoho.com/in/invoice/help/settings/preferences.html
- **Enable modules** checklist (shows/hides modules in sidebar).
- First day of work week: Sunday / Monday / Saturday (affects calendars & reports).
- PDF attachment: "Attach PDF file with the link while emailing invoice & quote"; "Encrypt the PDF files that I send" (no edit/convert).
- **Discounts**: I don't give discounts / At line item level (choose discount inclusive or exclusive of tax) / At transaction level (Discount Before Tax or Discount After Tax).
- **Additional charges**: enable Shipping Charges and Adjustment fields.
- **Tax on item rates**: Tax Inclusive / Tax Exclusive / "Tax Inclusive or Exclusive" (choose per transaction).
- **Round off sales amount**: Round off total to nearest whole number / No Rounding.
- Salesperson field toggle (feeds Sales by Salesperson report).
- Billable expenses: default **markup %**.
- **Weekly summary report** email to admins (and Slack if integrated).
- **Organization address format**: placeholder editor (Insert Placeholders, rearrange/remove), PDF-only.
- Branding: Organization Logo; Theme — Appearance Dark Pane/Light Pane; Accent colour Blue/Green/Red/Yellow/custom hex (also applies to customer portal & other Finance apps).
- **Delivery Note settings**: rename Document Title, Transaction Number, Date, Item, Description, Quantity labels; toggle+rename Reference, Bill To, Delivery To, Signature, Balance Due; Show Customer Notes.
- **Packing Slip settings**: same field set as Delivery Note.
- **Custom fields (Invoice edition)**: per module, Label, Data Type = Text Box single line only (≤100 chars), Help Text, Data Privacy (PII sensitive-encrypted/admin-only, PII non-sensitive, ePHI), Default Value, Is Mandatory, Show when creating transactions, Show in all PDFs, Preview; edit / mark inactive / delete (blocked if used). **Limit: 3 custom fields per module** in Zoho Invoice (Books supports many data types — see Books customization).


## 2. Zoho Invoice — Sales modules

Source: Zoho Invoice India-edition help docs (zoho.com/in/invoice/help/...). All items tagged [ZI]. "Quote" and "Estimate" are used interchangeably in the docs (module is labelled Quotes in the UI text).

### 2.1 Customers / Contacts

- **Create customer** (Customers > + New) [ZI]
  - Basic fields: Primary Contact; Company Name; Customer Display Name (shown on all transactions); Customer Email (all correspondence goes here); Customer Phone; Website
  - Display Name is the only mandatory field; if taxes enabled, customer's tax status may also be required
  - Other Details: Payment Term (applied to this customer's invoices; "Configure Terms" to add custom terms); "Allow portal access for this customer" checkbox; Portal Language; Facebook and Twitter links; Customer Owner dropdown
  - Portal Language options: Arabic, Bulgarian, Croatian, Dutch, English, French, German, Italian, Japanese, Korean, Mandarin, Portuguese, Spanish, Swedish
  - Tabs: Address (Billing + Shipping); Contact Persons (multiple additional people per customer); Custom Fields (defined in Preferences first); Remarks (internal; shown under Customer Name when creating an invoice)
- **Import customers / contact persons** (More > Import Customers / Import Contact Persons) [ZI]
  - Sources: any other system (CSV or TSV), Zoho CRM (needs CRM integration + sync), G Suite (needs G Suite integration)
  - Steps: download sample file; choose file; duplicates = skip or overwrite; Character Encoding (default UTF-8); File Delimiter; field mapping (Zoho fields left, file fields right); "Save these selections for use during future imports"; preview counts ready / skipped / Unmapped Fields; Import
- **Export customers / contact persons** (More > Export Customers / Export Contact Persons); format CSV or XLS; downloads immediately [ZI]
- **Customer details page** [ZI]
  - New Transaction dropdown → Quotes, Invoices, Credit Notes, Expenses, etc. (redirects to that module's create page prefilled)
  - Edit
  - Attachments: from cloud or desktop; toggle "Display in Customer Portal" per file; download; delete; **limit 3 files × 10 MB each per customer**
  - Recent Activities timeline
  - Comments tab: internal notes (visible only to you); also appear in recent activities
  - Transactions (Sales) tab: lists Invoices, Customer Payments, Quotes, Recurring Invoices, Credit Notes, Expenses, Recurring Expenses, Projects; "Go to transactions" jump dropdown; sort by Date (default latest first); View total count per module; Status filter per module; click to open; "+ Add New" per module
  - Mails tab: log of system emails with type; "System Mails" dropdown → Snail Mail History; "Link Email account" (Gmail / Outlook / other work account) to show mails sent from it
  - Statement tab: period dropdown (default This Month; Custom date range); Print; download PDF; Send Email (editable preview, PDF attached); option "Attach Unpaid Invoices List"; Customize → statement template editor
  - Customer reviews shown here; reply with comment; share on X (Twitter)
- **Associate Templates** (More > Associate Templates) — per-customer default templates [ZI]
  - PDF template per: Customer Statement, Quote, Invoice, Credit Note, Payment Thank You
  - Email template per: Quote Notification, Invoice Notification, Credit Note Notification, Payment Thank You Notification
  - "New Email Template" link from the pop-up
- **Stop All Reminders / Enable All Reminders** per customer (More dropdown) — suppresses automated payment-due reminders [ZI]
- **Clone customer** (More > Clone) — prefilled "Clone Customer" screen; use case: second email address; can enable portal on clone [ZI]
- **Merge customers** [ZI]
  - Prerequisite: same currency
  - Multiple: select in list > More Actions > Merge > pick master > Continue > Confirm
  - Two: details page > More > Merge Customers > pick master from dropdown
  - Irreversible; transactions move to master; others marked inactive; re-activating them erases their transactions
- **Mark as Inactive / Active** (single or bulk) [ZI]
- **Delete customer** (single or bulk) — blocked while transactions exist; delete transactions first or mark inactive instead [ZI]
- **Customer Owner** assignment [ZI]
  - Requires a user with role "Staff - Assigned Customers Only" (default role) and admin/permitted assigner
  - Set on create (Customer Owner dropdown), via More > Assign Customer Owner, or in bulk ("Assign Customer Owner" on multi-select)
  - Owner can create/view/edit transactions only for assigned customers
- **Send unpaid invoices list** — "Attach Unpaid Invoices List" when emailing a statement or an email [ZI]
- **Bulk actions on customer list** [ZI]
  - Send Customer Statements (choose period; same period for all; emails queued; notified when sent) — **max 25 at a time**
  - Print Customer Statements (choose period) — **max 25 at a time**
  - Bulk Update: Currency, Payment Terms, Custom Fields → "Update Fields"
  - More: Enable Portal; Mark as Active; Mark as Inactive; Delete
- **Default filters / views** [ZI]: All Customers (default); CRM Customers; Active Customers; Duplicate Customers (same Display Name); Inactive Customers; Customer Portal Enabled; Customer Portal Disabled; Overdue Customers; Unpaid Customers (unpaid, term not yet over)
- **Custom Views** (filter dropdown > + New Custom View) [ZI]
  - Name; criteria rows (field / condition / value), "+ Add Criteria"; choose columns (Available → Selected Columns); visibility: everyone in org or only me; editable via edit icon
- **Customer Preferences** (Settings > Customers, or More > Preferences) [ZI]
  - "Allow duplicates for customer display name" (off by default — duplicates blocked)
  - Address Formats: Customer Billing Address Format and Customer Shipping Address Format built from "Insert Placeholders" (controls PDF/print layout); PDF-template-level billing address format overrides the common one; missing Customer Display Name placeholder = name not on invoice
  - Field Customization: custom fields for customers (e.g. "Region")

Sources: https://www.zoho.com/in/invoice/help/contacts/index.html ; https://www.zoho.com/in/invoice/help/contacts/contact-actions.html ; https://www.zoho.com/in/invoice/help/contacts/contact-details-page.html ; https://www.zoho.com/in/invoice/help/contacts/contact-filter.html ; https://www.zoho.com/in/invoice/help/contacts/contact-preferences.html

### 2.2 Customer Portal

- **Purpose** [ZI]: customer sees all their transactions; can pay invoices; accept/decline quotes; comment; update own address (syncs back); leave review
- **Enable portal** [ZI]: requires customer email; at creation ("Allow portal access") or details page "Enable Portal" / gear icon next to Portal Status; pick which email address(es); Save sends invitation link; bulk "Enable Portal" from list
- **Portal Preferences** (Settings > Customer Portal) [ZI]
  - Portal Name (unique; used in portal URL)
  - Banner Message (top of portal Home)
  - "Send me an email notification for every activity that takes place in the portal" (quotes accepted/declined, comments, payments)
  - "Allow customers to forward documents from portal" (forwardee added as contact person)
  - "Send an email notification to customers when I comment on Invoices/Quotes"
  - "Enable customer review for my services"
  - "Allow customers to view projects and timesheets" (project name, description, billed/unbilled hours, logged time, fixed cost)
  - "Allow customers to edit their information" (billing/shipping addresses, custom fields, contact details)
  - "Enable identity verification to view invoices and quotes" (customer enters Contact ID or phone number before viewing public links; off = anyone with link can view)
  - "Enable multi-factor authentication (MFA)"
- **Customer Review** [ZI]
  - Enable via portal preference; "Request Review" on customer details page → editable email → Send; also requestable while recording a payment
  - Customer rates 1–5 stars + text in portal dashboard → "Submit Review"; you get notification
  - Customer Review Email Template customizable in Settings
  - Customer Review report: Reports > Activity > Customer Review; date range; Run Report
- **MFA for portal** [ZI]
  - Customers configure via authenticator app (OneAuth, Google Authenticator): scan QR or enter code manually → enter OTP → Verify → Enable MFA; login thereafter with TOTP
  - Admin "Reset Portal MFA" (gear icon next to customer email on details page) when customer loses app/backup codes
  - Disabling org-wide MFA does not affect customers who already configured it; reset their portal instead

Sources: https://www.zoho.com/in/invoice/help/contacts/customer-portal.html ; https://www.zoho.com/in/invoice/help/contacts/mfa-customer-portal.html ; https://www.zoho.com/in/invoice/help/contacts/index.html

### 2.3 Items

- **Create item** (Items > + / + New) [ZI]
  - Type: Goods or Service
  - Name (used on transactions)
  - Unit: type or pick from Unit dropdown (e.g. metre, kilogram, piece, device); shown next to quantity on transactions
  - SKU (code/barcode; "use a bar code scanner"); field must be enabled in Item Preferences if absent
  - Item image: "Browse images" upload; Change Image; Delete; appears on transactions; enabled via Item Preferences
  - Tax Preference: Taxable → pick Tax (taxes defined in Settings > Taxes) | Non-Taxable → select/enter Tax Exemption Reason
  - Rate (default selling rate; editable per transaction). No "last price charged to this customer" recall — docs explicitly say rate is always the item default
  - Description (shown under item name on transactions)
  - (The crawled India item page does not mention an HSN/SAC field.)
- **Edit item** — changes apply only to new transactions, not existing ones [ZI]
- **Import items** (More > Import Items) [ZI]: sample file; Choose File; Duplicate Records = Overwrite or Skip; Character Encoding (default UTF-8); overwrite match key = Item Name or Item ID (case-sensitive); Map Fields + "Save these selections"; preview ready/skipped/Unmapped; Import
- **Export items** (More > Export Items) [ZI]: Export Template (+ New Template: Template Name, "Add a New Field", rename field headers, "Save and Select"); formats CSV, XLS, XLSX; **max 25,000 rows per export**
- **Clone item** (More > Clone Item) → edit → Save as new item [ZI]
- **Mark Active / Inactive** (single via More, or Bulk Actions) — inactive items cannot be added to new transactions but still viewable/editable/clonable/deletable; remain on past invoices [ZI]
- **Delete item** (bulk via checkbox + Delete, or More > Delete) — irreversible; blocked if used in any transaction (mark inactive instead) [ZI]
- **Default filters** [ZI]: All (default); Active; Inactive; Services
- **Custom Views** [ZI]: Name; criteria (field/condition/value, "+ Add Criterion"); Available → Selected Columns; Visibility Preference = Only Me | Only Selected Users and Roles | Everyone; editable
- **Sorting** (More menu or click column header; repeat to reverse) [ZI]: Name (default A→Z); SKU; Rate; Last Modified Time
- **Item Preferences** (Settings > Items, or More > Preferences) [ZI]
  - Decimal places for item quantity (default 2; selectable)
  - "Allow Duplicate Item Names" — requires SKU field Active + Mandatory; SKU then uniquely identifies item
  - Field Customization tab: + New Custom Field (Label Name, Data Type, etc.); built-in optional fields SKU and Item Image can be enabled

Sources: https://www.zoho.com/in/invoice/help/items/index.html (= new-items.html) ; https://www.zoho.com/in/invoice/help/items/items-filtering-sorting.html ; https://www.zoho.com/in/invoice/help/items/items-more.html ; https://www.zoho.com/in/invoice/help/items/items-preferences.html

### 2.4 Quotes / Estimates

- **Module naming** [ZI]: "Quote (formerly Estimate)"; orgs created before 1 May 2023 show "Estimates"; renaming to Quotes does not change PDF Document Title or transaction prefix — update manually (PDF Templates > Quotes > Edit > Transaction Details > Document Details > "Show Document Title"; Quote# gear icon > Prefix)
- **Enable module** [ZI]: Settings > General Preferences > "Select the modules you would like to enable" > Quotes
- **Lifecycle / statuses** [ZI]: Draft → Sent → Customer Viewed → Accepted / Declined → Invoiced; Expired (expiry date in past). Quote optional — fixed-price sellers can invoice directly
- **Create quote** — entry points: Quotes module; Customers > New Transaction > Quote; Projects module (include project tasks); import [ZI]
  - Customer Name dropdown (+ New Customer inline)
  - Quote# auto-generated; gear icon → change prefix / numbering or switch to manual entry every time
  - Reference#; Quote Date (defaults today); Expiry Date (optional; quote invalid after); Salesperson; Project Name (active projects)
  - Item table: Item Details (pick item or "+ Add New Item" inline — also saved to Items); Quantity (default 1); Rate (auto from item, editable); Tax (auto from item; "+ New Tax" inline with name + rate); Discount amount or % (position per Settings: line-item column, below item table, or hidden)
  - Shipping Charges; Adjustment (round-off or any change; label renamable)
  - Customer Notes; Terms & Conditions; Upload File (Attach from Desktop / Attach from Cloud)
  - PDF Template "Change"
  - Save as Draft | Save and Send; Save and Send dropdown also: Save and Send Later (schedule), Save and Print
- **Customize from quote view** (Customize dropdown) [ZI]: Change Template; Update Logo & Address; Manage Custom Fields; Terms & Conditions (edit notes + T&C with "Use this in future" checkbox)
- **Edit quote** (Edit or key `e`) — sent quotes need re-sending; converted quotes need invoice updated separately [ZI]
- **Import quotes** (More > Import Quotes, `alt+i`) [ZI]: sample file; skip/overwrite duplicates; Character Encoding (UTF-8 default); File Delimiter; "Auto Generate Quote Number" checkbox; field mapping + save mapping; preview; Import
- **Default filters** [ZI]: All Quotes; Draft; Sent; Customer Viewed; Accepted; Invoiced; Declined; Expired
- **Custom Views** [ZI]: Name; criteria rows; selected columns; visibility (everyone / only me); editable
- **Sorting** [ZI]: Created Time; Last Modified Time; Date (default latest first); Quote Number; Customer Name; Amount — via More icon or column header, repeat to reverse
- **PDF / Print / Email** [ZI]: PDF/Print dropdown → PDF (`d`) or Print (`p`); Send dropdown → Send Email (`m`) with editable preview; alternate UI "Mails/SMS > Send Mail"
- **Attachments** [ZI]: Upload Files → Attach From Cloud / Attach From Desktop (drag-and-drop); **max 3 files × 10 MB** (managing-estimates page). Newer "Other Actions" page: **up to 5 files × 5 MB**, sources Drag & Drop / Cloud / Documents (Zoho Invoice documents); per-file Download, Delete (permanent), Remove (kept in Documents)
- **Share quote link** (Share) [ZI]: Visibility = Public (anyone with link; Link Expiration Date; Generate Link; "Disable All Active Links") or Private & secure (via customer portal to customer + contact persons)
- **Mark as Sent** (More) — only Draft quotes [ZI]
- **Mark as Accepted / Mark as Declined** (More) — manual; prerequisite: quote sent or marked sent. Portal customers' accept/decline auto-updates status [ZI]
- **Clone** (More > Clone) → prefilled new quote; Save as Draft / Save and Send / Cancel [ZI]
- **Delete** (More > Delete; confirm) — irreversible [ZI]
- **Comments** (+ Add Comment; "Display in Customer Portal" checkbox) [ZI]
- **Create Project from quote** (More > Create Project; customer prefilled) [ZI]; Projects tab on quote shows associated project
- **Convert to Invoice** [ZI]
  - Manual: "Convert to Invoice" → review → Save as Draft or Save and Send (Open)
  - One-way: invoice cannot be converted back to quote, even in Draft
- **Export quotes** (More > Export Quotes, `alt+e`) [ZI]: optional field template (+ Add New: Template Name, Add a New Field, rename headers, Save and Select); format CSV / XLS (other page: CSV, XLSX, XLS); **max 25,000 rows per export**
- **Bulk actions** [ZI]: Mark as Sent (drafts); download PDF (`alt+d`); Print (`alt+p`); Delete; Bulk Update (choose field + value → Update)
- **Quote Preferences** (Settings > Quotes > General; `s` opens Settings; or More > Quote Preferences) [ZI]
  - "Allow editing of accepted quotes" (edits after invoicing don't flow to invoice)
  - "Allow customers to accept or decline the quotes via the public link" (for non-portal customers; notification + email on response)
  - Automatically convert accepted Quote to Invoice: Don't convert accepted quotes automatically | Convert accepted quotes to draft invoices | Convert accepted quotes to invoices and email it to the customer (invoice in Open status)
  - "Hide zero-value line items" (hidden on PDF + portal; still visible in view/edit; n/a when quote total is zero)
  - Fields retained on conversion to invoice: Customer Notes; Terms and Conditions; Address
  - Default Terms & Conditions and default Customer Notes (prefilled, editable per quote)
  - Field Customization: + New Custom Field — Label Name, mandatory or not; **only Text Box (Single Line), max 3 custom fields**; quote custom fields carry to invoice only if an invoice custom field with exact same name exists
- **Keyboard shortcuts (Quotes)** [ZI]: `shift+e` go to Quotes; `c+e` new quote; `e` edit; `d` PDF; `p` print; `m` email; `alt+i` import; `alt+e` export; `alt+d` bulk PDF; `alt+p` bulk print; `s` Settings

Sources: https://www.zoho.com/in/invoice/help/estimate/index.html ; https://www.zoho.com/in/invoice/help/estimate/new-estimate.html ; https://www.zoho.com/in/invoice/help/estimate/managing-estimates.html ; https://www.zoho.com/in/invoice/help/estimate/more-with-estimates.html ; https://www.zoho.com/in/invoice/help/estimate/estimate-preferences.html ; https://www.zoho.com/in/invoice/help/estimate/estimate-accept.html ; https://www.zoho.com/in/invoice/help/estimate/convert-estimate-invoice.html ; https://www.zoho.com/in/invoice/help/estimate/projects-estimates.html ; https://www.zoho.com/in/invoice/help/quote/other-actions.html

### 2.5 Invoices

#### 2.5.1 Creation fields

- **Entry points** [ZI]: Invoices > + New (`c+i`); global "+" icon at top of any page > Invoice; Customers > New Transaction > Invoice; convert from Quote; from a Project (include project tasks); import
- **Header fields** [ZI]
  - Customer Name dropdown (+ New Customer inline)
  - Invoice# auto-generated; gear icon → change Prefix / Next Number or switch to manual entry each time; numbers must be unique in org — including void invoices ("already exists" error)
  - Order Number
  - Invoice Date (backdating allowed — re-check Due Date)
  - Terms dropdown (default label "Due on Receipt"): Net 15; Net 30; Net 45; Net 60; Due end of the month; Due end of next month; Due on receipt (same day); Custom (pick date); "Configure Terms" to edit/add terms
  - Salesperson dropdown ("Manage Salespersons" to add)
- **Item table** [ZI]: Item Details (select or "+ Add New Item"); Quantity; Tax; Discount (amount or %); item tracking feeds reports
- **Totals** [ZI]: Adjustment (round-off/any change; label renamable)
- **Include Billable Expenses and Projects** of the customer into one invoice [ZI]
- **Footer** [ZI]: Customer Notes; Terms & Conditions; Upload File (Attach from Desktop / Attach from Cloud)
- **Payment options on create** [ZI]
  - Online payment gateway selection (from configured gateways)
  - "Allow customer to make partial payments for this invoice"
  - "I have received the payment" → Payment Mode + amount table; "+ Add Split Payment" for multiple modes; invoice saved as Paid. **Split Payment only in India, US, UK, Canada, Australia, Kenya, Germany, Mexico, South Africa editions**
- **Make Recurring** button on create page [ZI]
- **Save options** [ZI]: Save and Send (email now; invoice appears in portal); Save as Draft; Save and Send dropup → Save and Share, Save and Print, Save and Send Later (schedule)
- **Edit invoice** (Edit icon) → Save or Save and Send; re-send if already sent; adding a discount to an existing invoice needs discounts enabled first (Settings > General Preferences > "Do you give discounts?" level) [ZI]

#### 2.5.2 Customize invoice panel (on create page)

- **"Customize invoice" panel** — three tabs [ZI]
  - Preferences: PDF Template; Transaction Preferences (discount, tax, other); Organization Address Format; Customer Billing Address Format; Customer Shipping Address Format
  - Payments: Online Payment Gateways; Invoice QR Code (links to custom URL or specific page); "Add your bank details" (embed bank account in invoice PDF)
  - Custom Fields: list with data type + status (Active/Inactive); + New
- **Customize dropdown on invoice view** [ZI]: Change Template (default "Standard"; gallery); Edit Template (changes apply to all invoices using it); Update Logo & Address; Manage Custom Fields
- **Per-customer template association** (see 2.1) [ZI]

#### 2.5.3 Invoice Preferences (Settings > Invoices, or More > Preferences)

- "Allow editing of Sent Invoice" [ZI]
- "Associate and display expense receipts in Invoice PDF" [ZI]
- Payments: "Get notified when customers pay online" [ZI]
- "Do you want to include the payment receipt along with the Thank You note?" [ZI]
- "Automate thank you note to customer on receipt of online payment" [ZI]
- Invoice QR Code toggle (show QR on invoice PDF; configure after enabling) [ZI]
- Default Terms & Conditions; default Customer Notes [ZI]
- Field Customization tab: + New Custom Field (Label Name, Data Type, other details) [ZI]
- Discount level is a General Preference ("Do you give discounts?") [ZI]

#### 2.5.4 Statuses, filters, sorting

- **Default filters / statuses** [ZI]: All Invoices; Draft; Customer Viewed; Partially Paid; Unpaid (within due date); Overdue (past due); Payment Initiated (portal / ACH / card-association charge in progress); Paid; Void. Write-off converts status to Paid
- **Draft vs Sent** [ZI]: draft = saved, not issued, reviewable; sent = emailed/shared/marked sent = issued; sent invoices become Open
- **Custom Views** [ZI]: Name; criteria rows (+ Add Criteria); selected columns; visibility (everyone / only me); edit icon
- **Sorting** [ZI]: Created Time; Last Modified Time; Date (default latest first); Invoice Number; Customer Name; Due Date; Amount; Balance Due — via More icon or column header; repeat to reverse

#### 2.5.5 Actions

- **Common actions** [ZI]: Edit; Download PDF (`d`); Print (`p`); Mail (Send > Send Email, `m`, editable preview); Attach Files; Share as Link; Make Recurring; Create Credit Note; Clone; Void; Print Delivery Note; Print Packing Slip; Delete; Export
- **Draft-only**: Mark as Sent (More) — becomes Open without emailing [ZI]
- **Open-only**: Send Payment Reminder; Set Expected Payment Date; Stop Reminders; Write Off [ZI]
- **Delete vs Void vs Write-off** (docs' guidance) [ZI]: delete = created by mistake, record removed; void = keep record, no effect on accounts/reports (e.g. order cancelled before payment); write-off = record uncollectable balance as bad debt, status → Paid
- **History and Comments** — action log with who did it; add comment with "Display in portal" checkbox [ZI]
- **Attachments** [ZI]: Upload Files > Upload your Files (device) or dropdown → cloud pickers (Zoho WorkDrive, Google Drive, Dropbox, OneDrive, more); options Attach From Desktop / Attach From Cloud; per-file Download, Delete (permanent), Remove (stays in Documents); **max 3 files × 10 MB**
- **Share via WhatsApp** (Send > WhatsApp Message) [ZI]
  - Prerequisite: customer/contact-person phone has country code
  - Only sent / marked-sent invoices; unsent → pop-up "Proceed" to mark sent
  - Send To contact dropdown; editable Message Content; Share → Continue to Chat
- **Share as link** (Share) [ZI]: Visibility = Public (Link Expiration Date; Generate Link; Disable All Active Links; identity verification by Contact ID/phone if portal pref on) | Private & secure (via customer portal only; needs emails + portal enabled for contacts)
- **Send Payment Reminder** (More > Send Reminder; editable email); bulk reminders; automated reminders configurable [ZI]
- **Expected Payment Date** (More > Expected Payment Date: date + description); reminders can key off it [ZI]
- **Stop Reminders** (per invoice) [ZI]
- **Make Recurring** (More) → prefilled recurring-invoice page; set frequency; original invoice not part of the profile [ZI]
- **Create Credit Note** (More) → prefilled credit note → Save as Open; apply to same customer's invoice or refund [ZI]
- **Clone** (More > Clone) → prefilled new invoice → Save as Draft / Save and Send [ZI]
- **Write Off** (Record Payment dropdown > Write Off): write-off date + reason; excluded from Payments Received report; appears in Bad Debt report. **Cancel Write Off** restores outstanding [ZI]
- **Void** (More > Void): reason required; "Void it"; voided invoices excluded from reports; number stays used [ZI]
- **Print Delivery Note** (PDF/Print dropdown; preview pop-up); fields shown/hidden in Settings > Delivery Note [ZI]
- **Print Packing Slip** (PDF/Print dropdown; preview); fields in Settings > Packing Slip [ZI]
- **Delete** (More > Delete; confirm) — paid invoices need payment deleted first; irreversible [ZI]

#### 2.5.6 Bulk actions

- Mark as Sent (drafts) [ZI]
- Emailing invoices; Sending Payment Reminders in bulk (listed; steps not in crawled text) [ZI]
- Download as PDF (Download icon > Export as PDF, `alt+d`) [ZI]
- Print (`alt+p`) [ZI]
- Delete (irreversible) [ZI]

#### 2.5.7 Import / Export

- **Import invoices** (More > Import Invoices, `alt+i`) [ZI]: sample file; skip/overwrite duplicates (matched by invoice number); Character Encoding (UTF-8 default); File Delimiter; "Auto Generate Invoice Number" for imported invoices; field mapping + save mapping; preview ready/skipped/Unmapped; Import
- **Export invoices** (More > Export Invoice, `alt+e`) [ZI]
  - Select Status (default all); Date Range (From/To on invoice date); Fields in Export File (template; + Add New); Export As (CSV, XLS, XLSX)
  - "Include Sensitive Personally Identifiable Information (PII)" (address, email, phone, bank account no., sensitive custom fields)
  - Password-protect export file
  - **Max 25,000 rows per export**
  - Single invoice downloadable only as PDF; for spreadsheet use a one-day date range

#### 2.5.8 Keyboard shortcuts (Invoices)

- `shift+i` open Invoices; `c+i` new invoice; `d` PDF; `p` print; `m` email; `alt+i` import; `alt+e` export; `alt+d` bulk PDF; `alt+p` bulk print [ZI]

#### 2.5.9 Online-payment troubleshooting error codes (customer portal payments)

- CP1003 link tied to deleted customer; CP3001 merchant account lacks reference transactions; CP3002 invalid gateway credentials (re-enter in Settings > Integrations); CP3003 declined by fraud filters; CP3004 address verification failed (Settings > Integrations > Card Verification Settings); CP4001 amount below gateway minimum (e.g. after discounts/credits); CP4003 currency unsupported by gateway [ZI]

Sources: https://www.zoho.com/in/invoice/help/invoice/index.html ; https://www.zoho.com/in/invoice/help/invoice/new-invoice.html ; https://www.zoho.com/in/invoice/help/invoice/invoice-preferences.html ; https://www.zoho.com/in/invoice/help/invoice/managing-invoices.html ; https://www.zoho.com/in/invoice/help/invoice/more-with-invoice.html ; https://www.zoho.com/in/invoice/help/invoices/troubleshoot-guide.html ; https://www.zoho.com/in/invoice/help/invoice/troubleshoot-guide.html

### 2.6 Payments Received

- **Online payments** [ZI]: requires configured payment gateway; enable per invoice via "Change" on invoice details page
  - Public link: invoice "Pay Now"; or top "Pay Now" for Total Payable Amount across all pending invoices; invoice without online payment → public link only allows paying all pending online-payable invoices
  - Customer portal: Pay Now on invoice
  - Auto-charge: if gateway supports it, "Charge Customer" in Payments tab using stored card/bank account
- **Offline payments** (cash, bank transfer, anything outside integrated gateways); partial payments allowed [ZI]
  - "Add Bank Information" (Payments tab of unpaid invoice) puts bank details on invoice template
- **Record Payment form** [ZI]
  - Amount received; Bank Charges
  - "Tax Deducted?" checkbox + tax amount (TDS by customer)
  - Payment Date; Payment Mode dropdown (+ Configure Payment Mode to add modes)
  - Reference number; Notes
  - Upload File (Attach from Desktop / Attach from Cloud)
  - "Send a 'thank you' note for this payment" (sent on save)
  - Result status: Paid (full) or Partially Paid
  - Customer review can be requested while recording a payment (see 2.2)
- **Record payment on a Draft invoice** — pop-up to change status Draft → Sent (Open) first; "Do not show this again" auto-converts in future [ZI]
- **Apply credits to invoice** [ZI]: customer's "Unused Credits" (credit notes + excess payments) on customer details; invoice "Apply now" link → amount → Apply Credits; Credits Applied tab shows/deletes applications
- **Payments Received pane** above the invoice and Payments Received module in sidebar; edit (Action > Edit) or delete payment from the invoice [ZI]
- **Payment receipt / thank-you** — optional payment receipt attached to thank-you email; automatic thank-you on online payment (Invoice Preferences) [ZI]

Sources: https://www.zoho.com/in/invoice/help/invoice/payments-received.html ; https://www.zoho.com/in/invoice/help/invoice/invoice-preferences.html

### 2.7 PDF Templates

- **Categories** [ZI]: Quotes; Delivery Challans; Invoices; Recurring Invoices; Sales Receipts; Credit Notes; Payment Receipts; Customer Statements; Expenses (Custom Modules also referenced)
- **Create template** (Settings gear > PDF Templates > category > + New, or "New Template" card) [ZI]
  - Five style variants: Standard, Spreadsheets, Premium, Universal, Retail ("All Styles" tab lists everything)
  - Standard: Standard; Standard – Japanese Style (seal + signature boxes); Standard – Japanese Style (Without Seal Boxes); Standard – European Style; **Standard – India GST Style (India edition only; GST-compliant fields/sections)**; POS Standard; Compact Bilingual (GCC editions only)
  - Spreadsheet: Spreadsheet; Spreadsheet - Plus (project info, shipping details, tax breakdown); Spreadsheet - Lite; Spreadsheet - Compact (many lines in little space; high-volume / POS-style)
  - Premium: Minimalist; Grand; Continental
  - Universal: Lite; Simple; Compact; Basic; Elegant (Sales Receipts only); Elegant Lite (Custom Modules only)
  - Retail (POS / over-the-counter): Retail - Standard; Retail - Premium; POS Retail - Premium; POS Retail - Standard
  - Preview icon per style; "Use This"; template language dropdown (paste translations manually if language missing) → Edit Template page
  - Change style from a transaction: "Show PDF View" toggle on overview → Customize > Change Template > Choose Template
- **Edit template** (hover > Edit, or transaction Customize > Edit Template > Proceed); fields vary by category [ZI]
- **General / Template Properties** [ZI]
  - Template Name (e.g. rename "Invoice" to "Tax Invoice")
  - Paper Size: A5, A4, Letter; **Retail styles: 2, 3, 4 inch** (thermal-roll widths); header/footer images must be re-uploaded after size change
  - Orientation: Portrait / Landscape (not for Retail)
  - Margins (inches)
  - Include Payment Stub (Invoices only; detachable cash-payment stub; not Retail)
- **Font** [ZI]: PDF Font (with language suitability hint; not for POS Standard / POS Retail styles); Label Color; Font Color (hex, picker, Swatches); Font Size
- **Background** [ZI]: Background Image (not Payment / Retail); Image Position; Background Color
- **Header** [ZI]: Background Image (gallery of themed images; **≤1 MB; GIF/PNG/JPEG/JPG/BMP**; not POS Standard / Spreadsheet Compact / Retail); Image Position; Background Color; "Customize your header content" (Insert Placeholders, font style/color/size, text direction, embed URL, insert table, Clear Content, Preview); "Apply to first page only" + header height (not with Dynamic Font - RTL)
- **Footer** [ZI]: Font Size; Font Color; Background Image (≤1 MB; not Retail); Image Position; Background Color; Show Page Number (position + format, Pre-defined Formats; not Payment Receipts / POS Standard / Spreadsheet Compact / Retail); "Customize your footer content" (placeholders, formatting, table, URL)
- **Transaction Details — Organization Details** [ZI]: Show Organization Logo; Resize Logo slider (+ reset aspect ratio); Show Organization Name (color, size); Show Organization Address; Organization Address Format (per-template custom via Configure placeholders, else common; "Use Common Format")
- **Customer Details** (sales categories) [ZI]: Customer Name (color, size); Bill To toggle + header label; Billing Address Format (per-template override); Ship To toggle + label; Shipping Address Format
- **Document Details** [ZI]: Show Document Title (text, size, color; can add phone/fax labels under title); Document Information (show/hide fields like Due Date; rename labels — PDF only, field stays on form); Add Attention Content (above item table; placeholders; not POS Standard / POS Retail / POS Retail Premium)
- **Payment Receipts specifics** [ZI]: Receipt Information (fields show/hide; Received From address format; Amount Received font/colour/background; currency symbol); Signature (upload ≤1 MB); Invoice Details (Show Invoice Details + labels; table border/header/item row/Payment For styling); Annexure as separate tab
- **Table — Labels** [ZI]
  - Line Item Number column (width, label)
  - Item column (width, label)
  - Description under item name (header becomes "Item & Details")
  - Customize Item Name & Description (placeholders, formatting, custom text)
  - Custom Fields width % (applies to custom fields with "Show in all PDF")
  - Quantity (width, label; "Show Unit" toggle)
  - **HSN Code — India edition only**: show HSN and/or SAC as column (width, label) or "Show Below Description"
  - Rate; Tax (%); Tax Amount; Discount; Amount (each: toggle, width, label)
  - Invoices from Projects: rename Project Item, Project Description, Project Hours, Project Days
- **Table — Layout** [ZI]: Table Border (+ colour); Table Header (font size, bg, font colour); Item Row (font size, bg, font colour); Item Description (font size, colour)
- **Total section — Labels** (Quotes, Invoices) [ZI]
  - Show Total Section: Sub Total; Shipping Charges; **Shipping Charges SAC**; Discount (transaction-level); Total Taxable Amount (hidden if no tax)
  - Show Tax Details: Total; Currency Symbol before/after
  - Show Payment Details (Invoices): Payment Made, Credits Applied, Credits Used, Refunds, Credits Remaining, Amount Withheld, Write Off Amount; Balance Due
  - Show Quantity (total qty)
  - Show Amount in Words (organization language)
- **Total — Layout** [ZI]: Total (Sub Total & Tax) font size/colour/bg; Balance Due (Invoices) font size/colour/bg
- **Taxes (India)** [ZI]: **Show HSN/SAC Summary (Invoices only)**; **Show Export / SEZ Endorsement (Invoices only)**
- **Other Details — Document Summary** [ZI]: Notes (label, font size); Payment Options (Invoices); Add your bank details (Quotes, Invoices; placeholders such as customer outstanding balance); Show Invoice QR Code (Invoices, Credit Notes; configure QR in Settings); Terms & Conditions (label, size; no bold — use footer for styled text); Signature (upload ≤1 MB GIF/PNG/JPEG/JPG/BMP; name); Additional Signature (Invoices; certain styles)
- **Annexure** [ZI]: Add Annexure Content (by-laws, clauses; appended at end); Show Retainer Tax Summary (Invoices)
- **Template-level actions** (Settings > PDF Templates; hover > Settings icon) [ZI]
  - Configure Export File Name (Quotes, Invoices): File Name with preview; Select From Pre-Defined Names; Insert Placeholders
  - Select Color Theme (Standard, Premium, Universal styles)
  - Preview (+ Print from preview)
  - Set As Default (star icon marks default)
  - Use This Template For (reuse in another category)
  - Clone (not Custom Modules or Universal > Basic) → rename
  - Mark as Inactive (not default) / Mark as Active
  - Delete (not default; not if associated with any customer, vendor or transaction)

Sources: https://www.zoho.com/in/invoice/help/pdf-templates/ ; https://www.zoho.com/in/invoice/help/pdf-templates/create-template.html ; https://www.zoho.com/in/invoice/help/pdf-templates/edit-template.html ; https://www.zoho.com/in/invoice/help/pdf-templates/other-actions.html

### 2.8 Sales Receipts

- **Concept** [ZI]: one transaction = sale + payment (retail / POS / e-commerce, cash-and-carry); implies full payment received, vs invoice where payment is recorded separately
- **Enable module** [ZI]: Settings > General Preferences > "Select the modules you would like to enable" > Sales Receipt
- **Create** (Sales Receipts > + New) [ZI]
  - Customer Name; Receipt Date; Sales Receipt# (auto; gear icon to change series or enter manually); Item Details
  - Customer Notes; Terms and Conditions
  - Payment Mode; Reference#
  - Payment is **not** listed in Payments Received; recorded only under the chosen account
  - Save | Save and Send (email)
- **Actions** [ZI]: Send Mail (template preview > Send); Edit; Delete (More > Delete; irreversible); Print (PDF/Print > Print, preview); Download PDF
- **PDF template**: Sales Receipts category; Universal > Elegant style exclusive to Sales Receipts; Retail/POS styles with 2/3/4-inch paper (see 2.7) [ZI]

Sources: https://www.zoho.com/in/invoice/help/sales-receipt/ ; https://www.zoho.com/in/invoice/help/sales-receipt/create.html ; https://www.zoho.com/in/invoice/help/sales-receipt/others.html

### 2.9 Payment Links

- **Purpose** [ZI]: collect ad-hoc / advance amounts not tied to an invoice; payment auto-recorded in Payments Received; can later be applied to that customer's invoices
- **Prerequisite**: at least one integrated payment gateway [ZI]
- **Enable** [ZI]: Settings > Preferences > General > Payment Links
- **Create** (Payment Links > + New) [ZI]
  - Customer Name; Payment Amount; Link Expiration Date (**default 15 days from creation**; expired link inaccessible); Description (shown on payment page)
  - Save | Save and Share → shortened URL + auto Reference #
- **Send** [ZI]: Overflow > Send Email — choose customer + contact-person emails, "Add Contact Person", Email Preview, Send; or Copy Link. (Overview also mentions sharing via email or SMS)
- **Viewed indicator**: eye icon next to status when customer opened the link [ZI]
- **Statuses** [ZI]: Generated; Viewed; Paid; Expired; Canceled
- **Filter** by status ("All Payment Links" dropdown); **sort** by clicking any column (asc/desc) [ZI]
- **Customer flow** [ZI]: open link → "Proceed to Payment"; only the **most recently integrated gateway** is used; on success status → Paid and link no longer accessible; Payment No. links to the Payments Received record
- **Change Expiration Date** (pencil icon > Update & Generate Link) — URL changes; must re-send; Copy Link [ZI]
- **Cancel Link** (Overflow) — invalid but kept for records; cannot be re-activated [ZI]
- **Delete** (Overflow) — for mistakes; to change amount, delete and recreate (amount not editable) [ZI]

Sources: https://www.zoho.com/in/invoice/help/payment-links/index.html ; https://www.zoho.com/in/invoice/help/payment-links/basic-functions.html ; https://www.zoho.com/in/invoice/help/payment-links/manage-links.html ; https://www.zoho.com/in/invoice/help/payment-links/other-actions.html ; https://www.zoho.com/in/invoice/help/payment-links/receiving-payments.html

### 2.10 Recurring Invoices

- **Concept** [ZI]: auto-generates invoices for a customer at a set frequency; distinct from subscriptions (plans, renewals, upgrades/downgrades, pauses — Zoho Billing only; migration path to Billing Subscriptions)
- **Enable** [ZI]: Settings > General Preferences > modules > Recurring Invoices
- **Create** (+ next to module, or "Make Recurring" on invoice create page / invoice More menu) [ZI]
  - Customer Name (+ New Customer); Profile Name (appears on generated invoices); Order Number
  - Repeat Every (schedule); **child invoices generated at 6 AM org time zone**
  - Starts On (default creation date); Ends On or "Never Expires"
  - Payment Terms (due date of children); Salesperson
  - "Item Rates Are": Tax Exclusive / Tax Inclusive (enabled via Preferences > General "Do you sell your items at rates inclusive of Tax?")
  - Associate project(s) Hours → Choose Project(s) (bill unbilled timesheet hours on schedule)
  - Items: pick/Add New Item; Rate auto (editable); Quantity; Discount (invoice- or item-level, or disabled, per General Preferences); Tax (+ New Tax); Adjustments and Shipping Charges (toggle in General Preferences)
  - Customer Notes; Payment Options (gateway via gear icon; needed for auto-charge); "Allow customer to make partial payments for this invoice"; Template; Terms & Conditions; profile-level Preferences
- **Profile details** [ZI]: Overview tab lists child invoices; "Next Invoice" tab previews next invoice; Recent Activities (sent, failed invoice, payments received)
- **Import** (hamburger > Import Recurring Invoices): TSV, CSV, xls; field mapping; error alerts [ZI]
- **Export** (hamburger > Export Recurring Invoices): all or a time period; export template; CSV/XLS [ZI]
- **Filters** [ZI]: All; Active; Stopped; Expired
- **Custom Views** (Name, Criteria, Column Preference; listed under "Created By Me") [ZI]
- **Sorting** [ZI]: Created Time; Last Modified Time; Customer Name; Profile Name; Last Invoice Date; Next Invoice Date; Amount; or click column header
- **More actions** [ZI]: Disable / Enable Auto-charge; Stop / Start (pause & resume); Delete; Delete Card; Clone profile
- **Receiving payments** [ZI]
  - Auto-charge via card associated to customer (Customers > More > Add New Card; pick gateway — must match profile's gateway; requires "Create, Charge and Send" preference)
  - Auto-charge via profile: Associate Payment Options > Associate Credit Card (card saved to profile + contact); can pick existing customer card
  - Customer portal: Pay Now + "Use this card for future transactions" enables auto-charge; otherwise asks each time
  - Manual charge: Disable Auto-charge then "Charge Customer" with saved card, or "Associate Payment Options" to add one; bank accounts can be associated similarly; card data stored at gateway
  - Update Card (only when auto-charge enabled on profile; else update in Customers)
  - Record offline payment on a child invoice (Record Payment)
- **Recurring Invoice Preferences** (Settings > General Preferences > Recurring Invoices, or module gear icon); org-level default, overridable per profile [ZI]
  - Create Invoices as Drafts (+ Notification Preferences: email customers when drafts generated)
  - Create and Send Invoices (auto-approve/sign if transaction approval or digital signature enabled)
  - Create, Charge and Send — auto-charge supported gateways: Stripe, Authorize.Net, PayPal Payflow Pro, PayPal Payments Pro, CSG Forte, GoCardless
    - On success: Do nothing | Send a thank you note along with the invoice
    - On failure: Send failure notification | Send failure notification and retry | Retry without notification; editable Credit Card / ACH email content
    - Retry Settings: **max 3 retries** (checkbox each), days between retries, "don't send email" per retry; "After all retries, suspend the recurring invoice"; "After failure, suspend the recurring invoice"; "Disable automatic saving of card details"
  - Auto-apply excess payments and credit notes (either or both; excess payments applied first); synced with Zoho Billing preference if connected
- **Reports** (Reports > Recurring Invoices) [ZI]
  - Recurring Invoice Details (Customize Report by Customer Name, Date Range, Invoice Date, Status; print; export PDF/CSV/XLS; Zoho Sheet)
  - Payment Failure (period filter; print; PDF; Zoho Sheet)
  - Payment Retry (print; PDF; Zoho Sheet)
  - Card Expiry (filter by status; print; PDF; Zoho Sheet)

Sources: https://www.zoho.com/in/invoice/help/recurring-invoice/index.html ; https://www.zoho.com/in/invoice/help/recurring-invoice/new-recurring-invoice.html ; https://www.zoho.com/in/invoice/help/recurring-invoice/manage-recurring-invoices.html ; https://www.zoho.com/in/invoice/help/recurring-invoice/more-with-recurring-invoices.html ; https://www.zoho.com/in/invoice/help/recurring-invoice/projects-recurring.html ; https://www.zoho.com/in/invoice/help/recurring-invoice/receiving-payments.html ; https://www.zoho.com/in/invoice/help/recurring-invoice/recurring-invoice-preferences.html (identical: recurring-invoice-auto-charge-settings.html) ; https://www.zoho.com/in/invoice/help/recurring-invoice/recurring-invoice-reports.html

### 2.11 Credit Notes

- **Concept** [ZI]: money owed to customer (returns, defects, advance-billed service not rendered); closed by applying to future invoice or refunding
- **Enable** [ZI]: Settings > General Preferences > modules > Credit Notes
- **Create** [ZI]
  - Credit Notes > + New (`shift+n` open module, `c+n` new) → Save as Draft | Save as Open
  - From invoice: More > Create Credit Note — invoice items prefilled; edit quantities/amounts or remove lines for partial credit
  - From customer: New Transaction > Credit Note
- **Statuses / filters** [ZI]: All; Draft; Pending Approval; Approved; Open; Closed (fully applied or refunded); Void (no effect on accounts/reports)
- **Apply to Invoice** (credit note must be Open, invoice Sent) → list of customer's invoices → amount per invoice → Save; fully used → Closed. Not auto-applied on creation. Also from invoice "Apply Now" under Credits Available [ZI]
- **Refund** (More > Refund; credit note Open): date, payment mode, reference number, amount [ZI]
- **Edit; Download PDF; Print** (PDF/Print dropdown) [ZI]
- **Void** (More > Void: reason → "Void it"); **Convert to Draft** to un-void (reason required; lands in Draft, must be made Open again) [ZI]
- **Attachments**: **up to 3 files × 10 MB**; Download/Delete; "Enable" to show in customer portal [ZI]
- **Custom Views**: name, criteria, columns, visibility (others vs only me) [ZI]
- **Export** (More Actions > Export Credit Notes): CSV, XLSX, XLS [ZI]
- **Credit Note Preferences** (Settings > Credit Notes, or More Actions > Preferences) [ZI]
  - Credit Note QR Code toggle; QR Code Type → Configure custom message (**≤250 chars**) or placeholders; QR Code Description; auto-on for templates created afterwards; existing templates need Other Details > Document Summary > "Show Credit Note QR Code"
  - Default Terms & Conditions and Customer Notes
  - Field Customization: + New Custom Field (Label, Data Type, mandatory, show on PDF); **only Text Box (Single Line), max 3 per module**
- **Credit Note Details report** (Reports > Payments Received > Credit Note Details) [ZI]: status, date, number, customer, credit amount, balance; Date Range (incl. Custom); + More Filters; Customize (Group By, Advanced Filters, drag columns); export PDF/XLS/CSV; Zoho Sheet; Print

Sources: https://www.zoho.com/in/invoice/help/credit-note/index.html ; https://www.zoho.com/in/invoice/help/credit-note/new-credit-note.html ; https://www.zoho.com/in/invoice/help/credit-note/manage-credit-notes.html (identical: more-with-credit-notes.html) ; https://www.zoho.com/in/invoice/help/credit-note/closing-a-credit-note.html ; https://www.zoho.com/in/invoice/help/credit-note/credit-note-preferences.html ; https://www.zoho.com/in/invoice/help/credit-note/creditnotedetails-report.html

### 2.12 Bill of Supply (India GST)

- **Concept** [ZI, India]: issued by GST-registered businesses instead of a Tax Invoice — Composition-scheme dealers (cannot charge GST) and sellers of GST-exempt goods/services (e.g. fruit vendor)
- **Enable** [ZI]: gear icon > Preferences > General > Bill of Supply
- **Create** [ZI]: Sales > Invoices > dropdown next to + New > "New Bill of Supply"; select Customer (details auto-populated); fill fields; Save and Send
- **GSTR reporting** [ZI]: Regular GST — GSTR-1 (Table 8), GSTR-3 (Table 3), GSTR-9 (Table 6); Composition — GSTR-4 (Table 8), GSTR-9A (Table 6); Non-resident foreigners — GSTR-5 (Table 7); E-commerce operators — GSTR-8 (Tables 4 & 5); Cancellation of registration — GSTR-10

Source: https://www.zoho.com/in/invoice/help/bill-of-supply/

### 2.13 Delivery Challan (India)

- **Concept** [ZI, India]: document accompanying goods movement that may not be a sale (e.g. head office → branch); lists items and quantities
- **Use cases** [ZI]: supply on approval; quantity unknown at dispatch (e.g. liquid gas); goods for job work; goods sent semi-assembled or in parts
- **Enable** [ZI]: gear icon > Preferences > General > Delivery Challan
- **Create** (Sales > Delivery Challans > + ) [ZI]
  - Customer Name; **Place Of Supply** (customer's registered place of business); Delivery Challan# (auto or manual via Settings icon); Delivery Challan Date; Challan Type (purpose dropdown)
  - Save
- **Statuses** [ZI]: Draft; Open (dispatched); Delivered; Returned
- **PDF template** category "Delivery Challans" (see 2.7) [ZI]

Sources: https://www.zoho.com/in/invoice/help/delivery-challan/index.html

### 2.14 Notable India-specific / edition-specific items (cross-reference)

- Standard – India GST Style PDF template — India edition only (2.7) [ZI]
- HSN/SAC column (or below description) in PDF item table — India edition only (2.7) [ZI]
- Show HSN/SAC Summary; Show Export / SEZ Endorsement; Shipping Charges SAC (PDF totals) (2.7) [ZI]
- Bill of Supply module and GSTR mapping (2.12) [ZI]
- Delivery Challan with Place of Supply (2.13) [ZI]
- "Tax Deducted?" (TDS) on Record Payment (2.6) [ZI]
- Split Payment on invoice creation — India, US, UK, Canada, Australia, Kenya, Germany, Mexico, South Africa editions (2.5.1) [ZI]
- Compact Bilingual template — GCC editions only (2.7) [ZI]
- Note: the crawled pages for this group do not document GSTIN capture, reverse charge, or place-of-supply on invoices/customers explicitly; those likely live in the separate GST help section.


## 3. Zoho Invoice — Taxes, Expenses, Time, Payments, Reports, Settings & Integrations

Source: Zoho Invoice India-edition help (zoho.com/in/invoice/help/...). All bullets tagged [ZI].

### 3.1 Taxes & GST (GST Settings, Tax Rates, Exemptions)

- **GST overview** [ZI] — GST registration mandatory above ₹20 lakh turnover p.a.; components CGST+SGST (intra-state), IGST (inter-state); slabs listed as 0%, 5%, 12%/18%, 28%; Additional cess on tobacco, luxury cars, pan, aerated drinks.
- **GST Settings screen** (Settings > Taxes > GST Settings) [ZI]
  - Toggle *Is your business registered for GST?* (Yes/No).
  - *GSTIN* — 15-digit; button *Get Taxpayer details* (shows registration details, previous returns filed).
  - *Registration Type* dropdown: Registered Business – Regular; Registered Business – Composition (then pick *Composition Scheme Percentage*); Special Economic Zone (SEZ); Input Service Distributor (ISD).
  - Composition eligibility note: aggregate turnover < ₹1.5 crore (< ₹75 lakh for North-Eastern states); cannot claim ITC or supply GST-exempt goods.
  - *Business Legal Name* (must match GST records for ITC/return matching); *Business Trade Name*; *GST Registered On* (date).
  - Checkbox *Enable Reverse Charge in Sales transactions*.
  - Checkbox *Track sale of digital services to overseas customers* → item-level flag *It is a digital service*; feeds *Overseas Digital Tax Summary* report; mixed goods+digital-service sale treated as service with goods, only IGST 0 allowed.
- **Locked GST settings (irreversible)** [ZI] — cannot turn GST off once taxed transactions exist (create new org instead); do not change GSTIN after invoices (create new org + import); org/work-location State cannot change after GST enabled (must match GST state code; contact support).
- **Online Filing Settings** (Settings > Taxes) [ZI] — *GSTN Username*; *Reporting Period* (Monthly / Quarterly); *Generate First Tax Return From* (month); toggle *Enable approval process for filing GST Returns* + select approvers (users submit to admins before portal).
- **Default Tax Preference** [ZI] — *Intra State Tax Rate* and *Inter State Tax Rate* defaults applied to items (overridable per item).
- **Tax Rates** [ZI] — default GST rates auto-created on registration; *+ New Tax*: Tax Name, Rate %, Tax Type; checkbox *This tax will be applicable only on digital services for overseas customers* (+ rate, country).
- **Tax Groups** [ZI] — *+ New Tax Group*: group name + select taxes (e.g. rate + new cess); default 18% = 9% CGST + 9% SGST group.
- **Edit/Delete Tax Rates** [ZI] — hover → Trash / Edit; on edit, popup to pick which transactions get updated rate; edits propagate to active recurring profiles.
- **Tax Exemptions** [ZI] — *+ New Tax Exemption*: reason, description, type; applied to items on invoices.
- **Customer GST fields** [ZI] — *GST Treatment* (Other Details) + *GSTIN / UIN*; place of supply from shipping address, else billing address, else treated intra-state; foreign customers may get 0% (zero-rated export).
- **Item GST fields** [ZI] — classify Goods/Services; HSN code for goods, SAC code for services.
- Sources: https://www.zoho.com/in/invoice/help/gst/

### 3.2 Direct Taxes (Income-tax TDS)

- **TDS applicability** [ZI] — on Quotes, Invoices, Credit Notes, Recurring Invoices, Payments Received, Bill of Supply.
- **TDS preference** (Settings > Direct Taxes) [ZI] — choose *Transaction level* (default) or *Line item level*.
- **Transaction-level TDS** [ZI] — *TDS* option in Total section; dropdown of rates applied on Sub Total; *Manage TDS* inline to create a new rate; Save and Send / Save as Draft.
- **TDS Override** [ZI] — Edit icon next to TDS amount → enter amount → Update; override only at transaction level.
- **Line-item TDS** [ZI] — *TDS* column in item table.
- **TDS Surcharge** [ZI] — Settings > Direct Taxes > Income TDS Rates > dropdown next to *+ New TDS Tax* → *+ New TDS Surcharge* (Tax Name, Rate).
- **TDS Cess** [ZI] — same path → *+ New TDS Cess* (Tax Name, Rate).
- **TDS Group** [ZI] — *+ New TDS Group* combines TDS + surcharge/cess.
- **TDS Withheld** [ZI] — withheld amount recorded when recording payment.
- Source: https://www.zoho.com/in/invoice/help/settings/taxes.html

### 3.3 GST TDS

- **Rule** [ZI] — applies when contract value > ₹2.5 lakh; 2% (1% CGST + 1% SGST intra-state; 2% IGST inter-state).
- **Enable** [ZI] — Settings > Taxes > GST TDS Settings > toggle *Enable GST TDS*; GST TDS taxes auto-populated.
- **Customer flag** [ZI] — checkbox *Is GST TDS applicable?* in Other Details; auto-on when GST Treatment = *Tax Deductor*.
- **On invoice** [ZI] — *Select a GST TDS* dropdown above items table (only shown for GST-TDS customers); applies to all lines; per-line opt-out via More > Show Additional Information > uncheck *Deduct GST TDS*; *Bulk Actions > Bulk Update Line Items > Remove GST TDS*; GST TDS section shows total; deduction does not reduce invoice total or hit accounts — recorded only at payment.
- **Record Payment** [ZI] — *GST TDS Deducted?* Yes → *GST TDS Amount* field; enter 0 in *Amount Received (INR)* to record only the TDS.
- Source: https://www.zoho.com/in/invoice/help/settings/gst-tds.html

### 3.4 MSME

- **MSME Settings** [ZI] — toggle *Is your business MSME registered?*; *MSME/Udyam Registration Type*; *MSME/Udyam Registration Number* in format UDYAM-XX-00-0000000.
- **Show on PDFs** [ZI] — General Preferences > Organization Address Format > *Insert Placeholders* → *MSME/Udyam No Label*, *MSME/Udyam No*; Preview; required for Sec 43B(h) Finance Act 2023 compliance.
- Source: https://www.zoho.com/in/invoice/help/settings/msme-settings.html

### 3.5 GST Filing (GSTR-1)

- **Scope** [ZI] — only GSTR-1 can be generated/filed; no GSTR-2/GSTR-3 (no Purchases module) → upgrade to Zoho Books for those.
- **Prerequisite** [ZI] — enable API Access on GSTN portal (My Profile > Manage API Access > Yes, choose Duration).
- **GST Filing module views** [ZI] — *Unpushed Transactions* count → tabs: Transaction summary (by business type), HSN (HSN summary for month), Nil (nil-rated outward supplies), B2CS (Table 7 of GSTR-1), Documents Issued.
- **Documents Issued** [ZI] — manual entry: Push to GSTN tab > Documents issued > Edit > Save; *Clone* for another number series.
- **Push to GSTN** [ZI] — popup details → OTP to GST-registered mobile/email → Verify OTP; confirmation email + in-app notification; *Failed Transactions* tab for errors → edit & re-push.
- **Submit / File** [ZI] — submit (freezes period) recommended on GST portal; file with DSC or EVC (Aadhaar OTP) on portal.
- Source: https://www.zoho.com/in/invoice/help/gst/gst-filing.html

### 3.6 Settings map (top level)

- **Settings page sections** [ZI] — Organization Profile; Adding New Organization; Users & Roles (add, delete, change status); Preferences: General, Branding, Contacts, Items, Sales, Estimates, Invoices, Recurring Invoices, Credit Notes, Delivery Note Settings, Packing Slip Settings, Custom Fields; Emails (Sender Email Preferences, Email Insights, Email Templates); Reminders (Manual, Automatic); Integrations (Online Payments, Zoho CRM via ZSC key); Privacy and Security; Data Backup. Other pages referenced: AI Preferences, Direct Taxes, Taxes (GST Settings, GST TDS Settings, Online Filing Settings, Default Tax Preference, Tax Rates, Tax Exemptions), MSME Settings, SMS Notifications, PDF Templates, Data Management, Email Notifications.
- Source: https://www.zoho.com/in/invoice/help/settings/index.html

### 3.7 Emails & Email Templates

- **Sender Email Preferences — domain classification** [ZI]
  - *Unauthenticated Domains* (no DKIM) → From auto-replaced with message-service@sender.zohoinvoice.com; Reply-To still yours.
  - *Authenticated Domains* (DKIM present) → used as-is.
  - *Public Domains* (Gmail, Yahoo) → replaced by default; override via *change setting* → *Sender's email address*.
- **Authenticate Domain** [ZI] — *Authenticate Now →*; copy DKIM Host Name + Value to DNS; *Validate*; GoDaddy note: strip domain from host name.
- **Mark as Primary Contact** [ZI] — receives Zoho usage emails; default From address.
- **+ New Sender** [ZI] — name + email; verification email; *Resend Email*; Pencil = edit name only; Trash = delete; email change = delete + re-add. Sender email independent of Zoho login email.
- **Email Insights** [ZI] — toggle *Track the emails sent to your customers*; modules: Invoices, Quotes; list-view icons: sent via email / email opened / viewed in Customer Portal; filter *Client Viewed*; open time in *Comments & History*; any recipient (incl CC/BCC) opening marks viewed; tracking via 1×1 web-beacon pixel (only when images displayed).
- **Email Templates** [ZI] — per module; *+ New* or *Clone* pre-loaded; fields: Template Name, From, CC, BCC, Subject, rich-text body (font, colour, size), *Insert Placeholders*; checkbox *Set this to default*; *Attach File(s)* up to 5 files × 5 MB per template.
- **Associate Templates to customer** [ZI] — Customer > More > *Associate Templates*: per-notification email template (and PDF template) defaults for that customer.
- **Bulk emails** [ZI] — not supported; upgrade to Zoho Billing.
- **Zia-generated template content** [ZI] — see AI section.
- Source: https://www.zoho.com/in/invoice/help/settings/emails.html

### 3.8 SMS Notifications (India edition only)

- **Credits** [ZI] — *Use Free SMS* (3 free messages); *Buy Credits* from Zoho Store: min 5 credits, ₹75/credit, up to 300 messages per credit.
- **Without DLT** [ZI] — toggle *Send SMS without DLT configuration*; predefined templates only (content not editable; pick via *Change Template*); *Notification Status* toggle per type.
- **Notification types** [ZI] — Payment Link Details (manual, payment link); Customer Balance; Quote Details (view & approve); Invoice Details (auto-generated or manual); Payment Reminder (due-date based); Payment Thank-You; Payment Retry (enabled from Reminders, failed payments).
- **DLT registration flow (TRAI)** [ZI] — register as Enterprise with operator (Vodafone Idea, Videocon, BSNL, Jio, Airtel) → get DLT Registration Number + Sender ID.
- **Configure DLT Registration popup** [ZI] — DLT Registration Number; Sender ID; Telecom Operator (incl. *Others* → operator name); Chain ID 1; Chain ID 2 (PE-TM binding chain); *Submit for Approval*; statuses Pending / Approved / Rejected; *Edit DLT Configuration*; URLs in SMS must be whitelisted.
- **DLT templates** [ZI] — content type Transactional / Promotional / Service Implicit / Service Explicit (on DLT portal); in ZI per notification *Configure Now*: Template ID + approved SMS Template text; mismatch → SMS barred.
- **Enable/disable per contact** [ZI] — customer Overview *Enable/Disable SMS Notification*; contact persons via gear icon.
- **Bulk communication preference** [ZI] — Settings > SMS > More > *Update Communication Preference* (default recipients for all); or Customers list multi-select > *Configure Communication Preferences* (SMS channel default recipients; *None* disables).
- **Sending** [ZI] — auto: Invoice Details on subscription-generated invoice, Payment Thank-you on online payment; manual: transaction *Send* dropdown > *Send SMS* (pick contact); Record Payment checkbox *Notify via SMS*.
- **SMS Notifications report** [ZI] — More > *View SMS Notifications Report*.
- Source: https://www.zoho.com/in/invoice/help/settings/sms-notifications.html

### 3.9 Reminders

- **Manual reminders** [ZI] — for invoices in *Overdue* and *Sent* status; editable templates *Reminder For Overdue Invoices*, *Reminder For Sent Invoices*; sent via invoice More > *Send Reminder*.
- **Automated – based on Due Date** [ZI] — 3 pre-loaded reminders; *Turn On*; recipient dropdown: you / customer / both; N days *Before*/*After* due date; subject + body with placeholders.
- **Automated – based on Expected Payment Date** [ZI] — set on sent invoice via More > *Expected Payment Date* (date + description); reminder to you N days before/after.
- **Payment Retry** reminder [ZI] — enabled in Reminders page (SMS on failed payments).
- Source: https://www.zoho.com/in/invoice/help/settings/reminders.html

### 3.10 Privacy & Security

- **Custom field Data Privacy** [ZI] — options: *PII* → Sensitive (encrypted, admin-only view) or Not sensitive (unencrypted, admin-only view, others can use in advanced search); *ePHI* (encrypted, admin-only, not searchable).
- **Restricted export** [ZI] — non-admins cannot export PII/ePHI, SSN, bank account numbers; admins tick *Include Sensitive Personally Identifiable Information (PII) while exporting*.
- **Multi-Factor Authentication** (managed at accounts.zoho.com, applies via SSO) [ZI]
  - First-factor modes: Zoho OneAuth (passwordless, OTP authenticator, mobile SSO); Passkey; Email-based OTP; SMS-based OTP; Linked Accounts; Password.
  - MFA modes: OTP Authenticator (TOTP, 6-digit; Google/Microsoft Authenticator, Authy); Security Key (FIDO2 USB/NFC, e.g. YubiKey).
  - Recovery: Backup verification codes (single-use; *Generate New Codes* only after an MFA mode set); Passphrase (OneAuth recovery).
  - Multi-mode MFA with primary mode; trusted browser default 180 days (admin can shorten/disable); org-enforced MFA (*Enforced by Admin*); App Passwords for non-MFA mail clients; disable/re-enable modes.
- Sources: https://www.zoho.com/in/invoice/help/settings/privacy.html ; https://www.zoho.com/in/invoice/help/settings/multi-factor-authentication.html

### 3.11 Data Backup (Settings > Data Management)

- **Constraints** [ZI] — Admin only; download link within up to 30 min; link expires after 30 days; one backup per 15 days.
- **Backup Data tab** [ZI] — *Backup Your Data*; confirm email; checkbox *Include Sensitive PII while backing up data*; compressed file of per-module CSV/XLS; *Backup History* with initiating user.
- **Backup Documents tab** [ZI] — all uploaded documents as ZIP via email link.
- **Backup Audit Trail tab** [ZI] — audit-trail activities as ZIP.
- Source: https://www.zoho.com/in/invoice/help/settings/backup-your-data.html

### 3.12 PDF Templates

- **Template list actions** [ZI] — per module; *+ New*; Edit; Preview; *Set as Default*; *Clone As* <other module>; Delete (not if default or customer-associated); per-customer default template.
- **General > Template Properties** [ZI] — Template Name; Paper Size (A5, A4, Letter); Orientation (Portrait/Landscape); Margins (inches); *Include Payment Stub* (Invoices only, detachable cash/postal stub).
- **General > Font** [ZI] — PDF Font; Label Colour; Font Colour; Font Size.
- **General > Background** [ZI] — Background Image + Image Position, or Background Colour (one at a time).
- **Header** [ZI] — background image (≤1 MB); background colour (hex/picker); custom content with placeholders; *Apply to first page only* (separate header for other pages). Payment Receipts has separate Header/Footer tabs.
- **Footer** [ZI] — Font Size; Font colour; Background Image (Desktop/Gallery) + position; *Show Page Number*; custom content (placeholders, tables, links).
- **Organization Details** [ZI] — Show Organization Logo; Resize Logo (slider, reset); Show Organization Name; Show Organization Address; Organization Address Format (placeholders).
- **Customer Details** [ZI] — Font Colour/Size; *Bill To* (label editable) + Billing Address Format; *Ship To* + Shipping Address Format.
- **Document Details** [ZI] — Show Document Title (size, colour); Document Information toggles/labels: Number, Date, Terms, Due Date, Reference, Salesperson, Project, e-Way Bill Number, Place Of Supply, Subject.
- **Table > Labels** [ZI] — toggle/rename Quantity, Tax, Tax Amount, HSN Code, Rate, Line Item Number, Discount, Amount; Customize Item Name & Description (placeholders); *Invoice Created From Projects* labels (Invoices); column widths.
- **Table > Layout** [ZI] — Table Header, Item Row, Item Description: font size, background colour, font colour.
- **Total Section** [ZI] — *Show Total Section* (Sub Total, Shipping Charges, Discount, Total Taxable Amount, Tax Details, Total, Currency Symbol, Quantity); *Show Payment Details* (Payments Made, Credits Applied, Amount Withheld, Write Off Amount, Balance Due); *Show Amount in Words*; layout styling for Total and Balance Due. (Quotes, Invoices, Credit Notes)
- **Other Details > Document Summary** [ZI] — Notes (label, size); *Payment Options* (online payment methods); *Add your bank details*; *Show Invoice QR Code* (Invoices); Terms and Conditions; Signature (image + name).
- **Annexure** [ZI] — Add Annexure Content (by-laws, clauses; appended to each invoice); Show Retainer Tax Summary.
- Source: https://www.zoho.com/in/invoice/help/settings/templates.html

### 3.13 Import / Export

- **Import (any module)** [ZI] — hamburger > *Import*; *Choose File* from device or Cloud; formats CSV, TSV, XLS; sample file download; *Character Encoding* (default UTF-8); field mapping; checkbox *Save these selections for use during future imports*; Preview shows ready-to-import count, skipped records, unmapped fields; *Import*.
- **Export (any module)** [ZI] — hamburger > *Export*; choose module; scope *All* or *Specific Period* (by creation date); *Fields in Export File* = export template (else all fields) → *+ Add New*: name, *Add a New Field*, remove, drag-reorder, *Save and Select*; formats CSV / XLS / XLSX; *Password to protect the file* (XLSX native; CSV/XLS zipped with password).
- **Expense export limit** [ZI] — first 25,000 rows per export.
- Sources: https://www.zoho.com/in/invoice/help/import-export/ ; https://www.zoho.com/in/invoice/help/expense/manage-expenses.html

### 3.14 Expenses

- **Enable module** [ZI] — Settings > General Preferences > *Select the modules you would like to enable* > Expenses.
- **Record Expense form** [ZI] — Date; Category (with *Itemize* to split one expense across categories); Amount; Customer Name; *Billable* checkbox; *Attach receipt* (photo/upload); Projects field appears after customer chosen; Notes.
- **Record Mileage tab** [ZI] — first-time setup dialog: default category, default unit, mileage rates; fields: Date, Employee (submitter), *Distance traveled* or *Odometer reading* (start/end → auto distance), Tax dropdown, Customer + Billable.
- **Bulk Add Expenses tab** [ZI] — shortcut c+x; per row: Date, Category, Amount, Notes, Customer, Project, Billable.
- **Project expenses** [ZI] — from project *New Transaction > Create Expense*, or Projects field in expense form.
- **Import Expenses** [ZI] — TSV/CSV/XLS, field match, mismatch warnings.
- **Dashboard** [ZI] — expenses pie chart by category.
- **Expense Categories** (Gear > Expense Category) [ZI] — default set (e.g. Advertising, Credit card charges, Meals and entertainment); *New Category* (name, description); edit; delete; *Mark as inactive/active*.
- **List filters** [ZI] — All; Unbilled; Invoiced; Reimbursed; Billable; Non-Billable; With Receipts; Without Receipts.
- **Sort by** [ZI] — Created Time; Date; Expense Account; Customer Name; Amount.
- **Custom Views** [ZI] — *+ New Custom View*: Name, Criteria, Column Preference; listed under *Created By Me*.
- **Expense actions** [ZI] — Edit (pencil); More > Clone; More > Delete (irreversible).
- **Expense Preferences** [ZI] — *Vehicle* tab: *+New Vehicle* (Vehicle Name, Hint); *Preferences* tab: default category, default unit; Mileage rates rows: Start date, Vehicle, Rate; *+Add Mileage Rate*.
- **Reimbursable (billable) expenses** [ZI] — billable + customer required; *Convert to Invoice* (invoice date, payment terms); or on new invoice for that customer, prompt lists unbilled expenses → add as line items. Non-billable cannot be invoiced.
- **Expense reports** [ZI] — Reports > Purchases and Expenses; default current month, custom date range; print/export.
  - Expense Details (Expense Date, Reference#, Customer Name, Category, Expense Amount).
  - Expenses by Category (count, amount incl/excl tax; drill-down).
  - Expenses by Customer (Customer, Expense Count, amount, amount with tax).
  - Expenses by Projects (Customer, Project, count, amounts).
  - Mileage Expenses by Employee (employee, distance, count, totals with/without tax; drill-down).
- Sources: https://www.zoho.com/in/invoice/help/expense/ (index, expenses, expense-category, manage-expenses, more-with-expenses, preferences, reimbursable-expense, expense-reports)

### 3.15 Customer Portal

- **Portal Settings** (Preferences > Portal > Customer Portal tab) [ZI] — *Banner Message*; checkboxes: *Send me an email notification for every activity that takes place in the portal*; *Send an email notification to my customer when I comment on transactions*; *Allow customer to edit their information in the portal* (billing/shipping, contact); *Allow customers to forward documents from portal* (recipients added as contact persons); *Enable customer review for my services*; *Allow customers to view projects and timesheets*.
- **Invite** [ZI] — per customer: More > *Configure Customer Portal* (or gear next to *Portal Status*); pick contact persons; customisable invite email; *Accept Invite* → set password.
- **Portal Home** [ZI] — Outstanding Invoices (+ *Pay Now* full amount); Available Credits; Last Payment Made; Estimates pending approval count; Timesheets pending approval count; account details, contact persons, org contact details.
- **Estimates** [ZI] — *Accept* / *Decline*; *Show* filter; forward to email; download.
- **Invoices** [ZI] — *Pay Now*; filter; forward, download PDF, print; comments thread.
- **Card payments** [ZI] — card number, CVV, expiry, billing address, country; save card for future.
- **ACH payments** [ZI] — requires customer flag *Allow this customer to pay via his/her bank account*; *Use this account for future transactions*.
- **Payments Made** [ZI] — list, filter by invoice payments, sort by date/amount; Download PDF, Print receipts.
- **Projects** [ZI] — Tasks (Logged/Billed/Unbilled Hours), Time Entries (logged hours, billing status), Comments (reply with *Display in portal*).
- **Bulk Payments** [ZI] — pay all outstanding invoices via card or gateway.
- **Statements** [ZI] — Statement of Accounts; print/download PDF.
- **Notifications** [ZI] — *Viewed* icon + bell; email when client views, accepts/declines estimate, comments, pays, updates company details, accepts/declines client approvals.
- **Client self-service** [ZI] — Update Account Details & address (sync back to org); Edit Card Details; Change Password (per contact person); Send Email (Subject, Message); Write Review (shown under *Client Reviews* on contact Overview); Logout.
- **Portal MFA** [ZI] — Settings > Customer Portal > General > *Enable multi-factor authentication (MFA)* (all customers); TOTP via authenticator app (OneAuth, Google Authenticator), QR or manual code; 5 single-use backup codes; *Reset Portal MFA* per customer (gear next to email); disabling doesn't remove already-configured MFA (reset needed).
- Source: https://www.zoho.com/in/invoice/help/customer-portal/

### 3.16 Timesheets / Projects

- **Enable module** [ZI] — Settings > General Preferences > modules > Timesheets.
- **New Project form** [ZI] — Project Name; Description; Customer Name; Billing Method dropdown: Fixed Cost for Project; Based on Project Hours; Based on Task Hours; Based on Staff Hours; Based on Daily Rate.
  - Fixed Cost: *Total Project Cost*; Users (*Add User*); Tasks (*Add Task*).
  - Project Hours: *Rate per hour* for project.
  - Task Hours: rate per task.
  - Staff Hours: rate per user per hour.
  - Budget fields: *Total Project Cost* (budget, not for Fixed Cost); *Total Project Hours* / *Hours Per Task* / *Hours Per Staff* → over-budget flag in Project Summary report and project dashboard.
- **Daily Rate billing** [ZI] — rate types: Rate per Project (*Rate Per Day*, *Hours Per Day* HH:MM); Rate per Task (per-task Rate Per Day + Billable checkbox); Rate per User (per-user Rate Per Day). Time logged as Full Day / Half Day; ≤ half of Hours Per Day = half day, else full day; one entry per user per day; invoice quantity in days, reports in hours; cannot switch Daily ↔ Hourly; daily and hourly timesheets cannot be invoiced together.
- **Add Task** [ZI] — More > Add Task: Task Name, Rate Per Hour (Task Hours method only), Description; *Billable* (all methods except Fixed Cost).
- **Add User** [ZI] — More > Add User; *+ Add new user* invites to org + project.
- **Import/Export** [ZI] — Projects, Tasks, Timesheet entries via gear icon (CSV/TSV/XLS); tasks from other projects importable.
- **Log time — Live Timer** [ZI] — from project *Log Time*: Date, Task, Billable, *Start Timer*; timer at bottom-left of browser; Pause/Resume/Stop; timer icon beside user in project; timer without project (*Start*, Notes, optional *Associate Project*; project required on stop; trash = Discard).
- **Log time — Pre-recorded** [ZI] — Date; Task Name; *Time Spent* or *Set start and end time instead*; Billable (default checked); Notes; User (Admin only).
- **Instant + Log Time** [ZI] — date, project, task (*New Task* inline), Time Spent or Start Timer.
- **Weekly Log** [ZI] — pick week; rows project+task; hours per day (HH:MM formats); Billable.
- **Monthly / Calendar log** [ZI] — All Timesheet > Calendar > *+ New Entry* on date.
- **Chrome extension "Zoho Invoice Timer"** [ZI] — shortcut Alt+Shift+I; Timer tab (Project, Task, Notes, Start/Stop); Log Time tab (Date, Project, Task, Time spent, Notes); Timesheet tab (all entries); Settings > Organizations switcher.
- **Charge customer — from project New Transaction** [ZI]
  - *Create Estimate* (customer pre-filled; *Include Tasks*).
  - *Create Invoice*: *Bill up to* date; *How to sort data on invoice*: Single line for the project / Show all timesheet entries individually / Group by tasks / Group by users / Group by tasks and users; *Show in item name* (default Project Name + Description); checkbox *Yes, Include all unbilled expenses associated with this project*. Fixed Cost → single line only; Task Hours → no Group by users; Staff Hours → no Group by tasks; Project Hours → all.
  - Recurring invoices for repeating project work; *Create Expense* (customer + project pre-filled); Recurring expenses.
- **Project More menu** [ZI] — Invoice Preferences; Mark as Inactive/Active; Clone; Add Task; Add User; Delete.
- **Views** [ZI] — Projects: List / Card view (card has log-time & create-expense shortcuts), filters All / Active / Inactive. Timesheet entries: List (gear → Clone/Delete) / Calendar; Status filter All / Non-Billable / Billable / Unbilled / Invoiced; Period filter All, Today, This Week, This Month, This Quarter, This Year, Yesterday, Previous Week/Month/Quarter/Year.
- **Project Preferences** [ZI] — *Round Off Time*: Round up / Round down / Round to nearest / Don't Round-off (minute increments); *Set maximum hours/day for logging time* (default 24:00); custom fields (*+ New Custom Field*, *Change Order*).
- **Timesheet reports** (Reports > Projects and Timesheets) [ZI] — Project Summary (logged vs budgeted hrs/amount; billable vs non-billable; customize by Customer, Status) → Project Details (Task Name, Logged Hours, Billable Hours, Billed Hours, Billed Amount, Unbilled Amount; customize by customer, project, task, staff; print; export PDF/XLS/CSV; open in Zoho Sheet) → Timesheet Details (Project, Task, Staff, Notes, Logged Hours, Status; customize by Date, Customer, Project, Task, Staff).
- Sources: https://www.zoho.com/in/invoice/help/timesheet/ (index, timesheet-create, timesheet-logtime, charge-the-customer, chrome-extension, manage-timesheet-views, more-with-timesheets, timesheet-preferences, timesheet-reports)

### 3.17 Online Payment Gateways

- **General** [ZI] — Settings > Online Payments lists gateways; India list: Zoho Payments, Razorpay, Paytm, ICICI Bank EazyPay, PayPal, Verifone, Stripe (help nav also lists GoCardless, Mercado Pago, PayTabs — region-restricted). Zoho charges no fee; gateway charges apply. Only last 4 card digits stored by Zoho Invoice. Per-invoice *Payment Options* checkboxes at bottom of invoice (also recurring invoices); if several selected, last-configured gateway is default. Most gateways sync across all Zoho Finance apps (disabling in one disables in all).
- **Zoho Payments** [ZI] (US & India editions)
  - India: INR via UPI, cards, net banking; one-time payments; pricing per Zoho Payments pricing page.
  - Setup: *Set Up Now* → authorization checkbox → sections Business Profile (by Business Type, docs), Business Representative, Business Owners (≥10% ownership), Branding and Public Information (payment descriptor, support helpline), Bank Account (payouts) → Summary → accept ToS → Account Status + Account ID shown; verification up to 2 days.
  - Customer: Pay Now → method → Proceed To Payment → credentials or scan QR → Pay; also from portal invoice list; invoice auto-marked Paid; settled at next payout.
  - Edit Settings (may need re-verification docs); Disable (reason required; disables across Zoho Finance apps).
  - Source: https://www.zoho.com/in/invoice/help/online-payments/zoho-payments.html
- **Razorpay** [ZI]
  - Methods: credit/debit cards, net banking, UPI, wallets; one-time + recurring; multi-currency (international payments enabled by Razorpay support + support@zohoinvoice.com; settled in INR); GST-registered may claim ITC on Razorpay fees.
  - Setup: OAuth login (email/mobile + password → Authorize).
  - Webhook: copy URL from *Create a webhook to sync payment details with Zoho Invoice*; in Razorpay Account & Settings > Webhooks > Add New Webhook, events payment.authorized + payment.captured.
  - Customer save-card requires customer mobile number; checkbox *Allow 'Your Company Name' to collect future charges automatically*; domestic settlement within 2 working days.
  - *Autocharge* of saved card on recurring invoices — on request only via support.
  - Delete: first uncheck in unpaid invoices + delete cards.
  - Source: https://www.zoho.com/in/invoice/help/online-payments/razorpay.html
- **Paytm** [ZI] (India edition only, INR)
  - Methods: credit/debit cards, net banking, Paytm Wallet, UPI (UPI ID via Google Pay, BHIM, PhonePe).
  - Setup fields: Merchant ID, Merchant Key (or *Sign Up Now*).
  - Fees (borne by merchant, + taxes): UPI 0%; Paytm Wallet 1.70%; Credit Card Visa/Master 1.99%; RuPay Debit 0%; Debit Mastercard/Visa < ₹2000 0.40%; > ₹2000 0.90%; Net Banking 1.80%.
  - Edit Settings; Trash to delete.
  - Source: https://www.zoho.com/in/invoice/help/online-payments/paytm.html
- **ICICI Bank eazypay** [ZI] (India edition, zoho.in only; no new integrations accepted, existing users continue)
  - Prerequisite: ICICI current account; modes Cash, Cheque, Credit/Debit Card, Internet Banking, UPI, NEFT, RTGS; auto reconciliation; payment notifications; Corp ID, User ID, email shared with bank.
  - Setup fields: Merchant Name; Email Address (admin); Contact Number; ICICI Bank Account Number; Business Segment; SMS link to accept T&C; status Pending until accepted; activation up to 20 min.
  - Customer: Pay Now (enter amount) → Payment Mode → *Total Bill Amount*; online (net banking/card) or offline *Generate Challan* to pay at bank.
  - Delete only after enabling via icici-support@zohofinance.com; cannot re-integrate after deletion.
  - Source: https://www.zoho.com/in/invoice/help/online-payments/icicibank-eazypay.html
- **PayPal** [ZI]
  - Enhanced integration (pre-30 June 2024 users must convert Personal → Business account); Payflow and Payments Pro deprecated (existing users only).
  - Methods: cards (split across multiple cards; Visa, Mastercard, Amex, Discover, JCB, UnionPay); BNPL (PayPal Credit, Pay Later); Venmo (US, USD, QR scan).
  - Setup: Business account; login with email + country; shows Account Status, Merchant ID; PayPal clearing account configured by default; disabled status if account inactive/unverified.
  - Bank/card feeds from PayPal for matching/reconciliation; line items visible on PayPal page (not for partial payments); payment recorded instantly; integration active only if verified + transaction in last 12 months; deleting doesn't disable bank feeds.
  - Source: https://www.zoho.com/in/invoice/help/online-payments/paypal.html
- **Verifone (2Checkout)** [ZI]
  - One-time card payments, multi-country/currency (some countries restricted).
  - Setup fields: *2CO Account #*; *Secret Word* (from Verifone Site Management after setting Header Redirect + Approved URL https://invoice.zoho.com/n/2checkout).
  - Invoice option label *Verifone (Card)*; Edit Settings; delete (unmark from unpaid invoices first).
  - Source: https://www.zoho.com/in/invoice/help/online-payments/verifone.html
- **Stripe** [ZI]
  - One-time + recurring; auto card-updater sync via webhooks (events customer.source.updated, charge.succeeded, charge.failed, source.chargeable); Activity Logs & Audit Trail tracking; sales info visible in Stripe.
  - **India: Stripe allows only credit card payments.** Other regions: cards (Visa, MasterCard, Amex, JCB, Discover, Diners), iDEAL, Bancontact, ACH, Klarna, Apple Pay (Safari only), Alipay — enabled via Edit Settings > Edit next to Credit Card.
  - Customer checkbox to authorize future charges (card or bank); Link by Stripe autofill.
  - *Charge Customer* manual charge from Record Payment dropdown — **not available in India edition**; Auto-Charge via *Associate Card* on subscriptions (needs *Create, Charge, and Send Invoices* option); *Delete Card*; *Pay via Bank* toggle on customer Overview.
  - Deleting integration doesn't delete cards stored in Stripe.
  - Source: https://www.zoho.com/in/invoice/help/online-payments/stripe.html
- **GoCardless** [ZI] (UK, Canada, NZ, Switzerland, Australia only) — Direct Debit; GBP (SEPA/EUR via GoCardless); customer flag *Allow this customer to pay via Direct Debit*; 3–5 days processing; min £1, max £5,000; Preferences: *Mandate Description*; *Initiate Sync* (Mandate Sync: matching primary email, active mandates only); *View Transaction History*; *Remove*; portal option *Use this Direct Debit mandate for future transactions*. Source: https://www.zoho.com/in/invoice/help/online-payments/gocardless.html
- **Mercado Pago** [ZI] (Argentina, Brazil, Colombia, Chile, Mexico, Peru, Uruguay only) — modes Card, Cash (Rapipago etc.), Red Link Transfer; Edit icon to toggle modes; *Reconfigure Account*; Trash. Source: https://www.zoho.com/in/invoice/help/online-payments/mercado-pago.html
- **PayTabs** [ZI] (Gulf) — SADAD, MADA, KNet, OmanNet, Bahrain Benefit; requires customer email, phone, full billing address (telephone code if no zip); pay via portal, email, or *Charge Customer*; changing Merchant Email/MID requires delete + re-add. Source: https://www.zoho.com/in/invoice/help/online-payments/paytabs.html
- Sources: https://www.zoho.com/in/invoice/help/online-payments/ ; https://www.zoho.com/in/invoice/help/settings/online-payments.html

### 3.18 Reports

**Full report list by category** [ZI]

- **Sales** (accrual basis) — Sales by Customer (by Invoices / Credit Notes / Sales Receipt / all); Sales by Item (Invoices / Credit Notes / both); Sales by Sales Person (Invoices + Credit Notes). Function table also lists Sales by Plan, Sales by Addon, Sales by Coupons, Sales Summary. Source: https://www.zoho.com/in/invoice/help/reports/sales.html
- **Receivables** — AR Aging Summary; AR Aging Details; Invoice Details; Retainer Invoice Details; Quote Details; Bad Debts; Customer Balance Summary; Receivable Summary; Receivable Details; Progress Invoice Summary. Source: https://www.zoho.com/in/invoice/help/reports/receivable.html
  - AR Aging Summary: entity Invoices / Credit Notes; default intervals Current, 1–15, 16–30, 31–45, >45 days; *based on* Invoice Due Date or Invoice Date; *Show By* Invoice Count or Outstanding Invoice Amounts; configurable number + frequency of *Aging Intervals* (days or weeks); drill-down to AR Aging Details per customer.
  - Invoice Details: by Invoice Date or Invoice Due Date; one-time + subscription invoices; selected/all products.
  - Bad Debts: customers with invoices written off in period.
  - Receivable Details: per item — quantity, item price, total across invoices, credit notes, sales receipts.
- **Payments Received** — Payments Received (invoices / retainer payments / all; per product); Time to Get Paid (intervals 0–15, 16–30, 31–45, >45 days, upcoming dues); Credit Note Details (with status); Refund History; Payment Failures; Card Expiration. Source: https://www.zoho.com/in/invoice/help/reports/payments-received-reports.html
- **Recurring Invoices** — Recurring Invoice Details (customize by Customer Name, Date Range, Invoice Date, Status; print; PDF/CSV/XLS; Zoho Sheet); Payment Failure (period filter; print, PDF); Payment Retry; Card Expiry (by status). Source: https://www.zoho.com/in/invoice/help/reports/recurring-invoice-reports.html
- **Purchases and Expenses** — Expense Details; Expenses by Category; Expenses by Customer; Expenses by Project; Billable Expense Details (status, invoiced amount, gross profit); also Mileage Expenses by Employee (expense help). Source: https://www.zoho.com/in/invoice/help/reports/purchases-expenses-reports.html
- **Projects and Timesheets** — Timesheet Details (Logged, Non-Billable, Billed, Unbilled Hours; filter Customer, Project, Task, Staff); Project Summary (Logged Hours/Amount etc.); Projects Revenue Summary (budget vs actual revenue); Project Details (drill-down). Source: https://www.zoho.com/in/invoice/help/reports/project-timesheet-reports.html
- **Activity** — System Mails (filter by Mail Type); Activity Logs & Audit Trail (*View Audit Trail* per activity, who changed what, *Compare* versions); Portal Activities (sign-ups, logins, info updates); Customer Reviews (counts of 5-star, 4-star, <4-star + list). Source: https://www.zoho.com/in/invoice/help/reports/activity.html
- **Other reports mentioned elsewhere** — SMS Notifications report; Overseas Digital Tax Summary (GST digital services).

**Function support matrices** [ZI]

- Sales: Filter all; Compare only Customer/Item/Sales Person; Group only Plan & Sales Summary; Customize Columns, Sort, Schedule, Share, Export, Print, Custom Report — all.
- Receivables: Group/Customize Columns/Custom Report not for Bad Debts; Schedule not for Progress Invoice Summary; rest all.
- Payments Received: Schedule not for Time to Get Paid; Customize Columns, Print, Custom Report not for Payment Failures.
- Purchases & Expenses: Group only Details/Project/Billable; Customize Columns not for Category; Schedule only Customer/Project/Billable; Custom Report only Customer/Project.
- Projects: Group only Timesheet Details; Customize Columns/Sort/Custom Report not for Timesheet Details.
- Activity: Schedule only Activity Logs & Customer Reviews.

**Report functions** [ZI] — Source: https://www.zoho.com/in/invoice/help/reports/report-functions.html

- **Configure Report Layout** (admin only; via Export > *Customize the details in the export file*) — Choose Details to Display: Organization Name, Generated By, Page Number, Generated Date, Generated Time; *Column Headers on Each Page*; Table Density: Classic / Compact / Super Compact; Table Design: Default / Bordered / Alternate Rows / Alternate Columns (not for Business Overview & Tax reports); Paper Size A4 / Letter; Orientation Portrait / Landscape; Font Family (language support); Margins (top/bottom/left/right); applies to all printed/PDF reports.
- **Filters** — Date Range (presets or custom); report-specific filters; *+ More Filters* advanced: field + comparator + value, *+ Add More*; *Run Report*.
- **Customize Report Columns** — Available ↔ Selected columns (+/−), drag reorder, gear for sub-columns; Apply.
- **Compare With** — predefined comparisons (e.g. previous years), vary by report.
- **Performance Overview** (metric reports) — Current Month; Month on Month; Quarter on Quarter; Year on Year growth %.
- **Favorites** — star icon → Favorites section.
- **Export** — file name; XLS, XLSX, CSV, PDF, Export to Zoho Sheet; for >20,000 rows: *Export Latest Report* (first rows, plan-dependent limit) or *Export Complete Report* (async, notify, download via *View History*; plan-dependent limit); *I want to protect this file with a password*; *Export this report based on my current view*; per-export layout; *Temporary Note* in footer.
- **Print** — Export > *Print Preference* → layout + Temporary Note → Preview.
- **Other listed functions** — Group Report, Sort Columns, Schedule Report, Share Report, Custom Report (per matrices above; details not in crawled text).

### 3.19 Integrations

- **Integrations hub** [ZI] — Settings > Integrations (Zoho Apps tab; Online Payments; Marketplace). Source: https://www.zoho.com/in/invoice/help/integrations/index.html
- **Zoho CRM** [ZI]
  - Prereq: CRM base currency = ZI base currency (if CRM multi-currency); shares org name, email, country, all users.
  - Connect: Settings > Zoho Apps > Connect > Select Organization → two-way sync; multiple ZI orgs → one CRM org only via support, one-way, no transaction sync.
  - Customers sync: *Select Module in Zoho CRM*: Accounts (→ Business customers) / Contacts (→ Individual) / Accounts & their Contacts (→ customers + contact persons; option *Include contacts that are not associated to any accounts*); *Extent*: Fetch from CRM / Sync both ways (CRM first); duplicates matched on Account Name vs Customer Display Name → Clone / Overwrite / Skip; *Select the view to be synced*; Map Fields (custom fields for unmapped); *Save and Sync* / *Save and Sync Later*; *Check Status*.
  - Items sync with CRM Products: Fetch from CRM / Sync both ways (ZI first); dupes on Product Name/Item Name + SKU; view; Map Fields (custom Goods/Services field → Product Type).
  - Sync options: auto every 2 hours after initial (transactions instant); *Instant Sync*; per-customer *Re-sync Contact from Zoho CRM*; *Show Sync History* (added/updated/deleted, failures + reason); *Pause/Resume Sync*; Edit. CRM deletion doesn't delete ZI record.
  - In ZI: Customers filter *CRM*; *Advanced Customer Search* → Zoho CRM tab (Account Name; First/Last Name) to fetch on the fly.
  - In CRM: profile *Zoho Finance Permissions* per transaction (View, Create & Edit, Send Email); toggle *Receivables and Payables Summary*; *Zoho Finance* module to create Quotes/Invoices (numbering from ZI; convert quote → invoice; mark Accepted/Declined; send, print, mark as sent); create from Account/Contact Overview; CRM reports on Zoho Finance modules incl. custom fields.
  - Collaboration: CRM notes/events/calls visible in ZI via *Zoho CRM* icon > CRM Details > Notes; ZI comments in CRM Timeline > History.
  - Disable (deletes CRM-side custom reports, comments, attachments of Finance transactions) / Enable; Delete (only when disabled; choose convert all synced CRM records or only those with transactions; removes from other Zoho Finance apps).
  - Source: https://www.zoho.com/in/invoice/help/integrations/crm-integration.html (duplicate: crm-invoice-integration.html)
- **Bigin** [ZI] (requires paid Bigin plan or Zoho One)
  - Connect via Zoho Apps; modules: Companies → Customers (Business); Contacts → Customers; Products → Items; Companies & their Contacts → customers + contact persons (unassociated contacts not synced).
  - Sync prefs: module choice; *Include contacts which are not associated with any companies?*; *Which record needs to be synchronized?* (recently created/modified etc., custom views); duplicates Clone / Overwrite / Skip; Map Fields; *Save and Sync*.
  - Manage: Edit, *Sync Now*, *Pause Sync*, per-contact *Re-sync Contact from Bigin*; filter *Bigin Customers*; search *In Bigin* in customer search; *Link Potential* → Potentials tab → *Associate* (Estimates, Invoices).
  - Disable via *Delete Integration* in Bigin (data retained, editable); full delete via support.
  - Source: https://www.zoho.com/in/invoice/help/integrations/bigin.html
- **Zoho Analytics** [ZI] (admin only; 15-day free trial then paid Analytics plan)
  - Shares email, customers, invoices, estimates, expenses; one-way sync; choose Modules + Fields; sync Schedule; *Save and Sync*; *Edit Settings* later.
  - 75+ prebuilt financial reports; custom reports, charts, pivots, summaries, widgets, dashboards; share, schedule/email, export PDF/HTML/Excel/CSV/image, embed.
  - Access: Reports > *Try Advanced Reporting* or *Access Zoho Analytics*; workspace only for setup admin unless users added (Settings > Users > Add New Users).
  - Delete removes all synced data from Analytics.
  - Source: https://www.zoho.com/in/invoice/help/integrations/advanced-analytics.html
- **Zoho Cliq** [ZI] — *Complete Setup* → choose channel → Connect; notifications when customers view quote/invoice, accept/decline quote, comment, rate/review; weekly summary (if enabled); *Deactivate*; shares email, username, org name. Source: https://www.zoho.com/in/invoice/help/integrations/cliq-integration.html

- **Email integration (Gmail / Outlook)** [ZI] — Settings > Integrations > Other Apps (G Suite/Gmail, Office 365/Outlook) or contact *Mails* > *Connect your mail account* (*Link with work account*); only one active mailbox per org; mails between you and contact fetched into contact Mails; *Add mail to* Invoice / Estimate / Contact Activity; attach mail attachments to contact (up to 10 files × 5 MB); refresh fetch; *Configure Emails* to switch (disconnect first); *Disable Integration*. Source: https://www.zoho.com/in/invoice/help/integrations/email-integration.html
- **Google Workspace** [ZI]
  - Prereq: Workspace (not Gmail) address = ZI login email; Workspace admin; follows Google Limited Use.
  - Install from Marketplace: *Admin Install* (all users or groups/OUs) or *Individual Install*; app in Google Apps launcher → *Go to Organization*.
  - Gmail fetch requires whitelisting: *Add the Client ID and the OAuth Scopes* (domain-wide delegation) + *Add the Client ID to the Trusted List of Apps*.
  - Customers > More > *Import Customers from Google Workspace* (hover > Add > *Continue to Import*); Mails tab (*System Mails* dropdown) → *Add mail to* Invoice / Quote / Customer Activity / *Add mail attachments to customer*.
  - Users > *Invite Google Workspace User* (Name, email from Workspace, Role).
  - Disable: imported customers/users remain standalone; uninstall app from Google Admin Console separately.
  - Source: https://www.zoho.com/in/invoice/help/integrations/gapps-invoice.html
- **Microsoft 365 / Outlook** [ZI] — sign in to ZI with Microsoft; Other Apps > Microsoft 365/Outlook > *Enable Integration* > Microsoft 365 Account; Customers > More > Import > *Import Customers From Microsoft 365* (Add, Map Fields, Import); Mails tab: Add Email To Invoice/Quote, Customer Activity, Add Email Attachments to Customer; Users > *Invite Microsoft 365 User* (+ role); disable keeps imported data. Source: https://www.zoho.com/in/invoice/help/integrations/office-365-integration.html
- **Slack** [ZI] — Other Apps > *Add to Slack* → workspace URL → channel → Allow; notifications: view quote/invoice, accept/decline quote, comment, pay invoice, rate/review; *Remove*; shares Slack URL + org details. Source: https://www.zoho.com/in/invoice/help/integrations/invoice-slack-help.html
- **Zoho Projects** [ZI]
  - Prereq: admin in ZI and owner/admin of Projects portal (and admin in Zoho Expense if connected); older flow uses Projects ZSC key + email (Setup > Integrations > Developer Space).
  - Setup: Connect → *Portal Name*; modules: Projects (default; only projects with primary client/customer, with tasks & bugs) and Timesheet (billable + approved only; users → Project Staff Users, non-ZI users → Inactive Timesheet Staff Users); option: date before which timesheets marked *Invoiced* (rest *Unbilled*) or import all as Unbilled; customer duplication Clone / Overwrite; checkbox *Restrict project creation in Zoho Invoice*; Map Field (custom fields of same data type); *Save and Sync*.
  - Status: *Sync in Progress* / *Active*; Refresh; *Instant Sync*; *Show Sync History*; *View Mapped Fields*; *View Error Summary* (module-wise errors); *Update Credentials*; Customer Duplication gear.
  - Transactions: Time Tracking > Projects > Create Invoice / New Transaction (quotes, invoices, recurring invoices, expenses, recurring expenses); invoice milestones, task lists, tasks; transactions visible instantly in Projects Finance tab and vice versa.
  - Disable / Enable (same portal only; resumes from last sync); Delete (projects stay standalone).
  - Troubleshooting: project needs primary client (currency conflicts); timesheet must be billable + approved; tasks exceeding *maximum hours/day* setting fail.
  - Sources: https://www.zoho.com/in/invoice/help/integrations/projects-integration.html ; https://www.zoho.com/in/invoice/help/zoho-app-integrations/projects-integration.html
- **QuickBooks Online** [ZI] — **only US, UK, Canada, UAE editions (not India)**
  - Prereqs: one QBO org ↔ one ZI org; QBO country US/UK; same base currency.
  - Settings > Integrations > Accounting > *Connect to QuickBooks*; import Accounts (all; used on items) and optionally Customers; export Invoices (Sales) and Credit Notes (Credit Memos) with payments; account for bank charges/write-offs/adjustments; write-off → credit note in QBO; bank charges → undeposited funds then deposit; items auto-created as Products/Services.
  - Tax mapping (same rates); bring QBO items via export/import and mark inactive in QBO.
  - Sync: transactions one-way immediate (create/update/delete invoice, add/delete payment); customers QBO→ZI daily auto + *Instant Sync*; field maps (Invoice No., date, currency, exchange rate, product/service, description, rate, qty, discount as total only, tax, shipping, adjustment as line; customer display name, email, work phone, mobile, website, fax, billing/shipping address, currency); History section; *Change Configuration*; Disable / Enable / Delete Integration.
  - Source: https://www.zoho.com/in/invoice/help/integrations/quickbooks-online-integration.html

- **Zoho SalesIQ** [ZI] — Zoho Apps > Connect > *Connect Now* (or create portal) → select SalesIQ Portal + Website → Integrate; *Configure* to switch (setup user only); chat widget bottom-right of Customer Portal (logo, colour, message customisable in SalesIQ); missed chats; Canned Responses; Zobot (AI auto-replies, help links); Visitors Online tracking of portal visitors. Source: https://www.zoho.com/in/invoice/help/integrations/salesiq.html
- **Zoho Sign** [ZI]
  - Setup toggles: *User Signature for Invoices* (block sending until signed); *User Signature for Estimates*; *Customer Signature for Estimates* (sign before accepting in portal); Edit later via Show Details.
  - *Sign Invoice* / *Sign Estimate* (admins + users with approval permission, who must be invited to Zoho Sign org); only after final approver if multi-level approvals configured; placeholders %DigitalSignature%, %ClientSignature%; signature not shown in multi-copy prints, bulk print/download, or details preview.
  - Auto-sign: recurring-profile invoices (unless *Create Invoices as Drafts*); estimate→invoice auto-conversion with *Yes, Save, Sign and Send*; uses setup user's signature.
  - Customer signs via drawn / typed / uploaded image; accepted signed estimates not editable.
  - Edited signed docs block Download PDF, Email, Print, Convert to invoice, Snail Mail, Share link, Notify via SMS, Mark as Sent until re-signed; re-sign counts toward Sign plan usage; PDF versions in Comments & History.
  - Delete: signed PDFs remain downloadable from Comments.
  - Source: https://www.zoho.com/in/invoice/help/integrations/sign-integration.html
- **Upgrade to Zoho Billing** [ZI] — Zoho Apps > *Upgrade to Zoho Billing* (all data except users synced; *Sync Users*); two-way reflection thereafter; or *Join your existing Organisations* from Billing; starts in Trial; Billing offers more billing methods, automation, transaction approvals, higher usage limits, bulk emails. Source: https://www.zoho.com/in/invoice/help/integrations/upgrade-to-zoho-billing.html
- **Upgrade to Zoho Books** [ZI] — Integrations > Accounting > *Upgrade to Zoho Books* (or from Books > Manage > View Organization); same credentials; users redirected to Books; 14-day trial of Premium, then paid or Free plan; revert only via support (Bills, Purchase Orders, Sales Orders, custom functions, workflows not carried back). Books supports GSTR-2/3, purchases, bank reconciliation. Source: https://www.zoho.com/in/invoice/help/integrations/upgrade-to-zoho-books.html
- **Zapier** [ZI] — Other Apps > *Try Now*; triggers: Customer Payments, Invoice Status Change, New Contact, New Contact Person, New Credit Note, New Estimate, New Expense, New Invoice, New Item, New Project, Update Invoice; actions: Create Contact Person, Create Credit Note, Create New Contact, Create New Estimate, Create New Invoice, Create New Item, Record Payment, Update Contact, Update Invoice; searches: Find Contact, Find Invoice, Find Organization. Source: https://www.zoho.com/in/invoice/help/integrations/zapier-integration.html
- **Zoho Mail** [ZI] — Zoho Apps > Enable (or contact Mails > *Connect your mail account*); contact Mails tab (*System Mails* > Zoho Mail); *Add mail to* Estimate / Invoice (as comment) / Contact Activity; attachments to transactions or contact documents (paperclip > *Add mail attachments to contact*); Disable. Source: https://www.zoho.com/in/invoice/help/integrations/zoho-mail-integration.html
- **Zoho Notebook** [ZI] — Zoho Apps > Install → widget in right pane; cards: Write (note), To Do (checklist), image (one at a time), Attach document (one at a time); Delete (syncs both ways); *Open in Notebook*; Uninstall (cards retained in Notebook). Source: https://www.zoho.com/in/invoice/help/integrations/zoho-notebook-integration.html
- **Zoho People** [ZI] — admin; one People org only; Connect + *Refresh*; in People: *Push time logs automatically when a timesheet is approved*; only tasks linked to project + customer pushed; Integration Report in People Time Tracker; Disable. Source: https://www.zoho.com/in/invoice/help/integrations/zohopeople-integration.html
- **Zoho Desk** [ZI] — Desk admin; one ZI org per Desk portal; set up from Desk; map Desk contacts to customers by email (or create; *Delink contact*); from ticket create Quote/Invoice incl. billable time entries; *Invoices/Quotes for this ticket*; clone, edit, void, mark sent, email; disable keeps mappings, delete removes them. Source: https://www.zoho.com/in/invoice/help/zoho-app-integrations/desk-integration.html

### 3.20 Marketplace Extensions

- **Tally XML Exporter ("Export Data in Tally XML Format")** [ZI] — **early access, enable via support@zohoinvoice.com**
  - Install: Settings > Marketplace > search > Install (personal details, T&C, Organization dropdown, authorize) ; other users connect *Tally XML Connection* from Installed Extensions.
  - Use: Invoices list → select invoices → *Export in Tally XML Format* → two files: Master XML (items, accounts, customers) + Transaction XML (invoices).
  - Tally import: Import > Masters / Transactions under Company Data; missing records auto-created.
  - Uninstall via Installed Extensions > View Details.
  - Source: https://www.zoho.com/in/invoice/help/marketplace-extensions/export-tally-xml-format.html
- **Bitly Invoice Link** [ZI] — needs Bitly account (link quota per Bitly plan); install via Zoho Marketplace (Portal Name, authorize *Zoho Finance – Bitly Invoice Link* and *Bitly* connections via Zoho Flow); custom button on invoice details for invoices in Approved / Sent / Partially Paid / Paid / Overdue; *Link Expiration Date* 15 / 30 / 45 / 60 days or custom; *Generate Link*, Copy, *Regenerate Link*; for SMS sharing; uninstall hides generated links (still work until expiry). Source: https://www.zoho.com/in/invoice/help/marketplace-extensions/bitly-invoice-link.html
- **Snail Mail** [ZI] — physical postal copies of invoices/quotes via Postal Methods account; install with Postal Methods *Secret Key*; checkboxes include payment stub, include primary username; *Configure* preferences; send only for Draft or Approved quotes/invoices (custom button *Snail Mail*; prompts for missing org/billing address → *Save & Preview* → Send); *Related Lists > Snail Mail History > Check Status*; Uninstall. Source: https://www.zoho.com/in/invoice/help/marketplace-extensions/snail-mail.html
- **Custom button behaviour** [ZI] — latest-installed extension shown on invoice custom button; others via dropdown.

### 3.21 AI Features & MCP

- **AI Preferences** (Settings) [ZI] — per-feature Enabled toggle; choose *AI Provider* and *Model* per feature; Save.
- **Zia Invoice Insights** [ZI] — top of Invoices list (Zia icon toggles): Overdue and Outstanding Invoice Balance (*Set Payment Reminder*); Overdue Balance From Customers With Payment Delays (customers paying < 70% of invoice amounts in past 6 months; *Send Payment Reminders*); Invoices Exceeding Average Late Payment Days (*View Invoices*).
- **Generate With Zia (email templates)** [ZI] — Settings > Email Notifications > notification > *Show Mail Content* > recipient details > *Generate With Zia* icon → prompt → *Generate Content*; adjust Tone and Content; regenerate; *Insert*.
- **Zoho MCP** [ZI]
  - Zoho MCP console: *Create MCP Server* (name); Tools > *Add Tool* > Zoho Invoice > mark tools (least-privilege advised) > *Add Now*; Connect > Server URL copy; *Regenerate API Key* invalidates old URL; Add/Remove tools later; Disable/Enable server (config preserved); Delete server (permanent).
  - Clients: ChatGPT (Settings > Apps > Developer mode > Create app: Name, Description, MCP Server URL, Authentication e.g. OAuth); Claude (Settings > Connectors > Add custom connector); Cursor (JSON snippet into ~/.cursor/mcp.json; Agent mode); VS Code (Command Palette *MCP: Add Server…* > HTTP/SSE). Consent: *I allow MCP to access the above data from my Zoho account*.
  - Usage: natural-language create invoices, fetch customers, check payment status, record payments, send reminders, mark paid, list overdue; include organization ID in prompt if multiple orgs; AI platform may need paid plan for MCP.
- Sources: https://www.zoho.com/in/invoice/help/ai/ai-features.html ; https://www.zoho.com/in/invoice/help/ai/zoho-mcp-integration.html ; https://www.zoho.com/in/invoice/help/settings/ai-features.html

### 3.22 Transaction Approval

- **Transaction approval page** [ZI] — crawled URL returned only the generic help landing page (no approval content). Indirect evidence from other pages: multi-level approvals for sales transactions/estimates exist (invoices signable only after final approver; users with approval permission can sign); invoice statuses include *Approved*; GST return filing has its own approval toggle + approvers (see 3.1); Zoho Billing upgrade page cites "transaction approvals" as a Billing feature. Sources: https://www.zoho.com/in/invoice/help/transaction-approval/index.html ; https://www.zoho.com/in/invoice/help/integrations/sign-integration.html ; https://www.zoho.com/in/invoice/help/integrations/upgrade-to-zoho-billing.html


## 4. Pricing, Plans & Per-Plan Limits (India)

### 4.1 Zoho Invoice (India) — https://www.zoho.com/in/invoice/pricing/
- **Price: ₹0, "forever free"**; no paid tiers; no contracts/credit card. Upsell path → Zoho Billing (advanced/subscriptions) or Zoho Books (accounting). [ZI]
- Headline inclusions: GST-compliant invoices; email **or WhatsApp** invoice delivery; accept UPI, cards, net banking; automated payment reminders; branded templates; quotes; recurring invoices; apps for Android, iOS, Windows, Mac; time tracking & expenses; self-service customer portal; reports (sales, receivables, expenses; "around 30 reports"); integrations (Zoho CRM, Analytics, Books…). 
- Limits seen in help docs: **2 users/org**; **3 custom fields per module (single-line text only)**; fixed roles only (no custom roles); see sections 2–3 for others.
- Support: 24/5 free email support (support@zohoinvoice.com). No ads / no data selling. FAQ mentions inactivity data policy and multi-language invoices.
- Marketing feature list (https://www.zoho.com/in/invoice/features/): 10+ invoice languages; schedule invoices for future date; recurring invoices; quotes → projects; quote approval via portal; quote expiry dates; quote history; convert quote → invoice; customer portal; unpaid-invoice list on statements; payment reminders; **save customer card for auto-charge**; customer statements; billing/shipping address format; **request customer reviews/ratings**; 10+ gateways; record offline payments (cash, cheque…); payment receipt custom fields + templates; billable expenses → invoice; expense categories; **mileage tracking**; projects (bill by project hours or task hours; unbilled hours/expenses; associate unbilled hours to recurring invoices); template gallery, item-table look customization, associate templates to contacts; tax breakdown; portal bulk payments, partial payments, quote accept/comment, timesheets & project details in portal; Zoho Analytics integration; restrict users to assigned customers; items with SKU, custom fields, active/inactive.

### 4.2 Zoho Books (India) plans — https://www.zoho.com/in/books/pricing/
| Plan | Monthly billing | Annual billing (per org/month) | Users | Support |
|---|---|---|---|---|
| Free | ₹0 (only if annual revenue < ₹25 lakh) | ₹0 | 1 user + 1 accountant | Email (Mon–Fri 9–7) |
| Standard | ₹899 | ₹749 | 3 | Email |
| Professional | ₹1,799 | ₹1,499 | 5 | Email + voice |
| Premium | ₹3,599 | ₹2,999 | 10 | Email, voice, chat |
| Elite | ₹5,999 | ₹4,999 | 15 | Email, voice, chat |
| Ultimate | ₹9,599 | ₹7,999 | 25 | Email, voice, chat |
- Prices exclusive of GST. 14-day free trial (trial = Premium). Paid priority support plan available (3-hour response, onboarding).
- Plan headline bundles: **Standard** = e-invoices & payments, progress invoicing, expenses & bills, receipt autoscans, payment reminders, customer portal, inventory, sales/purchase orders, transaction period locking, banking & reconciliation, Invoice Management System (IMS), GST reports & filing, P&L/Balance Sheet & 50+ reports. **Professional** = bill timesheets, project profitability, retainers, price lists, sales & purchase approvals, multi-currency, custom workflows, collaboration (chat/voice/video/screen share), custom user roles. **Premium** = fixed assets, payroll, profit margin, budgets, cash-flow forecasting, vendor portal, custom domain, custom modules, custom buttons, validation rules, web tabs, custom functions. **Elite** = dashboard customization, blueprints, advanced inventory, warehouses, composite items, serial numbers, batch tracking, shipping labels, shipment tracking, Etsy/Amazon channels, Shopify (2 stores), bin locations. **Ultimate** = Zoho Analytics-powered BI (50+ visualizations, KPIs, blending other sources, collaborative/embedded reports, 3M rows).
- **Add-ons** (not on Free except autoscans): extra user ₹150/user/mo annual (₹180 monthly); payroll employee ₹60/emp/mo annual (₹75 monthly; Premium+); **Locations ₹600/location/mo (includes 1 GSTIN + 10K invoices)**; document autoscans ₹419 per 50 scans/mo; **SMS ₹75/credit (min 5 credits)**; Orders & shipping labels ₹360/mo (50 orders + 50 labels); Expense claims ₹149/user/mo; BillPay ₹2,999/mo.
- Volume limits (FAQ): invoices/year Free 1,000 · Standard 5,000 · Professional 10,000 · Premium 25,000 · Elite/Ultimate 1,00,000; bills+expenses/year same numbers; receipt autoscans/month Free 50 · Std/Pro 200 · Premium+ 1,000; scheduled reports: Free 5 · Standard 5 (matrix) or 50 (FAQ) · Professional 50 (matrix) or 200 (FAQ) · Premium+ 200 — the two pages disagree; report export: PDF ≤5,000 records instant, Sheet/CSV/XLS/XLSX ≤20,000 instant, beyond → async; async export cap 1,00,000 records (Free–Premium) / 10,00,000 (Elite/Ultimate).
- Data: cloud sync across devices (desktop, mobile, tablet, smartwatch); 2FA + SSL; no contract, cancel any time.

### 4.3 Zoho Books (India) full plan-comparison matrix — https://www.zoho.com/in/books/pricing/pricing-comparison.html
(✓ included, ✗ not included; numbers are quotas. Extracted from the page's DOM.)

| Feature | Free | Standard | Professional | Premium | Elite | Ultimate |
|---|---|---|---|---|---|---|
| Users | 1 User + 1 Accountant | 3 Users | 5 Users | 10 Users | 15 Users | 25 Users |
| Locations | ✗ | ✗ | 2 | 3 | 8 | 8 |
| Employees (Payroll) | ✗ | ✗ | ✗ | 10 | 20 | 20 |
| **SALES** | | | | | | |
| Quotes | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Manage customers | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Invoices | 1,000 a year | 5,000 a year | 10,000 a year | 25,000 a year | 1,00,000 a year | 1,00,000 a year |
| Recurring invoices | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Credit Notes | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Invoice customization | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Customer portal | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Multi-lingual invoicing | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Payment reminders | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Online payments | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Generate payment links | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Record Offline Payments | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Sales orders | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| E-Way Bills | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Progress invoicing | ✗ | ✓ | ✓ | ✓ | ✓ | ✓ |
| e-Invoicing | ✗ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Remove Zoho Books branding on invoices | ✗ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Sales approval | ✗ | ✗ | ✓ | ✓ | ✓ | ✓ |
| Retainer invoicing | ✗ | ✗ | ✓ | ✓ | ✓ | ✓ |
| Multi-currency invoicing | ✗ | ✗ | ✓ | ✓ | ✓ | ✓ |
| Automatic exchange rates | ✗ | ✗ | ✓ | ✓ | ✓ | ✓ |
| Custom approval workflows | ✗ | ✗ | ✗ | 25 | 70 | 70 |
| Profit Margin | ✗ | ✗ | ✗ | ✓ | ✓ | ✓ |
| Multi-transaction number series | ✗ | ✗ | ✗ | ✓ | ✓ | ✓ |
| Account customization | ✗ | ✗ | ✗ | ✓ | ✓ | ✓ |
| Multi-currency transactions for each customer | ✗ | ✗ | ✗ | ✓ | ✓ | ✓ |
| **PURCHASE** | | | | | | |
| Expenses and Bills | 1,000 expenses & bills combined | 5,000 expenses & bills combined | 10,000 expenses & bills combined | 25,000 expenses & bills combined | 1,00,000 expenses & bills combined | 1,00,000 expenses & bills combined |
| Manage vendors | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Vendor credits | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Record payments made | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Purchase orders | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Mileage tracking | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Auto forward receipts from email inbox | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Receipt autoscans | 50 per month | 200 per month | 200 per month | 1,000 per month | 1,000 per month | 1,000 per month |
| Recurring expenses | ✗ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Recurring bills | ✗ | ✗ | ✓ | ✓ | ✓ | ✓ |
| Apply landed costs to purchases | ✗ | ✗ | ✓ | ✓ | ✓ | ✓ |
| Multi-currency transactions | ✗ | ✗ | ✓ | ✓ | ✓ | ✓ |
| Automatic exchange rates | ✗ | ✗ | ✓ | ✓ | ✓ | ✓ |
| Custom approval workflows | ✗ | ✗ | ✗ | 25 | 70 | 70 |
| Multi-transaction number series | ✗ | ✗ | ✗ | ✓ | ✓ | ✓ |
| Cheque printing | ✗ | ✗ | ✗ | ✓ | ✓ | ✓ |
| Vendor portal | ✗ | ✗ | ✗ | ✓ | ✓ | ✓ |
| Multi-currency transactions for each vendor | ✗ | ✗ | ✗ | ✓ | ✓ | ✓ |
| **BANKING** | | | | | | |
| Add multiple bank and credit card accounts | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Import bank and credit card statements | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Auto forward bank and credit card statements | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Bank reconciliation | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Transaction rules | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Connected Banking with partner banks | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Setup bank & credit card feeds via third party provider | ✗ | ✓ | ✓ | ✓ | ✓ | ✓ |
| **FOR ACCOUNTANTS** | | | | | | |
| Invite accountant | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Chart of accounts | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Sub-accounts | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Manual journals | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Bulk update - accounts | ✗ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Transaction locking | ✗ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Journal templates | ✗ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Base currency adjustments | ✗ | ✗ | ✓ | ✓ | ✓ | ✓ |
| Recurring journals | ✗ | ✗ | ✓ | ✓ | ✓ | ✓ |
| Budgeting | ✗ | ✗ | ✗ | ✓ | ✓ | ✓ |
| Fixed asset management | ✗ | ✗ | ✗ | ✓ | ✓ | ✓ |
| **INVENTORY** | | | | | | |
| Manage items | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Stock tracking | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Set reorder points | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Price lists | ✗ | ✗ | ✓ | ✓ | ✓ | ✓ |
| **REPORTING** | | | | | | |
| Dashboard | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Reports | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Export and print reports as spreadsheet or PDF | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Schedule reports | 5 | 5 | 50 | 200 | 200 | 200 |
| Custom reports | ✗ | 10 | 25 | 50 | Unlimited | Unlimited |
| Cashflow forecasting report | ✗ | ✗ | ✗ | ✓ | ✓ | ✓ |
| Report Builder | ✗ | ✗ | ✗ | ✓ | ✓ | ✓ |
| Dashboard customization | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ |
| **GST COMPLIANCE** | | | | | | |
| Invoice Management System | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| GST Tracking | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| GST Returns | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| GST Filing | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| GST Payments | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| MCP Client Access | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Writing assistant | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Zia insights | ✗ | ✗ | ✗ | ✓ | ✓ | ✓ |
| CoCreate | ✗ | ✗ | ✗ | ✓ | ✓ | ✓ |
| Anomaly detection | ✗ | ✗ | ✗ | ✓ | ✓ | ✓ |
| Forecasting | ✗ | ✗ | ✗ | ✓ | ✓ | ✓ |
| Speech assistant | ✗ | ✗ | ✗ | ✓ | ✓ | ✓ |
| Keyword extraction | ✗ | ✗ | ✗ | ✓ | ✓ | ✓ |
| Image to text | ✗ | ✗ | ✗ | ✓ | ✓ | ✓ |
| Sentiment analysis | ✗ | ✗ | ✗ | ✓ | ✓ | ✓ |
| Activity log | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Transaction locking | ✗ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Custom user roles and access | ✗ | ✗ | ✓ | ✓ | ✓ | ✓ |
| Sales approval | ✗ | ✗ | ✓ | ✓ | ✓ | ✓ |
| Purchase approval | ✗ | ✗ | ✓ | ✓ | ✓ | ✓ |
| Timesheet approval | ✗ | ✗ | ✓ | ✓ | ✓ | ✓ |
| Custom approval workflows | ✗ | ✗ | ✗ | 25 | 70 | 70 |
| Timesheet approval - Customer | ✗ | ✗ | ✓ | ✓ | ✓ | ✓ |
| Digital Signature | ✗ | ✗ | ✓ | ✓ | ✓ | ✓ |
| Record locking | ✗ | ✗ | ✗ | ✓ | ✓ | ✓ |
| Validation rules | ✗ | ✗ | ✗ | ✓ | ✓ | ✓ |
| User access control tag | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ |
| Manage projects | ✗ | ✗ | ✓ | ✓ | ✓ | ✓ |
| Project expenses and invoices | ✗ | ✗ | ✓ | ✓ | ✓ | ✓ |
| Project tasks | ✗ | ✗ | ✓ | ✓ | ✓ | ✓ |
| Timesheet and billing | ✗ | ✗ | ✓ | ✓ | ✓ | ✓ |
| Timesheet approval | ✗ | ✗ | ✓ | ✓ | ✓ | ✓ |
| Timesheet approval - Customer | ✗ | ✗ | ✓ | ✓ | ✓ | ✓ |
| Retainer invoices for projects | ✗ | ✗ | ✓ | ✓ | ✓ | ✓ |
| Project budgeting | ✗ | ✗ | ✓ | ✓ | ✓ | ✓ |
| Project profitability | ✗ | ✗ | ✓ | ✓ | ✓ | ✓ |
| Invoice customization | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Email template customization | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Custom reports | ✗ | 10 | 25 | 50 | Unlimited | Unlimited |
| Custom views | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Custom fields | ✗ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Workflow rules | ✗ | ✗ | 10 | 200 | 200 | 200 |
| Custom approval workflows | ✗ | ✗ | ✗ | 25 | 70 | 70 |
| Validation rules | ✗ | ✗ | ✗ | ✓ | ✓ | ✓ |
| Related lists | ✗ | ✗ | ✗ | ✓ | ✓ | ✓ |
| WebTabs | ✗ | ✗ | ✗ | 10 | 10 | 10 |
| Custom modules | ✗ | ✗ | ✗ | 10 | 10 | 25 |
| Custom schedulers | ✗ | ✗ | ✗ | ✓ | ✓ | ✓ |
| Custom buttons and links | ✗ | ✗ | ✗ | ✓ | ✓ | ✓ |
| Custom domain | ✗ | ✗ | ✗ | ✓ | ✓ | ✓ |
| Blueprints | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ |
| **WORKFLOW RULES EXECUTIONS** | | | | | | |
| Email alerts | ✗ | ✗ | ✓ | ✓ | ✓ | ✓ |
| In-app notifications | ✗ | ✗ | ✓ | ✓ | ✓ | ✓ |
| Field updates | ✗ | ✗ | ✓ | ✓ | ✓ | ✓ |
| Custom functions | ✗ | ✗ | ✗ | ✓ | ✓ | ✓ |
| Webhooks | ✗ | ✗ | ✗ | ✓ | ✓ | ✓ |
| **DEVELOPER SPACE** | | | | | | |
| Connections | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| API Usage | 1,000 API requests/day | 2,000 API requests/day | 5,000 API requests/day | 10,000 API requests/day | 10,000 API requests/day | 10,000 API requests/day |
| Incoming Webhooks | ✗ | ✗ | ✗ | ✓ | ✓ | ✓ |
| Signals | ✗ | ✗ | ✗ | ✓ | ✓ | ✓ |
| Widgets | ✗ | ✗ | ✗ | 20 | 30 | 50 |
| **CUSTOM FIELDS** | | | | | | |
| String : Text box (Single-line), Email, URL, and Phone | ✗ | 20 | 20 | 50 | 50 | 50 |
| Numerical : Number, Date, and Date & Time | ✗ | 12 | 12 | 30 | 30 | 30 |
| Decimal : Decimal, Amount, and Percent | ✗ | 10 | 20 | 20 | 20 | 20 |
| Lookup | ✗ | 5 | 5 | 5 | 5 | 5 |
| Text box (Multi-line) | ✗ | 5 | 5 | 5 | 5 | 5 |
| Dropdown | ✗ | 10 | 25 | 25 | 25 | 25 |
| Attachment | ✗ | 4 | 10 | 10 | 10 | 10 |
| Boolean (Check Box) | ✗ | 10 | 20 | 20 | 20 | 20 |
| Multi-select | ✗ | 2 | 2 | 5 | 5 | 5 |
| Auto-generate number | ✗ | 1 | 1 | 1 | 1 | 1 |
| Formula | ✗ | ✗ | ✗ | 2 | 5 | 5 |
| Unique fields | ✗ | ✗ | ✗ | 4 | 4 | 4 |
| AI fields | ✗ | ✗ | ✗ | 2 | 2 | 2 |
| Multi-select Lookup | ✗ | ✗ | ✗ | 1 | 1 | 1 |
| **REPORTING TAGS** | | | | | | |
| Options | ✗ | 2,000 options/tag | 2,000 options/tag | 2,000 options/tag | 5,000 options/tag | 5,000 options/tag |
| Visibility Condition | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ |
| User access control tag | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ |
| Create folders | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Upload documents | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Document autoscans | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Attach files to transactions and contacts | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Auto forward receipts and bills | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Auto forward bank statements | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Customer portal | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Comments | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Contextual chats | ✗ | ✗ | ✓ | ✓ | ✓ | ✓ |
| Assign and track tasks | ✗ | ✗ | ✓ | ✓ | ✓ | ✓ |
| Vendor portal | ✗ | ✗ | ✗ | ✓ | ✓ | ✓ |
| Warehouse management | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ |
| Barcode generation and scanning | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ |
| Composite items | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ |
| Track serial numbers | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ |
| Batch tracking | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ |
| Print shipping label | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ |
| Track shipments | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ |
| Connect online sales channels (Etsy, Amazon) | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ |
| Connect shopify stores (Up to 2 stores) | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ |
| Track bin locations | ✗ | ✗ | ✗ | ✗ | 2,000 bins/location | 5,000 bins/location |
| 50+ Pre-built data visualization | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ |
| Add and track KPIs for your business | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ |
| Analyze along with other data sources (with Zoho Analytics add-on) | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ |
| Collaboratively create reports with colleagues | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ |
| Embed reports in web sites/applications | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ |
| Records/Rows (3 Million) | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ |
| **OTHER APPS** | | | | | | |
| Google Workspace | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Microsoft 365 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Slack | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Zapier | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Dropbox | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Google Drive | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Evernote | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| OneDrive | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Bharat Connect | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| WhatsApp | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Twilio | ✗ | ✗ | ✗ | ✓ | ✓ | ✓ |
| **PAYMENT GATEWAYS** | | | | | | |
| Zoho Payments | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Razorpay | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Stripe | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| PayPal | ✗ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Paytm | ✗ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Verifone (formerly 2Checkout) | ✗ | ✓ | ✓ | ✓ | ✓ | ✓ |
| **CONNECTED BANKING** | | | | | | |
| HSBC Bank | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Kotak Mahindra Bank | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Standard Chartered Bank | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| ICICI Bank | ✗ | ✓ | ✓ | ✓ | ✓ | ✓ |
| State Bank of India | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Axis Bank | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| **ZOHO APPS** | | | | | | |
| Zoho Payments | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Zoho Practice | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Zoho Payroll | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Zoho Inventory | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Zoho Expense | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Zoho Analytics | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Zoho CRM | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Zoho SalesIQ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Zoho Mail | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Zoho Desk | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Zoho Cliq | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Bigin | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Zoho Billing | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Zoho Campaigns | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Zoho Commerce | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Zoho POS | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Zoho People | ✗ | ✗ | ✓ | ✓ | ✓ | ✓ |
| Zoho Projects | ✗ | ✗ | ✓ | ✓ | ✓ | ✓ |
| Email | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Voice | ✗ | ✗ | ✓ | ✓ | ✓ | ✓ |
| Chat | ✗ | ✗ | ✗ | ✓ | ✓ | ✓ |

### 4.4 Books marketing pages (feature claims)
- **Mobile apps** (https://www.zoho.com/in/books/accounting-mobile-apps/): iOS & Android (4.8 App Store / 4.6 Play); estimates, invoices, recurring invoices; bills & expenses; bank feeds & matching; multi-currency; e-invoicing, e-way bills, audit trail; contacts with insights; client portal sharing; 50+ reports; push notifications (payments, approvals); **barcode scan & business-card scan**; **GPS mileage tracking → expense**; Apple: Apple Intelligence insights, voice-powered invoicing, Siri, iOS widgets, receipt/business-card scan & extract, Apple Watch app, resizable iPad. Windows desktop app also listed (https://www.zoho.com/in/books/windows-accounting-app/ — not crawled).
- **e-Invoicing** (https://www.zoho.com/in/books/e-invoicing/): mandatory for turnover ≥ ₹5 cr (from 1 Aug 2023); Zoho is a GSP (direct IRP upload, no third-party GSP); pre-validation of mandatory fields; recurring e-invoices (auto-charge + auto IRP upload + auto send); multiple GSTINs; REST APIs; IRP → GST portal auto-population; e-way bill via Zoho as GSP; 5-step setup (register on IRP, create API user for GSP "Zoho Corporation", enter credentials, push invoices, get IRN + signed QR). Plan matrix: e-Invoicing = Standard+.
- **Audit trail** (https://www.zoho.com/in/books/audit-trail/): logs every user/system action with timestamp & user; cannot be disabled (MCA mandate compliant); versioned history per customer/vendor/item/journal/settings; compare versions side-by-side; viewable on mobile by auditor. Activity log in all plans.
- **Feature overview page** fetched (https://www.zoho.com/in/books/accounting-software-features/) — content duplicates help-doc sections; see sections 5–7.


## 5. Zoho Books (India) — Sales, Inventory, e-Invoicing & Projects

Tag legend: [ZB] = documented in Zoho Books India help. "Books-only" = beyond the free Zoho Invoice product. Plan restrictions are noted only where the help text states them (many pages show an "Available Plans" widget whose contents were not captured).

### 5.1 Customers & Vendors (contacts)

- **New Customer/Vendor — Basic Information** [ZB]: Type (Business / Individual — customers only); Primary Contact; Company Name; Display Name (shown on transactions); Email (mandatory if portal access enabled); Phone.
- **Other Details tab** [ZB]: GST Treatment (e.g. Consumer for individuals); Place of Supply; PAN with **Validate** button (checks validity + PAN–Aadhaar link); Tax Preference (Taxable / Tax Exempt); Currency; Opening Balance; Payment Terms; Price List; Enable Portal checkbox; Portal Language; Documents (Upload File); Credit Limit (when enabled).
- **Multi-currency per customer** [ZB, plan-restricted]: "available only in certain Zoho Books plans" (pricing page).
- **Additional information** [ZB]: "Add more details" → Website URL, Department, Designation, Twitter ID, Skype Name/Number, Facebook ID.
- **Address** [ZB]: Billing + Shipping; "Copy billing address" link; Country/Region selector under Billing when GST enabled.
- **Contact Persons** [ZB]: "+ Add Contact Person", multiple per contact.
- **Custom Fields, Reporting Tags, Remarks (internal notes)** on contact form [ZB].
- **Contact search in transaction pickers** [ZB]: keyword match on Name, Customer/Vendor Number, Company Name; any word order; min 3 characters.
- **Record transaction from contact** [ZB]: Contact page → New Transaction dropdown → any sales/purchase transaction prefilled.
- **Import Customers/Vendors** [ZB]: choose Customers vs Customer's Contact Persons; CSV/TSV/XLS; 25 MB limit; sample file; Duplicate Handling = Skip Duplicates / Overwrite / Add Duplicates as New Customers (customers only); Character Encoding (default UTF-8); File Delimiter (default comma); Default Data Formats (number format 1234567.89, editable); field mapping with "Save these selections for future imports"; Preview tab before Import.
- **Export Customers/Vendors** [ZB]: export Customers/Vendors, Contact Persons, or Addresses; All vs Specific Period; CSV or XLS; "Include Sensitive PII" checkbox; optional password-protected export file.
- **Edit contact** [ZB].
- **Filter / views** [ZB]: All Customers dropdown with type filters; "+ New Custom View" with custom criteria (e.g. company name).
- **Multiple addresses** [ZB]: default billing + shipping; "Add Additional Address" (country + address); additional addresses selectable on transactions.
- **Additional GSTINs per address** [ZB, India]: Tax Information dropdown → Manage Tax Information → Add New Tax Information → enter GSTIN/UIN; Place of Supply auto-populated from GSTIN; address-level GSTIN applied when that address is chosen on a transaction; GSTIN/POS given at contact creation = primary tax information.
- **TDS certificates for vendors** [ZB, India]: Vendor → More → TDS Certificates → Add New; fields Certificate Number, Certificate Type, Start Date, End Date, Issue Date, Upload Certificate, TDS Tax (section + rate; enabled after End Date & Type chosen), Notes; edit / mark inactive / delete; feeds TDS Summary report; used for "Form 140" preparation (lower/nil deduction).
- **Merge contacts** [ZB]: More → Merge; pick primary/master; Confirm; also as bulk action.
- **Recent activities timeline** on contact page [ZB].
- **Mark as Inactive** [ZB].
- **Attach files to contact** [ZB].
- **Customer/Vendor Statement** [ZB]: Statement tab; choose period; PDF / print / email; "Attach unpaid invoices list" checkbox when emailing; excludes future-dated transactions and credits outside range.
- **Stop all Reminders / Enable all Reminders** per contact [ZB].
- **Mails tab** (all mail history with contact) and **Comments tab** (internal, not shown to customer) [ZB].
- **Bulk actions on customers** [ZB]: Mark as Inactive; Delete; Print Customer Statement; Send Customer Statement; Merge; works on custom-view filtered lists.
- **Customer info in PDFs** [ZB]: Settings → PDF Templates → Header tab → Organization Address Format / Customer Address Format with Insert Placeholders + free text.

#### Customer/Vendor preferences
- **Allow duplicates for contact display name** toggle [ZB].
- **Contact fields placeholder** for transaction PDF (Insert Placeholder dropdown, editable text) [ZB].
- **Custom Fields (data types), custom Buttons (Deluge script or external URL), Related Lists (app + third-party data)** for contacts module [ZB].
- **Multi-currency Transactions for Each Contact** toggle [ZB, Books-only]: invoice the same contact in several currencies; exchange rates auto-fetched (Open Exchange Rates) vs base currency, or disable feeds and enter manually; currency dropdown beside Customer Name on transactions; prerequisite = credit limits in base currency; custom views/workflows/webhooks must switch to "Receivables BCY / Payables BCY / Unused Credits BCY" fields; cannot be disabled once foreign-currency transactions exist.
  - Contact list shows receivables/payables/unused credits per currency; Details page shows a per-currency table; Statement breaks down by currency.
  - Payments recorded per currency; payment in a currency with no transactions → excess payment.
  - Reports get "Collapse All Currencies / Expand All Currencies": AR Aging Summary, AP Aging Summary, Customer Balances, Customer Balances Summary, Vendor Balances, Vendor Balances Summary, Purchase Orders by Vendors; Advanced Search filter by currency.

#### Customer Credit Limit [ZB, Books-only]
- **Enable Credit Limit** checkbox (Settings → Customers and Vendors → General) [ZB].
- **On breach action**: Restrict creating or updating invoices / Show a warning and allow users to proceed [ZB].
- **Include sales orders' amount in limiting credit** checkbox [ZB]: checked on SO create, update, Convert to Open, Convert to Invoice, Mail, Mark as Sent, and same bulk actions; also enforced in linked Zoho Inventory org and Zoho CRM; NOT checked on SO import, SO approval, packages/shipments.
- **Limit in base currency only** even for foreign-currency customers [ZB].
- **Set limit** on new customer (Other Details) or existing (Overview → Other Details → pencil) [ZB].
- **Breach pop-up** [ZB]: triggered when invoice total + balance due > limit; View Details (outstanding vs limit); Ok (cancel) or Proceed (warning mode); Update Credit Limit; Update and Save.
- **Recurring invoices still sent** when limit exceeded; email notification to org instead [ZB].
- **Credit limit shown in Customer Balances report** [ZB].

#### Customer Hierarchy [ZB, Books-only]
- **Enable toggle** (Settings → Customers and Vendors) [ZB]; only for Customer Type = Business.
- **Make This a Sub-Customer** toggle + parent dropdown on create/edit; "View Hierarchy" link [ZB].
- **Preference**: "Allow parent customers to view and pay this customer's transactions via the Customer Portal" [ZB]; toggle later on sub-customer Details → Hierarchy Detail.
- **Manage Customer Hierarchy** pop-up from More menu (assign/remove parent) [ZB].
- **Up to five levels** of hierarchy [ZB].
- **Import with Parent Customer column** [ZB].
- **List View / Tree View** layouts with Hierarchy icon [ZB].
- **Consolidated Overview** on parent: total receivables + unused credits incl. sub-customers; parent's unused credits applicable to sub-customer invoices [ZB].
- **Merge sub-customers** under the same parent [ZB].
- **Include Sub-Customers' Invoices** checkbox in parent's Transactions tab [ZB].
- **Statement filter** Included Transactions = This Customer / This Customer & Their Managed Sub-Customers; email/print/PDF/XLS [ZB].
- **Single payment across parent + subs** (Record Payment → "Include Sub-Customer's Invoices") [ZB]; portal Show dropdown (self / sub-customers / both) → Pay Now [ZB].
- **Hierarchy reports**: Sales by Customer, Customer Balances Summary [ZB].
- **Disable** only after no customer has a parent [ZB].

#### Opening balances
- **Ways to record** [ZB]: import with contacts; Opening Balances section (AR/AP import); new contact Other Details; existing contact Outstanding Receivables/Payables.
- **Outstanding Opening Balance** concept: reduced by payments not tied to invoices/bills [ZB].
- **View/Update Opening Balance** link under Receivables [ZB].
- **Write Off opening balance** [ZB]: Write Off Date + Reason; Cancel Write Off.
- **Branch-wise opening balances** [ZB]: Edit → + Add Branch → Branch Name + amount; per-branch Write Off / Cancel Write Off.

#### Link Customer and Vendor [ZB]
- **Link to Vendor / Link to Customer** (More menu) for a party that is both [ZB].
- **Consolidated net settlement**: record full invoice payment (Deposit To bank) and full bill payment (Paid Through same bank), then match net bank deposit feed with both (Include Withdrawals; + Create New Transaction for adjustment until Pending = 0); Unmatch from Matched Transactions [ZB]; not possible when bank, transaction and base currencies all differ.

Sources: https://www.zoho.com/in/books/help/contacts/ ; .../contacts/add-transaction.html ; .../contacts/associating-templates.html ; .../contacts/contact-preferences.html ; .../contacts/credit-limit.html ; .../contacts/customer-hierarchy.html ; .../contacts/link-customer-and-vendor.html ; .../contacts/opening-balances-for-customers.html ; .../contacts/other-actions.html

### 5.2 Cheque Printing (vendor payments) [ZB, Books-only]

- **Pay via Cheque** (Bill → Record Payment dropdown) — distinct from "Cheque" payment mode [ZB].
- **Cheque statuses** [ZB]: Draft; Pending Approval; Approved; Approval Rejected (approval states only if payment approvals enabled); To Be Printed; Uncleared; Cleared (matched to bank feed); Void.
- **Save and Print Now / Save and Print Later** [ZB]; later → To Be Printed list.
- **Print confirmation** [ZB]: "Not yet printed, keep in to-be-printed list" vs "Yes, cheque printed correctly" + review auto-sequential Cheque Number (editable); → Uncleared.
- **Cheque number uniqueness** [ZB]: number usable once; void cheque numbers not reusable.
- **Pay Bill via Cheque** (single cheque for many bills of a vendor) [ZB]: fields Payment Made, Payment Date, Bank account; amount per bill.
- **Bulk print cheques** [ZB]: To Be Printed Cheques filter; max 100 per run; preview; select correctly printed ones + cheque numbers; unselected stay To Be Printed; individual reprint allowed.
- **Clear cheque** by matching bank feed (or manual bank account reconciliation) [ZB].
- **Void cheque** [ZB]: only Uncleared cheques; unassociates from bill.
- **Cheque filters** [ZB]: To Be Printed, Uncleared, Cleared, Void, Paid via Cheque (all non-void).
- **Customise Cheque** [ZB]: per-field position values, Preview, **Tamper proof** option per field; also via Settings → PDF Templates → Cheques.
- **Export cheque as PDF** (single only, no bulk) [ZB].

Source: https://www.zoho.com/in/books/help/cheque/

### 5.3 Credit Notes

- **Create credit note** [ZB]: Sales → Credit Notes → + New (shortcut c + n); customer + items; Save as Draft / Save as Open.
- **Dispatch From address on CN PDF** when e-Invoicing enabled [ZB, India].
- **Convert to Open** (Draft → Open so it hits sales reports) [ZB].
- **Create from invoice** (Invoice → More → Create Credit Note; prefilled) [ZB].
- **Import credit notes** [ZB]: CSV/TSV/XLS; sample CSV/XLS; "Auto-generate Credit Note Number" checkbox; field mapping + save selections.
- **Apply credits to invoices** [ZB]: from CN (Apply to Invoice popup listing invoices across all locations for that customer; CREDITS TO APPLY per invoice) or from Invoice (Credits Available arrow → Apply Credits); partial or full, multiple invoices.
- **CN status Open/Closed** by remaining credit [ZB]; statuses filterable via All Credit Notes dropdown.
- **Credit Applied Invoices tab** with Remove icon to un-apply [ZB].
- **Refund** [ZB]: More → Refund; full or partial amount; Refund History tab with Edit/Delete; Import Refunds (CSV/TSV/XLS, mapping).
- **Delete** blocked while credits applied or refunds exist [ZB].
- **Edit** [ZB].
- **Insert header rows in item table** (Insert New Header / + New Row → New Header; multiple; removing header keeps items) [ZB].
- **Insert subtotal rows** [ZB]: auto-calculated since previous subtotal; stated as supported only in Global, Canada, US editions (i.e. not India).
- **Download PDF / Print (preview)** [ZB].
- **Void** with reason; **Convert to Draft** (unvoid, reason required) then Convert to Open [ZB].
- **Attachments**: up to 5 files × 5 MB; Drag & Drop or from Documents; Download / Delete (permanent) / Remove (keeps in Documents) [ZB].
- **Custom Views** and **Export** (CSV, XLSX, XLS) [ZB].
- **Preferences** [ZB]: default Terms & Conditions; default Customer Notes; Approvals (No Approval / Simple / Multi-Level / Custom); custom Fields; Validation Rules; Record Locking (lock after a status); Buttons (Deluge/URL); Related Lists.

Sources: https://www.zoho.com/in/books/help/credit-note/ ; .../credit-note/apply-credits.html ; .../credit-note/delete-cn.html ; .../credit-note/other-actions.html ; .../credit-note/preferences.html ; .../credit-note/refund-credits.html

### 5.4 Customer Portal

- **Portal on by default per org**; access configured per contact person; requires email [ZB].
- **Enable access** 3 ways: More → Configure Customer Portal; Portal Status gear (Other Details); "Invite to Portal" link; select customer/contact persons; invitation email (customisable); Reinvite [ZB].
- **Customer sign-up**: Accept Invitation → set password [ZB].
- **Portal Home dashboard** [ZB]: Outstanding Invoices (Pay Now for all); Available Credits; Outstanding Retainer Invoices; Available Retainer Payments; Last Payment Made; Quotes awaiting approval count; Timesheets awaiting approval count; account details, contact persons, org contact details.
- **Quotes in portal** [ZB]: list + filter; Accept / Decline; comment negotiation (org side "Display in portal" checkbox on comments); resubmit edited quote; e-sign via Zoho Sign integration; notifications on view/accept/decline.
- **Invoices in portal** [ZB]: list invoices + retainer invoices, filter/sort; Pay Now (needs gateway linked on invoice); partial payment only if allowed on that invoice; first-view notification.
- **Card payments** (card no, CVV, expiry, billing address, country; save card) [ZB].
- **ACH payments** (customer flag "Allow this customer to pay via their bank account"; "Use this account for future transactions") [ZB].
- **Payments Made section** [ZB]: online + offline payments; filter invoice payments; sort by Date/Amount; receipt view, Download PDF/Print.
- **Sales Orders in portal** [ZB, Books-only]: requires preference; view SO + linked invoice; first-view notification.
- **Projects & Timesheets in portal** [ZB, Books-only]: requires preference; Tasks with Logged/Billed/Unbilled Hours; billable Time Entries with billing status; project Comments synced; Timesheet approvals Approve / Reject with reason, filter by status.
- **Statement of Accounts** self-service (Date Range → Go; PDF/Print) [ZB].
- **Share documents** [ZB]: quotes, invoices, SOs printable/PDF/forward; forwarded recipient auto-added as contact person.
- **Viewed icon** on quotes/invoices + email notifications on accept/decline, comment, payment, detail update [ZB].
- **Customer self-service details** [ZB]: Update Account Details (syncs to Books); Edit Card Details; Change Password.
- **Send Email to business, Write Review** (appears under Customer Reviews on contact Overview), Logout [ZB].
- **Disable portal per customer** via Configure Portal Access [ZB].
- **Portal payment error codes** [ZB]: CP1003 deleted contact; CP1004 deleted recurring profile; CP2001 no default tax; CP3001 reference transactions not enabled; CP3002 invalid gateway credentials; CP3003 fraud filter decline; CP3004 address verification failure (Card Verification Settings); CP3005 duplicate txn within minutes; CP4001 below gateway minimum; CP4002 gateway lacks recurring support; CP4003 gateway lacks currency.

#### Portal preferences
- **Portal Name** (auto-generated, editable; used in URL); custom domain mapping [ZB].
- **Toggles** [ZB]: email me on every portal activity; email customer when I comment; allow customer to edit their info (personal, addresses, cards); allow forwarding documents; enable customer reviews; allow customers to view Sales Orders; allow customers to view projects and timesheets.
- **Banner Message** on portal home [ZB].
- **Web Tabs** [ZB]: + New Web Tab (name + embed URL with Insert Placeholders); optional JWT Authentication (Secret Key, Token Validity); appear in portal sidebar.
- **Secure Public Links** [ZB]: "Enable identity verification to view invoices and estimates" — recipient verifies email or mobile before viewing/downloading invoices, quotes, retainer invoices shared via email/SMS/WhatsApp links; payment and quote accept/reject still possible without verification.
- **Multi-Factor Authentication** [ZB]: "Enable MFA" checkbox applies to both customer and vendor portals; TOTP via authenticator app (OneAuth, Google Authenticator), QR or manual code; Reset Portal MFA per contact (gear next to email); disabling preference doesn't remove already-configured MFA (must reset).

Sources: https://www.zoho.com/in/books/help/customer-portal/ ; .../customer-portal/preferences.html ; .../customer-portal/multi-factor-authentication.html

### 5.5 Delivery Challans [ZB, Books-only, India]

- **Purpose** [ZB]: goods moved without (or before) sale — quantity unknown at dispatch (e.g. liquid gas); transfers between warehouses (Transfer Order needs Zoho Inventory add-on); job work; semi-assembled/parts shipments.
- **Enable module** (Settings → General → Delivery Challans checkbox) [ZB].
- **Create fields** [ZB]: Customer Name; Place of Supply (auto from customer GSTIN); Delivery Challan# (auto series, gear to change series or enter manually); Reference#; Delivery Challan Date; Challan Type (purpose dropdown); items; Customer Notes; Terms & Conditions; Save as Draft.
- **Statuses** [ZB]: Draft; Open (dispatched, via Convert to Open); Delivered; Returned; Partially Invoiced.
- **Mark as Delivered** [ZB].
- **Convert to Invoice** (full or for sold items only → Partially Invoiced); Invoices link on DC [ZB].
- **Mark as Returned** (irreversible); Returned Items tab [ZB].
- **Record Partial Returns** (select items + qty; only one return per DC; Undo Partial Returns to redo) [ZB].
- **Add e-Way Bill Details** [ZB]: Create a New e-Way Bill or Associate e-Way Bill Number; editable afterwards.
- **Edit / Clone / Delete (irreversible)** [ZB].
- **PDF / Print with number of copies** [ZB].
- **Attachments**: max 5 files × 10 MB; Desktop, Documents, Cloud (WorkDrive, Google Drive, Dropbox, OneDrive) [ZB].
- **Comments & History** [ZB].
- **Filter by status; Sort by column asc/desc; Refresh List** [ZB].
- **Template customisation** (Customize dropdown on PDF) [ZB].
- **Preferences** [ZB]: default T&C; default Customer Notes; custom Fields; Validation Rules; Buttons (Deluge).

Sources: https://www.zoho.com/in/books/help/delivery-challan/ ; .../delivery-challan/basic-functions.html ; .../delivery-challan/functions.html ; .../delivery-challan/manage-delivery-challans.html ; .../delivery-challan/other-actions.html ; .../delivery-challan/preferences.html

### 5.6 Digital Signature (DSC) [ZB, India, plan-restricted]

- **Availability** [ZB]: Zoho Books Windows app (India edition) only; "only for certain plans in the Indian edition"; needs USB token with DSC.
- **Enable (web)** [ZB]: Settings → Digital Signature → Enable Signature; User Signature checkboxes for Invoices, Quotes, Credit Notes, Purchase Orders; "Allow users to skip signature for sending Quotes/Invoices/Purchase Orders".
- **Enable (Windows app)** [ZB]: Settings → Signature toggle; "Make digital signatures mandatory for all transactions"; Entities Supported; Signature Format placeholders.
- **Sign** [ZB]: Sign Invoice (What's Next banner) or More → Sign; "Sign with certificate" popup lists connected token (Refresh); status Signed; signature at bottom of PDF.
- **Rules** [ZB]: approvals must complete before signing; must sign before sending (unless skip allowed); signed version PDF-only; edit requires re-sign (portal auto-updates).

Source: https://www.zoho.com/in/books/help/digital-signature/

### 5.7 e-Invoicing (IRN / QR via IRP) [ZB, Books-only, India]

- **Mandate context** [ZB]: mandatory from 1 Aug 2023 for aggregate turnover ≥ ₹5 crore; Zoho is a registered GSP; B2B invoices reported in common machine-readable schema.
- **Prerequisite**: GST configured in org [ZB].
- **IRP registration** (on portal) [ZB]: GSTIN + captcha → auto Trade Name/Address → OTP to GST-registered mobile → Username (6–15 chars) + Password; EWB portal credentials reusable for IRP.
- **Enable e-Invoicing** (Settings → Taxes & Compliance → e-Invoicing → Enable) [ZB].
- **Connect with IRP** [ZB]: auto-uses e-Way Bill portal credentials if already connected; else on IRP: API Registration → Create API User → Through GSP → Zoho Corporation → username/password; then Books → Connect Now → Save & Validate.
- **Per-location IRP connection** [ZB]: with Locations (formerly Branches) each with own GSTIN, Connect Now per location; IRN generated against location GSTIN.
- **Role permission** "Push and Cancel Transactions" under e-Invoicing in Roles; on by default for Admins [ZB].
- **Documents pushed** [ZB]: Invoices, Credit Notes, Debit Notes.
- **e-Invoice statuses** [ZB]: Yet-to-be Pushed; Push Initiated (bulk); Pushed (IRN + QR); Manually Pushed (IRN associated manually); Failed; Cancelled (in Books and IRP); Marked as Cancelled (Books only, cancel on GST portal).
- **Mandatory schema fields** [ZB]: Seller — Legal Name (100), GSTIN (15 alnum), Address (100), Place (50), State Code (enum), Pincode (6); Dispatch From name/address/place/pincode (if differs from seller); Buyer — Legal Name, GSTIN, Address, State Code, Place of Supply State Code, Pincode, Place; Ship-To GSTIN/state/pincode/code (if differs from buyer); Document Type Code (INV/CRN/DBN); Document Number (max 16, e.g. "Sa/1/2019"); Document Date (DD/MM/YYYY); Total Invoice Value (11,2); Preceding Invoice Reference + date (16); IRN (64); Supply Type Code; Items — Description (300), HSN (8), Item Price (12,3), Assessable Value (13,2), GST Rate (3,2), IGST/CGST/SGST values separately (11,2), Is_Service Y/N; addresses need Street1, City, Zip, State.
- **Push to IRP** button [ZB]: must succeed before sending invoice to customer; approvals (incl. final multi-level approver) must complete first.
- **Back-dated e-invoices** allowed, but turnover > ₹10 crore must push within 30 days of document date else non-compliant [ZB].
- **Push options with e-Way Bill** [ZB]: Push only Invoice Details / Push Both Invoice & e-Way Bill Details (preview or prompt to enter EWB details).
- **Copy IRN** button above preview [ZB].
- **Lock after push**: mandatory fields not editable once IRN generated [ZB].
- **Filter** All Invoices → Pushed for e-Invoicing / Yet-to-be pushed for e-Invoicing [ZB].
- **Bulk Push to IRP** (More → Push to IRP); failures notified + error summary emailed to initiating user [ZB].
- **Bulk Export as JSON for E-Invoicing** (upload to IRP manually) [ZB].
- **Associate IRN Details** (invoices, CNs, DNs) [ZB]:
  - Fetch IRN — needs Online Filing Settings enabled in GST Settings; details (IRN, Ack No/Date, QR, status, EWB) available on GST portal only ~24 h after push; GST portal session re-auth via Generate OTP → Verify OTP; only for transactions pushed within past 6 months.
  - Associate IRN Manually — IRN, Acknowledgement Number, Acknowledgement Date → status Manually Pushed.
- **Delete IRN Details** (wrongly associated) → back to Yet to be Pushed [ZB].
- **IRN on PDF** [ZB]: template Other Details/Footer → e-Invoicing Details checkboxes QR Code, IRN, Ack No, Ack Date (bottom of PDF); header placeholders %IRN%, %EInvoiceQRSrc%, %EInvoiceQRImg%, %EInvoiceAckDt%, %EInvoiceAckNum% to reposition.
- **Cancel e-Invoice** [ZB]: within 24 h — Cancel e-Invoice button with Reason for Cancellation + Remarks (auto-cancels on IRP); after 24 h — Mark as Cancelled with reason, then cancel IRN manually on GST portal (E-invoices → Cancel → IRN, reason, remarks); invoice becomes Void; clone to re-issue; same invoice number cannot be reused.
- **Setting: Override Transaction Type of E-Way Bills generated by the IRP** (e.g. force Regular / Dispatch From–Ship To instead of Bill To–Ship To) [ZB].
- **Setting: Enable editing optional fields in pushed transactions** (internal only, not sent to IRP) [ZB]: Invoices & Debit Notes — Order Number, Due Date, Customer Notes, Additional Info, Custom Fields, T&C; Credit Notes — Reference, Customer Notes, Additional Info, Custom Fields, T&C.
- **Setting: Configure optional fields for e-invoice push** — exclude chosen optional fields (avoid length errors) [ZB].
- **Recurring invoice interplay** [ZB]: Create as Drafts (manual push) / Create, Push and Send (send only if push OK; failure email to org) / Create, Charge, Push and Send (charge first; on push failure only thank-you mail); varies with approvals / digital signature.
- **Quote auto-convert interplay** [ZB]: Create Invoice as Draft / Create, Push and Send.
- **Sandbox testing** [ZB]: e-invoice sandbox for turnover > ₹5 crore (from 28 Jul 2022); registration categories Through GSP / ERP / Direct API (turnover > ₹100 crore) / Direct API Access Users / existing E-Way Bill API users; create temporary test org (Clone Settings option; 14-day trial, extendable via support); email support to enable sandbox; sandbox registration form (User Type Tax Payer, GSTIN, Trade Name auto, GST mobile, email, captcha, OTP) then Create Account (Registration through GSP, Company Zoho Corporation, Client ID given, username/password).
- **Support contact** einvoicing-support@zohofinance.com [ZB].

Sources: https://www.zoho.com/in/books/help/e-invoicing/ ; .../e-invoicing/register-on-irp.html ; .../e-invoicing/set-up.html ; .../e-invoicing/functions-einvoice.html ; .../e-invoicing/einvoicing-sandbox.html

### 5.8 e-Way Bills [ZB, Books-only, India]

- **Supported source documents** [ZB]: invoices, bills of supply, credit notes, delivery challans; CN-based EWB (sales return) saved with Document Type Delivery Challan.
- **Part A / Part B** concept [ZB]: Part A consignor/consignee/supply type/items; Part B transport (vehicle, distance); transporter fills Part B when outsourced; consignee/transporter/courier/e-commerce operator may be authorised to fill Part A; ≤ 50 km → Part A only.
- **Rules captured** [ZB]: required above state threshold; inter-state job work any value; handicrafts any value; not required < ₹50,000, non-motorised, customs-cleared departures (port/airport), exempted goods; transport doc must carry EWB number.
- **Enable module** (Settings → Taxes & Compliance → e-Way Bills → Enable) [ZB].
- **GSP registration on EWB portal** [ZB]: Registration → For GSP → OTP → Add/New → GSP Name Zoho Corporation → Suffix ID, password, user name; one-time.
- **Connect Now** with GSTIN, Username, Password → Save & Validate [ZB].
- **Configure Threshold per GSTIN** for intra-state value (e.g. Maharashtra ₹1,00,000, Sikkim ₹50,000; inter-state ₹50,000 per CGST) [ZB]; transactions above threshold appear as Not Generated.
- **e-Way Bill list filters** [ZB]: Location; Transaction Period; Transaction Type; e-Way Bill Status.
- **Generate form** [ZB]: Document Type (Invoice / Credit Note / Delivery Challan); Transaction Sub Type (Supply, Export, Job Work…); Location; Customer Name; Transaction Number; Transaction Type; Place of Delivery.
- **Transportation Details** [ZB]: Transporter (Manage Transporters → + Add New: Name + Transporter ID); Distance in km (0 = auto-calc by EWB system; Calculate Distance link to portal using pin codes).
- **Part B fields** [ZB]: Mode (Road / Rail / Air / Ship); Vehicle Type (Regular / Over Dimensional Cargo); Vehicle No; Transporter's Doc No & Date (road); RR No & Date (rail); Airway Bill No & Date (air); Bill of Lading No & Date (ship).
- **Save (draft) / Save and Generate**; validity auto-updated [ZB].
- **+ New e-Way Bill** directly from module [ZB].
- **180-day rule**: from 1 Jan 2025, no EWB/Part-A generation or update for invoices older than 180 days (also Part-B update/consolidation) [ZB].
- **Statuses** [ZB]: Not Generated; Generated; Part A Generated; Cancelled; Expired; Excluded; Manually Generated.
- **Associate e-Way Bill Number** (generated on portal; no spaces) then **Fetch From Portal** to sync details [ZB].
- **Edit e-Way Bill Number** for manually generated ones (blocked once fetched) [ZB].
- **Cancel** within 24 h (not if verified by authorities): Reason + Remarks [ZB].
- **Regenerate** cancelled EWB (edit then Save/Save and Generate) [ZB].
- **Extend Validity** [ZB]: for Generated/Expired within 8 h before/after expiry; Consignment Type In Transit (Transit Type) / In Movement (Mode + Vehicle No); Current Place, Pincode, State; Approx Distance (0 = auto); Extend Reason; cap 360 days from generation (from 1 Jan 2025).
- **Add / change Transporter** for Generated & Part-A Generated [ZB].
- **+ Add vehicle** in Part B (transshipment / transporter change) [ZB].
- **Multi-Vehicle Group** [ZB]: Initiate Multi-Vehicle Group — Mode (Road/Rail/Air/Ship), From Place, From State, To Place, Total Quantity, Reason, Remarks; multiple groups allowed; + New Vehicle with Vehicle No, Transporter's Doc No/Date, Quantity; up to 5 vehicles at a time per group; Update creates new record and marks old as Cancelled.
- **Exclude / Restore** transactions (single or bulk) — e.g. no movement or delayed delivery [ZB].
- **Print / Download** [ZB]: Simple or Detailed format; "Include the associated invoice in the e-Way Bill PDF"; PDF carries QR code; print for Generated/Part-A/Cancelled/Expired, download for Generated.
- **Attach e-Way Bill PDF** option when emailing invoice/CN [ZB].
- **e-Way Bill Number on PDF templates** (Document Details checkbox; mandatory on invoices/CNs/DCs) [ZB].
- **Bulk via portal** [ZB]: Export as JSON (invoices, CNs, DCs) → portal Generate Bulk; or Export as E-Way Bill Excel (invoices, CNs only; not DCs) → EWB offline tool Validate → Prepare JSON → upload; mandatory: Pin Code, Place of Supply, Distance, Vehicle No (or Transporter Doc No/Date), Mode, Supply Type, HSN for goods, Organisation Address.
- **e-Way Bills for Gold** [ZB]: HSN Chapter 71 except 7117; per-GSTIN "Enable e-Way Bill generation for gold items" + intra-state gold Threshold (₹2 lakh or state limit); no Part-B; validity extendable; no multi-vehicle; blocked if transaction mixes non-permitted HSNs.

Sources: https://www.zoho.com/in/books/help/e-way-bill/ ; .../e-way-bill/generate-eway-bills/generate-ewb.html ; .../e-way-bill/generate-eway-bills/generate-ewb-gold.html ; .../e-way-bill/functions.html ; .../e-way-bill/multiple-vehicles.html ; .../e-way-bill/other-actions.html

### 5.9 Invoices

- **Invoice types** [ZB]: Regular; Recurring; Retainer (advance) — plus Bill of Supply variant (India).
- **Lifecycle** [ZB]: Draft → Sent → Overdue (past due) → Partially Paid / Paid; Void; written off; Signed (DSC); e-invoice statuses (see 5.7).
- **New Invoice fields** [ZB]: Customer Name; Invoice# (transaction series dropdown; gear to toggle auto-numbering); Order Number; Invoice Date; Terms; Due Date; Salesperson; Select Price List.
- **Item table** [ZB]: Quantity (shows available qty when inventory tracked); Rate (auto from item; "Apply Price List" link per line); Tax (auto from item/customer tax status); Discount (% or amount); + Add New Row; Add Items in Bulk; Insert New Header rows; Bulk Actions → Bulk Update Line Items (Project / Account per line) or Show Additional Information (project + account columns).
- **Totals area** [ZB]: Shipping Charges (+ Apply Tax on Shipping Charge); Adjustment (negative allowed); Customer Notes; Terms and Conditions; Upload File.
- **"I have received the payment"** checkbox [ZB]: Payment Method + Deposit Account; + Add Split Payment (multiple methods); saved as Paid; requires Sales Approval disabled.
- **Save as Draft / Save and Send / Save and Send Later** (Schedule Mail date) [ZB].
- **Quick Create** from Home [ZB].
- **Import invoices** [ZB]: CSV/TSV/XLS ≤ 10 MB; Character Encoding; Delimiter; Auto-generate Invoice Numbers (ignores file numbers); "Link Invoices to corresponding Sales Orders" (map SO Number); "Map customers' addresses to customer record" (updates address or creates customer); date format per field; decimal format 1234567.89; save mapping; preview.
- **Send** via Mail / SMS dropdown; Snail Mail (needs purchased credits) [ZB].
- **Mark as Sent** (enables payment recording; visible in portal) [ZB].
- **Share invoice link** [ZB]: requires Sent status; Visibility = Public / Private and Secure (portal only); Link Expiration Date (default 90 days); Generate Link → Copy Link; Secure Link Sharing — customer verifies email/phone to see full invoice, otherwise only Accept / Decline / Pay Now.
- **Public link customer actions** [ZB]: Accept; Decline; Pay Now; View Invoice → Verify your identity.
- **Print** (PDF/Print → preview) [ZB].
- **Additional charges preference** (Settings → General): Shipping Charges and/or Adjustments checkboxes; not shown on Retainer Invoices / Payments Received [ZB].
- **Discount preference** (Settings → General "Do you give discounts?"): At line item level / At invoice level / I don't give discounts [ZB].
- **Clone** [ZB].
- **Attachments**: up to 5 files × 5 MB; Drag & Drop, Cloud, Documents; Download/Delete/Remove [ZB].
- **Void** with reason; Convert to Draft with reason to reactivate [ZB].
- **Delete** (payments must be deleted first; irreversible) [ZB].
- **Write Off** [ZB]: Record Payment → Write Off with reason → Bad Debt account; Cancel Write Off.
- **Export invoices** [ZB]: Select Status; Date Range; Fields in Export File (export templates, + Add New); CSV/XLS/XLSX; Include PII (address, email, phone, bank acct, sensitive custom fields); password.
- **Bulk Update** a chosen field across selected invoices [ZB].
- **Bulk download** as single multi-page PDF or ZIP of individual PDFs [ZB].
- **Export/SEZ endorsement** [ZB, India]: Rule 46(q) CGST — "Show Export/SEZ Endorsement" in template (Tax & E-way Bill Details) prints with/without payment of IGST for overseas/SEZ unit/SEZ developer supplies; only Spreadsheet and Standard templates.
- **Also available from invoice** [ZB]: set as recurring; create credit note; view journal entries.
- **Invoice preferences** [ZB]: include payment stub + return envelope in snail mail; show Primary Contact in "Remit to"; Allow editing of Sent invoice; Associate and display expense receipts in invoice PDF; Invoice Order Number = Use Sales Order Number / Use Sales Order Reference Number; notify when customers pay online; include payment receipt with Thank You note; auto thank-you note on online payment; Approvals (+ Convert to Draft of approved invoice with reason); custom Fields; Buttons (Deluge).
- **Delivery Note Settings** [ZB]: delivery note created from invoice; rename / show-hide fields on printed note.
- **Packing Slip Settings** [ZB]: packing slip from invoice; rename / show-hide fields.
- **Payment error codes** CP1003, CP3001–CP3005, CP4001, CP4003 (same meanings as portal list) [ZB].

#### Bill of Supply [ZB, India]
- **Use** [ZB]: issued instead of tax invoice by Composition-scheme dealers and sellers of exempt goods (e.g. fruit vendor); no GST charged.
- **Enable** (Settings → General → Bill of Supply checkbox) [ZB].
- **Create** via dropdown next to + New → New Bill of Supply [ZB].
- **GST return mapping** [ZB]: regular — GSTR-1 Table 8, GSTR-3 Table 3, GSTR-9 Table 6; composition — GSTR-4 Table 8, GSTR-9A Table 6; non-resident foreigners — GSTR-5 Table 7; e-commerce operators — GSTR-8 Tables 4 & 5; cancellation — GSTR-10.
- **e-Way Bill** can be raised against a bill of supply (see 5.8) [ZB].

#### Record payment on invoice
- **Online payment via gateway** [ZB]: gateway auto set as payment mode; choose gateway(s) in section below T&C on invoice edit; if more than two chosen, last-integrated gateway used; pay via portal, email, or link.
- **Charge Customer (card on file)** [ZB]: Record Payment → Charge Customer; Amount + Gateway; supported Authorize.net, PayPal Payflow Pro, PayPal Payments Pro, Razorpay, Paytm; needs consent.
- **Record Offline Payment** [ZB]: Amount Received, Payment Date, Deposit To; less than full → Partially Paid.
- **TDS-only receipt** [ZB, India/Global]: Amount Received 0; Tax Deducted? = Yes, TDS (Income Tax); Amount Withheld; TDS Tax Account; Save as Paid → Partially Paid.
- **Payments Received tab on invoice**: view / edit (pencil) / delete [ZB].
- **Payments Received custom fields** [ZB]: Label, Data Type, Is this PII? (storage method), Is Mandatory, Show in all PDF.

Sources: https://www.zoho.com/in/books/help/invoice/ ; .../invoice/bill-of-supply.html ; .../invoice/delete-invoice.html ; .../invoice/invoice-preferences.html ; .../invoice/other-actions.html ; .../invoice/payments-received.html ; .../invoice/record-payment-for-invoice.html ; .../invoice/troubleshooting.html

### 5.10 Items, Inventory & Price Lists

- **New Item** [ZB]: Type (goods/service), Name; Sales Information — Rate, Account, Description; Purchase Information — Rate, Account (COGS), Description.
- **Default Tax Rates** per item [ZB, India]: Intra State Tax Rate and Inter State Tax Rate (GST), overridable on transactions.
- **Track Inventory for this item** [ZB, Books-only]: Inventory Account (default Inventory Asset); Opening Stock qty; Opening Stock rate per unit; Reorder Point; Preferred Vendor.
- **Stock auto-adjusts** from invoices (−) and bills (+) [ZB].
- **Reporting tags on items** [ZB].
- **Import items** [ZB]: CSV/TSV/XLS ≤ 1 MB; Skip or Overwrite with unique key Item Name / Item ID / SKU (case-sensitive); encoding; delimiter; mapping saved; preview.
- **Edit** (does not change past transactions); **Clone Item**; **Mark as Inactive/Active**; **Delete** only after all its transactions deleted (check Sales by Item / Purchases by Item) [ZB].
- **Customize Columns** on list [ZB]: choose (e.g. Alias Name, Available for Sale), drag reorder, pin up to 2 columns, Wrap Text / Clip Text.
- **Export items** [ZB]: export template; CSV/XLS/XLSX; PII; password.
- **HSN/SAC** [ZB, India]: enable "HSN Code or SAC field"; mandatory since 1 Apr 2021 — turnover < ₹5 cr: 4-digit, mandatory for B2B/SEZ/Export/Deemed Export, optional B2C; > ₹5 cr: 6-digit for all tax invoices; prompt to enter if missing on transaction.
- **Validate HSN/SAC in bulk** (lists items with incorrect/missing codes; pick correct) [ZB].
- **HSN/SAC Update History** log [ZB].
- **Item preferences** [ZB]: decimal places for quantity (default 2); Allow duplicate item names (requires SKU active + mandatory; SKU becomes import key); HSN/SAC toggle; Out of stock warning (bell notification on negative stock); Reorder Point notification; custom Fields; Record Locking; Buttons; Related Lists.

#### Inventory adjustments [ZB, Books-only]
- **Quantity Adjustment** (damage, free goods) and **Value Adjustment** (revaluation up/down) [ZB].
- **Fields**: Account to track adjustment; Reason [ZB].
- **Statuses** Draft/Pending Approval/Adjusted; approval flow optional [ZB].
- **Bulk actions** (max 25 at a time): Submit for Approval; Approve (approvers only); Convert to Adjusted [ZB].
- **Delete** [ZB].
- **Export** [ZB]: All vs Specific period; filter by Date or Last Modified Time; export template; Decimal Format; CSV/XLS/XLSX; File Protection Password; additional fields Batch Numbers (batch ID, reference, manufacturer batch no, mfg date, expiry date, selling price, MRP, qty), Serial Numbers, Bin Locations (bin name + qty); limit 25,000 rows per export.

#### Zoho Inventory add-on inside Books [ZB, plan-restricted]
- **Prerequisite**: paid Zoho Inventory org; "available only in certain plans of Zoho Books"; Settings → General → "Enable Zoho Inventory modules in Zoho Books" [ZB].
- **Base Books inventory** = stock tracking, preferred vendors, reorder points, adjustments [ZB].
- **Composite Items** [ZB]: Assemblies (physically combined) and Kits (bundle, custom kit price); component stock tracked.
- **Packages** [ZB]: from confirmed SO, package slip number; statuses Not Shipped / Shipped / Delivered (manual mark for manual shipment).
- **Picklists** (warehouse picker list; Generate Picklist) [ZB].
- **Shipments** (multiple carriers; rates, ship, track) [ZB].
- **Purchase Receives** (full/partial vs PO; Save as Draft / Save as Received) [ZB].
- **Purchase Returns** (reduces stock and payable) [ZB].
- **Sales Returns** (from SO → Create → Sales Return; credit/cash/replacement) [ZB].
- **Transfer Orders** between warehouse locations [ZB].
- **Replenishments** [ZB]: toggle; frequency Days/Weeks/Months; Schedule at time; include Yet to Receive and In Transit stock; Pending Replenishments → create PO or Transfer Order.

#### Price Lists [ZB, Books-only]
- **Enable** [ZB]: "Enable Price Lists" or "Enable the option to select a price list at the line item level".
- **Create** [ZB]: Name; Type = Sales / Purchases; Item Rate = Markup or Markdown by % / Enter the rate individually per item (Custom Price).
- **Apply** on sales and purchase transactions; assign default price list to a contact (auto-applied) [ZB].
- **Billable items** [ZB]: only affected when line-level price lists enabled; existing markup removed then price list applied.
- **Mark Inactive / Active; Delete** (past transactions unaffected) [ZB].
- **Import** Sales / Purchase price lists (CSV/TSV/XLS ≤ 1 MB) and **Export** (CSV/XLS) [ZB].

#### Item reports (inventory-tracked items) [ZB]
- **Sales by Item**: qty sold, total, average selling price [ZB].
- **Purchases by Item**: qty purchased, total, average purchase price [ZB].
- **Inventory Summary**: Quantity Ordered (bills/POs); Committed Stock (delivery challans/SOs); Stock on Hand [ZB].
- **Inventory Valuation**: stock in hand + value [ZB].
- **FIFO Cost Lot Tracking**: Product In (purchase lots) vs Product Out (sales from same lot); FIFO costing; batch-wise profit/loss [ZB].

Sources: https://www.zoho.com/in/books/help/items/ ; .../items/advanced-inventory.html ; .../items/hsn-sac-code.html ; .../items/item-adjustments.html ; .../items/item-preferences.html ; .../items/other-actions.html ; .../items/price-list.html ; .../items/reports-for-items.html

### 5.11 Online Payment Gateways (customer collections)

- **Supported list (India help)** [ZB]: Zoho Payments, Razorpay, Paytm, ICICI Bank eazypay, PayPal, Verifone, Stripe (collections); ICICI Bank, SBI, Yes Bank, Kotak Mahindra, Standard Chartered, HSBC, Axis (connected banking / vendor payouts).
- **Settings split** [ZB]: Settings → Online Payments → Customer Payments (gateways) vs Vendor Payments (bank integrations).
- **Gateway per invoice** [ZB]: Payment Options checkboxes at bottom of invoice; if several checked, last-configured gateway used.
- **Online/vendor payment statuses** [ZB]: Draft; Pending Approval; Approved; Approval Rejected (approval states only if payment approvals on); Payment Initiated (Processing); Payment Failed; Paid; Void.
- **Gateways sync across Zoho Finance apps** — enabling/disabling in Books affects Invoice, Billing, Checkout, Commerce, Inventory [ZB].
- **No Zoho fee**; gateway/bank charges only [ZB].

#### Zoho Payments [ZB]
- **Methods (India)**: UPI, cards, net banking, bank transfer (early access); INR only [ZB].
- **Onboarding sections**: Business Profile (by Business Type, documents); Business Representative; Business Owners (≥ 10% ownership); Branding and Public Information (payment descriptor, support helpline); Bank Account (payouts); Summary → accept ToS; verification up to 2 days [ZB].
- **Customer flow**: Pay Now → choose method → credentials or scan QR → Pay; also from portal invoice list; status auto-Paid; settled at next payout [ZB].
- **Configure Feed Accounts** [ZB]: Account Where Zoho Payments Transfers Money (payout bank); Account Which Tracks Money Held (clearing); Account To Track Transaction Fees; Account To Track Other Sales (outside Books); Manage Feeds / Disable Feeds.
- **Edit Settings / Disable** (reason required; feeds disabled, payouts/refunds then manual) [ZB].

#### Razorpay [ZB]
- **Methods**: cards, net banking, UPI, wallets; one-time + recurring [ZB].
- **International payments** after Razorpay enables + Zoho support activation; settled in INR [ZB].
- **ITC on Razorpay fees** possible under GST [ZB].
- **Setup**: OAuth login (email/mobile + password → Authorize) [ZB].
- **Webhook** [ZB]: copy URL from Books; Razorpay dashboard → Webhooks → Add New → events payment.authorized + payment.captured.
- **Save card** requires customer mobile number; "Allow <Company> to collect future charges automatically" checkbox [ZB].
- **Auto-Charge recurring invoices** with saved card — on request via support; needs "Create, Charge, and Send Invoices" recurring preference [ZB].
- **Settlement** within 2 working days (domestic) [ZB].
- **Razorpay Clearing account** (auto-created): Payment Clearing Summary graph; consolidated sales and fees; amount owed by Razorpay; Account Transactions report filter [ZB].
- **Delete**: uncheck from unpaid invoices + delete cards first [ZB].

#### Paytm [ZB, India, INR]
- **Methods**: cards, net banking, Paytm Wallet, UPI (Google Pay, BHIM, PhonePe) [ZB].
- **Setup**: Merchant ID + Merchant Key + Bank Account to track; Sign Up Now for new merchants; Edit Settings [ZB].
- **Fee table (merchant-borne)** [ZB]: UPI 0%; Paytm Wallet 1.70%; Credit Card Visa/Master 1.99%; RuPay Debit 0%; Debit Visa/Master < ₹2000 0.40%; > ₹2000 0.90%; Net Banking 1.80%.
- **Supports Charge Customer (card)** [ZB].

#### PayPal [ZB]
- **Enhanced integration** requires PayPal Business account (upgrade from Personal for pre-30 Jun 2024 setups); Payflow / Payments Pro deprecated (existing users only) [ZB].
- **Methods**: cards (split across multiple cards; Visa, Mastercard, Amex, Discover, JCB, UnionPay), BNPL (PayPal Credit, Pay Later), Venmo (US, QR) [ZB].
- **Only one PayPal account** for collections; multiple for bank feeds [ZB].
- **Integration details**: Account Status, Merchant ID; PayPal Clearing account default, editable "Account to Track Transactions" [ZB].
- **Line items visible on PayPal page** except partial payments [ZB].
- **Active only if** account verified + a transaction in last 12 months [ZB].
- **PayPal bank feeds** via Banking → Add Bank or Credit Card → PayPal (bank account or credit card); Deactivate Feeds [ZB].

#### Stripe [ZB]
- **One-time card payments**, multi-country/currency [ZB].
- **Link by Stripe** autofill of saved payment info [ZB].
- **Auto-charge**: Associate Card on recurring invoice (add or pick card); Delete Card; needs "Create, Charge, and Send Invoices" [ZB].
- **Stripe Clearing account**: sales, fees, refunds, transfers to bank; Account Transactions report; Activity Logs & Audit Trail for integration actions [ZB].
- **Deleting integration doesn't delete cards stored in Stripe** [ZB].

#### Verifone (2Checkout) [ZB]
- **Editions**: US, UK, Canada, Australia, India, UAE, Kuwait, Oman, Saudi Arabia, Kenya, Mexico, Global [ZB].
- **Setup**: 2CO Account #, Secret Word (from Site Management; set Header Redirect approved URL), Bank Account; "Verifone (Card)" payment option [ZB].

#### ICICI Bank eazypay [ZB, India; closed to new integrations]
- **Collection modes**: Cash, Cheque, Credit/Debit Card, Internet Banking, UPI, NEFT, RTGS; payer from any Indian bank [ZB].
- **Registration fields**: Merchant Name, Corp ID, User ID, PAN, ICICI Bank Account; bank-side Options (Collection Method, Collection Mode, Default Mode, Charges Borne merchant/payer, Business Category, Nature of Business, GST No for GST invoices), Business Info (start date, turnover, average ticket size, annual card collection), Promoter Info, T&C; activation up to 20 min (Check Status) [ZB].
- **Advanced Settings**: enable/disable payment modes; transaction fee bearer [ZB].
- **Offline "Generate Challan"** PDF for paying at bank [ZB].
- **CIB portal link** for transaction charges, settlement, tax invoices, refunds [ZB].
- **Delete** only via support enablement [ZB].

Sources: https://www.zoho.com/in/books/help/online-payments/ ; .../online-payments/zoho-payments.html ; .../online-payments/razorpay.html ; .../online-payments/paytm.html ; .../online-payments/paypal.html ; .../online-payments/stripe.html ; .../online-payments/verifone.html ; .../online-payments/eazypay.html

### 5.12 Connected Banking (bank integrations for vendor payouts & feeds) [ZB, Books-only, India zoho.in only]

- **Common prerequisites** [ZB]: current/corporate account; Zoho account MFA enabled (not Passkey/Security Key); India edition on zoho.in domain; vendor bank account added (Vendor → More → Add Bank Account; IFSC validated for ICICI; role permission to add/edit/delete vendor bank details, admin by default).
- **Common payout entry points** [ZB]: Pay via <Bank> on single bill (Balance Due, Amount full/partial, From Account, To Account, Transaction Type); bulk same-vendor via Payments Made + New → Initiate payment via <Bank>; bulk multi-vendor by selecting bills; Vendor Advance tab.
- **Transfer types** [ZB]: IMPS (< ₹5 lakh, 24/7); NEFT (batches, banking hours); RTGS (> ₹2 lakh, banking hours); same-bank Fund Transfer / Book Transfer; HSBC XACH (cross-border); Standard Chartered Telegraphic Transfer (foreign currency, Purpose of Payment, exchange rate Change).
- **GST challan payment from GST Filing** (GSTR-3B summary → GST Payment tab) [ZB]: HSBC, ICICI, Yes Bank — Payment Date, Challan Date, CPIN (14-digit, valid 15 days), From Account, Transaction Type, CGST/SGST/IGST/CESS from challan; View recent payments.
- **Direct bank feeds** auto-fetched every 24 h / on login; manual refresh; live account balance; match / reconcile in Banking [ZB].
- **Axis Bank** [ZB]: user-level; Neo for Corporates approval (single user: Corporate ID/Login ID/OTP; multi-user: maker selects approver, needs Transaction Maker rights); OTP per payment; suspicious-transaction consent (NCRP/DoT flags) by 11:59 PM same day; integration expires every 30 days and on password/mobile/email/status/security-Q change → reactivate; delete with OTP.
- **HSBC** [ZB]: new flow (post Nov 2025) org-level — HSBCnet auth within 5 min, select accounts, status Initiated → Pending → Complete Setup (Configure Bank Accounts, Manage Users, 6-digit Secret PIN; >5 wrong PIN deactivates); old flow — PC ID, Client Secret, account, Secret PIN; authorise via File Level Authorisation in HSBCnet; cross-border in 29 currencies (early access) with supporting docs; disable (user-level) / delete (org-level).
- **ICICI Bank** [ZB]: needs paid Zoho Finance subscription; FED ID; CIB Login ID or CorporateID.UserID; document verification via RM (fee possible); approve in CIB Connected Banking Approvals with OTP; primary payment account selection ("Make this primary"); payment needs OTP + 4–8 digit Token from CIB; statuses Uncleared → Cleared; CIB approval workflow (Pending on Me/Others); vendor advance requires GST enabled and asks Source/Destination of Supply, Reverse Charge, TDS; feeds exclude current day; disable affects all Finance apps.
- **Kotak Mahindra** [ZB]: feeds + live balance only (no payouts mentioned); CRN + net-banking password + OTP consent; re-auth every 30 days at KMB portal; feed history 90 days before setup; can replace Yodlee feeds; request new account.
- **SBI** [ZB]: initiator must be SBI portal admin; Unique ID from Books → Yono SBI API Banking application (Aggregator ERP, Zoho Corporation Pvt Ltd, Corporate Email, CIF), API Group Payments, Authorization Mode STP (direct) / Non-STP (re-authorise in portal), add users, OTP → Onboarding Reference Number; Omnibus Document for multi-user; Sync Account Details; Token (active + expiry period) synced; Complete Setup with registered mobile + OTP; authorisation limits (C7-A form) and Authorizer access rights; beneficiaries must be added in SBI portal; no special characters in beneficiary name/description; max 3 payments per 10 minutes.
- **Standard Chartered** [ZB]: new account request needs turnover > ₹2.5 crore; one-time token from RM; Straight2Bank Group ID; Integration Administrator; settings Allowed Payment Accounts, Payment Initiators, Bank Statement Accounts; domestic (IMPS/RTGS/NEFT/Book Transfer), international TT, bulk with per-vendor transaction type; approve batches with Vasco token challenge/response → Send to Bank; statuses In Progress → Processed; **Virtual account numbers per customer** (template footer bank details with 4-digit prefix + Virtual Account Number Suffix placeholder) for auto-matching receipts.
- **Yes Bank** [ZB, closed to new integrations]: API banking registration; Customer ID + two-part password; 6-digit Secret PIN; exact Live Balance (to decimals) to verify; account can't be reused in another org; IMPS / NEFT / RTGS / Fund Transfer (A2A); Pay Full Amount split across bills; statuses Uncleared / Cleared; GST payments with Branch selection.
- **Support emails** [ZB]: bankintegrations@, hsbc-support@, kotak-support@, scb-support@, yesbank-support@, icici-support@zohofinance.com.

Sources: https://www.zoho.com/in/books/help/online-payments/axis.html ; .../online-payments/hsbcbank-integration.html ; .../online-payments/icicibank-integration.html ; .../online-payments/kotak.html ; .../online-payments/sbi.html ; .../online-payments/standard-chartered.html ; .../online-payments/yesbank-integration.html

### 5.13 Payment Links [ZB]

- **Purpose** [ZB]: collect ad-hoc/miscellaneous amounts (advance for bulk sale, extras) without a document; differs from retainer invoice (no document needed); needs ≥ 1 gateway.
- **Enable** (Settings → General → Payment Links) → sidebar module [ZB].
- **Create fields** [ZB]: Customer Name; Place of Supply (auto from GST Treatment); Payment Amount; Tax (optional); Link Expiration Date (default 15 days); Description (visible to customer); Save / Save and Share → shortened URL + auto Reference #.
- **Send** [ZB]: Send Email (customer + contact persons, Add Contact Person, preview); Send SMS (needs SMS notifications enabled for Payment Links + for the contact, and mobile number); Copy Link.
- **Viewed indicator** (eye icon) [ZB].
- **Statuses** [ZB]: Generated; Viewed; Paid; Expired; Canceled; filter + column sort.
- **Customer pays** via Proceed to Payment using most recently integrated gateway; link closes once Paid [ZB].
- **Auto-records Payments Received** entry; later apply to that customer's invoices [ZB].
- **Change Expiration Date** → regenerates URL (resend needed) [ZB].
- **Cancel Link** (kept for records, not reactivatable); **Delete** (to change amount, delete + recreate) [ZB].

Sources: https://www.zoho.com/in/books/help/payment-links/ ; .../payment-links/basic-functions.html ; .../payment-links/manage-links.html ; .../payment-links/other-actions.html ; .../payment-links/receive-payment.html

### 5.14 Payment Retention [ZB, Books-only, early access]

- **Early access** — enable by emailing support.india@zohobooks.com [ZB].
- **Use** [ZB]: customer withholds % of invoice (e.g. construction 10%) until contract fulfilled.
- **Enable Retention** (Settings → General toggle) [ZB]: Retention Name; Rate %; Description; Receivable Account (default Retention Receivable); Payable Account (default Retention Payable); Save and Enable.
- **Configure Retention on invoice** (below Total): pick retention → amount computed on sub-total excluding tax; balance due shown; also on bills [ZB].
- **Retention Summary** dropdown on invoice [ZB].
- **Create Claim Invoice** (prefilled); Add Retention Claim below item table → Select Retention → Add as Line Item; then record payment [ZB].
- **Alternative: Manual Journal** (Credit retention account, Debit cash/bank; invoice no. in Reference#) [ZB].
- **Edit retention on invoice** (Configure in Retention Summary; change rate or amount) [ZB].
- **Delete retention rate / Disable feature** (Settings → Sales → Invoices → Payment Retention) [ZB].

Source: https://www.zoho.com/in/books/help/payment-retention/

### 5.15 Payments Received

- **Payment types** [ZB]: Invoice Payments; Retainer Payments; Customer Advance (GST).
- **Record Payment fields** [ZB]: Customer Name; Amount (+ "Pay full amount"); Deposit To; Tax Deducted checkbox + TDS account; per-invoice allocation with Clear applied amount / Pay in Full; Totals: Amount Received, Amount used for payments, Amount in excess; Notes; attachments; thank-you note; Notify via SMS.
- **Split payment** across invoices, full or partial [ZB].
- **Excess / over-payment** saved as unused amount (Amount vs Unused Amount columns) [ZB].
- **Refund** excess/advance, full or partial (More → Refund) [ZB].
- **Import Payments / Import Retainer Payments** (CSV/TSV/XLS ≤ 1 MB; encoding; delimiter; mapping) [ZB].
- **Customer Advance tab** [ZB, India GST]: Customer Name; Place of Supply; Description of Supply; Amount; Tax; Payment Date; Payment # (auto, gear to configure series); Payment Mode; Deposit To; Reference#; Notes (internal); attachments 5 × 5 MB; Notify via SMS.
- **Apply to Invoice** (Amount to Credit per invoice); edit/delete applied payments from invoice Payments tab [ZB].
- **Refund advance** (partial remainder applicable later); refund entry PDF/Print/Edit/Delete [ZB].
- **Notify via SMS** action (More menu; needs customer phone) [ZB].
- **Payment Receipt Template** change per payment [ZB].
- **Filter** All Payments Received by type; **Custom Views** (Name, Mark as Favorite, Criteria + Add Criteria, Column Preferences, Share Custom View) [ZB].
- **Sort; Rearrange columns** (Table icon; mandatory fields fixed); **Refresh** [ZB].
- **Edit; PDF; Print; Email receipt** [ZB].
- **Attachments** 5 × 5 MB via Drag & Drop, Cloud (Zoho Docs, Google Drive, Dropbox, OneDrive), Documents [ZB].
- **Delete** (More → Delete when excess payment exists) [ZB].
- **Bulk actions**: Download PDF; Print; Email; Delete; **Bulk Update** a field (e.g. Payment Mode) [ZB].
- **Export Payments** (CSV/XLS) [ZB].
- **Preferences**: custom Fields only [ZB].

Sources: https://www.zoho.com/in/books/help/payments-received/ ; .../payments-received/basic-functions.html ; .../payments-received/functions.html ; .../payments-received/manage-payments.html ; .../payments-received/other-actions.html ; .../payments-received/preferences.html

### 5.16 Projects & Time Tracking [ZB, Books-only, plan-restricted]

- **Plan note**: "available only for certain plans of Zoho Books" [ZB].
- **Enable Time Tracking** module (Settings → General) [ZB].
- **New Project** [ZB]: Project Name; Description; Customer Name (search by name/phone/email); "Enable Customer Approval for the time entries of this project"; Billing Method; Users (+ Add User); Tasks (+ Add Task).
- **Billing methods** [ZB]: Fixed Cost for Project (Total Project Cost); Based on Project Hours (Rate per hour); Based on Task Hours (rate per task + Billable); Based on Staff Hours (User, Email, Rate per hour); Based on Daily Rate.
- **Daily Rate billing** [ZB]: Rate per Project (Rate Per Day + Hours Per Day HH:MM) / Rate per Task / Rate per User; entries are Full Day or Half Day (≤ half of Hours Per Day = half day); one entry per user per day; invoice qty in days; cannot switch daily ↔ hourly; daily and hourly timesheets can't be invoiced together.
- **Budget** [ZB]: Cost Budget and Revenue Budget; "Add budget for this project"; Budget Type = Total Budget Cost / Total Project Hours (HH:MM) / Hours Per Task / Hours Per Staff; Profitability Summary on Overview.
- **Account Level Budgets** [ZB]: Create Budget (name + income/expense accounts + amounts); multiple per project; clone; Budget vs Actuals report.
- **Tasks** (Name, Description, Billable) [ZB].
- **Import Projects / Import Tasks** (CSV/TSV/XLS ≤ 1 MB; auto header matching; add new fields for unmapped) [ZB].
- **Log Time** [ZB]: manual (Date, Project, Task, Time Spent or start/end via "Enter time duration instead", Billable, User — admin only); Timer (Ctrl/Cmd + T; Note; Stop / Pause / Discard; sidebar timer).
- **Project transactions** [ZB]: New Transaction → Create Quote / Create Invoice / Create Expense / Create Retainer Invoice / Manual Journal; Project Name dropdown on Quotes, Sales Orders, Credit Notes, Retainer Invoices; bills/POs/vendor credits per-line project + Billable customer.
- **Project invoice** [ZB]: Bill up to date; "How to sort data on invoice" (Fixed cost → single line only; task/staff hours → no Group by users; project hours → all options); multiple projects per invoice; "apply the retainers collected to the invoice" checkbox.
- **Bulk Update Line Items → Update Projects** on invoice [ZB].
- **Sales / Purchases tabs** on project [ZB].
- **Reports** [ZB]: Profit and Loss filtered by Project; Profitability Summary chart + Profitability Report link; Purchase Order / Invoice / Quote / Sales Order / Bills / Expense / Debit Note Details reports filterable by project.
- **Cost tracking for staff** [ZB]: admin enables "Track costs for time entries" (Settings → Timesheet); Cost Per Hour per user (Users & Roles); Effective From date for later changes; admin can edit Total Cost / Cost Per Hour on log entry; Total Cost column in timesheet.
- **Projects Cost Summary report** [ZB]: cost from transactions + timesheet cost + budget; filters Project Name, Status, Billing Method, Customer; drill-down filter Transaction Type (Bills, Vendor Credits, Expenses, Journals, Self Billed Invoices), Vendor, Account; Show/Hide Columns; export Zoho Sheet/PDF/CSV/XLS/XLSX.
- **Projects Revenue Summary report** (Actual Revenue vs Budget; drill-down to sales transactions; same filters/exports) [ZB].
- **Manage** [ZB]: filter by status (View By); sort columns; List View / Card View.
- **Other actions** [ZB]: Edit; Clone; Add User; Mark as Inactive/Active; Delete; Bulk Update field; bulk Mark Active/Inactive, Create Invoice, Delete; Export (template, CSV/XLS, PII, password).
- **Preferences**: Fields; Buttons; Related Lists [ZB].

#### Timesheet [ZB]
- **Log Time for individual task** (Date, Project, Task or create new, Time Spent) [ZB].
- **Weekly Log** grid (multiple projects/tasks × days; + Add another line; Billable; remove empty lines; calendar view) [ZB].
- **Start Timer** with Notes + Associate Project [ZB].
- **Import Timesheet** (CSV/TSV/XLS ≤ 1 MB) [ZB].
- **Create transactions from time entry** → project page (Quotes, Invoices, Bills, Retainer Invoices, Expenses) [ZB].
- **Customer timesheet approval** via portal (see 5.4) [ZB].

Sources: https://www.zoho.com/in/books/help/projects/ ; .../projects/basic-functions.html ; .../projects/functions.html ; .../projects/manage-projects.html ; .../projects/other-actions.html ; .../projects/preference.html ; https://www.zoho.com/in/books/help/timesheet/basic-functions.html

### 5.17 Quotes (formerly Estimates)

- **Module rename** [ZB]: orgs created before 31 Mar 2023 have "Estimates"; after renaming, update PDF document title (Transaction Details → Document Details → Show Document Title) and transaction number prefix (Transaction Number Series or Quote# gear).
- **Lifecycle** [ZB]: Draft (not in reports) → Sent / Mark as Sent → Accepted / Mark as Accepted → Declined / Mark as Declined → Invoiced / Partially Invoiced; convert to SO or invoice.
- **New Quote fields** [ZB]: Customer Name; Quote# (auto, gear for custom); Reference#; Quote Date; Expiry Date; Salesperson; Project Name (+ Add New); Select Price List; item table with per-line Apply Price List; header rows; subtotal rows (Global/Canada/US only); Shipping Charges; Adjustment (negative); Customer Notes; T&C (defaults from preferences).
- **"Create a retainer invoice for this quote automatically"** [ZB, Books-only]: on portal acceptance, auto retainer for a % of total; needs gateway.
- **Import quotes** [ZB]: CSV/TSV/XLS ≤ 10 MB; encoding; Auto-generate Quote Numbers; date/decimal format; mapping.
- **Send Quote email** with "Attach Quote PDF" + extra attachments → status Sent [ZB].
- **Share quote link** [ZB]: Visibility Public / Private and Secure; expiry (default 90 days); Secure Link Sharing (verify email/phone; else only Accept/Reject).
- **Customer public-link actions** [ZB]: Accept; Decline; View Quote → verify identity → Accept/Decline/Print.
- **Convert to Invoice** [ZB]: prefilled New Invoice (Customer, Invoice#, Date); quote → Invoiced; with Progress Invoice enabled → popup; to change customer: delete invoice, edit quote, reconvert.
- **Convert to Sales Order** [ZB, Books-only]: prefilled New SO; Save as Draft / Save and Send; then send or mark confirmed.
- **Create Project from quote** (customer + services → tasks) [ZB].
- **Create Retainer Invoice from accepted quote** [ZB]: Billing Address (editable); Description + Amount rows; Retainer Invoice Number (auto/manual); Date; Customer Notes; T&C.
- **Edit; Clone; Comments & History (Add Comment, All Comments)** [ZB].
- **Attachments**: max 10 files × 10 MB; Drag and Drop, Cloud (WorkDrive, Google Drive, Dropbox, OneDrive), Documents; "Display Attachments in Customer Portal and Emails" toggle [ZB].
- **PDF / Print** [ZB].
- **Delete** blocked if invoice or retainer invoice created from it [ZB].
- **Export** [ZB]: Status filter; Export Template; Decimal Format; CSV/XLS/XLSX; include PII (custom fields); file password; max 10,000 rows (else backup); **Export Current View** (list order).
- **List view** [ZB]: resize columns (Save; Reset Column Width); Customise Columns (locked mandatory columns); Refresh List.
- **Bulk** [ZB]: Bulk Update field; multi-quote single PDF; bulk Print; bulk Delete.

#### Quote preferences
- **Allow editing of accepted quotes** (status stays Accepted) [ZB].
- **Allow customers to accept or decline quotes via public link** [ZB].
- **Automate accepted quotes to invoices** [ZB]: Don't convert / Convert to draft invoices / Convert to invoices and email (e-invoice orgs: Create, Push and Send).
- **Hide zero-value line items** in PDF + portal (not for zero-total quotes) [ZB].
- **Retain fields when converting to SO/Invoice**: Customer Notes; Terms and Conditions; Address [ZB].
- **Approvals** (No / Simple / Multi-Level / Custom); Fields; Validation Rules; Record Locking; Buttons; Related Lists [ZB].

#### Progress Invoicing [ZB, Books-only]
- **Enable** "Allow creation of progress invoice from a quote" — requires auto-convert = Don't convert [ZB].
- **Constraints** [ZB]: once enabled, can't invoice a quote already converted to SO; price lists (All Items / Individual Items) allowed only with Unit Pricing scheme.
- **Create Progress Invoice popup** (accepted quote only) [ZB]: Invoice the entire amount; Invoice a Custom Amount or Percentage (% or currency toggle, applied across items); Invoice a custom amount or percentage for each line item; Invoice the Remaining Balance Amount.
- **Amount-Based Progress Invoice** toggle [ZB]: % applies to rate of service lines (qty kept) while goods split by quantity.
- **Quote status** Partially Invoiced → Invoiced; adding items to invoiced quote reverts to Partially Invoiced [ZB].
- **Per-item progress view** (disable Show PDF View): invoiced amounts, discounts, remaining balances [ZB].
- **Progress Invoice Summary report** (Receivables): quote, customer, % invoiced, invoiced amount, remaining [ZB].

Sources: https://www.zoho.com/in/books/help/quote/ ; .../quote/convert-to-inv.html ; .../quote/convert-to-so.html ; .../quote/other-actions.html ; .../quote/preferences.html ; .../quote/progress-invoice.html

### 5.18 Recurring Invoices

- **Enable module** (Settings → General → Recurring Invoice) [ZB].
- **New recurring profile** (shortcut n) [ZB]: Customer Name; Profile Name; Repeat Every (week / month / year / Custom); Salesperson; Associate Project Hours; items (+ header rows); Customer Notes; T&C.
- **Back-dated profile** generates only future child invoices [ZB].
- **Child invoices auto-created at 6 AM org time zone** [ZB].
- **Import recurring invoices** (CSV/TSV/XLS ≤ 1 MB) [ZB].
- **All Child Invoices** list (filter Paid/Unpaid); **Next Invoice** tab preview; Record Payment per child [ZB].
- **Create Invoice manually** from profile (off-schedule; appears under child invoices) [ZB].
- **Stop / Resume** (pause e.g. for months) [ZB].
- **Edit** (shortcut e; affects only future invoices); **Clone**; **Print** child; **Send** draft child manually [ZB].
- **Bulk**: Resume; Stop; Delete; Bulk Update field (e.g. Customer Notes) [ZB].
- **Delete profile** keeps generated child invoices [ZB].
- **Filter by status; Custom Views; sort; rearrange columns** [ZB].
- **Export** (All / Specific Period; template; CSV/XLS/XLSX; PII; password) [ZB].

#### Recurring preferences (org default, overridable per profile)
- **Create Invoices as Drafts** + optional email notification to customer [ZB].
- **Create and Send Invoices** / **Create, Auto-approve and Send** (approvals on) [ZB].
- **Create, Charge and Send Invoices** / **Create, Auto-approve, Charge and Send** [ZB]: On success = Do nothing / Send thank-you note with invoice; On failure = notify customer / notify + retry / retry silently; retries up to 3 with day gaps each and optional "don't send email"; "After all retries, suspend"; "After failure, suspend"; "Disable automatic saving of card details".
- **Auto-apply excess payments and/or credit notes** before sending/charging (excess first, then CNs); synced with Zoho Subscriptions preference [ZB].
- **Buttons** (Deluge/URL) [ZB].

#### Recurring payments / auto-charge
- **Portal save card / bank** ("Use this card for future transactions"; GoCardless "I authorize … charge this bank account automatically") [ZB].
- **Add New Card on contact** (only with Create, Charge and Send); gateway picker if several auto-charge gateways [ZB].
- **Associate Credit Card / Update Card / Associate Direct Debit** on recurring profile — card must be on the profile to auto-charge [ZB].
- **Charge Customer** on child invoice: "Use the card ending in xxxx" or "Charge using another card" [ZB].
- **Offline Record Payment** on child invoices [ZB].

Sources: https://www.zoho.com/in/books/help/recurring-invoice/ ; .../recurring-invoice/ri-createsend.html ; .../recurring-invoice/ri-details.html ; .../recurring-invoice/receive-payments.html ; .../recurring-invoice/manage-ri.html ; .../recurring-invoice/other-actions.html ; .../recurring-invoice/preferences.html

### 5.19 Retainer Invoices (advance billing) [ZB, Books-only]

- **Concept** [ZB]: advance collected is a liability until goods delivered/service done; refundable otherwise.
- **Enable** (Settings → General → Retainer Invoices) + choose liability Account (suggested Unearned Revenue) [ZB].
- **Create fields** [ZB]: Customer Name; Retainer Invoice Number (auto, gear for manual); Retainer Invoice Date; Reference; Description + Amount rows (from quote flow); Customer Notes; T&C.
- **Record Payment (offline)** [ZB].
- **Charge Customer** (card on file "ending in xxxx" or another card) [ZB].
- **Partial payment → Partially Paid** — stated available only in Global, UK, US editions; portal partial-pay checkbox "Allow customers to make partial payments for this invoice" [ZB].
- **Statuses** [ZB]: Draft; Sent; Pending Approval; Approved; Paid; Partially Paid; Partially Drawn; Drawn (refunded/applied); Void; custom Statuses supported.
- **Apply to Invoice** [ZB]: grid Balance, Invoice Amount, Invoice Balance, Amount, Retainer Amount Available; partial/full; Invoices Applied tab with delete.
- **Apply multiple retainers to one invoice** ("Retainers Available" → Apply Now; More → Use Retainers) [ZB].
- **Retainer from quote** — auto-create on acceptance with % (portal accept → pay now or later; email quote link payment) [ZB].
- **Project retainers** — create from project; apply on project invoice via "apply the retainers collected" checkbox; Sales tab lists them [ZB].
- **Refund** [ZB]: Refunded On; Payment Mode (cash, bank transfer, online); Reference; Amount; From Account; Refund History tab (edit/delete).
- **Comments & History** (internal) [ZB].
- **Customize template** [ZB].
- **Reports** [ZB]: Retainer Invoice Details (unused retainers + applied invoices, by status, date range); Refund History; Payments Received report filtered to Retainer Payments (unused amount, method).
- **Import** (CSV/TSV/XLS ≤ 1 MB, auto header match) [ZB].
- **List** [ZB]: filter by status; Custom Views; sort; rearrange columns; Export Current View (format + password); Refresh.
- **Other** [ZB]: Edit; PDF; Print; attach 5 × 5 MB (Drag & Drop, Documents); Clone; Email; Delete; Export (CSV/XLS).
- **Preferences** [ZB]: default T&C; Customer Notes; Approvals (No/Simple/Multi-Level/Custom); Fields; Validation Rules; Buttons; Related Lists; Statuses.
- **Shipping Charges / Adjustment not shown on retainers** [ZB].

Sources: https://www.zoho.com/in/books/help/retainer-invoice/ ; .../retainer-invoice/basic-functions.html ; .../retainer-invoice/functions.html ; .../retainer-invoice/manage-retainer-invoice.html ; .../retainer-invoice/other-actions.html ; .../retainer-invoice/preferences.html

### 5.20 Sales Orders [ZB, Books-only]

- **Enable** (Settings → General → Sales Orders) [ZB].
- **Workflow** [ZB]: Draft → Convert to Open (counts in reports) → Convert to Invoice → Closed; low stock → Convert to Purchase Order.
- **Create** [ZB]: customer + items + shipment date + other fields; Save as Draft / Save and Send.
- **Import** (CSV/TSV/XLS; "Auto-generate Sales Order Number"; mapping) [ZB].
- **From accepted quote** (Convert → Convert to Sales Order) [ZB].
- **Convert to Invoice** (auto-populated; SO → Closed); Invoices tab on SO [ZB].
- **Partial invoicing** — delete lines not being invoiced on the converted invoice [ZB].
- **Cancel Items** (partially invoiced SO; Canceled Items tab; Reopen Canceled Items) [ZB].
- **Convert to Purchase Order** (add/remove items) [ZB].
- **Delete** blocked once invoiced [ZB].
- **Edit; header rows; subtotal rows (Global/Canada/US only); Mail; PDF; Clone; Void; Print** [ZB].
- **Attachments** 5 × 5 MB (Drag & Drop, Cloud, Documents) [ZB].
- **Filter by status; Custom Views** [ZB].
- **Statuses** [ZB]: Draft, Open, Void, Closed + custom statuses with parent status (e.g. "To be shipped" under Open) set via More menu.
- **Export** CSV/XLSX/XLS [ZB].
- **Preferences** [ZB]: retain on conversion to invoice — Address of organisation, Customer Notes, T&C; default T&C; Notes; Approvals (Simple / Multi-Level); Fields; Validation Rules; Record Locking; Statuses; Buttons; Related Lists.
- **Credit-limit enforcement on SOs** optional (see 5.1) [ZB].
- **Portal visibility** of SOs optional (see 5.4) [ZB].
- **Inventory add-on flows from SO**: Packages, Shipments, Sales Returns (see 5.10) [ZB].
- **SO number on invoice** preference: SO Number vs SO Reference Number (see 5.9) [ZB].

Sources: https://www.zoho.com/in/books/help/sales-order/ ; .../sales-order/convert-to-invoice.html ; .../sales-order/convert-to-po.html ; .../sales-order/delete-so.html ; .../sales-order/other-actions.html ; .../sales-order/preferences.html

### 5.21 Cross-cutting observations (Books vs Invoice; India GST)

- **Beyond-Invoice features seen in this group** [ZB]: Sales Orders; Delivery Challans; Payment Links; Payment Retention; Progress Invoicing; e-Invoicing (IRP); e-Way Bills; inventory tracking/adjustments/FIFO; price lists; credit limits; customer hierarchy; cheque printing; connected banking payouts; Zoho Inventory add-on; DSC signing.
- **Plan restrictions explicitly stated** [ZB]: multi-currency per customer ("certain plans"); digital signature ("certain plans", India, Windows app); Zoho Inventory add-on ("certain plans" + paid Inventory org); Projects/Time Tracking ("certain plans"); payment retention (early access). Per-tier names (Free/Standard/Professional/Premium/Elite/Ultimate) are not printed in the crawled text — "Available Plans" widgets were not captured.
- **Edition-limited (not India)** [ZB]: line-item subtotal rows (Global/Canada/US); retainer partial payments (Global/UK/US).
- **India GST touchpoints** [ZB]: GST Treatment + Place of Supply on contacts; multiple GSTINs per address; PAN validation (Aadhaar link); intra/inter-state default tax per item; HSN/SAC 4/6-digit rules + bulk validate; bill of supply (composition/exempt) with GSTR mapping; Export/SEZ endorsement (with/without IGST); customer advance with POS + tax; vendor advance with reverse charge + TDS; TDS-withheld receipts; TDS certificates; e-invoice IRN/QR; e-way bill incl. gold; GST challan payment via bank (CPIN); Place of Supply auto on delivery challan and payment links. Reverse charge, SEZ, export/LUT and composition appear only in these passing mentions in this group; no dedicated LUT/TCS page was in the group.
- **Common transaction-module scaffolding** [ZB]: Approvals (No/Simple/Multi-Level/Custom); custom Fields (data type, PII storage, mandatory, show in PDF); Validation Rules; Record Locking; custom Buttons (Deluge/URL); Related Lists; custom Statuses; Custom Views (criteria, columns, favourite, sharing); Bulk Update; export templates with PII + password; import with encoding/delimiter/mapping memory.

Sources: all pages listed above.


## 6. Zoho Books (India) — Purchases, Banking, Accounting, Data & Dashboards

> Source: Zoho Books India help docs (zoho.com/in/books/help/…). Pages show an "Available Plans" widget whose contents were not captured by the crawl; plan tiers are noted only where the text states them. Tag [ZB] = Zoho Books.

### 6.1 Chart of Accounts

- **Default account categories/types** [ZB]
  - Assets: Other Asset, Other Current Assets, Cash, Bank, Fixed Asset, Stock, Payment Clearing, Accounts Receivable, Deferred Tax Asset
  - Liability: Other Current Liability, Credit Card, Long Term Liability, Other Liability, Overseas Tax Payable, Accounts Payable, Deferred Tax Liability
  - Equity: Equity; Income: Income, Other Income; Expense: Expense
- **New Account popup** (Accountant > Chart of Accounts > + New Account) [ZB]
  - Account Type; Account Name; Account Code (unique, ≤50 chars); Description
  - Toggle "Add to the watchlist on my dashboard" (Account Watchlist on Home dashboard)
  - Zoho Expense integration: "Show as an active account in Zoho Expense" (syncs as expense category)
- **Import Chart of Accounts** (More > Import) [ZB]
  - Formats CSV/TSV/XLS; max 10 MB; downloadable sample file
  - Duplicate Handling (matched by account name): Skip Duplicates | Overwrite Accounts
  - Character Encoding (default UTF-8); field mapping with "Save these selections for future imports"; Preview > Import
- **Edit account** (Account Details > Edit popup) [ZB]
- **Attach files to account**: Drag and Drop; Cloud (Zoho WorkDrive, Google Drive, Dropbox, OneDrive…); Documents module [ZB]
- **Mark Inactive / Mark Active** — only user-created accounts; default accounts can't be inactivated [ZB]
- **Export Chart of Accounts**: Module; Export Template (+ New Template); Decimal Format; File Format CSV/XLS/XLSX; File Protection Password [ZB]
- **Export Current View**: exports visible columns in on-screen order; Decimal Format; CSV/XLS/XLSX; password [ZB]
- **Lookup / Multi-Select Lookup custom fields linking to Account** — set Related Module = Account in any module's Fields tab; linked transactions appear in account's **Related List** tab [ZB]
- **Bulk actions** (up to 1,000 accounts for Bulk Update) [ZB]
  - Bulk Update: Account Type, Parent Account, Currency, Account Code, custom fields; different changes per account in same action
  - Bulk Mark Active; Bulk Mark Inactive; Bulk Delete
  - System accounts (lock icon) not selectable for bulk actions
- **Delete account** — user-created only; blocked if any transactions reference it [ZB]
- **Account hierarchy**: Parent Account (sub-accounts) [ZB]

Sources: https://www.zoho.com/in/books/help/accountant/chart-of-accounts.html

### 6.2 Manual Journals

- **Statuses**: Draft; Pending Approval; Approved; Rejected (approval statuses only when Approvals enabled); Published [ZB]
- **New Journal form** [ZB]
  - Date; Journal# auto-numbered (gear icon > auto-generate or manual entry)
  - Notes
  - Reporting Method: Accrual only | Cash only | Accrual and Cash (default)
  - Currency
  - Line items: Account; Contact; Transaction Type (Sales | Purchases); Debit; Credit; reporting tags
  - Validation: total debits must equal total credits
  - Save as Draft | Save and Publish; drafts do not hit accounts until Published
- **Bulk Publish** of selected draft journals [ZB]
- **Detail page views**: Details view (incl. reporting tags) and PDF view with totals [ZB]
- **Activity Logs tab**: creation, edits, approvals, status changes [ZB]
- **Import Journals**: Choose File + sample file; Character Encoding; File Delimiter; "Auto-generate Journal Numbers" (ignores file numbers); Map Fields; Preview; status (Draft/Published) included [ZB]
- **Export Journals**: All | Specific Period; Decimal Format; Export Template; CSV/XLS/XLSX; File Protection Password; status included [ZB]
- **Journals against bank accounts** appear in the bank as "Manually Added" withdrawal/deposit; matchable to uncategorized feed lines (same date + amount suggested) [ZB]
- **Other actions**: Edit; PDF download; Print (preview); Attach Files; Clone; Delete (single + bulk); Bulk Print [ZB]
- **Custom fields for journals**: Settings > Module Settings > Accountant > Journal Fields tab [ZB]

Sources: https://www.zoho.com/in/books/help/accountant/manual-journal.html

### 6.3 Base Currency Adjustment (forex revaluation)

- **Make an Adjustment** (Accountant > Currency Adjustments) [ZB]
  - Fields: Currency; Date; new Exchange Rate (FCY→BCY); Notes (mandatory)
  - Requires open foreign-currency transactions
  - Confirmation grid per account: Account; Balance (FCY); Balance (BCY at old rate); Revalued Balance (BCY); Gain or Loss (BCY, negative = loss); Select checkbox
- **Report effects** [ZB]
  - P&L: Non Operating Income/Expense (Exchange Gain or Loss); Balance Sheet: Accounts Receivable
  - Account Transactions entry type "Base Currency Adjustment"; Journal Report section; Trial Balance; Realized Gain or Loss report
- **Delete adjustment** from Base Currency Adjustment list [ZB]

Sources: https://www.zoho.com/in/books/help/accountant/base-currency.html

### 6.4 Transaction Locking

- **Two modes**: Lock Individual Modules (separate lock date per module) | Lock All Transactions (single date; "Switch to Lock All Transactions") [ZB]
- **Module coverage** [ZB]
  - Sales: Invoices, Credit Notes, Invoice Payments, Customer Payments, Bills of Supply, Debit Notes, Retainer Invoices
  - Purchases: Expenses, Bills, Vendor Credits, Vendor Payments, Bill Payments
  - Banking: Deposits, Transfer Funds, Card Payment, Owner's Drawing/Contribution, Other Income, Interest Income, Tax Refunds, Credits/Refunds Received, Sales Returns, Expense Refund, Sales without Invoices, Payment to Initial Creditors, Receipts from Initial Debtors, Wage Payment, Loan Repayment, Loan Disbursement
  - Accounts: Journals, Tax Payments, Tax Adjustments, Base Currency Adjustments
- **Lock dialog**: Lock Date (txns before it can't be added/edited/deleted); Reason (required) [ZB]
- **Edit lock** (date + reason); **Unlock** (Reason required) [ZB]
- **Unlock Partially**: Partial Unlock Period (from–to) + Reason; **Disable Partial Unlock** [ZB]
  - Not allowed for orgs with inventory-tracked item transactions (FIFO COGS)
- **Locking restrictions (inventory)** [ZB]
  - Negative stock per location in lock period blocks lock (estimated COGS later corrected by bill)
  - Outward txn in period depending on future-dated inward bill blocks lock
  - Can't unlock purchases while dependent sales are locked
- **Setting**: Allow transaction locking with negative stock | Restrict transaction locking with negative stock [ZB]

Sources: https://www.zoho.com/in/books/help/accountant/transaction-lock.html

### 6.5 AI Features (Zia)

- **AI Preferences** (Settings > Organisation > AI Preferences): per-feature enable toggle; choose AI Provider and Model per feature [ZB]
- **Ask Zia** (right-sidebar chat) [ZB]
  - Create items, customers, sales & purchase transactions in background; asks follow-up questions for missing data; notifies on completion
  - Q&A over org data (e.g. overdue invoices this week, customer email, P&L status, invoices overdue by 60 days)
  - Displays Business Overview report figures
- **CoCreate Agent** (Sales > + New > CoCreate Agent, or Widgets pane) [ZB]
  - Prompt-driven creation of quotes, sales orders, invoices, credit notes; fills form on-screen
  - Take Control (manual edit) / Resume Autofill
- **Speech Assistant**: mic icon in Ask Zia; English voice → text, editable before Send; works with Ask Zia and CoCreate [ZB]
- **Report charts / forecast / anomaly**: chart type + X/Y axis config; View Forecast; View Anomaly [ZB]
- **Zia email-template drafting** (Settings > Email Notifications > Show Mail Content > Generate With Zia): prompt; regenerate; adjust Tone and Content; Insert; editable [ZB]
- **AI-powered custom field data types** (Early Access) [ZB]
  - Keyword Extraction; Sentiment Analysis (Positive/Negative/Neutral); Image to Text (OCR incl. handwriting, image description, object detection)
  - Requires a source input field; output shown on detail page once transaction marked Sent
- **Generate Blueprints using Zia** for custom modules (Blueprints tab > + New Blueprint Using Zia > Generate; edit states/transitions; Publish) [ZB]
- **AI-suggested bank categorisation** (Early Access): suggests Category, Customer/Vendor, Account from past categorisations; editable; works with quick-categorise [ZB]
- **Zia Invoice Agent insights** on Invoices list (Zia icon toggles) [ZB]
  - Overall Due & Outstanding balance → Set Payment Reminder
  - Customers paying <70% of invoice amounts over past 6 months → Send Payment Reminders
  - Invoices exceeding org's average late-payment days → View Invoices
- **Zia Insights**: auto trends/patterns/projections over reports [ZB]

Sources: https://www.zoho.com/in/books/help/ai-features/ai-features.html

### 6.6 Banking — Accounts & Feeds Setup

- **Banking module map**: Add Accounts (auto feed / manual bank / manual credit card / PayPal); Currency add/remove; Feeds (update credentials, refresh, deactivate; PayPal activate/deactivate); Add Transactions (manual, import, undo last import); Match/Categorize; Transaction Rules; Reconcile (reconcile, undo, delete); Other Actions (edit, mark inactive, delete, bulk actions) [ZB]
- **Add Bank or Credit Card** → "Connect and Add Your Bank Accounts or Credit Cards" page [ZB]
- **Automatic bank feeds** via aggregators **Yodlee** or **Token** (Bank Feeds Service Provider dropdown) [ZB]
  - Agree to end-user terms; search/select bank; login credentials; choose accounts; fetch-from date (max last 90 days); Currency
  - Older history must be imported via statements
- **Manual bank account fields**: Account Type = Bank; Account Name; Account Code; Currency; Account Number; Bank Name; Bank Identifier Code (IFSC/IBAN etc.); Location (locations allowed to transact); Users (access) [ZB]
- **Manual credit card account fields**: Account Type = Credit Card; Account Name; Account Code; Currency; Bank Name; Users [ZB]
- **PayPal account** [ZB]
  - Choose Bank Account or Credit Card type; OAuth login to PayPal
  - Add PayPal Currency page: Download transaction history from (≤90 days, default 90); Currency (multi); Associate Bank Account (existing or new per currency); Add new currency
  - Remove currency (deactivate feed first; removing all removes integration)

Sources: https://www.zoho.com/in/books/help/banking/ ; https://www.zoho.com/in/books/help/banking/add-accounts.html

### 6.7 Banking — Adding & Importing Transactions

- **Manually add transactions** via Add Transaction dropdown, split into Money Out (vendor payments, transfers, purchases, expenses…) and Money In (sales, interest, expense refunds, deposits, other income); labelled "Manually Added" [ZB]
  - Attachments: max 5 files × 5 MB
- **Import Statement** [ZB]
  - Formats: CSV, TSV, OFX, QIF, CAMT.053, PDF (also XLS via auto-forward)
  - Source: desktop or Documents module; Character Encoding (default UTF-8); File Delimiter (default comma)
  - Amount Column Type: Double Column (separate deposit/withdrawal) | Single Column and Amount Type (Dr/Cr indicator column) | Single Column with Negative Values
  - Auto best-match field mapping; "Save these selections" for reuse; Preview with errors/unmapped fields; Previous to edit
  - PDF statements: parsed via **Perfios**; "This file is password protected" + password; select bank; accept terms
- **Auto-Forward Bank Statements**: forward bank emails to Zoho; Bank Statement > "Bank Statements From Inbox" > Add to Bank → import flow [ZB]
- **Undo Last Import** (gear icon): preview transactions to delete, Undo Import; only latest import; auto-fetched feeds can't be deleted (exclude instead) [ZB]

Sources: https://www.zoho.com/in/books/help/banking/add-transactions.html

### 6.8 Banking — Account Dashboard

- **Bank account Dashboard tab**: latest statement details, last manual import date, last reconciliation date, transaction rules for account [ZB]
- **Latest Statement Details counters**: Total Transactions; Autocategorised; Recognized (rule-matched, needs manual confirm); Best Matches; Uncategorised; Duplicates (auto-excluded) [ZB]
- **Duplicate Transactions preference** (Duplicates count > Configure): auto-exclude (default) or "No thanks, I'll do it myself"; feed duplicates always auto-excluded [ZB]

Sources: https://www.zoho.com/in/books/help/banking/dashboard.html

### 6.9 Banking — Record Deposits (deposit slips)

- **Prerequisite**: customer payment recorded with a cash account in Deposit To [ZB]
- **Record Deposit popup** (cash/bank account page) [ZB]
  - Date; To Account (only from cash accounts); Paid Via; Reference#; Bank Charges; Description
  - Filters: Received From (customer); Transactions = All | Customer Payment | Sales Receipt; Apply Filter
  - Select payments to include; Other Funds → Add Funds Manually; Attachments
  - Resulting entry matchable to uncategorised statement line (Best Matches)
- **Deposit custom fields** (Settings > Module Settings > Banking > Deposit Fields) [ZB]
  - Label Name; Data Type: Text single/multi-line, Number, Decimal, Date, Dropdown, Checkbox; Help Text; Is Mandatory; Default Value; Prevent Duplicate Values
  - Count limited by plan (Custom Fields Usage link); edit, active/inactive, access, delete
- **Deposit validation rules**: name; multiple conditions; Alert Message; blocks save; also apply to integrated Zoho apps [ZB]

Sources: https://www.zoho.com/in/books/help/banking/deposits.html

### 6.10 Banking — Bank Feeds Management

- **Auto-fetch every 24 h** for non-MFA banks; MFA banks need manual refresh; feeds lag one day (fetch today → yesterday's txns) [ZB]
- **Feed status icon** next to account name [ZB]
- **Gear menu actions**: Update Credentials; Refresh Feeds (manual, max once/day); Deactivate Feeds; Activate Feeds [ZB]
- **PayPal feeds** activate/deactivate [ZB]
- **Yodlee new API platform upgrade**: Upgrade Now banner per bank; reconnect within 30 min; select accounts (Save & Finish); "Accounts Fetched Through Yodlee" mapping; Fetch Bank Feeds From date (defaults to last fetch); 2–3 min lockout during upgrade; exclude duplicates afterwards [ZB]
- **OAuth-style reconnect** (Chase/Capital One example): deactivate → activate → Edit Connection → authorise on bank site → map accounts + from-date [ZB]

Sources: https://www.zoho.com/in/books/help/banking/feeds.html

### 6.11 Banking — Match & Categorise

- **Uncategorised Transactions tab**; View By filter (latest statement only) [ZB]
- **"Match found" tag** → one-click Match [ZB]
- **Best/Possible Matches pane**: Select multiple Zoho transactions until sum = statement amount; paginated with configurable rows/page [ZB]
- **Create New Transaction while matching** (adjustment for gateway fees etc.): Apply To (Deposits | Withdrawals); Date; Account; Amount (shows Balance); Reference#; Delete Transaction [ZB]
- **Possible Matches filter**: Amount Range; Date Range; Vendor/Customer; Type; Reference#; Include Withdrawals (for deposits) / Include Deposits (for withdrawals) [ZB]
- **Cross-type matching**: deposit matched against invoice + bill (net); withdrawal against bill + other-income (cashback) [ZB]
- **Categorise manually**: "Recognized" tag → pre-filled from rule, verify & Save; otherwise fill form & Save [ZB]
- **Views dropdown**: All Transactions | Matched | Categorised | Manually Added | Recognized | Excluded | Automatically Excluded tab [ZB]
- **Unmatch**: statement → Uncategorised, Zoho txn → Manually Added [ZB]
- **Uncategorise**: statement → Uncategorised, created txn deleted [ZB]
- **Multi-select & Match toggle**: many statement lines ↔ one or more Zoho txns; banner (Show All/Hide All, remove each, Clear Selection); re-fetch matches; create difference transaction; Categorise Manually tab for group [ZB]

Sources: https://www.zoho.com/in/books/help/banking/matching-transactions.html

### 6.12 Banking — Transaction Rules

- **Manage Transaction Rules** (gear next to Import Statement) > New Rule [ZB]
  - Rule name; Apply To: Deposits | Withdrawals
  - Match mode: All the following criteria | Any one of the following criteria
  - Criteria fields: Payee; Description; Reference Number; Amount
  - Text operators: is; contains; starts with; is empty
  - Amount operators: =, >, >=, <, <=
  - Record As (type list differs for deposit/withdrawal); Account; Paid Via; Reference Number: Use Value from Bank Statement | Enter Manually
  - Add Transactions in This Rule To: Recognized Transactions (manual confirm) | Categorised Transactions (auto) + "Allow Zoho Books to categorise my bank statements"
- **Edit / Delete rule**; auto-categorise rules can't be deleted until switched to Recognized; deletion doesn't affect already-categorised txns [ZB]
- **Advanced Search for rules**: Rule Name; Apply To; Associated Accounts Category (All Accounts | All Banks | All Cards | Custom) + Associated Accounts; Transaction Marked As (Recognized | Categorised); Transaction Type (Expense, Income…) [ZB]

Sources: https://www.zoho.com/in/books/help/banking/transaction-rule.html

### 6.13 Banking — Reconciliation

- **Reconcile Account** (gear) > Initiate Reconciliation: Start Date; End Date; Closing Balance → Start Reconciliation [ZB]
  - Tick matched/categorised/manually added txns; + Add Transaction to adjust cleared amount
  - Must reach Closing Balance = Cleared Amount (difference 0); edit Closing Balance inline
  - Attach files (desktop/cloud/Documents)
  - Reconcile | Save and Reconcile Later; status Reconciled
- **Opening balance locked** once any transaction reconciled [ZB]
- **Reconciliation history list**; Undo Reconciliation (must undo later ones first, newest-first); Delete Reconciliation [ZB]

Sources: https://www.zoho.com/in/books/help/banking/reconciliation.html

### 6.14 Banking — Account & Bulk Actions

- **Edit account** (changes don't affect past txns); **Mark as Inactive**; **Delete** (confirm "Delete it") [ZB]
- **Bulk Exclude** with reason (duplicates) — from Uncategorised or Automatically Excluded tab; view via Excluded filter; Restore in right pane [ZB]
- **Bulk Unmatch** (Matched view) [ZB]
- **Bulk Categorise** (Recognized view > Categorise now) [ZB]
- **Bulk Uncategorise** (Categorised view) [ZB]
- **Bulk Delete** (Manually Added only) [ZB]
- **Bulk Restore** excluded → back to Uncategorised [ZB]

Sources: https://www.zoho.com/in/books/help/banking/other-actions.html

### 6.15 Bills (Purchase Invoices)

- **Shortcuts**: Shift+B open Bills; C+B new bill [ZB]
- **New Bill header fields** [ZB]
  - Vendor Name; Source of Supply (auto from vendor GSTIN); Destination of Supply
  - Bill# (unique); Order Number; Bill Date; Due Date; Payment Terms (e.g. Net 15 → auto due date)
  - Item rates Tax Inclusive | Tax Exclusive
  - Discount Type: line-item level | transaction level
- **Item table** [ZB]
  - Items; per-line Customer (Billable toggle, Project, markup % prefilled from settings default; default Non-Billable)
  - Insert New Header rows (group lines; removing header keeps lines); line ellipsis: reporting tags, clone line
  - + Add another line; + Add items in bulk; Bulk Update Line Items (reporting tags)
  - + Add Landed Cost
- **Totals section**: Discount; Adjustment; TDS rate (applied on Sub Total); TCS rate u/s 206C(1H) with Edit to override amount (TCS on total incl. charges & taxes; applies to receipts after 1-Oct-2020 when turnover > ₹10 cr and buyer purchases > ₹50 lakh) [ZB]
- **Include open Purchase Orders** of the vendor into the bill [ZB]
- **Notes, attachments, PDF template selection**; Save as Draft | Save as Open | Submit for approval [ZB]
- **View Journal** (Display Journal / More > View Journal) [ZB]
- **Record Payment (single)**: Payment Made (default full, partial allowed); Tax Deducted checkbox → Amount Withheld + Tax Account; Payment Date; Payment Mode (configurable); Paid Through; Notes; Attachments; "Send a Payment Made email notification" + vendor emails [ZB]
- **Record Bulk Payment**: filter Open/Overdue/Unpaid/Partially Paid; select bills (same or multiple vendors); Paid Through; Payment Mode; per-vendor dates; Reference Number (txn ID) [ZB]
- **Payments Made tab** on bill: edit/delete payments [ZB]
- **Import Bills**: CSV/TSV/XLS; max 1 MB; sample file; "Link bills to corresponding Purchase Orders" option; encoding; delimiter; mapping save; preview [ZB]
- **Apply credits** (More > Use Credits) from vendor credits; Credits Applied tab → delete applied credit [ZB]
- **Create Invoice from bill** for billable lines (markup carried) [ZB]
- **Expected Payment Date** with notes (shown in Comments & History; deletable) [ZB]
- **Create Vendor Credits from bill**: copies all items; auto-applied → bill Paid; excess stays as credit balance [ZB]
- **Customize PDF template** [ZB]
- **Create Bill of Entry** from open/overdue bill (needs BoE enabled in GST settings) [ZB]
- **Landed Costs** (plan-restricted: "available only for certain plans") [ZB]
  - Enable: Settings > Items > "Track landed cost on items" (requires inventory tracking)
  - + Landed Cost line as Service item (e.g. Freight); only to inventory-tracked items
  - Allocate proportionately by Value or Quantity; editable Charge; Save & Next / Skip; "Save as Open and Apply Landed Costs"
  - Allocate Landed Costs on existing bill; edit/delete allocation
  - More > Add Landed Costs: pull landed cost from another bill (Vendor, Bill#, cost) — e.g. separate freight agency bill
- **Statuses**: Draft; Pending Approval; Open; Overdue; Unpaid; Partially Paid; Paid; Void [ZB]
- **List management**: All Bills status filter; Custom Views; column sort asc/desc; column chooser + drag reorder (mandatory ** fields locked); Calendar View of overdue bills by month (This month); Export Current View (format + password); Refresh List [ZB]
- **Other actions**: Edit; PDF; Print (preview); Attach (5 files × 5 MB; Drag&Drop / Cloud: Zoho Docs, Google Drive, Dropbox, OneDrive / Documents); Clone; Make Recurring; Void with reason (payments/credits must be removed first) → Convert to Draft with reason; Delete (same prerequisite) [ZB]
- **Print Self-Invoice** for RCM purchases from unregistered vendors (PDF dropdown) [ZB]
- **Export Bills**: All | Specific Period; export template (+ Add New); CSV/XLS/XLSX; "Include Sensitive PII" (vendor address, email, phone, bank account, sensitive custom fields); password [ZB]
- **Bill preferences** (Settings > Purchases > Bills) [ZB]
  - Approvals: No Approval | Simple | Multi-Level | Custom
  - Fields (custom); predefined Notes field — "Show in all PDFs" toggle (hidden from PDF & vendor portal by default)
  - Validation Rules; Buttons (Deluge script or external URL); Related Lists (app + third-party data)

Sources: https://www.zoho.com/in/books/help/bills/ ; https://www.zoho.com/in/books/help/bills/basic-functions.html ; https://www.zoho.com/in/books/help/bills/functions.html ; https://www.zoho.com/in/books/help/bills/manage-bills.html ; https://www.zoho.com/in/books/help/bills/other-actions.html ; https://www.zoho.com/in/books/help/bills/preferences.html

### 6.16 Bills of Entry (Imports / SEZ customs)

- **Purpose**: record customs duty + charges on imports from Overseas / SEZ vendors; one BoE can span line items from multiple bills of the same vendor; reflected in GST filing [ZB]
- **Enable per GSTIN**: Settings > Taxes > GST Settings > select GSTIN > Import/Export: "My business is involved in SEZ / Overseas Trading"; Custom Duty Tracking Account (Expense/Other Expense) [ZB]
- **Vendor restriction**: GST treatment must be Overseas or SEZ [ZB]
- **New BoE header**: Bill of Entry#; Location (journal posted here; lines may come from any location); Vendor Name; Date; Port Code; Paid Through; Custom Duty Tracking Account; "Allocate Custom Duty and Additional Charges as Landed Cost" [ZB]
- **Add Items picker**: Location; Bill# (multi); Items; Search; All Items / Selected Items tabs; Group By Bill # [ZB]
- **Line fields**: Item Details; Bill#; Assessable Value (Qty × Rate, editable to add charges); Custom Duty + Additional Charges; Taxable Amount (= AV + duty); Tax (IGST rate); + Add New Item [ZB]
- **BoE shown on related bill's detail page**; create from bill details too [ZB]
- **Other actions**: Edit (re-syncs landed cost); Add e-Way Bill details; Import; Export (date range, fields, format); Delete (removes allocated landed cost) [ZB]

Sources: https://www.zoho.com/in/books/help/bills-of-entry/ ; https://www.zoho.com/in/books/help/bills-of-entry/basic-functions-bill-of-entry.html ; https://www.zoho.com/in/books/help/bills-of-entry/other-actions.html

### 6.17 Branches (multi-GSTIN)

- **Enable Branches** (Settings > Organisation > Branches): admin-only; needs registered GSTIN + GST enabled; irreversible (can delete/inactivate branches); current org becomes Head Office / Primary Branch [ZB]
- **Add Branch**: Branch Name; Address; Primary Contact; GSTIN (pick or + New GSTIN; one GSTIN can serve many branches); Transaction Series (+ New) [ZB]
- **Transaction Series Preferences tab**: Name; associated branch(es); Prefix + Suffix per module (e.g. BR1 INV-001); must be unique per GSTIN; default series; auto-selected by branch [ZB]
- **Role permissions** for Branches (Settings > Roles) [ZB]
- **Branch on transactions**: all sales, purchases, manual journals, bank txns, e-Way bills [ZB]
  - Branch drives GSTIN, address, series, inter/intra-state tax calc
  - Default = head office; pre-enable txns → head office; import with branch mapping
  - Cross-branch payments allowed; conversions (quote → invoice etc.) must stay in same branch
- **Dashboard All Branches dropdown** per-branch view [ZB]
- **Reports**: Customise Report > General > Advanced Filters by Branch (not all reports); Show/Hide Columns > Branches column; Zoho Analytics sync [ZB]
- **GST returns per GSTIN**: GSTIN dashboard; GST panel (Branch + GSTIN) > View Summary; GSTR-3B etc. GSTIN dropdown; GST payments & filed returns carry branch [ZB]
- **Advanced Search by Branch** in all transaction lists [ZB]
- **Bulk Update Branch** on transactions with reason (blocked if payments/credits applied) [ZB]
- **Mark as Primary** (star); Edit; Mark Inactive; Delete [ZB]

Sources: https://www.zoho.com/in/books/help/branches/ ; https://www.zoho.com/in/books/help/branches/basic-functions.html ; https://www.zoho.com/in/books/help/branches/track-transactions.html ; https://www.zoho.com/in/books/help/branches/other-actions.html

### 6.18 Documents (Inbox, Autoscan, Folders)

- **Documents module**: central store; client email-in; autoscan; convert to transactions; folders; folder permissions [ZB]
- **Autoscan (OCR)**: extracts date, amount, merchant, line items; 15 languages (English, Swedish, Spanish, Portuguese, Dutch, Italian, French, German, Danish, Chinese, Norwegian Bokmål, Russian, Malay, Thai, Vietnamese) [ZB]
  - Statuses: Scan in progress; Processed; Unreadable
  - All plans get free scans; add-on 50 autoscans/month — India ₹499/month or ₹419/month billed annually
- **Inbox**: chronological; auto-cleared when attached/matched/moved; cleared docs unrecoverable (move to folder to keep) [ZB]
- **Upload channels**: drag-drop single/multiple; cloud (Evernote, Dropbox, Box, Google Drive, OneDrive, Zoho Docs); org unique email address (system-generated or "Choose your own"); Android/iOS app photo capture [ZB]
- **Auto-forward bank statements**: Inbox > Bank Statements > Enable Now; unique address (Edit/Copy); formats CSV, PDF, XLS, TSV, OFX, QIF, CAMT.053; setup guides for Zoho Mail, Gmail (verification code lands in inbox), Outlook; also Yahoo, iCloud, AOL [ZB]
  - Add to Bank: password-protected checkbox; auto-suggested bank; PDF statement bank; terms; Proceed
- **Permissions**: View Documents; Upload Documents; Delete Documents; Manage Folder [ZB]
- **Folders**: create/rename/delete; access = All users with document permission | Custom user list; admin sees all; Move To between Inbox/folders [ZB]
- **Add to → transaction type** from document; Bills/Expenses side-by-side image + form, prefilled date/merchant/amount [ZB]
- **Attach from transaction**: paperclip > My Documents (existing or new transaction: quote, SO, invoice, expense, bill…) [ZB]
- **Attach to Contact**; "Display attachment(s) in customer portal and emails" → portal "Shared Documents" [ZB]
- **Match suggestions** by Vendor Name, Date, Amount: Merge to existing txn; suggested docs while creating invoice/expense/bank txn; best-match; uncategorised bank line + document → categorise [ZB]
- **Search**: context-scoped (All Files, Inbox, Folders, Trash) by name/vendor/amount; Advanced Search (vendor, amount range; File name only outside Inbox); Trash view [ZB]

Sources: https://www.zoho.com/in/books/help/documents/documents.html

### 6.19 Expenses & Mileage

- **Shortcuts**: Shift+X open Expenses; C+X new expense; Alt/Option+S Save (doc lists same key for Save & New) [ZB]
- **New Expense form** [ZB]
  - Date; Employee (Manage Employees: + Add New Employee, delete; employees need not be users)
  - Expense Account; **Itemize** (split across multiple expense accounts)
  - Amount + Tax; Paid Through (credited account)
  - Vendor; **GST Treatment** + vendor GSTIN + Place of Supply
  - **Reverse Charge**: "This transaction is applicable for reverse charge"
  - Tax; Invoice# (vendor's)
  - Customer Name + Billable toggle + Project + markup % (default from settings) → shows as unbilled item on customer's invoice
  - Attach Receipt (Desktop / Cloud / Documents; delete)
  - Projects; Reporting Tags
  - Save | Save & New
- **View Journal** (More > View Journal / Display Journal) [ZB]
- **Import Expenses**: CSV/TSV/XLS; ≤25 MB; source desktop/cloud/documents; sample CSV/XLS; encoding; delimiter; map; save mapping; preview [ZB]
- **Statuses**: Non-Billable; Unbilled; Invoiced; Reimbursed [ZB]
- **List management**: All Expenses status filter; + New Custom View; sort; column chooser/reorder; Export Current View (format, password) [ZB]
- **Record Mileage tab** [ZB]
  - Date; Employee; Calculate Mileage by Distance travelled | Odometer reading (start/end)
  - Amount auto = distance × rate; Tax Inclusive/Exclusive; Paid Through (credits) / Fuel/Mileage Expenses (debits)
  - Vendor; Notes; Customer + Billable; Attach Receipt; Projects; Reporting Tags
- **Make Recurring**: Profile Name; Start On / End On / Never Expires; Repeat Every (or Custom); reporting tags [ZB]
- **Convert to Invoice** (billable expense, markup applied) → Save as Draft / Save and Send [ZB]
- **Other actions**: Edit; Clone; Print (preview); Delete; Export Expenses (All/Specific Period, template, CSV/XLS/XLSX, PII toggle, password) [ZB]
- **Bulk actions**: Bulk Update (any field, e.g. Notes); Print Receipt (multi); Delete [ZB]
- **Expense preferences** (Settings > Purchases > Expenses) [ZB]
  - "Associate employees to expenses" → Expenses by Employee report
  - Mileage: Default Mileage Account; Default Unit (km | mile); Mileage Rates effective by date (edit/delete)
  - Vehicles tab: + New Vehicle (name, details), edit/delete; linked to mileage rates/expenses
  - Fields (custom); Buttons (Deluge / external link)

Sources: https://www.zoho.com/in/books/help/expense/ ; https://www.zoho.com/in/books/help/expense/basic-functions.html ; https://www.zoho.com/in/books/help/expense/manage-expenses.html ; https://www.zoho.com/in/books/help/expense/mileage-expenses.html ; https://www.zoho.com/in/books/help/expense/other-actions.html ; https://www.zoho.com/in/books/help/expense/preferences.html

### 6.20 Keyboard Shortcuts

- **Shortcut sheet**: Shift+? (Shift+/) or profile > "Navigate faster with keyboard shortcuts"; **custom key binding per action** via Edit icon [ZB]
- **General**: Option+/ advanced search; S Settings; O organisations list; Cmd+/ Zia search; Option+0 Navigate To; / search [ZB]
- **Go To**: Shift+I Invoices; Shift+J Journals; Shift+E Quotes; Shift+N Credit Notes; Shift+B Bills; Shift+X Expenses; Shift+P Purchase Orders; Shift+S Sales Orders; Shift+Z Chart of Accounts; Shift+1 Dashboard; Shift+2 Items; Shift+3 Banking; Shift+4 Customers; Shift+5 Vendors; Shift+6 Reports; Shift+7 Documents; Shift+R Payments Received; Shift+M Payments Made [ZB]
- **Module level (Sales & Purchases lists)**: N new; Option+M email multiple; Option+D download multiple as PDF; Option+I import; Option+E export; Option+A select all [ZB]
- **Transaction level**: E edit; M mail; P print; D download PDF [ZB]
- **Create anywhere**: C+I invoice; C+J journal; C+E quote; C+N credit note; C+B bill; C+X expense; C+A account; C+T log time; C+5 vendor; C+4 customer; C+R retail invoice; C+1 customer payment; C+M vendor payment [ZB]
- **Save**: Option+S Save and Send; Option+P Save and Print [ZB]

Sources: https://www.zoho.com/in/books/help/getting-started/keyboard-shortcuts.html

### 6.21 Home Dashboard

- **Total Receivables panel**: Current vs Overdue (click → AR Aging Details by Invoice Due Date); overdue time-range dropdown; + New: Invoice, Recurring Invoice, Customer Payment [ZB]
- **Total Payables panel**: Current vs Overdue (→ AP Aging Details by Bill Due Date); + New: Bill, Vendor Payment, Recurring Bill [ZB]
- **Cash Flow graph** (direct method): Cash as on date (start/end FY), Incoming (debits to bank/card/cash/payment clearing), Outgoing; period selector (This Fiscal Year…) [ZB]
- **Income and Expense** chart: Total Income/Total Expenses; Cash | Accrual toggle; click → P&L; period selector [ZB]
- **Top Expenses** pie (click slice → transactions); period selector [ZB]
- **Projects panel**: project, client, Unbilled Hours / Unbilled Expenses tabs; Show All Projects [ZB]
- **Bank and Credit Cards panel** (click → account txns) [ZB]
- **Account Watchlist** (accounts flagged in CoA); Accrual | Cash basis [ZB]
- **Other tabs**: Getting Started (profile, bank, first invoice, tax setup); Announcements; Recent Updates [ZB]
- **Branch selector** (All Branches dropdown) when branches enabled [ZB]

Sources: https://www.zoho.com/in/books/help/home/

### 6.22 Custom Dashboards

- **+ New Dashboard**: Dashboard Name; Description; Provide Access To: Only Me | Everyone | Only Selected Users & Roles (per-user/role View Only | View and Manage) [ZB]
- **Predefined Panels** (Create Panel icon) [ZB]
- **Report Panels** — allowed reports (+ their custom reports): P&L, Sales by Customer/Item/Sales Person, Invoice Details, Sales Order Details, Delivery Challan Details, Quote Details, Receivable Summary/Details, Payments Received, Credit Note Details, Bills Details, Vendor Credits Details, Purchase Order Details, Purchase Orders by Vendor, Purchases by Vendor/Item, Expenses by Customer/Project, Billable Expense Details [ZB]
  - Categories: Business Overview; Sales; Receivables; Payments Received; Payables; Purchases and Expenses; Custom Reports
  - Panel Details: Time Period (Today, This Week, This Month, This Quarter, This Year…); Panel Name; Description
  - Preferences: Chart Type (Pie | Bar | Line); X-Axis Data Points (e.g. Item/Customer Name); Y-Axis (Amount/Quantity); Sort By; Maximum Data Points on X-axis
- **Panel actions**: drag reorder; resize (report panels only); edit; delete; Save Changes [ZB]
- **Dashboard lists**: Created By Me; Shared With Me; Created By Other Users (admins); System (default) [ZB]
- **Favourites**: up to 3; 2 shown in tab beside Default [ZB]
- **Role permissions**: Dashboard section in role; Enable View Access; Allow Dashboard Management [ZB]
- **Edit/Delete dashboard**; default dashboard can't be edited/reordered/deleted [ZB]

Sources: https://www.zoho.com/in/books/help/home/custom-dashboards.html

### 6.23 Import, Export & Data Backup

- **Generic Import** (module list > More > Import) [ZB]
  - + Choose File: CSV, TSV, XLS; sample file
  - Character Encoding; Field Delimiter
  - Map Fields; "Save these selections for use during future imports"; Preview; Import
  - Module-specific size caps seen: CoA 10 MB; Bills 1 MB; Expenses 25 MB
- **Generic Export** (module list > More > Export) [ZB]
  - Module; Select Status (e.g. Draft only); Date Range
  - Export Template: + New Template → Template Name, choose fields, + Add a New Field, Save and Select
  - File format CSV | XLS | XLSX; "Include Sensitive PII"; File Protection Password
  - Limit: first 25,000 rows only — beyond that use backup
- **Export Current View** in lists (visible columns/filters) [ZB]
- **Data Backup** (Settings > Developer Space > Data Backup) [ZB]
  - Single compressed file of per-module CSVs; link emailed (~30 min); Backup History with status + download
  - Link expires after 30 days; one backup per 15 days

Sources: https://www.zoho.com/in/books/help/import-export/ ; https://www.zoho.com/in/books/help/import-export/import.html ; https://www.zoho.com/in/books/help/import-export/export.html ; https://www.zoho.com/in/books/help/import-export/backup-your-data.html

### 6.24 Integration — Bharat Connect (B2B e-invoicing/payments network, India only)

- **Scope**: India edition (zoho.in) only; via Zoho Payments as registered aggregator; exchange POs, invoices, bills, credit & debit notes; pay via Bharat Connect, connected banking, UPI, cards; auto-reconcile; vendors can request financing [ZB]
- **Setup** (Settings > Integrations and Marketplace > Bharat Connect > Set Up Now; authorisation checkbox) [ZB]
  - Step 1 Verify GSTIN: pick GSTIN (if multiple); Legal Business Name; Business Type; Get OTP (7-digit to GSTN-registered mobile); Verify OTP; confirm mobile
  - Step 2 Create B2B ID: suggested or custom per naming guidelines (brand/acronym + optional city/state/numbers); immutable; delete via support; accept T&C; Save and Submit → network approval
  - Step 3 Continue Setup (KYC): Business Profile; Business Representative; Business Owners (≥10% stake); Bank Account for payments
- **Link B2B IDs to contacts**: per contact Edit > Other Details > "Fetch from GSTIN"; bulk "Search Contacts in Bharat Connect" > choose among multiple IDs > Link Now [ZB]
- **Role permissions**: Send Transactions via Bharat Connect; Accept Transactions from Bharat Connect; Manage Bharat Connect Integration (needs Manage Integrations; owners only); Segmented Access Control by Location & Bank Accounts [ZB]
- **Outbound**: PO / Invoice / Credit note / Debit note → "Save and Send via Bharat Connect"; list bulk "Push via Bharat Connect"; Payments Made → "Push to Bharat Connect" (Yes, Push) [ZB]
  - Outbound statuses: Push Initiated; Push Failed; Awaiting Response; Invoice/PO Accepted; Invoice/PO Rejected
  - Notes tied to a bill/invoice require the parent to have been pushed too
- **Inbound**: incoming POs land as Sales Orders (Accept/Reject — reject deletes permanently); incoming invoices in Bills > "Bills From Bharat Connect" tab → Create (verify, Save and Accept; approval flow applies) or Reject; bulk Accept/Reject [ZB]
  - Inbound statuses: Acceptance In Progress; Sales Order/Bill Accepted; Sales Order/Bill Rejected; Credit/Debit Note Received → Accepted/Rejected
- **Payments**: pay accepted open bills from Zoho Books or Record Payment offline; online customer payment auto-marks invoice paid; offline → mark Payment Received / Payment Not Received (deletes record) [ZB]

Sources: https://www.zoho.com/in/books/help/integrations/bharat-connect.html

### 6.25 Integration — WhatsApp Business

- **Supported notifications**: invoices, sales orders, payment receipts, customer statements, quotes/estimates, retainer invoices, credit notes, sales receipts, payment reminders; vendor statements/notifications [ZB]
- **Prerequisites**: Zoho becomes BSP; number not tied to other BSP/WhatsApp app (chats may be lost); verified Facebook Business Manager [ZB]
- **Connect** (Settings > Integrations & Marketplace > WhatsApp > Connect): reuse existing Zoho-registered WABA or connect new; Facebook login; business details; select/create WABA + profile; choose Default WhatsApp Number [ZB]
- **Multiple channels** (Configure Channels) [ZB]
  - Customer Communication: "Apply the Same Number Across Categories" Yes/No; separate Utility vs Marketing numbers (anti-spam advice)
  - Vendor Communication: utility number
  - Verify Phone Numbers: OTP via SMS or call
- **Templates** (per module, + New Template) [ZB]
  - Template Name; Category Utility | Marketing
  - Header text (1 placeholder max) or Attachment Message: Dynamic (transaction PDF) | Static (upload; Customers module only)
  - Language; Message Content with Insert Placeholders; Footer (1 line, no placeholders, no emoji)
  - CTA buttons (max 2): Phone number, URL; Quick Reply: Stop (opt-out of utility+marketing, Resume button), Accept/Reject (quotes)
  - Approval by Meta ≤24 h; statuses: Approved, Rejected, Pending Approval, Deletion in Progress, Deletion Failed, Deleted
  - Clone (re-approval); Set As Default (auto-fills when sending); Delete (permanent)
- **Quote accept/reject on WhatsApp**: Quotes preference "Allow customers to accept or decline the quotes via platforms like Whatsapp, and public link"; status auto-updates [ZB]
- **Enable per module** toggles; per contact: Communication Channels > WhatsApp (phone with + country code) for primary contact/contact persons/vendors [ZB]
  - Bulk: Update Communication Preference (Only Primary Contacts | All Contacts and Contact Persons; "Include customers who stopped receiving WhatsApp notifications"); list > Configure Communication Preferences for selected customers/vendors
  - Warning + consent required to re-enable opted-out contacts
- **IM Credits**: Buy IM Credits (qty → price/credit shown → Calculate Payment incl. tax → gateway) or Zoho Store; IM Credits Usage report (Reports > Activity) [ZB]
- **Credit consumption model**: Meta categories Utility (volume-tier pricing per country, resets monthly), Marketing (fixed per-message per country), Service (user-initiated conversation); INR or USD rate card by WABA currency; e.g. India marketing msg $0.0107 → ~192 msgs per $2.06 credit; messages = cost per credit ÷ message cost [ZB]
- **Sending** [ZB]
  - On create: "Share invoice with" contacts → Save and Send → verify template & contacts
  - Existing: Send > WhatsApp Message (pre-filled contact + template)
  - Payment receipts: "Share payment receipt with" on Payments Received
  - Reminders: Reminders > Send WhatsApp Message (single or bulk overdue); automated due-date reminders with WhatsApp tab toggle + template (needs channel enabled at customer & transaction level)
  - Customer notifications/statement (Statement tab > Share via > WhatsApp); vendor notifications/statement; bulk vendors (WhatsApp icon)
  - Bulk invoices/SO/estimates/retainers/sales receipts; skipped for drafts or contacts without channel
- **Tracking**: transaction Comments & History > Show Details (name, phone, status) → jump to chat; contact Mails & Messages tab > WhatsApp Messages; WhatsApp Notifications report (Contact Type Customers/Vendors; Date Range; + More Filters; schedule/export/share) [ZB]
- **Two-way chat**: WhatsApp button on customer/vendor; + new chat; must start with template until reply; attachments one at a time JPG/JPEG/PNG ≤5 MB, PDF ≤10 MB; End Session; 24 h inactivity expiry → Initiate Chat; Take Over (one agent at a time, silent) [ZB]
- **Common chat window** (WhatsApp icon top-right): All Chats → Customer/Vendor Communication; Utility/Marketing filter; add unknown number as new customer or contact person (custom messages only to unknowns) [ZB]
- **Incoming message notifications** toggle (bell > gear) [ZB]
- **Role permission**: Contacts > More Permissions > Communication (Customer/Vendor Communication) [ZB]
- **Workflow action**: WhatsApp Alert (Settings > Automation > Workflow Actions) linked to workflow rules (e.g. invoice total changed) [ZB]
- **Admin**: Mark Inactive/Active; Change Default Number (delete channel, Set Default Number, verify OTP); Change Account (delete templates first: Schedule Automatic Deletion | I'll Delete Manually → SETUP PENDING) [ZB]

Sources: https://www.zoho.com/in/books/help/integrations/whatsapp/integrate-with-whatsapp.html ; https://www.zoho.com/in/books/help/integrations/whatsapp/how-credits-work.html

### 6.26 Payments Made (Bill Payments, Vendor Advances, Refunds)

- **Shortcuts**: Shift+M open Payments Made; C+M new vendor payment [ZB]
- **Bill payment statuses**: Draft; Pending Approval; Approval Rejected; Approved (approval states only when Approvals on); Paid; Void [ZB]
- **Record Bill Payment (Bill Payment tab)** [ZB]
  - Vendor Name; Branch (if enabled); Location (if enabled)
  - Payment# auto (gear → "Add Payment Number manually": prefix + number)
  - Payment Made amount → prompt apply to bills Yes / No (excess)
  - Payment Date; Payment Mode (+ Configure Payment Mode); Paid Through
  - Unpaid bills grid: Payments column per bill; Pay in Full; Clear Applied Amount
  - Notes (internal); Attachments (Upload File)
  - Save as Draft | Save as Paid
- **Excess payment**: amount > bills → Excess Payment popup (edit account) → stored as vendor credit for future bills [ZB]
- **Import Bill Payments** (More > Import Payments): CSV/TSV/XLS ≤10 MB; sample file; Character Encoding; File Delimiter; Map Fields with Default Data Formats (Decimal 1234567.89; Date format at field level, editable); save mapping; preview; also "Import Applied Excess Payments" [ZB]
- **Refund for bill payment** (More > Refund): verify; To Account [ZB]
- **Vendor Advance tab (GST-aware advance)** [ZB]
  - Vendor Name; **Destination of Supply** (GST applicability); Branch; Location; Payment#
  - **Description of Supply** (printed on payment voucher)
  - Payment Made; exchange rate (editable) for FCY
  - **Reverse Charge** checkbox → Tax field for RCM on advance
  - **TDS**: section/reason + % (amount editable)
  - Payment Date; Payment Mode; Paid Through; Deposit To (advance account); Reference#; Notes; Attachments
- **Vendor advance statuses**: Draft; Pending Approval; Approval Rejected; Approved; Paid (partly/fully applied); Void [ZB]
- **Apply Vendor Advance to Bills**: Mark as Paid (if draft) → Apply to Bills → open bills grid "Credits to Apply"; RCM carried to bill [ZB]
- **Refund vendor advance**: Amount (default full balance); Refunded On; Payment Mode; Exchange Rate; Description of Supply; To Account; Description [ZB]
- **Manage payment**: Edit; Upload Files (Desktop / Documents); Payment History pane (audit); Void with reason; View Journal (also at bottom of details); Delete (refunds must be deleted first) [ZB]
- **Refund History tab**: edit/delete refunds [ZB]
- **Share**: PDF; Print (preview); Email to vendor (editable recipients) [ZB]
- **Bulk actions**: Bulk Update (one field → value); Submit for Approval; Bulk Delete (not with refunds) [ZB]
- **Export Payments**: All Bill Payments | Specific Period (Start/End); Export Template (+ New); Decimal Format; CSV/XLS/XLSX; Include PII; password [ZB]
- **Export Current View**: max 10,000 rows (else backup); Decimal Format; format; password [ZB]
- **Preferences** [ZB]
  - Approvals for Bill Payments, Checks, Online Payments
  - Custom Fields; Buttons (Deluge, external links)
  - List filters: Draft; Paid; Void; Paid via Check; To Be Printed Checks; Uncleared Checks; Cleared Checks; Void Checks; Advance Payments; Bill Payments
  - Custom View: Name; Mark as Favorite; criteria (+ Add Criterion, Criteria Pattern); Columns Preference (drag Available → Selected); Visibility (Only Me | Only Selected Users & Roles | Everyone)
  - Customize Columns (locked mandatory columns); Refresh List

Sources: https://www.zoho.com/in/books/help/payments-made/ ; https://www.zoho.com/in/books/help/payments-made/vendor-payments.html ; https://www.zoho.com/in/books/help/payments-made/vendor-advance.html ; https://www.zoho.com/in/books/help/payments-made/preferences.html ; https://www.zoho.com/in/books/help/payments-made/payments-made-operations/bulk-actions-payments-made.html ; https://www.zoho.com/in/books/help/payments-made/payments-made-operations/export-actions-in-payments-made.html ; https://www.zoho.com/in/books/help/payments-made/payments-made-operations/manage-payment-refunds.html ; https://www.zoho.com/in/books/help/payments-made/payments-made-operations/manage-payments-made.html ; https://www.zoho.com/in/books/help/payments-made/payments-made-operations/share-payments-made.html

### 6.27 Purchase Orders

- **Shortcut**: Shift+P open Purchase Orders [ZB]
- **Enable** (Settings > Setup & Configurations > General > Purchase Orders checkbox) [ZB]
- **New PO fields**: Vendor Name; Deliver To: Organization | Customer + delivery address; Purchase Order# (auto; gear → auto vs manual); Expected Delivery Date; Date; Shipment Preference (Cargo, Air…); items; Save as Draft | Save and Send [ZB]
- **Create Purchase Order (Pre GST)** for dates before 1-Jul-2017 (dropdown beside + New) [ZB]
- **+ Add items in bulk** (select items + qty) [ZB]
- **Insert New Header** rows; **Insert New Subtotal** rows (subtotal only in Global/Canada/US editions — not India) [ZB]
- **Create PO from Vendor** (Vendor > New Transaction > Purchase Order) [ZB]
- **Import POs**: CSV/TSV/XLS ≤1 MB; sample; encoding; delimiter; auto header matching; save mapping; "Auto Generation Purchase Order number"; add fields for unmapped headers [ZB]
- **Convert to Bill** (Convert to Bill → New Bill prefilled); also pull open POs into a bill [ZB]
- **Cancel Items** (select items + qty → PO Closed); only unbilled items in Partially Billed POs; service items can't be cancelled; **Reopen Cancelled Items** [ZB]
- **Expected Delivery Date** action (logged in Comments & History, deletable) [ZB]
- **Mark as Cancelled** — Open POs only; irreversible [ZB]
- **Comments** (internal, Comments and History tab); **Customize PDF template** [ZB]
- **Statuses**: Draft; Open (sent); Closed; Cancelled; Partially Billed; Billed; plus custom Statuses [ZB]
- **List management**: All Purchase Orders filter; Custom Views; sort; column chooser; Export Current View (format + password); Refresh List [ZB]
- **Other actions**: Edit; PDF; Print; Attach (5 × 5 MB; Drag&Drop/Cloud/Documents); Clone; Email (preview); Delete; Export POs (CSV/XLS) [ZB]
- **Share PO link**: Visibility Public; Link Expiration Date; Generate Link; Copy Link; **Secure Public Links** (vendor verifies email/phone from Vendor Details) [ZB]
- **Preferences** (Settings > Purchases > Purchase Orders) [ZB]
  - "Allow Vendors to Accept or Decline Purchase Orders via Public Links"
  - Close PO when: Purchase Receive recorded | Bill created | Receives and Bills recorded
  - Default Terms & Conditions; Notes
  - Approvals: No Approval | Simple | Multi-Level | Custom
  - Fields; Validation Rules; Buttons; Related Lists; Statuses
- **Bharat Connect push** of POs (see 6.24) [ZB]

Sources: https://www.zoho.com/in/books/help/purchase-order/ ; https://www.zoho.com/in/books/help/purchase-order/basic-functions.html ; https://www.zoho.com/in/books/help/purchase-order/functions.html ; https://www.zoho.com/in/books/help/purchase-order/manage-po.html ; https://www.zoho.com/in/books/help/purchase-order/other-actions.html ; https://www.zoho.com/in/books/help/purchase-order/preferences.html

### 6.28 TDS Liabilities & Challans (India)

- **Enable TDS Liabilities** (Settings > Taxes and Compliance > Direct Taxes > Income TDS Settings > "Enable TDS Liabilities Report") + Start Period month [ZB]
- **Penalty / Interest accounts**: Penalty Account; Interest Account (default Other Expenses) [ZB]
- **TDS Liabilities list** (Filing & Compliance > TDS Liabilities): monthly liabilities from start month; drill to transactions with TDS deducted; Total TDS, Paid Amount, Balance [ZB]
- **Record Challan** (from liability) [ZB]
  - Amount; Penalty (late return filing); Interest (failure to deduct / late deposit)
  - Challan Number; BSR Code; Payment Date; Paid Through; Location
  - "Auto allocate payment to all the listed liabilities" (only when payment > liability)
  - Attachments: Desktop / Documents / Cloud (WorkDrive, Google Drive, Dropbox, OneDrive)
- **Associate Challan**: select liability transactions → list of unused (partially allocated) challans → Associate [ZB]
- **TDS Challans list**: view; Record Challan; Edit; Delete Challan; attachments panel (download, remove, open in new tab) [ZB]
- **Import TDS Challans** (upload, map, import) [ZB]
- **Export TDS Challans**: CSV/XLS/XLSX incl. Challan Cess Amount and Challan Surcharge Amount [ZB]
- **TDS on purchases**: TDS rate on bills (on Sub Total); Tax Deducted (Amount Withheld + Tax Account) on bill payments; TDS section + % on vendor advances (see 6.15, 6.26) [ZB]

Sources: https://www.zoho.com/in/books/help/tds/tds-challans.html ; https://www.zoho.com/in/books/help/tds/tds-liabilities.html

### 6.29 Vendor Credits (purchase returns / debit notes)

- **New Vendor Credit**: Vendor Name; Credit Note# (vendor's); Order Number; Vendor Credit Date; item details; Insert New Header; Discount (+ Discount Account); Adjustment; + Add items in bulk [ZB]
- **View Journal** (More > View Journal / Display Journal) [ZB]
- **Import Vendor Credits**: CSV/TSV/XLS ≤1 MB; sample; encoding; delimiter; map; save mapping; preview [ZB]
- **Apply to Bills**: split across multiple open bills of same vendor; fully used → Closed; or from bill via Use Credits [ZB]
- **Refund**: full or partial amount + refund account; Refund History tab; Import Refunds (CSV/TSV/XLS) [ZB]
- **PDF template customization** (Settings > PDF Templates > Vendor Credits: font, background, orientation, size) [ZB]
- **Internal comments** (Comments and History) [ZB]
- **Auto-created from bill** (Create Vendor Credits) and from excess vendor payments (see 6.15, 6.26) [ZB]

Sources: https://www.zoho.com/in/books/help/vendor-credits/basic-functions.html ; https://www.zoho.com/in/books/help/vendor-credits/functions.html



## 7. Zoho Books (India) — GST Compliance, Reports, Settings, Customization & Automation

### 7.1 GST Filing — setup & common mechanics

- **GST Settings** (Settings > Taxes & Compliance > Taxes > GST Settings): enter GST details, Save. [ZB]
- **Online Filing Settings**: GSTN Username; Reporting Period; enables pull/push to GSTN and filing. [ZB]
- **GST portal API access prerequisite**: GST Portal > My Profile > Manage API Access > Enable API Request = Yes; choose Duration; Confirm. Required for GSTR-1/2/2B/3B/9 sync. [ZB]
- **GSTN session/OTP**: OTP sent to GSTN-registered mobile/email when session expired; Generate OTP / Verify OTP / Verify and Push. [ZB]
- **GST Filing module navigation**: Filing & Compliance > GST Filing; "GST Summary for/Period" month-year picker; Monthly/Quarterly Returns tab; Annual Returns tab; IMS Dashboard; with Locations/Branches enabled → List of GSTINs page, View Returns/View Summary per GSTIN. [ZB]
- **View My Online Filing History**: list of all GST returns filed for the GSTIN. [ZB]
- **Return statuses/actions**: Push to GSTN; Check Status; Failed Transactions tab (edit & re-push); Mark as Filed (Date of Filing + confirm checkbox "transaction amount in Zoho Books and the GSTN are the same"); Mark as Unfiled (must unfile in reverse sequence from latest); Mark as Completed / Mark as Open (GSTR-2, GSTR-6A). [ZB]
- **Push notifications**: confirmation email + in-app notification on successful push / push failure. [ZB]
- **Export As JSON / Print** on return summaries (CMP-08, GSTR-6 overview). [ZB]

### 7.2 GST Filing Approval

- **Enable approval process for filing GST Returns** (GST Settings checkbox): admins only can enable; pick approvers. [ZB]
  - Approvers limited to Accountant and Admin roles; max 5 approvers.
  - Applies to GSTR-3B and GSTR-1.
- **Submit for Approval**: after Push to GSTN; from GST Filing or GSTR-1 > View Summary > File your Return; approvers notified (email with link). [ZB]
- **Recall Return**: reason required; only the submitter can recall; approvers notified; then edit, re-push, resubmit. [ZB]
- **Approve Return / Reject Return** (reject from dropdown, reason required + Confirm); after approval: Submit in File Your Returns tab (GSTR-1) or pay + Mark as Filed (GSTR-3B). [ZB]

### 7.3 GSTR-1

- **GSTR-1 filing**: outward supplies return; file from Zoho Books or from GST portal. [ZB] (help page shows "Available Plans" box; plan not stated in text)
- **Reconcile e-Invoices tab** (only orgs with e-Invoicing enabled): Pull from GSTN fetches IRP auto-populated e-invoice data and auto-reconciles so pushing doesn't overwrite IRN details. [ZB]
  - Statuses: Excluded (full match, auto-excluded from push); Partial Matches (e.g. decimal diffs → include/exclude; Bulk Exclude); Missing in Zoho Books (create entries).
  - Filters: Section (B2B, B2CL, EXP, CDNR); e-Invoice Status (Active/Cancelled); e-Invoice Auto-Draft Status (auto-drafted/pending).
  - Excluded txns hidden from Push to GSTN tab.
- **Unpushed Transactions tabs**: Transaction Summary; HSN (HSN summary); Nil (nil-rated outward); B2CS (Table 7); Documents Issued; Supplies Through ECO (sec 9(5) e-commerce operator supplies). [ZB]
- **Documents Issued editor**: Edit, enter document series details, Save; Clone to add another sequence. [ZB]
- **Push to GSTN prompt**: Aggregate Turnover in preceding FY; Aggregate Turnover Apr–Jun 2017; OTP; Check Status; Failed Transactions tab. [ZB]
- **File Now > File Online** (direct filing from Books): enter PAN (not stored) > Generate OTP > File Now; then Mark as Filed. [ZB]
- **File via GST portal**: DSC or EVC, then Mark as Filed in Books (Date of Filing + confirmation checkbox). [ZB]
- **Mark GSTR-1 as Unfiled**: 3 cases (filed in portal but missed txns → add/amend via 9A/9C next return; marked filed accidentally → re-push; filed through Books → unfile in reverse order, does not unfile on portal). [ZB]

### 7.4 GSTR-2 / GSTR-2A reconciliation

- **GSTR-2 tabs**: Overview; Reconciliation; Pull from GSTN; File your Returns / Complete Your Return. [ZB]
- **Prerequisite**: purchases must be marked Eligible for ITC to claim. [ZB]
- **Reconciliation categories & actions**: [ZB]
  - Missing in GSTN → Add to GSTN.
  - Missing in Zoho Books → Create and Match; Reject.
  - Partially Matched → Use My Value; Modify and Match.
  - Matched → Accept; Mark as pending (carry to next cycle).
  - Reconciled → Revert Reconciliation.
- **Mark as Completed / Mark as Open** (reopen in reverse order from latest to edit reconciled txns). [ZB]

### 7.5 GSTR-2B reconciliation

- **Fetch Summary** (GSTR-2B section at bottom of summary): auto-drafted ITC statement generated 14th monthly; sources GSTR-1/5/6 + ICEGATE; excludes TDS/TCS. [ZB]
- **View Return / Reconciliation sections**; auto-categorized all / matched / partially matched. [ZB]
  - Missing in GSTN → Add to GSTN; Missing in Zoho Books → Create and Match; Partially Matched → Accept, Modify and Match; Matched; Reconciled. Accept not shown for Missing in Zoho Books.
- **Regenerate GSTR-2B**: unlimited regenerations before GSTR-3B filing after IMS changes post-14th; errors if previous month's 3B unfiled; QRMP taxpayers only in last month of quarter. [ZB]

### 7.6 IMS (Invoice Management System)

- **IMS Inward Supplies dashboard**: supplier-filed GSTR-1/1A/IFF records (non-RCM, ITC-eligible); Pull From GSTN; Overview tab Overall Summary. [ZB] (help page shows "Available Plans" box)
- **Action values**: Accepted (in GSTR-2B); Rejected (excluded); Pending (stays in IMS, excluded); No Action (deemed accepted). Action Taken column. Actions modifiable until GSTR-3B filed. [ZB]
- **Ineligible (POS rule / sec 16(4))** records bypass IMS → GSTR-2B ITC Not Available section. [ZB]
- **Review Transactions tabs**: Matched (accept/pending only); Partially Matched (accept/reject/pending); Missing in Zoho Books (reject/pending only); Reviewed (latest action). [ZB]
- **Push to GSTN tab**: Ready to be Pushed (counts of Accepted/Pending/Rejected/Reset to Default); Pushed; Failed Transactions; scheduled push with notification on completion. [ZB]
- **Reset Reconciliation** (revert action → No Action): pushed txn → Push Status "Yet to Reset in Portal" (re-push needed); unpushed → back to review tabs. [ZB]
- **Post-3B cleanup**: accepted/deemed/rejected removed from IMS after GSTR-3B; only pending remain. [ZB]

### 7.7 GSTR-3B

- **GSTR-3B filing**: monthly, due 20th of next month; exempt: ISD, composition dealer, non-resident taxable person, TCS-collecting e-commerce supplier. [ZB]
- **Steps**: Mark previous return as filed → Update ITC Reversed → Reclaim ITC Reversed → Push to GSTN → Pay taxes → Record tax paid → File → Mark as Filed. [ZB]
- **Edit ITC Reversed** (Table 4(B) row edit pop-up). [ZB]
- **Edit ITC Reclaimed** (4(D) Other Details reclaimed sub-row) + **Adjust ITC** on "All other ITC" sub-row; Ineligible ITC u/s 16(4) & POS restrictions auto-populated from GSTR-2B ITC not available. [ZB]
- **Push to GSTN** multiple times allowed (e.g. weekly); OTP; Verify and Push. [ZB]
- **Pay GST from Zoho Books** via ICICI Bank or HSBC integration (ICICI payments auto-recorded); else portal payment (E-payment/OTC/NEFT/RTGS) via challan. [ZB]
- **Record Payment** (GSTR-3B > GST Payment tab or GST Filing > GST Payments): Payment Date; Paid Through account; Reference Number; Challan Date; CPIN; Tax Liability CGST/IGST/SGST/CESS. [ZB]
- **Auto journal on Mark as Filed** for offsetting ITC; manual journal needed to move "Reverse Charge Tax Input but not due" → Input IGST/SGST/CGST/Cess. [ZB]
- **Mark as Unfiled**: reverse order from latest; status → Unfiled. [ZB]
- **3B tables shown**: 3.1 (a) taxable outward, (b) zero rated, (c) nil/exempt, (d) inward RCM, (e) non-GST; 3.2 inter-state to unregistered/composition/UIN; 4 Eligible ITC (A available: import goods, import services, RCM, ISD, other; B reversed; C net; D ineligible); 5 exempt/nil/non-GST inward; 6 payment of tax (ITC, TDS/TCS credit, cash incl. interest/late fee). [ZB]

### 7.8 GSTR-9 (annual)

- **GSTR-9 tabs**: Generate and View Return; Fetch and Update Auto-calculated Summary; Push to GSTN; File Your Return. Due 31 Dec following year; exempt: composition (9A), non-resident, TDS deductors, e-commerce operators. Requires GSTR-1/3B filed. [ZB]
- **Generate Return** (Annual Returns tab): Return Filing Period (GST registration date → FY end); Regenerate Return; unsupported values labelled "Not Supported". [ZB]
- **Comments and History** panel on GSTR-9 pages. [ZB]
- **Fetch Auto-calculated Summary** (portal system-calculated; async with notification; blocked if already filed on portal). [ZB]
- **Mismatch compare**: red exclamation icon → side-by-side Books vs auto-calculated; pencil edit pop-up; hover shows both values; View Auto-calculated Summary link. [ZB]
- **Table editability**: Part I auto; Tables 4,5,7,13 editable; 6G/K/L editable (6A–F not); 8,10,11,12,14–19 not editable (10/11/14/16A/17/18 auto from Books; 17/18 HSN need HSN/SAC on items); 9 Tax Payable column editable. [ZB]
- **Mark as Filed (irreversible)**: Date of Filing + "cannot undo" checkbox; afterwards no update/fetch/push. [ZB]

### 7.9 GST CMP-08 (composition)

- **CMP-08 quarterly return**: due 13th of month after quarter; Quarterly Returns tab; View Summary per GSTIN. [ZB]
- **Summary**: GSTIN, GST Username, Composition Scheme %; rows 1 outward incl. exempt, 2 inward RCM incl. import of services, 3 tax payable, 4 interest payable; liability = composition % from GST Settings split CGST/SGST; drill into txns; View Journal. [ZB]
- **Update Value (Interest Payable)**: Integrated, Central, Cess; State/UT auto from Central; journal created. [ZB]
- **3 steps**: Push to GSTN → Record Payment (Payment Date, Paid Through, Reference Number, Challan Date, CPIN, Tax/Interest/Fees per CGST/IGST/CESS/SGST, auto totals; View Recent Payments) → Mark as Filed (Date of Filing, Acknowledgement Number). [ZB]
- **Journal behaviour**: liability payment journal on filing; late fee/interest to separate ledgers; Mark as Unfiled deletes journal. [ZB]
- **Export As JSON; Print** (Summary, Push, Payment, Filing pages). [ZB]

### 7.10 ISD (Input Service Distributor) — GSTR-6A / GSTR-6

- **Add ISD GSTIN**: Settings > Taxes > + New GSTIN, Registration Type = Input Service Distributor (ISD). Customers can have GST Treatment "Input Service Distributor". [ZB]
- **GSTR-6A reconcile**: Pull From GSTN; vendor invoices→Bills, debit notes→Vendor Credits, credit notes→Vendor Credit Notes; View By filter (All/Bills/Vendor Credit Notes/Vendor Credits); tabs Matched (Accept), Partially Matched, Missing in Zoho Books (create bill), Missing in GSTN, Reconciled (Revert Reconciliation). [ZB]
- **Credit Distribution**: To Be Distributed (Distribute → choose Locations + Credit Distribution % → ISD invoice); To Be Reversed (pick Eligible Credits Reference Invoice → ISD credit note); Distributed/Reversed (View Distribution Split; Export as PDF; Print). Formula c1=(t1/T)×C on prior-FY turnover. [ZB]
- **GSTR-6 filing** (monthly, due 13th): Overview (B2B, debit notes, eligible/ineligible distribution; Export JSON); Push to GSTN (Transaction Summary, Failed Transactions); ITC Details (Calculate ITC, Save ITC); Mark as Filed / Unfiled. [ZB]

### 7.11 DRC-01B / DRC-01C (portal guidance only)

- **DRC-01B** (Rule 88C; GSTR-1 vs 3B liability mismatch): reply in Part B within 7 days else GSTR-1/IFF blocked; pay via DRC-03 (validate ARN) or select reason (≤500 chars, "Any other reason"); EVC/DSC filing on GST portal. Not a Books in-app feature. [ZB]
- **DRC-01C** (Rule 88D; GSTR-2B vs 3B ITC mismatch): same Part B flow; DRC-03 cause "ITC mismatch – GSTR-2A/2B to GSTR-3B". [ZB]

### 7.12 GST Migration wizard (legacy, July 2017)

- **Migration wizard**: Start Migrating; "Is your business registered for GST?"; GSTIN; Composition Scheme checkbox; Migrate to GST. [ZB]
- **Tabs**: Tax Preference (default intra/inter-state rates); Goods and Services (tax preference, exemption reason, Goods/Services, HSN/SAC, intra/inter rates; Bulk Apply); Customers (tax preference, exemption reason, GST Treatment, Place of Supply; Bulk Apply; skippable); Vendors (GST Treatment, GSTIN, Source of Supply); Recurring Invoices/Bills (taxes nullified, update POS/tax). [ZB]

Sources: https://www.zoho.com/in/books/help/gst/ ; .../gst/filing-approval.html ; .../gst/gstr1-filing.html ; .../gst/gstr2-filing.html ; .../gst/gstr2b-reconcile.html ; .../gst/ims.html ; .../gst/gst-filing.html ; .../gst/gstr9-filing.html ; .../gst/gst-cmp-08.html ; .../gst/isd.html ; .../gst/form-drc-01b.html ; .../gst/form-drc-01c.html ; .../gst/gst-migration.html

### 7.13 Reports — common management (layouts, customize, charts, schedule, share, roles)

- **Draft exclusion**: transactions in Draft status never appear in any report. [ZB]
- **Configure Report Layout** (admins / full-report-access users; applies to all report prints/PDF exports, per-instance override allowed): [ZB]
  - Table Density: Classic, Compact, Super Compact.
  - Table Design: Bordered, Alternative Rows, Alternative Columns (not applied to Business Overview and Tax reports).
  - Paper Size: A4, Letter. Orientation: Portrait, Landscape. Font Family (Dynamic Font for RTL). Margins.
  - Choose Details to Display: Organisation Name; Report Basis; Page Number; Generated By ("system" when scheduled); Generated Date; Generated Time (requires Generated Date).
- **Customize Report – General**: Date Range (week/month/quarter/year/custom; Month/Quarter/Year to Date); Report Basis (Accrual/Cash); Filter Accounts (All accounts / Accounts with transactions / Accounts without zero balance); Compare With (previous periods, months, quarters, years; reporting tags; projects; locations: All Locations or Specific-location hierarchy); Advanced Filters (projects, reporting tags, branches). [ZB]
- **Show/Hide Columns**: Available Columns (+ to add); Selected Columns drag-drop reorder; Run Report; Save as Custom Report. [ZB] (customization feature "only for certain plans"; Custom Reports only on P&L, Balance Sheet, Cash Flow, Invoice Details per manage page)
- **Custom date range + schedule** behaviour: scheduled custom report keeps reusing the fixed custom range. [ZB]
- **Chart View**: Line chart default + other chart types dropdown; Configure Axes (X/Y); View Forecast (trend projection); View Anomaly. Supported: P&L, Sales by Customer, Sales by Item, Sales by Sales Person, Invoice Details, Sales Order Details, Delivery Challan Details, Quote Details, Receivable Summary, Receivable Details, Payments Received, Credit Note Details, Bills Details, Vendor Credits Details, Purchase Order Details, Purchase Orders by Vendor, Purchases by Vendor, Purchases by Item, Expenses by Customer, Expenses by Project, Billable Expense Details. [ZB]
- **Schedule Report** (admins / users with schedule permission; only on certain reports): weekly, monthly, quarterly, yearly; specific time; recipient emails; file format. [ZB]
- **Scheduled Reports page** (admins / full access): frequency, scheduled-by user, recipients, status, next due date, file format; Mark as Inactive / Active via Report Scheduler pop-up. [ZB]
- **Weekly Summary report** (Settings > Preferences > General "Send Weekly Summary report"): to admins every Sunday; income & expenditure, cash flow, transaction overview, active projects, alerts, feature updates. [ZB]
- **Role-based report access** (custom roles only; predefined not editable): "Enable full access for all reports" or per-report-group per-report permissions; full access needed to view scheduled reports & configure layouts; new reports need role re-edit. [ZB]
- **Share Report** (admins / users with Share permission): pick users + level (View only / View and Export; manage page also mentions schedule); "Skip Module Access" checkbox; modify level via Permissions dropdown; Remove. [ZB]
- **Export As** (file format chooser) and **Print** icon on reports. [ZB]
- **Drill-down**: click any amount/account for detailed summary. [ZB]

### 7.14 Custom Reports / Report Builder

- **Custom Reports** ("only for certain plans"): Create New Report or Create From Existing Report. [ZB]
- **Create New Report**: Parent Module dropdown; + Child Module(s) (delete icon); Show Related Records Only (default) vs Show All Records. [ZB]
- **Steps**: 1 General (Date Range – changeable after save; Group By; Advanced Filters; for existing: Report Basis, Filter Accounts, Compare With) → 2 Show/Hide Columns → 3 Report Layout → 4 Report Preferences. [ZB]
- **Customize Rows and Columns** (from existing financial reports): Account Group (new row or child row; Group Name, Preferences, Account Criteria); Text Field row; Formula Row (accounts/groups/formulas + operators, Check Syntax); Refresh Preview. [ZB]
- **Report Layout**: Choose Details to Display (Org Name, Report Basis, Page Number, Generated By/Date/Time); Table Density; Paper Size A4/Letter; Orientation; Font Family; Margins. [ZB]
- **Report Preferences**: Report Name; Name in Export; Description; Configure Permissions: Only Me / Only Selected Users & Roles (per-user access) / Everyone — governs view, export, schedule. [ZB]
- **Schedule custom report** from details page. [ZB]
- **Admin powers**: view/edit/clone/delete other users' custom reports (My Reports > Other User Reports). [ZB]

### 7.15 Business Overview reports

- **Profit and Loss**: Operating Income; COGS; Operating Expense; Non Operating Income/Expense; filters Date Range, Report Basis, Filter Accounts, Compare (period/year, reporting tags, projects), Advanced Filters. [ZB]
- **Horizontal Profit and Loss** (T format; accrual only): Expense side (Opening Stock, Purchases, Vendor Credits, Inventory Adjustments, op/non-op expenses); Income side (Closing Stock, Sales, op/non-op income); Date Range filter. [ZB]
- **Cash Flow Statement**: Operating, Investing, Financing, Net Change in cash; Date Range; Compare. [ZB]
- **Balance Sheet**: Assets (Current Assets, Cash, Other Current Assets), Liabilities & Equities; Date Range, Report Basis, Filter Accounts, Compare. [ZB]
- **Horizontal Balance Sheet**: side-by-side, single year; Date Options, Report Basis, Filter Accounts. [ZB]
- **Business Performance Ratio**: 8 ratios w/ dashboard each — Current, Gross Profit, Debt, Net Profit, Acid Test, Receivable Turnover, Debt To Equity, Operating Cost; As of Month/Month Range; Date Range. [ZB]
- **Cash Flow Forecasting** ("only for certain plans"): forecast from recurring invoices, bills, journals, expenses; Total Money In/Out, Beginning Actual Balance, Ending Projected Balance; actual (green) vs forecast (orange) graph; Refresh Report. [ZB]
  - Customise Forecast Inputs: include/exclude recurring profiles (Configure → Add Items → Apply).
  - Assumptions: Name, Description, Account, Amount with credit/debit dropdown, "Mark this as a recurring assumption", Assumption Period or date, "Include this assumption in the cash flow forecast".
- **Movement of Equity**: Opening Balance; Changes (Capital Stock, Current Year Earnings, Distributions, Dividends Paid, Drawings, Investments, Opening Balance Offset, Owner's Equity, Retained Earnings); Closing Balance; Compare With tags/branches. [ZB]

### 7.16 Sales reports

- **Sales by Customer** (excludes drafts): Name, Invoice count, Sales, Sales with tax; sort by name; filters: Date Range; Include "Sales without Invoices" and "Sales Returns"; Include Manual Journals. [ZB]
- **Sales by Item**: Item name, Quantity sold, Amount, Average price; filters Date range, Account, Reporting tags. [ZB]
- **Order Fulfillment by Item**: Item, SKU, Ordered, Cancelled, Dropshipped, Force Fulfilled, Backordered Qty, To Be Packed/Shipped/Delivered/Invoiced, Available To Pick, Yet To Pick; Group By (+ total row per group); Advanced Filters (Locations, Items, Contacts, SO custom fields). [ZB]
- **Sales by Sales Person**: Invoice & Credit Note sections (by user "Others" vs by sales person), Count, Sales, Sales with tax; Total = invoices − credit notes; period dropdown. [ZB]
- **Sales Summary** (per date: Invoice Count incl. sales receipts, Total Sales, Total Sales With Tax, Total Tax Amount; net of credit notes); Group By; Share Report. [ZB]
- **Profit by Item**: Item, SKU, Margin %, Quantity Sold, Total Sales, Total Sales With Tax, Total Cost, Profit, Marketplace Fees; Report By Invoices / Invoices & Credit Notes; Advanced Filters (Item, Locations). [ZB]

### 7.17 Receivables reports

- **Customer Balance Summary**: Customer Name, Invoiced Amount, Amount Received, Closing Balance; As of/Date Range; Group By; "Exclude customers with zero closing balance"; Advanced Filters (Branch, GST Treatment). [ZB]
- **Aging Summary**: default buckets Current, 1–15, 16–30, 31–45, >45 days; As of; Aging By (Invoice Due Date / Invoice Date); Aging Intervals (length & count); Group By (Salesperson / Currency); Show By (Outstanding Invoice Amount / Invoice Count); include Credit Notes / Manual Journals; Schedule. [ZB]
- **Aging Details**: Date, Transaction#, Status, Customer Name, Age, Amount, Balance Due; Customer Name filter; Group By Customer/Salesperson/Currency. [ZB]
- **Invoice Details**: Date Range; Report By Invoice Due Date/Invoice Date; Invoice Status; + Advanced Filters (+ Add more). [ZB]
- **Retainer Invoice Details**: retainers, projects, total & unused; Retainer Invoices Status filter. [ZB]
- **Sales Order Details**: Date Range; Status. [ZB]
- **Quote Details**: Report By Quote Date / Expiry Date; Quote Status. [ZB]

### 7.18 Payments Received reports

- **Payments Received**: drill-down; Transaction Type (Invoice Payment / Retainer Payment / All); advanced filters; schedule. [ZB]
- **Time to Get Paid**: buckets 0–15, 16–30, 31–45, >45 days. [ZB]
- **Credit Note Details**: Credit Note Amount, Balance Amount; Credit Note Status filter. [ZB]
- **Refund History**: refunds against credit notes. [ZB]

### 7.19 Payables reports

- **Vendor Balance Summary**: Vendor Name, Billed Amount, Amount Paid, Closing Balance. [ZB]
- **Purchase Order By Item**: P.O#, Vendor, Item, Qty Ordered, Qty Cancelled, Qty Billed, Amount, Location. [ZB]

### 7.20 Inventory & Inventory Valuation reports

- **Inventory Summary**: Item Name, SKU, Reorder Level, Quantity Ordered, Quantity In, Quantity Out, Stock on Hand, Committed Stock, Available for Sale, In-Transit, Usage Unit; filters As of (This Month/Quarter/Year/Custom), Group By, Mode of Stock Tracking (Bills & Invoices / Shipments & Receipts), Do not include Transfer Orders, Warehouse, Stock Availability, Advanced (Locations, Item, Reporting Tag). [ZB]
- **Inventory Aging Summary**: buckets 1–3, 4–6, 7–9, 10–12, 13–15, >15 days with qty + Asset Value; Stock Type (No Criteria / Moving / Not Moving); Aging Intervals count; Intervals of N Days/Weeks/Months/Years; exclude Transfer Orders. [ZB]
- **Inventory Valuation Summary**: Item, SKU, Stock on Hand, Inventory Asset Value; drill-down opening/closing stock movement; item filter. [ZB]
- **FIFO Cost Lot Tracking** (Inventory Valuation folder): Product In (Date, Transactions, Received From, Item, Quantity, Age, Cost Per Unit, Total); Product Out (Date, Transactions, Dispersed To, Qty Dispersed); filters Date Range, Item Name, "based on Product Out transactions", Location Name. [ZB]
- **ABC Classification**: Item, Cumulative Value, Cumulative Share, Current Class, Previous Class; Classify Based on Usage Value (qty×cost) / Quantity; Percentages for A/B/C (sum ≤100); >1000 items → export only; Import previous export (Overwrite, Character Encoding, field mapping) to populate Previous Class. [ZB]
- **Inventory Adjustment Summary**: Reference Number, Date, Status (Draft/Adjusted), Reason, Adjustment Type (quantity/value), Qty Increased/Decreased, Value Increased/Decreased; Group By Date/Reason/Adjustment Type; Share (View only / View and Export, Skip Module Access). [ZB]
- **Inventory Adjustment Details**: per-adjustment Quantity Adjusted, Value Adjusted; same filters/share. [ZB]
- **Shipment by Item**: Shipment Order#, Shipment Date, Status, Package#, Item, Quantity Shipped; Group By; Advanced (Locations, Items). [ZB]

### 7.21 Direct Taxes reports

- **TDS Receivables Summary**: TDS Section, Total, Total After TDS Deduction, Tax Deducted At Source (invoices, bills of supply, customer debit notes, credit notes); verify vs Form 26AS; Report Basis; Group By Customer / TDS Section (default); column customise; filter by customer, branch. [ZB]

### 7.22 Activity / Audit reports

- **Activity Logs**: Time, Activity Details (module, account, contact), Description (action + user); immutable (no user/admin can modify). [ZB]
  - Filters: Date Range; Activity Related To (module or action e.g. Reconciliation, Bank Accounts and Feeds); Vendor/Customer Name; User; Actions (All/Create/Update/Delete); PII Fields only.
  - Export As; Print.
- **Audit Trail**: version history per record via activity arrow; Compare any two versions side-by-side; colours Yellow=edited, Pink=removed, Green=added. Covers invoices, bills, payments, journals, recurring profiles, quotes, SOs, POs, delivery challans, credit/debit notes, refunds, items, contacts, currencies, opening balances, tax/GST settings, bill of supply, bill of entry, shipping bills, sales receipts, transfers, owner drawings/contributions, reporting tags etc. [ZB]

Sources: https://www.zoho.com/in/books/help/reports/ ; .../reports/manage-reports.html ; .../reports/custom-reports.html ; .../reports/business-overview.html ; .../reports/sales.html ; .../reports/receivables.html ; .../reports/payments-received.html ; .../reports/payables.html ; .../reports/inventory.html ; .../reports/inventory-valuation-reports.html ; .../reports/direct-taxes.html ; .../reports/activity.html

### 7.23 Automation — Workflow Rules

- **New Workflow Rule**: Workflow Rule Name; Description; Module. Runs in background. [ZB]
- **Workflow Type – Event Based**: Action Type Created / Edited / Created or Edited / Deleted / Submitted (for approval) / Approved / Rejected. [ZB]
  - "Execute the workflow when": any field updated; any selected field updated; all selected fields updated; any selected field not updated; all selected fields not updated (≤3 fields).
  - "Execute when the record is": Edited for the first time / Edited each time.
- **Workflow Type – Date Based**: Date of Execution (N days before/after a record date field); Execution Time; Execution Cycle Once/Daily/Weekly/Monthly/Yearly; applies only to records created/edited after rule setup. [ZB]
- **Criteria**: field + comparator + value; AND/OR; editable CRITERIA PATTERN; up to 10 criteria per workflow, 10 conditions each. [ZB]
- **Actions**: Immediate Actions or Time Based Actions (EXECUTION TIME); Type = Email Alerts / Field Updates / In-app Notifications / Webhooks / Functions; + Add New Action; Associate. [ZB]
- **List actions**: Change Order (per module, Save Reorder); Edit; Clone; Mark as Inactive/Active; Delete; filter by Module / Status. [ZB]
- **Usage Stats**: daily total vs triggered counts for functions, webhooks, email alerts. Daily limits vary by plan. [ZB]

### 7.24 Automation — Workflow Actions

- **Email Alerts**: Name; Module; From (verified sender or "Created By"); Email Template (+ New Email Template); Email Recipients (users & roles); Cc; Bcc; Attachments (module-dependent). Max 5 email alerts per workflow rule; daily send count varies by plan. Filter by module; delete breaks linked rule. [ZB]
- **Field Updates**: Name; Module; Field + value; "Update with empty value?" checkbox. Max 3 per workflow rule. [ZB]
- **In-app Notifications**: Name; Module; Recipients (users, roles, associated contacts); Message with Insert Placeholders; shown under bell Notifications icon. [ZB]
- **Webhooks**: [ZB]
  - URL and Parameters (event type, + New Placeholder); Method POST (default) / PUT / DELETE.
  - Custom Parameters (Parameter Name/Value, + New Parameter, e.g. AuthToken/API Key); HTTP Headers (+ New Header).
  - Security Preferences: General (basic auth, API auth, none) or Connections; optional secret token (alphanumeric 12–50 chars, non-viewable after save) → HMAC-SHA256 signature in header X-Zoho-Webhook-Signature over alphabetically-sorted key-value pairs + raw JSON.
  - Body: Default Payload (JSON, all module params) / x-www-form-urlencoded / Raw (JSON).
  - Save and Execute (test) / Save. Note: contacts' name/phone/address/email shared with URL.
  - Delivery: statuses Success (2xx) / Failed (non-2xx incl. 3xx, timeout) / Skipped (daily limit); connect timeout 5s, read 10s; default 5 retries then exhausted; custom up to 20 retries (fixed / additive / multiplicative); failure notification after ≥20 consecutive failures; manual retry of exhausted (not counted against plan-based daily limit).
- **Functions (custom functions)**: Name; Description; Module; Programming Language (Deluge in editor; others via Zoho Finance CLI with context methods for logging, caching, queues, file storage, scheduled execution, connectors). [ZB]
  - Custom Execution Status codes: 1000 Success, 1001 Failure, 1002 Canceled, 1003 Invalid input, 1004 Validation failed, 1005 External service error, 1006 Permission denied, 1007 Record not found, 1008 Limit exceeded, 1009 Unknown error (return map w/ code + message shown to user).
  - Deluge Components Usage (per Day): invoke_url_api, webhook, email — Total/Used/Remaining.
  - Connections link in editor header.
  - Supported modules: Users, Organisation, Quotes, Invoices, Sales Orders, Purchase Orders, Customers, Recurring Invoices, Expenses, Bills, Recurring Bills, Items (field maps documented: e.g. organisation map org_id, name, time_zone, language_code, date_format, currency, address, phone, portal_name; invoice map due_date, payment_expected_date, discount, shipping_charge, adjustment, sub_total, tax_total, total, balance, price_precision, custom_fields, salesperson…).
  - Filter by module; Edit; Delete (permanent; linked rule stops executing).
- **Schedules** ("only for certain plans"): + New Schedule: Name; Frequency Daily (exclude weekends) / Weekly (weekday) / Monthly (date or nth weekday) / Yearly; Start Date & Time (≤1 year ahead); expiry after N executions / on date / never; Deluge function; Save / Save and Execute; max 20 schedules; View Logs (last 3 months, log IDs); Edit; Mark Inactive/Active; Delete. [ZB]

### 7.25 Automation — Workflow Logs

- **Workflow Logs** (only users with Workflow Rules manage permission): tabs Custom Functions / Webhooks / Email Alerts; columns Time of Execution, Workflow Rule, Module, Record, Status (Success/Failure). [ZB]
- **Log detail**: Execution Time, Workflow Rule, Record, Status, Response, Failure Reason, Retry Attempts. [ZB]
- **Configure Failure Preferences**: [ZB]
  - Usage Limit Notifications (threshold; admins also get in-app) — email alerts, webhooks, functions.
  - Failure Notification digest: Frequency Hourly/Daily/Weekly/Monthly; Time; Email Recipients.
  - Retry Policy (webhooks, functions; off by default for functions — Enabled toggle): Retry Method Fixed interval / Additive / Multiplicative; Retry interval (Minutes/Hours); Additive or Multiplicative factor; Retry count; Pattern preview.
- **Filter** (Status, Workflow Rule, Module, Date Range); **Export** CSV/XLS. [ZB]

### 7.26 Customization — Custom Fields

- **Fields tab** per module (help page shows "Available Plans"); Standard Fields and AI Fields (e.g. Sentiment Analysis on an Input Custom Field → Positive/Negative/Neutral). [ZB]
- **New Field**: Label Name; Data Type; Help Text; Data Privacy (PII → Sensitive encrypt / Not sensitive; ePHI encrypted, no advanced search; PII allowed on Text, Email, URL, Phone, Number, Date); Prevent Duplicate Values; Input Format; Default Value (or Inherit value from related module field); Is Mandatory; Show in All PDFs. [ZB]
- **Input Format standard formats**: Numbers; Alphanumeric without spaces; Alphanumeric with spaces; Alphanumeric with hyphens & underscores; Alphabets without spaces; Alphabets with spaces; or Configure Custom Format (regex). [ZB]
- **API Field Name** visible on edit. [ZB]
- **Limits per type bucket** (Numerical, Decimal, String, Boolean, Long Text, Multi-select, Formula) vary by plan; Custom Fields Usage view. [ZB]
- **Configure Access** per role: Read and Write / Read Only / Hide Field (Admin always full). [ZB]
- **Mark Inactive/Active; Delete / Force Delete** (removes data); enabling uniqueness on >10,000 records is async with in-app notice. [ZB]

### 7.27 Customization — Custom Views

- **Views dropdown**: Favorites; Default Filters (system, non-editable); User-created views; search. [ZB]
- **New View**: Name; Mark as Favorite; criteria (field/comparator/value, + Add Criterion); Columns Preference (Available→Selected, drag reorder); Use Custom View In (other Zoho apps e.g. Billing, Inventory); Share With Only Me / Only Selected Users & Roles / Everyone. Edit/Delete own views. [ZB]

### 7.28 Customization — Custom Buttons

- **Buttons** (help page shows "Available Plans"): modules Users and Preferences, Customers and Vendors, Projects, Sales, Purchases, Items; max 10 buttons/links per module. [ZB]
- **New Button**: Button Name; Action Type Execute Task / Open URL / Convert Record (custom modules); Location Details Page / List Page – Action Menu / List Page – Bulk Action Menu (Execute Task only); Visibility & URL with Insert Placeholders (Open URL). [ZB]
- **Execute Task config**: Deluge script; When to show: Show Always / Show based on criteria (criteria templates, Invoices & Quotes details page only); Who can access: Only me / Only Selected Users / Everyone; Save / Save and Execute. [ZB]
- **Reorder** per Location (Change Order); View Logs → Workflow Logs; Edit; Delete. [ZB]

### 7.29 Customization — Validation Rules

- **Validation Rules tab** (help page shows "Available Plans"): Rule Name; + Add Rule (condition); Alert Message; multiple rules; blocks save when violated; applies to integrated Zoho apps (e.g. Inventory). [ZB]
- **Based on specific criteria** (multiple criteria, editable pattern) and **Subrules** (extra criteria + alert). [ZB]
- **Edit; Mark Inactive/Active; Delete**. [ZB]

### 7.30 Customization — Record Locking

- **Record Locking** ("only in specific plans"): modules Items, Invoices, Quotes, Sales Orders, Credit Notes, Custom Modules. [ZB]
- **New Lock Configuration**: Name; Description; Allow or Restrict Actions (Restrict All / Restrict Selected / Allow Selected); Allow or Restrict Fields (Items & custom modules only; Restrict All / Restrict Selected / Allow Selected); Lock Records For All Roles / All Roles Except (selected roles). [ZB]
- **Lock a record**: More > Lock; pick configuration + Reason; lock icon shows reason, user, timestamp, config. **Unlock** with reason. [ZB]
- **Config lifecycle**: Edit; Mark Inactive (existing locks stay); Mark Active; Delete (unlocks records). [ZB]

### 7.31 Customization — Related Lists

- **Related Lists** (help page shows "Available Plans"): modules Items, Customers & Vendors, Sales (Quotes, Invoices, SOs, Retainer Invoices, Credit Notes), Purchases (Expenses, Bills, POs, Vendor Credits), Projects; max 10 per module. [ZB]
- **Via Lookup custom field** (auto list in target module) or **via Deluge script** (Name; Who can view Only Me/Everyone; returns header_context + data, values as string or hyperlink {value,isExternal,link}; optional page_context page/per_page/has_more_page). [ZB]
- **Edit/Delete** only Deluge-based lists; Mark Inactive/Active. [ZB]

### 7.32 Developer & Data — Connections, Incoming Webhooks, Web Forms, Backup

- **Connections** (used in Functions, Buttons, Schedulers): Predefined (Pick Your Service: Connection Name, Scope, "Use credentials of login user", Create and Connect) and Custom Service (Service Name, Authentication Type, Param Type, Client ID, Client Secret, Authorise URL, Access token URL, Refresh token URL, Connection Name, Scope); code snippet for Deluge use. [ZB]
- **Incoming Webhooks** (Settings > Developer Space): Name, Description, Deluge function; generates OAuth URL and ZAPI Key URL; Regenerate; attributes Header/Params/Body; View Logs; Edit/Delete. [ZB]
- **Web Forms** ("only in specific plans"; tied to Custom Modules): Name; Custom Module (+ New); Layout; Configure Preferences: Success Message (rich text), Redirect to another page (new tab / same tab), Display CAPTCHA; URL Copy; sensitive-field forms flagged Spam & unpublishable; URL prefill via ?cf_api_name=value; Report abuse; Web Forms Pending Approval (Accept / Delete); Edit Layout; Mark Inactive/Active; Delete; blocked forms. [ZB]
- **Data Backup** (Settings > Data Management): Backup Data CSV/XLS; include PII option; File Protection Password (≥12 chars, upper, lower, number, special); emailed link (≤30 min), expires 30 days; once per 15 days; Backup History. [ZB]
- **Back Up Documents** (ZIP of attachments since previous backup; once/15 days; link 30 days). [ZB]
- **Back Up Audit Trail** (ZIP; once/15 days; link 60 days). [ZB]
- **Import History**: user, module, file name, uploaded date, status, imported rows; filter Select User / Select Module. [ZB]

Sources: https://www.zoho.com/in/books/help/settings/automation/workflow-rules.html ; .../automation/workflow-actions/email-alerts.html ; .../workflow-actions/field-updates.html ; .../workflow-actions/in-app-notifications.html ; .../workflow-actions/webhooks.html ; .../workflow-actions/custom-functions.html ; .../automation/schedules.html ; .../automation/workflow-logs.html ; .../customization/custom-fields.html ; .../customization/custom-views.html ; .../customization/custom-buttons.html ; .../customization/validation-rules.html ; .../customization/record-locking.html ; .../customization/related-lists.html ; .../settings/connections.html ; .../developer-and-data/incoming-webhooks.html ; .../developer-and-data/web-forms.html ; .../developer-and-data/backup.html

### 7.33 Currencies & Exchange Rates

- **Multi-currency** ("only in certain plans"); base currency from org location (India → INR); Settings > Setup & Configurations > Currencies. [ZB]
- **New Currency**: Currency Code; Currency Symbol; Currency Name; Decimal Places; Format. Edit; Delete (no transactions, not base). [ZB]
- **Exchange Rate Feeds** (Open Exchange Rates, default enabled); Disable/Enable feeds; manual + Add Exchange Rate (Date effective-from, Rate); View Exchange Rates; delete manual rate (past txns keep rate); Base Currency Adjustments. [ZB]

### 7.34 Emails (Email Notifications settings)

- **Sender Email Preferences**: Unauthenticated vs Authenticated (DKIM) domains; unauthenticated From replaced with message-service@sender.zohobooks.com (Reply-To kept); Authenticate Now (Host Name + Value, Validate; GoDaddy host tweak); with Locations/Branches emails sent from location/branch primary contact. [ZB]
- **Sender actions**: Mark as Primary Contact (default From); + New Sender (Name, Email, verification mail, Resend Email); Edit/Delete. [ZB]
- **Email Relay (custom SMTP)**: + New Server; Server Name; Port; Daily Mail Limit; Use Secure Connection; Mail Delivery Preference Domain-based / Email-based; Domain in this Server; Authentication Required (Username/Password); enable toggle. [ZB]
- **Email Insights**: "Track the emails sent to your customers" for Invoices, Retainer Invoices, Quotes; list icons sent / opened / viewed in portal; "Client Viewed" filter; status in Comments & History; web-beacon pixel tracking. [ZB]
- **Email Templates** per module: + New / clone prebuilt; Template Name; From/CC/BCC; Subject; body editor (Insert Image upload/URL with size, position, alt text; links; Insert Placeholders); Set this to default; Edit Signature; up to 5 attachments × 5MB. [ZB]
- **Associate Templates** with a customer/vendor (More > Associate Templates) → default for that contact. [ZB]

Sources: https://www.zoho.com/in/books/help/settings/currencies.html ; https://www.zoho.com/in/books/help/settings/emails.html

### 7.35 GST TDS (Settings > Taxes > GST TDS Settings)

- **Enable GST TDS** toggle; "Enable GST TDS For" Customers / Vendors / both; auto-creates GST TDS taxes. Rate 2% (1% CGST + 1% SGST intra; 2% IGST inter); threshold contract value > ₹2.5 lakh. [ZB]
- **Contact flag** "Is GST TDS applicable?" (auto-on for customer GST Treatment = Tax Deductor at creation). [ZB]
- **Transaction**: "Select a GST TDS" dropdown above items (invoices, bills); per-line "Deduct GST TDS" via Show Additional Information; Bulk Update Line Items → Remove GST TDS; GST TDS section total; no accounting impact until payment. [ZB]
- **Record Payment**: "GST TDS Deducted?" Yes → GST TDS Amount; Amount Received 0 to record TDS-only; Payments Received/Payments Made: Add GST TDS / Clear GST TDS per unpaid invoice/bill. [ZB]

### 7.36 Income TDS (Direct Taxes)

- **Applicable transactions**: Quotes, Sales Orders, Invoices, Credit Notes, Recurring Invoices, Customer Debit Notes, Payments Received, Purchase Orders, Bills, Recurring Bills, Vendor Credits, Bill of Supply, Vendor Advance. [ZB]
- **TDS preference** (Settings > Direct Taxes): Transaction level (default) or Line Item level (TDS column in item table). [ZB]
- **Transaction-level TDS**: TDS option in Total section → rate dropdown applied on Sub Total; Manage TDS (create rate). [ZB]
- **TDS Override**: edit icon to change deducted amount (transaction level only). [ZB]
- **TDS Surcharge / TDS Cess** (+ New TDS Tax menu; Tax Name, Rate, Tax Payable Account, Tax Receivable Account; bills only); **+ New TDS Group** combining rates. [ZB]
- **TDS on Vendor Advance**; **TDS Withheld** recorded at payment. [ZB]

### 7.37 Opening Balances

- **Opening Balance Date**; accounts grouped AP/AR, Assets, Expenses, Liabilities, Bank Accounts, Equity, Income. [ZB]
- **AR/AP balances**: Import (CSV/TSV/XLS, sample file, field mapping); or import contacts with balances (decimal places option); or per contact Opening Balance (Other Details) / Enter Opening Balance / View Opening Balance on Receivables/Payables. Outstanding Opening Balance reduces with non-invoice payments. Vendor balance import requires AP=0. [ZB]
- **Other accounts**: Edit → Debit/Credit per account; Available Balance shown (pre-date txns); + New Account; difference → Opening Balance Adjustment account; Continue → Confirm. [ZB]
- **Sync** pre-opening-date transactions to adjust balances. [ZB]
- **New Account fields**: Account Name; Account Type; Account Code; Description; "Add to the watchlist on my dashboard". [ZB]

### 7.38 Organization Profile

- **Access**: Admin or custom role with "Update Organization Profile"; changes sync to other Zoho Finance apps (Billing, Inventory, Invoice, Payroll, etc.). [ZB]
- **Basic Details**: Organization Name (≤100 chars); Logo (240×240 @72DPI, ≤1MB, JPG/JPEG/PNG/BMP/GIF; per-location logos); Industry; Organization Location (fixed after creation). [ZB]
- **Address**: Edit address → apply to "Update New Transactions" or "Update All Transactions"; "Different Address for Payment Stubs" (remittance, ≤255 chars; needs Include Payment Stub on invoice template). [ZB]
- **Contact**: Primary Contact email (default From; change via Sender Email Preferences); public-domain senders replaced unless Change Settings (Zoho Books Email Address / Sender's Email Address); Website URL. [ZB]
- **Regional Settings**: Base currency (India→INR, locked); currency Gear: Symbol (₹ → Rs), Name, Decimal Places, Format (e.g. 12,34,567.89), Rounding Method (e.g. Round Half Up); Fiscal Year (e.g. April–March) + Start Date; Report Basis Accrual/Cash; Language (incl. Hindi, Tamil, Telugu, Gujarati, Kannada, Marathi + ~25 others; CoA/templates/tax names don't translate); Time Zone (auto); Date Format + separator (-, /, .). [ZB]
- **Additional Settings**: Company ID (label + number); Tax ID (legacy; now Tax Registration Number in Tax Settings); Additional Fields label/value pairs; all usable via Organisation Address format placeholders on PDFs. [ZB]

### 7.39 Locations (multi-branch / multi-GSTIN / warehouses)

- **Enable Locations** (irreversible; org becomes Head Office/Primary); upgrade of legacy Branches (Migrate to Locations banner). [ZB]
- **Location types**: Business Location (up to 5-level hierarchy) and Warehouse Location (stock only, no sub-locations). [ZB]
- **Add Location**: Location Type; Name; "This is a Child Location" + Parent; Primary Contact; Transaction Number Series; Default Transaction Number Series; Location Access users ("Provide access to all users"); per-location logo/address. [ZB]
- **Transaction Series Preferences**: + New Series: Series Name, branch, Prefix, Starting Number, Restart Numbering (Yearly), Preview. [ZB]
- **Role access**: only Admin by default; custom role Locations permissions in General tab. User sees txns per location association + role segmented access. [ZB]
- **Usage**: location on sales, purchase, manual journals, bank txns, e-Way bills; import with location mapping; Dashboard All Locations filter; Advanced Search by Location; location locked after payments/credits applied. [ZB]
- **Other**: Mark as Primary (star); Edit; Mark Inactive; Delete. [ZB]

### 7.40 Payment Terms

- **Defaults**: Due end of the month; Due end of next month (+ others). [ZB]
- **New Payment Term**: Term Name; Due After (days). [ZB]
- **Apply**: Terms dropdown on transactions (+ New Payment Term inline); Bulk Update field "Payment Terms" with reason; contact-level Payment Terms auto-applied to new transactions. [ZB]
- **Manage**: Edit (future txns); Set As Default (applies to new txns/contacts; default can't be deleted/inactivated); Mark Inactive/Active; Delete (not if associated with contact). [ZB]

Sources: https://www.zoho.com/in/books/help/settings/gst-tds.html ; .../settings/income-tds.html ; .../settings/opening-balances.html ; .../settings/organization/organization-profile.html ; .../settings/organization/locations/ ; .../locations/basic-functions.html ; .../locations/functions.html ; .../locations/other-actions.html ; .../settings/payment-terms.html

### 7.41 Preferences — General

- **Enable Modules** (shown in sidebar; API access regardless). [ZB]
- **Zoho Inventory Add-on** (requires Inventory org on Standard/Professional plan). [ZB]
- **First Day of Work Week**: Sunday (default) / Monday / Saturday. [ZB]
- **Attach PDF links of Quotes and Invoices** in emails; **Encrypt PDF Files** (no edit/convert). [ZB]
- **Do you give discounts?** (sales only): I don't give discounts; At Line Item Level (Discount inclusive of tax / exclusive of tax); At Transaction Level (Discount Before Tax / After Tax); At Line Item Level and at Transaction Level (pre-tax; Global & India editions; plan-dependent). [ZB]
- **Additional charges**: Adjustments; Shipping Charges. [ZB]
- **Salesperson field** ("I want to add a field for salesperson") → Sales by Salesperson report. [ZB]
- **Profit Margin** (plan-dependent): "Enable Profit Margin estimation at line item and transaction level"; Cost Price column methods Purchase Rate / Inventory Valuation Method (FIFO/WAC lots) / Item Record / Custom; per-line & transaction margin (excl. tax, shipping, adjustments; reduced by discounts); role field access for Cost Price & Profit Margin; visible in Quote/Invoice/SO Details reports. [ZB]
- **Default income account for billable bills & expenses** (non-inventory items) and **default Markup %** prefilled in "Mark up by". [ZB]
- **Send Weekly Summary report** (admins; Slack channel if integrated). [ZB]
- **Organization Address Format** (Insert Placeholders, reorder). [ZB]
- **Secure Public Links**: "Enable identity verification to view quotes, invoices, and purchase orders" (verify email/phone; payments & quote accept still allowed; vendors must verify to accept/decline POs). [ZB]
- **Linked preference pages**: Customer Portal (logo, theme, portal settings, custom domain); Vendor Portal (notifications, document upload, accept/reject POs); Customers & Vendors (allow duplicate display names, customer credit limit, billing/shipping address formats); Projects (round off time, max hours/day, timesheet approvals); Accountant (Chart of Accounts, vendor advances, journal fields). [ZB]

### 7.42 Transaction Number Series & Transaction Posting Date

- **Multiple Transaction Series** ("only for certain plans"): Enable Multiple Transaction Series; + New Series (name, branch/location association, prefix + starting number per module); edit default series; delete (auto-generated e.g. recurring use default). Modules: credit notes, journals, customer/vendor payments, POs, SOs, retainer invoices, vendor credits, bills of supply, debit notes, invoices, quotes, sales receipts, self-invoices, delivery challans. [ZB]
- **Transaction Posting Date** field (inactive by default; Fields tab → Mark as Active) for invoices, sales receipts, credit notes, payments received, bills, vendor credits, payments made: journals post on that date; transaction locking uses it; refund date ≥ posting date; bulk-updatable; workflow/custom-view/advanced-search criteria; AR/AP aging "Aging By = Transaction Posting Date"; detail reports "Report By" option. [ZB]

### 7.43 Privacy & Security

- **Role permission "Provide access to protected data"** (PII; default Admin only). [ZB]
- **PII/ePHI custom fields** (text, number, email, URL, date, phone). [ZB]
- **Restricted export**: users without PII access can't export sensitive data (SSN, bank account no., sensitive custom fields); permitted users tick "Include Sensitive PII" on export. [ZB]

### 7.44 Reminders

- **Manual reminders (Invoices tab)**: Reminder For Overdue Invoices; Reminder for Sent Invoices; editable content + Insert Placeholders; send from invoice Reminders > Send Now. [ZB]
- **Automated reminders – due date based**: 3 defaults (before / on / after due date); name; recipients (me / customer / both); days before/after; content; "Enable this reminder"; Delete Reminder; + New Reminder. [ZB]
- **Expected Payment Date reminders** (to org users); on invoice: Reminder > Expected Payment Date + "Don't remind about payment until then"; Stop Reminders per invoice. [ZB]
- **Bills reminders** (to users; due date or expected payment date). [ZB]

### 7.45 PDF Templates

- **Modules**: Quotes, Sales Orders, Delivery Challans, Invoices, Credit Notes, Purchase Orders, Purchase Receives, Retainer Invoices, Payment Receipts, Retainer Payment Receipts, Checks, Customer Statements, Bills, Expenses, Vendor Credits, Vendor Payments, Vendor Statements, Journals, Quantity Adjustments, Value Adjustments, Item Barcodes, Custom Modules. [ZB]
- **General tab**: Template Name; Paper Size A4/Letter; Orientation; Margins (in); Include Payment Stub (invoices); PDF Font; Label/Font Colour; Font Size; Background Image + position; Background Colour. [ZB]
- **Header & Footer**: header background image (≤1MB)/colour; header content with placeholders; "Apply to first page only"; footer font, colour, image, Show Page Number, custom content (placeholders, tables, links). [ZB]
- **Transaction Details**: Show Organisation Logo + resize; Show Organisation Name/Address; Organisation Address Format; Show Dispatch From Address + format (e-Invoicing only); Customer Name style; Bill To / Ship To + address formats; Vendor details; Show Document Title; Document Information field toggles + label rename. [ZB]
- **Table**: label fields; Customise Item Name and Description (placeholders); project labels (invoices); cell widths; header/row/description fonts & colours. [ZB]
- **Total**: Show Total Section (Sub Total, Shipping, Discount, Total Taxable Amount, Tax Details, Total, Currency Symbol, Quantity); Show Payment Details (Payments Made, Credits Applied, Amount Withheld, Write Off, Balance Due); Show Amount in Words; Show Tax Summary Table; Show Retainer Tax Summary. [ZB]
- **Other Details**: Notes; Payment Options (online gateways); Add your bank details; Show Invoice QR Code; Terms and Conditions; Signature (image + name); e-Invoicing Details (QR Code, IRN, Ack No., Ack Date); Annexure content; Attach Annexure Documents (appended pages). [ZB]
- **Receipt-specific tabs**: Invoice Details / Bill Details tables; Receipt Information (Received From format, Amount Received/Paid, signature). [ZB]
- **HTML PDF Templates** (HTML+CSS editor). [ZB]
- **Actions**: Select Colour Theme; Preview; Set as Default; per-customer/vendor template association; Clone As (other module); Delete (not default/associated); Force Delete (reassigns txns, customers, customer groups to default). [ZB]

Sources: https://www.zoho.com/in/books/help/settings/preferences.html ; .../settings/privacy.html ; .../settings/reminders.html ; .../settings/pdf-templates/ ; .../settings/pdf-templates/edit-templates.html

### 7.46 Taxes (GST settings, rates, groups, exemptions, MSME)

- **GST 2.0 rate migration (22 Sep 2025)**: Home banner "GST Slab Update" → Review Updates (by HSN; composite items; recurring txns; no preview >250 items; downloadable Tax Update file) → Confirm & Schedule on 20/21/22 Sep 2025 + acknowledgement checkbox; or manual export/re-import; items without HSN updated manually; old+new rates shown. [ZB]
- **GST Settings fields**: "Is your business registered for GST?"; 15-digit GSTIN + Get GSTIN Details; GST registration date; "My business is registered for Composition Scheme" + Composition Scheme Percentage (turnover < ₹1.5 cr / ₹75 L NE states); "Enable reverse charge in sales transactions"; "My business is involved in SEZ/Overseas Trading" (Bills of Supply, Shipping Bills) + Custom Duty Tracking Account; "Track sale of digital services to overseas customers" (item flag "It is a digital service"; Overseas Digital Tax Summary report; goods+digital service → IGST 0 only). [ZB]
- **GST with Locations**: every active location must have a GSTIN; Add New GSTIN and Associate Locations (filtered by state code from GSTIN first 2 digits); View Unassociated Locations; Enable GST; Associate GSTIN (Add New GSTIN & Associate / Associate Existing GSTIN) before re-activating location; registration type incl. ISD. [ZB]
- **Additional GSTINs for contacts**: Add Additional Address → Tax Information → Manage Tax Informations → Add New Tax Information (GSTIN/UIN, auto Place of Supply); address choice drives GSTIN on transaction; first is primary. [ZB]
- **Online Filing Settings**: GSTN Username; Reporting Period Monthly/Quarterly; Generate First Tax Return From (month); approval process + approvers. [ZB]
- **Default Tax Preference** per GSTIN: Intra State Tax Rate; Inter State Tax Rate. [ZB]
- **Tax Rates**: + New Tax (Tax Name, Rate %, Tax Type; overseas digital services flag + Country/Region); Edit (updates active recurring profiles); Delete; Mark as Inactive; View Associated Record. [ZB]
- **Tax Groups**: New Tax Group (name + taxes; e.g. GST18 = CGST9 + SGST9; cess combos). [ZB]
- **Tax Exemptions**: + New Tax Exemption (Exemption Reason, Description, Type); Bulk Create Tax Exemptions. [ZB]
- **MSME Settings**: "Is your organisation MSME registered?"; MSME/Udyam Registration Type; Number (UDYAM-XX-00-0000000); MSME/Udyam No placeholders in Org Address Format; vendor "This vendor is MSME registered" + type/number; Update MSME Details wizard (export vendors CSV → fill → import → Complete Migration); Bills view "MSME Vendor Bills Unpaid for 40+ Days" (sec 43B(h), 45-day rule). [ZB]
- **Reverse charge / composition / SEZ / LUT**: reverse charge & composition & SEZ toggles as above; no LUT-specific settings text in crawled pages. [ZB]

### 7.47 TDS & TCS updates (Income Tax Act, 2025)

- **One-click update** (Home banner View Details → Update Now): renumbered TDS sections; old rates end-dated 31 Mar 2026, new rates start 1 Apr 2026; recurring invoices/bills and vendor TDS auto-updated; downloadable affected recurring list (.xls). [ZB]
- **TCS**: old rates end-dated & deprecated; new rates (e.g. 206C(1G) LRS/tour 5%/20% → 2%; 206C(1) liquor/scrap/minerals 1% → 2%; tendu leaves 5% → 2%). [ZB]
- **Manual review**: split sections (194S, 194J(b), 194A, 194C, 194LC(ic), 196B, 196C, 192 → 392/393 variants) and deprecated 194LD; Home lists affected recurring txns. [ZB]

### 7.48 Reporting Tags (Advanced)

- **Enable Advanced Reporting Tags** (irreversible). Associable with Customers, Vendors, Items, Quotes, SOs, Invoices, Recurring Invoices, Credit Notes, Expenses, Recurring Expenses, POs, Bills, Recurring Bills, Vendor Credits, Retainer Invoices, Customer/Vendor Payments, Inventory Adjustments, Sales Receipts, Fixed Assets, Banking, Journals. [ZB]
- **Create**: Reporting Tag Name; Description; Associate This Reporting Tag To (modules; Transaction Level vs Line Item Level for Sales/Purchases/Journals/Inventory Adjustments; Items only with line-level); Make This Reporting Tag Mandatory; status Not Ready → Mark as Ready (needs ≥1 option). [ZB]
- **Configure Options**: up to 5-level parent-child hierarchy; Add Option Above/Below/Add a Child; reorder; delete; option count limit varies by plan; Mark as Default option. [ZB]
- **Visibility Conditions** toggle: Choose Filters (earlier tags or Locations; ≤5 filters, ≤200 option mappings); map options to filter options / All / Untagged; Show Excluded Tags. [ZB]
- **Access Control** toggle (only one tag per org): role-level segmentation; users see only records with assigned options (≤500 options per user); optionally allow untagged records. [ZB]
- **Defaults from masters**: item / customer / vendor tag auto-applied on transactions. [ZB]
- **Reports**: Advanced Filters (tag, comparator, option); Compare Based on Reporting Tags (optional parent-child hierarchy, Select All). Change Order (filter tags must stay above). [ZB]

### 7.49 SMS Notifications (India edition only)

- **Enable**: Use Free SMS (3 messages) / Buy Credits (₹75 per credit = 300 SMS, min 5 credits) / Twilio (External SMS Providers > Configure). [ZB]
- **Notification types**: Customer Balance; Quote Details; Invoice Details (auto for recurring invoices); Payment Reminder; Payment Thank-You (auto on online payments; "Notify via SMS" on manual Record Payment); Payment Retry (failed recurring payments). [ZB]
- **Templates**: "Send SMS without DLT configuration" toggle → choose prebuilt templates (content not editable; Change Template; Notification Status toggle). [ZB]
- **DLT (TRAI)**: register with Vodafone Idea / Videocon / BSNL / Jio / Airtel / Others; Configure DLT Registration (DLT Registration Number, Sender ID, Telecom Operator, Chain ID 1 & 2) → status Pending / Approved / Rejected; Edit DLT Configuration; register templates (Transactional / Promotional / Service Implicit / Service Explicit) → enter Template ID + SMS Template per notification; whitelist URLs; PE-TM binding chain. [ZB]
- **Contact opt-in**: Enable/Disable SMS Notification per primary contact or contact person; bulk via Update Communication Preference (all) or Configure Communication Preferences (selected; None disables). [ZB]
- **Manual send**: Send > Send SMS (choose contact). **SMS Notifications report** (also under Reports > Activity). [ZB]

Sources: https://www.zoho.com/in/books/help/settings/taxes.html ; .../settings/tds-and-tcs-updates.html ; .../settings/reporting-tag.html ; .../settings/sms-notifications.html

### 7.50 Users & Roles

- **Invite User** (Admin only): Name; Email Address; Role; Restrict Access To → Locations tab (locations) and access-controlled Reporting Tag tab (options); ASSOCIATED VALUES pane; email verification + password set. Users see only records matching all associated values. [ZB]
- **User actions**: Edit; Mark as Inactive / Active; Delete; Make Super Admin. [ZB]
- **User additional fields** (User Preferences > Fields): Label Name, Data Type, "Is this PII?". [ZB]
- **Standard roles**: Admin (full); Staff (all modules except reports, settings, accountant); Timesheet Staff (timesheet only); Staff (Assigned Customers Only). Default roles not editable/deletable but access control editable (Edit Access Control). [ZB]
- **Super Admin**: creator; one per org across Zoho Finance apps; sole right to set org up in other apps (approves admin requests) and to delete org; transferable to an eligible admin. [ZB]
- **Custom Role** (New Role / Clone): Role Name; Description; per-module access levels; More Permissions; Proceed → Segmented Access Control tab. [ZB]
- **Permission items named in docs** (not a full matrix): per-module access + Approve (per approvable module) + More Permissions Edit/Delete approved transactions; Reports: "Enable full access for all reports" or per report-group/report permissions incl. schedule & share; Settings: "Provide access to protected data" (PII), "Update Organization Profile"; Locations permissions (General tab); Workflow Rules manage (needed for Workflow Logs). [ZB]
- **Segmented Access Control** per role: Locations → Transaction; Reporting Tags → record types (+ "Allow Access to All Unassigned Records"); Bank Accounts (user associated via Banking > Edit bank > Users). [ZB]

### 7.51 Transaction Approval

- **Approvals tab per module**: Quotes, Sales Orders, Invoices, Retainer Invoices, Credit Notes, Sales Returns, Purchase Orders, Purchase Receives, Bills, Payments Made, Vendor Credits, Transfer Orders, Inventory Adjustments, Custom Modules. Further actions blocked until approved. [ZB]
- **Approval Type**: No Approval (default) / Simple / Multi-Level / Custom. [ZB]
- **Simple Approval**: select Approvers (any one approves); Notification options: notify all approvers when a non-approver submits / when approver or non-approver submits / a specific email address; notify submitter on approve/reject. [ZB]
- **Multi-Level Approval**: up to 10 levels (Add New Level, drag reorder); sequential notifications level by level. [ZB]
- **Custom Approval**: New Custom Approval (Approval Name, Description, criteria + Add Criterion, approval flow or auto accept / auto reject); PRIORITY reorder when multiple match; Edit/Delete; Configure Approval Preferences shared across custom approvals. [ZB]
- **Approval Preferences**: "Allow approvers to approve the transactions they create". **Notification Preferences**: "Send email and in-app notifications when transactions are submitted for approval"; "Notify the submitter when a transaction is approved or rejected". [ZB]
- **Approver roles**: admins approve by default; create role with Approve per module (+ Edit/Delete approved via More Permission); assign to existing user / Invite as approver; or add Approve to existing custom role. [ZB]
- **Workflow triggers** Submitted / Approved / Rejected available in workflow rules (see 7.23). [ZB]

### 7.52 Settings index (other items listed, not detailed in crawled set)

- **Settings hub entries**: Organization Profile; Adding New Organization; Opening Balances; Users; Online Payments (Zoho Payments, Stripe, PayPal, Razorpay, ICICI Bank eazypay, Verifone); Preferences (General, Contacts, Items, Price Lists, Inventory, Sales, Quotes, Sales Orders, Invoices, Recurring Invoices, Credit Notes, Delivery Note, Packing Slip, Purchases, Purchase Orders); Currencies (import/export exchange rates); Taxes; Templates; Automation; ZSC key (Zoho CRM). [ZB]

Sources: https://www.zoho.com/in/books/help/settings/users.html ; https://www.zoho.com/in/books/help/transaction-approval/configure-approvals.html ; .../transaction-approval/simple-approval.html ; .../transaction-approval/multi-level-approval.html ; .../transaction-approval/custom-approval.html ; .../transaction-approval/users-and-roles.html ; https://www.zoho.com/in/books/help/settings/


## 8. Crawl coverage & gaps

- Pages fetched: 400 (main BFS crawl) + 24 (second pass of high-value Books pages) + 2 pricing DOM extractions = **~426 page loads**; 413 returned HTTP 200. Raw text of every page is saved under `scratchpad/crawl/zoho/pages/` (one file per URL), crawl logs in `zoho/crawl.log`, `zoho/crawl2.log`.
- Access notes: `https://www.zoho.com/in/invoice/help/` (the India root index) returns **403** to headless Chromium, but `https://www.zoho.com/invoice/help/` and every `/in/invoice/help/<page>` and `/in/books/help/<page>` URL loaded fine with a desktop UA. No login or sign-up was done.
- Plan tags inside help pages: Books help pages render an "Available plans" widget client-side that was not in the captured text, so per-feature plan availability comes from the pricing comparison matrix (section 4.3) instead of the help pages.

### 8.1 Pages that could not be reached (404 / not found)
- https://www.zoho.com/in/invoice/help/e-invoicing/spain.html (404; not India-relevant)
- https://www.zoho.com/in/invoice/help/online-payments/braintree.html (404)
- https://www.zoho.com/in/invoice/help/online-payments/square.html (404)
- https://www.zoho.com/in/invoice/help/online-payments/authorize-net.html (404)
- https://www.zoho.com/in/invoice/help/online-payments/csg-forte.html (404)
- https://www.zoho.com/in/invoice/help/recurring-invoices/create-recurring-invoice.html (404; content covered by recurring-invoice/new-recurring-invoice.html)
- https://www.zoho.com/in/invoice/mobile-invoicing-app/ (404; Invoice mobile-app marketing page — mobile features taken from the Books mobile page and the Invoice help "Exploring" page)
- https://www.zoho.com/in/invoice/help/ (403 to headless browser; the /invoice/help/ mirror was used)

### 8.2 Known pages not crawled (over the ~400-page budget; lower priority)
- https://www.zoho.com/in/books/help/timesheet/
- https://www.zoho.com/in/books/help/timesheet-approval/customer-approval.html
- https://www.zoho.com/in/books/help/timesheet-approval/internal-approval.html
- https://www.zoho.com/in/books/help/timesheet/chrome-extension.html
- https://www.zoho.com/in/books/help/timesheet/manage-timesheet.html
- https://www.zoho.com/in/books/help/timesheet/other-actions.html
- https://www.zoho.com/in/books/help/timesheet/preferences.html
- https://www.zoho.com/in/books/help/transaction-approval/
- https://www.zoho.com/in/books/help/transaction-approval/transaction-approval-workflow.html
- https://www.zoho.com/in/books/help/vendor-credits/
- https://www.zoho.com/in/books/help/vendor-credits/manage-credits.html
- https://www.zoho.com/in/books/help/vendor-credits/other-actions.html
- https://www.zoho.com/in/books/help/vendor-credits/preferences.html
- https://www.zoho.com/in/books/help/accountant/accountant.html
- https://www.zoho.com/in/books/help/accountant/adjustment-journal.html
- https://www.zoho.com/in/books/help/accountant/budgets.html
- https://www.zoho.com/in/books/help/accountant/bulk-update.html
- https://www.zoho.com/in/books/help/accountant/fixed-assets.html
- https://www.zoho.com/in/books/help/accountant/journal-credits.html
- https://www.zoho.com/in/books/help/accountant/journal-templates.html
- https://www.zoho.com/in/books/help/accountant/manage-clients.html
- https://www.zoho.com/in/books/help/accountant/netting.html
- https://www.zoho.com/in/books/help/accountant/preferences.html
- https://www.zoho.com/in/books/help/accountant/recurring-journals.html
- https://www.zoho.com/in/books/help/accountant/reverse-journals.html
- https://www.zoho.com/in/books/help/accountant/sub-accounts.html
- https://www.zoho.com/in/books/help/billpay-addon/
- https://www.zoho.com/in/books/help/billpay-addon/batch-payments.html
- https://www.zoho.com/in/books/help/billpay-addon/bill-reconciliation.html
- https://www.zoho.com/in/books/help/billpay-addon/po-matching.html
- https://www.zoho.com/in/books/help/billpay-addon/vendor-approvals.html
- https://www.zoho.com/in/books/help/billpay-addon/vendor-onboarding.html
- https://www.zoho.com/in/books/help/contextual-chat/
- https://www.zoho.com/in/books/help/customer-portal/custom-modules.html
- https://www.zoho.com/in/books/help/custom-modules/
- https://www.zoho.com/in/books/help/custom-modules/basic-functions.html
- https://www.zoho.com/in/books/help/custom-modules/functions.html
- https://www.zoho.com/in/books/help/custom-modules/manage-custom-module.html
- https://www.zoho.com/in/books/help/extensions/bitly-invoice-link.html
- https://www.zoho.com/in/books/help/extensions/snail-mail.html
- https://www.zoho.com/in/books/help/extensions/zoho-writer-templates.html
- https://www.zoho.com/in/books/help/getting-started/access-zb.html
- https://www.zoho.com/in/books/help/getting-started/navigating-zoho-books.html
- https://www.zoho.com/in/books/help/getting-started/welcome.html
- https://www.zoho.com/in/books/help/getting-started/zoho-books.html
- https://www.zoho.com/in/books/help/integrations/books-billing-integration.html
- https://www.zoho.com/in/books/help/integrations/crm-books-integration.html
- https://www.zoho.com/in/books/help/integrations/crm-integration.html
- https://www.zoho.com/in/books/help/integrations/email-integration.html
- https://www.zoho.com/in/books/help/integrations/expense-integration.html
- https://www.zoho.com/in/books/help/integrations/google-workspace.html
- https://www.zoho.com/in/books/help/integrations/microsoft-365-integration.html
- https://www.zoho.com/in/books/help/integrations/zapier-books-integration.html
- https://www.zoho.com/in/books/help/integrations/zoho-mail-integration.html
- https://www.zoho.com/in/books/help/mcp/zoho-books-mcp.html
- https://www.zoho.com/in/books/help/settings/customization/web-tabs.html
- https://www.zoho.com/in/books/help/settings/developer-and-data/api-usage.html
- https://www.zoho.com/in/books/help/settings/developer-and-data/signals.html
- https://www.zoho.com/in/books/help/settings/integrations.html
- https://www.zoho.com/in/books/help/settings/organization/domain-mapping.html
- https://www.zoho.com/in/books/help/settings/organization/networking.html
- https://www.zoho.com/in/books/help/tasks/
- https://www.zoho.com/in/books/help/vendor-portal/
- https://www.zoho.com/in/books/help/vendor-portal/custom-modules.html
- https://www.zoho.com/in/books/help/web-tabs.html
- Not attempted: Zoho Books/Invoice REST API reference (https://www.zoho.com/books/api/v3/introduction/), Books KB/FAQ (https://www.zoho.com/in/books/kb/), Invoice/Books mobile-app help pages, Windows desktop app page, Zoho Books migration guides, Books "whats-new" changelog.

### 8.3 Topics with thin or no source coverage in the crawl
- LUT/export invoices, reverse charge, composition scheme, TCS: only covered as far as the Books **settings/taxes**, **tds-and-tcs-updates**, **gst/** and invoice pages describe them (see sections 5 and 7). There is no dedicated help page for them in the crawled tree.
- Zoho Invoice transaction approval: the help index link pointed to a generic landing page.
- Report "Schedule / Share / Custom report" mechanics for Zoho Invoice: the report-functions page lists which reports support them but not the full option set. The Books manage-reports page covers this (section 7).
- Multi-language invoices: marketing pages claim "10+ languages". The concrete list is the portal/contact language list in section 2.1.
- Books role/permission matrix: no help page lists every permission; section 7 records only the permission items the pages name.
- DRC-01B/01C pages describe steps on the GST portal, not features inside Books.
- Books help pages never name the plan tier for a feature (they say "certain plans"). Use the matrix in section 4.3 for tiers.


