# TallyPrime — Option-level Feature Catalog

Crawled 2026-10-11 from help.tallysolutions.com (TallyHelp) plus tallysolutions.com product and pricing pages. Covers TallyPrime up to Release 7.1 (May 2026). 760 pages were saved: 520 by headless-Chromium BFS and about 250 by targeted HTTP fetch of sitemap and WP-search hits. Raw text is in `crawl/tally/pages/`. Every bullet cites its source page. Section 6 is partly marked UNVERIFIED.

Contents: 1. Editions/pricing/releases/connectivity/add-ons/languages/shortcuts · 2. Core platform (company, F11, security, edit log, vouchers, numbering, printing, data mgmt) · 3. GST/TDS/TCS/MSME/statutory · 4. Inventory, sales/purchase process, POS & payroll · 5. Banking, outstanding, cost control & all reports · 6. Gap-fill

## Editions, Licensing & Pricing

- **Product variants** — TallyPrime (Edit Log optional; can be switched on/off in F11) vs **TallyPrime Edit Log** (Edit Log permanently on, cannot be disabled, for MCA audit-trail compliance). Both ship the same features otherwise. [src](https://help.tallysolutions.com/tally-prime/)
- **Silver (single user)** — one PC, one user at a time; can work offline once activated. Lifetime ₹22,500 + 18% GST, includes 1 yr TSS. Rental: ₹750/mo, ₹2,138/3 mo (5% off), ₹8,100/12 mo (10% off); rentals auto-renew until cancelled and include TSS. [src](https://tallysolutions.com/buy-tally/) · [src](https://tallysolutions.com/business-guides/tallyprime-total-cost-of-ownership-india/)
- **Gold (unlimited users on LAN)** — license is activated on one machine and shared with clients over the LAN ("Use license from network"). Lifetime ₹67,500 + GST, includes 1 yr TSS. Rental: ₹2,250/mo, ₹6,413/3 mo, ₹24,300/12 mo. [src](https://tallysolutions.com/buy-tally/)
- **Feature parity** — "All plans come with a complete range of features." Silver and Gold differ only in user and machine count. [src](https://tallysolutions.com/buy-tally/)
- **Rental to perpetual upgrade** — you pay the price difference ("Check Your Price Benefit"). Silver to Gold upgrade also costs the price difference. 3 single Silver licenses can be converted into 1 multi-user license on request. [src](https://tallysolutions.com/rental-to-perpetual-upgrade/) · [src](https://help.tallysolutions.com/licensing-tallyprime/)
- **Tally Software Services (TSS)** — annual subscription. It covers upgrades to new releases plus the connected services: online e-Way Bill and e-Invoice, connected GST, Reports in Browser, remote access, data synchronisation, connected banking and WhatsApp eligibility. Silver ₹4,500/yr or ₹8,100/2 yr; Gold ₹13,500/yr or ₹24,300/2 yr; Auditor edition ₹6,750/yr or ₹12,150/2 yr (all + GST). Renew from Alt+R (Manage TSS Renewal) on the Gateway of Tally, or F1 > Settings > License > Manage License > F9 (Renew TSS). The reminder can be snoozed: I = until next release, M = 7 days. [src](https://help.tallysolutions.com/tally-software-services-tss/) · [src](https://tallysolutions.com/business-guides/tallyprime-total-cost-of-ownership-india/)
- **Licensing operations** — Activate, Reactivate, Update (F1 > Settings > License > Manage License > F5 Update), Surrender, Configure (single-site / multi-site), and Use License from Network. Account Admin and Tally.NET ID run through the Control Centre. Free 7-day trial; Educational mode (unlicensed) restricts dates. [src](https://help.tallysolutions.com/licensing-tallyprime/)
- **Tally Virtual User (TVU) pack** — needed to run TallyPrime over RDP, Citrix, thin client or a cloud VM. The About page shows the "Tally Virtual User Limit". [src](https://help.tallysolutions.com/tally-virtual-user-tvu-tally/)
- **TallyPrime Server (TPS)** — enterprise data server that sits on top of a Gold license. It runs as a Windows service and provides: high concurrency (many users can load, save, export, import, print and back up at once with no locking wait); secure-by-design access by server name, without exposing data file paths; server-level permissions for backup and restore; a **Monitor** that shows live users and operations and can disconnect users; client/server security rules; endpoint security; a data cache size setting (F1 > Settings > Startup > Show More, either Low 15 MB, High 50% RAM up to 8 GB, or Custom); a multi-site license; multiple Gold licenses per subnet; and backup and export of data on the server. The help site also documents a "Server Pack (8–128 users)" priced at ₹750 + GST. [src](https://help.tallysolutions.com/tally-prime-server/) · [src](https://tallysolutions.com/tally-prime-server/) · [src](https://help.tallysolutions.com/set-up-tallyprime-auto-login-language-multiple-addresses/)
- **TallyPrime Cloud Access (TPCA)** — hosted Virtual Computer on Oracle Cloud (OCI), with cloud storage for data and backups. Access is through a browser web client (works on macOS) or the TPCA Client (an RDP wrapper for Windows/Linux). Login needs two factors: Tally.NET ID/password plus a Secure PIN. A Self-Service Portal (SSP) handles user management, restart/shutdown, backups, file manager, permissions manager and resolution. Backups are encrypted and automatic. Plans (+ GST, per user, 3/6/12-month terms, auto-renew): Personal (1 user) ₹600, Regular (2) ₹600, Regular Plus (4) ₹450, Regular Pro (8) ₹450, Performance (12) ₹450, Performance Plus (12) ₹450. It needs an existing TallyPrime license. Replaces "TallyPrime on AWS". [src](https://tallysolutions.com/tallyprime-cloud-access/) · [src](https://help.tallysolutions.com/getting-started-with-tallyprime-cloud-access/) · [src](https://help.tallysolutions.com/virtual-office-operations/)
- **TallyPrime with WhatsApp** — runs through Interakt (a Meta BSP). India: activation/renewal ₹1,300/yr (₹100 wallet credit), top-up ₹675 → ₹500 wallet or ₹2,700 → ₹2,000 wallet. Meta per-message charges come out of the wallet. Default limit is 250 business-initiated messages/day, unlimited after business verification (GST certificate or website/FB page). A 5-day trial number is provided. [src](https://help.tallysolutions.com/tallyprime-with-whatsapp-price-list/) · [src](https://help.tallysolutions.com/tallyprime-whatsapp/)
- **TallyDrive (cloud backup)** — Release 7.0+. Extra storage ₹100/mo per 10 GB (tiers 10–200 GB). [src](https://tallysolutions.com/business-guides/tallyprime-total-cost-of-ownership-india/)
- **Docs by Ira (AI document-to-voucher)** — Regular packs of 200/400/600 pages and a Pro pack of 3,000 pages, all valid 1 year (₹200 + GST per 100 pages per the TCO guide). A Quota Usage Summary report tracks usage. [src](https://help.tallysolutions.com/docs-by-ira/)
- **Subscriptions view (7.1)** — one screen shows the status and expiry of TSS, TallyDrive, Cloud Access and other subscriptions, with renewal. [src](https://help.tallysolutions.com/release-notes-tallyprime-7-1/)
- **About page** — shows application/edition, release, path, other installations, serial no., Rental vs Perpetual, rental validity, TVU limit, license admin, Gateway server/port, TDLs configured, plug-ins, data location, and companies loaded on startup. [src](https://help.tallysolutions.com/about-page-in-tallyprime/)
- **Control Centre (web portal)** — account profile, license management, Account Admin change, user management with security levels, Tally.NET users, report access control for remote sessions, and central TDL management across sites. [src](https://help.tallysolutions.com/control-centre-tally/)
- **Product notifications / Bell icon (5.0)** — a Notifications report (Ctrl+Alt+N) covers TSS renewal, license, upgrades and GST activities. You can act from the report, set when the red dot appears, and dismiss (Alt+D), remove (Ctrl+R) or restore (Ctrl+U) items. [src](https://help.tallysolutions.com/tallyprime-features-release-wise/)

## Release History (feature-level, 1.0 → 7.1)

- **1.0 (Nov 2020)** — Go To (Alt+G) / Switch To (Ctrl+G) from anywhere; Gateway of Tally organised into Masters, Vouchers, Utilities and Reports; selection-table lists with search, expand/collapse and on-the-fly create; a right button bar with consistent F2–F10; Basis of Values (Ctrl+B); Change View (Ctrl+H); Exception Reports (Ctrl+J); Change Mode in vouchers (Ctrl+H: Item/Accounting invoice/As voucher); copy and paste; More Details (Ctrl+I); Chart of Accounts; inventory-only companies; F11 features and F12 configuration; top menu (Company/Data/Exchange/Import/Export/E-mail/Print); auto-login; About page; cost-effective printing (header control on multi-page invoices); Analyse & Verify reports; VAT/Service Tax/Excise as legacy extensions. [src](https://help.tallysolutions.com/tallyprime-features-release-wise/)
- **1.1 – 1.1.4** — connected e-Invoice (date-based activation, real-time or bulk IRN, optional e-Way Bill, QR print, offline mode, cancellation); e-Payments for HDFC/ICICI/SBI/Kotak/YES etc. (bulk upload export); IFF section-wise GSTR-1 JSON; e-Invoice Sandbox (works without TSS or in Edu mode); TCS on realisation or accrual, exemptions for TDS-deducting and government buyers, Form 27EQ, Ledgers-without-PAN report, TCS at item or sales-ledger level. [src](https://help.tallysolutions.com/tallyprime-features-release-wise/)
- **2.0 / 2.0.1** — connected e-Way Bill (generate during voucher entry, bulk generate, cancel, update Part B/transporter ID, extend validity in bulk, print with EWB no. and QR, EWB report and register, fetch latest EWB info); Save View for reports (per period or master; for all companies or one); online GSTIN/UIN and HSN/SAC validation; Reports in Browser (mobile-responsive, change period, download with timestamped names); e-Payments for RazorpayX and Axis; Bottom Bar with shortcuts (hideable); product notifications (TSS, rental expiry). [src](https://help.tallysolutions.com/tallyprime-features-release-wise/)
- **2.1 (2022)** — Edit Log (version no., activity type, user, date-time; drill down to compare versions), shipped as two products; dongle-based **digital signature on PDFs** for export, e-mail and print. [src](https://help.tallysolutions.com/tallyprime-features-release-wise/)
- **3.0 (Jun 2023)** — multiple GST registrations in one company (per-registration periodicity, place of supply, e-Invoice/EWB applicability, recon config, LUT/Bond); GST rate and HSN/SAC set separately at company/group/ledger/item with source set in F11; slab rates in masters; Nature of Transaction at voucher level; override rates/HSN in vouchers and in bulk in 2A recon; mark return as Signed; Return Effective Date for amendments; GST in Material In/Out; Tax Analysis in purchases; default GST registration per voucher type; retention of original voucher numbers (automatic and multi-user auto); voucher series per GST registration; Track GST Return Activities; Transactions Accepted As Valid report; export returns as JSON/Excel/CSV; GSTR-1/2A/2B reconciliation from portal JSON; **Report Filters** (basic, multi, advanced; Ctrl+F); **Payment Request** (payment link/QR via gateways or UPI) plus a Payment Reconciliation report; improved migration/repair/import/sync with status, summary and exception resolution; Reset GSTN data; connect/disconnect multiple companies at once; updated IT slabs. [src](https://help.tallysolutions.com/release-notes-tallyprime-3/)
- **3.0.1** — e-Invoice error correction from Uncertain Transactions (invalid state, state/PIN mismatch, HSN vs supply type, numbers starting with zero); billed qty > actual qty; foreign parties; Dispatch From details; EWB with e-Invoice for credit notes and below-threshold; e-Invoice without UoM; party GSTIN = company GSTIN; Accept As Is for blank HSN (turnover < ₹5 cr); full-section GSTR-3B JSON. [src](https://help.tallysolutions.com/release-notes-tallyprime-3-0-1/)
- **4.0 (2023)** — TallyPrime with WhatsApp for Business (one or more recipients, with payment URLs in invoices and reminder letters); **Import from Excel** (default templates or custom mapping templates); **graphical Dashboard** (multiple tiles, default Sales and Purchase dashboards, period trends, cash flow, revenue and expense). [src](https://help.tallysolutions.com/release-notes-tallyprime-4/)
- **4.1 (Mar 2024)** — MSME Udyam no. for company and suppliers; MSME status of parties; pending bills to MSMEs and the 43B(h) list; MSME Form 1; GSTR-1 list of online sales. [src](https://help.tallysolutions.com/release-notes-tallyprime-4-1/)
- **5.0 (2024)** — **Connected GST** (direct upload, download and filing of GSTR-1/3B, real-time party validation); B2CL threshold changed to ₹1 lakh; TDS 194Q automation; Tally Plug-In Management; TallyPrime in Arabic and Bangla (display language, amount in words); sorting pending bills by due date; **Stripe View** (alternating row shading; all or specific reports; also in print and export); bell-icon notifications. [src](https://help.tallysolutions.com/release-notes-tallyprime-5/)
- **5.1 (Dec 2024)** — GST conflict resolution between masters and transactions; numbering choices during migration (retain, sales-only or all) plus HSN summary config and HSN length; multi-period GSTR-1 export to one Excel; HSN summary in Annual Computation; bulk B2B→B2C conversion for inactive GSTINs; Send (Online)/Export (Offline) naming; advance adjustments with no 18-month limit; 2B recon on consolidated tax amount; ITC/credit-note time limits; FVU updates; context help (Ctrl+F1). [src](https://help.tallysolutions.com/release-notes-tallyprime-5-1/)
- **6.0 (2025)** — **Connected Banking** (live statements and balances), auto bank reconciliation with smart suggestions, vouchers created from bank statements, a new e-Payments report (18+ banks), a simpler Data Split (single company option, progress bar, pre-split verification), User Profile, FY25-26 tax slabs (87A rebate up to ₹12 L, marginal relief), B2B/B2C break-up in HSN summary (Phase III), and bilingual Arabic invoices (Kuwait/Qatar). [src](https://help.tallysolutions.com/tallyprime-features-release-wise/)
- **6.1 (Jun 2025)** — **IMS** (Inward Supplies report; set Accepted/Rejected/Pending/No Action; IMS-ITC Summary; GSTR-2B recompute; remarks; auto-reconciliation marks matched invoices Accepted); **Edit Log Summary** (altered, non-altered and deleted counts for vouchers and masters; filters by activity, version period and user); revised MSME Form 1 (supplier-wise, PAN, bills within or beyond 45 days, Excel for MCA); unreconciled items carried to Opening BRS after split; manual recon improvements; Payment Reverse File import; GSTR-1 offline upload via Excel/CSV; reconcile despite taxable-value differences. [src](https://help.tallysolutions.com/release-notes-tallyprime-6-1/)
- **6.2 (Aug 2025)** — Arabic or bilingual invoice PDFs over e-mail and WhatsApp (GCC); Tax Invoice Format 2 is the default. [src](https://help.tallysolutions.com/release-notes-tallyprime-6-2/)
- **7.0 (Dec 2025)** — **Auto/Scheduled Backup** to TallyDrive or a local device (runs even when TallyPrime is closed; Backup Password and Recovery Key; Schedule Backup report; Manage TallyDrive report; restore any version); **PrimeBanking** online payments (single and daily limits, real-time status, automated payment advice); **SmartFind** (Alt+F; fuzzy search across masters and transactions in all loaded companies); resumable migration (keep working in the old release while changes sync); cancel EWB, e-Invoice and voucher in one go; GSTR-3B as a single JSON/Excel; duplicate-voucher detection in GST reports; IMS ITC reduction for B2BA/CDNRA/B2BDNA; **JSON import/export**; faster company and report loading options; AED/SAR symbols. [src](https://help.tallysolutions.com/release-notes-tallyprime-7-0/)
- **7.1 (May 2026)** — **Invoice Print Templates** (predefined designs; logo, watermark, header/footer images, custom fonts and colours, T&C; default template per voucher type); IMS fetch party by GSTIN plus a Books View; **Auto Wrap Text** in masters, vouchers and reports; ICICI online payments; potential-matches summary in BRS; bill-wise details in multi-voucher creation from a bank statement; 30-day GST login session; tobacco MRP-based GST; HSN validation from masters and reports; exclude a voucher from EWB; bulk return effective date; Kerala gold EWB without Part B; e-TDS/TCS forms 138/140/143/144 (IT Act 2025); **OAuth e-mail** (Gmail/Microsoft); **discount as %, amount, or both**; **reuse deleted voucher numbers**; subscriptions view; TallyDrive backup status on the Gateway; Schedule III Div I financial statements; Amazon plug-in. [src](https://help.tallysolutions.com/release-notes-tallyprime-7-1/)

## Connectivity & Online Services

- **Reports in Browser (TRiB)** — view reports from any device's browser. Data stays on the office PC and only report data is fetched on demand. Supports drill-down to vouchers, period change, and PDF/Excel download of reports and invoices. Setup: Alt+K > Connect, then E-mail ID for Browser Access (pick a Tally.NET user, New User, or None). Per-user "Allow Browser Access" uses the Tally.NET Owner/Auditor/User security levels. Since 6.6.3 a company can connect without security enabled. Needs TSS and an internet connection on the host. [src](https://help.tallysolutions.com/tally-reports-in-browser-tally/)
- **Remote Access (Tally.NET)** — a remote user on any TallyPrime install (even Edu mode) logs in to the office company to record or alter vouchers, print, view reports or audit, with rights per user. Setup: F11 > Online Access > "Tally.NET Services for Remote Access and Synchronisation" = Yes; security must be enabled; Alt+K > Connect (multiple companies at once from 3.0). Server and client must run the same release. Connect company on loading; Company Display Name/Contact Person/Contact Number under Alt+K > Online Access > Contact Details. [src](https://help.tallysolutions.com/remote-access-tally/)
- **Data Synchronisation (branches)** — client rules (Alt+Z > All Sync Options > Client Rules > Create): rule type Master or Transaction; sync method On-demand (via Tally.NET store-and-forward), Online, or IP (private network); server account ID; company name on server; direction Send, Receive, or Both; extra configurations. Synchronise all or Synchronise Selected. Server rules get activated, with "Deactivate when client rule changes". The Event Log shows status. Synchronisation reports exist. Manual-status override arrived in 6.1. [src](https://help.tallysolutions.com/data-synchronisation-tally/)
- **E-mail** — multiple sender profiles (sender name, from address, username, server from a common list such as Gmail/Yahoo/Hotmail/Outlook or User Defined SMTP, port, Use SSL, SSL/TLS on standard port). Authentication is OAuth via browser login (Google/Microsoft, 7.1) or App Password. Predefined message templates (Alt+S). To: New Address, Multiple Addresses, or Show Last Used. Subject is prefilled. File format via F8: PDF, Excel, XML, JPEG, etc. Can e-mail invoices with a payment link, payslips, reminder letters, multi-account reports and dashboard tiles. Shortcuts: Ctrl+M current, Alt+M share menu; configuration under Alt+M > Configuration. [src](https://help.tallysolutions.com/e-mailing-in-tallyprime/)
- **WhatsApp sharing** — Alt+M > WhatsApp > Current (or Ctrl+Alt+W). WhatsApp-to: party default number or multiple mobile numbers. Pick the file format and a Meta-approved template (e.g. Party Template with Payment Link adds a Pay Now button). C = configure (logo, GSTIN, etc.), W = send. Reminder letters from Bills Receivable come with ageing ranges, due-on dates, overdue days and post-dated options. Can also send dashboard tiles (current or all) and multi-account reports. Interakt adds a shared inbox, green tick, profile, contacts, bulk campaigns, notifications and template creation. [src](https://help.tallysolutions.com/whatsapp-documents/) · [src](https://help.tallysolutions.com/interakt-features-for-whatsapp/)
- **Digital signature (2.1+)** — DSC dongle signature on PDF output for print, export, e-mail and WhatsApp. Options: Ask before signing; signature format Only Text or Text & Image (image path and file); Include name of Signatory. Can be configured application-wide or per document. [src](https://help.tallysolutions.com/tally-prime/welcome-to-tally-prime/digital-signature-tallyprime/)
- **Payment Request / UPI (3.0+)** — payment links or QR codes on invoices through payment gateways (e.g. Razorpay) or UPI. Payment Link Details can be shared (Ctrl+C). Payment Reconciliation report. Links can appear in WhatsApp/e-mail invoices and reminder letters. [src](https://help.tallysolutions.com/tallyprime-features-release-wise/)
- **Mobile** — no native TallyPrime mobile app. Mobile access is through Reports in Browser (mobile-responsive), Cloud Access web client, and the **TallyIra app** (scan or upload documents and send them to TallyPrime for voucher creation). [src](https://help.tallysolutions.com/docs-by-ira/)
- **Integrations** — XML over HTTP (Tally Gateway port 9000), JSON (7.0), ODBC (Excel/Word pivot extraction), secure WebSocket integration, **TallyPrime MCP** (connect Claude Desktop to TallyPrime; tools for company, masters, accounting, inventory, outstanding and transactions), and the TallyPrime API Explorer / Developer. [src](https://help.tallysolutions.com/tallyprime-mcp-tools/) · [src](https://tallysolutions.com/tallyprime-api-explorer/)

## Tally Plug-ins & Add-ons

- **Tally Plug-ins (built-in from 5.0, enabled per license)** — managed in the Plug-In Management report (count, status, error reasons). F1 > Tally Plug-Ins. [src](https://help.tallysolutions.com/tdls-and-add-ons-for-tallyprime/)
- **TallyCapital** — Alt+9 / Gateway > TallyCapital. Check CIBIL credit score with insights, raise a dispute, check loan eligibility (upload company books), EMI calculator (flat-rate mode), loan application (Eligibility, Business KYC, Promoter KYC, GSTR-3B, Review & Submit), track or resubmit, disbursement summary and repayment schedule, withdraw consent, grievance. [src](https://help.tallysolutions.com/tallycapital-add-on/)
- **Bharat Connect for Business (NBBL/BBPS, 6.0+)** — register GSTIN by OTP to get a B2B ID per GSTIN; activate or deactivate registrations; search or bulk-update party B2B IDs; invite parties; send invoices to buyers; receive supplier invoices and create purchase vouchers from them, with master mapping for unknown items; set invoice status (accept/reject); create receipts; acknowledge payments; create payments against invoices and send payment details; invoice and payment views; 24-hour session; user access approval by the Tally.NET admin. [src](https://help.tallysolutions.com/bharat-connect-for-business/)
- **Docs by Ira (AI)** — creates vouchers (Sales, Purchase, Credit Note, Debit Note and more) from PDF or image documents imported from desktop or sent from the TallyIra app. Autofills a voucher in place (Ctrl+F). The Review Imported Transactions (Draft) report covers: exception indicators (missing master, master mismatch, date outside period); view source file; potential duplicates (configurable); bulk resolve; update mapping (F6); set date (F9); set ledger (F8); create masters from extracted values; Master Mapping Report; File Import Summary; quota usage. [src](https://help.tallysolutions.com/draft-transactions-docs-by-ira/)
- **Amazon Data Import (7.1)** — imports Amazon B2B/B2C sales, returns and settlement files using predefined mapping templates. Handles negative return values, mixed transaction types, discount tax treatment, settlement entries, and TDS/TCS deducted by Amazon. Ships sample ledger and stock item XLS files. [src](https://help.tallysolutions.com/amazon-data-import-plug-in/)
- **Financial Statements for NCE / Schedule III Div I** — exports XML into a smart Excel template that produces ICAI-format statements for non-corporates and Schedule III Div I for companies (6.0/7.1). [src](https://help.tallysolutions.com/tdls-and-add-ons-for-tallyprime/)
- **TallyShop add-ons** — partner-built add-ons marketplace (F1 > TallyShop or Ctrl+Alt+T > Ctrl+F6). Filter by country, edition (Silver/Gold), product, Best Selling, Recently Added, Categories or Top Developers. Each add-on supports Try (trial), Buy, and a manual download. [src](https://help.tallysolutions.com/tally-prime/tdls-and-add-ons/extend-using-tally-shop-add-ons-tally/)
- **TDL / customisation** — Tally Definition Language customisations, loaded locally or centrally from the account (Ctrl+Alt+T lists TDLs and add-ons). Typical uses: custom invoice formats, extra fields (UDFs), reports and integrations. 7.1 added **template-based invoice customisation** capabilities for developers: form, part, line and field Color, Style, Print FG, Print Style, background and more. [src](https://help.tallysolutions.com/customising-tallyprime/) · [src](https://help.tallysolutions.com/template-based-invoice-customisation/)

## Languages & Localisation

- **Display language** — F1 > Settings > Language > Ctrl+K. Product UI is currently available in Arabic and Bangla (plus English). Partner dictionaries can co-exist with Tally's own. Each user on a multi-user setup picks their own language. [src](https://help.tallysolutions.com/use-tallyprime-in-your-preferred-language/)
- **Data entry language** — Ctrl+W. Masters can be entered in regional languages (Hindi, Bengali, Tamil, Telugu, Marathi, Gujarati, Kannada, Malayalam, Punjabi, Oriya, Arabic, etc.) using different keyboards (keyboards-for-data-entry page). [src](https://help.tallysolutions.com/use-tallyprime-in-your-preferred-language/)
- **Language aliases on masters** — party and stock item names can have aliases per language. "List aliases for Master in" = Display language only. Invoices and reports print in the customer's language, including amount in words (Arabic, Bangla). [src](https://help.tallysolutions.com/use-tallyprime-in-your-preferred-language/)
- **Currency symbols** — ₹ via Ctrl+4 / Alt+4; AED Ctrl+Shift+6; SAR Ctrl+Shift+7; £/€/¥ via Alt codes. [src](https://help.tallysolutions.com/keyboard-shortcuts-tally-prime/)

## Application Settings (F1 > Settings)

- **Startup** — Load companies on startup (choose multiple, including from other drives/paths); Open Dashboard on loading a company; Enable Auto-login for companies with the same credentials; Enhanced Performance group (Optimise batch processing for data operations; Optimise loading of companies; Optimise loading of reports); TallyPrime Server cache size (Not Applicable/Low/High/Custom). [src](https://help.tallysolutions.com/set-up-tallyprime-auto-login-language-multiple-addresses/)
- **Data Path** — Alt+Y > Data Path: company data path and backup path defaults. [src](https://help.tallysolutions.com/set-up-tallyprime-auto-login-language-multiple-addresses/)
- **Print/Export/E-mail configuration** — Alt+P/Alt+E/Alt+M > Configuration. Includes a per-voucher-type number of copies ("Set no. of copies for printing vouchers") and advanced print configuration. [src](https://help.tallysolutions.com/set-up-tallyprime-auto-login-language-multiple-addresses/)
- **Display settings** — Stripe View (all or specific reports), Auto Wrap Text (7.1), Bottom Bar show/hide, list aliases language. [src](https://help.tallysolutions.com/tallyprime-features-release-wise/)
- **Context help** — Ctrl+F1 opens the TallyHelp topic for the current screen; TARA AI help chatbot on the help site. [src](https://help.tallysolutions.com/how-to-use-tallyhelp/)

## Keyboard Shortcuts (complete map)

- **Global** — Alt+G Go To; Ctrl+G Switch To; Alt+K Company menu; Alt+Y Data; Alt+Z Exchange; Alt+O Import; Alt+E Export menu; Ctrl+E export current; Alt+M Share menu; Ctrl+M e-mail current; Ctrl+Alt+W WhatsApp current; Alt+P Print menu; Ctrl+P print current; F1 Help; Ctrl+F1 context help; F11 Company Features; F12 Configure; Ctrl+K display language; Ctrl+W data-entry language; F2 change date; Alt+F2 change period; F3 switch company; Alt+F3 select company from other path; Ctrl+F3 shut company; Ctrl+Q quit screen; Alt+F4 exit; Ctrl+A save; Esc back; Ctrl+N calculator panel; Alt+F SmartFind (7.0); Ctrl+Alt+N notifications; Ctrl+Alt+B build info; Ctrl+Alt+T TDL/add-on details; Ctrl+Alt+R rewrite data. [src](https://help.tallysolutions.com/keyboard-shortcuts-tally-prime/)
- **Voucher-type hotkeys** — F4 Contra; F5 Payment; F6 Receipt; F7 Journal; Alt+F7 Stock Journal; Ctrl+F7 Physical Stock; F8 Sales; Alt+F8 Delivery Note; Ctrl+F8 Sales Order; F9 Purchase; Alt+F9 Receipt Note; Ctrl+F9 Purchase Order; Alt+F6 Credit Note; Alt+F5 Debit Note; Ctrl+F4 Payroll; Ctrl+F6 Rejection In; Ctrl+F5 Rejection Out; F10 other vouchers. [src](https://help.tallysolutions.com/keyboard-shortcuts-tally-prime/)
- **Voucher entry** — Alt+D delete; Alt+X cancel; Ctrl+D remove line; Ctrl+T post-dated; Ctrl+L optional; Ctrl+H change mode; Ctrl+I more details; Alt+J stat adjustment; Ctrl+F autofill stat or Docs by Ira; Alt+S Stock Query on item; Alt+R recall narration for the same party; Ctrl+R recall narration for the same voucher type; Alt+C create master on the fly or open the calculator from an Amount field; Alt+V manufacturing journal from a quantity field; Ctrl+Enter alter master; Ctrl+O related reports; Alt+A GST Tax Analysis; Ctrl+Alt+U pick an unused voucher number; Alt+Q Edit Log of the voucher/master; PgUp/PgDn previous/next voucher; Ctrl+C/Ctrl+V copy/paste. [src](https://help.tallysolutions.com/keyboard-shortcuts-tally-prime/)
- **Reports** — Alt+I insert voucher; Alt+2 duplicate voucher; Alt+A add voucher; Alt+D delete; Alt+X cancel; Ctrl+R hide line; Ctrl+U restore last hidden; Alt+U restore all; Spacebar/Shift+Space select; Ctrl+Alt+I invert selection; Alt+F1/Alt+F5 detailed/condensed; Alt+C add column; Alt+A alter column; Alt+D delete column; Alt+N auto-repeat columns (periods); Ctrl+F filter (3.0+); Ctrl+Alt+F filter details (7.0); Ctrl+F > F7 compute balances using filtered vouchers; Ctrl+B basis of values; Ctrl+H change view; Ctrl+J exceptions; Shift+Enter expand; +/- next/previous period or item; Enter drill down. [src](https://help.tallysolutions.com/keyboard-shortcuts-tally-prime/)
- **Banking, GST, templates, dashboard and backup shortcuts** — e.g. Alt+B cheque printing setup; F8 reconcile; Alt+S potential matches; F7 create vouchers from bank entries; Alt+F7 consolidated voucher; F10 mark GSTR filed; Alt+F10 undo filed; Alt+V open GST portal; F5 Nature/Return view; Ctrl+H change print template; Alt+R print without colour; Alt+T Tally Classic format; F4–F10 template editor panes; Alt+L set default template; dashboard Alt+A/Alt+D/Alt+V/Alt+C tiles; backup F6 instant, Alt+A add schedule, F9 download. [src](https://help.tallysolutions.com/keyboard-shortcuts-tally-prime/)


# TallyPrime — Core Platform Feature Catalog (from TallyHelp crawl)

## Company Creation & Alteration

### Company Creation screen (Alt+K > Create)
- **Entry point** — Alt+K (Company) > Create; if a company is already open, Select Company screen > Create Company. Ctrl+A saves; Company Features screen opens next. Unlimited companies can be created. [src](https://help.tallysolutions.com/create-company/)
- **Company Name** — recommended to use registered name. [src](https://help.tallysolutions.com/create-company/)
- **Company Data Path** — defaults to default/last-used data path; Spacebar to change; later changeable via Alt+Y (Data) > Configuration. [src](https://help.tallysolutions.com/create-company/)
- **Mailing Name** — prefilled from Company Name, editable; printed on invoices, reports, business documents. [src](https://help.tallysolutions.com/create-company/)
- **Address** — detailed address; printed on invoices/reports. [src](https://help.tallysolutions.com/create-company/)
- **State / Country** — operating location; drives base currency and FY defaults. [src](https://help.tallysolutions.com/create-company/)
- **Contact details** — Mobile, Fax, E-mail, Website; used when printing/exporting/e-mailing/WhatsApp sharing invoices. [src](https://help.tallysolutions.com/create-company/)
- **Financial year beginning from** — prefilled from system date settings + country. [src](https://help.tallysolutions.com/create-company/)
- **Books beginning from** — prefilled from FY start; change to actual start date of transactions. [src](https://help.tallysolutions.com/create-company/)
- **F12 > Use User Access Control** — Yes reveals **Control User Access to Company Data**, **Username (Administrator)**, **Password**. [src](https://help.tallysolutions.com/create-company/)
- **Enable TallyAudit features** — lets auditors/admins verify changes to company data and transactions (under user access control). [src](https://help.tallysolutions.com/create-company/)
- **Disallow opening in Educational Mode** — company opens only under valid license. [src](https://help.tallysolutions.com/create-company/)
- **F12 > Use TallyVault Password** — reveals **Set TallyVault Password to encrypt Company Data** + password field. [src](https://help.tallysolutions.com/create-company/)
- **F12 > Set Edit Log applicability** — Yes reveals **Enable Edit Log** (Y/Enter to confirm); for MCA audit-trail compliance; Release 2.1+. [src](https://help.tallysolutions.com/create-company/) [src](https://help.tallysolutions.com/working-with-company-tally/)
- **Base Currency** — defaults by country. [src](https://help.tallysolutions.com/create-company/)
- **F12 > Provide Additional Base Currency details** — currency suffix, spacing between amount and symbol, amount in words (formal name), decimal places. [src](https://help.tallysolutions.com/create-company/)
- **TallyVault after creation** — not in alteration screen; use Alt+K > TallyVault. [src](https://help.tallysolutions.com/create-company/)

### Group Company (consolidation)
- **Create Group Company** — Alt+K > Create > Alt+R (Group Company); fields: Name, mailing details/contact info, **Member Companies** (multi-select). Ctrl+A to save; shown bold on Gateway with members. [src](https://help.tallysolutions.com/group-company-tally/)
- **Alter group company** — Alt+K > Alter; add member from List of Companies; remove member via Spacebar on member; minimum 2 members (cannot remove when only 2); changes effective after reload. [src](https://help.tallysolutions.com/group-company-tally/)
- **Delete group company** — Alt+D in alteration; member companies are not deleted. [src](https://help.tallysolutions.com/group-company-tally/)
- **Consolidated reports** — Balance Sheet, P&L, Trial Balance consolidated without affecting member transactions; Alt+N (Auto Column) > Member Companies for side-by-side; Alt+F5 detailed; Alt+C (New Column) to add group column. [src](https://help.tallysolutions.com/group-company-tally/)

### Multiple addresses (company & party)
- **Enable multiple addresses** — F11 (show more features); or Company Features Alteration > Ctrl+I (More Details) > Multiple Addresses. [src](https://help.tallysolutions.com/company-features-f11-tally/)
- **Address Type screen** — "Primary" holds creation mailing details (editable); add named types (e.g. Branch Office) with Mailing name, Address, Pincode etc.; unlimited; selectable while printing/exporting/e-mailing. [src](https://help.tallysolutions.com/company-features-f11-tally/)
- **Party multiple addresses** — ledger option **Set/alter multiple mailing details: Yes**; Address Type + details; select address type per transaction for billing/shipping. [src](https://help.tallysolutions.com/company-features-f11-tally/)
- **Mailing details in local language** — Arabic mailing address; print invoices in Arabic or Bilingual (show more features). [src](https://help.tallysolutions.com/company-features-f11-tally/)

## Company Features (F11)

### Access & tiers
- **Open F11** — shown automatically after company creation; later Alt+K (Company) > F11 (Features) or F11 anywhere; features incrementally enable/disable. [src](https://help.tallysolutions.com/set-up-company-features/)
- **Show more features** — toggle that reveals second-tier options. [src](https://help.tallysolutions.com/set-up-company-features/)
- **Show all features** — toggle that reveals third-tier (legacy/niche) options. [src](https://help.tallysolutions.com/set-up-company-features/)

### Accounting
- **Maintain Accounts** — default Yes; No disables accounting options. [src](https://help.tallysolutions.com/company-features-f11-tally/)
- **Enable Bill-wise entry** — default Yes; shows "Maintain balances bill-by-bill" in Sundry Debtor/Creditor ledgers; prompts for bill reference on sales/purchase; usable for non-revenue accounts (loans/instalments). [src](https://help.tallysolutions.com/company-features-f11-tally/)
- **Enable Cost Centres** — default No; tier: show more; auto-enables Cost Centre Class. [src](https://help.tallysolutions.com/company-features-f11-tally/)
- **Enable Interest Calculation** — default No; tier: show more; auto interest from rate + calculation style. [src](https://help.tallysolutions.com/company-features-f11-tally/)

### Inventory
- **Maintain Inventory** — default Yes; stock items, groups, units. [src](https://help.tallysolutions.com/company-features-f11-tally/)
- **Integrate Accounts with Inventory** — default No; stock balance from inventory records in BS; drill from Balance Sheet to Stock Register. [src](https://help.tallysolutions.com/company-features-f11-tally/)
- **Enable multiple Price Levels** — default No; show more. [src](https://help.tallysolutions.com/company-features-f11-tally/)
- **Enable Batches** — default No; show more; adds "Maintain in Batches" to stock item. [src](https://help.tallysolutions.com/set-up-company-features/)
- **Maintain Expiry Date for Batches** — default No; show more; adds "Use Expiry Dates" to stock item. [src](https://help.tallysolutions.com/set-up-company-features/)
- **Enable Job Order Processing** — default No; show all; Job Work In/Out orders. [src](https://help.tallysolutions.com/company-features-f11-tally/)
- **Enable Cost Tracking** — default No; show all; procurement/landing/manufacturing/order/job cost. [src](https://help.tallysolutions.com/company-features-f11-tally/)
- **Use Discount column in invoices** — default No; show more; per-item trade discount. [src](https://help.tallysolutions.com/company-features-f11-tally/)
- **Use separate Actual and Billed Quantity columns in invoices** — default No; show more. [src](https://help.tallysolutions.com/company-features-f11-tally/)

### Taxation
- **Enable Goods and Services Tax (GST)** — default No; reveals Set/Alter GST Rate and Other Details (Rel 3.0+), multi-GSTIN, e-Invoice, e-Way Bill, reconciliation, MSME. [src](https://help.tallysolutions.com/set-up-company-features/)
- **Enable Tax Deducted at Source (TDS)** — default No; deductor details, rates & exemptions. [src](https://help.tallysolutions.com/set-up-company-features/)
- **Enable Tax Collected at Source (TCS)** — default No; show more. [src](https://help.tallysolutions.com/company-features-f11-tally/)
- **Enable Value Added Tax (VAT)** — default No; show all. [src](https://help.tallysolutions.com/company-features-f11-tally/)
- **Enable Excise** — default No; show all. [src](https://help.tallysolutions.com/company-features-f11-tally/)
- **Enable Service Tax** — default No; show all. [src](https://help.tallysolutions.com/company-features-f11-tally/)
- **LBT** — deprecated in TallyPrime. [src](https://help.tallysolutions.com/company-features-f11-tally/)

### Online Access
- **Enable Browser Access for Reports** — default Yes; show more; view key reports in browser on any device via Tally.NET credentials. [src](https://help.tallysolutions.com/company-features-f11-tally/)
- **Enable Tally.NET Services for Remote Access & Synchronisation** — default No; show more. [src](https://help.tallysolutions.com/company-features-f11-tally/)
- **Online Access contact details** — Alt+K > Online Access > Contact Details: Company Display Name, Contact Person, Contact Number; **Connect Company on loading**. [src](https://help.tallysolutions.com/company-features-f11-tally/)

### Payroll
- **Maintain Payroll** — default No (more/all tier per page). [src](https://help.tallysolutions.com/company-features-f11-tally/)
- **Enable Payroll Statutory** — default No. [src](https://help.tallysolutions.com/company-features-f11-tally/)

### Others
- **Enable multiple addresses** — show more. [src](https://help.tallysolutions.com/company-features-f11-tally/)
- **Mark modified vouchers** — show more; lists vouchers altered after creation, with user. [src](https://help.tallysolutions.com/company-features-f11-tally/)
- **Mailing details in local language** — show more (Arabic). [src](https://help.tallysolutions.com/company-features-f11-tally/)

### Tally.ERP 9 options relocated outside F11 (always-on or elsewhere)
- **Income & Expenses A/c instead of P&L** — Alt+G > Alter Master > Profit & Loss A/c. [src](https://help.tallysolutions.com/company-features-f11-tally/)
- **Multi-currency** — always available; Alt+G > Create Master > Currency. [src](https://help.tallysolutions.com/company-features-f11-tally/)
- **Bill-wise for non-trading accounts** — Ledger creation F12. [src](https://help.tallysolutions.com/company-features-f11-tally/)
- **Advanced interest parameters** — in Ledger master (Activate interest calculation). [src](https://help.tallysolutions.com/company-features-f11-tally/)
- **Cost categories / pre-defined cost centre allocations (Cost Centre Class)** — Create Master > Cost Category / Cost Centre Class; **Show Opening Balance for Revenue Items in Reports** under Cost Centre F12. [src](https://help.tallysolutions.com/company-features-f11-tally/)
- **Invoicing / invoice mode** — invoice mode default for all vouchers incl. Purchase, Credit Note, Debit Note. [src](https://help.tallysolutions.com/company-features-f11-tally/)
- **Budgets & Scenarios** — enabled by default. [src](https://help.tallysolutions.com/company-features-f11-tally/)
- **Reversing Journal / Optional vouchers** — activate Reversing Journal on first create; Optional is a button by default in vouchers. [src](https://help.tallysolutions.com/company-features-f11-tally/)
- **Cheque printing** — Ledger > Bank Configuration. **Transaction types** in Bank Allocation screen; **Enable beneficiary code** via Bank Allocation F12; **Set Bank Details for Cost Centres** via Cost Centre F12. [src](https://help.tallysolutions.com/company-features-f11-tally/)
- **e-Payments** — Ledger > Set/alter e-Payments configuration: Export/Upload Payment Instructions on voucher creation; Ignore transaction with information mismatch in report (bank ledgers of supported banks). [src](https://help.tallysolutions.com/company-features-f11-tally/)
- **Post-dated** — ledger option **Use as notional bank for post-dated vouchers**. [src](https://help.tallysolutions.com/company-features-f11-tally/)
- **Allow zero-valued transactions** — in Voucher Type master. [src](https://help.tallysolutions.com/company-features-f11-tally/)
- **Company logo** — Alt+P > Configuration > Show Company Logo. [src](https://help.tallysolutions.com/company-features-f11-tally/)
- **Godowns, Stock Category** — available by default. [src](https://help.tallysolutions.com/company-features-f11-tally/)
- **Order processing / Rejection In-Out / Material In-Out** — activate voucher type on first create; tracking numbers auto-enabled with Delivery/Receipt Note/Rejection vouchers. [src](https://help.tallysolutions.com/company-features-f11-tally/)
- **Track Additional Costs for Purchases** — voucher type option; default for Purchase, Debit Note, Journal, Payment, Stock Journal. [src](https://help.tallysolutions.com/company-features-f11-tally/)
- **Deprecated** — SMS access, audit working paper, audit priorities/categories. [src](https://help.tallysolutions.com/company-features-f11-tally/)

## Security, Users & Roles

### User management (Alt+K > Users and Passwords)
- **Create user** — choose User Role (5 roles available), Username, Password; extra permissions per features: **Browser Access**, **Remote Access**, **Local TDL Files**. [src](https://help.tallysolutions.com/manage-users-in-tallyprime/)
- **F12 user options** — user status Active/Inactive; Password Policy applicable to user Yes/No. [src](https://help.tallysolutions.com/manage-users-in-tallyprime/)
- **Change User** — Alt+K > Change User > Change Username + Password. [src](https://help.tallysolutions.com/manage-users-in-tallyprime/)
- **Change Password** — Alt+K > Change Password: Old, New, Confirm. [src](https://help.tallysolutions.com/manage-users-in-tallyprime/)
- **Remove user** — Users and Passwords > cursor on Security Level > Spacebar > End of list. [src](https://help.tallysolutions.com/manage-users-in-tallyprime/)

### Security levels (Alt+K > User Roles)
- **Defaults** — Owner and Data Entry levels predefined; rename allowed. [src](https://help.tallysolutions.com/security-user-management-in-talllyprime/)
- **Basic facilities of** — inherit another role's permissions. [src](https://help.tallysolutions.com/security-levels/)
- **Allow / Disallow the following Facilities** — lists of activity type (Full Access, Create, Alter, Create/Alter, Display, Display/Print, Print, Preview) × area (Vouchers, Back Dated Vouchers, Accounts Masters, Price List, Override Invoice Defaults, Day Book, Trial Balance, P&L, Payroll Reports, TDS/TCS/Service Tax reports, etc.). [src](https://help.tallysolutions.com/security-levels/)
- **Allow to save report views for This Company** / **Allow to delete saved views for This Company** — Yes/No. [src](https://help.tallysolutions.com/security-levels/)
- **Allow to add/modify Registered Business WhatsApp Nos.** — Yes/No; also restrict use of one or more WhatsApp numbers. [src](https://help.tallysolutions.com/security-levels/)
- **Set/Alter rules for Print voucher before saving** — Yes/No. [src](https://help.tallysolutions.com/security-levels/)
- **Allow to override tax details** — company-level tax override during entry. [src](https://help.tallysolutions.com/security-levels/)
- **Exclude On Account from Bill Allocations** — restricts bill allocation types. [src](https://help.tallysolutions.com/security-levels/)
- **Exclude New Number from Item Allocations** — blocks new tracking/order refs. [src](https://help.tallysolutions.com/security-levels/)
- **Allow company to connect** — connected services/remote access. [src](https://help.tallysolutions.com/security-levels/)
- **Use Tally.NET Authentication** — per role. [src](https://help.tallysolutions.com/security-levels/)
- **Days Allowed for Back Dated Vouchers** — numeric window. **Cut-off Date for Back Dated Vouchers** — date lock (e.g., post-audit). [src](https://help.tallysolutions.com/security-levels/)
- **Recipes** — view-only vouchers (disallow Full Access > Vouchers, allow Display > Vouchers); create/alter current-dated only; display/print backdated only; alter-but-not-create backdated. [src](https://help.tallysolutions.com/security-levels/)
- **Lock stock item rates** — disallow Full Access > Accounts Masters, Price List, Override Invoice Defaults → price list rates enforced. [src](https://help.tallysolutions.com/security-levels/)
- **Dashboard access** — allow/restrict by role; hide specific financial tiles. [src](https://help.tallysolutions.com/security-user-management-in-talllyprime/)

### Password policy (Alt+K > Password Policy)
- **Activate password policy** — Yes/No; requires security enabled + admin. [src](https://help.tallysolutions.com/set-up-password-policy/)
- **Minimum password length** — default 8. [src](https://help.tallysolutions.com/set-up-password-policy/)
- **Specify advanced parameters for password strength** — min Alphabetic, Numeric, Special characters (sum ≤ length). [src](https://help.tallysolutions.com/set-up-password-policy/)
- **Password expires after** — days, default 90; 0 = never. [src](https://help.tallysolutions.com/set-up-password-policy/)
- **Notify users before password expires** — Yes/No. [src](https://help.tallysolutions.com/set-up-password-policy/)
- **Restrict the use of old passwords** — Yes/No. [src](https://help.tallysolutions.com/set-up-password-policy/)
- **Change password on first login** — Yes/No. [src](https://help.tallysolutions.com/set-up-password-policy/)
- **Allow users to change password** — Yes/No. [src](https://help.tallysolutions.com/set-up-password-policy/)

### TallyVault (encryption)
- **Set** — Alt+K > TallyVault: TallyVault Password, Confirm; Ctrl+A, confirm; option to create unencrypted copy of original (Y/N). Encrypts company name + data; list shows company as asterisks + number; lost password = permanent data loss. [src](https://help.tallysolutions.com/tallyvault-for-company-tally/)
- **Alter** — Old Password, new Password (must differ), Confirm; close open reports/vouchers first; reconfirm; optional unencrypted copy. [src](https://help.tallysolutions.com/tallyvault-for-company-tally/)
- **Interruption recovery** — data either in existing folder or Temp folder (rename Temp to company number). [src](https://help.tallysolutions.com/tallyvault-for-company-tally/)

### Tally.NET IDs
- **Tally.NET ID** — e-mail linked to license; needed for online services. Create on tallysolutions.com > Control Centre > User Management > Manage Users > CREATE USER: Security Level (Standard User/Owner), Tally.NET ID e-mail, feature toggles; password mailed. [src](https://help.tallysolutions.com/manage-tally-net-users/)
- **Know ID** — F1 (Help) > Settings > License > Manage License. **Reset password** — portal Forgot ID/Password or in-product Alt+R (Reset Password). [src](https://help.tallysolutions.com/manage-tally-net-users/)

## Edit Log / Audit Trail

### Enablement & editions
- **Edit Log** — Release 2.1+; enable at company creation/alteration (F12 > Set Edit Log applicability > Enable Edit Log); can be disabled later in TallyPrime (logs stop); separate **TallyPrime Edit Log** edition cannot disable (MCA audit-trail compliance). [src](https://help.tallysolutions.com/working-with-company-tally/) [src](https://help.tallysolutions.com/create-company/)
- **Username when security off** — logged as "Unknown (Security not enabled)". [src](https://help.tallysolutions.com/edit-log-activities/)

### Company-level activities logged
- **Company activity labels** — Company Data migrated (from TallyPrime ≤2.0.1, from Tally.ERP 9, between Edit Log releases, to lower version), Company Data moved (TallyPrime ↔ TallyPrime Edit Log), Company Data split, Migrated (Not fully recovered), Company Data repaired (Not fully recovered), Edit Log enabled during Company creation, Edit Log enabled, Edit Log disabled. [src](https://help.tallysolutions.com/edit-log-activities/)

### Voucher/master activity labels
- **Creation** — Created; Created due to Import; Created due to Sync (first sync client→server); Created due to Migration. [src](https://help.tallysolutions.com/edit-log-activities/)
- **Alteration** — Altered; Altered due to Voucher Renumbering; Altered due to Import; Altered due to Split (opening balances/bill-wise); Altered due to Sync; Altered due to Migration. [src](https://help.tallysolutions.com/edit-log-activities/)
- **Resave** — Resaved due to Import (No changes); Resaved due to Sync (No changes); Resaved due to Voucher Renumbering; Resaved (No changes). [src](https://help.tallysolutions.com/edit-log-activities/)
- **Deleted** — logged; deleted vouchers/masters retrievable (TDL "Include Deleted", "Deleted Master" object). [src](https://help.tallysolutions.com/what-are-the-edit-log-capabilities/)
- **Previous Record** — consolidated snapshot when edit log was off (no user/time), logged on first alter/resave/delete after re-enable or migration. [src](https://help.tallysolutions.com/edit-log-activities/)
- **Status: Optional / Status: Cancelled** — activities on optional/cancelled vouchers flagged. [src](https://help.tallysolutions.com/edit-log-activities/)
- **Numbering method change warning** — Release 3.0+ with Edit Log: message on changing Method of voucher numbering or additional numbering details, since renumbering alters Vch No (edit log entries). [src](https://help.tallysolutions.com/edit-log-activities/)
- **Auto renumber logged** — with Automatic/Multi-user Auto, deleting a voucher or changing its date renumbers subsequent vouchers; logged. [src](https://help.tallysolutions.com/edit-log-for-masters-transactions/)

### Edit Log report (per voucher/master)
- **Open** — voucher/master alteration > Alt+Q (Edit Log); columns Version, Activity, Username, Date & Time; Enter for Differences Between Edit Log Versions (changes in red). Also from Day Book and individual Ledgers/Stock Items/Groups. [src](https://help.tallysolutions.com/edit-log-for-masters-transactions/)
- **F12 options** — Show altered values only; Show configuration-based value (Yes/No, blank→Not Applicable/Primary); Show internal fields updated by the application. [src](https://help.tallysolutions.com/edit-log-for-masters-transactions/)
- **Keys** — +/– next/previous version; PgDn/PgUp scroll; Shift+F5 change details; Shift+Enter explode line; F12 configure. [src](https://help.tallysolutions.com/edit-log-activities/)
- **Rel 6.0** — also tracks Bank Date, Instrument Number/Date, UPI changes. [src](https://help.tallysolutions.com/edit-log-activities/)
- **Masters covered** — Groups, Ledgers, Stock Items only (plus vouchers). [src](https://help.tallysolutions.com/view-edit-log-summary/)

### Edit Log Summary reports
- **Voucher Type-wise Summary** — Alt+G > Edit Log Summary – Voucher Types (or Display More Reports > Edit Log Summary); Altered / Non-Altered / Total counts + version counts; deleted count in brackets; drill to Monthly Summary > Edit Log Summary – Vouchers. [src](https://help.tallysolutions.com/view-edit-log-summary/)
- **Master-wise Summary** — Alt+G > Edit Log Summary – Master-wise, or Ctrl+H change view. [src](https://help.tallysolutions.com/view-edit-log-summary/)
- **User-wise Voucher/Master Summary** — Ctrl+H; requires security enabled. [src](https://help.tallysolutions.com/view-edit-log-summary/)
- **List of All Vouchers** — Ctrl+H view; Alt+F5 detailed/condensed. [src](https://help.tallysolutions.com/view-edit-log-summary/)
- **Buttons** — F5 All Vouchers/Masters ↔ Altered; F9 All Versions ↔ Configured; F8 Version Period; Ctrl+B Basis of Values (Type of Vouchers/Masters, Type of Activity default "Any Activity Except Migration", include Bank Reconciliation/e-Invoice/e-Way Bill altered versions — excluded by default, select users / Specify Username); F12 Sorting Method (Count, Versions) and Sort By (Altered/Non-Altered/Total). [src](https://help.tallysolutions.com/view-edit-log-summary/)

### Mark Modified Vouchers (accountant workflow)
- **Mark modified vouchers** — F11 toggle; altered/added/cancelled vouchers (not deleted) listed in Marked Vouchers register. [src](https://help.tallysolutions.com/mark-changed-vouchers-tally/)
- **Marked Vouchers register** — Alt+G > Marked Vouchers or Display More Reports > Exception Reports > Marked Vouchers; F12 detail; Ctrl+J Exception Reports (Optional, Cancelled, Post-Dated); Alt+H Exports History; Alt+R Clear All Marking (all-at-once only). [src](https://help.tallysolutions.com/mark-changed-vouchers-tally/)
- **Share** — export as XML (Data Interchange for Marked Vouchers); client imports XML which merges with live data. [src](https://help.tallysolutions.com/mark-changed-vouchers-tally/)

### TDL/developer hooks for edit log
- **Functions** — $$IsGlobalEditLogOn, $$IsEditLogOn. **Company Activity** object (ActivityType: CompanyCreated, Repair, Split, MovedtoTP, MovedtoTPEL, Migration…, ActivitySeqID, PerformedBy, PerformedDateTime, IsSecurityOnWhenActLogged). **Edit Logs** sub-object methods: Version, EnteredBy, ObjectUpdateAction (Create/Alter/Resave/Delete), TypeOfUpdateActivity, UpdatedDateTime; IsEditLogPresent; IsDeleted. [src](https://help.tallysolutions.com/what-are-the-edit-log-capabilities/)

## Voucher Types

### Predefined voucher types
- **Count** — voucher-types page says 24 predefined; accounting-entry page says 28 (inconsistent in source). [src](https://help.tallysolutions.com/voucher-types-tally/) [src](https://help.tallysolutions.com/accounting-entry-tally/)
- **Function-key vouchers** — F4 Contra, F5 Payment, F6 Receipt, F7 Journal, F8 Sales, F9 Purchase; F10 (Other Vouchers) for the rest. Entry: Alt+G > Create Voucher or Gateway > Vouchers. [src](https://help.tallysolutions.com/accounting-entry-tally/)
- **Other types named in sources** — Credit Note (abbr CN), Debit Note, Memorandum, Reversing Journal, Sales Order, Purchase Order, Delivery Note, Receipt Note, Rejection In, Rejection Out, Material In, Material Out, Physical Stock, Stock Journal, Job Work In/Out orders, Point of Sales; Payment abbr "Pymt". [src](https://help.tallysolutions.com/accounting-entry-tally/) [src](https://help.tallysolutions.com/company-features-f11-tally/) [src](https://help.tallysolutions.com/voucher-types-tally/)
- **Inactive types need activation** — Memorandum, Reversing Journal, Sales/Purchase Order, Rejection In/Out, Material In/Out prompt "activate?" (Y) on first use. [src](https://help.tallysolutions.com/accounting-entry-tally/)
- **View list** — Alt+G > Chart of Accounts > Voucher Types. [src](https://help.tallysolutions.com/accounting-entry-tally/)
- **Default ledgers at company creation** — Cash and Profit & Loss A/c. [src](https://help.tallysolutions.com/accounting-entry-tally/)

### Voucher Type master (Alt+G > Create/Alter Master > Voucher Type)
- **Name** + **Select type of voucher** — new type inherits parent type's properties (e.g. Cash Sales under Sales). [src](https://help.tallysolutions.com/voucher-types-tally/)
- **Abbreviation** — editable default (CN, Pymt…). [src](https://help.tallysolutions.com/voucher-types-tally/)
- **Activate this Voucher Type** — via alteration for inactive types. [src](https://help.tallysolutions.com/voucher-types-tally/)
- **Method of Voucher Numbering** — Automatic, Automatic (Manual Override), Manual, Multi-user Auto, None. [src](https://help.tallysolutions.com/voucher-types-tally/) [src](https://help.tallysolutions.com/use-voucher-numbering-methods/)
- **Set/Alter additional numbering details** — prefix/suffix/restart (Automatic, Automatic Manual Override, Multi-user Auto only). [src](https://help.tallysolutions.com/voucher-types-tally/)
- **Prevent creating duplicate Voucher Nos** — Automatic (Manual Override), Manual, Multi-user Auto; only before any voucher of the type exists. [src](https://help.tallysolutions.com/use-voucher-numbering-methods/)
- **Use effective dates for vouchers** — effective date shown top-right of voucher. [src](https://help.tallysolutions.com/voucher-types-tally/)
- **Allow zero-valued transactions** — free items/samples. [src](https://help.tallysolutions.com/voucher-types-tally/)
- **Make this voucher type as 'Optional' by default** — not for Memorandum/Reversing Journal. [src](https://help.tallysolutions.com/voucher-types-tally/)
- **Provide narration for each ledger in voucher** — per-ledger narration (not for DN, RN, SO, PO, Physical Stock, Stock Journal, Rejection In/Out). [src](https://help.tallysolutions.com/voucher-types-tally/)
- **Enable default accounting allocations** — Default Accounting Entries screen for recurring income/expense. [src](https://help.tallysolutions.com/voucher-types-tally/)
- **Track Additional Costs for Purchases** — Purchase, Journal, Memorandum, Payment, Physical Stock, Rejection Out, Reversing Journal. [src](https://help.tallysolutions.com/voucher-types-tally/)
- **WhatsApp voucher after saving** — share to party right after save. [src](https://help.tallysolutions.com/voucher-types-tally/)
- **Print voucher after saving** — opens Voucher Printing screen on save. [src](https://help.tallysolutions.com/voucher-types-tally/)
- **Generate Payment link/QR code after saving voucher** — Sales, Debit Note, Delivery Note, Journal, POS, Sales Order. [src](https://help.tallysolutions.com/voucher-types-tally/)
- **Default template to print** — Sales, POS, Sales Order, Delivery Note, Credit Note, Debit Note. [src](https://help.tallysolutions.com/voucher-types-tally/)
- **Default title to print** — Sales types. [src](https://help.tallysolutions.com/voucher-types-tally/)
- **Default bank** — bank details printed on Sales vouchers. [src](https://help.tallysolutions.com/voucher-types-tally/)
- **Default jurisdiction** — Sales types. [src](https://help.tallysolutions.com/voucher-types-tally/)
- **Set/alter declaration** — declaration on all vouchers; Arabic declaration for GCC. [src](https://help.tallysolutions.com/voucher-types-tally/)
- **Set/Alter Terms and Conditions** — List of Terms and Conditions + Default Terms and Conditions (Sales, POS, SO, DN, CN, Debit Note). [src](https://help.tallysolutions.com/voucher-types-tally/)
- **Use for POS invoicing** — Sales-based type; Message to print (1) and (2) at bottom; Default template = POS Templates; Default title. [src](https://help.tallysolutions.com/voucher-types-tally/)
- **F12 > Define multiple numbering series for vouchers** — Rel 3.0+; Define Numbering Series screen (default "Series" + named series, e.g. per GSTIN, >₹50k e-way bill, inter/intra-state); select series at entry. [src](https://help.tallysolutions.com/use-voucher-numbering-methods/)

### Voucher Class
- **Purpose** — templates for faster entry, auto ledger allocation for items, wrong-ledger prevention, invoice-level rounding; not usable in voucher alteration. [src](https://help.tallysolutions.com/accounting-entry-tally/)
- **Name of Class** — in voucher type master (F12 if hidden). [src](https://help.tallysolutions.com/accounting-entry-tally/)
- **Include/Exclude these Groups** — restricts Party A/c list. [src](https://help.tallysolutions.com/accounting-entry-tally/)
- **Default Accounting Allocations for all items in Invoice** — ledger(s) + allocation %, tax ledgers inline; **Override using Item Default** Yes/No. [src](https://help.tallysolutions.com/accounting-entry-tally/)
- **Additional accounting entries** — ledgers auto-added (tax, freight, loading, rounding); **Type of Calculation** (As User Defined Value, GST auto, value-basis); **Remove if Zero**; extra ledgers cannot be added at entry. [src](https://help.tallysolutions.com/accounting-entry-tally/)
- **POS class** — enable payment modes and map Ledger Name per mode. [src](https://help.tallysolutions.com/voucher-types-tally/)
- **Stock Journal class** — Use Class for Inter-Godown Transfers. [src](https://help.tallysolutions.com/voucher-types-tally/)
- **Receipt/Payment/Contra class** — prefill cash/bank source/destination. [src](https://help.tallysolutions.com/accounting-entry-tally/)
- **Customs duty class** — voucher class configuration for Excise-for-Importer purchases. [src](https://help.tallysolutions.com/ei-configure-vch-class-customs-duty-tally/)

### Voucher numbering methods
- **Automatic** — sequential; **Numbering behaviour on insertion/deletion** (Rel 3.0+): Renumber Vouchers (default for new/migrated) or Retain Original Voucher No. [src](https://help.tallysolutions.com/use-voucher-numbering-methods/)
- **Show unused voucher nos. in transactions** — for Retain Original behaviour; reuse gaps via Ctrl+Alt+U (Unused Vch No.) or Ctrl+I > Voucher No. Details > Select Unused Voucher Nos. [src](https://help.tallysolutions.com/use-voucher-numbering-methods/)
- **Automatic (Manual Override)** — auto number editable; jumps continue from override (skip 11–20 → 21, next 22); skipped numbers usable manually. [src](https://help.tallysolutions.com/use-voucher-numbering-methods/)
- **Manual** — user types each number; optional duplicate prevention. [src](https://help.tallysolutions.com/use-voucher-numbering-methods/)
- **Multi-user Auto** — shows "1<Auto>" for concurrent users; actual number assigned on save; avoids "Voucher Number 1 already used!" prompts; creation only. [src](https://help.tallysolutions.com/use-voucher-numbering-methods/)
- **None** — numbering disabled. [src](https://help.tallysolutions.com/use-voucher-numbering-methods/)
- **Additional numbering details screen** — Starting Number; Width of Numerical Part; Prefill with zero (e.g. 0001); Restart Numbering table (Applicable From, Starting Number, Periodicity e.g. monthly); Prefix Details and Suffix Details tables (Applicable From + text). [src](https://help.tallysolutions.com/use-voucher-numbering-methods/)
- **Renumber triggers** — delete, date change, make optional/regular, change voucher type, back-dated entry → subsequent vouchers renumbered (edit-logged). [src](https://help.tallysolutions.com/accounting-entry-tally/)
- **Errors** — "Name of Voucher Numbering Series is not Provided/Invalid" on import. [src](https://help.tallysolutions.com/name-of-voucher-numbering-series-is-not-provided-invalid/)

## Voucher Entry

### Common entry mechanics
- **F2 Date** — defaults to next day after current date to speed sequential entry. [src](https://help.tallysolutions.com/accounting-entry-tally/)
- **Alt+C** — create ledger on the fly from any ledger field. [src](https://help.tallysolutions.com/accounting-entry-tally/)
- **Narration** — common narration per voucher; per-ledger narration optional. [src](https://help.tallysolutions.com/accounting-entry-tally/)
- **F12 (Configure)** / **Ctrl+I (More Details)** — per-voucher options without activating them globally. [src](https://help.tallysolutions.com/accounting-entry-tally/)
- **Ctrl+H (Change Mode)** — Single-Entry vs Double-Entry (contra/payment/receipt); Item Invoice vs Accounting Invoice vs As Voucher for sales/purchase. [src](https://help.tallysolutions.com/accounting-entry-tally/) [src](https://help.tallysolutions.com/voucher-types-tally/)
- **Journal Dr/Cr** — Dr first by default; "Show More" in ledger list for hidden ledgers. [src](https://help.tallysolutions.com/accounting-entry-tally/)
- **Ctrl+L Optional/Regular** — removes accounting impact; Optional Vouchers register (Exception Reports). [src](https://help.tallysolutions.com/accounting-entry-tally/)
- **Ctrl+T Post-Dated/Current** — posts on its date when date of last entry passes; Post-Dated Vouchers register; Ledger Vouchers Alt+F8 (Incl Post-Dated); not selectable in scenarios. [src](https://help.tallysolutions.com/accounting-entry-tally/)
- **Memorandum** — non-accounting; convert to Payment etc. via function key in alteration; Memorandum Register; used in Scenarios. [src](https://help.tallysolutions.com/accounting-entry-tally/)
- **Reversing Journal** — **Applicable Upto** date; auto-reversed after; Reversing Journal Register; only in Scenarios. [src](https://help.tallysolutions.com/accounting-entry-tally/)
- **Scenarios** — Create Master > Scenario (include/exclude optional, memo, reversing); Balance Sheet Alt+C (New Column) select scenario. [src](https://help.tallysolutions.com/accounting-entry-tally/)
- **Contra** — Bank Allocations (cheque/DD details, Cash Denominations), deposit slips, foreign currency amount by prefixing symbol, rate of exchange, Print Cheque after saving. [src](https://help.tallysolutions.com/accounting-entry-tally/)
- **Edit Log from voucher** — Alt+Q or Ctrl+O (Related Reports) > Edit Log; PgUp in creation opens previous voucher. [src](https://help.tallysolutions.com/accounting-entry-tally/)
- **Registers** — Day Book (F2 date, Alt+F2 period, F4 voucher type filter), Journal/Contra/other registers month-wise; F8 Columnar (Show voucher reference number/date). [src](https://help.tallysolutions.com/accounting-entry-tally/)

### Copy default accounting details
- **Copy Allocation Details** — Alt+G > Alter Master > Copy Allocation Details: Copy From (stock item with default ledgers), To master type (Stock Items / Stock Groups), Copy to stock items / Copy to stock items belonging to; Copy to all sub-groups; tax rates copied with tax ledgers. [src](https://help.tallysolutions.com/copy-accounting-details-tally/)

### Auto Wrap Text (Rel 7.1)
- **Global** — F1 > Settings > Display > Auto Wrap Text (default on). Tooltip shows full text when compressed. [src](https://help.tallysolutions.com/auto-wrap-text/)
- **Print config** — Alt+P > Configuration: Auto wrap text in vouchers (per voucher type: Print / Export & Share / Not Applicable); Auto wrap text in reports (mode); Optimise printing to save paper. Export/Share wrap works only for PDF/JPEG. Per-document: Ctrl+P > C (Configure). [src](https://help.tallysolutions.com/auto-wrap-text/)

## Ledgers & Groups

### Predefined masters
- **Predefined ledgers** — Cash; Profit & Loss A/c (previous-year P&L as opening); cannot be deleted, can be renamed. [src](https://help.tallysolutions.com/ledgers-and-groups-in-tallyprime/)
- **Predefined groups** — 28 groups (15 primary, 13 secondary) under Assets/Liabilities/Income/Expenses; cannot be deleted; altering discouraged. [src](https://help.tallysolutions.com/accounting-in-tally-prime/) [src](https://help.tallysolutions.com/groups-in-tallyprime/)

### Ledger master
- **Create** — Alt+G > Create Master > Ledger; Gateway > Create > Ledger; Alt+C on the fly in voucher; bulk create/alter/delete from Chart of Accounts. [src](https://help.tallysolutions.com/ledgers-in-tallyprime/)
- **Name** + **F12 > Provide language aliases for Name** — alias per language for printing. [src](https://help.tallysolutions.com/ledgers-in-tallyprime/)
- **Under** — group (Alt+C to create group); group drives which options appear and their defaults. [src](https://help.tallysolutions.com/ledgers-in-tallyprime/)
- **Mailing Details** — Name, Address, State, Country, Pincode. [src](https://help.tallysolutions.com/ledgers-in-tallyprime/)
- **Set/alter multiple mailing details** — address types per party. [src](https://help.tallysolutions.com/company-features-f11-tally/)
- **Maintain balances bill-by-bill** — needs F11 bill-wise; F12 shows it; **Default credit period**; **Check for credit days during voucher entry** (warn when exceeded). [src](https://help.tallysolutions.com/set-up-party-ledger/)
- **Credit limit** — defined in customer ledger; usage reviewed in Group Outstandings (ledger-wise view, ageing). [src](https://help.tallysolutions.com/monitor-customer-credit-usage-in-tallyprime/)
- **F12 > Provide Contact Details** — Contact Name, Phone No., Primary Mobile No., Fax No., E-mail, CC to (if any), Website. [src](https://help.tallysolutions.com/set-up-party-ledger/)
- **F12 > Provide Multiple Mobile Nos.** — contact name + mobile list. [src](https://help.tallysolutions.com/set-up-party-ledger/)
- **F12 > Set Default WhatsApp No.** — pick one or multiple mobile numbers. [src](https://help.tallysolutions.com/set-up-party-ledger/)
- **Ledger Contact Details report** — Alt+G > Ledger Contact Details > group; Alt+H Multi Alter; Alt+L Update Contact Details. [src](https://help.tallysolutions.com/set-up-party-ledger/)
- **Activate interest calculation** — per ledger advanced interest parameters. [src](https://help.tallysolutions.com/company-features-f11-tally/)
- **Bank ledger** — Bank Configuration (cheque printing), Set/alter e-Payments configuration, Use as notional bank for post-dated vouchers. [src](https://help.tallysolutions.com/company-features-f11-tally/)
- **F12 > Allow method of appropriation (used in purchase invoice)** — with **Inventory values are affected**, **Type of Ledger** (Not Applicable…), **Method of appropriation** (Appropriate by Qty/Value) — landed-cost allocation. [src](https://help.tallysolutions.com/ei-configure-vch-class-customs-duty-tally/)
- **Statutory Information / Tax Registration details** — per ledger. [src](https://help.tallysolutions.com/ei-configure-vch-class-customs-duty-tally/)
- **Stock-in-Hand ledgers** — closing balance computed from inventory, not editable. [src](https://help.tallysolutions.com/ledgers-in-tallyprime/)
- **Same party as debtor & creditor** — one ledger usable in both sales and purchase. [src](https://help.tallysolutions.com/ledgers-in-tallyprime/)
- **Delete** — Alt+D; blocked if predefined, has transactions, or used in another master/config (voucher type, payroll). Create/alter/delete edit-logged. [src](https://help.tallysolutions.com/ledgers-in-tallyprime/)
- **Reports** — Ledger Vouchers; Chart of Accounts. [src](https://help.tallysolutions.com/ledgers-and-groups-in-tallyprime/)

### Group master
- **Create** — Alt+G > Create Master > Group; Alt+C from ledger Under field; bulk via Chart of Accounts. [src](https://help.tallysolutions.com/groups-in-tallyprime/)
- **Fields** — Name, language aliases (F12), Under (Primary or other), **Nature of Group** (only under Primary: Assets, Liabilities, Expenses, Income), **Does it affect Gross Profits**, **Group behaves like a sub-ledger**, **Nett Debit/Credit Balances for Reporting**, **Used for calculation (taxes/discounts)**, **Method to allocate when used in purchase invoice** (Not Applicable / Appropriate by Qty / Appropriate by Value). [src](https://help.tallysolutions.com/groups-in-tallyprime/)
- **Delete** — blocked if has sub-groups, ledgers, or predefined. [src](https://help.tallysolutions.com/groups-in-tallyprime/)
- **Copy groups across companies** — both companies open; in alteration press F3 (Company) to switch to destination and save; bulk via Chart of Accounts > Group > Alt+H (Multi-Masters) > Multi Alter > F3. [src](https://help.tallysolutions.com/groups-in-tallyprime/)
- **Reports** — Group Summary, Group Vouchers. [src](https://help.tallysolutions.com/ledgers-and-groups-in-tallyprime/)

## Printing & Print Configuration

### Entry points
- **Ctrl+P (Current)** — print current voucher/report; select printer; **C** Configure, **I** Preview, **P** Print. **Alt+P (Print)** menu — Configuration, Invoice Templates, Others (multi-account reports). [src](https://help.tallysolutions.com/print-documents/) [src](https://help.tallysolutions.com/configure-for-print-export-share/)
- **Printable documents** — invoices, financial reports, payment reminder letters, dashboard tiles, multi-account reports. [src](https://help.tallysolutions.com/configure-for-print-export-share/)

### Application-level configuration (Alt+P / Alt+M > Configuration)
- **Set no. of copies for printing vouchers** / **…for e-mailing vouchers** — per voucher type count. [src](https://help.tallysolutions.com/configure-for-print-export-share/)
- **Set Preview as Default** — Print & WhatsApp. [src](https://help.tallysolutions.com/configure-for-print-export-share/)
- **Show Company Name / Show Company Address** (+ **Type of Address** with multiple addresses) / **Include company logo** (Company Details > Image File Name browse). [src](https://help.tallysolutions.com/configure-for-print-export-share/)
- **Auto wrap text in vouchers and reports** — see Auto Wrap. [src](https://help.tallysolutions.com/configure-for-print-export-share/)
- **Use Simple Invoice format** — default No (Commercial format); outgoing docs; Neat Mode printers only. [src](https://help.tallysolutions.com/configure-for-print-export-share/)
- **Invoice height/width/margins** — inches, for normal and simple invoices; templates allow only top/left/right/bottom margins (Rel 7.0+); default height 10" (A4), 5" for A5 half-size. [src](https://help.tallysolutions.com/configure-for-print-export-share/)
- **Optimise printing to save paper** — India company, Excise & Service Tax off, Plain Paper. [src](https://help.tallysolutions.com/configure-for-print-export-share/)

### Per-document print options (in print sub-form)
- **F5 (No. of Copies)** — Number of copies + **Type of Copy** (Original/Duplicate/Triplicate/Quadruplicate/Extra Copy) for sales/purchase; overrides app-level; purposes e.g. Customer/Transporter/Office copy. [src](https://help.tallysolutions.com/configure-for-print-export-share/)
- **F7 (Title)** — Header Information: Title, Subtitle. [src](https://help.tallysolutions.com/configure-for-print-export-share/)
- **F8 (Print Format)** — Dot Matrix Format; Neat Mode (default, laser/inkjet); Quick/Draft Format. [src](https://help.tallysolutions.com/configure-for-print-export-share/)
- **F9 Plain Paper ↔ Pre-Printed Paper** toggle. [src](https://help.tallysolutions.com/configure-for-print-export-share/)
- **F10 (Pages to Print)** — Number to start from first page; Page Range. [src](https://help.tallysolutions.com/configure-for-print-export-share/)
- **Show Contact details**; **Show Name and Address from Party Master** (vs from voucher); **Show Consignee details**. [src](https://help.tallysolutions.com/configure-for-print-export-share/)
- **Show Language** — print invoice/report in chosen language while books stay English (uses language aliases). [src](https://help.tallysolutions.com/configure-for-print-export-share/)
- **Show Bank Details** — select Bank Name ledger. [src](https://help.tallysolutions.com/configure-for-print-export-share/)
- **Show PAN / Income Tax No.**, **Show CIN** — statutory (IT Act 139A(5)(c), Companies Act 12(3)(c)). [src](https://help.tallysolutions.com/configure-for-print-export-share/)
- **Show Additional Descriptions for Stock Items / for Ledgers** — requires "Provide Additional Descriptions" in masters. [src](https://help.tallysolutions.com/configure-for-print-export-share/)
- **GST print options** — Show Item-wise GST details, Show GST Rate (in %), Show GST Analysis, Show HSN/SAC. [src](https://help.tallysolutions.com/configure-for-print-export-share/)
- **Show Previous and Current Balances of Ledger** — party running balance on invoice. [src](https://help.tallysolutions.com/configure-for-print-export-share/)
- **Show Export details** / templates: **Show Marks or Container No.**, **Show No. Packages**. [src](https://help.tallysolutions.com/configure-for-print-export-share/)
- **Show Dispatch Details** — LR-RR No., Motor Vehicle No. [src](https://help.tallysolutions.com/configure-for-print-export-share/)
- **Show Declaration** — from voucher type. [src](https://help.tallysolutions.com/configure-for-print-export-share/)
- **Show Terms and Conditions** — pick T&C set; **Format of Display**: Single Column / Double Column; only for predefined/saved templates, not Tally Classic. [src](https://help.tallysolutions.com/terms-and-conditions-in-templates/)

### Terms & Conditions setup
- **Voucher type T&C** — Alter Voucher Type > Set/Alter Terms and Conditions > List of Terms and Conditions (named sets, unlimited) > Terms and Conditions for screen (lines); **Default Terms and Conditions** (defaults to first defined). Sales, Debit Note, Credit Note, Sales Order, Delivery Note, POS. [src](https://help.tallysolutions.com/terms-and-conditions-in-templates/)

### Invoice templates
- **Template 1–4** — presentation variants, configurable fields. [src](https://help.tallysolutions.com/use-preferred-template/)
- **Template 5 (Multi-Logo)** — multiple brand logos. [src](https://help.tallysolutions.com/use-preferred-template/)
- **Template 6 (Multi-Address)** — service centre/corporate/branch addresses. [src](https://help.tallysolutions.com/use-preferred-template/)
- **Template 7 (Tally Classic)** — classic-like but customisable. [src](https://help.tallysolutions.com/use-preferred-template/)
- **GCC bilingual templates** — for GCC-country companies. [src](https://help.tallysolutions.com/use-preferred-template/)
- **POS Templates** — default print for POS voucher types. [src](https://help.tallysolutions.com/voucher-types-tally/)
- **Choose template** — Ctrl+P > Ctrl+H (Change Template), ←/→ to browse, F2 Template List; or Alt+P > Invoice Templates > Create/Modify Templates > Voucher Type (Gateway only). Ctrl+A use; **Ctrl+L** save template with current config; **Alt+R** print with/without colour; **Alt+T** Tally Classic format. [src](https://help.tallysolutions.com/use-preferred-template/)
- **Customisation** — watermark (Paid/Cancelled), font & colour, image header & footer, custom fields, extra T&C, bilingual. [src](https://help.tallysolutions.com/print-documents/)

### Multi-account reports & letters
- **Others menu** — Alt+P/Alt+E/Alt+M > Others > report list. **Sorting Method** (Default alphabetical / Group-wise); **Include/Exclude Groups & Ledgers** (Rel ≤3.0.1: Select Group/Ledgers); **Set alphabetical range to print** (From/To). [src](https://help.tallysolutions.com/configure-for-print-export-share/)
- **Reminder Letters** — Bills Receivable, All Ledger Outstandings, Ledger Outstandings, Group of Account Outstandings, Group Outstandings. **Confirmation of Accounts** — Cash Book, Bank Book, All Ledger Accounts, One Ledger Account, Group of Accounts. [src](https://help.tallysolutions.com/configure-for-print-export-share/)

## E-mail, WhatsApp, Export & Share

- **Alt+M (Share)** — E-MAIL and WHATSAPP sections; **Alt+E (Export)**. [src](https://help.tallysolutions.com/configure-for-print-export-share/)
- **F8 (File Format)** for E-mail/WhatsApp/Export — ASCII (Comma Delimited), Excel (Spreadsheet), HTML (Web-Publishing), JPEG (Image), JSON (Data Exchange), PDF (Read-only; optional Digital Signature details), XML (Data Interchange). [src](https://help.tallysolutions.com/configure-for-print-export-share/)
- **Alt+E vs Ctrl+E** — Alt+E generic export in all screens (Excel, PDF, XML, JSON…); Ctrl+E only in statutory return reports (e-Returns / e-Annexures) to fixed department templates, format not changeable. [src](https://help.tallysolutions.com/difference-btw-alte-and-ctrle-tally/)
- **WhatsApp voucher after saving** — voucher type option. **Registered Business WhatsApp numbers** — security-controlled. WhatsApp via WABA/Interakt (add existing number to WABA; set up Interakt account). [src](https://help.tallysolutions.com/voucher-types-tally/) [src](https://help.tallysolutions.com/add-existing-no-to-waba/) [src](https://help.tallysolutions.com/set-up-interakt-account/)

### Export (Alt+E) — Release 7.0
- **Exportable** — masters, transactions, vouchers, reports, GST returns, dashboard tiles, multi-account docs; formats .txt (ASCII), .xlsx, .html, .jpg, .pdf, .xml, .json. [src](https://help.tallysolutions.com/export-data-in-tally/)
- **Alt+E > Configuration** — Location of Import/Export Files; Open file after export; Folder path for Payment Instructions; Show payment instruction details before Export; Export base currency symbol along with the amount; Header Information; Company Details. [src](https://help.tallysolutions.com/export-data-in-tally/)
- **Ctrl+E (Current)** — export open voucher/report; C configure (Voucher/Report Details, Export Settings: format, path, file name); E export. [src](https://help.tallysolutions.com/export-data-in-tally/)
- **Reminder Letter export** — Alt+E > Others > outstanding report; Report Type = Reminder Letter; ageing range; Reminder Letter information; Show Due On; Show Overdue Days; Designation of Signing Authority. [src](https://help.tallysolutions.com/export-data-in-tally/)
- **Confirmation of Accounts export** — Report Type = Confirmation of Accounts; Provide Confirmation Statement; signing designation. [src](https://help.tallysolutions.com/export-data-in-tally/)
- **Export Masters** — Type of Master (Accounting Masters, Inventory Masters, others); Include dependent masters; Export closing balance as opening balance. [src](https://help.tallysolutions.com/export-data-in-tally/)
- **Export Transactions** — Type of Voucher entries (All / Accounting / Inventory); Include dependent masters; period. [src](https://help.tallysolutions.com/export-data-in-tally/)
- **Dashboard tiles** — export single or all tiles. [src](https://help.tallysolutions.com/export-data-in-tally/)
- **PDF digital signature**. [src](https://help.tallysolutions.com/export-data-in-tally/)

### WhatsApp onboarding (Interakt / WABA)
- **Sign-up** — Alt+M (Share) > Manage > Sign Up for WhatsApp → customer portal "WhatsApp for Business"; prerequisites: active TSS ≥1 month, GST certificate, Facebook business page, business phone; Tally Partner assigned. [src](https://help.tallysolutions.com/set-up-interakt-account/)
- **Add number to WABA** — via Interakt portal: existing WhatsApp Business App number (QR scan) or new number; GST certificate upload for Meta approval or website/FB page; login with WhatsApp Business app or Facebook. [src](https://help.tallysolutions.com/add-existing-no-to-waba/)

## Data Management

### Data menu & paths (Alt+Y)
- **Alt+Y (Data) > Configuration** — Backup Data Path (also default for migrate/repair backups); Schedule Backup Data Path (default TallyDrive); Company Data Path (= default Restore path); Port; Auto-restore companies from TallyDrive with the same Backup Password (default Yes). [src](https://help.tallysolutions.com/setup-backup-restore/)
- **Data overview** — Import, Migrate, Synchronise, Repair, Export, Split, Extract/Share (Pivot, ODBC, FTP), Moving to New Financial Year (split / new company with imported opening balances / new books). [src](https://help.tallysolutions.com/manage-your-company-data-tally/)

### Backup (Rel 7.0+)
- **Destinations** — TallyDrive (cloud, Rel 7.0+, AWS-hosted, auto-compressed) or local drive. [src](https://help.tallysolutions.com/backup-and-restore-in-tallyprime/)
- **Manual backup** — Alt+Y > Backup & Restore > Backup; multi-company; TallyVault password prompted for vaulted companies. [src](https://help.tallysolutions.com/backup-and-restore-in-tallyprime/)
- **Rel ≤6.2 backup** — Alt+Y > Backup; Backup Destination Path; select company or All Items; file TBK1800_*; overwrite or rename on conflict. [src](https://help.tallysolutions.com/backup-restore-company-data-tally/)
- **Backup Password (TallyDrive)** — encrypts backup; **Recovery Key** e-mailed to Tally.NET ID + extra recovery e-mails. [src](https://help.tallysolutions.com/backup-and-restore-in-tallyprime/)
- **TallyDrive access** — enable Tally.NET ID for TallyDrive; one-time T&C acceptance (View T&C and Privacy Policy; I have read… consent); admin approves users via portal or in-product; standard users send approval requests; active TSS required. [src](https://help.tallysolutions.com/setup-backup-restore/)
- **TallyDrive user rights** — TallyDrive Management report > F7 (Manage User Rights) > Permissions for TallyDrive Backup and Restore (e.g. Download/Restore Company Backups; backup; delete). [src](https://help.tallysolutions.com/not-authorised-to-restore-backup/)
- **TallyDrive Management report** — monitor storage usage, download/delete backups, extend storage, switch between licenses linked to the Tally.NET ID. [src](https://help.tallysolutions.com/backup-and-restore-in-tallyprime/)
- **Storage capacity** — by license type (Silver/Gold); alert at 80% via e-mail/notification; buy extra on portal; TSS expiry stops backups, existing kept 90 days then deleted. [src](https://help.tallysolutions.com/backup-and-restore-in-tallyprime/)
- **Incremental backup** — recommended for daily scheduled runs. [src](https://help.tallysolutions.com/backup-and-restore-in-tallyprime/)

### Scheduled backup
- **Frequency** — once, daily, weekly, monthly; to TallyDrive or local; requires system on; users cannot enter data while backup runs; ≤3 concurrent tasks recommended. [src](https://help.tallysolutions.com/backup-and-restore-in-tallyprime/)
- **Schedule Backup report** — Alt+Y > Backup & Restore > Schedule Backup; columns Company Name, Number, Backup Data Path, Last Backup (Date & Time, Status), Next Backup; F12 Show Schedule Details (frequency, occurs on, time); Alt+F5 detailed; Ctrl+B Basis of Values: Show report for (active/paused/completed/all), Last Backup Status (in progress/success/failed/on hold/yet to start), Backup Frequency; F7 Refresh Details. [src](https://help.tallysolutions.com/manage-backup-schedules/)
- **Actions** — F6 Backup Now (Spacebar select); Alt+A Add Schedule; Enter → Backup Log (Ctrl+B by status; Alt+C Clear Log keeps latest); Alt+D Delete (keeps backups); Ctrl+Enter Alter Schedule (change path local↔TallyDrive, **Take a Backup Now**, **Pause Schedule**, Security Details). [src](https://help.tallysolutions.com/manage-backup-schedules/)
- **Backup password management** — Set/Alter Backup Password: alter (old→new, applies to past+future), add, remove (blank new), Alt+R Reset (future backups only); E-mail for Recovery Key (multiple). [src](https://help.tallysolutions.com/manage-backup-schedules/)
- **Multi-user schedules** — Current Scheduler vs Other Scheduler per company (F3 company); Alt+V Move schedule to current scheduler. [src](https://help.tallysolutions.com/manage-backup-schedules/)
- **Vaulted companies** — shown as ******* when not loaded; Alt+F3 load to alter/delete. **Action Required** section: TallyVault password required, Company not accessible from source path, Requires Migration/Repair. [src](https://help.tallysolutions.com/manage-backup-schedules/)
- **TallyPrime Server schedule** — Alt+K (TallyPrime Server) > Administration > Schedule Backup: Data Location, Backup Destination, Schedule Type Daily/Weekly/Monthly, On (day), Time (multiple per day); folder format <Folder>\<DataPoint>\<YYYY-MMM-DD_Time>; not for TallyVault companies. [src](https://help.tallysolutions.com/schedule-data-backup/)
- **TPS permissions** — Server Monitor: publish data (Data Server, IP, Port from F1), Security Level with **Allow backup** and **Allow to schedule backup in TallyPrime**, assign to Tally.NET ID. [src](https://help.tallysolutions.com/setup-for-backup-restore/)

### Restore
- **Restore** — Alt+Y > Backup & Restore > Restore; Restore Data Path; source TallyDrive (Cloud Storage) / local / downloaded backups (Downloads sub-folder); Select Backup across licenses (Account ID + serial); **Select Version** (List of Versions by Date & Time, latest first); Backup Password or Recovery Key; TallyVault password; on name clash **Skip** or **Replace**. [src](https://help.tallysolutions.com/restore-company-data/)
- **Rel ≤6.2 restore** — Alt+Y > Restore; Restore Destination Path; select or All Items. [src](https://help.tallysolutions.com/backup-restore-company-data-tally/)
- **TPS restore** — choose Tally Data Server path, Tally.NET login. [src](https://help.tallysolutions.com/restore-backup-data/)

### Repair
- **Repair** — F1 > Troubleshooting > Repair, or Alt+Y > Repair, or Ctrl+Alt+R on Gateway; status "Repair Required"; **Backup Company Data before Repair: Yes**; R to repair; removes Edit Log info. [src](https://help.tallysolutions.com/repair-company-data-tally/)
- **Statistics after repair** — Rel 3.0+: before/after voucher & master counts (Alt+F5 detail/condensed); Alt+X Repair/Migrate Exceptions report; F1 > Troubleshooting > Repair/Migrate Exceptions; Alt+Y > All Exceptions. [src](https://help.tallysolutions.com/repair-company-data-tally/)
- **Zero Command Repair** — run `tally.exe "<data path>" 0` for forced partial repair. [src](https://help.tallysolutions.com/repair-company-data-tally/)

### Migrate
- **Migrate** — to latest release; retains vouchers, masters, security; requires active TSS, ≥4 GB RAM; pre-migration check (Rel 6.0); 5-digit → 6-digit company number (2.1→3.0+), original kept; pausable/resumable while working in old version; Migration Summary statistics; from Tally 5.4/6.3/7.2 separate path. [src](https://help.tallysolutions.com/migrate-company-data-tally/)
- **Migrate Configuration** — Create HSN/SAC summary for: All Sections / All Sections Except B2C / None (Rel 5.0/5.1). [src](https://help.tallysolutions.com/migrate-company-data-tally/)
- **Interim transactions** — keep recording in old copy, export XML, import after migration. [src](https://help.tallysolutions.com/migrate-company-data-tally/)

### Split company data
- **Verify Data** — Alt+Y > Split > Verify Data; List of Errors screen to fix before split. [src](https://help.tallysolutions.com/split-company-data-tally/)
- **Split Data (Rel 6.0+)** — Alt+Y > Split > Split Data; Split from date; **Split Company**: From Split Date / Before Split Date / Into Two Companies; original company retained; split logged in Edit Log. [src](https://help.tallysolutions.com/split-company-data-tally/)
- **Split (Rel ≤5.1)** — always two new companies, Split from = FY start. [src](https://help.tallysolutions.com/split-company-data-rel-5-1-and-earlier/)
- **Pre-split best practices** — finalise books, adjust forex gains/losses, clear pending bills, finish TDS/TCS cycle, reconcile GST returns, backup. [src](https://help.tallysolutions.com/split-company-data-tally/)

### Synchronisation & Snapshot exchange
- **Synchronisation** — client/server rules (Client Rules, Server Rules) for branch data exchange; real-time updates across locations; sync events edit-logged (Created/Altered/Resaved due to Sync). [src](https://help.tallysolutions.com/manage-your-company-data-tally/) [src](https://help.tallysolutions.com/edit-log-activities/)
- **Snapshot Exchange** — Alt+Z (Exchange) > Snapshots > Exchange Snapshot Online (select rule); sends all data created/altered since last exchange (first = all); needs client rule activated on server; results in F1 > Troubleshooting > Event Log. [src](https://help.tallysolutions.com/snapshot-exchange/)
- **Export Snapshot** — Alt+Z > Snapshots > Export Snapshot: Export for Masters/Transactions, rule, location, output file name (XML; masters first). **Import Snapshot** — Import for Masters/Transactions, rule, file. [src](https://help.tallysolutions.com/snapshot-exchange/)

### Sharing data
- **Windows folder share** — share data folder Read/Write to users (Win 10/7 steps) for multi-user access. [src](https://help.tallysolutions.com/share-data-from-your-windows-computer-tallyhelp/)
- **Tally FTP site** — send data >6 MB (zip/rar) to support; login = Case ID. [src](https://help.tallysolutions.com/share-company-data-ftp-site/)

### TallyPrime Server (multi-user server edition) monitoring
- **Company View** — per company: Currently Logged in Users; reports Viewed/Printed/Exported/Edited counts; entries Created/Altered/Deleted; imported entries C/A/D; online blue/offline black; **Long Hold** in red (≥10 min freeze) with user. Alt+F5 last activities; Ctrl+H count vs time; Alt+K > Manage Server (F3 Select Server, F4 Change User; Export, Backup, Restore, Rewrite, Disconnect Users). [src](https://help.tallysolutions.com/company-view/)
- **F12 config** — Time format (H:M, H:M:S, Hrs, Mins, Secs); Interval for auto refresh (default 5 min, min 0.1, 0 off); Show Reports/Entries/Imported Entries (Total) + Show Breakup; Sorting Method; Sorting By column. [src](https://help.tallysolutions.com/company-view/)
- **User View** — F3 By User/By Company; per user loaded companies & activity; F7 Show/Hide Entries; F4 By Time; Alt+N/Ctrl+P sort columns; Alt+A descending. [src](https://help.tallysolutions.com/user-view/)

### Import (Alt+O)
- **Import sources** — another TallyPrime instance (XML/JSON export), other ERPs (Excel/XML/JSON), own Excel via mapping templates, predefined Sample Excel Files, e-commerce/ERP templates (Amazon plug-in, Busy, Marg, Odoo, QuickBooks Desktop/Online, Sage, Shopify). [src](https://help.tallysolutions.com/import-data-in-tally/)
- **Format support by release** — <4.0 XML only; 4.0+ Excel + XML; 7.0+ JSON too. [src](https://help.tallysolutions.com/import-data-from-xml-or-json/)
- **Alt+O > Masters / Transactions** — File Path, File to Import, File Format (Excel (Spreadsheet)/XML/JSON), Mapping Template (Default Template for sample files), Type of Master, **Behaviour of Import if Masters already exists**, **Preview Import Summary**, **Backup Company Data before Import** (recommended), I to import. [src](https://help.tallysolutions.com/how-to-import-data-using-sample-excel-files-tallyhelp/)
- **Order** — import masters before transactions; verify via Chart of Accounts, Day Book, Sales/Purchase Register. [src](https://help.tallysolutions.com/import-data-from-xml-or-json/)
- **Exceptions report** — missing mandatory fields, invalid names, wrong GST details, duplicates, unsupported formats; import completes with exceptions to fix. [src](https://help.tallysolutions.com/import-data-in-tally/)
- **Marg import** — Marg: Final Reports > Utilities > Data IMPORT/EXPORT > Tally/Busy Erp9 → XML → Alt+O. [src](https://help.tallysolutions.com/import-data-from-xml-or-json/)
- **Import-driven edit log** — Created/Altered/Resaved due to Import. [src](https://help.tallysolutions.com/edit-log-activities/)

### Excel mapping templates
- **Create** — Alt+O > Manage > Mapping Templates > MASTERS/TRANSACTIONS > Create: Excel file, worksheet, row/column details (start row, header row), map Field (TallyPrime) ↔ Column Header (Excel) or Column (Excel); verify mapping; Ctrl+A. Saved under config\excelmaps; scope All Companies or This Company. [src](https://help.tallysolutions.com/import-data-using-any-excel-file/)
- **Mandatory fields** — Name and Group Name for accounting masters. [src](https://help.tallysolutions.com/import-data-using-any-excel-file/)
- **Alter / Delete** — Manage > Mapping Templates > Alter (Alt+D delete); F1 > Troubleshooting > Delete Mapping Templates Saved for All Companies / for This Company (single or Delete All). [src](https://help.tallysolutions.com/import-data-using-any-excel-file/)
- **Ledger Details from Multiple Rows** — one voucher across rows; also multiple-column layouts; fixed ledger columns for top/bottom entries; with/without column headers. [src](https://help.tallysolutions.com/map-data-from-multiple-rows-columns/)
- **Compute Value** — combine Dr/Cr columns into Opening Balance; concatenate cells (Model+Size → Name); condition → Yes/No (e.g. "containing Billwise" → Maintain balances bill-by-bill). [src](https://help.tallysolutions.com/map-nett-amount-values/)
- **Specify Fixed Field Value** — constant for all rows (e.g. Group = Sundry Debtors). [src](https://help.tallysolutions.com/map-nett-amount-values/)
- **Exclude Rows in Excel** — F12 > Exclude rows in Excel while importing Data; Column Header + Condition + value; multiple conditions. [src](https://help.tallysolutions.com/exclude-rows-in-excel/)
- **Unique values** — default uniqueness: masters by Name; vouchers by Voucher Type Name + Date + Number; add parameters via F12 > Show Additional Options for creating Masters > Unique values for creating masters > Additional Options. [src](https://help.tallysolutions.com/set-up-unique-values-in-mapping-templates/)
- **Attendance mapping** — import attendance from Excel. [src](https://help.tallysolutions.com/import-data-in-tally/)

### Sample Excel files
- **Export sample** — Alt+O > Manage > Sample Excel File > Masters/Transactions; C configure: Export sample file for (master type), Excel format, path, name; E export. [src](https://help.tallysolutions.com/how-to-import-data-using-sample-excel-files-tallyhelp/)
- **Master samples** — Ledger general; ledger specific field; Primary Mobile + Default WhatsApp No.; Multiple Mobile Nos.; Opening Balance + multiple bill-wise; bank ledger with bank details; party with bank details; multiple addresses; multicurrency; multilingual names; ledger with GSTIN; Cost Centres; Stock Item with BoM; Godown; Simple & Compound Units; Stock Item with Price List; Standard Price & Standard Cost; stock items in user-defined formats. [src](https://help.tallysolutions.com/download-sample-excel-files-with-data-for-import/)
- **Transaction samples** — general vouchers; sales multicurrency; sales with cost centre; sales with GST/e-Way/e-Invoice; accounting + cost centre allocation; bill allocation; Sales Order with accounting allocation (sales & expense ledger); ledger entries in multiple rows/columns; Dr/Cr in same column with +/– signs; sales vouchers multi-column/multi-row; with bill allocations; without inventory. [src](https://help.tallysolutions.com/download-sample-excel-files-with-data-for-import/)

### Extract: ODBC & Pivot
- **Enable ODBC** — Alt+Z (Exchange) > Configure > Data Synchronisation > Client/Server configuration > Enable ODBC: Yes; Port (default 9000; see F1 > Settings > License > Manage License "Tally Gateway Server"). [src](https://help.tallysolutions.com/extracting-master-data-to-microsoft-excel-using-odbc-tally/)
- **Excel via ODBC** — Data > Get Data > From ODBC > TallyODBC64_9000 > company > Ledger/StockItem tables > Power Query; live refresh (Refresh every N min); bitness of OS/Tally/Office must match. [src](https://help.tallysolutions.com/extracting-master-data-to-microsoft-excel-using-odbc-tally/)
- **Word mail merge via ODBC** — labels/letters from Ledger/StockItem/CostCategory; filter $Parent = Sundry Debtors/Creditors; fields MailingName, M_Address1–4, PinCode. [src](https://help.tallysolutions.com/extract-data-to-ms-word-using-odbc/)
- **Export for Pivot table** — Sales/Purchase Voucher Register > Alt+E > Current > C: Encoding Language, Excel, Worksheet Name, **Export for Pivot table** (needs accounts with inventory), Show Stock Item properties, Show Ledger properties, Show GST details, Show Dispatch details, Show Order details, Show Export/Import details, Show Company Name, Update existing file, Show formatted excel, destination folder/name, Open file after Export. [src](https://help.tallysolutions.com/extracting-data-through-pivot-table-tally/)

## Integrations & AI

- **Docs by Ira (AI document → voucher)** — Alt+O > Transactions (PDF & Images) under Docs by Ira (or All Docs by Ira options); Voucher Type (Sales, Purchase, Credit Note, Debit Note, Delivery Note, Receipt Note, Sales Order, Purchase Order, Journal); Import as Accounting Invoice / As Voucher / Item Invoice; Journal: With Inventory / Without Inventory / Treat each Item as a Ledger; File Path, File or All Files; backup option; first use needs admin Tally.NET ID + T&C. One voucher type per batch; no handwritten docs. [src](https://help.tallysolutions.com/voucher-creation-document-import/)
- **Draft Transactions report** — Ready to Convert list; F10 (Save Vouchers); resolve exceptions. Alt+O > Review Imported Transactions (Draft). [src](https://help.tallysolutions.com/voucher-creation-document-import/)
- **Autofill** — in voucher creation Ctrl+F (Autofill): Type of Activity Docs by Ira, file → fields auto-filled. [src](https://help.tallysolutions.com/voucher-creation-document-import/)
- **Quota usage** — Docs by Ira packs; Quota Usage Summary report. [src](https://help.tallysolutions.com/monitor-customer-credit-usage-in-tallyprime/)
- **TallyIra mobile app** — admin: Alt+K > Security > Mobile number for TallyIra Access; users: Users and Passwords > Username (e-mail), Update Access, Allow TallyIra Access, Mobile number; app (Android/iOS/tablets) OTP login; scan multi-page or upload/share (e.g. from WhatsApp); choose Voucher Type + Voucher Mode; lands in Draft Transactions. [src](https://help.tallysolutions.com/voucher-creation-tallyira-app/)
- **Claude Desktop connector / TallyPrime MCP** — "Connect Claude Desktop with TallyPrime" and "TallyPrime MCP Tools" pages (Rel 7.1 era); MCP tool categories: Company Master, Accounting, Inventory, Outstanding, Transactions; body text not captured in crawl. [src](https://help.tallysolutions.com/connect-claude-desktop-with-tallyprime/) [src](https://help.tallysolutions.com/tallyprime-mcp-tools/)
- **Connected services** — remote access, Tally Virtual User (TVU), Reports in Browser, synchronisation; Control Centre (licenses/sites/users), Support Centre, GSTN portal returns, e-Invoice/e-Way Bill, connected banking, WhatsApp; needs Tally.NET ID + active TSS. [src](https://help.tallysolutions.com/connected-services-in-tallyprime/)

### XML / JSON / HTTP integration (developer)
- **Integration channels** — TallyPrime↔TallyPrime via Sync; TallyPrime → external in various formats; external → TallyPrime via XML, JSON, SDF; TallyPrime DB ↔ external via ODBC (Tally as ODBC client and server). [src](https://help.tallysolutions.com/what-is-th-overall-perspective-on-tally-technology/)
- **XML request envelope** — `<ENVELOPE><HEADER><TALLYREQUEST>Import Data|Export|Import</TALLYREQUEST>` with REPORTNAME "All Masters" / "Vouchers"; TALLYMESSAGE objects with Action="Create"/"Alter"; sent over HTTP to Tally Gateway Server port (default 9000). Tool: Tally Connector (TallyPrime Developer). [src](https://help.tallysolutions.com/sample-xml/)
- **Master XML** — Group (NAME, PARENT); Ledger (NAME, PARENT, MAILINGNAME.LIST, ADDRESS.LIST, PINCODE, COUNTRYNAME, LEDSTATENAME, EMAIL, EMAILCC, LEDGERPHONE, LEDGERMOBILE); Stock Group; Stock Item (NAME, BASEUNITS, NAME.LIST aliases, STANDARDPRICELIST.LIST, standard cost, Part numbers via MAILINGNAME.LIST when "Use Part Number for stock items?"); Unit (NAME, ISSIMPLEUNIT, ORIGINALNAME, DECIMALPLACES, BASEUNITS, ADDITIONALUNITS, CONVERSION); Godown. [src](https://help.tallysolutions.com/sample-xml/)
- **Voucher XML** — VOUCHER VCHTYPE, ACTION, OBJVIEW; PERSISTEDVIEW (Accounting Voucher View, Invoice Voucher View, Inventory Voucher View, Pay Slip Voucher View, Consumption Voucher View, Multi Consumption Voucher View); VOUCHERTYPENAME; DATE yyyymmdd; ISINVOICE; ALLLEDGERENTRIES.LIST (LEDGERNAME, ISDEEMEDPOSITIVE, amount); sales As Voucher vs As Invoice. [src](https://help.tallysolutions.com/sample-xml/)
- **Response** — CREATED, ALTERED, DELETED, LASTVCHID, LASTMID, COMBINED, IGNORED, ERRORS, CANCELLED, EXCEPTIONS (JSON equivalent `import_result`). Master-ID usable as external reference. [src](https://help.tallysolutions.com/sample-xml/) [src](https://help.tallysolutions.com/how-to-use-import-file-definition-and-related-events/)
- **Export requests** — TYPE Data/Collection/Object; report IDs e.g. Daybook, Trial Balance, List of Accounts, List of Ledgers; SVEXPORTFORMAT XML/HTML; SVFROMDATE/SVTODATE, SVCURRENTCOMPANY. [src](https://help.tallysolutions.com/sample-xml/)
- **Import File definitions (TDL)** — default "All Masters" and "Vouchers"; attributes **Response Report** (custom XML/JSON response), **Empty** (skip objects by condition); events Start Import, Import Object, After Import Object, End Import; functions $$ImportAction, $$LastImportError, $$ImportType (e.g. SOAP/HTTP). [src](https://help.tallysolutions.com/how-to-use-import-file-definition-and-related-events/)
- **TDL customisation** — Tally Definition Language (4GL, definitions Report/Form/Part/Line/Field/Menu/Collection/Object/Import File…); load via Tally.ini (User TDL, TDL=) or F1 > TDLs & Add-Ons > F4 Manage Local TDLs ("Load selected TDL files on startup"); Include definition; per-user Local TDL permission. [src](https://help.tallysolutions.com/what-is-th-overall-perspective-on-tally-technology/) [src](https://help.tallysolutions.com/manage-users-in-tallyprime/)
- **Platform** — OODBMS with embedded indexes, CRC fault tolerance, roll-forward transactions, state files for concurrency; output engine to screen, printer, file (XML, SDF), mail, HTTP. [src](https://help.tallysolutions.com/what-is-th-overall-perspective-on-tally-technology/)

## Banking Automation (adjacent to core)
- **Import bank statements** — Excel/CSV, supported-bank formats; needs bank ledger with Bank Name, Account No, IFSC. Auto-reconcile with Exact/Potential/Partial matches; modify matches; unlink; Reset Bank Statement Data. [src](https://help.tallysolutions.com/auto-vch-creation-recon/)
- **Auto-create vouchers from statement** — Alt+G > Banking Activities > Bank Reconciliation count > F7 (Create Vch/Multi-Vch) multi-voucher with per-row Ledger Name + Common Ledger; Rel 7.1 bill-wise details (F12 Use Bill-wise Details in Multi Voucher Creation); Alt+F7 consolidated voucher; created as Optional → R (Mark as Regular & Reconcile) or Ctrl+J > Optional Vouchers (Bank Data). Requires Automatic (Manual Override) numbering if Manual/duplicate-prevention set. [src](https://help.tallysolutions.com/auto-create-vouchers/)
- **Connected Banking Get Statement** — Alt+Z > All Banking Options > Get Statement; Alt+S set period (one account at a time); S get/import; Alt+R Delete Request; F1 > Troubleshooting > Reset Bank Statement Data (Retain Reconciliation Status, period, backup). [src](https://help.tallysolutions.com/get-statement/)

## Remote Access, Cloud & Licensing
- **Work from anywhere** — Tally Virtual User (TVU packs over RDP/RDS/cloud), Reports in Browser (responsive, mobile; needs TSS + Tally.NET), built-in Remote Access (record vouchers & view reports remotely), Synchronisation (no continuous internet needed, same release at all sites); CA access to client data via Tally.NET ID. License modes: perpetual, rental, Educational. [src](https://help.tallysolutions.com/tally-prime/connected-services/work-from-home-or-anywhere/)
- **Event Log** — F1 > Troubleshooting > Event Log: Event Category (Browser, Remote Access, Synchronisation, Import, Export…), Event Type (Info/Error/Status/Warning), Message, Timestamp; Alt+C Clear Log. [src](https://help.tallysolutions.com/tally-prime/connected-services/work-from-home-or-anywhere/)
- **TallyPrime Cloud Access / Virtual Computer** — browser desktop with D: cloud disk (My_Applications, Shared_Data, My_Files/Export); Control Panel (Disconnect, Full Screen, Notifications, File Manager upload/download, Permissions Manager, resolution); folder permissions per user (Allowed / Allowed in TallyPrime / Disallowed, inheritance rules); Web-Printer printing via browser (save as PDF); Zero Command Repair & Generate Error Log shortcuts; no dongle DSC, no sync-over-IP from local, one license, no exe/DLL customisations; AWS variant: custom fonts, user-defined paper sizes. [src](https://help.tallysolutions.com/set-up-your-virtual-computer-for-oci/)
- **Editions** — TallyPrime (Edit Log optional), TallyPrime Edit Log (cannot disable), TallyPrime Server (concurrency monitoring, centralised control); license Silver (single user) / Gold (multi-user); TSS subscription gates connected services, TallyDrive, migration to latest release. [src](https://help.tallysolutions.com/tally-prime/) [src](https://help.tallysolutions.com/backup-and-restore-in-tallyprime/) [src](https://help.tallysolutions.com/migrate-company-data-tally/)
- **Firewall/ports** — TallyPrime & Tally Scheduler EXE, ports, IPs, URLs need firewall exceptions; ODBC/Gateway port default 9000 (Alt+Y > Configuration > Port). [src](https://help.tallysolutions.com/add-tallyprime-exe-ports-to-firewall-exceptions/) [src](https://help.tallysolutions.com/extracting-master-data-to-microsoft-excel-using-odbc-tally/)
- **Data sharing modes** — single-user license data folder sharing vs multi-user client/server data configuration; F12 > Data Configuration > Load Companies on startup. [src](https://help.tallysolutions.com/faq/)

## Navigation & UX conventions
- **Go To (Alt+G)** — open any report/voucher/master from anywhere; Create/Alter Master, Create Voucher. **Gateway of Tally** menu. [src](https://help.tallysolutions.com/quick-start-with-tallyprime/)
- **Right button bar** — context buttons; underlined shortcut letters (single/double underline). [src](https://help.tallysolutions.com/quick-start-with-tallyprime/)
- **Ctrl+I More Details** — capture voucher-specific info without enabling features. **F12 Configure** per screen; **F11 Features**. [src](https://help.tallysolutions.com/quick-start-with-tallyprime/)
- **Ctrl+A** save/accept everywhere; Alt+C create on the fly; Alt+D delete; Alt+H Multi-Masters (Multi Alter); Ctrl+H Change View/Mode; Alt+F5 detailed/condensed; Ctrl+B Basis of Values; F2/Alt+F2 date/period. [src](https://help.tallysolutions.com/groups-in-tallyprime/) [src](https://help.tallysolutions.com/view-edit-log-summary/)
- **Help** — F1 Help > Settings (Display, License), Troubleshooting (Repair, Event Log, Delete Mapping Templates, Reset Bank Statement Data, Repair/Migrate Exceptions), TDLs & Add-Ons. [src](https://help.tallysolutions.com/repair-company-data-tally/)

## Known import/FAQ limitations
- **Excel import limits** — horizontal mapping only (no vertical); no auto round-off on import (add round-off column/ledger); bank transactions not importable via Excel import (use bank statement import); Dr/Cr total mismatch → "Voucher totals do not match". [src](https://help.tallysolutions.com/faq/)
- **Reuse deleted voucher no.** — Ctrl+I > Voucher No. Details > Select Unused Voucher Nos. **Delete unused ledgers at once** supported. [src](https://help.tallysolutions.com/faq/)

---
Unread/irrelevant (skimmed only): TDL definition-attribute references (collection/field/form/part/object/nameset/ruleset/system/import_file_definition_attributes); GST/TDS/tax-specific pages (adjust_advance_received, branch_transfer_with_ewb, ewb_cannot_be_extended, invalid_transporter_mode, mismatch_in_field_doc_no, form_27q, print_form_27a, export_form_1_so_2751_e, returns, uploading_to_iff, sale_for_solar, supply_of_works_contract, how_to_record_sale_of_mixed_supply); eTIMS (Kenya) edit-log; incorrect_user_id error; home/welcome/how_to_use_tallyhelp nav pages; connect_claude_desktop & tallyprime_mcp_tools (nav only, no body text); import_data_import_data_using_any_excel_file (duplicate); tally_prime_accounting_accounting_in_tally_prime (duplicate).


# TallyPrime — India Statutory Compliance (GST, e-Invoice, e-Way Bill, Returns, TDS/TCS, MSME, Payroll statutory)

Source: TallyHelp pages crawled 2026-10. Releases noted as "Rel X.Y". Base URL prefix `https://help.tallysolutions.com/`.

## GST Company Setup

### Enable GST & registration details
- **Enable Goods and Services Tax (GST)** — F11 (Company Features) > Yes; opens GST Registration Details. [src](https://help.tallysolutions.com/set-up-gst-details-in-company/)
- **State** — auto-filled from company info, editable. [src](https://help.tallysolutions.com/set-up-gst-details-in-company/)
- **GSTIN/UIN** — 15-digit; can be left blank and entered later (Tally does not block transactions until registration number known). [src](https://help.tallysolutions.com/essentials-for-your-gst-journey/)
- **Registration Type (company)** — Regular, Composition, Regular – SEZ. [src](https://help.tallysolutions.com/set-up-gst-details-in-company/)
- **Assessee of Other Territory** — toggle for businesses located in other territory. [src](https://help.tallysolutions.com/set-up-gst-details-in-company/)
- **Periodicity of GSTR-1** — Monthly / Quarterly (QRMP) based on turnover. [src](https://help.tallysolutions.com/set-up-gst-details-in-company/)
- **Registration Name** — auto-generated "<State> Registration" (e.g. Karnataka Registration), renamable (e.g. "Bengaluru Branch"); Rel 3.0+. [src](https://help.tallysolutions.com/set-up-gst-details-in-company/)
- **Effective-dated GST details** — changes to company GST details carry an Effective Date (history retained). [src](https://help.tallysolutions.com/set-up-gst-details-in-company/)

### Multiple GST registrations (Multi-GSTIN)
- **Create another GST Registration for the Company** — Yes adds another registration in same company; Rel 3.0+. [src](https://help.tallysolutions.com/set-up-gst-details-in-company/)
- **Per-registration transactions & returns** — record transactions under a registration, generate/file returns per registration; MIS reports stay company-wide (not GSTIN-wise). [src](https://help.tallysolutions.com/setting-up-gst-in-tallyprime/)
- **GST Registration master** — Alt+G > Alter Master > GST Registration to view/verify registrations. [src](https://help.tallysolutions.com/how-to-merge-companies-with-different-gstins/)
- **Merge companies with different GSTINs** — upgrade to Rel 3.0+ > migrate > create registrations in target company > ensure unique voucher numbering series per company > export masters+transactions and import > verify via Day Book, Statistics, Chart of Accounts. [src](https://help.tallysolutions.com/how-to-merge-companies-with-different-gstins/)
- **Use common voucher numbering series for all GST Registrations** — F11 > Set/Alter Company GST Rate and Other Details. [src](https://help.tallysolutions.com/essentials-for-your-gst-journey/)

### Connected GST details (company)
- **GST Username** — portal username, under Connected GST Details in GST Details screen; Rel 5.0+. [src](https://help.tallysolutions.com/set-up-gst-details-in-company/)
- **Mode of Filing** — Digital Signature Certificate (DSC) / Electronic Verification Code (EVC). [src](https://help.tallysolutions.com/set-up-gst-details-in-company/)
- **Prerequisite: Enable API Request on portal** — My Profile > Manage API Access > Enable API Request = Yes; Duration 30 days or 6 hrs (new OTP after expiry). [src](https://help.tallysolutions.com/set-up-gst-profile-for-connected-gst/)

### e-Invoice / e-Way Bill details (company)
- **e-Invoicing applicable** — Yes/No; **Applicable from** date; **Invoice bill from place**. [src](https://help.tallysolutions.com/set-up-gst-details-in-company/)
- **e-Way Bill applicable** — Yes/No; **Applicable from** date; **Applicable for intrastate** Yes/No. [src](https://help.tallysolutions.com/set-up-gst-details-in-company/)
- **Send e-Way Bill details with e-Invoice in sales transactions** — F11 > Set/Alter Company GST Rate and Other Details > F12 toggle; then set Yes. [src](https://help.tallysolutions.com/set-up-gst-details-in-company/)

### LUT/Bond
- **Provide LUT/Bond details** — GST Details > F12 toggle, then sub-form: Applicable from, Applicable to, LUT/Bond No. (from portal). [src](https://help.tallysolutions.com/set-up-gst-details-in-company/)

### Advance adjustment config
- **Show GST Advances for adjustments in transaction** — under Set/Alter Company GST Rate and Other Details; with Applicable from date (recommend after last reported return period). [src](https://help.tallysolutions.com/set-up-gst-details-in-company/)

### Reconciliation configuration (company GST Details > F12 > Reconciliation Details)
- **Use Voucher No. & Date as Supplier Invoice No. & Date** — for purchases without supplier doc details. [src](https://help.tallysolutions.com/set-up-gst-details-in-company/)
- **Ignore zero (0) in Supplier Document No.** — match despite leading zeros. [src](https://help.tallysolutions.com/set-up-gst-details-in-company/)
- **Ignore special characters in Document No.** — hyphens/slashes ignored in matching. [src](https://help.tallysolutions.com/set-up-gst-details-in-company/)
- **Ignore difference in Taxable Amount** — reconcile on tax amount only; effective-dated. [src](https://help.tallysolutions.com/set-up-gst-details-in-company/)
- **Ignore difference in Books and Portal values (round-off tolerance)** — Allow difference in value up to (amount); Applicable for: Taxable & Tax Amounts / Invoice Amount / Taxable, Tax & Invoice Amount; Ignore when value in Books is: Greater or Less than Portal / Greater than Portal / Lesser than Portal; Effective Date. [src](https://help.tallysolutions.com/set-up-gst-details-in-company/)
- **Ignore difference in Invoice Amount** — for purchases where TDS/TCS altered invoice total. [src](https://help.tallysolutions.com/set-up-gst-details-in-company/)
- **Mark Reconciled vouchers as Accepted in IMS** — auto-accept matched invoices in IMS; Rel 6.1+. [src](https://help.tallysolutions.com/set-up-gst-details-in-company/)

### Migration-time GST configuration
- **Migrate screen > C (Configure)** — set voucher numbering, HSN/SAC, difference-in-tax-values (e.g. Ignore difference in tax values up to 1) before R (Migrate); replaces Rel 3.0–5.0 "Basis of Values in GST returns". [src](https://help.tallysolutions.com/best-practices-enhancements-in-gst-for-migration/)
- **Update GST Status of Vouchers after Master Alteration** — default No (recompute when GST reports opened); Yes recomputes on master save. [src](https://help.tallysolutions.com/best-practices-enhancements-in-gst-for-migration/)
- **Deferred recomputation on renumbering** — voucher renumbering (Renumber/Retain Original) updates GST status only when GST reports opened. [src](https://help.tallysolutions.com/best-practices-enhancements-in-gst-for-migration/)
- **Non-GST transactions** — auto-placed in "Not Relevant for This Return" instead of Uncertain. [src](https://help.tallysolutions.com/best-practices-enhancements-in-gst-for-migration/)
- **Missing supplier invoice no./date** — no longer uncertain in GSTR-3B; appear as "Available Only in Books" in 2A/2B; copy portal values into books. [src](https://help.tallysolutions.com/best-practices-enhancements-in-gst-for-migration/)

### HSN/SAC summary configuration
- **Show/Create HSN/SAC Summary for** — None / All Sections / All Sections Except B2C (B2CS, B2CL, CDNUR, Nil, Exempt, Non-GST still included); effective date. [src](https://help.tallysolutions.com/best-practices-enhancements-in-gst-for-migration/)
- **Minimum length of HSN/SAC** — 4 (turnover ≤ ₹5 Cr) / 6 (> ₹5 Cr) / 8. [src](https://help.tallysolutions.com/set-up-gst-rate-hsn-sac-details/)
- **Separate B2B & B2C HSN Summary applicable from** — Ctrl+I (More Details); e.g. 01-May-25. [src](https://help.tallysolutions.com/set-up-gst-rate-hsn-sac-details/)

### Composition company
- **Registration Type = Composition** — sales recorded without GST tax ledgers; liability computed at composition rate on turnover in GSTR-4/CMP-08; invoice title auto "Bill of Supply". [src](https://help.tallysolutions.com/setup-tallyprime-for-gst-composition/)
- **Purchase GST as cost** — tax ledgers configured to allocate GST paid into item cost/expense (no ITC). [src](https://help.tallysolutions.com/setup-tallyprime-for-gst-composition/)
- **Regular→Composition switch** — old data untouched; purchases take rates from stock items/purchase ledgers; sales returns & liability take rate from Company GST Details. [src](https://help.tallysolutions.com/setup-tallyprime-for-gst-composition/)
- **Composition validations** — interstate outward supply by composition dealer not allowed (error page). [src](https://help.tallysolutions.com/interstate-supply-by-composition-dealers-is-not-allowed/)

## GST Rates, HSN/SAC & Hierarchy

### Where rates/HSN can be set
- **Levels** — Company, Ledger (sales/purchase/service/expense), Ledger Group, Stock Item, Stock Group, GST Classification, or in voucher. [src](https://help.tallysolutions.com/set-up-gst-rate-hsn-sac-details/)
- **Enable at company** — F11 > Set/Alter Company GST Rate and Other Details = Yes; masters: GST applicability = Applicable / Not Applicable. [src](https://help.tallysolutions.com/set-up-gst-rate-hsn-sac-details/)
- **HSN/SAC Details source options** — As per Company/Group; Specify Details Here; Use GST Classification; Specify in Voucher. [src](https://help.tallysolutions.com/set-up-gst-rate-hsn-sac-details/)
- **HSN/SAC + Description** — pick from built-in List of HSN/SAC with auto description (Rel 7.1+; not in 7.0 or earlier — manual entry); descriptions show 4 lines, scroll for more; user-created HSN only in its master. [src](https://help.tallysolutions.com/validate-hsn-sac-stock-items/)
- **GST Rate Details source options** — As per Company/Group; Specify Details Here; Slab-Based Tax Rate (Slab-Based Rates); Use GST Classification; Specify in Voucher. [src](https://help.tallysolutions.com/set-up-gst-rate-hsn-sac-details/)
- **Taxability Type** — Taxable (also Exempt/Nil Rated/Non-GST elsewhere); single GST rate auto-splits IGST and CGST/SGST halves (18% → 9%+9%). [src](https://help.tallysolutions.com/set-up-gst-rate-hsn-sac-details/)
- **Provide breakup of Tax Rate** — F12 toggle to show IGST/CGST/SGST/Cess separately. [src](https://help.tallysolutions.com/set-up-gst-rate-hsn-sac-details/)

### Source hierarchy
- **Source of GST Rate Details in Transactions / Source of HSN/SAC Details in Transactions** — F12 in Company GST Rate & Other Details; Rel 3.0+. [src](https://help.tallysolutions.com/set-up-gst-rate-hsn-sac-details/)
- **Option 1 Ledger first (default)** — Ledger → Accounting Group → Stock Item → Stock Group → Company. [src](https://help.tallysolutions.com/india-gst-manage-hsn-code-sac-and-tax-rates-tally/)
- **Option 2 Stock Item first** — Stock Item → Stock Group → Ledger → Accounting Group → Company (use when rate changes on items while ledgers hold old rate). [src](https://help.tallysolutions.com/india-gst-manage-hsn-code-sac-and-tax-rates-tally/)
- **GST – Tax Analysis shows rate source** — Ctrl+O (Related Reports) > GST – Tax Analysis (Alt+A in voucher); Alt+F5 Detailed per-item breakup. [src](https://help.tallysolutions.com/india-gst-calculation-of-gst-based-on-slab-rate-cess-on-quantity-and-value-tally/)

### Effective-date tax rate history
- **GST Rate & Related Details (History)** — per-master list of rates by Applicable-from date; Alt+W from Update GST Rate screen (Rel 2.1-: Alt+W Details); Ctrl+I in stock item. [src](https://help.tallysolutions.com/gst-master-setup/india-gst-rate-setup-tally/)
- **Effective Date on rate change** — every rate update asks for effective date; transactions dated on/after use new rate. [src](https://help.tallysolutions.com/india-gst-manage-hsn-code-sac-and-tax-rates-tally/)

### GST Rate Setup report (bulk rate management)
- **Open** — Alt+G > GST Rate Setup > Ledgers / Stock Items / Ledger Groups / Stock Groups. [src](https://help.tallysolutions.com/gst-master-setup/india-gst-rate-setup-tally/)
- **Default Rate-wise view; "GST Rate Details Not Specified" section** for masters missing rates. [src](https://help.tallysolutions.com/gst-master-setup/india-gst-rate-setup-tally/)
- **Views** — F5 HSN/SAC-wise; Ctrl+H Change View > Ledger-wise; F6 filter by HSN/SAC; F4 by Group. [src](https://help.tallysolutions.com/gst-master-setup/india-gst-rate-setup-tally/)
- **F12 columns** — Show Source of GST Details; Show Source of HSN/SAC Details; Show Eligible for ITC; Show applicable for reverse charge; Show GST calculation on MRP (Incl. Tax). [src](https://help.tallysolutions.com/gst-master-setup/india-gst-rate-setup-tally/)
- **Alt+S Update GST Details (multi-select with Spacebar)** — Provide HSN/SAC Details (No keeps HSN intact), Specify Details Here or GST Classification, Effective Date (Rel 2.1-: Alt+W Set Rate). [src](https://help.tallysolutions.com/gst-master-setup/india-gst-rate-setup-tally/)
- **Alt+R Remove GST Details** — clear rates from selected masters (Rel 2.1-: Clear Rate). [src](https://help.tallysolutions.com/gst-master-setup/india-gst-rate-setup-tally/)
- **F9 Change Parent Group** — move items to a stock group carrying another rate; create group on the fly. [src](https://help.tallysolutions.com/gst-master-setup/india-gst-rate-setup-tally/)
- **Alt+B Get HSN/SAC Info** — validate selected items' HSN against portal from report. [src](https://help.tallysolutions.com/validate-hsn-sac-stock-items/)
- **Auto GST-status refresh** — rate changes in masters update GST Status of related vouchers. [src](https://help.tallysolutions.com/gst-master-setup/india-gst-rate-setup-tally/)
- **GST Council Sep'25 rate rationalisation** — report supports bulk update to 5% / 18% / 40% slabs. [src](https://help.tallysolutions.com/gst-master-setup/india-gst-rate-setup-tally/)

### GST Classification master
- **Create/Alter** — Alt+G > Create/Alter Master > GST Classification; sections HSN/SAC & Related Details + GST Rate & Related Details (Specify Details Here); reusable template applied to many masters; change rate once with new applicability date. [src](https://help.tallysolutions.com/india-gst-create-use-and-update-gst-classifications-tally/)
- **Works for accounts-only companies** — tag to Sales, Purchase, Services, Income & Expense ledgers. [src](https://help.tallysolutions.com/india-gst-create-use-and-update-gst-classifications-tally/)
- **Nature of Transaction (older releases)** — normally derived from party Registration Type/State/Country; set explicitly for branch transfer, consignment transfer, works contract. [src](https://help.tallysolutions.com/india-gst-create-use-and-update-gst-classifications-tally/)
- **Classification with Cess** — Cess Valuation Type, Cess Rate, Cess Rate per Unit; F12 Select Valuation Type, Show all GST Tax Types. [src](https://help.tallysolutions.com/india-gst-create-use-and-update-gst-classifications-tally/)

### Cess
- **Cess Valuation Type** — Not Applicable / Based on Value / Based on Quantity / Based on Value and Quantity (Cess Rate % + Cess Rate per Unit). [src](https://help.tallysolutions.com/india-gst-create-use-and-update-gst-classifications-tally/)
- **Override cess valuation in invoice** — F12 Modify GST & HSN/SAC related details > GST Rate and Related Details > change Cess Valuation Type. [src](https://help.tallysolutions.com/how-to-override-assessable-value-hsn-code-party-details-cess-valuation-method-in-sales-invoice/)

### Slab-based rates
- **Slab-Based Tax Rate Details** — rows of Slab-wise Item Rate (greater than X up to Y) + Taxability Type + GST Rate (e.g. ≤1000 → 5%, 1000–2000 → 12%). [src](https://help.tallysolutions.com/set-up-stock-items-for-gst/)
- **Consider MRP while calculating slab-based tax rate** — Yes uses MRP, No uses item rate. [src](https://help.tallysolutions.com/set-up-stock-items-for-gst/)
- **Include GST expenses/incomes to calculate the slab-based tax rate** — F12; adds apportioned additional ledger value before slab lookup (older: Consider additional expense/income ledger for slab rate calculation; Calculation Type On Item Rate). [src](https://help.tallysolutions.com/india-gst-calculation-of-gst-based-on-slab-rate-cess-on-quantity-and-value-tally/)
- **Same item at different prices** — select item twice per rate; each line takes its slab. [src](https://help.tallysolutions.com/india-gst-calculation-of-gst-based-on-slab-rate-cess-on-quantity-and-value-tally/)

### MRP & tobacco (RSP-based GST)
- **Provide MRP details / Set/Alter MRP details** — MRP Rate, applicability date, Allow MRP modification in voucher. [src](https://help.tallysolutions.com/set-up-stock-items-for-gst/)
- **Calculate GST on MRP (Incl. Tax)** — F12 Enable GST calculation on MRP (Incl. Tax); at stock item or stock group; in history; bulk via GST Rate Setup or Multi-Masters (Alt+H Multi Create/Alter); Rel 7.1+. [src](https://help.tallysolutions.com/set-up-stock-items-for-gst/)
- **Tobacco rule (CGST Notif. 20/2025, from 1-Feb-2026)** — compensation cess removed; 40% cigarettes/tobacco, 18% bidis; GST on RSP-derived taxable value; set Cess Valuation Type Not Applicable, effective 1-Feb-26. [src](https://help.tallysolutions.com/gst-on-tobacco/)
- **Display** — Taxable Value column shows selling price, tax computed on tax-inclusive MRP; Taxable Value = MRP − GST when rate inclusive of tax enabled. [src](https://help.tallysolutions.com/gst-on-tobacco/)
- **Portal tolerance** — e-Invoice/e-Way Bill reject when taxable+tax > invoice value except HSN 2106 90 20, 2401, 2402, 2403, 2404 11 00, 2404 19 00. [src](https://help.tallysolutions.com/gst-on-tobacco/)
- **Migration rule** — GST-on-MRP auto-enabled only for items using Specify Details Here; others manual. [src](https://help.tallysolutions.com/set-up-stock-items-for-gst/)
- **Earlier releases** — Tally Plug-In enabled per license (serial no. + OTP to admin email; F1 > Settings > License > Update). [src](https://help.tallysolutions.com/gst-on-tobacco/)
- **Purchases of tobacco** — same MRP-based calc; appear in 3B, 2A/2B recon, IMS, ITC Summary. [src](https://help.tallysolutions.com/gst-purchase-for-tobacco/)

## GST Masters

### Stock items
- **GST applicability** — Applicable / Not Applicable + HSN & GST rate details. [src](https://help.tallysolutions.com/set-up-stock-items-for-gst/)
- **Applicable for Reverse Charge** — F12 Enable Reverse Charge calculation (Rel 2.1-: Is reverse charge applicable). [src](https://help.tallysolutions.com/set-up-stock-items-for-gst/)
- **Eligible for ITC** — F12 Eligible for Input Tax Credit. [src](https://help.tallysolutions.com/set-up-stock-items-for-gst/)
- **Mixed supply (combo kit)** — F12 Provide Descriptions + Set Components List (BOM); set HSN/rate of highest-rated component. [src](https://help.tallysolutions.com/set-up-stock-items-for-gst/)

### Sales / purchase / service / expense ledgers
- **Sales/Purchase ledger** — GST applicability, HSN/SAC & rate; purchase ledger Applicable for Reverse Charge. [src](https://help.tallysolutions.com/set-up-sales-purchase-ledgers-for-gst/)
- **Service ledger (regular)** — Include in Assessable Value calculation = Not Applicable; SAC & rate; RCM flag; Type of Supply = Services. [src](https://help.tallysolutions.com/set-up-service-ledgers-for-gst/)
- **Service ledger (composite supply)** — Include in assessable value calculation for = GST; Appropriate to = Goods; Method of calculation Based on Quantity / Based on Value; GST applicability Not Applicable (taxed with principal). [src](https://help.tallysolutions.com/set-up-service-ledgers-for-gst/)
- **Expense ledger with GST** — Type of Ledger Not Applicable, Include in Assessable Value Not Applicable, GST applicable, Type of Supply Services (default) / Goods. [src](https://help.tallysolutions.com/india-gst-expense-income-non-revenue-invoice-round-off-ledgers-tally/)
- **Expense/income in assessable value** — Include in assessable value calculation for = GST; Appropriate to Goods / Services / Goods & Services (Both); Method Based on Quantity / Value; GST applicability forced Not Applicable. [src](https://help.tallysolutions.com/india-gst-expense-income-non-revenue-invoice-round-off-ledgers-tally/)
- **Expense ledger for ITC reversal** — under Indirect Expenses, GST applicability Not Applicable. [src](https://help.tallysolutions.com/set-up-expense-ledgers-for-gst/)
- **Invoice Rounding ledger** — Type of Ledger = Invoice Rounding; Rounding method + Rounding limit; GST N/A. [src](https://help.tallysolutions.com/india-gst-expense-income-non-revenue-invoice-round-off-ledgers-tally/)
- **GST on non-revenue accounts** — F12 For Non-Revenue Accounts also = Yes (e.g. fixed asset sale). [src](https://help.tallysolutions.com/india-gst-expense-income-non-revenue-invoice-round-off-ledgers-tally/)
- **Statutory behaviour by config** — tax ledger under current assets/liabilities behaves as Duties & Taxes; party ledger under loans; appropriate ledger to item cost from ledger; default accounting entries per voucher type. [src](https://help.tallysolutions.com/configuring_statutory_details_in_masters/)

### Tax (duty) ledgers
- **Type of Duty/Tax = GST; Tax Type** — Central / State (SGST/UTGST) / Integrated / Cess; Rounding Method + Rounding Limit. [src](https://help.tallysolutions.com/set-up-tax-ledgers-for-gst/)
- **Common vs separate duty ledgers** — common ledger takes rates from hierarchy; separate ledgers per rate apply their own rates. [src](https://help.tallysolutions.com/setting-up-gst-in-tallyprime/)

### Party ledgers
- **Tax Registration Details** — PAN; Registration Type (Regular, Composition, Unregistered/Consumer, etc.); GSTIN/UIN; Place of Supply (outward); Is the Party a Transporter; Assessee of Other Territory. [src](https://help.tallysolutions.com/india-gst-creating-party-ledgers-for-gst-tally/)
- **Effective-dated party GST details** — history of registration changes viewable. [src](https://help.tallysolutions.com/setting-up-gst-in-tallyprime/)
- **Common party ledger** — enter GST details per transaction (override). [src](https://help.tallysolutions.com/setting-up-gst-in-tallyprime/)
- **Alt+L Fetch Details Using GSTIN/UIN** — pulls address, PAN, reg type, status from portal into Compare Party Details (As per Books vs As per Portal); Rel 2.1-: Get GSTIN/UIN Info. [src](https://help.tallysolutions.com/india-gst-creating-party-ledgers-for-gst-tally/)
- **Alt+S Filing History** — Regular: GSTR-1/3B filing; Composition: CMP-08; also e-Invoice applicability, jurisdiction, nature of business, last 6 months. [src](https://help.tallysolutions.com/validate-party-gstin-uin/)
- **Create Party Using GSTIN/UIN (bulk)** — Alt+G or Chart of Accounts Alt+H; enter list or Alt+L Import GSTIN/UIN from Excel (File Path, File, Worksheet, Column; Rel ≤6.2 Alt+F); shows Address, GSTIN/UIN Status, Reg Type; Ctrl+D delete row; Compare GSTIN/UIN Info for existing; Ctrl+A saves all. [src](https://help.tallysolutions.com/india-gst-creating-party-ledgers-for-gst-tally/)
- **Update Party GSTIN/UIN report** — group/ledger selection, enter GSTINs inline, F12 Show other territory, F8 All Ledgers, Alt+E export to Excel; Import Party GSTIN add-on (TDL) with Errors sheet re-import. [src](https://help.tallysolutions.com/india-gst-update-party-gstin-uin-tally/)
- **Validate Party GSTIN/UIN report** — from Alt+G or GSTR-1 > F6 (period-relevant parties); Alt+L > A (All) / C (Current); confirmation for blank/<15-char GSTINs; Exchange Summary (Information Not Found, Requests failed (Try again)); GSTIN/UIN Status column; F9 Update Details from portal. [src](https://help.tallysolutions.com/validate-party-gstin-uin/)
- **Validate in voucher** — Party Details > Alt+L; sales: compare buyer & consignee, Alt+W Copy Details (buyer/consignee/both). [src](https://help.tallysolutions.com/validate-party-gstin-uin/)
- **Credentials for validation** — uses e-Invoice or e-Way Bill login (e-Invoice if both). [src](https://help.tallysolutions.com/validate-party-gstin-uin/)

### HSN validation
- **Alt+B Get HSN/SAC Info** — from stock item/group/company or GST Rate Setup; Get HSN/SAC Info Summary; rejection "Invalid HSN Code"; Alt+F5 full description. [src](https://help.tallysolutions.com/validate-hsn-sac-stock-items/)
- **HSN digits mandate** — turnover > ₹5 Cr needs 4/6/8 digit HSN (Notif. 78/2020). [src](https://help.tallysolutions.com/validate-hsn-sac-stock-items/)

### Voucher numbering for GST
- **Method of Voucher Numbering** — Automatic, Manual, Automatic (Manual Override), Multi-user Auto. [src](https://help.tallysolutions.com/set-up-vch-numbering-and-numbering-series-for-gst/)
- **Numbering behaviour on insertion/deletion** — Retain Original Voucher No. / Renumber Vouchers. [src](https://help.tallysolutions.com/set-up-vch-numbering-and-numbering-series-for-gst/)
- **Show unused vch nos. in transactions** — reuse gaps for Retain Original; Rel 3.0+. [src](https://help.tallysolutions.com/set-up-vch-numbering-and-numbering-series-for-gst/)
- **Define multiple numbering series for vouchers** — per registration/series, Series Name + method; create from voucher type or Chart of Accounts Alt+S (Create Vch No. Series); Rel 3.0+. [src](https://help.tallysolutions.com/set-up-vch-numbering-and-numbering-series-for-gst/)
- **Duplicate voucher/document no. handling** — appear under Uncertain Transactions > Duplicate Voucher No./Document No. in GSTR-1, 3B, 2A, 1-Recon, 2B-Recon, Annual Computation, e-Invoice, e-Way Bill; split Outward/Inward; update voucher no./numbering method, prefix/suffix; inward Ctrl+V Update Doc No. & Doc Date; Rel 7.0+. [src](https://help.tallysolutions.com/manage-duplicate-nos-for-gst-vouchers/)

### Override in transactions
- **Modify GST & HSN/SAC related details** — voucher F12 (Rel 2.1-: Modify Tax Rate details of GST); per-line GST Rate and Related Details screen. [src](https://help.tallysolutions.com/how-to-override-assessable-value-hsn-code-party-details-cess-valuation-method-in-sales-invoice/)
- **Override Taxable Value** — enter custom assessable value; save prompts O (override) vs Y (record exception); exceptions accepted later with Alt+J Accept as is. [src](https://help.tallysolutions.com/how-to-override-assessable-value-hsn-code-party-details-cess-valuation-method-in-sales-invoice/)
- **Override HSN via GST Classification** — choose Use GST Classification in HSN/SAC field; revert with As per Masters/Company. [src](https://help.tallysolutions.com/how-to-override-assessable-value-hsn-code-party-details-cess-valuation-method-in-sales-invoice/)
- **Override tax rate** — Tax Classification Details > F12 Override tax rate (slab change due to discount). [src](https://help.tallysolutions.com/india-gst-calculation-of-gst-based-on-slab-rate-cess-on-quantity-and-value-tally/)
- **Update party details after save** — alter voucher, Dispatch Details & Party Details sub-screens. [src](https://help.tallysolutions.com/how-to-override-assessable-value-hsn-code-party-details-cess-valuation-method-in-sales-invoice/)

## Connected GST (portal session)
- **GST Login & Logout** — Alt+Z (Exchange) > All GST Options > GST Login & Logout; GST Username + OTP to registered mobile; session up to 30 days; lists registration name, GSTIN/UIN, validity; Log out of all GST sessions. [src](https://help.tallysolutions.com/set-up-gst-profile-for-connected-gst/)
- **Reset GST Login** — F1 > Troubleshooting > Reset (Login) > Reset GST Login; R reset all credentials+sessions, L logout only. [src](https://help.tallysolutions.com/set-up-gst-profile-for-connected-gst/)
- **Portal duration change** — affects only new sessions. [src](https://help.tallysolutions.com/set-up-gst-profile-for-connected-gst/)
- **Refresh GST Status** — Alt+Z > All GST Options > Refresh GST Status or Bell Icon notification; shows in-progress uploads/downloads/IMS reset/2B recompute; R to refresh (~5 min later). [src](https://help.tallysolutions.com/refresh-gst-status-of-vouchers/)
- **Reset GSTN Data** — remove imported return data (reconciled, corrupted, wrong JSON); only when no online activity running. [src](https://help.tallysolutions.com/reset-gstn-data/)

## GST Sales (Outward Supplies)

### Core sales voucher
- **Sales voucher modes** — Alt+G > Create Voucher > F8 Sales; Ctrl+H Item Invoice (stock items, qty, rate) / Accounting Invoice (service ledgers, amount); multiple items/services per invoice with different rates. [src](https://help.tallysolutions.com/gst-sales-tally/)
- **F3 Company/Tax Registration** — choose registration per voucher in multi-GSTIN companies; Rel 3.0+ (not in 2.1). [src](https://help.tallysolutions.com/gst-sales-tally/)
- **Party A/c** — party ledger or Cash/Bank; create on the fly Alt+C. [src](https://help.tallysolutions.com/sez-sales/)
- **Place of Supply (Party Details)** — prefilled from party state; determines intrastate (CGST+SGST/UTGST) vs interstate (IGST). [src](https://help.tallysolutions.com/gst-sales-tally/)
- **Provide separate Buyer and Consignee details** — Party Details F12; Consignee (Ship To) address; place of supply drives nature. [src](https://help.tallysolutions.com/gst-sales-tally/)
- **Dispatch Details / Order Details** — transporter, tracking no.; order details via F12. [src](https://help.tallysolutions.com/gst-sales-tally/)
- **GST ledgers** — CGST & SGST/UTGST local, IGST interstate, plus Cess ledger. [src](https://help.tallysolutions.com/gst-sales-tally/)
- **Tax Analysis in voucher** — Alt+A (Rel 2.1-: Ctrl+I), Alt+F5 detailed; HSN shown per line. [src](https://help.tallysolutions.com/gst-sales-tally/)
- **GST Portal view of Invoice** — Ctrl+O Related Reports during or after entry; preview how invoice appears on portal; Rel 3.0+. [src](https://help.tallysolutions.com/gst-sales-tally/)
- **Unregistered/consumer B2C** — party Registration Type Unregistered; >₹1 lakh interstate = B2C (Large), ≤ = B2C (Small). [src](https://help.tallysolutions.com/gst-sales-tally/)

### Supply-type variants
- **Nil Rated / Exempt sales** — party Regular; sales ledger Nature of Transaction System Inferred; item Taxability Exempt / Nil Rated; no tax ledger; GSTR-1 Table 8A–8D. [src](https://help.tallysolutions.com/nil-rated-exempt-sales-gst/)
- **Export – Taxable** — sales ledger Nature Exports – Taxable; item Taxable with IGST; Provide GST details for export info; GSTR-1 Exports Invoices – 6A. [src](https://help.tallysolutions.com/export-goods-gst/)
- **Export – Exempt** — Nature Exports – Exempt, item Exempt, no tax ledger. [src](https://help.tallysolutions.com/export-goods-gst/)
- **Hide IGST on print + refund flow** — export to SEZ: charge IGST, hide on print, journal (Dr IGST/Cr party) for refund claim, receipt on refund. [src](https://help.tallysolutions.com/export-goods-gst/)
- **Supplies to SEZ – Taxable** — party Reg Type Regular – SEZ; Nature System Inferred; IGST regardless of location; Provide GST/e-Way Bill details (shipping); GSTR-1 B2B 4A/4B/4C/6B/6C. [src](https://help.tallysolutions.com/supplies-to-sez-gst/)
- **Supplies to SEZ – Exempt/Nil** — no tax ledger. [src](https://help.tallysolutions.com/supplies-to-sez-gst/)
- **Supplies to SEZ – LUT/Bond** — Nature Sales to SEZ – LUT/Bond; company LUT details required; no tax. [src](https://help.tallysolutions.com/supplies-to-sez-gst/)
- **Deemed export** — party/sales ledger configured for deemed export; CGST+SGST or IGST; Provide GST/e-Way Bill details > Shipping Bill No. & Date; exempt/nil deemed exports no tax. [src](https://help.tallysolutions.com/deemed-export-gst/)
- **High Seas Sales** — Nature High Seas Sales; item Exempt; no tax; non-GST in GSTR-1. [src](https://help.tallysolutions.com/high-seas-sales-gst/)
- **Other Territory** — OT→OT: CGST+UTGST (company & party Assessee of Other Territory Yes; PoS Other Territory; tourist refund u/s 15 IGST); OT→State and State→OT: IGST. [src](https://help.tallysolutions.com/supplies-for-other-territory-gst/)
- **Sales as Regular–SEZ company** — goods to Regular party = DTA export, no tax ledger, buyer pays IGST under RCM, goes to Not Relevant for This Return; goods/services to SEZ and services to regular = IGST (interstate regardless of PoS), B2B section. [src](https://help.tallysolutions.com/sez-sales/)
- **Outward RCM sales** — sales ledger/stock item Applicable for Reverse Charge = Yes; no GST charged to registered buyer; supplier pays when buyer is consumer/unregistered; B2B GSTR-1, 3B outward taxable, Annual Computation. [src](https://help.tallysolutions.com/india-gst-outward-supply-rcm-tally/)
- **Composite supply** — principal goods + service ledger configured in assessable value; tax at principal rate; GSTR-1 outward. [src](https://help.tallysolutions.com/composite-supply-gst/)
- **Mixed supply** — BOM-based combo item taxed at highest component rate. [src](https://help.tallysolutions.com/set-up-stock-items-for-gst/)
- **Taxable expense/indirect income via Journal** — F12 Modify GST & HSN/SAC related details; Nature Local Sales – Taxable; appears in 3B Tax on Outward and Reverse Charge Inward Supplies. [src](https://help.tallysolutions.com/gst-sales-with-expense-ledger/)
- **Indirect income / fixed asset sale journals** — F12 Modify GST details + Provide Reference No. and Date (Supplier Invoice No./Date). [src](https://help.tallysolutions.com/indirect-incomes-under-gst/)
- **Other scenarios listed (pages not crawled)** — Fixed Assets Sale, Supplies to Embassy/UN Body, Sales through E-Commerce Operator, Post-Sales Price Hike, Courier Service to Outside India, Solar & Renewable Energy Projects, Works Contract Services, Excise Sales with GST for Tobacco. [src](https://help.tallysolutions.com/tally-prime/taxation-compliance/india-gst/gst-regular-sales/)

### Discounts, MRP-inclusive, slab sales
- **Item-level discount (Discount field)** — voucher F12 Provide Cash/Trade Discount; per-item % or amount; discount ledger (Type of Ledger = Discount, Indirect Expenses); total editable & re-apportioned (e.g. cap ₹50,000); tax on net. [src](https://help.tallysolutions.com/sales-with-cess-tally/)
- **Discount column** — F11 Enable Inventory > Use discount column in invoices; **Discount format** Percentage / Amount / Both (Rel 7.1+; 7.0- only Disc%). [src](https://help.tallysolutions.com/india-gst-sales-discount-item-level-tally/)
- **Invoice-level discount** — discount ledger with negative amount before tax ledgers; tax on discounted value. [src](https://help.tallysolutions.com/india-gst-sales-discount-item-level-tally/)
- **Service discount ledger** — Include in assessable value = GST, Appropriate to Services (method auto Based on Value). [src](https://help.tallysolutions.com/sales-with-cess-tally/)
- **MRP inclusive of tax via Voucher Class** — Default Accounting Allocations (sales + tax ledgers with %), Adjust Allocation Difference to First Ledger; no tax ledgers needed at entry; or stock item Set/modify default ledgers for invoicing. [src](https://help.tallysolutions.com/sales-with-cess-tally/)
- **Provide Rate Inclusive of Tax for Stock Items** — voucher F12; Rate (Incl. of Tax) column back-calculates taxable value. [src](https://help.tallysolutions.com/sales-with-cess-tally/)
- **Modify MRP in vouchers** — voucher F12; enter MRP/Marginal price per line. [src](https://help.tallysolutions.com/sales-with-cess-tally/)

### Advances received
- **Advance Receipt** — Receipt voucher F6 > Alt+J (Stat Adjustment) > Nature of Receipt = Advance Receipt; Advance Receipt Details: sales ledger, Advance Amount, auto Taxable Value; GSTR-1 Table 11 (Advances Received); Rel 3.0+ flow. [src](https://help.tallysolutions.com/india-gst-advance-receipts-tally/)
- **Advance without GST impact** — leave tax ledgers out; tax shown indicative only, excluded from 3B; same-period invoice carries GST. [src](https://help.tallysolutions.com/india-gst-advance-receipts-tally/)
- **Refund of Advance Receipt** — Payment voucher Alt+J > Refund of Advance Receipt; Refund Details (ledger, Refund Amount); liability auto-reversed. [src](https://help.tallysolutions.com/reverse-advance-received-gst/)
- **Add Returns Amount to GST Advance for adjustments** — credit note F12; pick advance(s) from Pending for Adjustment list (incl. Zero Valued reference) to re-open for future invoices; partial refund + partial adjustment allowed. [src](https://help.tallysolutions.com/reverse-advance-received-gst/)

### Credit notes / amendments
- **Credit note GST details** — Provide GST details: Yes; Reason of Issuing Note (e.g. 01-Sales Return); Buyer's Debit Note No. & Date. [src](https://help.tallysolutions.com/reverse-advance-received-gst/)
- **Original Invoice Value of B2CL/B2CS (CDNUR)** — Ctrl+I on interstate unregistered credit/debit note: Less Than or Equal to 2.5 Lakhs / More Than 2.5 Lakhs → decides 9B CDNUR vs B2CS. [src](https://help.tallysolutions.com/b2c-large-invoices-5a-5b/)
- **Amend invoice from signed return** — alter invoice, Ctrl+I > GST Return Effective Date (later period); original period shows "Amendments Marked for Future Returns", new period shows Amended B2B Invoices – 9A (Other Periods column); missing date → Uncertain; fix via Alt+L Set Effective Date; second amendment not allowed (goes Uncertain; revert). [src](https://help.tallysolutions.com/gst-amendments-for-sales/)

### Transfers / job work
- **Branch transfer – local same GSTIN** — branch ledger under Branch/Divisions with company GSTIN; Receipt Note / Delivery Note; no GST. [src](https://help.tallysolutions.com/india-gst-record-stock-transfers-as-gst-purchases-and-sales-tally/)
- **Branch transfer – different GSTIN** — branch ledger with branch GSTIN; sales invoice (IGST interstate, CGST+SGST local different GSTIN) → GSTR-1; inward via purchase → GSTR-3B. [src](https://help.tallysolutions.com/india-gst-record-stock-transfers-as-gst-purchases-and-sales-tally/)
- **Material Out with GST** — F10 Other Vouchers > Material Out; Destination Godown; tax ledgers; consignment to agent / return to principal. [src](https://help.tallysolutions.com/gst-invoice-for-material-out/)
- **Material In with GST** — Supplier Invoice No./Date, Source Godown, tax ledgers; job work receipts. [src](https://help.tallysolutions.com/record-material-in-under-gst/)

### Composition sales
- **Composition sales** — local only (same state); common sales ledger without GST; no tax ledgers; auto "Composition declaration" + zero tax breakup on print; CMP-08 Outward Supplies (including Exempt Supplies); credit notes without tax. [src](https://help.tallysolutions.com/sales-under-composition-gst-tally/)

### B2C Large threshold
- **Threshold Limit for B2CL Invoices** — F11 > GST Rate and Other Details > Ctrl+I > Show More; Applicable From + Threshold Limit (₹2.5 lakh → ₹1 lakh from 1-Aug-2024, Notif. 12). [src](https://help.tallysolutions.com/b2c-large-invoices-5a-5b/)
- **Set Effective Date for B2CL bucket** — GSTR-1/3B > B2C (Large) Invoices – 5A, 5B > Alt+L; separate GSTR-1 and GSTR-3B effective periods. [src](https://help.tallysolutions.com/b2c-large-invoices-5a-5b/)
- **Rel 4.1 workaround** — mark >₹1L interstate B2CS as Excluded (Alt+S Set GST Status) → "Manually Excluded Transactions" under Not Relevant; enter on portal manually. [src](https://help.tallysolutions.com/b2c-large-invoices-5a-5b/)

### Invoice print formats (GST fields)
- **Comprehensive Invoice GST fields** — company GSTIN, consignee state name+code+GSTIN, buyer state/code/GSTIN, Place of Supply, HSN/SAC column (item & ledger), IGST/CGST/SGST/Cess rate+amount columns, GST analysis summary (HSN, taxable value, rates incl. per-UOM, amounts), tax amount in words. [src](https://help.tallysolutions.com/gst-comprehensive-invoice/)
- **Simple Printed Invoice GST fields** — company GSTIN, buyer state & code, PoS, HSN/SAC, rate-wise analysis, tax in words, buyer GSTIN/UIN. [src](https://help.tallysolutions.com/gst-simple-printed-invoice/)
- **POS Invoice GST fields** — company GSTIN, buyer GSTIN, HSN column, GST analysis. [src](https://help.tallysolutions.com/gst-pos-invoice/)

## GST Purchases (Inward Supplies)

### Core purchase voucher
- **Purchase voucher** — F9; Ctrl+H Item Invoice / Accounting Invoice / As Voucher; F3 registration; Supplier Invoice No. & Date (must match supplier's upload for ITC); Receipt/Order/Import details (F12 Provide Receipt, Order, and Import details); Place of Supply; common purchase ledger (F12 Select common Ledger Account for Item Allocation). [src](https://help.tallysolutions.com/gst-purchases-tally/)
- **Local vs interstate** — supplier state = PoS → CGST+SGST (+Cess); else IGST; wrong PoS → wrong nature (local/interstate/SEZ/OT). [src](https://help.tallysolutions.com/gst-purchases-tally/)
- **GST Portal view of Invoice (purchase)** — Ctrl+O; F5 GSTR-2A view, F6 GSTR-2B view, F7 IMS view; Rel 3.0+. [src](https://help.tallysolutions.com/gst-purchases-tally/)
- **GST Status in voucher** — Ctrl+I > GST Status: System Inferred / Excluded / Mismatched / Reconciled; Rel 3.0+. [src](https://help.tallysolutions.com/gst-purchases-tally/)
- **IMS Action Status in voucher** — Ctrl+I > IMS Status: Accept (ITC into 2B) / Reject (ITC Rejected section, optionally exclude from own 3B) / Pending (set 2B & 3B effective date) / No Action (deemed accepted at 2B generation); Rel 6.1+. [src](https://help.tallysolutions.com/gst-purchases-tally/)
- **Default registration per voucher type** — set default company/registration in Voucher Type; F3 to switch. [src](https://help.tallysolutions.com/gst-purchases-tally/)
- **No voucher creation from GSTR-2B** — 2B used only for reconciliation. [src](https://help.tallysolutions.com/gst-purchases-tally/)
- **Purchase discounts / free items / import costing** — discount ledger (Indirect Incomes) as negative %; Calculate Tax on Current Subtotal; Actual & Billed quantity columns; Allow zero-valued transactions; import expenses appropriated by value to item cost. [src](https://help.tallysolutions.com/tally-prime/purchase-process/purchase-goods-and-services-tally/)
- **Optimise printing to save paper** — print config, only when India + GST/VAT/TDS/TCS enabled. [src](https://help.tallysolutions.com/tally-prime/purchase-process/purchase-goods-and-services-tally/)
- **Capital goods / fixed asset purchase** — Accounting Invoice with fixed-asset ledger. [src](https://help.tallysolutions.com/tally-prime/purchase-process/purchase-goods-and-services-tally/)

### Inward variants
- **Purchase from SEZ** — supplier Reg Type Regular – SEZ; Party Details Is Bill of Entry Available Yes/No; Taxable / Nil Rated / Exempt / LUT-Bond variants; Provide GST/e-Way Bill details > Additional Details: Purchase from SEZ – Taxable (BoE details); 3B Exempt/Nil/Non-GST inward. [src](https://help.tallysolutions.com/gst-purchases-from-sez/)
- **Other Territory purchases** — within OT: CGST+UTGST; State/UT↔OT: IGST; service override via F12 Allow override Classification/Nature (Purchase Taxable) + Is ineligible for input credit; warns "Mismatch in the Nature of Transaction and Place of Supply" (Y/O). [src](https://help.tallysolutions.com/gst-purchases-other-territory/)
- **Deemed export purchases** — supplier Reg Type Regular – Deemed Exporter; Taxable (3B Eligible ITC) / Nil Rated / Exempt (3B Exempt/Nil/Non-GST). [src](https://help.tallysolutions.com/deemed-export-purchases-gst/)
- **Import of goods** — foreign party; RCM items; Customs Duty + IGST ledgers; Provide GST/e-Way Bill details > Bill of Entry No., Date, Port Code; 3B ITC Available/Import of Goods; liability auto-raised Rel 3.0+. [src](https://help.tallysolutions.com/india-gst-record-the-import-of-goods-under-gst-tally/)
- **Import with customs duty in taxable value** — Override Taxable Value in GST Taxable Value Details. [src](https://help.tallysolutions.com/india-gst-record-the-import-of-goods-under-gst-tally/)
- **Customs duty + IGST payment voucher** — Customs Duty ledger with Inventory values are affected = Yes; inventory allocation amount only. [src](https://help.tallysolutions.com/india-gst-record-the-import-of-goods-under-gst-tally/)
- **Import of services (RCM)** — foreign party, RCM service ledger, PoS where availed; auto liability+ITC (Rel 3.0+); 3B 3.1(d) Import of Services; Rel 2.1-: journal Increase in Tax Liability & ITC / Import of Services. [src](https://help.tallysolutions.com/india-gst-import-of-services-under-rcm-tally/)
- **Courier services from outside India** — Classification/Nature Interstate Purchase Taxable; IGST; Statutory Details > Supplies under section 7 of IGST Act. [src](https://help.tallysolutions.com/india-gst-import-of-services-under-rcm-tally/)
- **GST on inward remittance (bank charges)** — zero-valued Payment voucher (Allow zero-valued transactions), expense ledger GST applicable, Nature Purchase Taxable, Rate & Taxable Value only; 3B Eligible ITC. [src](https://help.tallysolutions.com/india-gst-inward-remittance-of-service-value-tally/)
- **Update assessable value** — F12 Modify GST & HSN/SAC details > Override Taxable Value (e.g. customs revaluation); Rel 3.0+. [src](https://help.tallysolutions.com/assessable-value-gst-purchases/)
- **Composition purchases** — tax ledgers configured to add GST to cost; no tax ledger for composition/unregistered suppliers (Not relevant in GSTR-4/CMP-08); RCM purchases skip tax ledgers; imports: override taxable value incl. customs + BoE No/Date/Port Code. [src](https://help.tallysolutions.com/purchases-under-composition-gst-tally/)
- **Tobacco purchases** — MRP-based GST. [src](https://help.tallysolutions.com/gst-purchase-for-tobacco/)

### Reverse charge (inward)
- **RCM services/goods purchase** — item/ledger Applicable for Reverse Charge; Tax Analysis shows RCM tax; 3B 3.1 Tax on Outward and Reverse Charge Inward Supplies. [src](https://help.tallysolutions.com/india-gst-inward-supply-rcm-tally/)
- **RCM from unregistered dealers** — local/interstate by party location; GSTR-1 Document Summary – 13 (Rel 3.0+). [src](https://help.tallysolutions.com/india-gst-inward-supply-rcm-tally/)
- **Per-voucher RCM marking** — GST Rate and Related Details F12 Set Reverse Charge applicability > Applicable for Reverse Charge. [src](https://help.tallysolutions.com/india-gst-inward-supply-rcm-tally/)
- **Print "Tax subject to reverse charge"** — Print > Configure > Show GST Analysis. [src](https://help.tallysolutions.com/india-gst-inward-supply-rcm-tally/)
- **Mixed RCM + non-RCM in one voucher** — not allowed; flagged exception "Vouchers having Reverse Charge and Other than Reverse Charge Supplies". [src](https://help.tallysolutions.com/reverse-charge-supplies/)
- **Reverse Charge Supplies report** — Alt+G; sections Liability from Reverse Charge Supplies / Input Tax Credit from Reverse Charge Supplies (Purchase from Registered Dealers, etc.); columns Total Liability/ITC, Balance to Be Booked; Alt+J book stat adjustment from report. [src](https://help.tallysolutions.com/reverse-charge-supplies-report/)
- **GSTR-3B Reverse Charge Inward Supplies drill** — Ctrl+H Liability/ITC Booked view; Input Credit to be Booked month view (Alt+F5) split RCM / import of services / import of goods; F8 Show Purchases/Journals; Ctrl+B Basis of Value. [src](https://help.tallysolutions.com/reverse-charge-supplies-gstr-3b/)
- **Raise liability & claim ITC (same period)** — Journal Alt+J: Nature Increase in Tax Liability & Input Tax Credit; Additional Nature Purchase Under Reverse Charge from Registered/Unregistered Dealer; Rate + Taxable Value calc; Provide GST Details (party); 3B "Liability from Inward RCM Supplies"; source purchases move to Not Relevant. [src](https://help.tallysolutions.com/raise-liability-claim-itc/)
- **Liability now, ITC next period** — journal Increase in Tax Liability, then next-period journal Increase in Input Tax Credit (F2 date). [src](https://help.tallysolutions.com/raise-liability-claim-itc/)
- **RCM payment stat adjustment** — Payment voucher Alt+J Decrease in Tax Liability / Purchase Under Reverse Charge. [src](https://help.tallysolutions.com/india-gst-inward-supply-rcm-tally/)

### Advances paid
- **Advance Payment Under Reverse Charge** — Payment F5 > Alt+J Nature of Payment; Advance Payment Details: purchase ledger, Advance Amount, auto Taxable Value; 3B Advance Payments (Included in Returns); no tax ledger = indicative only. [src](https://help.tallysolutions.com/india-gst-advance-payments-gst-reverse-charge-tally/)
- **Advance Payment Details options (Rel 2.1-)** — Allow to provide rate of stock items (slab); Allow to provide quantity for calculation of cess on quantity; Allow modification of tax details; Alt+L Show Ledgers; only RCM items listed for regular dealers. [src](https://help.tallysolutions.com/advances-paid-gst/)
- **Print GST Advance Payment / Print Refund Voucher** — print config: Show State Name & State Code, Show Place of Supply. [src](https://help.tallysolutions.com/advances-paid-gst/)
- **Auto-adjust GST Advance during voucher creation** — purchase F12; FIFO matching by GST rate & place of supply; manual via Details of Advance Amount to be Adjusted (Show More); opening balances for pre-effective-date advances; applies to all registrations; Outstanding Advance Paid report. [src](https://help.tallysolutions.com/adjust-advances-under-gst/)
- **Refund of Advance Payment** — Receipt Alt+J; Refund Details; Debit Note F12 Add Returns Amount to GST Advance for adjustments (Reason 01-Purchase Return). [src](https://help.tallysolutions.com/reverse-advances-under-gst/)
- **Liability journals (Rel 2.1-)** — Increase of Tax Liability / Advances Paid under Reverse Charge; Decrease / Purchase against Advance Payment; Decrease / Cancellation of Advance Payment under Reverse Charge. [src](https://help.tallysolutions.com/advances-paid-gst/)

### Purchase returns, amendments
- **Debit Note purchase return** — Alt+F5; Original Invoice No. & Date (Dispatch Details); Provide GST details; Reason 01-Sales Return; Supplier's Debit/Credit Note No. & Date; 3B Included in Return, "Purchase Returns" in 3B Voucher Register. [src](https://help.tallysolutions.com/record-a-debit-note-under-gst/)
- **RCM return liability reversal** — Journal Decrease in Tax Liability / Purchase Under Reverse Charge from (Un)Registered Dealer; appears 3B Other Adjustments; debit note becomes Transactions of Other GST Returns. [src](https://help.tallysolutions.com/record-a-debit-note-under-gst/)
- **Counter Party Return Signing Status** — Ctrl+I > Return signed by Counter Party Yes; then amend with GST Return Effective Date; import supplier's amended invoice from 2A/2B to reconcile. [src](https://help.tallysolutions.com/gst-amendments-for-purchases/)

### GST Adjustments (Stat Adjustment, Alt+J)
- **Type of duty/tax** — GST. [src](https://help.tallysolutions.com/tax-liability-ut-merger-tally/)
- **Nature of Adjustment values seen** — Increase in Tax Liability; Increase in Tax Liability & Input Tax Credit; Increase in Input Tax Credit; Decrease in Tax Liability; Reversal of Input Tax Credit. [src](https://help.tallysolutions.com/tax-liability-ut-merger-tally/)
- **Additional Nature values seen** — Purchase Under Reverse Charge from Registered/Unregistered Dealer; Import of Goods; Import of Services; Others; Transfer of ITC; Advances Paid under Reverse Charge; Purchase against Advance Payment; Cancellation of Advance Payment under Reverse Charge. [src](https://help.tallysolutions.com/advances-paid-gst/)
- **Nature of Payment/Receipt** — Advance Receipt; Refund of Advance Receipt; Advance Payment Under Reverse Charge; Refund of Advance Payment. [src](https://help.tallysolutions.com/india-gst-advance-receipts-tally/)
- **ITC reversal & reclaim (UT merger)** — Reversal of Input Tax Credit / Others → 3B 4(B)(2); reclaim Increase in ITC / Transfer of ITC with Type of Input → 3B 4(A)(5). [src](https://help.tallysolutions.com/tax-liability-ut-merger-tally/)
- **Other adjustment topics (not crawled)** — Input Service Distributor (ISD) credit; SGST→UTGST transfer for Ladakh; transitional VAT/Excise/Service Tax credit to GST. [src](https://help.tallysolutions.com/tally-prime/taxation-compliance/india-gst/gst-adjustment-transactions/)
- **GST Stat Payment (Rel 2.1-)** — Payment Ctrl+F Autofill > Stat Payment: Tax Type GST, Payment Type (e.g. Recipient Liability), Period From/To; bank details later in Challan Reconciliation. [src](https://help.tallysolutions.com/advances-paid-gst/)

### TDS/TCS inside GST purchases
- **Is TDS Applicable on GST duty ledger** — Applicable (include GST in TDS base) / Not Applicable (exclude). [src](https://help.tallysolutions.com/india-gst-account-for-tds-on-purchases-under-gst-tally/)

### ITC-at-risk / liability reports
- **Bills Payable – GST (Predefined)** — columns Difference in Tax (ITC at Risk), Balance After Difference in Tax, Status (Reconciled, Mismatched, Available Only in Books, Excluded…); F7 GST Info; Shift+Enter voucher; Alt+R GST Portal View; F8 Show Portal Value; F9 Differential Mode; Alt+V Set GST Status Reconciled. [src](https://help.tallysolutions.com/view-itc-at-risk-using-bills-payable-gst/)
- **Bills Receivable – GST (Predefined)** — Difference in Tax (Liability), Balance After Difference; same drill keys. [src](https://help.tallysolutions.com/view-tax-liability-using-bills-receivable-gst/)
- **Ledger Outstandings – GST** — per party bills with Diff in Tax (ITC at Risk), GST Status; F12 Settle Bills as per Difference in Amount; Alt+B Settle Bills → auto payment voucher. [src](https://help.tallysolutions.com/ledger-outstandings-gst/)
- **Ledger Vouchers – GST** — per party voucher-level ITC at risk. [src](https://help.tallysolutions.com/ledger-vouchers-gst/)

## e-Invoice (IRN)

### Scope & setup
- **Supported vouchers** — Sales invoices, POS invoices, Debit & Credit notes, Receipts and Journals when used for sales; via Tally GSP (TIPL, ISO 27001:2013), no plug-in. [src](https://help.tallysolutions.com/how-to-generate-e-invoice-on-irp-using-tallyprime-tallyhelp/)
- **IRP registration + API user** — register on IRP (GSTIN, OTP), create API user "Through GSP" = Tally (India) Pvt Ltd; existing e-Way Bill API profile can be reused; IRP credentials used for login inside Tally. [src](https://help.tallysolutions.com/one-time-setup-for-e-invoicing/)
- **Per-registration enablement** — F11 > GST Details (or GST Registration screen in multi-GSTIN) > e-Invoicing applicable, Applicable from, Invoice bill from place. [src](https://help.tallysolutions.com/one-time-setup-for-e-invoicing/)
- **Portal enablement error** — "e-Invoice Not Enabled for GSTIN": complete e-Invoice Enablement form (GSTIN, OTP, Turnover, FY). [src](https://help.tallysolutions.com/e-invoice-option-disabled/)
- **ISO Currency Code** — currency master Formal name + Alt+H List of Currency for exporters. [src](https://help.tallysolutions.com/one-time-setup-for-e-invoicing/)
- **User rights for e-Invoicing** — security control to allow/block users from uploading to IRP. [src](https://help.tallysolutions.com/one-time-setup-for-e-invoicing/)
- **Reset e-Invoice Login** — F1 > Troubleshooting > Reset Login > Reset e-Invoice Login (per company). [src](https://help.tallysolutions.com/one-time-setup-for-e-invoicing/)
- **Mandatory data checks** — UOM mapped to UQC; valid HSN matching Type of Supply; taxability; party GSTIN, address, pincode, state; Bill from place; voucher no. ≤ 16 chars, not starting with 0, "/" or "-". [src](https://help.tallysolutions.com/missing-invalid-information-for-e-invoice-e-way-bill/)

### Generation
- **Provide e-Invoice details** — voucher toggle; e-Invoice Details screen: Bill to place, Ship to place (remembered per party). [src](https://help.tallysolutions.com/generate-irn-print-qr-code/)
- **Generate on save** — prompt after Ctrl+A; e-Invoice Login; IRN, Ack No., Ack Date, QR stored in voucher; print with IRN & QR. [src](https://help.tallysolutions.com/generate-irn-print-qr-code/)
- **Send e-Invoice Details after saving the Voucher** — F12 toggle. [src](https://help.tallysolutions.com/generate-e-invoices-for-export-transactions/)
- **Send e-Way Bill details with e-Invoice** — F12; also Send e-Way Bill details after saving the Voucher; Provide GST/e-Way Bill/e-Invoice details with consignee (To); not supported for credit/debit notes (NIC). [src](https://help.tallysolutions.com/generate-irn-print-qr-code/)
- **Ship-To GSTIN mandate (GSTN Advisory 661, 1-Aug-2026)** — Rel 7.1+ requires consignee GSTIN when Bill To ≠ Ship To; blank consignee GSTIN reported as URP; Rel 7.0- generate on portal manually. [src](https://help.tallysolutions.com/generate-irn-print-qr-code/)
- **Bulk IRN** — Alt+Z (Exchange) > Send for e-Invoicing lists pending generation & cancellation across registrations; Spacebar select, S Send (none selected = all); master/transaction conflict prompt (Rel 5.1+); Exchange Summary (generated / rejected / not uploaded). [src](https://help.tallysolutions.com/generate-bulk-irn-e-invoice/)
- **Offline JSON export** — Send for e-Invoicing > X (Offline Export), C configure folder, E export; auto-split >2 MB; upload IRP Bulk Upload; Download Excel; Alt+S Manually Update IRN Info (IRN, Ack No., Ack Date); QR needs Alt+L Get IRN Info online (no QR JSON import). [src](https://help.tallysolutions.com/generate-e-invoice-offline-tallyhelp/)
- **Export e-invoices** — Export Details; Claim refund (Shipping Bill No/Date/Port Code; recommended No due to NIC limitation). [src](https://help.tallysolutions.com/generate-e-invoices-for-export-transactions/)
- **Foreign consignee, Indian buyer** — PoS Other Territory, auto State Code 97, Pincode 999999 (Rel 3.0.1+); error "The State of the field is required" otherwise. [src](https://help.tallysolutions.com/generate-e-invoices-for-export-transactions/)
- **Courier/mail HSN 9965/9968** — PoS code 96 (Foreign Country); override Nature to Interstate Sales – Taxable; Supplies under section 7 of IGST Act; Y accept-with-conflict vs O override. [src](https://help.tallysolutions.com/generate-e-invoices-for-export-transactions/)

### Cancellation
- **Cancel e-Invoice & Voucher** — Alt+X in voucher > I; Cancellation Details (Reason + mandatory Remarks); 24-hour limit — after that B Back / C cancel only in books (not recommended). [src](https://help.tallysolutions.com/cancel-irn-e-invoice/)
- **Cancel e-Invoice & Delete Voucher** — Alt+D > I; same 24h rules. [src](https://help.tallysolutions.com/cancel-irn-e-invoice/)
- **Cancel & retain voucher** — Ctrl+I > Show More > e-Invoice Cancellation Details; Yes send now / No save (goes to For IRN Cancellation). [src](https://help.tallysolutions.com/cancel-irn-e-invoice/)
- **From report** — F10 Cancel IRN; Ctrl+F10 Mark as Cancelled (cancelled elsewhere) → Marked as IRN Cancelled. [src](https://help.tallysolutions.com/cancel-irn-e-invoice/)
- **Offline cancel** — export JSON, IRP Bulk IRN Cancel, Download Result Excel, Alt+L Get IRN Info. [src](https://help.tallysolutions.com/cancel-irn-e-invoice-offline-tallyhelp/)
- **Undo IRN Cancellation** — Alt+F10 from Pending/Exported for IRN Cancellation or Marked as IRN Cancelled; clears reason/remarks, restores section (only if cancelled in Tally). [src](https://help.tallysolutions.com/undo-irn-e-invoice-cancellation/)
- **e-Invoice1 vs e-Invoice2 portal** — IRN from IRP2 cannot be fetched/cancelled from Tally; cancel there and regenerate. [src](https://help.tallysolutions.com/cancel-the-current-e-invoice-generation-request-done-in-the-e-invoice1-portal/)

### e-Invoice report
- **Open** — Alt+G > e-Invoice; Alt+V Open e-Invoice Portal. [src](https://help.tallysolutions.com/how-to-view-e-invoice-report-and-get-irn-information-tallyhelp/)
- **IRN Register** — all vouchers with e-invoice status; Alt+V Remove IRN Info. [src](https://help.tallysolutions.com/how-to-view-e-invoice-report-and-get-irn-information-tallyhelp/)
- **Uncertain Transactions (Corrections needed)** — accept as is / recompute. [src](https://help.tallysolutions.com/how-to-view-e-invoice-report-and-get-irn-information-tallyhelp/)
- **Missing/Invalid Information** — sub-sections "Information required for e-Invoice not provided", "Mismatch in e-Invoice Details". [src](https://help.tallysolutions.com/how-to-view-e-invoice-report-and-get-irn-information-tallyhelp/)
- **Rejected by e-Invoice System** — e.g. duplicate IRN, invalid HSN; Alt+R Mark as Resolved. [src](https://help.tallysolutions.com/how-to-view-e-invoice-report-and-get-irn-information-tallyhelp/)
- **Pending for Exchange (For IRN Generation / For IRN Cancellation)**, **Exported**, **IRN Generated** (Alt+S manual update), **IRN Cancelled**, **User-Excluded Transactions** (Alt+H Include Vouchers). [src](https://help.tallysolutions.com/how-to-view-e-invoice-report-and-get-irn-information-tallyhelp/)
- **Voucher Information Mismatch with QR Code** — edited after IRN; Alt+F1 shows books vs IRP lines; fix or cancel IRN. [src](https://help.tallysolutions.com/how-to-view-e-invoice-report-and-get-irn-information-tallyhelp/)
- **Get IRN Info** — Alt+L fetches IRN, Ack No., Ack Date, QR for offline/external generation. [src](https://help.tallysolutions.com/how-to-view-e-invoice-report-and-get-irn-information-tallyhelp/)

### Sandbox
- **Enable Sandbox access** — F11 > Ctrl+I > Enable Sandbox access (per registration); register on sandbox with Client ID AACCT29GSPB5H8G (User Type Tax Payer, GSTIN, trade name, mobile, email, OTP); eligibility turnover ≥ ₹5 Cr; no offline JSON in sandbox; works in Educational Mode (1st, 2nd, last day of month only); must disable before live; Rel 1.1.4+ (multi-reg Rel 3.0+). [src](https://help.tallysolutions.com/e-invoice-sandbox/)

## e-Way Bill

### Setup
- **Portal registration + GSP API user** — e-Way Bill portal Registration (GSTIN, OTP, "Update from GST Common Portal"), Registration > For GSP > Add/New Tally (India) Private Limited; API creds differ from portal creds; e-Invoice API creds also work; other-GSP creds don't. [src](https://help.tallysolutions.com/e-way-bill-one-time-setup/)
- **Company options** — e-Way Bill applicable, Applicable from, Applicable for intrastate; interstate & intrastate threshold limits (default ₹50,000) under Set/Alter Company GST Rate and Other Details > e-Way Bill Details; per-registration enablement. [src](https://help.tallysolutions.com/e-way-bill-one-time-setup/)
- **Threshold limit includes** — Invoice value / Taxable and exempt goods value / Taxable goods value (older releases; also in Export for e-Way Bill F12). [src](https://help.tallysolutions.com/e-way-bill-in-tallyprime-up-to-release-1-1-4/)
- **Supported vouchers** — Sales, Purchase, Debit Note, Credit Note, Delivery Note, Receipt Note, Journal as sales/purchase; Material In/Out (Rel 5.1+); POS & Journal only via Exchange (not on save); debit notes only via report. [src](https://help.tallysolutions.com/india-gst-e-way-bill-tally/)
- **Login session** — 6 hours; no logout, F1 > Troubleshooting > Reset e-Way Bill Login; per-registration logins in multi-GSTIN. [src](https://help.tallysolutions.com/faq-e-way-bill-tally/)
- **License dependency** — online needs TSS; offline export works without TSS (QR/details fetch needs TSS); Educational mode neither; no e-Way Bill sandbox. [src](https://help.tallysolutions.com/faq-e-way-bill-tally/)

### Generation fields (Provide GST/e-Way Bill details > Statutory Details)
- **Sub Type** — Supply, Export/Import, Job Work, Line Sales, For Own Use, Recipient Not Known, SKD/CKD/Lots, Others (auto Export/Import for foreign/SEZ party). [src](https://help.tallysolutions.com/faq-e-way-bill-tally/)
- **Document Type** — Tax Invoice, Bill of Entry, Bill of Supply, Delivery Challan, Others. [src](https://help.tallysolutions.com/faq-e-way-bill-tally/)
- **Consignor Details (From)** — mailing name, GSTIN, address, pincode prefilled from company. [src](https://help.tallysolutions.com/generate-e-way-bill-online/)
- **Consignee Details (To)** — from ledger; Ship-To GSTIN mandatory when Bill To ≠ Ship To (Advisory 661; Rel 7.1+); blank → URP. [src](https://help.tallysolutions.com/generate-e-way-bill-online/)
- **Transport Details** — Pin to Pin Distance (auto-fetched/updated from portal; remembered per party+pincode), Transporter Name, Transporter ID (GSTIN or 15-digit ID), Mode (Road: Vehicle No., Vehicle Type, Date; Ship/Air/Rail: Doc/Lading/RR/AirWay No. & Date); Part B mandatory without Transporter ID. [src](https://help.tallysolutions.com/faq-e-way-bill-tally/)
- **Vehicle number formats** — NIC formats e.g. AB123456, AB12A1234, AB12ABC1234; DF prefix defence, TM temp RC. [src](https://help.tallysolutions.com/faq-e-way-bill-tally/)
- **Type of Goods as Gold** — Kerala intrastate HSN Ch.71 (excl. 7117) without Part B/Transporter ID; cannot mix with non-gold items; Rel 7.1+. [src](https://help.tallysolutions.com/generate-e-way-bill-online/)
- **e-Way Bill Applicability > Exclude from Generation** — Ctrl+I per voucher; Rel 7.1+. [src](https://help.tallysolutions.com/generate-e-way-bill-online/)
- **Generate on save** — confirmation, login, exchange, preview incl. e-Way Bill page with QR (QR built locally from EWB No., GSTIN, date-time); EWB No., Date, Validity auto-filled. [src](https://help.tallysolutions.com/generate-e-way-bill-online/)
- **IRN dependency** — e-invoice-applicable sales need IRN first or together; offline EWB for IRN transactions not supported; CN/DN can generate EWB without IRN. [src](https://help.tallysolutions.com/generate-e-way-bill-online/)
- **Bulk online** — Alt+Z > Send for e-Way Bill; S send (all if none selected); conflict prompt Rel 5.1+; summary generated/rejected. [src](https://help.tallysolutions.com/generate-e-way-bill-online-in-bulk/)
- **Offline JSON** — X Offline Export, C folder, E export; upload portal e-Waybill > Generate Bulk or Consolidated EWB > Generate Bulk; Ctrl+B Include URD Purchases / Include Non-URD Purchases for inward; no export without Part B. [src](https://help.tallysolutions.com/generate-e-way-bill-offline/)
- **Consolidated e-Way Bill** — enable consolidated details (older releases); bulk JSON to Consolidated EWB. [src](https://help.tallysolutions.com/e-way-bill-in-tallyprime-up-to-release-1-1-4/)
- **Multiple vehicles** — separate Delivery Notes each with EWB, mapped to one sales invoice; Alt+R Transporter Details (older). [src](https://help.tallysolutions.com/faq-e-way-bill-tally/)
- **Value mapping** — apportioned additional ledgers go into item taxable value; non-apportioned into Other amount. [src](https://help.tallysolutions.com/faq-e-way-bill-tally/)

### Post-generation
- **Cancel EWB** — Alt+X/Alt+D in voucher or Ctrl+I > e-Way Bill Cancellation Details; F10 Cancel EWB in report; 24h limit unless no Part B; remarks optional; inspected EWB not cancellable. [src](https://help.tallysolutions.com/cancel-e-way-bill/)
- **Undo Cancellation** — Alt+F10. [src](https://help.tallysolutions.com/undo-e-way-bill-cancellation/)
- **Extend validity** — F9 Extend EWB; Remaining Distance (KM); Alt+L Calculate Distance on Portal (Rel 3.0+); Ctrl+F9 Mark as Extended; Alt+F10 Undo Extension; only within 8h of expiry; page states validity 1 day per 2000 km (regular; statute is 200 km) and per 20 km for over-dimensional cargo, expiring midnight. [src](https://help.tallysolutions.com/extend-e-way-bill-validity/)
- **Update Part B** — F7: Mode of transport, Vehicle Number, Vehicle Type; transshipment repeat; Ctrl+F7 Mark Part B as Updated; Alt+F7 Undo Part B Updation; Part B optional if intrastate <50 km. [src](https://help.tallysolutions.com/update-e-way-bill-part-b-online/)
- **Offline Part B/Transporter ID export** — X from Send for e-Way Bill. [src](https://help.tallysolutions.com/update-e-way-bill-part-b-offline/)
- **Convert to B2C** — Alt+V on rejected vouchers with invalid/inactive consignee GSTIN (inactive grouped Rel 5.1+). [src](https://help.tallysolutions.com/invalid-consignee-gstin/)
- **Print options** — Format of e-Way Bill Regular (slip); Exclude Invoice from printing; detailed format combo of NIC small+detailed; latest Part B only. [src](https://help.tallysolutions.com/faq-e-way-bill-tally/)

### e-Way Bill report
- **Sections** — e-Way Bill Register (Alt+V Remove EWB Info); Uncertain Transactions; Missing/Invalid Information (Incomplete HSN/SAC information, Information required for e-Way Bill not provided, + e-Invoice sub-buckets); Rejected by e-Way Bill System (portal reason shown); Pending for Exchange (generation, cancellation, extension, Part B/Transporter ID updation); Exported; e-Way Bill Generated (With Part B / Without Part B; Alt+Q Manually Update EWB Info); e-Way Bill Cancelled; User-Excluded (Alt+H Include). [src](https://help.tallysolutions.com/e-way-bill-report-and-e-way-bill-info/)
- **F6 Get EWB Info** — sync status from portal for pending/exported/rejected. [src](https://help.tallysolutions.com/e-way-bill-report-and-e-way-bill-info/)
- **Alt+V Open EWB Portal**. [src](https://help.tallysolutions.com/e-way-bill-report-and-e-way-bill-info/)
- **EWB block status** — via party Fetch Details / Validate Party GSTIN (blocked if GSTR-3B not filed 2 months). [src](https://help.tallysolutions.com/e-way-bill-report-and-e-way-bill-info/)
- **Common rejection codes handled** — invalid distance/pincode/state code, invalid supply/sub-supply/document type, invalid GSTIN/HSN, duplicate document no., transporter doc date before invoice, extension outside window, remaining distance > actual, blocked consignor/consignee/transporter GSTIN, multi-select not allowed for Part B/Transporter ID/Cancel. [src](https://help.tallysolutions.com/reasons-for-rejection-of-e-way-bill-and-resolutions/)
- **TDL schema for EWB** — fields: CancelReason/Code, extension (distance, mode, vehicle, transit type, reason, remarks, address), Part B/TransId pending flags, ValidUpto, ignore-validation flags, export flags, error list. [src](https://help.tallysolutions.com/changes-in-e-way-bill-details/)

## GST Returns — GSTR-1

### Report structure
- **Header** — GST Registration, Period, Status of Return (Signed/Not Signed); F3 switch registration (combined view across registrations); F12, Ctrl+B Basis of Values; Ctrl+L Save View. [src](https://help.tallysolutions.com/gstr-1-report-in-tallyprime/)
- **Total Vouchers statuses** — Included in Return; Ready for Export; Not Exported; Modified in Books After Upload/Export; Marked for Deletion on Portal; Mismatch with GST Data; No Action Required; Not Relevant for this Return (other registration/period/returns, non-GST like payroll/inventory/orders, user-excluded); Uncertain Transactions (Corrections needed); Moved to other Return periods; Amendments Marked for Future Returns; Non-Accounting Transactions, Included in Return (deleted/renumbered after signing); Additional Pending Actions (HSN/Document Summary, advances, RCM). [src](https://help.tallysolutions.com/gstr-1-report-in-tallyprime/)
- **Return View sections** — B2B Invoices 4A/4B/4C/6B/6C; B2C (Large) 5A/5B (>₹1 lakh); Exports 6A (Taxable, LUT/Bond, Exempt, Nil; F12 shipping bill no/date/port code); CDN Registered 9B; CDN Unregistered 9B; Amended B2B 9A; Amended B2CL 9A; Amended Exports 9A; Amended CDN Reg 9C; Amended CDN Unreg 9C; B2C (Small) 7; Nil Rated 8A–8D (nil/exempt/non-GST); Amendment B2CS 10; Tax Liability (Advances Received) 11A(1)/(2); Adjustment of Advances 11B(1)/(2); Amended 11A; Amended 11B; HSN Summary 12; Document Summary 13; F12 hide empty sections. [src](https://help.tallysolutions.com/gstr-1-report-in-tallyprime/)
- **Nature View (F5)** — Local / Interstate / Exports / SEZ, each split Taxable, Exempt, Nil Rated, Non-GST (+ Export LUT/Bond); compare with P&L/Sales Register. [src](https://help.tallysolutions.com/gstr-1-report-in-tallyprime/)
- **Sign Return** — F10 (S current / current+previous); signed vouchers modified → Uncertain; Alt+F10 Undo Signing. [src](https://help.tallysolutions.com/gstr-1-report-in-tallyprime/)
- **Reset Delete Request** — Alt+Q in Marked for Deletion on Portal. [src](https://help.tallysolutions.com/gstr-1-report-in-tallyprime/)
- **e-Commerce Summary** — Ctrl+H > e-Commerce Summary: e-TIN, taxable & IGST/CGST/SGST/Cess, GSTIN-wise operator sales; tables 14/14A/15/15A (from 1-Jan-2024); party marked as e-Commerce Operator; Rel 4.1+. [src](https://help.tallysolutions.com/gstr-1-report-in-tallyprime/)
- **GST Status values (vouchers)** — System Inferred, Excluded, Mismatched, Reconciled, Exported, Uploaded, Rejected by GST Portal, Upload in Progress; Alt+S Set GST Status. [src](https://help.tallysolutions.com/upload-gstr-1/)
- **QRMP / IFF** — upload invoices monthly via Invoice Furnishing Facility. [src](https://help.tallysolutions.com/gstr-1-report/)

### HSN & Document summary
- **HSN Summary – 12 (B2B – B2C Supplies)** — Registration Period view month-wise Total, Taxable, IGST, CGST, SGST/UTGST, Cess, Tax; F5 Summary View; Ctrl+B None / Comparison of Books & Portal / Difference; Ctrl+H HSN/SAC, HSN/SAC and Description, Description; Alt+V Alter Summary, Alt+R Reset Summary; Alt+S status (System Inferred, Exported, Mismatched, Not Uploaded, Reconciled, Uploaded); F12 Show breakup of Tax Amount. [src](https://help.tallysolutions.com/hsn-sac-summary-b2b-b2c/)
- **HSN summary (Rel 2.1-)** — Included in HSN/SAC Summary vs Incomplete Information; Ctrl+B Type of Supply Goods/Services/both; sort by description, HSN, qty, taxable, UQC. [src](https://help.tallysolutions.com/hsn-sac-summary-rel-2-1/)
- **Document Summary – 13** — doc types (outward invoices, inward from URD, DN/CN, receipt/payment vouchers) with number range, cancelled count, total; Alt+V Alter Summary; mandatory from May-2025. [src](https://help.tallysolutions.com/gstr-1-report-in-tallyprime/)
- **Export toggles** — Ctrl+B Include HSN Summary, Include Document Summary. [src](https://help.tallysolutions.com/hsn-summary-not-exported-uploaded/)
- **UQC mapping & conversion** — map UoM to nearest UQC (e.g. Carat→KGS ×0.0002, Brass→SQF ×100, Running foot→MTR ×0.3048, Tola→GMS ×11.66); services OTH→NA. [src](https://help.tallysolutions.com/file-gstr-1-using-offline-tool/)

### Upload / file / export
- **Upload GSTR-1 (connected)** — Alt+Z > All GST Options > Upload GST Returns > GSTR-1; F12 columns Party GSTIN/UIN, GST Status, Sections, Include e-Invoices (with IRN information); Ctrl+B Include transactions mismatching / upload in progress / Rejected by GST Portal / Delete Requests; S Send Online; GST OTP login (session 6h here; 30 days per profile page). [src](https://help.tallysolutions.com/upload-gstr-1/)
- **File GSTR-1 directly** — Alt+Z > All GST Options > File GSTR-1; verify summary, S send, mode E (EVC: PAN+EVC) or D (DSC: signatory+PIN); ARN shown; V View Summary; C Continue Filing / Restart Filing after interruption. [src](https://help.tallysolutions.com/india-gst-filing-gstr1-tally/)
- **GSTR-1 Filed Summary – Downloaded** — ARN, filing date per month. [src](https://help.tallysolutions.com/india-gst-filing-gstr1-tally/)
- **Export GST Returns** — Alt+E > GST Returns > GSTR-1; period, registration; F12 Show Tax types in separate columns, Show HSN/SAC Summary; formats JSON (Data Interchange) / Excel (single workbook) / CSV (per table); section-wise selection; folder path. [src](https://help.tallysolutions.com/file-gstr-1-using-offline-tool/)
- **Offline Tool flow** — HSN from Annual Computation export → template GSTR1_Excel_Workbook_Template_V1.8 / hsn.csv; tool v3.2.2; upload deletes JSON before regular; Alt+V Open GST Portal. [src](https://help.tallysolutions.com/file-gstr-1-using-offline-tool/)
- **Pre-filing checklist** — 3B filed for prior 2 periods (else GSTR-1 blocked); tax ≥ computed; HSN per Rule 59(6); Enable tax liability on advance receipts if turnover > ₹1.5 Cr. [src](https://help.tallysolutions.com/file-gstr-1-using-offline-tool/)

### Reconciliation
- **Download GST Returns** — Alt+Z > All GST Options > Download GST Returns; C configure Return Type & period, default return types; D download. [src](https://help.tallysolutions.com/india-gst-status-reconciliation-gstr-1-tally/)
- **Import GST Returns (JSON)** — Alt+O > GST Returns: GST Registration, Return Type, File Path, File; Import Summary processed/imported/failed; portal values shown in blue. [src](https://help.tallysolutions.com/india-gst-status-reconciliation-gstr-1-tally/)
- **GSTR-1 Reconciliation sections** — Reconciled; Unreconciled; Mismatched (Alt+S mark Reconciled); Available only in Books; Available only on Portal (Alt+R GST Portal View); Available in Books and on Portal but in Different Return Periods; Mismatch in Return periods (Alt+L Set Effective Date); Excluded, but available on Portal. [src](https://help.tallysolutions.com/india-gst-status-reconciliation-gstr-1-tally/)

### Uncertain transactions / exceptions
- **Bulk fix** — Alt+W Update as per Masters on selected uncertain vouchers. [src](https://help.tallysolutions.com/best-practices-enhancements-in-gst-for-migration/)
- **Accept as is** — Alt+J. [src](https://help.tallysolutions.com/how-to-override-assessable-value-hsn-code-party-details-cess-valuation-method-in-sales-invoice/)
- **Older resolution screens** — Alt+F8 Party-wise Corrections, F8 Voucher-wise, Alt+F8 Item Exceptions, F8 Ledger Exceptions (Multi Stock/Ledger Alteration with Nature, HSN, rate, taxability, effective date). [src](https://help.tallysolutions.com/india-gst-resolving-incomplete-mismatch-in-information-gstr-1-tally/)
- **Exception catalogue (Rel 3.1+)** — HSN/SAC invalid/mismatched/not specified; HSN vs Type of Supply mismatch; tax ledger not selected; duplicate voucher/document no.; taxability invalid; tax amount modified vs expected; tax rate not specified; wrong reg type/tax ledger in bank txn; unable to determine transaction type; UOM not mapped to UQC; no tax ledger debited; voucher no. incorrect; invalid source of GST details; company registration invalid; supplier invoice no. missing; GST rate overridden; unable to determine original sales value; PoS invalid; incorrect tax ledger; amended more than once; conflicts with masters (current/all periods; potential conflicts); party registration mismatch; tax rate mismatch master vs txn; nature vs PoS mismatch; amendment effective date missing; cannot be added in return period; portal HSN rejections; interest beyond permissible limit; invoice exists with different CTIN. [src](https://help.tallysolutions.com/rel-3-0-gstr-1-gstr-3b-exceptions-resolutions/)
- **Validation errors surfaced** — IGST mandatory for interstate (no CGST/SGST); invoice date before registration date; IGST amount required for export; composition interstate supply not allowed; invalid/inactive/blocked GSTIN; Ladakh PoS before 01-Jan-2020 invalid; Central vs State tax value mismatch. [src](https://help.tallysolutions.com/rel-3-0-gstr-1-gstr-3b-exceptions-resolutions/)
- **Return filing checklist** — company reg details, master GST setup, no rates in tax ledgers, compliant numbering, validated parties, reconcile 1/3B, pending to be signed, annual computation review. [src](https://help.tallysolutions.com/checklist-for-return-filing-gst-regular/)

## GST Returns — GSTR-3B

### Report
- **Header** — company, registration, period, Signed/Not Signed; F3 per-registration, Save View default registration. [src](https://help.tallysolutions.com/gstr-3b-report/)
- **Total Vouchers statuses** — Included in Return; Not Relevant for this Return; Uncertain Transactions; Moved to other Return periods; Deleted Transactions After Filing Return; Non-Accounting Transactions, Included in Return; No Action Required After Export; Modified in Books After Export; columns Vouchers with Pending Actions of Earlier/Future Periods. [src](https://help.tallysolutions.com/gstr-3b-report/)
- **F12 options** — Show Tax types in separate columns; Show break-up of nett values (returns netted); Format of Report Condensed/Detailed; Show breakup of Eligible and Ineligible for ITC Supplies (Nature View). [src](https://help.tallysolutions.com/gstr-3b-report/)
- **Return View tables** — 3.1(a) outward taxable; 3.1(b) zero rated; 3.1(c) nil/exempt; 3.1(d) inward RCM; 3.1(e) non-GST outward; 3.2 interstate to Unregistered / Composition / UIN holders by PoS (Liability in Current Period vs Amendments); 4A ITC Available (1 Import of Goods, 2 Import of Services, 3 RCM other, 4 ISD, 5 All other ITC); 4B ITC Reversed (1 Rules 38/42/43 & s.17(5), 2 Others); 4C Net ITC; 4D Other Details (4D.1 reclaimed, 4D.2 s.16(4)/PoS ineligible — from 2B "ITC Not Available"); 5 Exempt/Nil/Non-GST inward (composition/exempt/nil; non-GST; inter vs intra); 5.1/6.1 Interest, Late Fee, Penalty, Others; 6.1 Payment of tax left blank. [src](https://help.tallysolutions.com/gstr-3b-report/)
- **Notification 14/2022 handling** — 17(5) ineligible moved to 4B.1, reclaimed in 4D.1; Rel 3.0+. [src](https://help.tallysolutions.com/gstr-3b-tallyprime/)
- **Nature View (F5)** — Liability (Outward, Tax on Advance Received, Tax on Advance Paid, Liability from Inward Supplies), Input Tax Credit (Local, Interstate, Import of Goods, SEZ, Purchase from Composition Dealer), Other Charges; Shift+F5 drill to taxable/exempt, registered vs consumer, then rate-wise (12/18/28%). [src](https://help.tallysolutions.com/gstr-3b-report/)
- **ITC Breakup of GSTR-3B** — F8 or Alt+G; current period / From Other Periods / Moved to Other Periods columns; F12 Show ITC Moved to Other Periods; F5 Voucher-wise (Vch Type & No., Doc No. & Date, tax). [src](https://help.tallysolutions.com/gstr-3b-report/)
- **Uncertain groups** — Transactions with Incomplete/Mismatch in Information; Outward Supplies; Advance Receipts; Tax and Other Adjustments → sub-groups Invalid or Missing Information / Mismatch Between Masters and Transactions / Mismatch Within the Transaction; Alt+V Accept As Is. [src](https://help.tallysolutions.com/gstr-3b-report/)
- **Exception Reports (Ctrl+J)** — Vouchers Ignored for Conflicts; Transactions Accepted as Valid (Mismatch between Expected and Modified Tax, Accepted as is (Format), Accepted as is); Alt+J Undo Accept As Is. [src](https://help.tallysolutions.com/gstr-3b-report/)
- **Allow Tax Value Difference up to** — Ctrl+B tolerance (Rel 2.1-). [src](https://help.tallysolutions.com/gstr-3b-report-2-1/)
- **Mark as Filed** — F10 (S current); Alt+F10 Undo Filing; modified filed txns → Uncertain. [src](https://help.tallysolutions.com/gstr-3b-report/)
- **Ladakh/J&K GSTIN split** — GSTIN applicable from 1-Jan-2020 + prior GSTIN; Period-wise Returns screen; F12 Show GSTIN/UIN (prior to 1-Jan-2020). [src](https://help.tallysolutions.com/gstr-3b-report-2-1/)
- **Company option: Enable tax liability on reverse charge (Purchase from unregistered dealer)** — drives URD RCM into 3.1(d)/4A(3) vs table 5. [src](https://help.tallysolutions.com/gstr-3b-report/)
- **Masters flag: Is non-GST goods?** — routes to 3.1(e)/5 Non-GST; **Is ineligible for input credit?** → 4D(1)/17(5); **Nature of goods** Capital Goods/Not Applicable. [src](https://help.tallysolutions.com/gstr-3b-report/)

### Nature of Transaction values (classification taxonomy)
- **Outward** — Sales Taxable; Sales to Consumer – Taxable/Exempt/Nil Rated; Sales Exempt; Sales Nil Rated; Interstate Sales Taxable/Exempt; Interstate Sales to Embassy/UN Body Taxable/Exempt/Nil Rated; Deemed Exports Taxable/Exempt/Nil Rated; Intrastate Deemed Exports Taxable/Exempt/Nil Rated; Exports Taxable/Exempt/LUT/Bond/Nil Rated; Sales to SEZ – Taxable/Exempt/LUT/Bond/Nil Rated; High Seas Sales; System Inferred. [src](https://help.tallysolutions.com/gstr-3b-report/)
- **Inward** — Purchase Taxable/Exempt/Nil Rated; Interstate Purchase Taxable/Exempt/Nil Rated; Imports Taxable/Exempt/Nil Rated; Purchase From SEZ – Taxable/Exempt/LUT/Bond/Nil Rated; Purchase From SEZ (Without Bill of Entry) – Taxable/Exempt/Nil Rated; Purchase Deemed Exports – Taxable/Exempt/Nil Rated; Intrastate Purchase Deemed Exports – …; Purchase From Unregistered Dealer – Taxable/Exempt/Nil Rated (+ Interstate, Services); Purchase from Composite Dealer. [src](https://help.tallysolutions.com/gstr-3b-report/)
- **Journal Additional Details values** — On Account of Advance Receipts; Sale against advance receipts; Cancellation of Advance Receipts; Advance Receipts for Exports/SEZ sales (+ sale against / cancellation); Purchase from Unregistered dealer; Purchase under reverse charge; Advances Paid under Reverse Charge; Cancellation of Advance Payments under RC; Purchase against Advance Payment; ISD Transfer; Exempt and non-business supplies – Rule 42(1)(m); Capital credit due to exempted supplies – Rule 43(1)(h); On account of claiming more – Rule 42(2)(a); Re-claim of reversal ITC – Rule 42(2)(b); ITC reversed under section 17(5); Non-payment to the Supplier – Rule 37(2); ISD credit note – Rule 39(1)(j)(ii); Re-claim of reversal ITC (on account of buyer payment); Ineligible Credit; Interest; Late Fees; Others. [src](https://help.tallysolutions.com/gstr-3b-report/)

### Filing methods
- **Connected: Download → Reconcile → Upload → File** — Alt+Z > All GST Options > Upload GST Returns > GSTR-3B; Ctrl+B Method of showing values from the portal = Comparison of Books and Portal Values. [src](https://help.tallysolutions.com/gstr-3b-tallyprime/)
- **JSON export** — X Export, C configure (JSON, folder, section-wise); QRMP quarter: Export a single file for the set Period (Rel 3.0+); 3.2 not auto-filled from GSTR-1 in Rel 2.0–6.2. [src](https://help.tallysolutions.com/tallyprime-json-file-gstr-3b/)
- **Offline tool Excel** — needs department GSTR-3B Excel utility; Template File Path / Template File Name in export config (error "template does not exist"). [src](https://help.tallysolutions.com/gstr3b-excel-template-does-not-exist/)
- **Manual** — Alt+P Print > Return Form → MS Word copy for portal entry. [src](https://help.tallysolutions.com/file-gstr-3b-manually/)
- **Interest table check** — GSTN Feb-2026 advisory system-computed interest (Rule 88B(1)); record journal for 6.1 amount. [src](https://help.tallysolutions.com/interest-liability-beyond-permissible-limit-in-gstr-3b/)
- **Blocked / inactive GSTIN handling** — EWB block refresh on portal; convert inactive-GSTIN B2B to Sales to Consumer – Taxable; set party Reg Type Consumer. [src](https://help.tallysolutions.com/inactive-gstin/)

## GSTR-2A / GSTR-2B Reconciliation

- **Download** — Alt+Z > All GST Options > Download GST Returns (C configure Return Type 2A/2B, period, default types & registrations; D download); re-download replaces older; Rel ≤4.1 menu path differs. [src](https://help.tallysolutions.com/gstr-2b-reconciliation/)
- **Manual import** — Alt+O > GST Returns (registration, return type, file path, file); Import Summary. [src](https://help.tallysolutions.com/india-gst-status-reconciliation-gstr-2a/)
- **Colour coding** — pending activities amber, portal values blue. [src](https://help.tallysolutions.com/gstr-2b-reconciliation/)
- **2B Reconciliation Statistics** — Reconciled; Unreconciled; Mismatched; Available Only in Books; Available Only on Portal; Mismatch in Return Period; Excluded, but available on Portal; Uncertain Transactions; Invoices Rejected in IMS; Return View mirrors GSTR-2B tables. [src](https://help.tallysolutions.com/gstr-2b-reconciliation/)
- **Config** — F3 registration (default consolidated); Ctrl+B Show report details based on; Ctrl+H Reconciliation Statistics / Voucher Statistics view; F12 Show potential matches between Books and Portal; Show Reconciliation Status; extra columns Invoice Type, Reverse Charge. [src](https://help.tallysolutions.com/gstr-2b-reconciliation/)
- **Actions** — Alt+S Set GST Status (Reconciled for rounding; Excluded for wrong-GSTIN portal entries → Excluded Portal Transactions; System Inferred to restore); Alt+L Set Effective Date; Alt+R GST Portal View (trade name, PoS; unknown party shown italic). [src](https://help.tallysolutions.com/gstr-2b-reconciliation/)
- **Potential matches** — (Excluding Section): Alt+F10 Other Vouchers convert to correct type e.g. Credit Note; (Excluding Party GSTIN/UIN): Ctrl+Enter party fix; (Excluding Doc No.): Alt+W Copy Doc No. & Date, multi-select (Rel 4.1+). [src](https://help.tallysolutions.com/gstr-2b-reconciliation/)
- **Recompute GSTR-2B** — Alt+Z > All GST Options > Recompute GSTR-2B; per registration; period prefilled by next 3B; triggered by IMS actions, ITC reversal, edits, 3B upload error; Online GST Activity Tracker. [src](https://help.tallysolutions.com/gstr-2b-reconciliation/)
- **Export 2B in old GSTR-2 format** — Alt+E > Current > F8 File Format Excel > As per old format (GSTR-2); Rel 5.0+. [src](https://help.tallysolutions.com/gstr-2b-reconciliation/)
- **2A specifics** — combined multi-registration recon; same sections/actions. [src](https://help.tallysolutions.com/india-gst-status-reconciliation-gstr-2a/)
- **Legacy GSTR-2 exceptions** — UoM not mapped to UQC (Alt+H Exclude from Summary → "Not included in HSN/SAC Summary (UQC not available)", Alt+Q Update UQC); Country/state/dealer type not specified; Tax rate/type not specified; Nature/taxable/rate modified (Alt+R Resolve / Alt+J Accept as is); incorrect tax type; tax amount modified (Alt+W Recompute); incomplete adjustment details; table-wise info missing (Party-wise/Voucher-wise views); Alt+H Exclude Vouchers. [src](https://help.tallysolutions.com/india-gst-resolving-incomplete-mismatch-in-information-gstr-2-tally/)
- **Counter-party signing / Vouchers Ignored for Conflicts** — see GSTR-3B. [src](https://help.tallysolutions.com/gst-amendments-for-purchases/)

## IMS (Invoice Management System)

- **Download IMS Inward Invoices** — Alt+Z > All GST Options > Download IMS Inward Invoices. [src](https://help.tallysolutions.com/manage-ims-inward-supplies/)
- **IMS Inward Supplies report** — Alt+G > Invoice Management System; split Invoices Filed by Supplier / Yet to Be Filed; Ctrl+H filter by Filing status & Action Status; Alt+Q Available Only in Books; F12 Show Declared ITC. [src](https://help.tallysolutions.com/manage-ims-inward-supplies/)
- **Views** — Default (Action Required / Action Taken – Ready for Upload / Action Taken – Uploaded); F7 Reconciliation (Reconciled / Mismatched / Available Only on Portal); F8 Action (Action Required / Accepted / Rejected / Pending); F9 Books (Total = Reconciled + Mismatched + Available Only in Books + Uncertain). [src](https://help.tallysolutions.com/manage-ims-inward-supplies/)
- **Rel 7.1 UX** — collapsible sections for bulk action; mismatches highlighted red; Alt+W copy doc no/date for many-to-one candidates; party-scoped email/WhatsApp share. [src](https://help.tallysolutions.com/manage-ims-inward-supplies/)
- **Fetch Party Name Using GSTIN/UIN** — F9 in voucher register; F Fetch → Trade Name, Legal Name, Address; Alt+W Update as per Portal. [src](https://help.tallysolutions.com/manage-ims-inward-supplies/)
- **Set Action Status (F10)** — Accept (optional ITC reduction), Reject (optional exclude from own 3B), Pending (effective date for 2B & 3B; F12 Set separate Effective Dates for GSTR-2B & GSTR-3B), No Action (deemed accepted); Add IMS Remarks; effective date/exclude only for linked vouchers. [src](https://help.tallysolutions.com/manage-ims-inward-supplies/)
- **Remarks exchange rules** — Pending/Rejected all sections; Accepted only for B2BA, B2BCN, B2BCNA, B2BDNA, IMPGA, IMPGSEZA when ITC reduction applies (Rel 7.0+). [src](https://help.tallysolutions.com/upload-ims-inward-invoices/)
- **Post-3B cleanup** — No Action/Accepted/Rejected invoices drop from IMS after 3B filing; tracked in 2B. [src](https://help.tallysolutions.com/manage-ims-inward-supplies/)
- **IMS – ITC Summary** — Available ITC (Accepted + No Action, minus reduced ITC & B2BCN), Pending ITC, Rejected ITC; IGST/CGST/SGST/Cess/Tax columns; F10 change status from drill-down; all registrations. [src](https://help.tallysolutions.com/ims-itc-summary/)
- **IMS Potential Matches** — F8 from register (T keep period / P change); groups Excluding Doc No. & Doc Date, Excluding Party GSTIN/UIN, Doc No. & Doc Date; Alt+W Copy from Portal; Alt+V Manually Update Doc No. & Date (book side only); Shift+Enter show/hide groups; no many-to-one linking. [src](https://help.tallysolutions.com/ims-potential-matches/)
- **Upload IMS Inward Invoices** — Alt+Z > All GST Options; Ctrl+B Include by Action Status (Accepted/Rejected/Pending/All), Include already uploaded, Include upload in progress, Include Rejected by GST Portal, Include IMS Remarks; S Send (Online); auto re-download; No Action excluded; Ctrl+Enter alter book invoice. [src](https://help.tallysolutions.com/upload-ims-inward-invoices/)
- **Reset IMS Action Status** — Alt+Z > All GST Options; C select registration (default All); R reset; older-than-books data via Reset GSTN Data. [src](https://help.tallysolutions.com/reset-ims-inward-action-status/)
- **ITC reduction for amendments** — record ITC reduction for B2BA, CDNRA, B2BDNA with remarks. [src](https://help.tallysolutions.com/gst-purchase-management/)

## GST Annual Computation & Annual Returns

### GST Annual Computation report
- **Total Vouchers** — Included in Return; Included in HSN/SAC Summary; Incomplete HSN/SAC information; Not relevant for this Report (re-include possible); Uncertain Transactions. [src](https://help.tallysolutions.com/gst-annual-computation-tally/)
- **Liability — tax payable** — B2C to unregistered (Unregistered/Consumer/Unknown w/o GSTIN); B2B incl. CN/DN (Regular, Embassy/UN, Composition, Unknown with GSTIN); Exports with payment incl. CN/DN; SEZ with payment incl. CN/DN; Deemed exports incl. CN/DN; Advances with tax paid but no invoice; Inward RCM (journal values override purchase values when liability journals exist). [src](https://help.tallysolutions.com/gst-annual-computation-tally/)
- **Liability — tax not payable** — Exports without payment (LUT/Bond); SEZ without payment; Outward subject to reverse charge; Exempted; Nil rated; Non-GST (each with CN/DN, CN shown negative). [src](https://help.tallysolutions.com/gst-annual-computation-tally/)
- **Input Tax Credit** — Import of goods (incl. SEZ); Import of services (journal preferred over purchase); Inward RCM; Inward from ISD; All other ITC (Goods/Services/Capital Goods); Amount of ITC reclaimed. [src](https://help.tallysolutions.com/gst-annual-computation-tally/)
- **ITC Reversal & Ineligible ITC Declared** — Rule 37 non-payment; Rule 39 ISD credit note; Rule 42 excess/exempt & non-business; Rule 43 capital goods; Section 17(5) ineligible (GSTR-9 7E guidance); Other reversals. [src](https://help.tallysolutions.com/gst-annual-computation-tally/)
- **HSN/SAC Summary of Outward / Inward Supplies** — per HSN: Type of Supply, UQC, qty, tax values; separate row per rate; F5 Summary View vs Registration Period View, monthly breakup, single-sheet yearly Excel export; Rel 5.1+. [src](https://help.tallysolutions.com/gst-annual-computation-tally/)
- **Actions** — Alt+J Stat Adjustment from report; Ctrl+J Exception Reports (Transactions Accepted as Valid, Vouchers Ignored with Conflicts); drill: month-wise → PoS/supply-type → vouchers. [src](https://help.tallysolutions.com/gst-annual-computation-tally/)

### GSTR-9 / 9C / 9A / GSTR-4 (portal filing guides — no native form generation)
- **GSTR-9 workflow** — mandatory turnover > ₹2 Cr (optional below); review Annual Computation for FY; export GSTR-1, GSTR-2B, GSTR-3B, HSN summary for reference; fill on portal (Prepare Online). [src](https://help.tallysolutions.com/file-gstr-9-tally/)
- **GSTR-9 table-by-table mapping guide** — Parts I–VI (basic details; 4A–4N outward/inward with tax payable incl. B2C, B2B, exports, SEZ, deemed exports, advances, RCM, CN/DN; Part III ITC; Part IV tax paid; Part V prior-FY transactions; Part VI other) each mapped to GSTR-1/3B report sections or exported Excel sheets (b2b, cdnr, exp, cdnur). [src](https://help.tallysolutions.com/form-gstr-9-annual-returns/)
- **GSTR-9C mapping guide** — Pt I basic + "liable to audit"; Pt II turnover reconciliation (audited turnover from P&L, unbilled revenue, unadjusted advances via Outstanding Advance Receipts report: Total Advance Received / Pending to be Adjusted / Total Advance Adjusted); Pt III tax paid; Pt IV ITC; Pt V auditor recommendation. [src](https://help.tallysolutions.com/form-gstr-9c-annual-returns/)
- **GSTR-9A (composition annual)** — export GSTR-4 to Excel (F12 Show breakup of Tax Amount); map sheets 6(TXOS), 7(TXOSA), 4-A&B(B2B), 8A(AT), 5B(CDNR) to Parts I–V incl. period of composition and previous FY turnover. [src](https://help.tallysolutions.com/file-gstr-9a-tally/)
- **GSTR-4 annual (composition)** — tables 4A B2B non-RCM, 4B B2B RCM (from CMP-08 drill), 4C URD inward (Ledger Vouchers with Alt+F12 Range filter, F8 Columnar Show party's GSTIN/UIN), 4D import of services, 5 CMP-08 summary, 6 rate-wise outward/RCM, 7 TDS/TCS credit, 8 tax/interest/late fee, 9 refund — manual portal entry guided by reports. [src](https://help.tallysolutions.com/gstr-4-annual-returns/)

### CMP-08 & GSTR-4 reports (composition)
- **GST CMP-08 report** — Alt+G > CMP-08; Outward Supplies (incl. Exempt) — Taxable/Exempted/Nil Rated sales; Inward Supplies on Which Tax is Payable — Registered Dealer Purchases Liable for RC, Unregistered Dealer Purchases Liable for RC, Import of Service, Advance Payments; F12 Show breakup of Tax Amount; Alt+F5 Detailed; view & direct upload. [src](https://help.tallysolutions.com/gstr-4-annual-returns/)
- **GSTR-4 report** — Incomplete/Mismatch in information bucket; F12 tax breakup; Alt+E Export Excel. [src](https://help.tallysolutions.com/file-gstr-9a-tally/)

## TDS (Income Tax — Tax Deducted at Source)

### Company setup
- **Enable Tax Deducted at Source (TDS)** — F11 (Show more/all features); TDS Deductor Details F12: Show All Deductor types, Enable surcharge and cess details for TDS, Provide alternate contact details (STD, phone, email). [src](https://help.tallysolutions.com/tds-masters-tally/)
- **Deductor fields** — TAN registration number, TAN, Deductor Type, Deductor branch/division, Set/alter details of person responsible. [src](https://help.tallysolutions.com/tds-masters-tally/)
- **Rate & Exemption Details** — Ignore IT Exemption Limit for TDS Deduction (Yes/No); Activate TDS for stock items; Provide surcharge and cess details per deductee status with slabs & applicability dates. [src](https://help.tallysolutions.com/tds-masters-tally/)

### Masters
- **TDS Nature of Payment** — Alt+H Helper list (auto Section & Payment Code); Rate for Individuals/HUF With PAN / Without PAN (propagates to other deductee types); Threshold/exemption limit; F12 Allow transporter category (26Q "Exempt in lieu of PAN"), Allow tax rate without PAN, Allow single bill value (e.g. 194C ₹30,000 single / ₹1,00,000 aggregate), Allow relaxation in rate for Non-Residents (Rule 37BC); Calculate tax on value exceeding the threshold/exemption limit (194Q); Is software royalty (194J/94J); Ctrl+I TDS Details (History) of rate/limit by date. [src](https://help.tallysolutions.com/create-tds-masters/)
- **Income Tax Act 2025 NOP catalogue** — resident list (s.392/393 with payment codes 1004–1067: commission, rent machinery/other, interest securities/senior citizen/other, contractors Ind/HUF vs others, FTS/professional, director fees, dividends, life insurance, purchase of goods 1031, specified senior citizen, benefits/perquisites, e-commerce participants, VDA, lottery/online games/horse race, cash withdrawals, NSS, partners); non-resident list (1039–1057 + winnings). [src](https://help.tallysolutions.com/tds-nature-of-payment-income-tax-act/)
- **TDS duty ledger** — under Duties & Taxes, Type of duty/tax TDS, Nature of Payment. [src](https://help.tallysolutions.com/create-tds-masters/)
- **TDS expense ledger** — Indirect Expenses, Inventory values are affected No, Is TDS Applicable, NOP (or chosen in voucher). [src](https://help.tallysolutions.com/create-tds-masters/)
- **TDS party ledger** — F12 Allow advanced entries in TDS masters; Maintain bill-by-bill; Is TDS Deductable; Deductee Type; Deduct TDS in Same Voucher; Use Advanced TDS Entries (ignore IT/surcharge exemption limits); Set/Alter Zero/Lower Deduction (resident: Zero/Lower Rate per NOP → 26Q; non-resident: Zero/Lower/DTAA → 27Q) with provision, Certificate No./Date, Applicable From/To; bank details; PAN/IT No. or PANAPPLIED / PANINVALID / PANNOTAVBL; Provide PAN Details (PAN Effective Date, Name on PAN). [src](https://help.tallysolutions.com/create-tds-masters/)
- **TDS fixed asset ledger** — Is TDS Deductable, Treat as TDS Expenses (TDS part of expense). [src](https://help.tallysolutions.com/create-tds-masters/)
- **TDS stock item** — Set/Alter TDS details with NOP (requires Activate TDS for stock items). [src](https://help.tallysolutions.com/create-tds-masters/)
- **Is TDS Applicable on GST ledgers** — include/exclude GST from TDS base. [src](https://help.tallysolutions.com/india-gst-account-for-tds-on-purchases-under-gst-tally/)

### Transactions
- **TDS on purchase/expense** — auto TDS on selecting TDS ledger; F12 Modify tax details for TDS; Expense Allocation NOP pick; TDS – Tax Analysis (Ctrl+O, Alt+F5). [src](https://help.tallysolutions.com/tds-on-purchase/)
- **Software purchase** — taxable (194J royalty) vs zero-rated NOP; exempt flagged "S" in 26Q file. [src](https://help.tallysolutions.com/tds-on-purchase/)
- **Expense reversal** — via purchase or Debit Note with TDS Nature of Payment Details. [src](https://help.tallysolutions.com/tds-on-purchase/)
- **TDS on advance payment** — Payment voucher with TDS ledger; third-party advance via Journal. [src](https://help.tallysolutions.com/tds-on-advance-payments/)
- **194C contractors** — 1% Ind/HUF, 2% others, 20% no PAN; single-bill & aggregate thresholds; subsequent bills taxed after crossing. [src](https://help.tallysolutions.com/tds-on-contractor-payments-194c/)
- **Transport (194C)** — no TDS for ≤10 goods carriages + declaration + PAN; Journal with/without TDS. [src](https://help.tallysolutions.com/tds-on-transport-expenses/)
- **194Q purchase of goods** — buyer turnover > ₹10 Cr, seller > ₹50 lakh; 0.1% with PAN / 5% without on excess; single voucher split under Exemption limit + Normal Rate (Rel 5.0+; 4.1- two vouchers); exempt suppliers via Zero/Lower provision 194Q (Govt.)/194Q (NRI); F12 Allow overriding TDS Exemption u/s 206C → Override TDS Exemption u/s 206C. [src](https://help.tallysolutions.com/tds-section-194q/)
- **194R benefits/perquisites** — 10%; purchase benefit, journal TDS booking (F12 Use Cr/Dr instead of To/By), nullify booking, receive TDS from associate. [src](https://help.tallysolutions.com/tds-under-section-194r/)
- **Rule 37BC non-residents** — Relaxation in rate for Non-Residents Yes/No NOPs; 27Q Normal vs Higher Rate. [src](https://help.tallysolutions.com/tds-under-37bc/)
- **TDS on interest** — F11 Enable Interest Calculation; party Activate interest calculation (transaction-by-transaction, override, rate, applicability, rounding, calculate from); Credit Note class Use Class for Interest Accounting; link in 26Q (Alt+L Link All); Journal Ctrl+F Autofill TDS Deduction (Till Date, party, NOP, ledger). [src](https://help.tallysolutions.com/tds-on-interest/)
- **TDS payment** — Payment Ctrl+F Autofill > Stat Payment, Tax Type TDS, Period From/To; TDS paid by another company via Journal; Late Fee payment type with late fee ledger. [src](https://help.tallysolutions.com/tds-payment-and-late-fee-for-tds/)
- **GST-TDS on metal scrap (Notif. 25/2024-CT)** — HSN Ch. 72–81, >₹2.5 lakh, 2% (1+1 or IGST 2%) via Journal; GSTR-7 data via Ledger Vouchers F8 Columnar + F7 Advanced Filter. [src](https://help.tallysolutions.com/gst-tds-on-metal-scrap/)

### Reports & returns
- **Ledgers without PAN** — TDS Reports; F8 All Ledgers; inline PAN entry. [src](https://help.tallysolutions.com/tds-outstanding-challan/)
- **TDS Outstandings** — by NOP; Total Pending, Pending Amount, Due On, Overdue By Days; F5 Party-wise; F12 Show Section Code / Payment Code; Ctrl+B All/Pending/Overdue Bills. [src](https://help.tallysolutions.com/tds-outstanding-challan/)
- **Challan Reconciliation** — F8 Show All; BSR Code, Challan No., Challan Date, Cheque/DD No. & Date; Alt+R Reconcile; recompute return after. [src](https://help.tallysolutions.com/tds-outstanding-challan/)
- **Form 26Q (Form 140 from 1-Apr-2026, Rel 7.1+)** — Included in Return / Not Relevant / Uncertain; uncertain categories: TDS applicability, deductee type, PAN, NOP, TDS rate, zero/lower notification details, NOP mismatch, deduction links, cash transaction details, conflicts, TDS ledger config, bank/challan details, payment links, payment type; Deduction Details (Normal Rate, Higher Rate, Exemption limit, Zero Rated…); TDS Payment Details; Ctrl+J Update TDS Nature of Payment (Alt+H); Alt+B Save Return; Alt+W Recompute → Alt+B Overwrite / Alt+H Save as Revised; Alt+E export .txt (Condensed/Detailed) for FVU; FVU 8.2 field 33 section code, fields 48–53 delimiters; FVU 7.5/7.6 194P fields. [src](https://help.tallysolutions.com/form-26q-tally/)
- **Form 27Q / Form 144** — non-resident return (144 replaces 27Q from 1-Apr-2026); validate & file workflow. [src](https://help.tallysolutions.com/tds-in-tallyprime/)
- **206AB / 206CCA specified person** — higher of 2× rate or 5%; configured via Zero/Lower with Certificate No. 0000; 27EQ remark "I" edited in txt. [src](https://help.tallysolutions.com/configure-specified-person-higher-tax-rate-under-section-206cca/)

## TCS (Tax Collected at Source)

### Setup & masters
- **Enable Tax Collected at Source (TCS)** — F11; TAN registration no., TAN, Collector Type, Collector branch/division, person responsible; TCS Collector Details: Ignore IT Exemption Limit, Provide Surcharge and Cess details (F12 Enable Surcharge and Cess details for TCS; slabs with applicability date per collectee status). [src](https://help.tallysolutions.com/tcs-tallyprime/)
- **Applicability hierarchy** — Stock Group → Stock Item → Ledger Group → Ledger → Transaction; scenarios: accounts-only (sales/income ledger), per-item NOG, stock-group level, sales/income ledgers. [src](https://help.tallysolutions.com/tcs-tallyprime/)
- **TCS Nature of Goods** — Alt+H Helper (Section & Payment code auto); Rate With/Without PAN; Threshold/exemption limit; Tax calculation based on realisation (Yes = on receipt, No = accrual on invoice); Calculate tax on value exceeding Exemption Limit (No = from ₹1); Is Zero Rated; Ctrl+I TCS Details (History). [src](https://help.tallysolutions.com/tcs-tallyprime/)
- **Income Tax Act 2025 NOG list** — s.394(1) codes 1068–1092: alcoholic liquor, tendu leaves, timber (forest lease/other), forest produce, scrap, minerals, motor vehicle >₹10L, luxury goods >₹10L (watches, art, collectibles, yachts/helicopters, sunglasses, handbags, shoes, sportswear, home theatre, horses), LRS remittances (education/medical, other, overseas tour packages), parking lot / toll plaza / mine-quarry use. [src](https://help.tallysolutions.com/tcs-nature-of-goods-income-tax-act/)
- **Party ledger (Sundry Debtors)** — F12 Allow advanced entries in TCS masters; Is TCS Applicable; Buyer/Lessee Type (e.g. Individual/HUF-Resident, Company, Government); Use advanced configurations for TCS (ignore IT/surcharge limits; Override Tax calculation of realisation-based Nature of Goods → accrual per NOG; Set/alter zero/lower rate of collection with provision, Certificate No./Date, From/To); PAN or PANAPPLIED/PANINVALID/PANNOTAVBL. [src](https://help.tallysolutions.com/tcs-tallyprime/)
- **Sales ledger / stock item** — Is TCS Applicable + Nature of Goods; Ctrl+Enter on NOG to view/edit rate; Not Applicable to suppress. [src](https://help.tallysolutions.com/tcs-tallyprime/)
- **TCS duty ledger** — Duties & Taxes, Type TCS, Nature of Goods/Contract/License/Lease. [src](https://help.tallysolutions.com/tcs-tallyprime/)

### Transactions
- **TCS Allocation Details sub-screen** — in sales/receipt: NOG, assessable value prefilled, TCS ledger; aggregation per party across vouchers vs threshold (e.g. ₹50L, 0.1%); F12 Override Tax calculation of realisation-based NOG > Based on Realisation Yes/No. [src](https://help.tallysolutions.com/tcs-tallyprime/)
- **TCS on realisation (receipt)** and **accrual (sales)** and **advance receipt** — liability computed only on excess over threshold. [src](https://help.tallysolutions.com/tcs-tallyprime/)
- **Government buyer exemption** — Buyer/Lessee Government + provision 206C(1H) – Collectees Eligible for Exemption. [src](https://help.tallysolutions.com/tcs-tallyprime/)
- **Buyer-deductible TDS exemption** — F12 Specify exemption from TCS for buyer-deductible TCS; challan later in TDS Challan Details of Buyer (Alt+S Update Details: Challan Number & Date). [src](https://help.tallysolutions.com/tcs-tallyprime/)
- **No-PAN higher rate** — 1% vs 0.1%; Collection at Higher Rate section; Ledgers Without PAN report. [src](https://help.tallysolutions.com/tcs-tallyprime/)
- **206C(1H) omitted from 1-Apr-2025** — workaround: record without TCS ledger / Use TCS Allocations so vouchers fall in Not Relevant. [src](https://help.tallysolutions.com/tcs-changes-in-budget-2020-tally/)
- **206CCA higher rate** — 2× or 5% whichever higher, via zero/lower config (206C Collection at Lower Rate, cert 0000), remark I in 27EQ text. [src](https://help.tallysolutions.com/configure-specified-person-higher-tax-rate-under-section-206cca/)
- **TCS on purchases** — tax ledger Type of duty/tax Others (Duties & Taxes or Current Assets) so not in returns; blank % for manual rates; F12 Calculate tax on current sub-total. [src](https://help.tallysolutions.com/record-tcs-on-purchase/)
- **TCS payment** — Ctrl+F Autofill Stat Payment: Tax Type TCS, Period From, Collected Till Date, Section, NOG, Collectee Status, Residential Status; print ITNS 281 challan (Print as TCS Challan, Filing Date); Late Fee / Interest / Penalty payment types with Indirect Expense ledgers. [src](https://help.tallysolutions.com/tcs-tallyprime/)

### Reports & returns
- **TCS Outstandings** — columns NOG, Company, Non-Company, Total Pending; F5 Party-wise; Ctrl+B Resident Type, Range of Bills; drill Date, Ref No., Party, Opening, Pending, Due On, Overdue By Days. [src](https://help.tallysolutions.com/tcs-tallyprime/)
- **TCS Challan Reconciliation** — Ctrl+B Show All Challan Types; Alt+R Reconcile (Challan No./Date optional per FVU). [src](https://help.tallysolutions.com/tcs-tallyprime/)
- **Form 27EQ (Form 143 from Tax Year 2026-27, Rel 7.1+)** — Included (Booking, Booking with Collection, Collection, Advance Receipt (≤1.1.3), Reversals, Overridden by User); Not Relevant; Uncertain: master (TCS applicability for ledgers/items, collectee type — Ctrl+F4 set, PAN missing, notification for zero/lower, duty ledger NOG — Alt+B, NOG rate/Is Zero Rated) and transaction (TCS category, booking-collection link Alt+L Link All, cash collectee details, collection not linked — Alt+R Auto Fill/Alt+L Full/Alt+V Partial, accepted with conflicts — Alt+J). [src](https://help.tallysolutions.com/tcs-tallyprime/)
- **27EQ lifecycle** — Alt+B Save Return; modified masters/vouchers section; Alt+W Recompute; Alt+B Overwrite / Alt+H Save as Revised; Collection Details (F12 Show PAN Number); TCS Payment Details; Return Transaction Book of saved returns; Alt+E E-Return (SDF fixed width) only after save; FVU with .csi challan file → Form 27A; manual text edits for FVU 7.5/7.6 (fields 70–71) and 8.2 (collectee code field 8, section code 33, fillers 48/50–53, field 49 115BAC Y/N). [src](https://help.tallysolutions.com/tcs-tallyprime/)

## MSME (Udyam / MSMED Act / Form 1)

- **Company MSME Registration Details** — F11 (or Alt+K > Company) > Ctrl+I > MSME Registration Details: Type of Enterprise, UDYAM Registration Number (format UDYAM-SS-XX-YYYYYYY); Effective Date for Revised details; MSME Registration Details (History). [src](https://help.tallysolutions.com/set-up-udyam-regn-details-msme-companies/)
- **Print UDYAM on documents** — print config Show UDYAM Reg No. & Enterprise Type (invoices, orders, reminder letters). [src](https://help.tallysolutions.com/set-up-udyam-regn-details-msme-companies/)
- **Supplier MSME details** — party F12 Provide MSME Registration Details > Set/Alter: Type of Enterprise (Micro/Small/Medium), UDYAM Reg No., Type of Activity, Effective Date; history via Ctrl+I. [src](https://help.tallysolutions.com/set-up-udyam-details-msme-suppliers/)
- **Update Party MSME Details (bulk)** — Alt+G; group/ledger filter; Alt+H Update MSME Details per party; Alt+R Multi Alter columns Default Credit Period, Type of Enterprise, UDYAM Reg No., Effective Date. [src](https://help.tallysolutions.com/set-up-udyam-details-msme-suppliers/)
- **Credit Days Allowed for Micro & Small Parties** — F11 > More Details; default 45 days (statutory). [src](https://help.tallysolutions.com/view-upload-msme-form-1-annexure/)
- **MSME payables due tracking** — Group Outstanding > Sundry Creditors (or Outstandings > Payables); Ctrl+B Show Bills of Micro & Small Parties; Type of Bills: All / Bills Due in Upcoming Days (Show bills due in the next N days) / Overdue / Pending; F12 Show Due on, Show no. of days till Due Date, Show Overdue Days/Bill age, Show Overdue days from Bill Date; penal interest 3× RBI bank rate; MSME Samadhaan. [src](https://help.tallysolutions.com/due-dates-for-payables-to-msme-suppliers/)
- **MSME Form 1 Annexure report** — Rel 6.1+; Alt+G or Statutory Reports > MSME Reports; PAN-wise default (same-PAN suppliers merged; groups Valid PAN / Invalid or No PAN), F8 Ledger-wise / Bill-wise; columns Due On / Credit Days, Allowed Credit Period, Paid Bills, Outstanding Bills, overdue days. [src](https://help.tallysolutions.com/view-upload-msme-form-1-annexure/)
- **Form 1 Ctrl+B options** — Show report details for All Parties / Parties with Valid PAN / Invalid or No PAN; Show Due On date based on MSME Credit Period (Company Features) / Bill-wise Details / whichever is earlier; Exclude Bills Paid & Outstanding within Credit Period; Exclude Parties having only such bills. [src](https://help.tallysolutions.com/view-upload-msme-form-1-annexure/)
- **Form 1 F12 options** — Show Type of Enterprise; Show UDYAM Reg No.; Default period on opening (Earlier Period half-year / Current Period). [src](https://help.tallysolutions.com/view-upload-msme-form-1-annexure/)
- **Export to MCA template** — Alt+E > MSME Form 1 Annexure (PAN-wise summary only, valid-PAN parties only; B back to fix PAN); C configure MCA Template File Name & Folder; template opens prefilled with "<Reason to be updated>" for Paid after 45 days / Outstanding > 45 days; upload on MCA portal (revised webform from 15-Jul-2024). [src](https://help.tallysolutions.com/view-upload-msme-form-1-annexure/)

## Payroll Statutory (Salary TDS, PF, ESI, PT, NPS)

### Salary income tax configuration
- **Payroll Income Tax Configurations** — Alt+G > Alter Master; components: Salary u/s 17(1) (pay head Income Tax Component, Tax Calculation Basis, Deduct TDS Across Period(s)); Perquisites u/s 17(2) Form 12BA single/multi employee (Nature, Effective From, Value, Recovered, Chargeable, Tax paid by employer); Profits in lieu of salary u/s 17(3) by employee/group & regime; Allowances exempt u/s 10; Deductions u/s 16 (Entertainment Allowance, Professional Tax); Other income (house property, other sources, housing-loan interest); Chapter VI-A investments (80C/80CCF/80CCG) and others (80D/80DD/80E); Relief u/s 89/90/91; Advance Tax, Previous Employer TDS, Tax Deducted Other than Salary, Self Assessment Tax. [src](https://help.tallysolutions.com/tax-configuration-tally/)
- **Income Tax Declarations** — Alt+G > Alter Master; regime-aware eligibility; Employee Tax Regime (Regular vs u/s 115BAC; auto effective dates; history); HRA (Effective From, Monthly Rent Declared, Proof, Metro/Non-Metro, Landlord name & PAN or Government/Non-resident); LTA (ledger, Exempt override, amount); Transport Allowance (Physically Challenged/Others); Children Education & Hostel (1 or 2 children); income declared single-employee-multi-component / multi-employee-single-component; investments & others with Declared vs Proof/Eligible vs Qualifying; Condition Others/Senior Citizen/Severe Disability (80D cap logic). [src](https://help.tallysolutions.com/income-tax-declarations-tally/)
- **Tax regime handling** — default Regular; switch to 115BAC from 01-Apr-2020+; multiple switches per year with revision date & recomputation across remaining months; regime shown in IT computation, pay slip, pay sheet, payroll statement, employee profile; slab tables incl. without-PAN rates. [src](https://help.tallysolutions.com/new-tax-regime-under-section-115-bac-tally/)
- **Income Tax Computation report** — per employee; 10. Tax on Total Income drill with slabs; standard deduction new regime; surcharge 25% cap >₹5 Cr; 87A rebate ₹25,000 up to ₹7 lakh; marginal relief ₹7,00,001–7,27,777 (Finance Bill 2023-24, Rel 3.0); std deduction ₹75,000 new regime (FB 2024-25). [src](https://help.tallysolutions.com/itc-report-finance-bill-2023-24/)

### Salary TDS returns & payments
- **Income Tax Challan payment** — Payment Ctrl+F Autofill > Process for Income Tax Challan; Payroll Ledger Income Tax or Not Applicable; Payment Type Penalty/Interest/Late Fee; Provide Details (challan); Print Income Tax Challan. [src](https://help.tallysolutions.com/income-tax-payment-tally/)
- **Form 24Q print** — quarter, responsible person (name, designation, address), date, place, type of deductor; Annexure I every quarter, Annexure II in Q4. [src](https://help.tallysolutions.com/income-tax-form-24q-tally/)
- **Annexure II fields (330–377)** — employee PAN, deductee type (senior/super senior/others), employment period, gross salary 17(1)/17(2)/17(3), other employer salary, exemptions 10(5)/10(10)/10(10A)/10(10AA)/10(13A) with landlord PANs, s.16 deductions, house property, other sources, 80C/80CCC/80CCD(1)/(1B)/(2)/80D/80E/80G/80TTA, total taxable, tax, 87A, surcharge, cess, s.89 relief, net liability, TDS current/other employers, shortfall/excess. [src](https://help.tallysolutions.com/print-annexure-ii-to-24q-tally/)
- **Annexure I** — quarterly, configurable quarter. [src](https://help.tallysolutions.com/print-annexure-i-to-24q-tally/)
- **E-24Q e-return (E-Return Form 138 from Tax Year 2026-27, Rel 7.1+)** — Income Tax Old Forms > E-24Q; SDF fixed width; file ITeTDS.txt; Quarter; Is Regular Return Filed for Previous Period + Receipt/Token No.; responsible person mobile or STD+phone (mandatory), email, Is Change in Address; Appearance of Employee Names; Category (deductor); FVU 7.5/7.6/8.2/8.6 manual text edits (fields 48–53, 70–71, 80–87, standard deduction field). [src](https://help.tallysolutions.com/payroll-e24q-e-returns-tally/)
- **TDS Variance (payroll)** — month-wise actual vs payable per employee/group; drill to employee & payroll voucher; also via Statutory Summary Ctrl+J. [src](https://help.tallysolutions.com/tds-variance-tally/)
- **Other salary IT reports (titles only)** — Form 16, Form 12BA, Form 27A, Form ITR-1, PAN Not Available, Salary Projection, Challan Reconciliation. [src](https://help.tallysolutions.com/tally-prime/payroll/payroll-statutory-reports/payroll-income-tax-reports/)

### PF / ESI / NPS / PT
- **Employer contributions** — Payroll voucher Ctrl+F Autofill: PF Contribution / ESI Contribution / NPS Contribution; PF admin via Journal Autofill PF Other Charges: Admin Charges (A/c 2), EDLI Contribution (A/c 21), EDLI Admin Charges (A/c 22). [src](https://help.tallysolutions.com/pf-process-tally/)
- **Payroll Statutory Summary** — PF, ESI, NPS, PT payable vs paid; Statutory Pay Head Details drill. [src](https://help.tallysolutions.com/payroll-statutory-summary-tally/)
- **Professional Tax Computation Report** — employer details, PT registration certificate no., slab rows: no. of employees, rate/month, tax deducted. [src](https://help.tallysolutions.com/professional-tax-computation-report-tally/)
- **Professional Tax Monthly Statement** — Employee No., Name, Worked Days, Gross Wages, PT value; filters category/group/sort/display name. [src](https://help.tallysolutions.com/professional-tax-statement-tally/)
- **PF/ESI/NPS report titles** — PF Forms 3A, 5, 6A, 10, 12A, Monthly Statement PF, E-Challan Return (ECR); ESI Form 3 & E-Return, Form 5, Form 6, Monthly Statement ESI; NPS Summary, PRAN Not Available, Subscriber Contribution Details; Gratuity Summary; Other Records. [src](https://help.tallysolutions.com/payroll-statutory-reports/)

## GST Validations, Conflicts & Error Resolution (implied rules)

- **Company GSTIN invalid/missing** — blocks returns; fix in F11 GST Details, then Y to update transactions and "Apply changes from: Master to Transaction". [src](https://help.tallysolutions.com/gst-registration-details-are-invalid-not-specified/)
- **Party GSTIN invalid / Invalid Supplier / Consignee GSTIN** — fix via Alt+L fetch, single ledger edit, or Update Party GSTIN group-wise. [src](https://help.tallysolutions.com/company-invalid-gstin/)
- **Invoice date before buyer's registration date** — treat as B2C; create new party with GSTIN from registration date. [src](https://help.tallysolutions.com/date-is-invalid-the-invoice-date-cannot-be-before-the-registration-date/)
- **IGST mandatory for interstate** — triggered by overridden nature / changed PoS; s.7 IGST supplies (courier) need "Supplies under section 7 of IGST Act". [src](https://help.tallysolutions.com/igst-is-mandatory-for-interstate-supply-and-cgst-sgst-should-not-be-present/)
- **Bank charges with GST** — bank treated Unregistered by default; Rel 5.1+ set bank Registration Type Regular via Provide GST details > Party Details. [src](https://help.tallysolutions.com/incorrect-registration-type-or-tax-ledger-is-selected-in-the-bank-transaction/)
- **HSN rules** — goods HSN starts 01–98 with Type of Supply Goods; services SAC starts 99 with Type Services; 6-digit mandatory ≥ ₹5 Cr; errors "Invalid HSN Code", "Description not available", "Mismatch between HSN/SAC and Type of Supply". [src](https://help.tallysolutions.com/invalid-hsn-sac-and-description/)
- **Master–transaction conflicts** — Alt+W Update as per Masters (bulk); Alt+V Ignore Conflicts (→ Ctrl+J Vouchers Ignored for Conflicts); per voucher "Apply changes from" Master to Transaction / Transaction to Master with Effective Date. [src](https://help.tallysolutions.com/mismatch-in-gst-registration-details/)
- **Export nil-rated JSON WPAY→WOPAY** — manual JSON fix for "Please enter some value in IGST tax amount". [src](https://help.tallysolutions.com/please-enter-some-value-in-igst-tax-amount-field-export-sales-transactions/)
- **Composition modified values** — CMP-08 uncertain "Taxability, Reverse Charge Applicability, Taxable Value, Rate of Tax Modified in Voucher": Alt+R Resolve / Alt+J Accept as is. [src](https://help.tallysolutions.com/rate-of-tax-modified-in-voucher/)
- **Composition purchases with interstate nature** — exception; fix State, Reg Type, GSTIN. [src](https://help.tallysolutions.com/purchase-composition-dealers-interstate/)
- **Interstate supply by composition dealer** — CMP-08 uncertain; set party state = company state. [src](https://help.tallysolutions.com/interstate-supply-by-composition-dealers-is-not-allowed/)
- **Override confirmation pattern** — on save with deviations: O (override, treated valid) vs Y (accept → appears as exception). [src](https://help.tallysolutions.com/how-to-override-assessable-value-hsn-code-party-details-cess-valuation-method-in-sales-invoice/)

## Regulatory reference points cited (Tally blog, for parameter defaults)

- **e-Invoice applicability** — aggregate turnover > ₹5 Cr in any FY since 2017-18 (from 1-Aug-2023; started ₹500 Cr Oct-2020). [src](https://tallysolutions.com/gst/e-invoicing-faqs/)
- **GSTR-1 due dates** — 11th monthly; 13th for QRMP quarterly (IFF monthly). [src](https://tallysolutions.com/gst/gstr1-filing-format-due-date/)
- **GST registration threshold** — ₹40 lakh goods (₹10 lakh special category states); mandatory for interstate/e-commerce sellers. [src](https://tallysolutions.com/gst/gst-registration/)
- **Composition limits** — goods turnover < ₹1.5 Cr (₹75 lakh special category), services < ₹50 lakh; rates 1%/5% (restaurant 5%); no ITC, no interstate outward, Bill of Supply only. [src](https://help.tallysolutions.com/prerequisite-for-using-gst-composition/)

## Legacy / other statutory (brief)

- **VAT/CST (legacy India VAT)** — F11 Enable Value Added Tax; Company VAT Details: State, TIN, Inter-state Sales Tax No., tax/rate details, CST rate Against Form C; VAT applicable from, Periodicity of e-VAT Annexures, LVO/VSO code, authorised person; VAT/CST duty ledgers; rate setup at company/group/ledger/item levels. [src](https://help.tallysolutions.com/defining-tax-rates-at-company-level/)
- **Service Tax (legacy)** — payment voucher with Swachh Bharat Cess & Krishi Kalyan Cess, challan Payment Details; voucher classes for accounting/item invoices with service tax additional ledgers. [src](https://help.tallysolutions.com/service-tax-voucher-class-for-sales-accounting-invoice-tally/)
- **Union Territory changes** — Dadra & Nagar Haveli and Daman & Diu merged UT name auto-updated (Rel 6.6.3 per page); UT merger ITC reversal/reclaim journals. [src](https://help.tallysolutions.com/defining-tax-rates-at-company-level/)

Irrelevant/unreadable/out-of-scope files: credible_response_for_connected_gst_ & directly_upload_download_file_gstr_1_from_tallyprime_ (login-walled, no content); manage_user_access_and_account_settings_, user_access_ (connected banking), two_sets_of_users_accessing_two_sets_of_data_, unable_to_access_the_restore_data_path_to_restore_ (non-statutory); reverse_charge_mechanism_on_electronic_devices_, record_transactions_with_e_invoice_details_ (UAE VAT), tax_rate_setup_ (Kenya eTIMS); gstr_1_rel_2_1_earlier_, raise_liability_claim_itc_2_1_, e_way_bill_in_tallyprime_up_to_release_1_1_4_, tcs_changes_in_budget_2020_tally_ (superseded releases, only skimmed); tally_prime_gst_reports_gstr_1_report_in_tallyprime_ & gst_purchase_manage_ims_inward_supplies_ & sales_process_tally_ (duplicates); tallysolutions_com_gst_* blog pages (statutory explainers, only threshold facts used); tallysolutions_com_gst_software_ (empty marketing stub).


# TallyPrime — Inventory, Sales/Purchase Process & Payroll

## Inventory & Sales/Purchase Process

### Cost centres / profit centres (used for job costing & expense allocation)
- **Cost Centre master** — Alt+G > Create Master > Cost Centre; fields Name, aliases (multiple), language aliases, Under (Primary or another cost centre → hierarchy), Category; prompts to activate feature if inactive. [src](https://help.tallysolutions.com/accounting-and-inventory/cost-centre-or-profit-centre-tally/)
- **Cost Centre F12 options** — Provide aliases for Name; Provide language aliases; Use grouping for Cost Centres; Set Opening Balance for Revenue Items in Reports; Set Bank details for Cost Centres; Provide E-mail ID. [src](https://help.tallysolutions.com/accounting-and-inventory/cost-centre-or-profit-centre-tally/)
- **Cost Centre allocation in vouchers** — Cost Centre Allocations sub-screen after ledger amount (Name of Cost Centre + Amount, total must be allocated); ledger option "Cost centres are applicable" default Yes for income/expense, No for asset/liability ledgers. [src](https://help.tallysolutions.com/accounting-and-inventory/cost-centre-or-profit-centre-tally/)
- **Cost Category (parallel allocation)** — default internal "Primary Cost Category" (renamable); create new with Allocate Revenue Items / Allocate Non-revenue Items (≥1 mandatory); same expense split across categories (e.g., Employees and Sales Schemes). [src](https://help.tallysolutions.com/accounting-and-inventory/cost-centre-or-profit-centre-tally/)
- **Cost Centre Class** — F11 > Ctrl+I (More Details) > Cost Centre Class; predefined % allocation per category/centre; enable in voucher via F12 "Select Cost Centre/Class"; auto-allocates on voucher save. [src](https://help.tallysolutions.com/accounting-and-inventory/cost-centre-or-profit-centre-tally/)
- **Multi-master create/alter** — create/alter multiple cost centres/categories/groups from Chart of Accounts (Alt+H Multi-Masters); copy masters to another open company via F3 (Company) during alteration. [src](https://help.tallysolutions.com/accounting-and-inventory/cost-centre-or-profit-centre-tally/)
- **Disable cost centres** — per ledger (Cost centres are applicable = No) or all ledgers (Ledger F12 "Apply Cost Centres for Ledgers" = No); deletion blocked while allocations exist. [src](https://help.tallysolutions.com/accounting-and-inventory/cost-centre-or-profit-centre-tally/)
- **Cost centre reports** — Ledger Vouchers with F12 Format Detailed + Show Cost Centre details; Cost Centre Break-up (ledger-group-wise; Alt+C New Column, Alt+N Auto Column incl. company-wise, Alt+A/Alt+D alter/delete column, F12 include opening balance); Cost Centre Summary (Alt+F5 detailed); Cost Centre Monthly Summary (drill to Cost Centre Vouchers; Ctrl+H change view); Cost Category Summary (Ctrl+B scale factor). [src](https://help.tallysolutions.com/accounting-and-inventory/cost-centre-or-profit-centre-tally/)

### Groups (used for additional-cost appropriation)
- **Group master options** — Nature of Group (Assets/Liabilities/Income/Expenses, only under Primary); Does it affect Gross Profits; Group behaves like a sub-ledger; Nett Debit/Credit Balances for Reporting; Used for calculation (taxes/discounts); Method to allocate when used in purchase invoice: Not Applicable / Appropriate by Qty / Appropriate by Value. [src](https://help.tallysolutions.com/accounting-and-inventory/groups-in-tallyprime/)
- **Group deletion rules** — cannot delete if it has sub-groups, ledgers, or is predefined; Alt+D in alteration. [src](https://help.tallysolutions.com/accounting-and-inventory/groups-in-tallyprime/)

### Inventory master capabilities (index page)
- **Units of Measure** — create unit; increase/decrease number of decimal places of a unit. [src](https://help.tallysolutions.com/accounting-inventory/)
- **Stock groups/items** — create stock groups, sub-groups, items under groups; delete unused stock items (multiple at once; blocked when used). [src](https://help.tallysolutions.com/accounting-inventory/)
- **Opening quantity bulk removal** — remove opening quantity from multiple/all stock items at once; update opening quantity. [src](https://help.tallysolutions.com/accounting-inventory/)
- **Stock-in-Hand ledger** — specify opening/closing stock value manually via Stock-in-Hand ledger (when accounts not integrated with inventory). [src](https://help.tallysolutions.com/accounting-inventory/)
- **Alternate units** — variable quantities, seepage/quantity variation handling. [src](https://help.tallysolutions.com/accounting-inventory/)
- **Barcodes on stock items** — specify barcode in stock item; scan/use during voucher creation. [src](https://help.tallysolutions.com/accounting-inventory/)

### Additional cost of purchase (landed cost)
- **Ledger "Method of appropriation in purchase invoice"** — Appropriate by Qty / Appropriate by Value; shown via Ledger F12 "Select Appropriation Methods to allocate Additional Costs" = Yes. [src](https://help.tallysolutions.com/additional-cost-of-purchase/)
- **Item Invoice mode** — after items (End of List) add additional expense ledger with Rate in %-age or direct Amount; apportioned to items. [src](https://help.tallysolutions.com/additional-cost-of-purchase/)
- **Voucher mode** — Purchase voucher type "Track Additional Cost for Purchases" = Yes; Inventory Allocations screen → "Additional Cost Details for <item>" sub-screen (ledger, %-age, Amount). [src](https://help.tallysolutions.com/additional-cost-of-purchase/)
- **Landed value in Stock Summary** — rate/value include apportioned additional cost (e.g., 3000 + 60). [src](https://help.tallysolutions.com/additional-cost-of-purchase/)

### Bilingual / Arabic invoice printing (Rel 6.0)
- **Arabic/bilingual Sales & POS invoices** — F11 Mailing details in local language; ledger/stock item language aliases; voucher type Default title + Set/alter declaration in Arabic. [src](https://help.tallysolutions.com/bilingual-invoice-printing/)
- **Print config** — Use Simple Invoice format (default No = commercial); Print Type Single (Print Language English/Arabic) or Bilingual; Show Amount in words in Arabic; Show Numerals in Arabic; Show Amount in words in English; Footer "Generated by" text; format fixed to Format 1 when tax disabled. [src](https://help.tallysolutions.com/bilingual-invoice-printing/)

### Consignment
- **Godown third-party flags** — Godown F12 "Enable third party stock details"; options "Our stock with third party" (principal) and "Third party stock with us" (agent). [src](https://help.tallysolutions.com/consignment-transactions-tally/)
- **Principal flow** — Material Out to agent (Destination Godown = our-stock-with-third-party godown); Sales invoice from that godown on agent intimation; Receipt Agst Ref; Material In for unsold returns (Source Godown). [src](https://help.tallysolutions.com/consignment-transactions-tally/)
- **Agent flow** — Material In from principal (Source Godown Not Applicable, into third-party-stock-with-us godown); Sales from that godown; Journal for amount payable to principal (New Ref bills); Payment Agst Ref; Material Out for return. [src](https://help.tallysolutions.com/consignment-transactions-tally/)
- **Material In / Material Out voucher types** — F10 (Other Vouchers); activate if inactive. [src](https://help.tallysolutions.com/consignment-transactions-tally/)
- **Sale of fixed assets** — Accounting Invoice with fixed-asset ledger; journal for profit/loss on sale. [src](https://help.tallysolutions.com/consignment-transactions-tally/)
- **Sales voucher F12 configurations** — Provide Buyer details; Provide Dispatch, Order, and Export details; Use default Bill-wise details for Bill Allocation; Provide Additional Descriptions for Ledgers; Use Voucher No. as Bill Reference; Modify all fields during voucher entry; Provide Reference No. and Date; Skip the Date field; Warn when Voucher No. exceeds 16 characters (not exported to e-returns); Show Turnover from selected Party A/c; Show Current Balance of Ledgers; Show final Ledger Balance; Use default Bank Allocation. [src](https://help.tallysolutions.com/consignment-transactions-tally/)

### Foreign-currency invoices
- **Sales/Purchase in foreign currency** — enter rate with currency symbol (e.g., $25); Forex Rate of Exchange sub-screen; Last Voucher Rate takes precedence over Specified Rate. [src](https://help.tallysolutions.com/create-sales-voucher-with-foreign-currency-and-print-invoice-in-tallyprime/)
- **Print "Show Base & Foreign Currency for Total"** — invoice total in both currencies. [src](https://help.tallysolutions.com/create-sales-voucher-with-foreign-currency-and-print-invoice-in-tallyprime/)
- **Purchase with foreign currency** — same flow in F9; Ctrl+H select mode. [src](https://help.tallysolutions.com/create-purchase-voucher-with-foreign-currency/)

### Debit note for post-sale price increase
- **Price hike debit note** — F10 > Debit Note, Item Invoice; Dispatch Details > Original Invoice No./Date; item without Qty/Rate, Amount = differential; tax ledgers; Provide GST details with reason; reported in GSTR-1 Credit/Debit Notes. [src](https://help.tallysolutions.com/debit-note-post-sales-price-hike/)

### Sales FAQ items
- **Stock Query from voucher (Alt+S)** — after party & item, shows previous sales qty/rate to that party. [src](https://help.tallysolutions.com/faq-sales/)
- **Bill-wise in invoices** — F11 Enable Bill-wise entry; ledger Maintain balances bill-by-bill; F12 Use default Bill-wise details = No to prompt allocation. [src](https://help.tallysolutions.com/faq-sales/)
- **Sorting Method for Pending Bills in Vouchers (Rel 5.0)** — Agst Ref list sorted by due date etc. [src](https://help.tallysolutions.com/faq-sales/)
- **Discount column** — F11 Use Discount column in invoices. [src](https://help.tallysolutions.com/faq-sales/)
- **Show closing qty in List of Stock Items** — F1 > Settings > Display > "Display List of Stock Items without quantity in Vouchers" = No. [src](https://help.tallysolutions.com/faq-sales/)
- **Common sales ledger field** — F12 "Select common Ledger Account for Item Allocation"; hidden in accounting-invoice voucher class. [src](https://help.tallysolutions.com/faq-sales/)
- **Order No(s) in Party Details** — link pending sales order while invoicing. [src](https://help.tallysolutions.com/faq-sales/)
- **Warn on negative Stock Balance** — sales voucher F12 Yes/No. [src](https://help.tallysolutions.com/faq-sales/)
- **Print: 2 invoices per page** (Pages per Sheet = 2); Default title to print (e.g., "Tax Invoice"); Number of copies + Type of Copy (Original/Duplicate…/All); Show Name and Address from Party master; Order and Dispatch Details > Show Dispatch/Order Details. [src](https://help.tallysolutions.com/faq-sales/)
- **Dot-matrix date fix / custom paper** — custom paper 850/900 × 1200 for dot matrix when date prints as *****. [src](https://help.tallysolutions.com/faq-sales/)
- **POS printer full party name** — Printer > Advanced > Graphic Resolution 160×144 or 80×72. [src](https://help.tallysolutions.com/faq-sales/)
- **Print without saving** — Print Format Dot Matrix or Quick/Draft; Print to File = No. [src](https://help.tallysolutions.com/faq-sales/)
- **Cost centres never printed on invoices** (internal only). [src](https://help.tallysolutions.com/faq-sales/)
- **POS: no bill-wise details** — spot payment assumed; use Sales invoice for credit. [src](https://help.tallysolutions.com/faq-sales/)
- **POS tax-inclusive class** — voucher class under POS voucher type with inclusive-rate sales/tax ledgers; tax back-calculated and hidden on print. [src](https://help.tallysolutions.com/faq-sales/)
- **POS hardware limits** — no cash-register support; no pole display / external hardware interface. [src](https://help.tallysolutions.com/faq-sales/)
- **Order process tracking workaround** — godowns as processes + batch numbers as order numbers; Godown Summary Alt+N auto-column by godowns. [src](https://help.tallysolutions.com/faq-sales/)
- **Columnar Purchase/Sales Orders Book** — F8 (Columnar) with configurable columns. [src](https://help.tallysolutions.com/faq-sales/)
- **Credit limit warning on sales order** — ledger F12 Provide Credit Limits; Check for credit days during voucher entry; Specify credit limit; warning but can proceed. [src](https://help.tallysolutions.com/faq-sales/)
- **Re-open pre-closed order qty** — Order Details Alt+F5 > open pre-closing voucher > Spacebar removes Pre-Close Quantity. [src](https://help.tallysolutions.com/faq-sales/)
- **Delivery note optional** — invoice can itself be the delivery note (Tracking Number = Not Applicable); partial cancel via negative-quantity delivery note or Rejection In. [src](https://help.tallysolutions.com/faq-sales/)
- **Skip ledger allocation in Delivery Note / Orders** — F12: Select common Ledger Account for Item Allocation = No; Provide Accounting Allocations in Order/Delivery Note = No. [src](https://help.tallysolutions.com/faq-sales/)
- **Barcode scanning** — any standard scanner (keyboard wedge); scan into stock item Alias; scan into Name of Item during billing auto-selects item. [src](https://help.tallysolutions.com/faq-sales/)
- **Salesperson-wise sales** — in-store: salespersons as cost centres; field: salesman sub-groups under Sundry Debtors → Group Outstandings/Group Summary; Cost Centre Breakup of Ledger / of Group. [src](https://help.tallysolutions.com/faq-sales/)
- **Hold invoice & resume** — Alt+G > Create Voucher opens nested voucher on top; saving returns to unfinished invoice. [src](https://help.tallysolutions.com/faq-sales/)
- **Agent commission tracking** — Commission cost category + agent cost centres; Category Summary. [src](https://help.tallysolutions.com/faq-sales/)
- **Price list usage** — F11 Enable multiple Price Levels; create Price Levels; Price List (Stock Group) for All Items; per level: Applicable From, quantity slabs, discount. [src](https://help.tallysolutions.com/faq-sales/)
- **Sales Profitability report** — estimated cost of sale per day; Avg Cost: qty × yearly inward value/qty to date; Monthly Avg: (opening + month inward)/(qty); FIFO/LIFO/Last Purchase/Standard: qty × closing rate on sale day (fallback avg if nil). [src](https://help.tallysolutions.com/faq-sales/)
- **Cancel voucher** — Alt+X in Day Book or alteration; multi-select with Spacebar to cancel many. [src](https://help.tallysolutions.com/faq-sales/)

### Godowns / locations
- **Godown master** — Alt+G > Create Master > Godown; Name, multiple aliases, Under (Primary / Main Location / other → hierarchy); internal default godown "Main Location" (renamable) holds all stock until godowns created; F11 Maintain Multiple Godowns. [src](https://help.tallysolutions.com/inventory-storage-using-godowns-locations-tally/)
- **Allow storage of materials** — No for parent/region godowns so they don't appear in allocation. [src](https://help.tallysolutions.com/inventory-storage-using-godowns-locations-tally/)
- **Godown address** — printed on invoices/stock journals via print config Show godown name / Show godown address. [src](https://help.tallysolutions.com/inventory-storage-using-godowns-locations-tally/)
- **Third-party stock flags** — Our stock with third party / Third party stock with us (job work & consignment). [src](https://help.tallysolutions.com/consignment-transactions-tally/)
- **Godown deletion rules** — only if no stock, unused in transactions, not a parent. [src](https://help.tallysolutions.com/inventory-storage-using-godowns-locations-tally/)
- **On-the-fly master creation** — Alt+C in fields; Ctrl+G stock group, Ctrl+I stock item, Ctrl+U unit from godown screen; Page Up/Down navigate masters. [src](https://help.tallysolutions.com/inventory-storage-using-godowns-locations-tally/)
- **Multi Godown Creation** — Chart of Accounts > Alt+H Multi-Masters > Multi Create; common parent or per-row parent (All Items). [src](https://help.tallysolutions.com/inventory-storage-using-godowns-locations-tally/)
- **Godown allocation** — Stock Item Allocation sub-screen in vouchers & opening balance; split one purchase across godowns; opening balance must be fully allocated; each godown valued as independent lot (affects averages). [src](https://help.tallysolutions.com/inventory-storage-using-godowns-locations-tally/)

### Stock Journal, transfers & inventory vouchers
- **Stock Journal (Alt+F7)** — Source (Consumption) and Destination (Production) sides with item, godown, qty, rate, amount (prefilled; different rates allowed per side); inter-location transfer, wastage/shortage adjustment, conversion. [src](https://help.tallysolutions.com/inventory-entry-tally/)
- **Stock Journal additional cost** — voucher type "Track Additional Costs for Purchases" = Yes → Additional Cost Details (Type of Cost ledger, %-age, Amount). [src](https://help.tallysolutions.com/inventory-entry-tally/)
- **Stock Journal F12** — Skip the Date field; Provide Reference No. and Date (also per-voucher via Ctrl+I More Details); Provide Additional Descriptions for Stock Items; Show message on negative Stock Balance (default Yes); Use Expired Batches (default shown); Show Batches with Zero Quantity; Show Balance as on Voucher Date; Skip Co-product/By-Product/Scrap details (mfg journal); Show Compound Unit based on Rate; Show details of Compound Unit (e.g., 12 Kgs 250 gms). [src](https://help.tallysolutions.com/inventory-entry-tally/)
- **Stock Journal voucher class "Use Class for Inter-Godown Transfers"** — enter destination godown once; items/batches mirrored with batch no., rate, value. [src](https://help.tallysolutions.com/inventory-entry-tally/)
- **Transfer Journal mode** — Ctrl+H (Change Mode) "Use for Inter-Godown Transfers" presets destination godown; print shows destination location at top. [src](https://help.tallysolutions.com/inventory-storage-using-godowns-locations-tally/)
- **Interstate transfer under GST** — treat as sale. [src](https://help.tallysolutions.com/inventory-entry-tally/)
- **Physical Stock voucher (Ctrl+F7)** — item, godown, batch, Physical Stock qty; difference auto-posted as inward/outward; F12 Skip Date, Additional Descriptions. [src](https://help.tallysolutions.com/inventory-entry-tally/)
- **Delivery Note / Receipt Note / Rejection In / Rejection Out** — Rejection In after delivery note but before sales invoice (else credit note); Rejection Out after receipt note before purchase (else debit note). [src](https://help.tallysolutions.com/inventory-entry-tally/)
- **Order flows supported** — PO > Receipt Note > Purchase or PO > Purchase; SO > Delivery Note > Sales or SO > Sales. [src](https://help.tallysolutions.com/inventory-entry-tally/)
- **Material In / Material Out** — job work & consignment movements. [src](https://help.tallysolutions.com/inventory-entry-tally/)
- **Manufacturing Journal** — finished goods, co-products, by-products, scrap. [src](https://help.tallysolutions.com/inventory-entry-tally/)

### Sales Register
- **Sales Register** — Alt+G > Sales Register; month-wise, drill to Voucher Register; F2 period; Ctrl+H periodicity (daily/weekly/fortnightly/monthly…); F4 switch voucher type register; F12 percentages, averages, closing balances. [src](https://help.tallysolutions.com/how-to-work-with-sales-register-in-tallyprime/)
- **Columnar Register (F8)** — Show party's address, voucher type, GSTIN, PAN, port code; Type of Column: All items (automatic columns) / All items (one column) / Group / Ledger / Related accounts / Related items. [src](https://help.tallysolutions.com/how-to-work-with-sales-register-in-tallyprime/)
- **Extract (Alt+F8)** — ledger-grouped breakdown; F12 Show Inventory-Wise Extract. [src](https://help.tallysolutions.com/how-to-work-with-sales-register-in-tallyprime/)
- **Show Profit (F7) / Show Gross Profit Estimates** — Transaction Value, Gross Revenue, Cost, Gross Profit per invoice; F12 "Show Cost based on Stock Valuation" to match Stock Summary/P&L. [src](https://help.tallysolutions.com/how-to-work-with-sales-register-in-tallyprime/)
- **New Column / Auto Column** — compare periods/companies/voucher types; auto-repeat Daily/Weekly/Monthly/Quarterly/Half-yearly/Yearly with Show Total column. [src](https://help.tallysolutions.com/how-to-work-with-sales-register-in-tallyprime/)

### Godown Summary report
- **Godown/Location Summary** — Alt+G > Godown Summary; hierarchy consolidation; qty/rate hidden when mixed UoMs. Shift+Enter explode, Alt+F5 detailed, Ctrl+Enter alter master. [src](https://help.tallysolutions.com/godown-summary-tally/)
- **Godown Summary buttons** — F2 period, F3 company, F4 godown, F7 Show Profit, Ctrl+B Basis of Values (scale factor; valuation method LIFO/FIFO/Avg Price), Ctrl+H Change View (Monthly Summary), Ctrl+J Exception Reports (Negative Stock Items), Alt+F12 Range filter, Ctrl+F12 Value filter, Alt+C/Alt+N/Alt+A/Alt+D columns. [src](https://help.tallysolutions.com/godown-summary-tally/)
- **Godown Summary F12** — Show Quantities; Show Rates; Show Values; Show Opening Balance; Show goods inwards; Show goods outwards; Show Closing Balance; Show All Items (incl. zero balance) (default No); Exclude Items With No Transactions (default Yes); Show Gross Value for Outwards; Show Consumption & Gross Profit; Show Gross Profits on Gross Value; Show using Alternate Units; Show Tail Units of Compound Units; Appearance of Stock Item Names (alias/part no./name combos); Appearance of Names; Scale factor; Show base currency symbol; Sorting method; Expand all levels in detailed format. [src](https://help.tallysolutions.com/godown-summary-tally/)
- **Godown type-wise view** — All types / Our stock and third-party stock with us / Our stock with third party / Our stock with us / Our stock with us and third party / Third party stock with us (also in Stock Summary, Ageing). [src](https://help.tallysolutions.com/godown-summary-tally/)
- **Godown Monthly Summary** — F4 item; Alt+F5 Monthly/Quarterly; F7 profit. **Godown Vouchers** — F4 godown, F5 batch, F6 Daily, F7 profit. [src](https://help.tallysolutions.com/godown-summary-tally/)

### Inventory reports overview
- **Report list** — Stock Summary, Godown Summary, Movement Analysis, Stock Ageing Analysis (user-defined slabs, batch expiry), Stock Query (alias, part no., group, category, closing qty, cost price, std selling price, costing & market valuation method, last sale/purchase), Physical Stock Register, Stock Cost Estimation, Inventory Reorder Status. [src](https://help.tallysolutions.com/inventory-reports-tally/)
- **Stock Category** — parallel grouping alongside Stock Groups for analysis. [src](https://help.tallysolutions.com/inventory-tally/)
- **Item cost tracking** — accumulate costs/revenue for a quantity across manufacture/purchase/sale (F11 Enable Cost Tracking). [src](https://help.tallysolutions.com/inventory-tally/)

### Job costing
- **Enable Job Costing** — F11 > Enable Job Costing (Show more features); prerequisites Enable Cost Centres + godowns. [src](https://help.tallysolutions.com/job-costing-tally/)
- **Cost centre "Use for job costing"** — cost centre F12 "Set Job Costing for Cost Centres"; only such centres appear in Job Work Analysis. [src](https://help.tallysolutions.com/job-costing-tally/)
- **Godown "Set job/project for job costing"** — link godown to cost centre/project; F12 Allow storage of materials + Set Job Costing details. [src](https://help.tallysolutions.com/job-costing-tally/)
- **Stock Journal classes for projects** — "Use Class for Inter-Godown Transfers" (Transfer) vs "Use Class for Job Costing Consumption" (Consumption; source and destination items must differ). [src](https://help.tallysolutions.com/job-costing-tally/)
- **Project allocation in vouchers** — purchase (As Voucher) item allocation → Cost Centre Allocations per project; item invoice uses Cost Centre/Classes field; journal accruals and payments with Cost Centre/Classes; sales revenue allocated to project. [src](https://help.tallysolutions.com/job-costing-tally/)
- **Job Work Analysis report** — Alt+G > Job Work Analysis > select job/project; Revenue (Income), Cost (Expenses), Nett Profit/Loss; Ctrl+B scale factor; Ctrl+H Monthly Summary / Breakup of Job/Project / Job/Project Summary; Ctrl+J Negative Ledgers; Alt+C compare projects side-by-side; Alt+N auto columns. [src](https://help.tallysolutions.com/job-costing-tally/)

### Job work (principal manufacturer & job worker)
- **Enable Job Order Processing** — F11 (Show More/All Features) > Enable Job Order Processing; can be disabled later. [src](https://help.tallysolutions.com/job-work-setup/)
- **Stock item roles** — raw material; finished goods without BoM (e.g., painting); finished goods with BoM (components); scrap/by-product/co-product items. [src](https://help.tallysolutions.com/job-work-setup/)
- **BoM in stock item** — F12 Show All > "Set Components List (Bill of Materials) in Stock Items"; Set components = Yes; Name of BOM; Unit of manufacture; component Item & Quantity; multiple BoMs per item. [src](https://help.tallysolutions.com/job-work-setup/)
- **Material Out voucher type setup** — Activate; Use for Job Work; Use for Job Work In (Yes for job worker / No for principal); Allow zero-valued transactions (via F12 "Use zero-valued transactions in Voucher Types"). [src](https://help.tallysolutions.com/job-work-setup/)
- **Material In voucher type setup** — Use for Job Work / Use for Job Work In; principal option "Allow consumption" (Yes = auto-consume raw materials on receipt of finished goods; No = record consumption separately). [src](https://help.tallysolutions.com/job-work-setup/)
- **Party ledgers** — job worker under Sundry Creditors; principal under Sundry Debtors; godowns per job worker / principal. [src](https://help.tallysolutions.com/job-work-tally/)
- **Job Work In Order (job worker)** — F10 > Job Work In Order; Dispatch Details (Dispatched through, Destination, Carrier Name/Agent, Bill of Lading/LR-RR No., Date, Motor Vehicle No., Mode/Terms of Payment, Duration of Process, Nature of Processing); Order No.; Item Allocations: Track Components (Yes for BoM → Component Allocations), Due on, Godown, Qty, Rate. [src](https://help.tallysolutions.com/job-worker/)
- **Material In against order** — Order Details: Order No(s), Other References, Terms of Delivery, Dispatch Doc No.; items prefilled from BoM; Destination Godown. [src](https://help.tallysolutions.com/job-worker/)
- **Manufacturing Journal for job work** — Name of product, Name of BOM (BoM List if many), quantity; components auto; % of Cost allocation; Type of Additional Cost + percentage; Effective Cost; Effective rate of primary item. [src](https://help.tallysolutions.com/job-worker/)
- **Material Out of finished goods** — against job order; then Sales invoice for job work service (partial deliveries supported) and Receipt. [src](https://help.tallysolutions.com/job-worker/)
- **Job worker reports** — Job Work In Orders (Shift+Enter, F8 columnar; no accounting impact); Job Work Order Summary (Ordered vs Balance qty; F5 party-wise; F12 Show Outstanding / Show Cleared Job Orders); Job Work Components Order Summary; Job Work In Orders Book (columnar); Material In Register & Material Out Register (F8 Columnar, Alt+F8 Extract); Material Movement Register; Stock From Party; Receipt Variance Analysis; Issue Variance Analysis (Ctrl+B Show Goods delivered but orders not raised); Stock Ageing Analysis (F6 Ageing Period). [src](https://help.tallysolutions.com/job-worker/)
- **Material Movement Register columns** — Order Number, Date of Receipt, Customer's Delivery Challan, Description of Goods Received, Quantity Received, Process Loss, Nature of Process Required, Quantity Processed Goods Returned, Quantity Issued, Wastage/Scrap at end of Job Work, Job Worker's Challan No. & Date, Remarks. [src](https://help.tallysolutions.com/job-worker/)
- **Variance semantics** — Receipt Variance: 0 exact / negative less received / positive more received; Issue Variance: 0 / negative over-delivered / positive under-delivered. [src](https://help.tallysolutions.com/job-worker/)
- **Principal reports** — Job Work Out Orders; Job Work Orders Summary; Components Order Summary; Job Work Out Orders Book; Material Out/In Registers; Material Movement Register; Stock With Job Worker; Issue/Receipt Variance; Stock Ageing. [src](https://help.tallysolutions.com/job-work-tally/)
- **Pre-closing job work orders** — reasons: raw material not delivered/received, incomplete/damaged finished goods. [src](https://help.tallysolutions.com/job-work-tally/)

### Batches, manufacturing & expiry dates
- **Enable Batches / Maintain Expiry Dates for Batches** — F11 (Show more features). [src](https://help.tallysolutions.com/manage-inventory-batch-wise-tally/)
- **Stock item batch options** — F12 "Maintain Stock Item in Batches" (or Ctrl+I More Details per master); Maintain in batches; Track date of manufacturing; Use expiry dates; unit must be set. [src](https://help.tallysolutions.com/manage-inventory-batch-wise-tally/)
- **Batch allocation** — Stock Item Allocations: select active batch or create New Number on the fly; Batch Number, Mfg Date, Expiry Date, qty, rate; split one purchase into multiple batches (e.g., by expiry or by rate). [src](https://help.tallysolutions.com/manage-inventory-batch-wise-tally/)
- **Batch use cases** — perishables (mfg + expiry), shelf-life items (mfg date + shelf period), rate-wise categorisation, traceability of returns/defects. [src](https://help.tallysolutions.com/manage-inventory-batch-wise-tally/)
- **Batch Summary report** — Display More Reports > Inventory Books > Batch / Alt+G Batch Voucher; F8 Batch-wise; drill to Item Batch Monthly Summary → Batch Vouchers. [src](https://help.tallysolutions.com/manage-inventory-batch-wise-tally/)
- **Batch Summary F12** — Show Quantity/Rate/Value; Opening Balance; Goods Inwards; Goods Outwards; Gross Value for Outwards; Consumption and Gross Profits; Gross Profit on Gross Value; Closing Balance; Show Manufacturing Date; Show Expiry Date of Batches; Show Number of days for Expiry; Show Stock Items with Zero Quantity; Format Condensed/Detailed; Show Base Currency; Sorting: Alphabetical/Amount/Expiry date/Mfg date/Quantity/Rate asc/desc. [src](https://help.tallysolutions.com/manage-inventory-batch-wise-tally/)
- **Batch Summary buttons** — F4 Stock Group; F7 Show Profit; Ctrl+B: scale factor, Expired Batches only, Batch Manufacture Details From/To, Batch Expiry Details From/To; Ctrl+H Monthly Summary; Ctrl+J Negative Batches. [src](https://help.tallysolutions.com/manage-inventory-batch-wise-tally/)
- **Batch Vouchers report** — inward/outward vouchers per batch; Ctrl+F4 (Batch); F12: Show Narrations, Qty/Rate/Value, Opening, Inwards, Outwards, Gross Value, Consumption & Gross Profit, Closing, Use default Valuation Method for closing values (No → transaction value), Format, Show Description, Show Cost Center details, Display name for Stock Items, Sorting; buttons F4 item, F7 Hide Profit, F8 Batch-wise, Ctrl+B Type of Voucher Entries (Inward only), Alt+S Stock Alter. [src](https://help.tallysolutions.com/manage-inventory-batch-wise-tally/)
- **Profit columns** — Consumption (COGS per valuation method), Gross Profit = Outward − COGS, Perc %, Closing qty/rate/value. [src](https://help.tallysolutions.com/manage-inventory-batch-wise-tally/)
- **Disable batches** — company level (F11 Enable Batches = No, blocked if batch transactions exist) or item level (Maintain in batches = No, blocked if used). [src](https://help.tallysolutions.com/manage-inventory-batch-wise-tally/)

### Bill of Materials & manufacturing
- **BoM in stock item** — Set Components (BOM) = Yes (only if unit set) → Stock Item Multi Components (M BOM) list → per BoM: Name of BOM (e.g., Standard), Unit of manufacture, Item, Godown, Quantity; multiple BoMs per item (e.g., customer-specific). [src](https://help.tallysolutions.com/manage-inventory-in-manufacturing-tally/)
- **Type of component in BoM** — F12 "Define Type of Component for BOM": Type of Item = Component / Co-Product / By-Product / Scrap; Rate (%) = share of component cost assigned to co/by-product/scrap. [src](https://help.tallysolutions.com/manage-inventory-in-manufacturing-tally/)
- **Copy BoM (Ctrl+C)** — copy components from any item's BoM into a new BoM; unit of manufacture & quantities re-specified. [src](https://help.tallysolutions.com/manage-inventory-in-manufacturing-tally/)
- **Manufacturing Journal** — Stock Journal Alt+F7 > Ctrl+H Manufacturing Journal; Name of product, Name of BOM, qty; components auto-filled; co/by-products/scrap auto-listed; % of Cost allocation; Type of Additional Cost + %; Effective Cost; Allocation to Primary Item = Effective Cost − co/by/scrap cost; Effective rate of primary item. [src](https://help.tallysolutions.com/manage-inventory-in-manufacturing-tally/)
- **Multi-stage process tracking** — godowns per process (washing, dyeing…) with stock journals for transfer and consume/produce in same location; Godown Summary Alt+F5. [src](https://help.tallysolutions.com/manage-inventory-in-manufacturing-tally/)
- **Purchase Requisition** — user-defined Stock Journal voucher type marked Optional by default + Use as a Manufacturing Journal. [src](https://help.tallysolutions.com/manage-inventory-in-manufacturing-tally/)
- **Damaged/scrap stock** — scrap godown + journal with Source only (Destination blank). [src](https://help.tallysolutions.com/manage-inventory-in-manufacturing-tally/)
- **Cost Estimation (Item Estimates) report** — Display More Reports > Statements of Inventory > Cost Estimation; per stock group; F12 Show Quantity, Show Alternate Units, Show Cost, Show Amount, Format, Display name, Sorting; includes all costs purchase→sale (differs from journal effective rate). [src](https://help.tallysolutions.com/manage-inventory-in-manufacturing-tally/)
- **Exception: unit mismatch parent group/subgroup** — fix via Alt+H Multi-Alter of units. [src](https://help.tallysolutions.com/mismatch-in-unit-between-parent-group-and-subgroup-master/)

### Movement Analysis
- **Scope** — only accounting-integrated inventory transactions (sales/purchase etc.); pure inventory vouchers excluded except via Transfer Analysis. [src](https://help.tallysolutions.com/movement-analysis-tally/)
- **Stock Item Movement Analysis** — Alt+G; columns Quantity, Basic Rate, Effective Rate (landed incl. overheads), Value; Movement Inwards by supplier / Outwards by buyer + Transfers Inward (Production) / Outward (Consumption); qty/effective rate only if item "Can Quantities of Items be Added"; Show Additional Cost Details. [src](https://help.tallysolutions.com/movement-analysis-tally/)
- **Item Voucher Analysis (drill)** — F12 Show Godown Details, Format, Show Narrations, Show Description for Stock Item, Display Name for Ledgers, Show Additional Cost Details (split freight/packing); Ctrl+H Stock Query, Monthly Summary, Voucher Details, Cost Analysis. [src](https://help.tallysolutions.com/movement-analysis-tally/)
- **Stock Group Movement Analysis** — actual quantities; F12 Group By (Ledger/Stock Item), Type of Grouping (list/group-wise), Format, Expand all levels, Sorting Method + Sort By Inwards/Outwards column; Ctrl+H Monthly Summary, Ageing Analysis, Cost Analysis, Cost Estimates. [src](https://help.tallysolutions.com/movement-analysis-tally/)
- **Stock Category Movement Analysis** — Inwards/Outwards qty, eff. rate, value; F12 Show using Alternate Units, Group By, Type of Grouping, Format, Display name for Stock Items/Categories, Sorting. [src](https://help.tallysolutions.com/movement-analysis-tally/)
- **Group Analysis / Ledger Analysis** — items purchased/sold per account group (e.g., Sundry Debtors) or per party/cash/bank ledger; Purchases vs Sales columns. [src](https://help.tallysolutions.com/movement-analysis-tally/)
- **Stock Transfer Analysis** — per stock journal type: Goods In (Production) / Goods Out (Consumption); costing & wastage check. [src](https://help.tallysolutions.com/movement-analysis-tally/)

### Pending orders reports
- **Pending Purchase/Sales Orders Summary** — Display More Reports > Analysis & Verification > Pending Documents; columns Particulars, Orders (count), Opening Value, Preclosed Value, Received/Delivered Value, Closing Value; F3 company, F9 Analysis & Ver Reports, Alt+V Master Configuration. [src](https://help.tallysolutions.com/pending-orders-tally/)
- **Pending Purchase/Sales Orders (party)** — Date, Order Number, Ordered Qty, Balance Qty, Rate, Due On (per item), Value, Verification Status, Verification Note; F2, F3, F4 ledger, Alt+F5 detailed, F8 Show Ledger, Alt+R Verify (Spacebar select), Alt+S Remove Verify. [src](https://help.tallysolutions.com/pending-orders-tally/)
- **Pending orders F12** — Show Outstanding Sales/Purchase Orders; Show Cleared Sales/Purchase Orders; Show Goods delivered but Orders not received; Show Goods received but Orders not sent; Show Actual and Billed Quantities; Show Alternate Units; Show Location details; Show Batch details; Show Preclose Order details; Show Reason; Format; Display name for Stock Items/Ledgers. [src](https://help.tallysolutions.com/pending-orders-tally/)

### Physical stock register
- **Physical Stock Register** — Display More Reports > Inventory Books; voucher count per month; Ctrl+H/F12 periodicity (weekly/fortnightly/monthly/quarterly); narration records discrepancy cause. [src](https://help.tallysolutions.com/physical-stock-register-tally/)
- **Book vs physical comparison** — post-dated physical stock voucher + Stock Summary Alt+C column for that date + Ctrl+E Excel export. [src](https://help.tallysolutions.com/physical-stock-register-tally/)

### POS invoicing
- **POS voucher type** — new voucher type of type Sales with "Use for POS invoicing" = Yes; Message to print (1) and (2) (footer); Default title to print; numbering. [src](https://help.tallysolutions.com/point-of-sale-tally/)
- **POS entry** — Party A/c Name = Not Applicable for walk-ins (or select party); Sales ledger; Quantity defaults 1; rate auto-filled from previous sale; default payment Cash with Cash tendered and Balance (change) shown. [src](https://help.tallysolutions.com/point-of-sale-tally/)
- **Multi-mode payment (Alt+I)** — Gift Voucher (ledger under Sundry Debtors/Creditors), Credit/Debit card (bank ledger), Cheque (bank ledger), Cash tendered + Balance. [src](https://help.tallysolutions.com/point-of-sale-tally/)
- **POS F12** — Provide Buyer details; Provide Additional Descriptions for Stock Items; Skip the Quantity field (prefilled 1); Modify the Rate field during voucher entry; Provide Party details in POS Invoice; Warn when Voucher No. exceeds 16 characters; Modify all fields; Use Expired Batches; Show Batches with Zero Quantity; Calculate Tax on Current Subtotal. [src](https://help.tallysolutions.com/point-of-sale-tally/)
- **POS printing** — Alt+P > Current > F12 > Printer = POS printer > Show More > Print Format; I preview / P print; any paper size. [src](https://help.tallysolutions.com/point-of-sale-tally/)
- **POS voucher class** — predefined payment modes/ledgers prefilled and sales ledger allocation. [src](https://help.tallysolutions.com/point-of-sale-tally/)
- **POS offers** — same-item buy-1-get-1 via Actual vs Billed Quantity columns (F11); different free item via voucher type "Allow zero-valued transactions". [src](https://help.tallysolutions.com/point-of-sale-tally/)
- **Barcode** — scan into stock item Alias (e.g., 16-digit); scan in Name of Item auto-fills item, qty, rate, amount; cannot print barcode labels, but barcode number printable via Display name Name (Alias). [src](https://help.tallysolutions.com/point-of-sale-tally/)
- **POS Register** — Alt+G Monthly POS Register (needs ≥1 POS invoice); Alt+F5; F12 Report Type, Show Inventory-wise Extract, Show Columnar Register, Show Gross Profit estimates, Show Cost based on stock valuation, Format, Show inventory details, Show additional descriptions, Display name for Stock items, Show Optional Vouchers, Appearance of Names, Sorting Method. [src](https://help.tallysolutions.com/point-of-sale-tally/)
- **Date & time of sale recorded** on POS invoices. [src](https://help.tallysolutions.com/point-of-sale-tally/)

### Pre-closing job work orders
- **Close Order (Alt+W)** — from Job Work Order Summary > order > Job Order Details > Alt+W > Close orders = Yes; closes related Material In/Out component orders. [src](https://help.tallysolutions.com/pre-close-job-work/)
- **Job Work Out Order (principal)** — F10 > Job Work Out Order; party = job worker; same Dispatch Details (Duration of Process / Nature of Processing optional on order, mandatory at transfer, auto-captured when tracked); Item Allocations Track Components / Due on / Godown / Qty / Rate. [src](https://help.tallysolutions.com/principal-manufacturer/)
- **Material Out to job worker** — Order Details (Order No(s), Other References, Terms of Delivery, Dispatch Doc No.) prefilled from order; components from BoM; Destination Godown; optional zero-valued entries. [src](https://help.tallysolutions.com/principal-manufacturer/)
- **Material In from job worker** — Order Details with Challan No.; Source Godown; then Purchase of job work service (Supplier Invoice No., partial receipt) and Payment Agst Ref. [src](https://help.tallysolutions.com/principal-manufacturer/)
- **Principal Material Movement Register columns** — Order Number, Delivery Challan Number, Date of Dispatch, Description of Goods dispatched, Qty Dispatched, Name and Address of Job Worker, Nature of Processing Required, Goods Received (FG/scrap/by/co-products), Qty Received, Job Worker's Delivery Challan No. & Date, Factory GRN/GRR No. & Date, Shortages, Wastage/Scrap, Duty Paid on Shortages/Scrap/Wastage, Remarks. [src](https://help.tallysolutions.com/principal-manufacturer/)
- **Stock With Job Worker report** — Ctrl+H Movement Analysis / Stock Ageing Analysis; F4 stock group. F8 (Job Work Out) toggle in Order Summary, Components, Issue/Receipt Variance. [src](https://help.tallysolutions.com/principal-manufacturer/)

### Printing (inventory documents)
- **Printer setup** — Alt+P > Configuration > Printer; paper size; digital signature requires Microsoft Print to PDF. [src](https://help.tallysolutions.com/print-invoices-reports/)
- **Optional voucher prints as Proforma Invoice.** [src](https://help.tallysolutions.com/print-invoices-reports/)
- **Payment link / QR on invoice** — Method of Payment Request: Link / QR Code / Link & QR Code (UPI QR). [src](https://help.tallysolutions.com/print-invoices-reports/)
- **Reminder letters** — Bills Receivable > Ctrl+P > Report Type Reminder Letter; ageing range; Show Due on; Show Over Due Days; include post-dated vouchers. [src](https://help.tallysolutions.com/print-invoices-reports/)
- **Show Previous and Current Balances of Ledger** — invoice print Party Details option; balances reflect all same-day invoices. [src](https://help.tallysolutions.com/print-invoices-with-balances/)
- **Optimise printing to save paper** — India + GST/VAT/TDS/TCS enabled; fits more items per A4. [src](https://help.tallysolutions.com/purchase-goods-and-services-tally/)

### Purchase process
- **Purchase Bills Pending** — Goods Recd. but Bills not Recd.; Bills Recd. but Goods not Recd.; Cleared Purchase Bills (by tracking number). [src](https://help.tallysolutions.com/purchase-bills-pending/)
- **Purchase invoice entry** — F9; Ctrl+H modes Item Invoice / Accounting Invoice / As Voucher; Supplier Invoice No. & Date; Party A/c (cash/bank or supplier; Alt+C create on the fly); Receipt Details (receipt doc no., bill of lading, destination); Party Details (F12 "Provide Receipt, Order, and Import details"); common Purchase ledger (F12 Select common Ledger Account for Item Allocation); rate auto-filled. [src](https://help.tallysolutions.com/purchase-goods-and-services-tally/)
- **Cash purchase** — select Cash in Party A/c; or later Payment (single entry) with Bill-wise Agst Ref; Bank Allocation (Favouring Name, Transaction Type, Transfer Mode for e-Payments); F12 Ledger-wise Bank Allocations; voucher type "Enable default accounting allocation". [src](https://help.tallysolutions.com/purchase-goods-and-services-tally/)
- **Separate buyer & consignee** — Party Details F12 "Provide separate Buyer and Consignee details". [src](https://help.tallysolutions.com/purchase-goods-and-services-tally/)
- **Discount on total** — discount ledger (Indirect Incomes) after End of List with Rate −10% or amount; "Calculate Tax on Current Subtotal" to discount after additional charges. [src](https://help.tallysolutions.com/purchase-goods-and-services-tally/)
- **Item-level discount column** — F11 Use Discount column in invoices; Discount format: Percentage / Amount / Both Percentage & Amount (newer than Rel 7.0). [src](https://help.tallysolutions.com/purchase-goods-and-services-tally/)
- **Cash/Trade Discount via ledger** — F12 "Provide Cash/Trade Discount" (needs GST/VAT); per-item discount % or amount; discount ledger with Type of ledger = Discount accumulates total. [src](https://help.tallysolutions.com/purchase-goods-and-services-tally/)
- **Import purchase with landed cost** — foreign-currency rates; import expense group with Appropriate by Value; customs duty, C&F, freight appropriated to item cost; view breakup in As Voucher mode. [src](https://help.tallysolutions.com/purchase-goods-and-services-tally/)
- **Free items** — Actual vs Billed quantity columns (F11), or voucher type "Allow zero-valued transactions" (qty only, no rate). [src](https://help.tallysolutions.com/purchase-goods-and-services-tally/)
- **Fixed-asset purchase** — Accounting Invoice with fixed-asset ledger. [src](https://help.tallysolutions.com/purchase-goods-and-services-tally/)
- **Purchase reports** — Day Book (F2 date, F4 voucher type); Purchase Register (month-wise drill). [src](https://help.tallysolutions.com/purchase-goods-and-services-tally/)

### Purchase orders, receipt notes & tracking numbers
- **Purchase Order voucher** — F10 > Purchase Order (activate if inactive); Party; Order/Receipt/Import details screen (F12 "Provide Receipt, Order, and Import details"); Order No.; F12 "Provide Order No. for each Stock Item"; per item Due on + Qty + Rate; split lots with different due dates. [src](https://help.tallysolutions.com/purchase-order-tally/)
- **Purchase Orders Book** — Display More Reports > Inventory Books; month-wise; Alt+N Auto Column; F12 options. [src](https://help.tallysolutions.com/purchase-order-tally/)
- **Pre-close order from voucher** — F12 "Provide details to preclose orders" → Pre-Close Quantity + Reason for Pre-Close per item; Alt+W (Pre-Close Quantity) with Reason & Closed on date; can pre-close in order, receipt note or purchase voucher. [src](https://help.tallysolutions.com/purchase-order-tally/)
- **Pre-close from reports** — Purchase Orders (Due Only) F12 Show Cleared Purchase Orders / Show Pre-closure Order details / Show Reason; Spacebar multi-select; Alt+W partial (qty+reason) or Alt+W > Alt+W (Set Quantity) for full balance. [src](https://help.tallysolutions.com/purchase-order-tally/)
- **Purchase Order Outstandings** — Statements of Inventory > Purchase Order Outstandings by Stock Group / Stock Item / Group / Ledger / All Orders; Order Details: Date, Order No., Party, Ordered Qty, Balance Qty, Rate, Value, Due on, Overdue days. [src](https://help.tallysolutions.com/purchase-order-tally/)
- **Ledger PO Outstanding F12** — Show Opening Orders, Show Orders Booked, Show Cleared Orders, Show Pending Orders. [src](https://help.tallysolutions.com/purchase-order-tally/)
- **All Orders buttons** — Alt+F5 detailed, F6 Age wise, F8 All/Due Orders toggle, Alt+W Preclose Orders; shows Goods received but Orders not Sent. [src](https://help.tallysolutions.com/purchase-order-tally/)
- **Order position in Stock Summary** — order status visible per item. [src](https://help.tallysolutions.com/purchase-order-tally/)
- **Receipt Note** — F10; Reference No.; Party Details with Order No(s) (or Not Applicable) + Receipt Details; Purchase ledger; items prefilled from PO; Tracking No. (defaults to voucher no.; New Number); Tracking No. = Not Applicable → inventory-only, no accounts. [src](https://help.tallysolutions.com/purchase-order-tally/)
- **Purchase against Receipt Note** — select receipt note reference after party; qty/rate editable; Tracking No./Order No. auto-filled; receipt note closed when fully billed. [src](https://help.tallysolutions.com/purchase-order-tally/)
- **Purchase before goods** — purchase with New tracking number → "Bills Recd. but Goods not Recd."; later receipt note tracks it. [src](https://help.tallysolutions.com/purchase-order-tally/)
- **Disable tracking numbers** — deactivate Receipt Note (purchase) / Delivery Note (sales) voucher type. [src](https://help.tallysolutions.com/purchase-order-tally/)
- **Rejections Out** — F10; Ledger Account, Supplier's Name & Address; select tracking number; qty/rate; F12 Show Godown-wise Details; reduces stock. [src](https://help.tallysolutions.com/purchase-order-tally/)
- **Purchase Bills Pending report** — Statements of Inventory; requires Tracking Numbers; Goods Recd. but Bills not Recd., Bills Recd. but Goods not Recd.; F12 options; drill to voucher. [src](https://help.tallysolutions.com/purchase-order-tally/)

### Purchase returns & value changes
- **Debit Note for purchase return** — F10 Debit Note; Dispatch Details > Original Invoice No./Date; items with qty & rate. [src](https://help.tallysolutions.com/purchase-returns-tally/)
- **Credit Note for increased purchase value** — Original Invoice Details; items qty/rate. [src](https://help.tallysolutions.com/purchase-returns-tally/)
- **Debit Note for decreased purchase value** — Item Invoice; Ledger account Show More > purchase ledger; tax ledgers; Bill-wise Agst Ref to original invoice (Cr). [src](https://help.tallysolutions.com/purchase-returns-tally/)
- **SEZ purchases** — Regular-SEZ company: IGST by supplier; F3 registration switch (Rel 3.0+ multiple registrations); Place of Supply; Ctrl+O GST Tax Analysis (Alt+F5 detailed). [src](https://help.tallysolutions.com/purchase/)

### Reorder levels
- **Reorder Level masters** — Alter > Reorder Level (Stock Item) / (Stock Group) / (Stock Category); items listed for bulk entry. [src](https://help.tallysolutions.com/reorder-stock-items-reorder-status-and-reorder-quantity/)
- **Simple vs Advance reorder** — Alt+S toggles Simple/Adv Reorder; Alt+V toggles Simple/Adv Min Qty; default advance. [src](https://help.tallysolutions.com/reorder-stock-items-reorder-status-and-reorder-quantity/)
- **Reorder Quantity & Minimum Order Quantity** — advanced parameters: consumption Period (Days/Weeks/Months/Years; total not average; 0 = ignore history), Criteria Higher/Lower vs fixed quantity; rounding limits. [src](https://help.tallysolutions.com/reorder-stock-items-reorder-status-and-reorder-quantity/)
- **Reorder Status report** — Statement of Inventory > Reorder Status by Stock Group or Category; columns Name of Item, Closing Stock, Purc Orders Pending, Sales Orders Due, Nett Available (= closing + pending PO − SO due), Re-order Level, Shortfall, Min Order Quantity, Order to be Placed (max of shortfall, MOQ); F8/Ctrl+B Reorder Only; drill to Movement Analysis / Monthly Summary / Order Details / Specify Reorder Levels; F4 group; Ctrl+J negative stock; Ctrl+H Monthly Summary, Movement Analysis, Ageing. [src](https://help.tallysolutions.com/reorder-stock-items-reorder-status-and-reorder-quantity/)

### Round-off
- **Invoice Rounding ledger** — under Indirect Expenses, Type of Ledger = Invoice Rounding; Rounding method Not Applicable / Downward / Normal / Upward; Rounding limit (e.g., 1, 5). [src](https://help.tallysolutions.com/round-off-invoice-and-ledger-values/)
- **Round-off via voucher class** — Additional Accounting Entries ledger with Type of Calculation "As Total Amount Rounding", rounding method & limit, Remove if Zero; auto-added. [src](https://help.tallysolutions.com/round-off-invoice-and-ledger-values/)
- **Ledger-level rounding** — tax ledger (Duties & Taxes) rounding method/limit. [src](https://help.tallysolutions.com/round-off-invoice-and-ledger-values/)

### Sales invoice entry
- **Voucher modes** — Item Invoice (Name of Item column), Accounting Invoice (Particulars column; services), As Voucher (double entry By/To or Dr/Cr via F12 "Use Cr/Dr instead of To/By"; Inventory Allocation sub-screen); switch with Ctrl+H. [src](https://help.tallysolutions.com/sales-of-goods-services/)
- **Sales entry fields** — Party A/c (Cash/Bank for cash sale; Alt+C create); Dispatch Details; Party Details (Buyers ledger with landmark/alt contact); common Sales ledger; Name of Item, Qty, Rate (Alt+C create item); Narration; "Print voucher after saving" goes straight to print screen. [src](https://help.tallysolutions.com/sales-of-goods-services/)
- **Sales F12 (full list)** — Provide Buyer details; Provide Dispatch, Order, and Export details; Provide Order details (sales order no., Mode/Terms of payment, Other references, Terms of Delivery); Provide Export details (Port of Loading, Port of Discharge, Country to, Shipping Bill No.); Select common Ledger Account for Item Allocation; Use Cr/Dr instead of To/By; Use default Bill-wise details; Provide Additional Descriptions for Ledgers; Provide Additional Descriptions for Stock Items; Warn on Negative Stock Balance; Show Inventory details (As Voucher); Use Voucher No. as Bill Reference; Modify all fields; Provide details to preclose orders; Select Cost Centre/Class; Show list of Bills for selection; Show Final Balances for each Bill; Show Bill-wise Details; Show Bill-wise details in multiple lines; Show Cost Centre details; Provide Reference No. and Date; Warn on negative Cash Balance; Skip the Date field; Warn when Voucher No. exceeds 16 characters (GST); Show Turnover from selected Party A/c; Show Current Balance of Ledgers; Show Balances as on Voucher date; Show final Ledger Balance; Consolidate Qty of Stock Items with same rate (merge delivery notes); Show Compound Unit based on Rate; Show details of Compound Unit; Provide Marks or Container No.; Provide No. of Packages; Use default Bank Allocations; Remove Bank Date while altering Reconciled Voucher; Calculate Tax on Current Subtotal. [src](https://help.tallysolutions.com/sales-of-goods-services/)
- **Day Book / Sales Register for sales** — F2 date, Alt+F2 period, F4 voucher type; Sales Register Ctrl+B scale, Ctrl+H view, Ctrl+L Save View (default), Alt+C/Alt+A/Alt+N columns. [src](https://help.tallysolutions.com/sales-of-goods-services/)
- **Edit Log for sales (Alt+Q)** — Rel 2.1+ / Edit Log edition. [src](https://help.tallysolutions.com/sales-of-goods-services/)
- **Cancel sales voucher** — Alt+X from Day Book or alteration; Ctrl+J Cancelled Vouchers exception report; cancelled voucher number cannot be reused; not recoverable. [src](https://help.tallysolutions.com/sales-of-goods-services/)

### Sales orders, delivery notes, quotations
- **Sales Order voucher** — F10 > Sales Order (activate); Party, Dispatch, Party Details; Order no. (or per item via "Provide Order No. for each Stock Item"); Sales ledger; per item Due on, Qty, Rate (auto from last sale); split lots by due date; batch/godown allocations; additional ledgers (transport, insurance, discount); order printed. [src](https://help.tallysolutions.com/sales-order-tally/)
- **Sales Order F12** — Provide Buyer details; Provide Dispatch, Order, and Export details; Select common Ledger Account; Additional Descriptions for Ledgers / Stock Items; Provide Order No. for each Stock Item; Warn on Negative Stock Balance; Warn on duplicate Order No.; Modify all fields; Provide details to preclose orders; Select Cost Centre/Class; Use Expired Batches; Show Batches with Zero Quantity; Provide Accounting Allocations in Order/Delivery Note; Skip the Date field; Warn if Due Date of Order is earlier than Voucher Date; Show Turnover; Show Current Balance; Show Balances as on Voucher date; Show final Ledger Balance; Show Compound Unit of Items based on Rate; Show details of Compound Unit; Use Standard Selling/Last Sold Rate for Items with no Price List; Provide Marks or Container No.; Provide No. of Packages; Calculate Tax on Current Subtotal; Calculate MRP on Billed Quantity. [src](https://help.tallysolutions.com/sales-order-tally/)
- **Sales against Sales Order** — F12 Provide Order Details; select order no.; items prefilled & editable; order closes when fully billed else partially (Sales Order Outstandings). [src](https://help.tallysolutions.com/sales-order-tally/)
- **Delivery Note** — F10; with or without order; Tracking No. (defaults to voucher no.; New Number; Not Applicable = inventory only); closes when billed; partial → Sales Bills Pending. [src](https://help.tallysolutions.com/sales-order-tally/)
- **Delivery Note F12** — Buyer details; Dispatch/Order/Export; common Ledger; Additional Descriptions; Calculate Tax on Current Subtotal; Warn on Negative Stock; Provide Accounting Allocations in Order/Delivery note; Show Turnover; Modify all fields; Provide details to preclose orders; Use Expired Batches; Show Batches with Zero Quantity; Consolidate quantity of Stock Items with same rate; Compound unit options; Marks/Container No.; No. of Packages. [src](https://help.tallysolutions.com/sales-order-tally/)
- **Partial cancellation** — delivery note with delivered qty + Pre-Close Quantity + Reason for Pre-Close. [src](https://help.tallysolutions.com/sales-order-tally/)
- **Quotation** — mark Sales Order Optional (Ctrl+L) → prints titled QUOTATION. [src](https://help.tallysolutions.com/sales-order-tally/)
- **Pre-close sales order** — same as PO: F12 Provide details to preclose orders, Alt+W (Reason + Closed on); from reports with Spacebar multi-select + Alt+W / Alt+W Set Quantity. [src](https://help.tallysolutions.com/sales-order-tally/)
- **Sales Order Outstandings** — by Stock Group / Stock Category / Stock Item / Group / Ledger / All Orders; F4 group/item, F5 Stock Item-wise, F9 (Orders) view: Sales Orders Outstanding, Purchase Orders Outstanding, Nett Stock, Saleable Stock, Stock in Hand; Ctrl+H Summary, Monthly Summary, Stock Query, Movement Analysis, Ageing; Ctrl+J Negative Stock Items / Sales Order Outstanding. [src](https://help.tallysolutions.com/sales-order-tally/)
- **Order outstanding F12 (group/item)** — Show Quantity, Alternate Units, Rate, Value, Opening Orders, Orders Booked, Cleared Orders, Pending Orders, All Items (incl. zero), Tail Units, Display names, Scale factor, Base Currency, Sorting, Expand all levels. [src](https://help.tallysolutions.com/sales-order-tally/)
- **All Orders F12** — Show Outstanding/Cleared Sales Orders; Goods delivered but Orders not received; Outstanding/Cleared Purchase Orders; Goods received but Orders not sent; Show Preclosure order details; Show Reason; Show Pre-Closed orders only; Batch Details; Location Details; Alternate Units; Tail Units; Actual and Billed Quantity details; Calculate Amount on Billed Quantity; Display names; Sorting. Buttons Alt+F5, F8 Due Orders, F6 Age-wise, Alt+W. [src](https://help.tallysolutions.com/sales-order-tally/)
- **Sales order ageing** — F6 Age-wise: Ageing by Bill Date / by Due Date, custom age periods; extra F12 Show Opening/Prev cleared Order details. [src](https://help.tallysolutions.com/sales-order-tally/)
- **Sales Orders Book** — Inventory Books; Alt+N auto columns (daily/weekly/monthly); Alt+F5; F7 Show/Hide Profit (estimated GP); F8 Columnar; F12 Show Optional Vouchers, Appearance of Names, Periodicity; voucher register: Report Type, Inventory-wise Extract, Columnar Register, Gross Profit estimates, Cost based on stock valuation, Narrations, Bill-wise, Cost Centre, Inventory details, additional description. [src](https://help.tallysolutions.com/sales-order-tally/)
- **Sales before delivery** — invoice with new tracking number → "Bills made but goods not delivered". [src](https://help.tallysolutions.com/sales-order-tally/)
- **Rejections In** — after delivery note, before invoice; Customer's Name & Address; select tracking number; F12 Show Batch Wise Details / Show Godown-wise Details; increases stock. [src](https://help.tallysolutions.com/sales-order-tally/)
- **Sales Bills Pending report** — needs Tracking Numbers; F12 Show Outstanding Sales Bills (Goods Delivered but Bills not Made), Cleared Sales Bills, Bills Made but Goods not delivered, Outstanding/Cleared Purchase Bills, Bills received but Goods not received, Actual and Billed Quantity, Alternate Units, tail unit, Location, Batch, Format, Display names, Sorting. [src](https://help.tallysolutions.com/sales-order-tally/)

### Salesperson tracking & commission
- **Sales by salesperson** — salesperson = cost centre; sales ledger "Cost Centres are applicable" (Ctrl+I More Details if hidden); F12 common ledger = No so per-ledger cost allocation appears; Cost Centre Breakup of Ledger for commission base. [src](https://help.tallysolutions.com/salesperson-details-collection-commission-tally/)
- **Collection by salesperson** — party ledger with cost centres; allocate invoice total and receipts to collector; combined sales+collection allocation for commission on collection. [src](https://help.tallysolutions.com/salesperson-details-collection-commission-tally/)
- **Single-salesperson invoices** — cost centre class per salesperson to auto-allocate; department-wise grouping of cost centres. [src](https://help.tallysolutions.com/salesperson-details-collection-commission-tally/)

### Receipts, advances, additional charges, discounts, free items
- **Receipt against sales** — Single Entry mode; Bill-wise Agst Ref to invoice; cash-in-invoice alternative; Bank Allocation (Transaction Type, cheque no., Received From, Transfer Mode for e-Payments); F12 Ledger-wise Bank Allocations; voucher type default accounting allocation. [src](https://help.tallysolutions.com/sales-receipts-additional-charges-discounts-free-items/)
- **Advance receipts** — Type of Ref = Advance; later Agst Ref in sales invoice (requires Maintain balances bill-by-bill and F12 Use default Bill-wise details = No); partial settlement across invoices. [src](https://help.tallysolutions.com/sales-receipts-additional-charges-discounts-free-items/)
- **Receipt with settlement discount** — discount ledger (Indirect Expenses, Type of Ledger Not Applicable) with negative amount in receipt. [src](https://help.tallysolutions.com/sales-receipts-additional-charges-discounts-free-items/)
- **Different sales ledgers per item** — F12 Select common Ledger Account for Item Allocation = No → choose sales ledger per line (e.g., local vs premium goods). [src](https://help.tallysolutions.com/sales-receipts-additional-charges-discounts-free-items/)
- **Additional charges** — transport/packing/insurance ledger (Indirect Expenses) with Rate % on item total or fixed Amount; optional cost-centre tracking per agent (ledger F12 Apply Cost Centres for Ledgers). [src](https://help.tallysolutions.com/sales-receipts-additional-charges-discounts-free-items/)
- **Discount on total** — discount ledger (Indirect Expenses) with negative % (e.g., −5%) or amount; Calculate Tax on Current Subtotal to discount after charges. [src](https://help.tallysolutions.com/sales-receipts-additional-charges-discounts-free-items/)
- **Item discount column** — F11 Use Discount column in invoices; Discount format Percentage / Amount / Both (post-7.0; 7.0 and earlier only Disc %); rate unchanged, amount net. [src](https://help.tallysolutions.com/sales-receipts-additional-charges-discounts-free-items/)
- **Trade discount via ledger** — F12 Provide Cash/Trade Discount; per-item % or amount; discount ledger Type of Ledger = Discount totals them. [src](https://help.tallysolutions.com/sales-receipts-additional-charges-discounts-free-items/)
- **Free items** — Actual vs Billed qty (F11 Use separate Actual and Billed Quantity columns) or zero-valued line (voucher type Allow zero-valued transactions). [src](https://help.tallysolutions.com/sales-receipts-additional-charges-discounts-free-items/)
- **Bill-to / Ship-to** — Party Details F12 "Provide separate Buyer and Consignee details"; select from party's multiple addresses. [src](https://help.tallysolutions.com/sales-receipts-additional-charges-discounts-free-items/)
- **GST discount ledger setup** — goods: Type of Ledger = Discount; services: Type Not Applicable + Include in Assessable Value calculation = GST. [src](https://help.tallysolutions.com/set-up-discount-ledger/)

### Sales returns / credit & debit notes
- **Credit Note for sales return** — F10; Item Invoice; Receipt Details > Original Invoice No./Date; Party Details; sales ledger; item qty/rate; Bill-wise Agst Ref (before payment) or New Ref (after payment; adjust in next sale/payment or exchange). [src](https://help.tallysolutions.com/sales-return-tally/)
- **Damaged returns** — recorded separately, excluded from closing stock. [src](https://help.tallysolutions.com/sales-return-tally/)
- **Credit Note Register** — Account Books; monthly; F8 Columnar; F4 voucher type; F12 Show Optional Vouchers, Periodicity; Narrations, Format, Bill-wise, Inventory, Description, Mode of Payment, additional Bank details, Cost Centre, Display names, Sorting. [src](https://help.tallysolutions.com/sales-return-tally/)
- **Debit Note for sale-value increase** — item without qty/rate, Amount = increase; New Ref. [src](https://help.tallysolutions.com/sales-return-tally/)
- **GST credit note** — dated on return date (falls in that month's GSTR-1); tax ledgers; Provide GST details with return reason. [src](https://help.tallysolutions.com/sales-return-using-credit-note/)

### Price management
- **Standard Cost / Standard Selling Price** — stock item F12 "Provide Standard Buying and Selling Rates" → Alter standard rates: date-wise list of Applicable From + Rate per unit; auto-fills purchase/sales rate by voucher date. [src](https://help.tallysolutions.com/selling-buying-prices/)
- **Price Levels** — F11 Enable multiple Price Levels; Create > Price Levels (e.g., Wholesaler, Retailer, Dealer); renamable. [src](https://help.tallysolutions.com/selling-buying-prices/)
- **Price Lists** — Price Lists (Stock Group) or (Stock Category); per level + Applicable From date; per item quantity slabs From / Less than with Rate and Disc. %; Cost Price shown (per valuation method); historical rates/discounts shown; F12 Show All Items for Price Level; new items in group auto-appear. [src](https://help.tallysolutions.com/selling-buying-prices/)
- **Price level in vouchers** — select Price Level per invoice/order; rate & discount auto from list; party ledger default (F12 "Use Price Levels for Party Ledgers"; debtors or creditors; one per ledger, overridable); Modify all fields to override rate. [src](https://help.tallysolutions.com/selling-buying-prices/)
- **Revise Price (Alt+R)** — bulk increase/decrease prices and discounts by % or value for group/category & level from a date; shows old list and cost price. [src](https://help.tallysolutions.com/selling-buying-prices/)
- **Price list access** — Inventory Info. menu once price levels exist; requires inventory + invoicing. [src](https://help.tallysolutions.com/selling-buying-prices/)

### Stock Ageing Analysis
- **Stock Ageing Analysis** — Statement of Inventory > Ageing Analysis; select group (Primary = all); columns Total Qty + age slabs; negative stock shown; F7 Show Value; drill to Item Inwards Details (purchase date, supplier → voucher). [src](https://help.tallysolutions.com/stock-ageing-analysis-report-tally/)
- **Ageing buttons** — F6 Ageing Period (default slabs 0-45, 45-90, 90-180, 180+; user-defined); F4 Stock Group; F8 Valuation Method (any costing method); F9 Ageing Style: By Date of Purchase (default) / By Expiry Date / By Mfg. Date / To be Expired; Show only Expired Batches; Godown Type filter; Ctrl+H Monthly Summary, Movement Analysis, Cost Analysis, Cost Estimates; Ctrl+J Negative Stock. [src](https://help.tallysolutions.com/stock-ageing-analysis-report-tally/)
- **Ageing F12** — Format (Alt+F5 detailed), Display name for Stock Items, Sorting Method; ageing style & expired batches only with batches + expiry enabled. [src](https://help.tallysolutions.com/stock-ageing-analysis-report-tally/)
- **Bill ageing** — Ledger/Group Outstandings & Bills Receivable/Payable F6 Ageing Method: by Bill Date / by Due Date with custom periods; Group F12 Show Nett Balances; reminder letters for groups via Multi-Account Printing. [src](https://help.tallysolutions.com/stock-ageing-analysis-report-tally/)

### Stock Query
- **Stock Query report** — Statements of Inventory > Stock Query (also Alt+S during voucher; browser view); sections Purchases (last: party, actual/billed qty, rate, date, discount, amount), Sales (same), Godown/Batch-wise Details, Items of the same category; header: alias, part no., group, category, closing qty/balance, cost price, std selling price, costing & market valuation method. [src](https://help.tallysolutions.com/stock-query-tally/)
- **Stock Query buttons** — F2 period, F3 company, F4 item, F7 Hide/Show Reorders (closing, orders, reorder level, shortfall, min qty, to order), Alt+F7 Hide Stat Info (GST), Ctrl+F7 Top Buyers/Sellers (by value or qty), Ctrl+B Show Nett Rate (needs appropriation method), Ctrl+H Monthly Summary, Ctrl+J Purchase Order; drill to Voucher Display. [src](https://help.tallysolutions.com/stock-query-tally/)
- **Stock Query F12** — Show Vertical Stock Query; Show aliases; Show Descriptions; Show Stat info; Show Reorders; Show Actual and Billed Quantities; Show all Godown/Batches including zero balance; Show Stock Items of the same Stock Group; Number of last transactions to show; Kerala Flood Cess rate column when applicable. [src](https://help.tallysolutions.com/stock-query-tally/)

### Stock valuation methods
- **Costing methods (per item)** — At Zero Cost; Average Cost (default); FIFO; FIFO Perpetual; Last Purchase Cost; LIFO Annual; LIFO Perpetual; Standard Cost; Monthly Average Cost; FIFO/LIFO annual reset opening to average; perpetual from company creation. [src](https://help.tallysolutions.com/stock-valuation-methods-tallyprime/)
- **Market valuation methods (per item; sales rate auto-fill)** — At Zero Price; Average Price (default); Last Sales Price; Standard Price. [src](https://help.tallysolutions.com/stock-valuation-methods-tallyprime/)
- **Enable per-item methods** — stock item F12 "Use Costing and Market Valuation Methods for Stock Items" (Show all configurations). [src](https://help.tallysolutions.com/stock-valuation-methods-tallyprime/)
- **Compare methods** — Balance Sheet / P&L / Stock Summary Alt+N Auto Column > Stock Valuation Methods; Ctrl+B valuation method override in reports. [src](https://help.tallysolutions.com/stock-valuation-methods-tallyprime/)

### Stock Summary
- **Stock Summary** — Gateway > Stock Summary; real-time closing by group/item; drill Stock Group Summary → Stock Item Monthly Summary (with graph) → Stock Item Vouchers (Alt+S alter item); browser view; closing stock flows to P&L when "Integrate Accounts with Inventory". [src](https://help.tallysolutions.com/track-your-inventory-stock-summary-tally/)
- **Stock Summary buttons** — F4 Stock Group; F5 Stock Item-wise toggle; F7 Show/Hide Profit; F9 (Orders) Saleable Stock (due orders only Y/N) / Sales Orders Outstanding / Purchase Orders Outstanding; Ctrl+G Godown Types; Ctrl+B scale factor, valuation method, godown type, stock position; Ctrl+H Monthly Summary, Movement Analysis, Ageing; Ctrl+J Negative Stock Items; Alt+C/Alt+N/Alt+A/Alt+D columns (period, company, valuation method e.g., Last Sale Price). [src](https://help.tallysolutions.com/track-your-inventory-stock-summary-tally/)
- **Stock Summary F12** — Opening Balance, Goods Inwards, Goods Outwards, Gross Value for Outwards, Consumption and Gross Profits, Gross Profit on Gross Value, Enable Stripe View (also app-level; prints/exports with stripes). [src](https://help.tallysolutions.com/track-your-inventory-stock-summary-tally/)

### Verification & exceptions
- **Verification of Stock Items** — Analysis & Verification > Data Analysis; compares analysis year vs previous year (load prior company, F7 Compare Company); statuses: All Exceptions, Difference in Opening Stock, Negative Stock, Not Available in Current Year, Not Used, Not Used in Current Year, Only Balances No Transactions, Used Only in Current Year, All Items, No Change. [src](https://help.tallysolutions.com/verfication-stock-item-tally/)
- **Verification buttons** — F3, F4 group, F5 item-wise, Alt+F5, F9 Analysis & Ver Reports, Alt+V Master Configuration, F10 Daily Negative Stock (Ctrl+F8 daily break-up); mark Verified / On Hold with Verification Note; F12 Type of Stock Items, Show Stock Group, Show Verification Note, filter by status (On Hold/Verified/Altered/Any), Display name. [src](https://help.tallysolutions.com/verfication-stock-item-tally/)
- **Exception: Reporting UQC missing** — items with multiple UQCs need a Reporting UQC; fix via Alt+Q (Update RUQC). [src](https://help.tallysolutions.com/stock-items-with-multiple-uqc/)
- **Exception: original sales value for interstate B2C credit note** — specify ≤ or > 2.5 lakh (Ctrl+I More Details) → B2C Small (7) vs CDN Unregistered (9B). [src](https://help.tallysolutions.com/unable-to-determine-original-sales-value/)
- **Exception: invoice number missing** — GST invoices need ≤16-char alphanumeric number (with - or /); check Document Summary. [src](https://help.tallysolutions.com/voucher-number-not-maintained-for-invoices-or-invoice-number-does-not-exist/)

### Gaps in this crawl (inventory)
- No dedicated page in this job set for the full Stock Item creation screen (GST/HSN details, MRP, Rate of Duty, alternate/compound unit definitions, opening balance fields) or Stock Group/Category/Unit masters; covered only indirectly above (BoM, batches, standard rates, valuation methods, barcode alias, reorder). Negative-stock company option and zero-valued entries appear only as voucher-level options.

## Payroll

### Enablement & company statutory setup
- **Maintain Payroll** — F11 (Show more/all features) > Maintain Payroll = Yes; adds Payroll Info. to Gateway. [src](https://help.tallysolutions.com/enabling-payroll-in-tallyprime-tally/)
- **Enable Payroll Statutory** — F11; India only (incl. Ladakh in latest versions); unlocks PF, ESI, NPS, Income Tax, Professional Tax. [src](https://help.tallysolutions.com/enabling-payroll-in-tallyprime-tally/)
- **PF company details** — Company code (format RegionCode+OfficeCode+EstCode(7)+Extension(3), e.g., DLFBD0012345012), Company account group code, Company security code. [src](https://help.tallysolutions.com/enabling-payroll-in-tallyprime-tally/)
- **ESI company details** — ESIC Company code, ESI branch office, Standard working days per month (blank = calendar period); ESI eligibility amount from Stat file. [src](https://help.tallysolutions.com/enabling-payroll-in-tallyprime-tally/)
- **NPS company details** — Corporate registration number, Corporate branch office number (CRA). [src](https://help.tallysolutions.com/enabling-payroll-in-tallyprime-tally/)
- **Income Tax company details** — TAN, TAN registration no., IT circle/ward, Deductor type (Government/Others), Deductor branch/division, person responsible (name, son/daughter of, designation, PAN). [src](https://help.tallysolutions.com/enabling-payroll-in-tallyprime-tally/)
- **UAE payroll** — Employer Unique ID in F11; UAE gratuity rules. [src](https://help.tallysolutions.com/payroll-create-gratuity-pay-head-tally/)
- **Predefined pay heads XML** — downloadable XML of common pay heads to import. [src](https://help.tallysolutions.com/payroll-features-of-tally-erp-tally/)

### Employees, groups, categories
- **Employee Category** — Alt+G > Create Master > Employee Category; Allocate Revenue Items / Allocate Non-Revenue Items; for project/location tracking (cost-category-like); Multi Create via Chart of Accounts Alt+H. [src](https://help.tallysolutions.com/payroll-create-employee-categories-tally/)
- **Employee Group** — Name, Under (Primary or nested, e.g., Finance & Compliance > Accounts), Define salary details; Multi Create. [src](https://help.tallysolutions.com/payroll-create-employee-group-master-tally/)
- **Employee master** — Name (on payslip), Under group, Date of joining, Define salary details, General Information (Employee Number, Designation, Location, Gender, Blood Group, Date of Birth, Address…); Provide bank details (For Statutory & Payroll Reports: A/c No., IFS Code, Bank Name, Branch; For Banking: Transaction Type e.g., e-Fund Transfer); statutory: PAN, Aadhaar, UAN, PF number, ESI number, PRAN (F12 to hide); Multi Create employees. [src](https://help.tallysolutions.com/payroll-create-employees-tally/)
- **Applicable Tax Regime per employee** — in employee master Statutory Details, multi-employee creation column, multi-alter (Alt+H). [src](https://help.tallysolutions.com/payroll-changes-in-finance-bill-2020-21-tally/)
- **Employee profile sections** — Basic, General, Bank, Separation (Date of Resignation/Retirement, PF Date of Relieving, Reason for Leaving), Contact, Passport and Visa, Statutory; expat passport/visa/contract numbers & expiry. [src](https://help.tallysolutions.com/all-employees-report-payroll-tally/)

### Payroll units & attendance/production types
- **Units (Work)** — Simple (Symbol, Formal Name, decimal places; e.g., min, Hrs, Pcs) or Compound (First Unit, Conversion, Second/Tail Unit; e.g., Hrs = 60 Mins, box of 10 Nos); tail unit display in reports. [src](https://help.tallysolutions.com/create-payroll-units-tally/)
- **Attendance/Production Types** — Name, Under (Primary or another type → grouping), Attendance type: Attendance / Leave with Pay, Leave without Pay, Production (with Unit, e.g., Overtime hrs, pieces), User Defined Calendar Type (variable working days per month); Period type auto. [src](https://help.tallysolutions.com/create-attendance-or-production-types-payroll/)
- **Exceptions** — Invalid Attendance Type (fix via Alt+H Multi-Alter type & unit); Attendance/Production Type used in Calculation Type invalid (fix in pay head). [src](https://help.tallysolutions.com/invalid-attendance-type/)

### Pay heads
- **Pay head types** — Earnings for Employees; Deductions from Employees; Reimbursements to Employees; Loans and Advances; Employer's Statutory Contributions; Employer's Other Charges; Gratuity; Not Applicable (payable ledgers). [src](https://help.tallysolutions.com/earnings-pay-head-with-calculation-type-as-attendance-payroll/)
- **Common pay head fields** — Name, Pay head type, Income type (Fixed / Variable), Under (ledger group, e.g., Indirect/Direct Expenses, Current Liabilities, Loans & Advances (Asset), Provisions), Affect net salary, Name to be displayed in payslip, Use for calculation of gratuity, Calculation type, Calculation period (Days/Months…), Rounding Method + limit. [src](https://help.tallysolutions.com/earnings-pay-head-with-calculation-type-as-attendance-payroll/)
- **Calculation types** — On Attendance (Attendance/leave with pay type, Not Applicable for LOP deduction; Basis of calculation per day: User Defined / As per Calendar Period / User Defined Calendar Type); As Computed Value (Compute On Specified Formula with Add/Subtract Pay Head, On PF Gross, effective-dated slabs with Amount Greater Than / Amount Up To, Slab Type Percentage or value); Flat Rate; On Production (Production type); As User Defined Value (entered per voucher). [src](https://help.tallysolutions.com/earnings-pay-head-with-calculation-type-as-attendance-payroll/)
- **Earning examples** — Basic (On Attendance), HRA/DA (% of Basic, computed), Conveyance (Flat Rate), Overtime (On Production), Reimbursement (Reimbursements type, Variable, user-defined). [src](https://help.tallysolutions.com/earnings-pay-head-with-calculation-type-as-attendance-payroll/)
- **Variable Pay & Bonus** — Earnings, As User Defined Value (Bonus under Direct Expenses, Variable Pay under Indirect, Income type Variable); paid via separate payroll voucher in payout month. [src](https://help.tallysolutions.com/payroll-create-user-defined-earnings-pay-head-tally/)
- **Pay head Income Tax Details** — Set/Alter Income Tax Details: Income Tax Component (e.g., Bonus, Other Earnings/Allowances (Fully Taxable), Gratuity), Tax Calculation Basis (On Actual Value / projected), Deduct TDS Across Periods (default No for one-time pay). [src](https://help.tallysolutions.com/payroll-computation-based-earning-pay-head-tally/)
- **Deduction pay heads** — Salary Advance Deduction (Loans and Advances, under Loans & Advances (Asset), user-defined); Canteen Deduction (Deductions from Employees, under Current Assets). [src](https://help.tallysolutions.com/payroll-create-loans-and-advances-pay-head-tally/)
- **Payable ledgers as pay heads** — Salary Payable, PF/ESI/NPS Payable (type Not Applicable, under Current Liabilities); PF Admin Expenses ledger with rounding (Normal, limit 1). [src](https://help.tallysolutions.com/payroll-create-payable-ledgers-tally/)
- **Employer statutory contribution pay heads** — Statutory pay type: PF Account (A/c No.1) e.g., EPF 3.67% = Employee EPF 12% − EPS 8.33%; EPS Account (A/c No.10) 8.33% capped at ₹15,000 slab; Employee State Insurance 3.25% on Basic+HRA+OT; National Pension Scheme (Tier-I) 10% of Basic (80CCD(2)); Affect net salary = No; Normal rounding limit 1 (PF wages rounded). [src](https://help.tallysolutions.com/payroll-employers-eps-contribution-pay-head/)
- **Employer's Other Charges** — EDLI Contribution (A/c No.21) 0.5% On PF Gross; PF Admin Charges (A/c No.2) On PF Gross capped ₹15,000; revisions effective-dated (Start Type Copy From Previous Value / Start Afresh); NPS can be Flat/User Defined (then NPS Process in autofill). [src](https://help.tallysolutions.com/payroll-employers-eps-contribution-pay-head/)
- **Gratuity pay head** — type Gratuity, Under Provisions, Gratuity Period screen with slab rates; statutory IT component auto Gratuity; UAE: separate pay heads for Limited and Unlimited contract; Gratuity Summary report. [src](https://help.tallysolutions.com/payroll-create-gratuity-pay-head-tally/)
- **Statutory deduction pay heads (index)** — PF, ESI, NPS, Professional Tax, Income Tax employee deductions; overriding exemption value / tax value. [src](https://help.tallysolutions.com/payroll-masters/)

### Salary structure
- **Define Salary** — Alt+G > Alter Master > Define Salary; employee or group; Effective From; pay heads list with rates; copy from employee / employee group / parent group / start afresh (F12 Allow copy from Employee); group structure inherited by employees. [src](https://help.tallysolutions.com/define-salary-structure-for-employees-and-employee-groups/)
- **Increments & arrears** — new Effective From with Start Type Copy From Previous Value, revise rates; retrospective revision → arrear processing. [src](https://help.tallysolutions.com/salary-increments-and-arrear-calculations-tally/)
- **Show All Periods (Alt+W)** — view/remove pay heads across all effective periods (e.g., drop Salary Advance Deduction after recovery). [src](https://help.tallysolutions.com/tracking-loans-advances-tally/)
- **Previous employer details** — income/exemption/tax paid for IT computation & Form 16. [src](https://help.tallysolutions.com/payroll-features-of-tally-erp-tally/)

### Payroll vouchers
- **Attendance voucher** — F10 > Attendance; rows Employee Name, Attendance/Production Type, Value (days/units); Ctrl+F Autofill (Attendance Autofill: Voucher Date, Employee Category, Employee/Group, Attendance/Production Type, Default Value to Fill, Sort by name/number; creation only); production entry for piece-rate workers. [src](https://help.tallysolutions.com/create-attendance-or-production-vouchers-payroll-tally/)
- **Attendance import from Excel / biometric** — mapping templates per attendance type; "Unique values for creating vouchers" = Every Blank Row. [src](https://help.tallysolutions.com/map-attendance-data-from-excel/)
- **Payroll voucher (Ctrl+F4)** — Ctrl+F Payroll Autofill: Process for Salary / User Defined / NPS Process etc.; From/To dates; Employee Category; Employee/Group; Sort by; Payroll/Bank/Cash Ledger; Use Mode of Payment/Transaction Type. [src](https://help.tallysolutions.com/salary-payment-tally/)
- **Accrual vs cash** — accrue to Salary Payable via payroll voucher then Payment voucher autofill (Payroll Ledger = Salary Payable, Bank, mode, Set Employee-wise Bank Allocations); or direct salary payment. Arrears paid same way. [src](https://help.tallysolutions.com/salary-payment-tally/)
- **Salary advance** — Payment voucher Dr Salary Advance Deduction with employee cost-centre allocation; recovery via payroll voucher (full or instalments); carry forward unrecovered balance to next year. [src](https://help.tallysolutions.com/tracking-loans-advances-tally/)
- **Employer contribution** — payroll vouchers for PF/ESI/NPS/PF Admin accrual. [src](https://help.tallysolutions.com/payroll-features-of-tally-erp-tally/)
- **Statutory payments** — Payment voucher Ctrl+F Autofill: Process for PF Challan / ESI Challan / Professional Tax Payment / NPS Payment / Income Tax Challan; Payroll Ledger; Bank/Cash; Provide Details (challan details); print Print PF Challan / Print ESI Challan / Print Income Tax Challan; penalties, interest, late fees. [src](https://help.tallysolutions.com/pf-payment-tally/)
- **Payment advice** — bank payment advice with employee details before salary transfer. [src](https://help.tallysolutions.com/payroll-features-of-tally-erp-tally/)

### Payslips
- **Single pay slip** & **Multi-Employee Pay Slips** — Alt+G Multi-Employee Pay Slips; columns Particulars, Employee Number, Account No., Bank Name & Branch, Amount, E-Mail ID; Enter → single slip; F4 category/group, F5 employee-wise. [src](https://help.tallysolutions.com/multi-pay-slip-tally/)
- **Payslip sharing** — Print (Ctrl+P), E-mail (Ctrl+M), WhatsApp (Ctrl+Alt+W); Ctrl+H Pay Sheet; Ctrl+J employees without e-mail; tax regime shown on Pay Slip, Pay Sheet, Payroll Statement, Employee Profile. [src](https://help.tallysolutions.com/multi-pay-slip-tally/)

### Statutory: PF / ESI / PT / NPS
- **PF Monthly Statement** — Payroll Reports > Statutory Reports > Provident Fund; C configure period, category, group, sorting, display name; columns Emp No, PF Number, Name, Worked Days, Earned Wages, Employee (PF, VPF, Total), Employer (EPS, EPF, Total). [src](https://help.tallysolutions.com/monthly-statement-pf-tally/)
- **PF forms & ECR** — Form 3A, 5, 6A, 10, 12A; E-Challan cum Return (ECR) text export (C configure, E export; non-contribution days via attendance voucher) for EPFO portal. [src](https://help.tallysolutions.com/payroll-e-challan-returns-tally/)
- **ESI Monthly Statement** — columns Employee No, Name, ESI No, Worked Days, Fixed Wages, Earned Wages, Employee's Contribution, Employer's Contribution, Total. [src](https://help.tallysolutions.com/monthly-statement-esi-tally/)
- **ESI Form 3 & E-Return** — Form 3 (Name, Distinguishing Number, Father's/Husband's Name, Insurance No.); E-Return export (E Send); also Form 5, Form 6. [src](https://help.tallysolutions.com/payroll-esi-form-3-tally/)
- **Professional Tax** — PT Monthly Statement (employee-wise), PT Computation (employer payable). [src](https://help.tallysolutions.com/payroll-features-of-tally-erp-tally/)
- **NPS** — NPS Summary; Subscriber Contribution Details (Tier-I employer, Tier-I/II employee); PRAN Not Available. [src](https://help.tallysolutions.com/payroll-features-of-tally-erp-tally/)
- **Payroll Statutory Summary / Statutory Pay Head Details** — due vs paid per component; drill Pay Head Type → Pay Head → Employee Breakup → Employee Vouchers; Ctrl+J TDS Variance. [src](https://help.tallysolutions.com/payroll-employee-breakup-of-pay-head-tally/)

### Income tax (salary TDS)
- **Tax regimes** — Regular (old) and New u/s 115BAC (from FY 2020-21); Declarations > Employee Tax Regime with effective-from per employee; exemption screens filter by regime. [src](https://help.tallysolutions.com/payroll-changes-in-finance-bill-2020-21-tally/)
- **Income Tax Declarations** — HRA (rent & place of accommodation), Transport Allowance (physical status), Children Education / Hostel Allowance (number of children), Income Declared by Employee, Chapter VI-A Investments (80C, 80CCF, 80CCG…) and Others (80D, 80DD, 80E, 80EEA housing loan interest, 80EEB EV loan interest); modes Single Employee Multiple Components / Multiple Employees Single Component; Declared vs Proof/Eligible → Qualifying Amount. [src](https://help.tallysolutions.com/payroll-changes-in-finance-bill-number-2-2019-20-tally/)
- **Payroll Income Tax Configurations** — define values for allowances; Perquisites u/s 17(2) Form 12BA (e.g., Excess Employer Contribution towards NPS/Superannuation/PF over ₹7.5 lakh: Effective From, value, recovered, chargeable, tax paid by employer u/s 192(1A)). [src](https://help.tallysolutions.com/payroll-changes-in-finance-bill-2020-21-tally/)
- **Income Tax Computation report** — Form 16 format per employee; Standard Deduction (₹50,000 from 2019-20); Tax on Total Income slab drill-down; 87A rebate (₹12,500 up to ₹5L old; new regime FY25-26 limit ₹12L, max ₹60,000); marginal relief ₹12,00,001–₹12,70,590; regime-specific slabs; override exemption/tax values. [src](https://help.tallysolutions.com/payroll-changes-as-per-finance-bill-2025-26/)
- **Salary Projection report** — earnings/deductions considered for tax. [src](https://help.tallysolutions.com/payroll-features-of-tally-erp-tally/)
- **Returns & certificates** — Form 24Q (Annexure I quarterly, Annexure II Q4) & E-24Q export (FVU validation); Form 16; Form 12BA; Form 27A; ITR-1 print; TDS Variance report. [src](https://help.tallysolutions.com/payroll-features-of-tally-erp-tally/)
- **Income Tax Challan Reconciliation** — Alt+R Reconcile; set challan details. [src](https://help.tallysolutions.com/challan-reconciliation-payroll/)

### Payroll reports
- **Employee Profile (All / Single / Group)** — Alt+G Employee Profile; category & group filters; F4 / Ctrl+B by tax regime; F12 Show Resigned/Retired Employees, Show Separation details; Ctrl+J Passport Expiry, Visa Expiry, Contract Expiry, Employees Without PAN / PRAN / Email IDs. [src](https://help.tallysolutions.com/all-employees-report-payroll-tally/)
- **Expat reports** — Expat Passport Expiry / Visa Expiry / Contract Expiry; F4, F5 employee-wise; Ctrl+B Show all Employees / Show Expiry in Days / Number of days to Expiry. [src](https://help.tallysolutions.com/expat-reports-for-passport-expiry-visa-expiry-contract-expiry-payroll/)
- **Employee Head Count** — monthly opening, joined, resigned/retired, closing; earnings, deductions, net salary; F12 Show Earnings and Deductions Breakup, Show Salary paid & Balance Amount. [src](https://help.tallysolutions.com/payroll-employee-head-count-report-tally/)
- **Attendance Sheet** — present/absent days, units produced, OT hours; F4 employees; F12 Remove zero-valued transactions, Show Employees by Categories & Groups, Show Category/Group Total, Show Attendance/Production Groups, Show tail unit of Production Types. [src](https://help.tallysolutions.com/attendance-sheet-payroll/)
- **Attendance Register** — voucher counts per month incl. cancelled; F4 voucher type; Ctrl+H Daily/Weekly/Fortnightly/Quarterly/Half-Yearly; F12 Show Optional Vouchers. [src](https://help.tallysolutions.com/attendance-register-payroll/)
- **Payroll Register** — monthly payroll voucher count incl. cancelled & Excel-imported; Ctrl+H periodicity; F12 Show Optional Vouchers. [src](https://help.tallysolutions.com/payroll-register-tally/)
- **Employee Pay Head Breakup** — opening, Dr/Cr, closing per pay head per employee; drill Employee Summary → Monthly Summary → Vouchers; F4 pay head; Ctrl+H Payroll Statement, Ledger Cost Centre Breakup. [src](https://help.tallysolutions.com/payroll-employee-pay-head-breakup-tally/)
- **Employee Vouchers** — Ctrl+B All / Credit only / Debit only; Ctrl+H Monthly Summary, Pay Head Employee Breakup, IT Computation, Salary Projection. [src](https://help.tallysolutions.com/payroll-employee-vouchers-tally/)
- **Payroll Statement** — per pay head or ledger; F4 category/group; Ctrl+H Employee Pay Head Breakup, Ledger Cost Centre Breakup. [src](https://help.tallysolutions.com/payroll-statement-tally/)
- **Other reports (index)** — Pay Sheet, Payment Advice, Employee E-mail IDs (view/update), Other Records (personal/contact/bank), PAN Not Available, Pay Head Employee Breakup, Gratuity Summary. [src](https://help.tallysolutions.com/payroll-reports/)

Irrelevant/unreadable/duplicate files skipped: tally_prime_edit_log & tracking_modifications (edit log, in 01-core), accept_invoices_share_payment & send_invoices_and_receive_payments (Bharat Connect), invoice_already_exist_with_different_ctin (GST), receivables_payables_tracking_methods & set_up_receivables_and_payables_tracking (accounting), tally_prime_inventory_inventory (duplicate of inventory_tally); payroll_masters/payroll_reports/payroll_transactions/payroll_updates_as_per_finance_bill are index pages (titles only).


# TallyPrime — Banking, Outstanding & Cost Control; Reports & Analysis

Source: TallyHelp crawl (job4). Option-level catalog; keyboard paths as documented.

## A. Banking, Outstanding & Cost Control

### Banking overview (PrimeBanking, Rel 6.0+)
- **Banking Utilities hub** — Gateway of Tally > Banking; covers Connected Banking, e-Payments, Payment Request (link/QR), cheque printing, PDC, deposit slips, payment advice, bank statement import, BRS. "PrimeBanking" branding from Release 6.0. [src](https://help.tallysolutions.com/banking/)
- **Auto-create vouchers from bank statement** — single voucher; multiple vouchers with common or separate ledgers; merge multiple bank lines into one consolidated voucher; >250 banks supported. [src](https://help.tallysolutions.com/banking/)
- **Bank reconciliation coverage** — >250 banks (statement import page says >145 / >200 banks for Excel/CSV import). [src](https://help.tallysolutions.com/banking/) [src](https://help.tallysolutions.com/bank-reconciliation-tally/)
- **e-Payments coverage** — 18 banks supported; bulk payments; reconcile via Payment Reverse File. [src](https://help.tallysolutions.com/banking/)
- **Payment Request** — create merchant profile (Payment Gateway or UPI); generate link/QR after recording, while saving, for one/many transactions from Day Book, Ledger Vouchers, Ledger Outstandings; print/export/e-mail invoices & reports with link/QR; track generated/pending links; reconcile Payment Gateway transactions. [src](https://help.tallysolutions.com/banking/)
- **Cheque facilities** — print cheque details in payment voucher; print cheque to withdraw cash; view cheques to be printed; record/track PDCs; post-dated transactions with Notional Bank; predefined & user-defined cheque formats. [src](https://help.tallysolutions.com/banking/)
- **Deposit slips / payment advice** — deposit slips for cash, cheque, DD received; payment advice after paying by cheque, cash or e-Payment. [src](https://help.tallysolutions.com/banking/)
- **Video topics** — online payments via Connected Banking for Axis, Kotak Mahindra, SBI (enable from Manage Connection report); payment advice via Connected Banking; transaction limits; get payment status online; e-Payments walkthroughs for Bandhan, Bank of Baroda, DBS, ICICI (export Payment Instruction file → upload to bank portal → download Intermediate file → reconcile → handle exceptions in e-Payments report); UPI QR & gateway payment links incl. QR on ledger vouchers, outstanding reports, reminder letters; payment-gateway ledger with manual/auto reconciliation via gateway statement import and contra entries. [src](https://help.tallysolutions.com/banking-videos/)

### Bank ledger setup
- **Create bank ledger** — Alt+G > Create Master > Ledger; Under = Bank Accounts (savings/current). [src](https://help.tallysolutions.com/banking-setup/)
- **A/c Holder's Name** — prefilled with company name, editable. [src](https://help.tallysolutions.com/banking-setup/)
- **A/c No.** — own account number. [src](https://help.tallysolutions.com/banking-setup/)
- **IFS Code** — validated against each bank's prescribed format; warning shows correct format. [src](https://help.tallysolutions.com/banking-setup/)
- **SWIFT Code** — for international payments. [src](https://help.tallysolutions.com/banking-setup/)
- **Bank Name** — pick from List of Banks (needs active TSS + internet); downstream bank configuration depends on bank chosen. [src](https://help.tallysolutions.com/banking-setup/)
- **Branch**, **BSR Code** — BSR shown only if TDS enabled in F11. [src](https://help.tallysolutions.com/banking-setup/)
- **Client Code** — bank-issued customer identifier; shown only for Kotak Mahindra, Bank of Baroda, Yes Bank; mandatory in payment instruction file (Yes Bank: delimited "|" format). [src](https://help.tallysolutions.com/banking-setup/)
- **Bank Configuration** — sub-screens: Configure for e-Payments, for Bank Reconciliation, for Cheque Printing; also "Record receipts for uncertain banks". [src](https://help.tallysolutions.com/banking-setup/)
- **Cost centres on bank ledger** — F11 > Enable Cost Centres; ledger F12 > Apply Cost Centres for Ledgers; per-ledger Ctrl+I (More Details) > Cost centre applicability = Yes. [src](https://help.tallysolutions.com/banking-setup/)

### Party bank details / beneficiaries
- **Provide bank details** (party ledger, Banking Details) — Ref ID, Transaction Type (e-Fund Transfer), A/c No, IFS Code, Bank Name, Set as default. [src](https://help.tallysolutions.com/banking-setup/)
- **Allow multiple beneficiary details** — ledger F12; multiple accounts per party with one default. [src](https://help.tallysolutions.com/banking-setup/)
- **Bulk import beneficiaries from Excel** — Alt+O (Import) > Bank Details; Alt+B Payee Sample file, Alt+H Employee Sample file; E (Send) to save, C (Configure) to set folder; .xlsx; Ledger Name must match; multiple accounts per party with Ref ID. [src](https://help.tallysolutions.com/banking-setup/)

### Banking security
- **Security for e-Payments** — user role can be disallowed from viewing/using e-Payments reports. [src](https://help.tallysolutions.com/banking-setup/)
- **Security for Connected Banking** — Alt+K > User Roles > Disallow facilities, e.g. "Balance as per Bank – Connected Banking (Tile)" on Dashboard. [src](https://help.tallysolutions.com/banking-setup/)

### Cheque payments (overview)
- **Cheque capabilities** — print from payment vouchers/contra; formats per bank; cheque-number range stored in bank ledger with auto-assignment from last used number; alter predefined cheque dimensions; user-defined cheque format; amount in lakhs/millions by supplier country; disable company name on pre-printed cheques; blank cheques; multiple cheque books per bank. [src](https://help.tallysolutions.com/banking-cheque-printing-tally/)
- **Print scenarios** — vendor payments, cash withdrawal (contra), PDC payments; print selected / all cheques at once; print without date and fill later; print cheque details in payment voucher. [src](https://help.tallysolutions.com/banking-cheque-printing-tally/)
- **Cheque tracking** — Cheque Printing report & Cheque Register statuses: pending print, issued, available for future, blank, reconciled/unreconciled; filter by bank, by range. List of bank cheque formats needs internet. [src](https://help.tallysolutions.com/banking-cheque-printing-tally/)

### Bank reconciliation — setup & concepts (Rel 6.0+)
- **Modes** — automatic (statement-based) or manual (enter Bank Date). Auto recommended. [src](https://help.tallysolutions.com/bank-recon-setup/)
- **Reconciliation Beginning Date** — set in bank ledger; transactions before it entered as **Opening BRS**. Switching manual→auto: reconcile all up to a date first, then import statements. [src](https://help.tallysolutions.com/bank-recon-setup/)
- **Statement formats** — Excel, CSV, MT940; Rel 6.0+. [src](https://help.tallysolutions.com/bank-reconciliation-tally/)
- **Reconcile methods** — Exact Match, Potential Match, Find Match, Partial Match, alter transaction, Set Status; corrections via Modify Match / Unlink. [src](https://help.tallysolutions.com/bank-reconciliation-tally/)

### Bank statement import
- **Import path** — Gateway > Alt+O (Import) > Bank Statement; fields: Bank Ledger, File Path, File Type (Supported), File to Import, Show Preview (Yes) → Ctrl+A → Bank Statement Preview → I (Import). [src](https://help.tallysolutions.com/bank-statement/)
- **Summary of Imported Statement** — total entries imported + exact matches; S jumps to Bank Reconciliation Summary. [src](https://help.tallysolutions.com/bank-statement/)
- **Alternative source** — Get Statement via Connected Banking. [src](https://help.tallysolutions.com/bank-statement/)
- **Reset bank statement data** — undo wrong-period import. [src](https://help.tallysolutions.com/bank-statement/)
- **Unsupported bank** — request via Tally Support. [src](https://help.tallysolutions.com/bank-reconciliation-tally/)

### Auto bank reconciliation
- **Exact Match** — auto-linked on open; select one/many, F8 (Reconcile). [src](https://help.tallysolutions.com/auto-bank-reconciliation/)
- **Select & reconcile** — 1 book:1 bank, many book:1 bank, 1 book:many bank; mismatched amounts → Partially Reconciled. Ctrl+F filter by amount/instrument no. across both sides. [src](https://help.tallysolutions.com/auto-bank-reconciliation/)
- **Potential Matches** — Alt+S; matched on Instrument Date, Amount, Party; views via Ctrl+H: Books (As per Rules) [default], Bank (As per Rules), Books/Bank (As per Transactions); Rel 7.1 summary-by-rule view with counts and drill-down. [src](https://help.tallysolutions.com/auto-bank-reconciliation/)
- **Potential Match Configuration** (Alt+S inside) — Default Rules (all enabled); Other Settings: Ignore difference in Amount (greater than / lesser than / greater or lesser than + Amount); Ignore zeroes prefixed in References; Ignore special characters in References; Find Potential Matches within N days (default 30; 0 = same date). [src](https://help.tallysolutions.com/auto-bank-reconciliation/)
- **Find Matches** — F8 on an Only-in-Books/Only-in-Bank line → Find Matches screen; F9 (Add), R (Reconcile). [src](https://help.tallysolutions.com/auto-bank-reconciliation/)
- **Partial match completion** — alter book voucher so amounts match; or F8 > Modify Matches > F9 Add another txn, or F7 (Create Vch) e.g. bank charges, then R. [src](https://help.tallysolutions.com/auto-bank-reconciliation/)
- **Set Status** (F9) — Transaction Status Reconciled / System Inferred (to revert); Instrument Number (written back to voucher if blank); Bank Date; appears under "Reconciled Manually". [src](https://help.tallysolutions.com/auto-bank-reconciliation/)
- **Modify Match** (F8 on reconciled) — F10 Remove, F9 Add from Unreconciled. [src](https://help.tallysolutions.com/auto-bank-reconciliation/)
- **Unlink** (Alt+F8) — for wrongly linked partial matches, optional vouchers linked to bank data, exact matches. [src](https://help.tallysolutions.com/auto-bank-reconciliation/)

### Bank reconciliation reports
- **Banking Activities** — Alt+G > Banking Activities; e-Payments counts (Pending for Sending to Bank; Sent to Bank – Unreconciled) + BRS counts (Available Only in Books / Only in Bank). [src](https://help.tallysolutions.com/bank-recon-reports/)
- **Banking Activities views** — F4 Bank Ledger; F5 Amount View; Ctrl+H Deposits & Withdrawals – Unreconciled; Alt+F5 Detailed (A/c No., Date of Last Entry in Statement); Ctrl+B Include Post-dated Vouchers. [src](https://help.tallysolutions.com/bank-recon-reports/)
- **Banking Activities actions** — Alt+H Opening BRS; inside it Alt+R Set Recon Beginning Date. [src](https://help.tallysolutions.com/bank-recon-reports/)
- **Banking Activities F12** — Show Balance as per Company Books; Show Balance as per Bank Statement; Exclude Bank Ledgers with zero Balance; Use Manual Reconciliation as the default mode; Default Period for Unreconciled transactions (Previous Financial Period [default] / Current Financial Period / As per Reconciliation Beginning Date). [src](https://help.tallysolutions.com/bank-recon-reports/)
- **Bank Reconciliation Summary** — rows: Balance as per Company Books; Unreconciled Transactions from <date>; Available Only in Books (count, deposit/withdrawal); Available Only in Bank; Reconciled in Subsequent Period; Expected Bank Balance; Balance as per Bank Statement (suffixed "as of date" if last import before recon date); Difference. [src](https://help.tallysolutions.com/bank-recon-reports/)
- **BRS Summary views/actions** — F4 Bank Ledger; Ctrl+H Deposits & Withdrawals – Unreconciled / Opening BRS / View Reconciled; Ctrl+B Include Post-dated; Alt+R Manual Recon; F5 View Reconciled. [src](https://help.tallysolutions.com/bank-recon-reports/)
- **BRS Summary F12** — Show Pending e-Payments; Show Balance as per Bank Statement (default Yes); Show Unreconciled Transactions from Previous Period; Show Available Balance as per Bank (connected ledgers); Default Period for Unreconciled transactions. [src](https://help.tallysolutions.com/bank-recon-reports/)
- **Bank Reconciliation report** — all reconciled + unreconciled; F4 Bank Ledger; Ctrl+B Include Post-dated; switch to Bank Reconciliation (Manual); actions Create Vouchers, auto-reconcile, F9 Set Status; F12 Show Available Balance as per Bank, Show e-Payment Status. [src](https://help.tallysolutions.com/bank-recon-reports/)
- **Reconciled Transactions – Monthly Summary** — count per month; drill to "Reconciled via Linking" and "Manually Reconciled"; F8 Modify Match, Alt+F8 Unlink, F9 Set Status. [src](https://help.tallysolutions.com/bank-recon-reports/)
- **Imported Bank Data** — Alt+G > Imported Bank Data (or Gateway > Banking); per bank, deposit/withdrawal counts & amounts, closing balance per statement; F2 period; F6 Monthly, Alt+F6 Quarterly; F5 Recon View (Reconciled vs Unreconciled); Create Vouchers; F8 Reconcile/Modify; Alt+F8 Unlink; F9 Set Status; Alt+S Potential Matches; Ctrl+J > Optional Vouchers (Bank Data); Ctrl+B include/exclude by recon status; F12 Show Mode of Import, Show Available Balance as per Bank. [src](https://help.tallysolutions.com/bank-recon-reports/) [src](https://help.tallysolutions.com/bank-statement/)

### Budgets
- **Budget master** — Alt+G > Create Master > Budgets; Name, Under (Primary or parent budget → hierarchy), Period of Budget (From/To); Set/Alter Budgets of: Groups / Ledgers / Cost Centres. [src](https://help.tallysolutions.com/budgets-tally/)
- **Type of Budget** — On Nett Transactions (period Dr less Cr, ignores opening/closing) or On Closing Balance (balance incl. opening). [src](https://help.tallysolutions.com/budgets-tally/)
- **Ledger Budget / Group Budget screens** — Account/Group Name, Type of Budget, Amount; group budget applies to all ledgers under it (e.g. Indirect Expenses, Sundry Debtors). [src](https://help.tallysolutions.com/budgets-tally/)
- **Cost Centre Budget** — Cost Centre, Expenses, Income, Closing Balance columns; needs Enable Cost Centres. [src](https://help.tallysolutions.com/budgets-tally/)
- **Multiple budgets** — e.g. bank, head office, departmental; no effect on books; delete anytime (Alt+D) even with transactions. [src](https://help.tallysolutions.com/budgets-tally/)
- **Budget Variance** — F10 (Budget Variance) in Trial Balance, Group Summary, Monthly Summary; adds budget column vs actuals; negative = overspend; active only once ≥1 budget exists. [src](https://help.tallysolutions.com/budgets-tally/)

### Loans & advances
- **Carry forward salary advance** — new ledger under Loans and Advances (Asset) with opening = closing of Salary Advance pay head; Journal Dr pay head (with employee category/employee) Cr ledger; then continue recovery. [src](https://help.tallysolutions.com/carry-forward-balance-loans-advances/)

### Cheque range, format & printing setup
- **Set/Alter Bank configuration** — ledger toggle (Rel 5.1 and earlier: cheque config directly on ledger screen). [src](https://help.tallysolutions.com/cheque-payments-set-up/)
- **Set/Alter range for Cheque Books** — Cheque Book Management: From Number, To Number, Number of Cheques (auto from either pair), Name of Cheque Book; multiple books per bank; cheque no. auto-assigned in transactions; manual override allowed; track assigned/unassigned. [src](https://help.tallysolutions.com/cheque-payments-set-up/)
- **Enable Cheque Printing / Set/Alter Cheque Printing configuration** — Cheque Format Selection lists formats supported for the selected Bank Name (internet needed). [src](https://help.tallysolutions.com/cheque-payments-set-up/)
- **Cheque Dimensions** — edit predefined dimensions; Alt+B (Copy From) List of Configured Banks; Alt+L (User Defined) format. [src](https://help.tallysolutions.com/cheque-payments-set-up/)
- **Sample Cheque Printing** — Ctrl+P > P print / I preview; C (Configure) Cheque Alignment: Horizontal (landscape) / Vertical-Centre / Vertical-Left / Vertical-Right. [src](https://help.tallysolutions.com/cheque-payments-set-up/)
- **Print Company Name on Cheque** — Company Signatory Details, set No for shared multi-branch cheque books. [src](https://help.tallysolutions.com/cheque-payments-set-up/)
- **Amount in millions** — Alt+K > Alter > F12 Provide Additional Base Currency details > Show amount in millions? (1,000,000 vs 10,00,000) — applies to books and cheques. [src](https://help.tallysolutions.com/cheque-payments-set-up/)
- **Exception "Cheque No. is not within Cheque Range / Invalid / Mismatch"** — fix via voucher Bank Allocations: Cheque Range + Instr No. [src](https://help.tallysolutions.com/cheque-no-is-not-within-cheque-range/)

### Cheque Register
- **Open** — Alt+G > Cheque Register; columns per bank: Available, Unreconciled, Reconciled, Blank, Cancelled, Out of Period (issued in previous FY or post-dated beyond current FY). [src](https://help.tallysolutions.com/cheque-register/)
- **F8 Cheque Status** — filter all banks by one status. [src](https://help.tallysolutions.com/cheque-register/)
- **Alt+B Alter Chq Book** — opens Cheque Book Management. [src](https://help.tallysolutions.com/cheque-register/)
- **Blank/Cancelled actions** — issue a blank cheque to a party from the report; cancel an available or issued cheque. [src](https://help.tallysolutions.com/cheque-register/)
- **Cheque Range Register** — drill from bank to see each range (e.g. per department/party). [src](https://help.tallysolutions.com/cheque-register/)
- **Ctrl+B options** — Include Not in Range cheques; Ignore completed Cheque Ranges. [src](https://help.tallysolutions.com/cheque-register/)
- **Ctrl+J** — post-dated transactions; **Alt+Q Quick Search** by cheque no./bank/party; **Alt+R Reconcile** jumps to Bank Reconciliation; F2 period. [src](https://help.tallysolutions.com/cheque-register/)

### Cash Withdrawals/Deposits to Bank (analysis report)
- **Path** — Display More Reports > Analysis & Verification > Data Analysis > Cash Withdrawals/Deposits to Bank; per bank ledger: Voucher Type/No., amount, Instrument Date, Bank Date, Number of Days delayed, Verification Status/Note; missing deposit date → last day of analysis period. [src](https://help.tallysolutions.com/cash-withdraw-deposit-to-bank-tally/)
- **Buttons** — F2 Period; F4 Ledger; F5 Condensed / Alt+F5 Detailed; F8 Show Ledger; F9 Analysis & Ver Reports (jump list); Alt+J Set Manual Sampling; Alt+L Delete Manual Sampling; Alt+Q Reconcile (enter Bank Date); Alt+R Verify; Alt+S Remove Verify; Alt+F12 Range; Ctrl+F12 Value. [src](https://help.tallysolutions.com/cash-withdraw-deposit-to-bank-tally/)
- **F12** — Show Narrations; Show Received From (Cash); Show Transaction Type (Inter Bank Transfer, Cheque deposit…); Show Instrument No.; Show Transaction of (All Items / Deposits / Withdrawals); Show Verification Status (On Hold/Altered/Clarified/Internal Observation/External Observation/Internal Observation Clarified/Not Verified/Verified); Show Verification Note (default Yes); Show Client's Clarification; Show Date and Time; Show Verified By; Show Clarification from; Show No. of Days Delayed; Include Exceptional Vouchers (optional); Sorting Method (Alphabetical / Amount-wise / No of Days Delayed). [src](https://help.tallysolutions.com/cash-withdraw-deposit-to-bank-tally/)

### Connected Banking (Rel 6.0; security Rel 7.0)
- **Supported banks** — Axis Bank, State Bank of India, Kotak Mahindra Bank (+ ICICI account types page); per-bank account/platform/login types. [src](https://help.tallysolutions.com/connected-banking/)
- **Setup** — link mobile number to Tally.NET ID; forced Tally.NET password change if policy outdated; connect bank accounts; reconnect/disconnect anytime; log in/out; needs valid TSS + active licence (not Educational mode). [src](https://help.tallysolutions.com/connected-banking/)
- **Admin vs non-admin** — Tally.NET admin and non-admin users; non-admin needs approval from admin (the one who connected accounts). [src](https://help.tallysolutions.com/connected-banking/) [src](https://help.tallysolutions.com/connected-banking-security/)
- **Features** — Get Bank Balance; Get Bank Statement; Send online payments (Axis, SBI, Kotak). [src](https://help.tallysolutions.com/connected-banking/)
- **2FA login** — Tally.NET password + OTP to registered mobile; SBI multi-user/multi-admin: users pre-registered with mobile numbers on bank portal. [src](https://help.tallysolutions.com/connected-banking-security/)
- **Online payments toggle** — disabled by default; enable/disable per bank connection with OTP. [src](https://help.tallysolutions.com/connected-banking-security/)
- **Bank OTP per payment** — bank-sent OTP confirms each payment. [src](https://help.tallysolutions.com/connected-banking-security/)
- **Transaction limits** — single and daily limits per bank account; increasing a limit needs OTP, triggers e-mail notification, and activates after a 12-hour cooling period. [src](https://help.tallysolutions.com/connected-banking-security/)
- **Role-based restrictions (Rel 7.0)** — disallow: entering/modifying bank details; sending online payments; sending payments where bank details mismatch masters; viewing/using e-payment reports. [src](https://help.tallysolutions.com/connected-banking-security/)
- **Security posture** — encrypted API, ISO/IEC 27001:2022 practices. [src](https://help.tallysolutions.com/connected-banking-security/)

### e-Payments: banks & enablement
- **18 banks** — DBS (online status refresh, no offline reverse-file import), Standard Chartered (India, UAE), Kotak (CMS enrolment; reverse files from CMS portal), YES (no reverse file), ICICI (TallyPrime CMS format, ICICI_WEH128 encryption tool path + Customer Code + Format Code in ledger; reverse file import), Federal, MUFG Tokyo-Mitsubishi, HDFC (CBX/ENet; RBI adapter format for vendors, Nestle pay format for salary), Bank of Baroda, Citibank, RazorpayX, Axis, AU Small Finance, IDFC First, South Indian, Bandhan, Indian Bank; SBI payment-instruction export "upcoming". [src](https://help.tallysolutions.com/contact-details-of-banks-for-e-payment/)
- **Export from voucher or report** — completed e-payments exportable at voucher level or from e-Payments report. [src](https://help.tallysolutions.com/contact-details-of-banks-for-e-payment/)

### Cost centres, categories & classes
- **Cost Centre master** — Alt+G > Create Master > Cost Centre (prompts to enable feature); Name & aliases; Under (Primary or parent → hierarchy); Category. [src](https://help.tallysolutions.com/cost-centre-or-profit-centre-tally/)
- **Cost Centre F12** — Provide aliases for Name; Provide language aliases; Use grouping for Cost Centres; Set Opening Balance for Revenue Items in Reports; Set Bank details for Cost Centres (bank transaction type); Provide E-mail ID. [src](https://help.tallysolutions.com/cost-centre-or-profit-centre-tally/)
- **Multi-master create/alter** — from Chart of Accounts. [src](https://help.tallysolutions.com/cost-centre-or-profit-centre-tally/)
- **Ledger applicability** — "Cost centres are applicable" default Yes for income/expense, No for asset/liability; ledger F12 Apply Cost Centres for Ledgers. [src](https://help.tallysolutions.com/cost-centre-or-profit-centre-tally/)
- **Cost Centre Allocations screen** — per ledger line: Cost Category, Name of Cost Centre, Amount; must allocate full amount. [src](https://help.tallysolutions.com/cost-centre-or-profit-centre-tally/)
- **Cost Category (parallel allocation)** — default "Primary Cost Category" (renamable); unlimited categories; flags Allocate Revenue Items / Allocate Non-revenue items (≥1 required); deletable only if empty. [src](https://help.tallysolutions.com/cost-centre-or-profit-centre-tally/)
- **Cost Centre Class** — F11 > Ctrl+I > Cost Centre Class; Class Name + Category + Cost Centres + % allocation; voucher F12 "Select Cost Centre/Class" = Yes then pick class → auto allocation. [src](https://help.tallysolutions.com/cost-centre-or-profit-centre-tally/)
- **Disable** — per ledger "Cost centres are applicable" = No; all ledgers via F12 Apply Cost Centres = No; delete centre only after moving allocations; reports hidden while disabled. [src](https://help.tallysolutions.com/cost-centre-or-profit-centre-tally/)
- **Exception "Parent Group is set as Cost Centre"** — listed exception resolution page. [src](https://help.tallysolutions.com/parent-group-is-set-as-cost-centre/)

### Cost centre reports
- **Ledger Vouchers with cost centres** — F12 Format of Report = Detailed; Show Cost Centre details = Yes. [src](https://help.tallysolutions.com/cost-centre-or-profit-centre-tally/)
- **Cost Centre Break-up** — Display More Reports > Statements of Accounts > Cost Centres > Cost Centre Break-up; group/ledger-wise; Alt+C New Column (another centre), Alt+N Auto Column (incl. Company when multiple open), Alt+A Alter Column, Alt+D Delete Column; F12 include Opening Balance with Transaction & Closing. [src](https://help.tallysolutions.com/cost-centre-or-profit-centre-tally/)
- **Cost Centre Summary** — Alt+F5 detailed; Alt+N. [src](https://help.tallysolutions.com/cost-centre-or-profit-centre-tally/)
- **Cost Centre Monthly Summary** — per month, drill to Cost Centre Vouchers; Ctrl+H to Breakup / Summary; Alt+N. [src](https://help.tallysolutions.com/cost-centre-or-profit-centre-tally/)
- **Cost Category Summary** — Alt+N compare categories; Ctrl+B Scale Factor. [src](https://help.tallysolutions.com/cost-centre-or-profit-centre-tally/)

### Multi-currency / forex
- **Currency master** — Symbol (unique; duplicate symbols auto-prefixed e.g. "U$"), Formal name (unique), ISO Currency Code, Number of decimal places, Show amounts in millions, Suffix symbol to amount, Add space between amount and symbol, Word representing amount after decimal (e.g. Cent), No. of decimal places for amounts in words (≤ decimals). [src](https://help.tallysolutions.com/create-alter-or-delete-currencies/)
- **Alter currency** — Rates of Exchange with specific date; multiple changes per day allowed; base currency alterable. [src](https://help.tallysolutions.com/create-alter-or-delete-currencies/)
- **Delete currency** — only if unused in transactions/ledger opening balances. [src](https://help.tallysolutions.com/create-alter-or-delete-currencies/)
- **Change base currency** — Alt+K > Alter: Base Currency symbol, Formal name; F12 Provide Additional Base currency details; only one base currency; re-define exchange rates after change; default by country (India→INR, USA→USD). [src](https://help.tallysolutions.com/change-base-currency-in-tallyprime/)
- **Forex gain/loss** — unadjusted gain/loss shows as "Unadjusted Forex Gain/Loss" in Balance Sheet; ledger under Indirect Expenses/Income; Journal Voucher Class with "Use Class for Forex Gain/Loss Adjustments" + ledger (one class per currency possible); adjustment moves to P&L; bill-wise details shown for same-currency masters. [src](https://help.tallysolutions.com/account-for-forex-gain-or-loss/)

### Deposit slips
- **Cash Deposit Slip** — Alt+G > Cash Deposit Slip > pick bank; F5 (Cash); contents: A/c No., A/c Holder, Bank, Branch, company telephone, cash denomination details; Spacebar to select receipts, Ctrl+P. [src](https://help.tallysolutions.com/deposit-slips/)
- **Cash slip print options** — Print Cash Deposit Slip (Yes); Show consolidated Cash Deposit Slip (default No; one slip for all selected); C (Configure): Date of Print (default system date), Print Voucher Type/No. [src](https://help.tallysolutions.com/deposit-slips/)
- **Cheque Deposit Slip** — Alt+G > Cheque Deposit Slip; drawer name, A/c Holder, Bank, Branch, Cheque Date, Cheque No., Amount; options: Print Cheque Deposit Slip (default Yes), Date of Print, Top Margin (inches), Show Received From, Show Telephone No., Show Mobile No, Show PAN/Income Tax No. (default Yes). [src](https://help.tallysolutions.com/deposit-slips/)
- **Deposit slip report controls** — F4 change bank; F5 / Ctrl+H toggle Cheque/Cash; F8 Incl Printed or Ctrl+B Include Printed Slips; Ctrl+J optional & post-dated vouchers; Mark Slips as Printed (for migrated data); Alt+H Alter Chq Details (Instrument No., Received From); F12; Alt+F12 Range. [src](https://help.tallysolutions.com/deposit-slips/)

### Connected Banking — enable & login
- **Enable** — Alt+Z (Exchange) > All Banking Options > Login & Logout: Tally.NET ID, password, mobile number to link, View T&C and Privacy Policy (Yes → web accept), OTP (Alt+R Resend OTP). [src](https://help.tallysolutions.com/enable-connected-banking/)
- **Portal alternative** — Tally Customer Portal > MY PROFILE > Connected Banking Services: mobile, accept T&C & Password Policy, 6-digit OTP; update number if changed; reset Connected Banking login if login fails. [src](https://help.tallysolutions.com/enable-connected-banking/)

### e-Payments setup (Rel 6.0)
- **Modes** — Offline: export Payment Instruction file → upload on bank portal; Online: send directly via Connected Banking. [src](https://help.tallysolutions.com/e-payments-tally/)
- **Set/Alter Transfer Mode details for e-Fund Transfer** — From/To amount per mode (e.g. NEFT/RTGS/IMPS), Preferred Mode when ranges overlap; overridable in voucher. [src](https://help.tallysolutions.com/e-payments-set-up/)
- **Enable e-Payments** (bank configuration) — Export/Upload Payment Instructions on voucher creation (Yes/No); Allow export of transactions with mismatch in Bank Details. [src](https://help.tallysolutions.com/e-payments-set-up/)
- **Bank-specific configuration** — e.g. generate Payment Instructions in batches; Product Code by Payment Type or Voucher Type/Class; Client Code; Folder path for new Payment Reverse Files; encryption tool (ICICI). [src](https://help.tallysolutions.com/e-payments-set-up/) [src](https://help.tallysolutions.com/e-payments-recon/)
- **Security** — Alt+K > User Roles: allow e-Payments report; allow all payment types incl. payroll; can disallow recording, report, export. [src](https://help.tallysolutions.com/e-payments-set-up/)

### e-Payments report & statuses
- **Open** — Banking Activities > drill e-Payments column per bank; counts & amounts per section; latest Connected-Banking balance shown on top. [src](https://help.tallysolutions.com/e-payments-report/)
- **Filters** — F4 Bank Ledger; Ctrl+F4 party Ledger; Ctrl+B Payment Type (Payroll / all excl. Payroll), Include Transactions with Exact Match Available in Bank Reconciliation, Include Payments with Transfer Mode; F12 Show Instrument No., Show Instrument Date, etc. [src](https://help.tallysolutions.com/e-payments-report/)
- **Pending for Sending to Bank** sub-sections — Ready for Sending to Bank (Alt+Z Exchange > Send Payments); Incomplete/Incorrect Bank Ledger Master Details (fix A/c No., IFS, SWIFT); Incomplete/Incorrect Transaction Details (fix party A/c/IFS, IBAN for UAE; Alt+S Copy Master Info.; save with A accept / R replace master / D accept & update ledger); Mismatch in Bank Details (With Masters) (Alt+S copy, Alt+J Accept As Is). [src](https://help.tallysolutions.com/e-payments-report/)
- **Sent to Bank (Unreconciled)** — In Progress / Unsuccessful / Successful. [src](https://help.tallysolutions.com/e-payments-report/)
- **Payment Reverse File import** — Alt+O > Payment Reverse File (Delimited; .txt/XLS/CSV) → Exchange Summary with counts per status; DBS: F10 Update Status online. [src](https://help.tallysolutions.com/e-payments-recon/)
- **Manual Set Status (F9)** — On Hold (+Comment), Processed (Inst No.), Reconciled (Inst No. + Bank Date). [src](https://help.tallysolutions.com/e-payments-recon/)
- **F8 Reset Pymt Status** — for rejected (incomplete info e.g. RTGS < ₹2,50,000; approver rejection in SBI multi-user) or failed payments → back to Ready for Sending; edit and resend. [src](https://help.tallysolutions.com/e-payments-recon/)
- **F10 Get Online Payment Status** — all or Spacebar-selected; summary per status incl. Rejected/Failed with error details. [src](https://help.tallysolutions.com/e-payments-recon/)
- **Export payment instructions** — Alt+Z (Exchange) > Send Payments > bank; Ctrl+B Include Transactions with Mismatch in Bank Details; F12 Base Currency, Stripe View; Spacebar select, X (Export) > E; C (Configure): Folder Path (default TallyPrime folder), Open folder after Export. Or Alt+G > e-Payments > Ready for Sending > Alt+E > Payment Instructions. Re-export via F8 Reset Pymt Status. [src](https://help.tallysolutions.com/export-upload-e-payments/)
- **History/misc (FAQ)** — e-Payments default from Rel 1.1 (earlier serial-specific activation); no Tally charge, needs valid TSS; DBS only bank with online+offline; Rel 6.0+ reverse file updates status but does not reconcile; "Intermediate File" import renamed "Payment Reverse File" (shortcut I); cannot exclude transactions from report (use On Hold/Processed/Reconciled; revert On Hold via System Inferred); transactions leave report once reconciled; supports vendor and payroll payments; multiple accounts per bank; Tally.NET ID needed only for DBS online. [src](https://help.tallysolutions.com/faq-banking-tally/)
- **Yes Bank formats** — Format of Payment Instruction file for Export: Delimited (|) – Corporate Net Banking (Rel 1.1.3+) or Fixed Width – Corporate Net Banking. [src](https://help.tallysolutions.com/faq-banking-tally/)
- **RazorpayX caveats** — no future-dated payouts (processed on authorisation date); same file re-upload pays again; name 4–120 chars; IFSC mandatory. [src](https://help.tallysolutions.com/faq-banking-tally/)

### Bank ledger: auto-reconciliation configuration (FAQ)
- **Set/Alter Auto Reconciliation configuration** — Default Voucher Type for voucher creation from Bank Statement: Deposits (Receipt), Withdrawals (Payment); Use a different Voucher Type for Interbank/Cash transactions (Contra/Journal); Voucher numbering series. [src](https://help.tallysolutions.com/faq-banking-tally/)
- **Identify Exact Matches for Reconciliation** — While Importing statement / While Importing statement as well as Saving Voucher; Automatically Reconcile Exact Matches found (Yes/No). Exact match requires Amount + Instrument No. both matching (duplicate instrument nos. block it). [src](https://help.tallysolutions.com/faq-banking-tally/)
- **Set/Alter Opening BRS** (ledger alteration only) — Alt+L Update Opening BRS: Date (< Recon Beginning Date), Particulars, Nature (Deposit/Withdrawal), Transaction Type, Remarks, Amount, Instrument No., Instrument Date (prefilled); Alt+J Delete All. Split company carries unreconciled ≤6 months back (Rel 6.1: all). Not synchronisable. [src](https://help.tallysolutions.com/faq-banking-tally/)
- **Statement import troubleshooting** — Bank Name must be set; CSV must be "CSV (Comma delimited)"; Excel must be .xlsx; "-imp" suffix trick for already-open files; PDF-converted/third-party CSV not supported; unconfigured format → send statement to Tally. [src](https://help.tallysolutions.com/faq-banking-tally/)
- **Reset Bank Statement Data** — F1 > Troubleshooting > Reset Bank Statement Data: Bank Ledger, Retain Reconciliation Status (Yes/No), From/To; deletion is per date range only (not individual lines). [src](https://help.tallysolutions.com/faq-banking-tally/)
- **Reconciliation shortcuts (FAQ)** — F6 Show Exact Matches + Ctrl+Spacebar select all + F8; Ctrl+B Include Exact Matches only; Shift+Enter collapse sections; Alt+U Manual Recon on selected; F10/F9 Set Status → System Inferred to undo manual reconciliation; Alt+Q Reconcile Unlinked (older "Amounts not reflected in Company Books" flow), Alt+J Create Voucher; Modify Match is book-anchored (only bank lines removable); Find Matches Ctrl+B Include Available Only in Books/Bank; Reconciled report F12 Format = Condensed to print only primary book lines. [src](https://help.tallysolutions.com/faq-banking-tally/)
- **Potential Match Configuration toggles** — Show unique Amount matches; Show unique Instrument no. matches; Show only Amount matches; Show only Instrument no. matches; Show Amount & Instrument no. matches. [src](https://help.tallysolutions.com/faq-banking-tally/)
- **Migration to Rel 6.0 BRS** — prior reconciled txns appear as "Reconciled Manually"; synced companies show linked recon as Reconciled Manually. UPI transactions reconcilable like any. [src](https://help.tallysolutions.com/faq-banking-tally/)
- **Multi-voucher creation from statement** — Common Ledger for all rows; leave rows blank (End of List); vouchers created as Optional → Bank Reconciliation – Optional Vouchers (add bill-wise/cost centre by altering) → Mark as Regular and Reconcile; later via Ctrl+J > Optional Vouchers (Bank Data) > Optional Voucher Register – Bank Data. [src](https://help.tallysolutions.com/faq-banking-tally/)
- **Bank Allocations F12** — Show inst. No. during voucher creation; Show Ref. ID. Party bank details editable in voucher. [src](https://help.tallysolutions.com/faq-banking-tally/)

### Post-dated cheques (FAQ)
- **PDC defaults** — no configuration; enabled by default; PDC Issue/Receipt Date defaults to system date (blank for migrated data); vouchers marked Post-Dated auto-regularise when Date of Last Entry crosses PDC date. [src](https://help.tallysolutions.com/faq-banking-tally/)
- **Notional Bank** — link an unreal control bank under "Link Notional Bank(s)" for PDC receipts of uncertain bank; notional bank transactions regularised manually. [src](https://help.tallysolutions.com/faq-banking-tally/)
- **Post Dated Summary** — Gateway > Banking > Post Dated Summary > bank; shows pending PDC (F6 Show All/Show Pending); Alt+C create vouchers in bulk; A Alter Date; F4 Alter Bank (receipts); K Enter Note; S Quick Search (Instrument No., Date, Bank, Party, Amount). [src](https://help.tallysolutions.com/faq-banking-tally/)
- **Projected balances** — BS/TB Alt+C Type of Value "Actual with Post-Dated". [src](https://help.tallysolutions.com/faq-banking-tally/)

### Payment advice (FAQ)
- **Payment Advice basics** — Gateway > Banking > Payment Advice > ledger; Spacebar select; Alt+P > Configuration > Show More > Include company logo (Image Path, File Name); single party per voucher only; SWIFT for non-India only Kenya; Rel 3.0 export path bug → use F6 (Export to). [src](https://help.tallysolutions.com/faq-banking-tally/)
- **Cheque formats (FAQ)** — cheque config needs internet + latest capsule, not TSS; send cancelled cheque to Tally to add a format. [src](https://help.tallysolutions.com/faq-banking-tally/)

### Blank cheques
- **Prerequisite** — Payment voucher type: Allow zero-valued transactions. [src](https://help.tallysolutions.com/issue-blank-cheques/)
- **Flow** — Cheque Register > Available Cheques > Instrument Wise; Spacebar + Alt+S (Alter Status) > Blank Cheque → zero-value Payment voucher with bank prefilled & marked Blank Cheque; Bank Allocations instrument prefilled; I preview cheque; later alter voucher to enter amount. Cheque number locked from reuse; appears in registers/audit trail. [src](https://help.tallysolutions.com/issue-blank-cheques/)
- **Exception "Incorrect Ledger Selected in Bank Allocations"** — fix Ledger Name in Bank Allocations. [src](https://help.tallysolutions.com/incorrect-ledger-selected-in-bank-allocations/)

### Interest calculation
- **Enable** — F11 > Enable Interest Calculation (may need Show more/all features). [src](https://help.tallysolutions.com/interest-calculation-tally/)
- **Activate interest calculation** (ledger) — opens Interest Parameters. [src](https://help.tallysolutions.com/interest-calculation-tally/)
- **Calculate Interest Based on** (bank ledgers) — Voucher Date (Ledger Interest report) or Bank/Reco Date (Bank Reconciled Transactions report). [src](https://help.tallysolutions.com/interest-calculation-tally/)
- **Include transaction date for interest calculation** — For amounts added / For amounts deducted (4 Yes/No combinations defining whether day-0 additions/deductions accrue). [src](https://help.tallysolutions.com/interest-calculation-tally/)
- **Rate & Interest Style** — e.g. % per 365-day Year (fixed 365), Calendar Year (365/366), Calendar Month; **Interest Balances** — All Balances / Debit Balances Only / Credit Balances Only. [src](https://help.tallysolutions.com/interest-calculation-tally/)
- **Calculate Interest Transaction-by-Transaction** — party ledgers maintained bill-by-bill; else interest on running total balance; **Override Parameters for each Transaction**. [src](https://help.tallysolutions.com/interest-calculation-tally/)
- **Advanced parameters** — Interest Parameters F12 > Use advance interest parameters: multiple Rate rows with Interest Style, Applicability, Applicable From/To date ranges (e.g. 10% Apr–Sep, 15% Oct–Mar); party: Override advanced parameters; Applicability Always / Past Due Date (+ grace days); Calculate From options; slabs (e.g. 10% from 5th day after due, 15% from 10th); round-off per slab. [src](https://help.tallysolutions.com/interest-calculation-tally/)
- **Group Interest Calculation** — Display More Reports > Statements of Accounts > Interest Calculations > Group; balance + interest per sub-group/ledger (Cr = payable); Ctrl+B Type of Bills (Pending/Overdue), Scale Factor; Ctrl+H Ledger-wise / Bill-wise / Ledger-wise Bills / Summary / Monthly Summary / Voucher Details; Ctrl+J Negative Ledgers, Overdue Receivables, Overdue Payables; Alt+N periodic comparison. [src](https://help.tallysolutions.com/interest-calculation-tally/)
- **Ledger Interest Calculation** — Ctrl+B Type of Bills Pending/Overdue, Debit/Credit bills, include post-dated (not bank); Ctrl+H Bill-wise Details / Monthly Summary / Movement Analysis / Voucher Details; Ctrl+J overdues; Alt+S Contact (mailing, address; bank a/c details); Alt+F5 detailed calc & periods; Alt+B Settle Bills (interest recomputes on balance). [src](https://help.tallysolutions.com/interest-calculation-tally/)
- **Booking interest** — voucher class on Credit Note (payable) / Debit Note (receivable): Use Class for Interest Accounting = Yes; Amount to be treated as Compound Interest (Yes = compound); voucher lists only interest-enabled ledgers and auto-fills pending interest to voucher date; or plain Journal without tracking. [src](https://help.tallysolutions.com/interest-calculation-tally/)

### Outstanding management — receivables & payables
- **Concept hub** — party-level or invoice-level (bill-wise / on-account) tracking; credit limit, credit period, interest per party; monitor credit utilisation & customers near/over limit; reminders; settlement. [src](https://help.tallysolutions.com/managing-receivables-and-payables-in-tallyprime/)
- **Outstandings menu** — Display More Reports > Statements of Accounts > Outstandings > Receivables / Payables / Ledger / Group; visible only if F11 Enable Bill-wise entry = Yes; receivables Dr, payables Cr; party both customer & supplier shown net. [src](https://help.tallysolutions.com/manage-receivables-outstanding-tally/)
- **Receivables / Payables (Bills Receivable/Payable)** — party, bill, pending amount, due date, overdue days; Ctrl+B Type of Bills = Overdue Bills (or Alt+G > Overdue Receivables / Overdue Payables); F6 Ageing Method (by bill date or due date + ageing windows); Enter toggles transaction details; Enter again opens voucher. [src](https://help.tallysolutions.com/manage-receivables-outstanding-tally/)
- **Ledger Outstandings** — per party; F6 ageing; F12 options; Alt+B Settle Bills. [src](https://help.tallysolutions.com/manage-receivables-outstanding-tally/)
- **Group Outstandings** — e.g. Sundry Debtors/Creditors; Dr = receivable, Cr = payable; F5 Ledger-wise; Ctrl+F8 Bill-wise (due date, days overdue); F6 ageing; F12. [src](https://help.tallysolutions.com/manage-receivables-outstanding-tally/)
- **Reminders / statements** — from Group Outstandings: Ctrl+Space select subgroups/customers; choose Reminder Letter or Ledger Outstanding; pick ageing interval; send via Alt+M E-mail / WhatsApp, Alt+E export, Alt+P print. [src](https://help.tallysolutions.com/manage-receivables-outstanding-tally/)
- **Settle Bills (Alt+B)** — in Ledger Outstandings select one/many/all bills → Voucher Type, date, Account, Narration → prefilled Receipt/Payment; full or partial; partially paid bills stay listed until zero. Adjustment JV advised over deleting prior-year audited bills. [src](https://help.tallysolutions.com/manage-outstanding-payables-tally/) [src](https://help.tallysolutions.com/manage-receivables-outstanding-tally/)
- **Exception "Bill Date for Bill-wise Breakup of Opening Balance is Missing"** — fix in ledger opening balance bill-wise sub-form. [src](https://help.tallysolutions.com/bill-date-for-bill-wise-breakup-of-opening-balance-is-missing/)

### Outstanding analysis (Data Analysis > Pending Documents)
- **Net Pending Receivables → Pending Bills Receivables Summary** — party, group (shown only for Sundry Creditors with Dr balance, in red), Enterprise Type (MSME), Pending Amount, no. of bills (against bills + On Account). [src](https://help.tallysolutions.com/outstandings-tally/)
- **Buttons** — F3 Company; F6 Ageing Method (bad-debt / provisioning view); F9 Analytical Procedures; Alt+V Master Configuration (related parties, sampling); Ctrl+F10 Exceptions (receivables from Sundry Creditors only); Alt+F12 Range. [src](https://help.tallysolutions.com/outstandings-tally/)
- **Ledger Outstandings (analysis)** — Date, Ref No./On Account, Opening Amount, Pending Amount, Due On, Overdue by days; F2, F3, F4 Ledger, Alt+F5 detailed (voucher date/type/no./amount), F6 Ageing by Bill Date / by Due Date + criteria, F9, Ctrl+B Include Post-dated Vouchers / Type of Bills range, Alt+B Settle Bills, Alt+R Verify, Alt+S Remove Verify, Alt+V Contact, F12, Alt+F12. [src](https://help.tallysolutions.com/outstandings-tally/)
- **Net Pending Payables / Ledger Outstandings – Payables** — mirror of receivables. [src](https://help.tallysolutions.com/outstandings-tally/)

### Manual bank reconciliation
- **Bank Reconciliation (Manual)** — Alt+R (Manual Recon) from Summary/Report (or default mode); only book transactions; enter Bank Date (Instrument Date, New Date or Voucher Date) → Ctrl+A. [src](https://help.tallysolutions.com/manual-bank-reconciliation/)
- **Options** — Ctrl+B Type of Transactions (Deposit & Withdrawals / Deposits / Withdrawals); Show transactions with Payment Status as (e.g. Processed); Ctrl+H View Reconciled; Alt+H Opening BRS; undo via F5 View Reconciled > Manually Reconciled > F9 Set Status = System Inferred. Statuses: reconciled, on hold, processed. [src](https://help.tallysolutions.com/manual-bank-reconciliation/)

### Multi-currency overview
- **Capabilities** — base currency + any foreign currencies; foreign-currency sales/purchase invoices & other vouchers; dated exchange rates; automatic forex gain/loss; reports in base or any currency; ledger opening balances in foreign currency; carry forward balances to avoid unadjusted forex. [src](https://help.tallysolutions.com/multi-currency-accounting-made-simple-with-tallyprime/)

### Connected Banking — online payments (Rel 7.0)
- **Send Payments** — Alt+Z (Exchange) > Send Payments > bank ledger (or from e-Payments report); Spacebar select, S (Send); OTP in TallyPrime or on bank portal per bank policy; status via e-Payments report; reset on fail/reject. [src](https://help.tallysolutions.com/online-payments/)
- **ICICI** — generate token on ICICI portal (Connected Banking > My Banking Profile > Generate Token, OTP; valid 7 days, masked after session); Send → enter Token + OTP (new OTP per retry); multi-user accounts go to admin approval; F10 Get Online Payment Status. [src](https://help.tallysolutions.com/online-payments-icici/)

### Payment advice
- **Payment Advice report** — Alt+G > Payment Advice > ledger (or All Items); F8 Reconciled Only / Ctrl+B Show Reconciled only; Ctrl+B Include printed/e-mailed transactions; Ctrl+J optional & post-dated; mark as printed (migrated data); Alt+W Update E-mail ID; F12. [src](https://help.tallysolutions.com/payment-advice/)
- **Print options** — Print each transaction on a fresh page; C (Configure): Payment Advice Date, Show Bill-wise details (incl. ref type), Show Party's Contact details, Show Transferred to (A/c No, IFS, Bank), Show instrument date, Show Due Date, Show Company's PAN/Income Tax No., Payment Advice Configurations (Salutation, Signature). Content can include invoice nos., amounts, deductions, TDS, payment mode; also for cash payments. [src](https://help.tallysolutions.com/payment-advice/)
- **Auto payment advice via Connected Banking (Rel 7.0)** — bank ledger > Set/Alter e-Payments configuration: Auto-generate payment advice; Get a copy of payment advice + E-mail address(es); Include bill-wise details in payment advice (not for multiple bills/allocations); supplier e-mail from ledger or Bank Allocations (Show E-mail ID); contents A/c No., Beneficiary, Amount, UTR, bill details; online non-payroll payments only. [src](https://help.tallysolutions.com/payment-advice-online/)
- **Payroll Payment Advice (bank transfer letter)** — Display More Reports > Payroll Reports > Payment Advice; C: Payment Voucher Period, Employee Category, Employees/Employee Group, Bank Ledger, Salary Period, Date, Show Remarks, Information in Payment Advice; Show More. [src](https://help.tallysolutions.com/payment-advice-tally/)

### Payment Request (payment links & UPI QR)
- **Enable** — F11 > Show more features > Enable Payment Request to share payment link/QR code. [src](https://help.tallysolutions.com/payment-request/)
- **Merchant Profile (Payment Gateway)** — Name; Payment Method (PayU / Razorpay); Merchant ID; Registered E-mail and/or Mobile; Payment link expires in (default 180 days Razorpay, 365 PayU); Save payment link while generating from reports (Yes / No / Ask Every Time); also Create/Alter Master > Merchant Profile. [src](https://help.tallysolutions.com/payment-request/)
- **Merchant Profile (UPI)** — Name; UPI ID; Merchant Name (default company name); Save QR code while generating from reports (Yes/No/Ask; No blocks QR from reports). [src](https://help.tallysolutions.com/payment-request/)
- **Voucher type option** — Generate payment link/QR code after saving voucher (Yes → prompt on save). Only regular (not optional) vouchers. [src](https://help.tallysolutions.com/payment-request/)
- **Generate Payment Link/QR Code screen** — Merchant Profile (sticky default); Mode of sharing payment link (e-mail / SMS / both); Party A/c Name (create on the fly), Mobile, E-mail; Expires in; Reference No. (Invoice No., bill ref, New Number, Multiple Ref, All Bills, Specify Bills); Amount (full or partial; multiple bills; closing balance default); Remarks (UPI: no &, #, /); OTP login to merchant profile when needed. UPI hides sharing/mobile/e-mail/expiry. [src](https://help.tallysolutions.com/payment-request/)
- **Generation points** — on save; later from voucher (PgUp > Alt+Z Exchange > Generate Payment Link/QR Code > Current); Day Book multi-select (unique link per party); Ledger Vouchers / Ledger Outstandings (selected bills or whole closing balance); anywhere via Alt+Z > Generate Payment Link/QR Code > Others; Exchange Summary shows counts & per-party failures. [src](https://help.tallysolutions.com/payment-request/)
- **View link** — voucher Ctrl+O (Related Reports) > Payment Link/QR Code; Ctrl+C Copy Link. [src](https://help.tallysolutions.com/payment-request/)
- **Print/export/e-mail with link/QR** — invoice, Ledger Vouchers, Ledger Outstandings, Reminder Letter; C > Payment Request Details: Method of Payment Request Link / QR Code / Link & QR Code (UPI: QR only); Report Type Ledger Outstandings or Reminder Letter; Include Post-dated Vouchers; export/e-mail File Format PDF (clickable link) or JPEG. [src](https://help.tallysolutions.com/payment-request/)
- **Tracking** — Ctrl+B Status of Vouchers (With / Without Payment Link/QR Code) in Day Book, Ledger Vouchers; "Status of Bills" in Outstandings. [src](https://help.tallysolutions.com/payment-request/)
- **Payment Gateway ledger** — under Bank Accounts (receipt/payment/contra) or Current Assets (journal only); Behave as Payment Gateway = Yes; Payment Gateway Name; Effective Date of Reconciliation (default FY start; F12 Provide Effective Date of Reconciliation). [src](https://help.tallysolutions.com/payment-request/)
- **Transaction Allocations** — Mode of Payment, Transaction ID, Transaction Date, Amount on receipts (collections), payments (refunds), contra (gateway→bank settlement; Transaction ID prefilled as Instrument No.); date present ⇒ reconciled. Gateway charges inline or via journal. [src](https://help.tallysolutions.com/payment-request/)
- **Payment Reconciliation report** — Alt+G > Payment Reconciliation > gateway ledger; Alt+O > Payment Gateway Statement (PayU Settlement Transaction xlsx: payments/refunds; Razorpay Custom Combined Report xlsx: payments/refunds/settlement); Alt+B With View preview; Alt+H Hide Imported; folder paths for new/imported statements; auto-reconcile on Transaction ID + amount (fills missing date); Alt+Q Reconcile Unlinked; Alt+R Reconcile All Unlinked; Alt+J Create Voucher (prefilled) for "Amounts not reflected in Company Books"; Ctrl+B Include Reconciled Transactions; Set Unreconciled Balance (pre-effective-date items: Date, Party, Nature Payment/Refund/Settlement, Mode, Dr/Cr; auto-filled on split). [src](https://help.tallysolutions.com/payment-request/)

### Payments & receipts entry (banking aspects)
- **Single/Double Entry** — Ctrl+H Change Mode; double-entry choice persists (needs write access to config file); F7 convert to Journal. [src](https://help.tallysolutions.com/payments-and-receipts-tally/)
- **Bank Allocations** — voucher F12 Set Ledger-wise Bank Allocations during voucher creation; Transaction Type default Cheque (others: e-Fund Transfer, Electronic Cheque, Inter Bank Transfer, Same Bank Transfer, Cheque/DD, Show More…); switching away from Cheque clears range-based Inst No.; same/different cheque range with auto next number. [src](https://help.tallysolutions.com/payments-and-receipts-tally/)
- **Bank Status in voucher (Rel 6.0+)** — Bank Allocations F12 Show Bank Date, Show Bank Status, Show Bank Status (Consolidated) (worst status wins, e.g. On Hold / Available Only in Books); Alt+S Set Status On Hold (+comment) / Processed (Inst No.) / Reconciled (Inst No.); Alt+V View Recon Info (F12 Show Favoring Name/Received From, Show Transaction Type). [src](https://help.tallysolutions.com/payments-and-receipts-tally/)
- **Remove Bank Date/Recon Link while altering Reconciled Vouchers** — voucher F12; on save A retain / R remove / B back. [src](https://help.tallysolutions.com/payments-and-receipts-tally/)
- **Per-ledger narration** — voucher type "Provide narrations for each ledger in voucher". **Print voucher after saving**; **Print formal receipt after saving** (title/subtitle editable); receipt print Show Bank Transaction Details, Show Additional Details. [src](https://help.tallysolutions.com/payments-and-receipts-tally/)
- **Contra via payment/receipt** — Cash/Bank ledgers under Particulars via Show More. [src](https://help.tallysolutions.com/payments-and-receipts-tally/)

### Bill-wise allocation in payments/receipts
- **Sorting Method for Pending Bills in Vouchers (Rel 5.0)** — F1 > Settings > Display (e.g. Due Date (Increasing)); with Agst Ref and no preallocation, amount auto-adjusts oldest-due first. [src](https://help.tallysolutions.com/payments-and-receipts-tally/)
- **Voucher F12** — Preallocate bills for Payment/Receipt/Journal Vouchers; Show list of Bills for selection; Show Final Balances for each Bill; Show Bill-wise Details / in multiple lines on voucher. Due dates include party credit days. Type of Ref Agst Ref (also New Ref, Advance, On Account). [src](https://help.tallysolutions.com/payments-and-receipts-tally/)

### Post-dated cheques (PDC) management
- **Record PDC** — Payment/Receipt/Contra voucher: F2 set cheque date, Ctrl+T (Post-Dated) marks voucher; Bank Allocations adds PDC issue/receipt date (defaults to voucher date) and PDC note; affects books only from cheque date. [src](https://help.tallysolutions.com/post-dated-cheque-managment-tally/)
- **Voucher F12** — Show Final Balances for each Bill; Show Final Ledger Balance (incl. post-dated). [src](https://help.tallysolutions.com/post-dated-cheque-managment-tally/)
- **Ledger Vouchers Alt+F8 (Incl Post-dated)** — projected final balance; PDCs includable in Cash Flow, Funds Flow, Ledger Vouchers, Group Summary, Ledger Outstandings. [src](https://help.tallysolutions.com/post-dated-cheque-managment-tally/)
- **Post-Dated Transactions Monthly Summary** — Alt+G > Post-Dated Summary / Gateway > Banking > Post-Dated Summary > bank: month rows, Received & Issued Amount + Count. [src](https://help.tallysolutions.com/post-dated-cheque-managment-tally/)
- **Post-dated Transactions list** — Date, Type (issued/received), Bank, Particulars, Instrument no., Instrument Date, Status (Pending / Unlinked = Notional Bank / Regularized when cheque date ≤ Date of Last Entry or moved to real bank), Amount. [src](https://help.tallysolutions.com/post-dated-cheque-managment-tally/)
- **PDC report buttons** — F4 Ledger; Ctrl+F4 Bank; F8 Show All/Pending; Ctrl+H Post-Dated Issued / Received; Ctrl+J Optional Vouchers; Alt+B Alter Bank; Alt+H Alter Date; Alt+Q Quick Search; Alt+R Enter Note; Alt+J Create Voucher (Issued→Payment, Received→Receipt); F12 Show Favouring Name/Received From, Show Issue/Receipt Date, Show Notes for Post-dated Cheques. [src](https://help.tallysolutions.com/post-dated-cheque-managment-tally/)
- **Notional Bank** — ledger F12 "Set Bank Ledgers as Notional Bank Ledgers (for Post-Dated Vouchers)" then Bank Configuration "Use as Notional Bank for Post-Dated Vouchers" (or per-ledger via Ctrl+I); receive PDC into notional bank; later Alt+B Alter Bank → New Bank Name to move to real bank. Day Book Ctrl+H > Post-Dated Transactions for a date. [src](https://help.tallysolutions.com/post-dated-cheque-managment-tally/)

### Cheque printing
- **Modes** — single cheque while creating payment; bulk printing (salaries, monthly cash, etc.); print selected or all bank cheques; print with blank date (PDC, approval workflow, uncertain timing, manual signing). [src](https://help.tallysolutions.com/print-cheques/)
- **Cheque Printing screen** — header "Bank not configured for Cheque Printing" → Alt+B (Alter Ledger) to enable; lists pending cheques for printing. [src](https://help.tallysolutions.com/print-cheques/)
- **Print selected / all** — Alt+G > Cheque Printing > All Items or bank; Spacebar select + Ctrl+P > P; all at once with F8 Incl Printed off, Print Cheque = Yes, next cheque shown after each. [src](https://help.tallysolutions.com/print-cheques/)
- **Blank-date cheques** — Sample Cheque Printing C > Show Instrument Date = No. [src](https://help.tallysolutions.com/print-cheques/)
- **From payment voucher** — Inst. no. + Inst. date (defaults voucher date) in Bank Allocations; after save I preview / P print. Voucher print C > Show Bank Transaction Details for cheque info on voucher. [src](https://help.tallysolutions.com/print-cheques/)
- **Self cheque for cash withdrawal** — Contra Cr bank; Bank Allocations F12 Show favouring name → "Self"; Dr Cash; print. [src](https://help.tallysolutions.com/print-cheques/)
- **Cheque Printing report** — pending cheques; F8 Incl Printed / Ctrl+B; Ctrl+B Scale Factor; Ctrl+H Cheque Register; Ctrl+J Optional/Post-dated; Alt+B Alter Ledger; Alt+H Alter Chq Details (Favouring Name, Instrument No., Instrument Date). [src](https://help.tallysolutions.com/print-cheques/)

### Forex opening balances
- **Opening balance in foreign currency** — ledger Opening Balance > Bill-wise Breakup with currency/rate; mismatch with previous-FY-end rate in currency master creates Unadjusted Forex Gain/Loss in BS. [src](https://help.tallysolutions.com/provide-ledger-opening-balance-in-foreign-currency/)

### Recording e-Payments
- **Payment voucher** — Dr party, Cr e-Payments bank; Bank Allocations Transaction Type e-Fund Transfer; A/c No., IFS, Bank Name, Inst No. (if not in master); F12 Show Ref ID to pick beneficiary (Backspace); if "Export/Upload on voucher creation" → Exporting Payment Instructions screen (E Send, C Configure). DBS: direct upload when logged in with bank-registered Tally.NET ID. [src](https://help.tallysolutions.com/record-e-payments/)

### Scenarios
- **Scenario master** — Alt+G > Create Master > Scenario: Name; Include actuals (Yes); Exclude forex gain/loss calculations (multi-currency only); Exclude inventory tracking calculations (when delivery/receipt note/rejection vouchers active); Include voucher types (e.g. Memorandum, Reversing Journal, Optional); Exclude voucher types. Alterable anytime. [src](https://help.tallysolutions.com/scenarios-tally/)
- **Optional vouchers** — Ctrl+L marks voucher Optional (non-impacting); convert to regular later. [src](https://help.tallysolutions.com/scenarios-tally/)
- **Compare** — BS/P&L Alt+C New Column > Type of value to show = scenario; Show Variance = Yes; F12 Show Percentages, Format of Report Detailed/Condensed (default Condensed). Also Cash Flow Projection Ctrl+B Include Scenarios. [src](https://help.tallysolutions.com/scenarios-tally/) [src](https://help.tallysolutions.com/cash-flow-and-projection-report-tally/)

### Base currency & forex rates
- **Base currency (Alt+K > Alter)** — Base Currency Symbol (₹, AED…; Rel 7.0 official UAE Dirham & Saudi Riyal symbols); Formal name; Suffix symbol to amount; Add space between amount and symbol; Show amount in millions; Number of decimal places (default 2, max 4); Word representing amount after decimal (e.g. paisa); No. of decimal places for amount in words. [src](https://help.tallysolutions.com/set-up-base-currency/)
- **Rate of Exchange (currency alteration)** — Standard rate (Date, Specified Rate, used for variance); Selling (Date, Last Voucher Rate, Specified Rate); Buying (Date, Last Voucher Rate, Specified Rate); rate editable in transactions; multiple per day. [src](https://help.tallysolutions.com/set-up-forex-rates/)
- **Multi-currency rate entry** — Chart of Accounts > Currencies > Alt+H (Multi-Masters) > Rate of Exchange: Std Rate, Selling Rate, Buying Rate for all currencies at once; rates applied by applicability date. [src](https://help.tallysolutions.com/set-up-forex-rates/)

### Bharat Connect for Business (B2B invoice & payment network)
- **Buyer side** — Alt+G > Buyer – Activities > Invoices Pending for Payment; Ctrl+F5 Send Payment Details (Mode of Payment, UTR/Inst.No., Amount; can adjust credit notes, TDS, advances) → Y send, Y create Payment voucher (Bank Allocations > Bharat Connect Details); later-sharing via voucher F12 Share Payment on Voucher Save / Show B2B ID Selection Subform; partial payments; one voucher for multiple invoices; bulk Alt+Z > Send Payment Details; status "Payments to be Acknowledged by Supplier". Needs licence enablement, login, B2B ID. [src](https://help.tallysolutions.com/send-payment-details/)
- **Supplier side** — Supplier – Activities > Payment Acknowledgement Pending; F10 Invoice View; Alt+F6 Acknowledge Payment (Accept/Reject → back to Payment Pending from Buyer); Y to create Receipt voucher with Bharat Connect Allocations; view credit-note/TDS/advance adjustments. [src](https://help.tallysolutions.com/accept-payment/)

### Supported-bank matrix (summary of bank list page)
- **e-Payments (19 banks, with release introduced)** — DBS India (Rel 1.0, online real-time send + status); Standard Chartered India (1.0) & UAE (1.1); Kotak, YES, ICICI, Federal, HDFC, Bank of Baroda, Citibank, RazorpayX, Axis, AU SFB, IDFC First, South Indian (all 1.1); MUFG Tokyo-Mitsubishi (1.0); Bandhan (3.0); Indian Bank (6.2); SBI (Rel 2.0 via SBI CMP NexGen, file format TALLYPAY, maker/checker, Payment Reverse (MIS) file). Offline flow: RM activates bulk upload → select bank name in ledger → export from voucher or e-Payments report. [src](https://help.tallysolutions.com/list-of-banks-supported-by-tallyprime-for-e-payments-auto-brs-and-cheque-formats/)
- **Bank statement import (~258 banks, 24 countries)** — India 138, UAE 19, Kenya 17, Nepal 14, Saudi Arabia 8, Nigeria 8, Uganda 7, Bangladesh 7, Malaysia 6, Indonesia 6, Tanzania 5, Ghana 4, USA 3, Singapore 3, plus Rwanda, Qatar, Malawi, Zambia, UK, Sri Lanka, Oman, Kuwait, Bahrain; formats per bank Excel (most), CSV, Delimited (ICICI, Dhanlaxmi), MT940 (Corporation, DBS, Federal, Kotak, Standard Chartered India/UAE, Yes). [src](https://help.tallysolutions.com/list-of-banks-supported-by-tallyprime-for-e-payments-auto-brs-and-cheque-formats/)
- **Connected Banking (4 banks)** — Axis, Kotak Mahindra, SBI, ICICI: Get Balance, Get Bank Statement, Send Online Payments all supported. [src](https://help.tallysolutions.com/list-of-banks-supported-by-tallyprime-for-e-payments-auto-brs-and-cheque-formats/)
- **Pre-configured cheque formats (~619 banks, as on 3-Feb-2023)** — India, UAE, Bangladesh, Ghana, Nigeria, Kenya, Qatar, Bahrain, Kuwait, Malaysia, Pakistan, Singapore, Saudi Arabia etc.; 1–9 formats per bank (e.g. Vijaya 9, Union Bank of India 8, Andhra/UCO 7). [src](https://help.tallysolutions.com/list-of-banks-supported-by-tallyprime-for-e-payments-auto-brs-and-cheque-formats/)

## B. Reports & Analysis

### Reports catalogue (overview)
- **Accounting & financial reports set** — Balance Sheet, P&L, Cash Flow (+ Cash Flow Projection), Funds Flow, Outstanding Receivables/Payables, Trial Balance, Day Book, Accounting Registers (Sales, Purchase, Journal, Credit/Debit Note, Payment…), Ratio Analysis, Cash/Bank Book, Statistics, Multi-Account printing. [src](https://help.tallysolutions.com/accounting-financial-reports-tally/)
- **Print Multi Account Reports** — print multiple vouchers and books (Cash/Bank Books, ledgers, Sales/Purchase registers) in one go without selecting accounts one at a time. [src](https://help.tallysolutions.com/accounting-financial-reports-tally/)

### Day Book
- **Open** — Alt+G > Day Book or Gateway > Day Book; defaults to Current Date; Alt+F2/F2 period. [src](https://help.tallysolutions.com/accounting-financial-reports/day-book-tally/)
- **Alt+F5 Detailed** — invoice break-up (additional charges, tax components). F12 to show narration, cost centre etc. [src](https://help.tallysolutions.com/accounting-financial-reports/day-book-tally/)
- **F4 Voucher Type** — filter to one voucher type with totals. [src](https://help.tallysolutions.com/accounting-financial-reports/day-book-tally/)
- **Hide/restore lines** — Ctrl+R Remove Line; Ctrl+U restore last (repeatable, LIFO); Alt+U restore all. [src](https://help.tallysolutions.com/accounting-financial-reports/day-book-tally/)
- **F7 Show/Hide Profit** — for Sales type: Gross Profit vs Transaction Value and Cost. [src](https://help.tallysolutions.com/accounting-financial-reports/day-book-tally/)
- **Exception reports (Ctrl+J)** — Optional Vouchers, Cancelled Vouchers, Post-Dated Vouchers. [src](https://help.tallysolutions.com/accounting-financial-reports/day-book-tally/)
- **Enable Stripe View** — F12 per report, or app-level for all reports; applies to print/export/share too. [src](https://help.tallysolutions.com/accounting-financial-reports/day-book-tally/)
- **Ctrl+F Apply Filter** — Basic Filter "Look For" (e.g. narration text); F6 Multi-Filter; F7 Advanced Filter. [src](https://help.tallysolutions.com/accounting-financial-reports/day-book-tally/)
- **Ctrl+B Type of Voucher entries** — Accounting Entries Only / All Vouchers / Inventory Entries Only. [src](https://help.tallysolutions.com/accounting-financial-reports/day-book-tally/)
- **Alt+A Add Vch** — added at last position of that type for the date; auto-numbering renumbers later vouchers. [src](https://help.tallysolutions.com/accounting-financial-reports/day-book-tally/)
- **Alt+I Insert Vch** — insert above selected line, restoring sequence; subsequent vouchers renumbered (edit log records renumbering). [src](https://help.tallysolutions.com/accounting-financial-reports/day-book-tally/)
- **Alt+2 Duplicate Vch** — duplication screen F12 "Use default Bill-wise details for Bill Allocation" (set No to give New Ref); number = next for same date or last for new date. [src](https://help.tallysolutions.com/accounting-financial-reports/day-book-tally/)
- **Alt+D Delete / Alt+X Cancel** — cancel keeps voucher number in cancelled list for reuse. [src](https://help.tallysolutions.com/accounting-financial-reports/day-book-tally/)
- **Altered/Deleted vouchers (Edit Log, Rel 2.1+)** — Ctrl+B > Show Report for: All Vouchers (Altered & Non-Altered) [default] / Altered Vouchers (+ Include Deleted Vouchers = Yes) / Non-Altered Vouchers (deleted excluded, locked); voucher Ctrl+O > Edit Log. [src](https://help.tallysolutions.com/accounting-financial-reports/day-book-tally/)

### Range & Value filters
- **Range filter (Alt+F12)** — on voucher registers; "Range of Information in Report": Type of Information (Voucher…), Particulars field (e.g. Buyer Name), condition containing / equal to, value; chain with "and"; End of List. TallyPrime 3.0+ variant exists; Rel 2.1 extended to more reports. [src](https://help.tallysolutions.com/apply-range-value-filters/)
- **Value filter (Ctrl+F12)** — on summary reports (e.g. Balance Sheet); "Value to Calculate in Report" computes values only from vouchers meeting conditions (e.g. Date = 15-Feb-22). [src](https://help.tallysolutions.com/apply-range-value-filters/)

### Balance Sheet
- **Open** — Alt+G > Balance Sheet; default horizontal: Liabilities left, Assets right. [src](https://help.tallysolutions.com/balance-sheet-tally/)
- **Stock valuation** — F8 (Valuation) or Ctrl+B > Stock Valuation Method; default "Default" (=Avg Cost); options incl. FIFO, LIFO, At Zero Cost, At Zero Price, Avg Cost, Avg Price, etc. [src](https://help.tallysolutions.com/balance-sheet-tally/)
- **Include Working Capital** — Ctrl+B. [src](https://help.tallysolutions.com/balance-sheet-tally/)
- **Alt+N Auto Column** — periods (daily/weekly/fortnightly/monthly/quarterly…), Stock Valuation Methods (side-by-side FIFO/LIFO/Avg…), Member Companies (group company). [src](https://help.tallysolutions.com/balance-sheet-tally/)
- **F12: Exclude Accounts with zero Closing Balance** [src](https://help.tallysolutions.com/balance-sheet-tally/)
- **F12: Show Loss also under Liabilities** — horizontal only. [src](https://help.tallysolutions.com/balance-sheet-tally/)
- **F12: Method of showing Balance Sheet** — Liabilities/Assets order swap; for vertical, Source/Application order. [src](https://help.tallysolutions.com/balance-sheet-tally/)
- **Vertical Balance Sheet** — Ctrl+H > Vertical (or F12): Sources of Funds top, Application of Funds bottom, single column. Alt+F5 Detailed. [src](https://help.tallysolutions.com/balance-sheet-tally/)
- **Group company consolidated BS** — Alt+F3 load group company; compare member companies via Alt+N. [src](https://help.tallysolutions.com/balance-sheet-tally/)
- **Stripe View; view in browser** [src](https://help.tallysolutions.com/balance-sheet-tally/)
- **Manual closing stock** — disable F11 Integrate Accounts and Inventory; ledger under Stock-in-Hand with balance. [src](https://help.tallysolutions.com/balance-sheet-tally/)
- **Order of groups** — Ctrl+Enter on group > Ctrl+I > Show More > Position Index in Reports (e.g. Investments 50, Fixed Assets 40). [src](https://help.tallysolutions.com/balance-sheet-tally/)

### Cash/Bank Book
- **Open** — Alt+G > Cash/Bank Book or Display More Reports > Account Books > Cash/Bank Book(s) → Cash/Bank Summary; drill to Ledger Monthly Summary (Dr, Cr, closing; negative cash in red). [src](https://help.tallysolutions.com/cash-bank-book-tally/)
- **F12 Show Closing Balance** [src](https://help.tallysolutions.com/cash-bank-book-tally/)
- **Ctrl+F6 Daily Breakup of Ledger** — F12 Show Highest Balance & Lowest Balance in month. [src](https://help.tallysolutions.com/cash-bank-book-tally/)
- **Negative cash** — spot negative days via daily breakup even if month-end positive; Exception Reports > Negative Ledgers (List of Negative Ledger A/cs). [src](https://help.tallysolutions.com/cash-bank-book-tally/)
- **Alt+N Auto Column** — compare cash vs bank, multiple banks, periods (yearly/quarterly/monthly…); Show Total Column. Export/print/browser view. [src](https://help.tallysolutions.com/cash-bank-book-tally/)

### Cash Flow
- **Open** — Alt+G > Cash Flow / Display More Reports > Cash Flow; month-wise inflow/outflow/Nett Flow; drill month → Cash Flow Summary (current assets/liabilities, voucher types). [src](https://help.tallysolutions.com/cash-flow-and-projection-report-tally/)
- **Built-in graph** — monthly inflow vs outflow bars at end of report; click bar to drill. [src](https://help.tallysolutions.com/cash-flow-and-projection-report-tally/)
- **Ctrl+B Scale Factor** — Hundreds, Thousands, Lakhs, Millions, etc. [src](https://help.tallysolutions.com/cash-flow-and-projection-report-tally/)
- **Ctrl+H periodic views** — monthly/quarterly/weekly; **Alt+N** Column Details daily/weekly/fortnightly/quarterly. Browser view. [src](https://help.tallysolutions.com/cash-flow-and-projection-report-tally/)

### Cash Flow Projection
- **Open** — Alt+G > Cash Flow Projection; projects from date of last entry to FY end; monthly columns by default; Alt+N weekly/fortnightly/daily/quarterly. [src](https://help.tallysolutions.com/cash-flow-and-projection-report-tally/)
- **Rows** — A. Current Balance (Bank Accounts, Bank OD A/c, opt. Cash-in-Hand); B. Receivables (by due date, drill to party/due date); C. Payables; Nett Balance = (A+B)−C; Alt+F5 detailed. [src](https://help.tallysolutions.com/cash-flow-and-projection-report-tally/)
- **Alt+S Set OD Limit** — Bank OD Limit screen per bank (also in ledger); treats opening Cr/Dr balance accordingly. [src](https://help.tallysolutions.com/cash-flow-and-projection-report-tally/)
- **Ctrl+B** — Include Cash Account; Include Scenarios (memorandum, reversing journal, optional vouchers; appears only after a scenario exists); Include Overdues (Overdue Receivable/Payable rows). [src](https://help.tallysolutions.com/cash-flow-and-projection-report-tally/)

### Dashboard — TDL extensibility (Rel 4.0)
- **Dashboard scope** — draws from 350+ reports; default tiles: Sales Trend, Purchase Trend, Trading Details, Assets & Liabilities, Cash/Bank Accounts, Cash Flow, Accounting Ratios; tiles horizontal or vertical. [src](https://help.tallysolutions.com/dashboard-capabilities/)
- **TDL hooks** — report attrs Dashboard Type, Default Tiles; part attrs Num of Display Lines In Scroll, Scroll Indicator Style; actions Add Tile, Remove Tile, Expand Tile, Modify Dashboard Variables (e.g. change period for all tiles), Next/Prev Tile Report In Focus (Plus/Minus keys); tile navigation Ctrl+Arrow; functions $$InFocusMode, $$DashboardTotalTiles, $$IsCheckAlwaysInDashboardTiles. [src](https://help.tallysolutions.com/dashboard-capabilities/)

### Dashboard (Rel 4.0+)
- **Open** — Alt+G > Dashboard / Gateway > Dashboard; default tiles: Sales Trend, Purchase Trend, Trading Details, Assets/Liabilities, Cash/Bank Accounts, Cash In/Out Flow, Receivables/Payables, Top Groups/Ledgers, Accounting Ratios. [src](https://help.tallysolutions.com/dashboard/)
- **Period** — Ctrl+F2 whole dashboard; F2 per tile. Ctrl+Down/Ctrl+Up page between tiles; drill down from data or graph point. [src](https://help.tallysolutions.com/dashboard/)
- **Alt+A Add Tile** — unlimited, same tile multiple times (e.g. per ledger/group); tile groups Accounting / Inventory / Bank/Cash / Statutory; master-specific tiles prompt for group/ledger/stock group/category/item/cost centre; Rel 6.0+ Banking Activities tile and Bank Balance as per Bank (Connected Banking) tile; Top Ledgers/Groups, Top Stock Items/Groups. [src](https://help.tallysolutions.com/dashboard/)
- **Alt+D Remove Tile** (confirm Y; re-addable). **Alt+V Expand Tile**. [src](https://help.tallysolutions.com/dashboard/)
- **Ctrl+H Change View** — Horizontal grid (default) / Vertical (one tile per row); predefined Sales Dashboard / Purchase Dashboard (also via Alt+G). F12 Show Vertical Dashboard. [src](https://help.tallysolutions.com/dashboard/)
- **Alt+C Configure Tile (common)** — Name of Tile; Type of Value (Closing Balance / Nett Transactions / …); Display type (Data Only / Graph Only / Data & Graph); Graph Type (bar/line); Show Percentages; Scale Factor; Sorting Method (Amount Decreasing/Increasing, Quantity); Position of Tile (1..N, must save view to retain). [src](https://help.tallysolutions.com/dashboard/)
- **Tile-specific configs** — e.g. Trading Details: Nett Profit, Direct Expenses/Incomes; Inventory Details: by Stock Group; Cash In/Out Flow: Nett Flow/Inflow/Outflow for a group (e.g. Sundry Debtors); Statutory GSTR-2A: hide reconciled. [src](https://help.tallysolutions.com/dashboard/)
- **Save View** — predefined views modifiable & save-as; save with period; save for all companies on the computer or per company (shared with all users in multi-user). [src](https://help.tallysolutions.com/dashboard/)
- **F3 Change Company** — view another company's dashboard (Specify Path / Select from Drive). [src](https://help.tallysolutions.com/dashboard/)
- **Print/Export/Share tiles** — Alt+P / Alt+E / Alt+M (E-mail, WhatsApp) > Current or All Tiles; configure Periodicity, Display Type, Scale Factor, Title (default tile name), Subtitle, Show Page Number; all-tiles export = one file, a page per tile. [src](https://help.tallysolutions.com/dashboard/)
- **Startup** — F1 > Settings > Startup > Open Dashboard on loading a Company (app-wide). [src](https://help.tallysolutions.com/dashboard/)
- **Security** — Alt+K > User Roles: allow Dashboard, disallow specific tiles (e.g. Assets/Liabilities); Owner/Admin/Tally.NET Auditor see all by default; users without access fall through to Gateway. [src](https://help.tallysolutions.com/dashboard/)
- **TDL graph attrs** — Graph Style Bar (default)/Line; Display X Axis Legend; Enable Graph Cursor; Shorten Y Axis Label; X Axis Label Word Wrap (≤3 lines); field Background colour (palette Red, Blue, Soft Violet, Magenta, Yellow, Green); SVDBVerticalView persists; DBTilePosition; $$IsDisplayReportModified. [src](https://help.tallysolutions.com/dashboard-capabilities/)

### Analysis & Verification — Data Analysis hub
- **Path** — Display More Reports > Analysis & Verification > Data Analysis (Alt+G > Data Analysis Reports). [src](https://help.tallysolutions.com/data-analysis-tally/)
- **Tools list** — Verification of Chart of Accounts (vs previous year); Verification of Stock Items; Verification of Balances (opening diffs, ledger-wise closing variance); Analytical Procedures (compare by Group, Cost Centre…); Pending Documents (pending bills, SO, PO, receivables/payables); Periodic Payments and Receipts (recurring per Periodic Ledgers); Repeated Transactions (same amount repeated per ledger); Relative Size Factor (highest ÷ second-highest voucher per ledger); Inter Bank Transactions; Cash Withdrawals/Deposits to Bank; Fixed Assets Analysis; Transactions on Holiday (weekly off/declared holidays); Highest and Lowest Value Transactions (with Difference Range & %); Pending Advances (loans given pending); Stale Cheque/Instruments (count & amount per bank). [src](https://help.tallysolutions.com/data-analysis-tally/)
- **Voucher Verification dashboard** — Verification of Vouchers (sampling methods or verify all), Related Party Transactions (mark ledgers as related parties), Forex Transactions (multi-currency vouchers for verification). [src](https://help.tallysolutions.com/data-analysis-tally/)

### Report filters (Rel 3.0+)
- **Ctrl+F Basic Filter** — Apply Filter on (Voucher default); Look for text/value anywhere; F12 "Select specific field to apply Filter": Field (e.g. Ledger Name) + Condition (containing / equal to …). [src](https://help.tallysolutions.com/filter-reports/)
- **F6 Multi-Filter** — multiple Field/Condition/Look For rows combined with and/or (mixable); conditions incl. greater than. [src](https://help.tallysolutions.com/filter-reports/)
- **F7 Advanced Filter** — Filter Rows (on masters/hierarchy, e.g. stock item name containing Samsung) + Calculate Values (voucher conditions, e.g. Ledger Name = party) — values recomputed from matching vouchers. [src](https://help.tallysolutions.com/filter-reports/)
- **Ctrl+Alt+F Filter Details** (Alt+F in ≤6.2) — shows which fields matched; N/A for default rows (BS "Difference in Opening Balances", Ratio rows) and secondary rows in Detailed mode. [src](https://help.tallysolutions.com/filter-reports/)
- **Default Filter mode** — F1 > Settings > Display > Reports > Default Filter mode for Reports (Basic/Multi/Advanced). Esc removes filter; Ctrl+L saves filtered view. [src](https://help.tallysolutions.com/filter-reports/)

### Financial Statements for NCE (add-on, Rel 6.0/6.2, 7.1+)
- **Scope** — ICAI Guidance Note for non-corporate entities, periods from 1-Apr-2024; single or group Indian companies; per-user rights. [src](https://help.tallysolutions.com/financial-statements-for-nce/)
- **Enable** — web page: Serial No. > Check Eligibility > OTP to licence admin; then F1 > Settings > License > Manage License > F5 Update; F1 > Tally Plug-Ins shows add-on; Excel template zip in Appresources > Plugins. [src](https://help.tallysolutions.com/financial-statements-for-nce/)
- **Export** — from Balance Sheet, P&L, Trial Balance: Alt+E > Financial Statements for NCE; C options: Export Data for CY and/or PY; Current Year End Date; Previous Year data is in a separate Company (default No) + Name of Company + Previous Year End Date (auto); Export ledgers with zero balance and no transactions in TB (Yes); Export trade receivables and trade payables bill-wise (Yes); Export stock details item-wise/ledger (Yes); → XML (FinancialStatementsforNCE.xml). Group companies need matching F11 inventory options & same chart of accounts; only TB + Stock Summary exported. [src](https://help.tallysolutions.com/financial-statements-for-nce/)
- **Excel template** — Basic Info: import XML; Entity details autofill (name, address, PAN, Type of Entity); Round Off Amount to Nearest; Trade Receivables/Payables basis (As Per TB Closing Balance default / bill-wise/party-wise); PPE & IA block Net (default)/Gross; Signatory details; owner/partner profit shares → Note 3; Clear Data; Go to Index; Accounting Policies (Note 2); ReadMe. [src](https://help.tallysolutions.com/financial-statements-for-nce/)
- **Mapping** — worksheets TB CY/PY, Stock Summary, Trade Payables, Trade Receivables; Bifurcate Balance current/non-current & receivables >6 / <6 months; Classification 3→4→5 (custom descriptions; Update Notes with Classification 5); Copy Mapping from Current/Previous Year; amber flags for unmapped/imbalance; Save Mapping for reuse. [src](https://help.tallysolutions.com/financial-statements-for-nce/)
- **Output** — Print Current Sheet / Print All Notes (PDF or preview; nil CY+PY rows auto-dropped); Export to MS-Excel (values only, no formulas). [src](https://help.tallysolutions.com/financial-statements-for-nce/)

### Find (Alt+F, Rel 7.0)
- **Find from any screen** — keyword across masters & transactions; Find – Results with "Matches Found In" field; Alt+H Details of Match (bold exact, bold italics similar); drill to edit. [src](https://help.tallysolutions.com/find-tallyprime/)
- **F9 Include Similar Spellings** (text only; numbers exact) / **F8 Include Partial Match** / **Include Contains Match** (Ctrl+B) — each also defaultable via F1 > Settings > Find. [src](https://help.tallysolutions.com/find-tallyprime/)
- **Show results when** — All Words Are Present (default) / Any Word is Present; quote keywords with special characters. [src](https://help.tallysolutions.com/find-tallyprime/)
- **F3 Company** — current or All Companies; setting Find Within > Loaded Companies; F5 Company-view. [src](https://help.tallysolutions.com/find-tallyprime/)
- **Field-scoped queries** — `Field:value` (e.g. Destination:Delhi, Ledgername:"Bhagya Solutions"); operators OR (|), NOT (!), >, <, =; field names in English, values any language. [src](https://help.tallysolutions.com/find-tallyprime/)
- **Maintain History** — last five keywords on open, suggestions while typing; clear/disable in settings. [src](https://help.tallysolutions.com/find-tallyprime/)
- **F12** — No. of results to display (default top 100 each for Transactions and Masters; increases cumulatively); Show from Both/Transactions/Masters; F4 Master Type/Voucher Type; F2 period (default from Books Beginning). [src](https://help.tallysolutions.com/find-tallyprime/)
- **Security** — User Roles disallow "Find – Results"; respects voucher-type restrictions; F1 > Troubleshoot > Repair Index if results missing. [src](https://help.tallysolutions.com/find-tallyprime/)

### Fixed Assets Analysis
- **Report** — Data Analysis > Fixed Assets Analysis: per group/ledger Opening Balance, Additions, Deletions/Adjustments, Closing; No. of Days held for additions (<180 / >180 days) in Alt+F5 detailed; purchase entries for scrutiny. [src](https://help.tallysolutions.com/fixed-assets-analysis-tally/)
- **Buttons** — F2; Alt+F5; F9 Analysis & Ver Reports; Alt+R Verify / Alt+S Remove Verify (Spacebar select); Alt+V Master Configuration (identify Related Parties, Sampling Methods); F12 Show Verification Note. [src](https://help.tallysolutions.com/fixed-assets-analysis-tally/)

### Forex Transactions (Voucher Verification)
- **Report** — Analysis & Verification > Voucher Verification > Forex Transactions: per voucher type Type, Total Vouchers, Forex Vouchers, Verified count; drill Total → Voucher Register, Forex → Forex Vouchers (Voucher No., Forex Amount, Rate of Exchange, value, verification status/note). [src](https://help.tallysolutions.com/forex-transactions-tally/)
- **Buttons** — F2; F4 Voucher Type; Alt+F5; F9; Alt+J/Alt+L manual sampling; Alt+R/Alt+S verify; Alt+F12 Range; Ctrl+F12 Value. [src](https://help.tallysolutions.com/forex-transactions-tally/)
- **F12** — Show Narration; Show Bill wise Details also; Show Verification Status (default Yes); Show Verification Note (default Yes); Show Client's Clarification; Show Date and Time; filter by status (Altered, Verified, Clarified, Need Clarification, Not Verified, Under Observation, On Hold, Any); Show Vouchers Having Currency; Sorting Method. [src](https://help.tallysolutions.com/forex-transactions-tally/)

### Funds Flow
- **Report** — Alt+G > Funds Flow / Display More Reports > Funds Flow; monthly opening & closing working capital + Funds Flow (blank = no movement, negative = application > source); drill month → Funds Flow Summary: Sources vs Applications (Nett Profit/Loss, assets, liabilities) down to vouchers. [src](https://help.tallysolutions.com/funds-flow-report-tally/)
- **Options** — Ctrl+B Scale Factor; Alt+N Auto Column (quarterly etc.); Ctrl+J Negative Ledgers; browser view. [src](https://help.tallysolutions.com/funds-flow-report-tally/)

### Group Summary / Group Vouchers
- **Group Summary** — Alt+G > Group Summary > group; closing balances; F6 Monthly (Ledger Monthly Summary); F5 Ledger-wise/Group-wise toggle; Alt+F5 / F12 Format of Report: Detailed; F12 Show Available Balance as per Bank (Connected Banking, Rel 6.0+); F10 Budget Variance. [src](https://help.tallysolutions.com/group-summary/) [src](https://help.tallysolutions.com/budgets-tally/)
- **Group Vouchers** — vouchers with ≥1 ledger of group; F6 Monthly / Ctrl+F6 Daily; Ctrl+B Type of Voucher entries (Credit Entries Only / Debit Entries Only / All Vouchers); Alt+F5; F12 Show All Ledger Details, Show Mode of Payment/Receipt, Show additional bank details and status. [src](https://help.tallysolutions.com/group-summary/)

### Highest and Lowest Value Transactions
- **Report** — Data Analysis > Highest and Lowest Value Transactions: per ledger Highest, Lowest, Difference Range (H−L), Difference Range % ((H−L)/L); drill → top 5 highest + 5 lowest per ledger (F12 Show Highest / Show Lowest counts). [src](https://help.tallysolutions.com/highest-and-lowest-value-tally/)
- **Buttons** — F2; F4 Group; F8 Show Ledger; F9; Alt+J/Alt+L sampling; Alt+R/Alt+S verify; Alt+F12; Ctrl+F12. F12: Show Narrations, Verification Status/Note, Client's Clarification, Date and Time, Verified By, Clarification from, status filter, Include Exceptional Vouchers. [src](https://help.tallysolutions.com/highest-and-lowest-value-tally/)

### Ledger Vouchers
- **Report** — Alt+G > Ledger Vouchers > ledger (or drill from Group/Monthly Summary); F5 Bill wise (pending bills); Ctrl+B Type of Voucher entries (Credit Entries Only / Debit Entries Only / All Vouchers); F12 Show Running Balance; Show Mode of Payment/Receipt; Show additional bank details and status; Show Available Balance as per Bank; Format Detailed + Show Cost Centre details; Alt+S Contact. [src](https://help.tallysolutions.com/ledger-vouchers/) [src](https://help.tallysolutions.com/cost-centre-or-profit-centre-tally/)

### Notifications (Rel 7.0)
- **Notifications report** — Ctrl+Alt+N or bell icon (red dot); F4 Activity filter; Ctrl+B status Read / Unread / All; Enter to act; unread bold; Spacebar + Alt+D Dismiss (permanent delete). [src](https://help.tallysolutions.com/notifications-report/)
- **Settings** — F1 > Settings > Display > Show Notifications for Activity; Allow AddOns to send Notifications + Manage Notifications from AddOns; Show Red Dot for: Any / New (default) / Unread Notifications. [src](https://help.tallysolutions.com/notifications-report/)

### Payment / Receipt Registers & Receipts and Payments
- **Payment Register / Receipt Register** — Display More Reports > Account Books; monthly counts → vouchers; Ctrl+H columnar with expense/income ledgers as columns, related Post-Dated Bank Transactions; F8 Columnar; Ctrl+J Optional / Cancelled / Post-Dated Vouchers. [src](https://help.tallysolutions.com/payments-and-receipts-tally/)
- **Receipts and Payments report** — Alt+G > Receipts and Payments; opening cash/bank → receipts/payments by primary group → closing; drill to R&P Summary → Ledger Monthly Summary → vouchers; Ctrl+B Nett Balances, Scale Factor; Ctrl+H vertical / ledger-wise; Ctrl+J Negative Ledgers; Alt+N auto columns. [src](https://help.tallysolutions.com/payments-and-receipts-tally/)
- **Cash/Bank Opening/Closing summary** — click Opening Balance; F12 Show Transactions, Show Opening Balances (Yes), Show Closing Balances (Yes). [src](https://help.tallysolutions.com/payments-and-receipts-tally/)

### Pending Advances / Pending Documents
- **Pending Advances** — Data Analysis > Pending Advances: opening loans/advances given, movements, closing; F12 Include Squared-Off Ledgers, Show Name of Group, Display name for Ledgers, Sorting Method; drill → Ledger Vouchers: F2, F3, F4, Alt+F5, Ctrl+F6 Daily, F8 Columnar, F9, Ctrl+B Include Post-dated / Type of Voucher entries, Alt+J/Alt+L sampling, Alt+R/Alt+S verify, Alt+V Contact, Alt+F12. [src](https://help.tallysolutions.com/pending-advances-tally/)
- **Goods Received but Bills not Received** — Pending Purchase Bills Summary (party-wise total) → Pending Purchase Bills (Date, Tracking Number, Ordered Qty, Pending Qty, Rate, Due On, Value, Verification Status/Note; qty/rate/due in Alt+F5); F2, F3, F4, F9, Alt+V Master Configuration (Periodic Payments and Receipts, Related Party, Sampling Methods). [src](https://help.tallysolutions.com/pending-bills-tally/)
- **Goods Delivered but Bills not Made** — Pending Sales Bills Summary → Pending Sales Bills (delivery notes not invoiced; same columns); F8 Show Ledger; F12 Show Actual and Billed Quantities, Show Alternative Units, Show Location details, Show Batch details, Show Preclosure Order details, Show Reason, Format of Report, Display name for Stock Items/Ledgers. [src](https://help.tallysolutions.com/pending-bills-tally/)
- **Pending Documents hub** — rows: Pending Orders (Purchase Orders, Sales Orders), Pending Bills (Goods Received but Bills not Received, Goods Delivered but Bills not Made), Outstandings (Net Pending Receivables, Net Pending Payables) with counts & amounts; F3, F9, Alt+V. [src](https://help.tallysolutions.com/pending-documents-tally/)

### Periodic Payments and Receipts
- **Mark periodic ledgers** — Alt+V Master Configuration > Data Analysis Configuration > Periodic Payments and Receipts; Spacebar select, Alt+V Update; F3, F4 Group, F9, Alt+W Restore Default. [src](https://help.tallysolutions.com/periodic-payments-and-receipts-tally/)
- **Report** — per periodic ledger, current vs previous year total amount & voucher count, amount & voucher variance; F4 Group; F8 Show Ledger; F9; Alt+V; F12 Show ledgers with Variance, Show Name of Group, Display name for Ledger, Scale Factor, Show Base Currency; drill → Periodic Ledger Monthly Summary → Ledger Vouchers (Ctrl+B Show Forex transactions only, Type of Voucher entries; sampling/verify keys). [src](https://help.tallysolutions.com/periodic-payments-and-receipts-tally/)

### Financial Statements add-on: Schedule III (Division I) & NCE (Rel 7.1+)
- **Export** — BS/P&L/TB > Alt+E > Financial Statements > Schedule III for Division I or Financial Statements for NCE; C: Export Data for (CY & PY default); Current Year End Date; Previous Year data is in a separate Company + company + PY End Date; Export Ledgers with zero balance and no transactions in TB (No); Export Sundry Debtors and Sundry Creditors details (Party-wise default / Bill-wise if bill-wise enabled); Export total value of Stock Items/Ledgers (No); Exclude Items/Ledgers with zero balance (No); Show Company Address (Yes); Folder Path; File Name; Open file after Export. [src](https://help.tallysolutions.com/prepare-financial-statements/)
- **Template** — Basic Information (rounding, PPE & IA block, signatories; Share Capital details for Sch III; owners/partners for NCE); 8 worksheets incl. TB CY/PY, Stock Summary, Sundry Debtors/Creditors with ageing; ledger mapping C1 FS Heads / C2 Notes Heads / C3 Notes Sub-Heads, most pre-mapped by parent group; Update Mapping from TB CY; current/non-current bifurcation; Provisional Adjustments columns (Dr = Cr); Update Input Sheets; Populate Data from TB; User Notes / Save Notes; Generate All Notes / Generate Note; Reconcile Differences sheet. [src](https://help.tallysolutions.com/prepare-financial-statements/)
- **Cash Flow Statement in template** — CFS Input mapping (C1 Primary / C2 Secondary grouped-under → moved-to), enter previous-to-previous year BS balances, CFS Working, Generate CFS, cash mismatch highlighted red, Populate Data from FS to reset. [src](https://help.tallysolutions.com/prepare-financial-statements/)
- **Output** — Export to PDF, Print, Export to MS-Excel (no formulas). Schedule III for Division I release note exists. [src](https://help.tallysolutions.com/prepare-financial-statements/) [src](https://help.tallysolutions.com/schedule-iii-for-division-i-release-note/)

### Profit & Loss A/c
- **Open** — Gateway > Profit & Loss A/c (Alt+G); default books start → last entry; F2 period; Alt+F5 Detailed; browser view. [src](https://help.tallysolutions.com/profit-and-loss-statement-tally/)
- **F12** — Show Vertical Profit & Loss (Trading Account + Income Statement sections); Show Percentages (Sales = 100%); Show with Gross Profit (horizontal only; GP after cost of sales & direct expenses, then indirect → Nett Profit). [src](https://help.tallysolutions.com/profit-and-loss-statement-tally/)
- **Alt+N Auto Column** — periods (daily…quarterly), stock valuation methods, companies. [src](https://help.tallysolutions.com/profit-and-loss-statement-tally/)
- **Income & Expense Statement** — P&L ledger alteration "Use as Income & Expense A/c" for non-trading entities (NGOs, trusts, schools). [src](https://help.tallysolutions.com/profit-and-loss-statement-tally/)

### Ratio Analysis
- **Open** — Alt+G > Ratio Analysis / Gateway; browser view; drill each item to source report (e.g. Current Ratio → BS, GP% → P&L). [src](https://help.tallysolutions.com/ratio-analysis-tally/)
- **F12** — Show Explanation (formula descriptions); Show Vertical Analysis. [src](https://help.tallysolutions.com/ratio-analysis-tally/)
- **Principal Groups** — Working Capital (CA − CL); Cash-in-Hand; Bank Accounts; Bank OD A/c; Sundry Debtors (due till today); Sundry Creditors (due till today); Sales Accounts; Purchase Accounts; Stock-in-Hand; Nett Profit; Wkg. Capital Turnover (Sales/Working Capital); Inventory Turnover (Sales/Closing Stock). [src](https://help.tallysolutions.com/ratio-analysis-tally/)
- **Principal Ratios** — Current Ratio (CA:CL); Quick Ratio ((CA − Stock):CL); Debt/Equity Ratio; Gross Profit %; Nett Profit %; Operating Cost % (of turnover); Recv. Turnover in days; Return on Investment % (Nett Profit / (Capital + Nett Profit)); Return on Wkg. Capital % (Nett Profit / Working Capital). [src](https://help.tallysolutions.com/ratio-analysis-tally/)
- **Payment Performance of Debtors** — drill Recv. Turnover → Group Payment Performance → Ledger Payment Performance: receivable turnover days (outstanding/sales × days) + per-invoice paid date, due, delay; customer average performance. [src](https://help.tallysolutions.com/ratio-analysis-tally/)

### Feature videos index (reports-adjacent)
- **Dashboard tile recipes** — Gross Profit Trend across FYs; Group Trend for daily receipts/payments & cash-in-hand; Stock Item Trend compare; Top Stock Groups (no-movement & top-selling); Top Groups/Ledgers; Group Trend sales compare; Cost Centre Trend; Top Cost Centres; restrict tile access. [src](https://help.tallysolutions.com/reports-videos/)
- **Other** — Digital signature on exported/e-mailed/printed PDFs incl. multi-voucher reports; Edit Log (voucher-type-wise & master-wise summaries, version diff); WhatsApp sharing via Interakt with security controls; SmartFind across loaded companies; multilingual reports (Arabic, Bangla). [src](https://help.tallysolutions.com/reports-videos/)

### Stale Cheques/Instruments
- **Report** — Data Analysis > Stale Cheques/Instruments: bank-wise count & amount where Bank Date − Instrument Date > validity (default 3 months); F4 Validity Period (Months ≤12 or Days ≤365; resets on leaving Data Analysis); drill → Date, Particular, Vch Type/No., value, Instrument Date, Bank Date, Age by Days, verification. [src](https://help.tallysolutions.com/stale-cheque-instruments-tally/)
- **Buttons/F12** — F2, F3, Alt+F5 Condensed, F8 Show Ledger, F9, Alt+J/Alt+L sampling, Alt+Q Reconcile (enter bank date), Alt+R/Alt+S verify, Alt+F12, Ctrl+F12; F12 Show Narrations, Validity Period, Show Transaction Type, Show Instrument No, Verification Status/filter/Note, Client's Clarification Note, Date and Time, Verified By, Clarification from, Sorting Method (Alphabetical / Amount-wise / No of Days Delayed). [src](https://help.tallysolutions.com/stale-cheque-instruments-tally/)

### Statistics
- **Report** — Alt+G > Statistics / Display More Reports > Statement of Accounts > Statistics: Types of Vouchers (counts) and Types of Accounts (master counts) side-by-side; drill voucher type → Voucher Monthly Register → vouchers. [src](https://help.tallysolutions.com/statistics-report-tally/)
- **F12** — Show Vertical Statistics (or Ctrl+H); Sort by Default Vouchers (22 predefined types; user types grouped under parent); Show Voucher Types having entries only. [src](https://help.tallysolutions.com/statistics-report-tally/)
- **Alt+N** — Quarterly etc., Company (compare companies); pre/post-migration comparison. [src](https://help.tallysolutions.com/statistics-report-tally/)

### Tally Audit
- **Enable** — Alt+K > Alter > Enable TallyAudit features (needs Control User Access to Company Data; admin or user role with Audit Listings). [src](https://help.tallysolutions.com/tally-audit-tally/)
- **Audit Statistics – Voucher Types** — Display More Reports > Statement of Accounts > Tally Audit > Voucher Types: Entered & Altered counts; F12 Show Voucher Types having no entries, Show count of Modified, Cancelled & Deleted Vouchers, Sort by default voucher; F2 period; F8 Today's Changes (by system date); Alt+F8 All Vouchers (first 1000); Ctrl+L Save View (Name, default view, Save view for All Companies/This Company, Save with the selected period). [src](https://help.tallysolutions.com/tally-audit-tally/)
- **Tally Audit Monthly Register** — F12 Periodicity (4 week month, Daily, Fortnightly, Half Yearly, Monthly, Quarterly, Weekly, Yearly); F4 Voucher Type; F6 Monthly, Alt+F6 Quarterly, Ctrl+F6 Daily; Ctrl+H views; drill → Tally Audit Listing. [src](https://help.tallysolutions.com/tally-audit-tally/)
- **Audit – Masters** — Ledgers only; Entered vs Altered (name, opening balance changes, new ledgers; ledger ID to detect swapped names); Ctrl+J List of Unused Ledgers, Show Used, E-mail Validation, Update Party GSTIN; Alt+R Accept One, Alt+S Accept All (accepted items drop off listing); F8 Today's Changes; Ctrl+H Voucher type-wise / User-wise. [src](https://help.tallysolutions.com/tally-audit-tally/)
- **Audit – Users** — per user name, user type, Entered/Altered counts (masters + vouchers); F12 Show User having no entries, Show count of Modified/Cancelled/Deleted; drill → User Statistics (Accounting Masters, Type of Vouchers); F4 Change User. [src](https://help.tallysolutions.com/tally-audit-tally/)

### Transactions on Holiday
- **Report** — Data Analysis > Transactions on Holiday: Day, Reasons for Holiday, Particulars, Voucher Type/No., value, verification; default weekly off Sunday. [src](https://help.tallysolutions.com/transactions-on-holiday-tally/)
- **Alt+Q Holiday Configuration** — Weekly Off (up to 2 days or Not Applicable); declared holidays (Date, auto Day, Reason for Holiday); also available to clients via Voucher Clarification. F2, F3, Alt+F5. [src](https://help.tallysolutions.com/transactions-on-holiday-tally/)
- **Holiday report F12** — Show Narrations; Show Verification Status filter; Show Verification Note (default Yes); Show Client's Clarification Note; Show Date and Time; Show Verified by; Show Clarification from; Show Weekly Off (All Items / Not Applicable / specific day); Show Holiday (All Items / Not Applicable / specific holiday); Include Vouchers with exceptions (optional); Sorting Method. Buttons F9, Alt+J/Alt+L, Alt+R/Alt+S, Alt+F12. [src](https://help.tallysolutions.com/transactions-on-holiday-tally/)

### Trial Balance
- **Open** — Alt+G > Trial Balance / Display More Reports > Trial Balance; default as of last voucher date; group-wise Dr/Cr; shows "Difference in opening balances" line. [src](https://help.tallysolutions.com/trial-balance-tally/)
- **F12** — Show Opening Balance (side-by-side with closing); Show Transactions (Dr & Cr columns); Nett Transactions (merge Dr/Cr); Expand all levels in Detailed format (incl. groups that behave like sub-ledger). [src](https://help.tallysolutions.com/trial-balance-tally/)
- **Views** — F5 Ledger-wise ⇄ Group-wise; Alt+F5 Detailed; F10 Budget Variance; Alt+C Type of Value Actual with Post-Dated; closing stock excluded by design. [src](https://help.tallysolutions.com/trial-balance-tally/) [src](https://help.tallysolutions.com/budgets-tally/) [src](https://help.tallysolutions.com/faq-banking-tally/)
- **Tracking-number effects** — Receipt Notes show Purchase Accounts (Bills to Come) Dr / Purchase Bills to Come Cr; Delivery Notes show Sales Bills to Make. [src](https://help.tallysolutions.com/trial-balance-tally/)
- **Opening balance differences** — causes (manual errors, prior company, removed balances, split data edits, import/sync overwrite); fix ledger by ledger. "Group behaves like a sub-ledger" default Yes for Sundry Debtors/Creditors. [src](https://help.tallysolutions.com/trial-balance-tally/)

### Save View (Ctrl+L)
- **Save** — Name (prefilled "<Report> – My View"); Set this as default view for the report; Show additional configuration; Save view for All Companies (On This Computer, app folder) / This Company (shared across computers & users); Save with the master selected (N/A for BS, Day Book); Save with the selected period. Captures period, Ctrl+B values, filters, F12 config. [src](https://help.tallysolutions.com/use-save-view-feature-in-tallyprime/)
- **Open/manage** — via Alt+G (views listed) or Ctrl+H > Saved Views; Ctrl+H > Show Original View; Ctrl+H > Set/Alter Default View; rename via Ctrl+L; Ctrl+H > Delete Saved Views; F1 > Troubleshooting > Delete Views Saved for All Companies / for This Company. Multi-company views open only for loaded companies. [src](https://help.tallysolutions.com/use-save-view-feature-in-tallyprime/)

### Verification of Balances
- **Report** — Data Analysis > Verification of Balances: per group Opening, Closing, Difference + transactions; closing in red when against natural behaviour; "Previous Year Period: Not Applicable" in red if prior-year company not loaded. [src](https://help.tallysolutions.com/verification-balance-tally/)
- **Buttons** — F3; F4 Group; F5 Ledger-wise; Alt+F5 Detailed; F7 Compare Company (load prior-year company); F9; F10 Balance Variance; Alt+V Master Configuration; Ctrl+F10 Exception Only; Alt+F10 Verification of Opening Bal (and Opp Behaviour view); F12 Sorting Method (Default, A–Z, Z–A, Amount Dec/Inc). [src](https://help.tallysolutions.com/verification-balance-tally/)
- **Verification of Opening Balances** — prior-year vs current opening by group/ledger (Non Revenue default; F12 Ledgers Type Non Revenue/Revenue/All Items); Ctrl+Enter fix ledger; Alt+R mark Verified/On hold; F12 Show Verification Note, Show Exception First, Expand all levels, display names, sorting. [src](https://help.tallysolutions.com/verification-balance-tally/)
- **Ledger Vouchers (verification)** — F10 Other Info (Is Related Party, sampling method); Ctrl+F6 Daily for cash; F12 Show transactions with Verification Status (Any, On Hold, Altered, Clarified, External Clarification, Internal Observation, Internal Observation Clarified, Not Verified, Verified); Show Category (All Items, Authorization, High Value, Not Connected to Business, Supporting); Show Priority (High/Medium/Low); clarification fields. [src](https://help.tallysolutions.com/verification-balance-tally/)
- **Ledger Balance Variance** — previous vs current year closing per ledger with Variance amount & %; F4 Group, F5 Group-wise, Alt+R verify; F12 Ledgers with Variance Status as (>, <, = amount or %); Sorting (Variance % / Difference Amount inc/dec, alphabetical). [src](https://help.tallysolutions.com/verification-balance-tally/)
- **Negative Cash Variance** — drill Current Assets > Cash-in-Hand > Cash > Ctrl+F6 Daily; Ctrl+F10 Exceptions Only for negative days. [src](https://help.tallysolutions.com/verification-balance-tally/)

### Verification of Chart of Accounts
- **Statuses** — Accounts squared-off during the year; Not Available in Current Year; Not Used; Not Used in Current Year; Only Balance Last Year and Used in Current Year; Only Balances, No Transactions; Regrouped (primary group changed; sub-group via F12); Revenue Ledgers having Opening Balances; Used Only in Current Year; F12 extra All Items, No Change. Requires prior-year company loaded if split. F3, F4 Group, F5 Ledger-wise. [src](https://help.tallysolutions.com/verification-charts-accounts-tally/)
- **Verification of Chart of Accounts — buttons/F12** — Alt+F5 detailed list per status; F7 Compare Company; F8 Show Ledger; F9; Alt+R Verify (ledger statuses only Verified / On Hold); Alt+S; Alt+V; F12 Show Ledgers of Having Status, Include Subgroup Changes also (Regrouped), Ledgers Type, Show Name of Group, Show Primary Group, Show Verification Note, Ledger of Verification Status as (On Hold/Verified/Altered/Any), Display name for Ledgers (Alias (Name) / Alias Only / Name (Alias) / Name Only). Ledger Vouchers drill: F5 Bill-wise, F6/Alt+F6/Ctrl+F6, F8 Columnar, Ctrl+B Show Forex transactions only, hidden Ctrl+F Search Verification Note. [src](https://help.tallysolutions.com/verification-charts-accounts-tally/)

### Voucher Verification (audit workflow)
- **Verification dashboard** — rows Verification of Vouchers / Related Party Transactions / Forex Transactions; columns Total, Sampled (count, %, voucher-type & ledger-wise split), Verified (count, %), Internal Observation (Pending/Clarified), External Clarification (Pending/Clarified), Altered (To be re-verified — changed after Verified). [src](https://help.tallysolutions.com/voucher-verification-tally/)
- **Verification of Vouchers report** — per voucher type: Sampling Method, Total, Verified, Sampled (per ledger entry, can exceed vouchers); F2, F3, F4 Voucher Type; F8 Show Sample Vouchers; Alt+F8 Show Verified Vouchers; Ctrl+F8 Group/Ledger wise (primary groups with Total/Verified/Sampled); Alt+B Sampling Configuration; Alt+V Master Configuration; Alt+W Restore Default; Alt+F12; F12 Show Sampling details, Show Type of Voucher. Drill → Voucher Monthly Register → Voucher Register (Alt+J/Alt+L manual sampling, Alt+R/Alt+S). [src](https://help.tallysolutions.com/verification-of-vouchers-tally/)
- **Verification Ledger Vouchers** — F10 Other Info (Related Party?, MSME enterprise type, sampling applied); F12 status filter (Altered, Verified, Clarified, Need Clarification, Not Verified, Under Observation, On Hold, Any), Category (Authorization, High Value, Not Connected to Business, Supporting), Priority (High/Medium/Low), clarification fields. [src](https://help.tallysolutions.com/verification-of-vouchers-tally/)
- **Verification statuses** — On Hold; External Clarification (Verification Note, Clarification From = specific user, Priority High/Medium/Low; F12 Show Priorities and Categories for Classifications); Internal Observation; Internal Observation Clarified; Verified. [src](https://help.tallysolutions.com/verification-status-tally/)
- **Voucher Clarification (client side)** — Display More Reports > Account Books > Voucher Clarification: Need Clarification list; Alt+B Clarify (enter clarification) → counted as External Clarification – Clarified; holiday calendar also here. [src](https://help.tallysolutions.com/voucher-clarification-tally/)
- **Sampling** — Alt+V Master Configuration applies sampling methods at voucher-type or group/ledger level; Alt+J Set / Alt+L Delete Manual Sampling on selected vouchers in every analysis report. Specific sampling-method list and Related Party / Analytical Procedures / Repeated Transactions / RSF / Inter Bank pages were not in this crawl. [src](https://help.tallysolutions.com/verification-of-vouchers-tally/) [src](https://help.tallysolutions.com/data-analysis-tally/)

### Reports in foreign currency
- **Alt+A Alter Column > Currency** — view whole report in any defined currency (enter/override rate inline; rate shown); **Alt+C New Column** per currency for multi-currency side-by-side; base-currency column hides name unless symbol chosen. Currency need not be used in transactions. [src](https://help.tallysolutions.com/view-reports-with-foreign-currency/)

### Working with reports (common mechanics)
- **Navigation** — Alt+G Go To (search any report; Expand All; Show More for less-used reports) vs Gateway of Tally > Display More Reports groups; reports grouped (Final Accounts, Banking Utilities…). [src](https://help.tallysolutions.com/working-with-reports/)
- **Drill & explode** — Enter drill to next report; Shift+Enter explode/collapse one line inline; Alt+F1 / Alt+F5 expand all (Detailed). [src](https://help.tallysolutions.com/working-with-reports/)
- **Selection & lines** — Spacebar select, Ctrl+Spacebar select all; Ctrl+R remove line; Alt+U restore all; Alt+D delete voucher; Alt+X cancel; Ctrl+Q quit. Bottom bar of shortcuts (Rel 2.0.1; F1 > Settings > Display > Application > Show bottom bar). [src](https://help.tallysolutions.com/working-with-reports/)
- **Right buttons** — F2 Date/Period; F3 Company; F4 report-specific context (voucher type, stock group, ledger…); F5/F6 report-specific views (Item-wise, Monthly; Bills Payables F6 → Receivables); Ctrl+B Basis of Values (e.g. Type of Voucher Entries, Show Forex Transactions only, Scale Factor, Include Post-dated); Ctrl+H Change View & related reports (e.g. Monthly Summary, Ageing Analysis); Ctrl+J Exception Reports (Negative Ledgers, Optional/Cancelled/Post-dated vouchers, Overdue…); Ctrl+L Save View; F12 Configure. [src](https://help.tallysolutions.com/working-with-reports/)
- **Columns** — Alt+C New Column (period, company, scenario, currency, budget, cost centre…), Alt+A Alter Column, Alt+D Delete Column, Alt+N Auto Column (repeat by period: daily/weekly/fortnightly/monthly/quarterly/half-yearly/yearly, Company, Member Companies, Stock Valuation Methods). [src](https://help.tallysolutions.com/working-with-reports/) [src](https://help.tallysolutions.com/balance-sheet-tally/)
- **Stripe View (Rel 5.0)** — alternate row shading per report (F12 Enable Stripe View) or app-wide; carries into print/export/e-mail/WhatsApp. [src](https://help.tallysolutions.com/working-with-reports/)
- **Share** — Export (Alt+E), E-mail, WhatsApp (Alt+M Share), Print (Alt+P/Ctrl+P) with app-level default configurations overridable per report; Rel 1.1.4 Preview as default print action; printer/format/paper/title from right buttons. Reminder Letters & Confirmation of Accounts printable for parties. Formats seen: PDF, JPEG, Excel (xlsx), XML. [src](https://help.tallysolutions.com/working-with-reports/) [src](https://help.tallysolutions.com/payment-request/)
- **Browser view** — Balance Sheet, P&L, Cash/Bank Book, Cash Flow, Funds Flow, Ratio Analysis viewable in browser. [src](https://help.tallysolutions.com/balance-sheet-tally/) [src](https://help.tallysolutions.com/ratio-analysis-tally/)
- **Analysis report common keys** — F9 Analysis & Ver Reports jump list; Alt+V Master Configuration (Related Party, Periodic Payments and Receipts, Sampling Methods); Alt+J/Alt+L manual sampling; Alt+R/Alt+S verify; Ctrl+F10 Exceptions only; Alt+F12 Range; Ctrl+F12 Value. [src](https://help.tallysolutions.com/data-analysis-tally/) [src](https://help.tallysolutions.com/verification-balance-tally/)

### Gaps in this crawl (banking & reports)
- Not covered by any page in this job: Confirmation of Accounts details, Reminder Letter configuration options, ageing slab defaults, credit limit / credit period master fields, Bills Receivable/Payable F12 option list, Sales/Purchase/Journal register column options, columnar Sales Register, Exception Reports full list (beyond Negative Ledgers/Optional/Cancelled/Post-dated/Overdue), Related Party Transactions, Repeated Transactions, Relative Size Factor, Inter Bank Transactions, Analytical Procedures, sampling-method list, Group Company consolidation details, multi-account printing options, Mark changed vouchers, Get Balance/Get Statement step pages, user-access approval page, transaction-limit setup page, bank-statement voucher-creation (single/multiple/consolidated) step page, Ledger Outstandings F12 options.

Irrelevant/unreadable files: f12_configuration_from_te9_to_tallyprime (empty, 141 B); integration pages (how_to_use_report_level_attributes_for_integration, integration_initiated_from_tpas, integration_methods_and_technologies, odbc_integrations, secure_websocket_integration_with_tallyprime, xml_integration, real_world_scenarios, report_defintion_attributes [TDL]); schedule_backup_report, migration_summary_report, post_migration_activities, master_mapping_report, virtual_office_operations, recommended_system_configuration_for_tallyprime (out of scope); job4.txt had two filenames concatenated on one line (view_reports_with_foreign_currency + day_book) — both read.


## Gap-fill: inventory masters & voucher-type list (UNVERIFIED — from product knowledge)

> The canonical page (https://help.tallysolutions.com/manage-stock-item-tally/) returned HTTP 500 on every attempt (Playwright, curl, WebFetch). The bullets below come from general TallyPrime product knowledge, not this crawl. Check them against the app or the help page before relying on any detail.

- **Stock Item master** — fields: Name, (alias); Under (Stock Group); Category; Units (simple or compound); Alternate Units, with the conversion "Where X <alt unit> = Y <base unit>"; Batch-wise details (Maintain in batches / Track date of manufacture / Use expiry dates), shown when F11 batches is on; Standard Rates (cost and selling, with effective dates); Costing Method; Market Valuation Method; Set components (BoM), with a list of BoMs; GST applicability, HSN/SAC and GST rate details (with source Company/Group/Classification/specify here); Type of Supply (Goods/Services); Rate of Duty; MRP details (from-date with state-wise MRP); Opening Balance (qty, rate per unit, value, with godown/batch allocation); Part No.; Description; Notes; Reorder Level / Minimum Order Qty (from the Reorder Status report); language alias. Created via Alt+G > Create Master > Stock Item, or on the fly with Alt+C.
- **Costing methods** — Average Cost, At Zero Cost, FIFO, FIFO Perpetual, Last Purchase Cost, LIFO Annual, LIFO Perpetual, Monthly Average Cost, Standard Cost.
- **Market valuation methods** — Average Price, Last Sale Price, Standard Price, At Zero Price.
- **Unit of Measure** — Type: Simple (symbol, formal name, UQC mapping for GST, number of decimal places) or Compound (first unit, conversion, second unit, e.g. Box of 12 Nos). Multiple alternate units are possible per item. Units can also have a "Unit Quantity Code (UQC)" used in GSTR-1 and e-Invoice.
- **Stock Group** — Name, Under (parent group), "Should quantities of items be added?" (Yes/No), GST/HSN rate details inheritable by items, and costing setup.
- **Stock Category** — Name, Under: a parallel classification to Stock Group (e.g. by brand or size). The F11 option "Enable Stock Categories" (show more features) turns it on.
- **Negative stock & zero-valued entries** — F12 voucher configuration "Warn on Negative Stock Balance" (Yes/No). The company-level "Allow zero-valued entries" can be enabled per voucher entry via F12 in TallyPrime. Negative stock is allowed by default; Negative Stock exception reports list affected items (Ctrl+J exceptions).
- **Predefined voucher types (24)** — Attendance, Contra, Credit Note, Debit Note, Delivery Note, Job Work In Order, Job Work Out Order, Journal, Material In, Material Out, Memorandum, Payment, Payroll, Physical Stock, Purchase, Purchase Order, Receipt, Receipt Note, Rejections In, Rejections Out, Reversing Journal, Sales, Sales Order, Stock Journal. User-defined types are built on these (for example Manufacturing Journal, POS sales, Quotation, Branch Transfer) by choosing "Select type of voucher". Some types (Memorandum, Reversing Journal, order types) are inactive until activated via F11 or the type's "Activate this Voucher Type".

## Gap-fill: Godowns / Locations (verified, re-fetched page)

- **Godown master** — Name, multiple aliases, language aliases, and Under (Primary or a parent godown) for building hierarchies (region > warehouse > rack > bin). An internal godown, "Main Location", holds all stock by default and can be renamed. A godown can be deleted only if it holds no stock, is unused in transactions, and is not a parent. Path: Alt+G > Create Master > Godowns. Shortcuts on this screen: Alt+C creates a parent on the fly, Ctrl+G creates a stock group, Ctrl+I a stock item, Ctrl+U a unit. [src](https://help.tallysolutions.com/inventory-storage-using-godowns-locations-tally/)
- **Godown F12 options** — Provide aliases; Provide language aliases; Use grouping for godowns; Use address for Locations (the address can print on invoices); Allow storage of materials (No makes it a grouping-only godown); Set Job Costing details (link to cost centres); Enable third party stock details (consignment or job-work stock held by or for others). [src](https://help.tallysolutions.com/inventory-storage-using-godowns-locations-tally/)
- **Multi Create godowns** — Chart of Accounts > Alt+H (Multi-Masters) > Multi Create. Parent can be set per row ("All Items") or fixed for all rows. [src](https://help.tallysolutions.com/inventory-storage-using-godowns-locations-tally/)
- **Godown allocation & valuation** — one voucher line can be split across godowns (e.g. 300 t to A, 700 t to B). Each godown's stock is treated as an independent lot for valuation, and Stock or Godown Summary totals are the sum of those lots. Opening balance allocation is made per godown from Stock Item > Opening Balance. Requires F11 "Maintain Multiple Godowns". The Godown/Location Summary report shows stock per location. [src](https://help.tallysolutions.com/inventory-storage-using-godowns-locations-tally/)


## Coverage gaps

- These pages were not in the crawl, or held no content: the Stock Item / Unit / Stock Group master screens (HTTP 500, so filled from product knowledge in section 6); Confirmation of Accounts and Reminder Letter option lists; ageing-slab defaults; credit-limit master fields; Bills Receivable/Payable F12 lists; Sales/Purchase register and columnar options; the full Exception Reports list; Related Party, Repeated Transactions, Relative Size Factor and Sampling analysis pages; multi-account printing options; e-commerce operator sales; ISD; GSTR-9C; Form 27Q detail; PF/ESI form contents; consolidated EWB; websocket integration; MCP tool details (page was nav-only); POS entry walkthrough; round-off and narration configuration detail.
- The price-list pages on TallyHelp render their tables with JavaScript and were empty. Prices come from tallysolutions.com/buy-tally and the TCO business guide instead.
- Non-India localisations (GCC/UAE/KSA VAT, Kenya eTIMS, Nepal, Bangladesh) and the TDL developer reference were excluded on purpose.

## Unreachable pages

- https://help.tallysolutions.com/all-exceptions-gstr-3b/: status 404
- https://help.tallysolutions.com/banking-connected/: status 404
- https://help.tallysolutions.com/banking-utilities-tally/: page.goto: net::ERR_INTERNET_DISCONNECTED at https://help.tallysolutions.com/ban
- https://help.tallysolutions.com/budgets-tally/: page.goto: net::ERR_INTERNET_DISCONNECTED at https://help.tallysolutions.com/bud
- https://help.tallysolutions.com/e-payments/: page.goto: net::ERR_INTERNET_DISCONNECTED at https://help.tallysolutions.com/e-p
- https://help.tallysolutions.com/godown-location/: page.goto: net::ERR_INTERNET_DISCONNECTED at https://help.tallysolutions.com/god
- https://help.tallysolutions.com/gst-sales-tally-2/: status 404
- https://help.tallysolutions.com/gst-sales-tally/sales-vch-gst/: status 404
- https://help.tallysolutions.com/how-to-print-invoices-and-reports-in-tallyprime/: status 404
- https://help.tallysolutions.com/inventory-entry-tally/: page.goto: net::ERR_INTERNET_DISCONNECTED at https://help.tallysolutions.com/inv
- https://help.tallysolutions.com/invoice-management-system-inward-in-tallyprime/: page.goto: net::ERR_INTERNET_DISCONNECTED at https://help.tallysolutions.com/inv
- https://help.tallysolutions.com/job-work/: page.goto: net::ERR_INTERNET_DISCONNECTED at https://help.tallysolutions.com/job
- https://help.tallysolutions.com/knowledgebase/manage-stock-item-tally/: HTTP Error 500: Internal Server Error
- https://help.tallysolutions.com/manage-stock-item-tally/: HTTP Error 500: Internal Server Error
- https://help.tallysolutions.com/manage-stock-item-tally/: status 500
- https://help.tallysolutions.com/mark-changed-vouchers-tally/: page.goto: net::ERR_INTERNET_DISCONNECTED at https://help.tallysolutions.com/mar
- https://help.tallysolutions.com/no-accounting-or-inventory-entries-are-available/: page.goto: net::ERR_INTERNET_DISCONNECTED at https://help.tallysolutions.com/no-
- https://help.tallysolutions.com/payment-advice/: page.goto: Timeout 30000ms exceeded.
- https://help.tallysolutions.com/printing-multi-account-reports/: page.goto: net::ERR_INTERNET_DISCONNECTED at https://help.tallysolutions.com/pri
- https://help.tallysolutions.com/record-tds-on-purchase-of-goods-under-section-194q/: status 404
- https://help.tallysolutions.com/scenarios-tally/: page.goto: net::ERR_INTERNET_DISCONNECTED at https://help.tallysolutions.com/sce
- https://help.tallysolutions.com/set-up-gst-details-in-company/enable-gst/: status 404
- https://help.tallysolutions.com/statistics-report-tally/: page.goto: net::ERR_INTERNET_DISCONNECTED at https://help.tallysolutions.com/sta
- https://help.tallysolutions.com/tallydrive-management-report-2/: page.goto: net::ERR_INTERNET_DISCONNECTED at https://help.tallysolutions.com/tal
- https://help.tallysolutions.com/tallydrive-management-report/: page.goto: net::ERR_INTERNET_DISCONNECTED at https://help.tallysolutions.com/tal
- https://help.tallysolutions.com/tally-prime/connected-services/tally-reports-in-browser-tally/reports-browsers-mobile-tabs/: status 404
- https://help.tallysolutions.com/tally-prime/data-management/split-company-data-tally/25/: status 404
- https://help.tallysolutions.com/tally-prime/inventory/manage-stock-item-tally/: HTTP Error 500: Internal Server Error
- https://help.tallysolutions.com/tally-prime/payroll/introduction-to-payroll/: status 404
- https://help.tallysolutions.com/tally-prime/purchase-process-tally/purchase-process-tally/: status 404
- https://help.tallysolutions.com/tally-prime/sales-process/sales-process-tally/sales-register/: status 404
- https://help.tallysolutions.com/tally-prime/te9_main/Reports/browser-access/tally-reports-in-browser.htm/: status 404
- https://help.tallysolutions.com/tally-software-services-tss/Renew-TSS-from-Gateway-of-Tally/: status 404
- https://tallysolutions.com/tallyprime-features/: status 404
- https://help.tallysolutions.com/job-work/: IncompleteRead (truncated response)
- https://help.tallysolutions.com/tallydrive-management-report-2/: IncompleteRead
- Note: several 'ERR_INTERNET_DISCONNECTED' entries came from a transient network drop. Most were re-fetched successfully under their canonical URLs (budgets, scenarios, godowns, statistics, e-payments, IMS, TallyDrive management, banking).
