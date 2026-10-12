# TallyPrime (India) vs Muneem — option-level gap list

Inputs: [catalog-tally.md](catalog-tally.md) (TallyPrime catalog up to Release 7.1, crawled 2026-10-11) and [muneem-baseline.md](muneem-baseline.md) (Muneem at HEAD 7f3e450). Uncertain items were spot-checked read-only against the repo (renderer routes, report definitions, GSTR-1 builder, electron-builder config). Each row is something TallyPrime has that Muneem lacks fully (❌) or partly (⚠️). 📝 marks a Muneem FR that is planned but not built; it still counts as ❌. "Unverified" in the Muneem column means the code did not settle the question either way.

**Columns.** *Edition/add-on*: "All" means every TallyPrime licence (Silver and Gold have the same features). "+ TSS" means it also needs the annual Tally Software Services subscription (connected GST, e-invoice, e-way bill, browser access, banking, WhatsApp, TallyDrive). Plug-ins and paid packs are named. *Value*: value to an Indian retail or wholesale SMB (H/M/L). *Effort*: rough Muneem build size (S ≤ a few days, M ≈ 1–3 weeks, L > 3 weeks or needs an external integration or certification). *Source*: a TallyHelp slug that resolves to `https://help.tallysolutions.com/<slug>/`; `ts:<slug>` resolves to `https://tallysolutions.com/<slug>/`. Rows that rest on the catalog's UNVERIFIED gap-fill block (stock item master fields) keep the `(UNVERIFIED)` tag in the Source column.

**Scope.** Non-India localisation (GCC/UAE/KSA VAT, Arabic/bilingual GCC invoices, Kenya, Nepal, Bangladesh, expat payroll) is left out. TDL developer internals (definitions, attributes, functions, XML envelopes) are left out; TDL appears once as a customisation capability in §19. Tally features Muneem already has (for example line and bill discounts, hold/park, credit-limit check, period lock, year-end close, encrypted scheduled backups, Document Summary, B2B/B2C HSN split) are not listed.

## Summary

**523 gap rows: 379 ❌ and 144 ⚠️.** 89 rows are high value (H) for an Indian shop, and 340 are effort S.

| # | Module | Rows | ❌ | ⚠️ | H value | Effort S |
|---|---|---|---|---|---|---|
| 1 | Company & features (F11) | 16 | 9 | 7 | 2 | 10 |
| 2 | Security, users & audit | 25 | 14 | 11 | 2 | 19 |
| 3 | Masters (ledgers, groups, parties) | 28 | 21 | 7 | 3 | 20 |
| 4 | Vouchers & entry options | 44 | 33 | 11 | 9 | 38 |
| 5 | Numbering & voucher class | 21 | 12 | 9 | 0 | 19 |
| 6 | Sales / POS | 20 | 11 | 9 | 3 | 13 |
| 7 | Orders, challans & delivery | 21 | 20 | 1 | 3 | 13 |
| 8 | Printing & templates | 34 | 23 | 11 | 6 | 28 |
| 9 | GST | 68 | 52 | 16 | 20 | 34 |
| 10 | TDS / TCS / MSME / other statutory | 22 | 22 | 0 | 2 | 12 |
| 11 | Inventory (godowns, batches, BOM, job work, price levels, valuation) | 52 | 34 | 18 | 12 | 38 |
| 12 | Payroll | 17 | 17 | 0 | 0 | 5 |
| 13 | Banking | 26 | 24 | 2 | 6 | 16 |
| 14 | Outstanding & credit control | 13 | 8 | 5 | 2 | 10 |
| 15 | Cost centres, budgets & multi-currency | 11 | 11 | 0 | 0 | 5 |
| 16 | Reports (by name, then report options) | 45 | 34 | 11 | 5 | 38 |
| 17 | Data management | 14 | 4 | 10 | 2 | 4 |
| 18 | Connectivity | 15 | 12 | 3 | 6 | 2 |
| 19 | Customisation / TDL / plug-ins | 7 | 6 | 1 | 0 | 0 |
| 20 | Keyboard, UX & language | 14 | 10 | 4 | 4 | 8 |
| 21 | Editions & pricing | 10 | 2 | 8 | 2 | 8 |
| | **Total** | **523** | **379** | **144** | **89** | **340** |

- **GST is the largest gap.** It holds 20 of the 89 H rows: GSTR-1/3B JSON and connected filing, 2A/2B and IMS reconciliation, e-invoice and e-way bill, reverse charge, QRMP, composition CMP-08, slab-based and effective-dated rates, bulk rate updates, filing locks, and exception resolution.
- **Wholesale document flow is missing.** Delivery challans and invoicing against them, quotations, bill-to/ship-to, dispatch details, additional charges, free quantity, previous balance on the invoice, copy labels (Original/Duplicate/Triplicate), and printing documents other than sales.
- **Inventory depth.** Godowns and transfers, batches and expiry, repacking journals, party price levels and bulk price revision, Stock Query (last rate to this party), stock ageing, and reorder status.
- **Keyboard speed.** Tally users expect Go To, F-key voucher hotkeys on every screen, and mouse-free entry. Muneem has these only inside POS. Most of these rows are effort S.
- **Accountant workflow.** Banking reconciliation and PDCs, reminder letters, interest, report comparison columns, drill-down, saved views, edit-log viewer, and a Tally export for the CA.
- **Mostly low value for a shop.** Payroll (17 rows), cost centres and budgets, multi-currency, job work, TDL and the auditor data-analysis suite. These matter to Tally's accountant and manufacturer base more than to a counter-sales shop.

---

## 1. Company & features (F11)

| Feature / option | Tally detail (concrete sub-options) | Edition/add-on | Muneem today | Value | Effort | Source |
|---|---|---|---|---|---|---|
| Multiple companies + switch company | Unlimited companies; Select Company / F3 switch; Alt+F3 load from other path; Ctrl+F3 shut; load several at once | All | ❌ one business per install; no multi-business switcher | M | L | create-company |
| Group company (consolidation) | Alt+K > Create > Alt+R Group Company; member companies (min 2); consolidated BS/P&L/TB; Alt+N Member Companies columns | All | ❌ | L | L | group-company-tally |
| Company contact & mailing details | Mailing name separate from name; address; Mobile, Fax, E-mail, Website used on print/e-mail/WhatsApp | All | ⚠️ name, legal name, phone, PIN on business; no e-mail/website; no edit-business screen (business.update backend only) | H | S | create-company |
| Multiple company addresses | F11 Enable multiple addresses; Address Types (Primary + named, e.g. Branch Office); pick address type when printing/e-mailing | All | ⚠️ branch address exists; no address types selectable per document | M | S | company-features-f11-tally |
| Books beginning from / custom FY start | Financial year beginning + separate "Books beginning from" (mid-year start) | All | ⚠️ FY fixed to April; no mid-year books start | M | S | create-company |
| Base currency formatting | Suffix symbol, space between amount and symbol, decimals (max 4), word after decimal (paisa), show amount in millions vs lakhs | All | ❌ INR formatting fixed | L | S | set-up-base-currency |
| Company data encryption (TallyVault) | Alt+K > TallyVault password encrypts company name + data; alter password; optional unencrypted copy | All | ⚠️ backups encrypted with key escrow; no user-set passphrase on the live company file | M | M | tallyvault-for-company-tally |
| F11 feature switchboard | Incremental enable/disable of modules; "Show more features" / "Show all features" tiers | All | ⚠️ settings keys exist (negative stock, round-to-rupee, B2CL, blind close) but only crash-reporting toggle has UI | H | M | set-up-company-features |
| Maintain Accounts only / Inventory-only company | Maintain Accounts = No; Maintain Inventory = No; inventory-only companies (Rel 1.0) | All | ❌ | L | M | company-features-f11-tally |
| Integrate Accounts with Inventory toggle | Off = manual closing stock via Stock-in-Hand ledger; on = BS drills to Stock Register | All | ❌ always integrated (perpetual) | L | S | company-features-f11-tally |
| Bill-wise for non-trading accounts | Maintain balances bill-by-bill on loan/instalment ledgers | All | ⚠️ bill allocation only for customers/suppliers | L | M | company-features-f11-tally |
| Income & Expenditure A/c instead of P&L | Alter Profit & Loss ledger: "Use as Income & Expense A/c" (NGOs, trusts, schools) | All | ❌ | L | S | profit-and-loss-statement-tally |
| Mailing details in local language | F11 > Mailing details in local language; bilingual invoices | All | ❌ | L | S | company-features-f11-tally |
| Startup options | Load companies on startup; Open Dashboard on loading; auto-login for same credentials; optimise loading of companies/reports | All | ⚠️ single business opens to dashboard; no startup configuration | L | S | set-up-tallyprime-auto-login-language-multiple-addresses |
| Data path per company | Company data path chosen at creation; Alt+Y > Data Path for data/backup defaults | All | ❌ fixed app data directory | L | S | create-company |
| Disallow opening in Educational Mode | Company opens only under a valid licence | All | ❌ no licence-bound data lock | L | S | create-company |

## 2. Security, users & audit

| Feature / option | Tally detail (concrete sub-options) | Edition/add-on | Muneem today | Value | Effort | Source |
|---|---|---|---|---|---|---|
| Create users in-app | Alt+K > Users and Passwords: role, username, password; per-user Browser Access, Remote Access, Local TDL permissions | All | ❌ cloud creates owner only; no invite/assign roles | H | M | manage-users-in-tallyprime |
| User Active/Inactive status | F12 user status; password policy applicable per user | All | ⚠️ device revoke exists; no per-user deactivate screen | M | S | manage-users-in-tallyprime |
| Change user / change password in-app | Alt+K > Change User; Alt+K > Change Password (old/new/confirm) | All | ⚠️ PIN switch-user without PIN setup screen; no in-app password change | M | S | manage-users-in-tallyprime |
| Custom roles inheriting another | "Basic facilities of" an existing role; rename defaults (Owner, Data Entry) | All | ⚠️ five fixed presets; no custom role editor | M | S | security-levels |
| Facility matrix per report/area | Allow/Disallow × activity (Full, Create, Alter, Display, Print, Preview) × area (Vouchers, Back Dated Vouchers, Price List, Day Book, TB, P&L, Payroll/TDS reports…) | All | ⚠️ resource × action RBAC; no per-report or print-vs-display split | M | M | security-levels |
| Cut-off date for back-dated vouchers | Per role date lock (post-audit) alongside "Days allowed for back-dated vouchers" | All | ⚠️ backdateDays per role ✅; cut-off only via company-wide monthly period lock | L | S | security-levels |
| Lock stock item rates | Disallow Price List + Override Invoice Defaults so price-list rates are enforced | All | ⚠️ discount cap per role; no "cannot edit rate" permission | M | S | security-levels |
| Allow to override tax details | Role flag for overriding tax rate/HSN in entry | All | ❌ (no override UI either) | L | S | security-levels |
| Print-before-save rule permission | "Set/Alter rules for Print voucher before saving" | All | ❌ | L | S | security-levels |
| Exclude On Account / New Number per role | Restrict bill allocation types and new tracking/order refs | All | ❌ | L | S | security-levels |
| Saved-view permissions | Allow to save / delete report views for this company | All | ❌ (no saved views) | L | S | security-levels |
| WhatsApp number restriction | Allow to add/modify registered business WhatsApp numbers; restrict numbers per role | All | ❌ | L | S | security-levels |
| Dashboard tile restriction | Allow dashboard by role; hide specific tiles (e.g. Assets/Liabilities, connected bank balance) | All | ⚠️ role gates by resource; no per-tile hiding | M | S | dashboard |
| Password policy: length & complexity | Minimum length (default 8); minimum alphabetic/numeric/special characters | All | ❌ | M | S | set-up-password-policy |
| Password policy: expiry | Expires after N days (default 90); notify before expiry | All | ❌ | L | S | set-up-password-policy |
| Password policy: reuse block | Restrict use of old passwords | All | ❌ | L | S | set-up-password-policy |
| Password policy: first-login change | Change password on first login; allow users to change password | All | ❌ | M | S | set-up-password-policy |
| Edit Log per voucher/master | Alt+Q: Version, Activity, User, Date-time; Enter shows differences between versions in red; +/- next/previous version | All (Rel 2.1+) | ⚠️ hash-chained audit log + verify; no viewer | H | M | edit-log-for-masters-transactions |
| Edit Log activity labels | Created/Altered/Resaved due to Import, Sync, Migration, Renumbering; Deleted; Previous Record; Optional/Cancelled status | All | ⚠️ events logged; not browsable by label | M | S | edit-log-activities |
| Edit Log F12 options | Show altered values only; show configuration-based value; show internal fields | All | ❌ | L | S | edit-log-for-masters-transactions |
| Edit Log Summary reports | Voucher-type-wise, master-wise, user-wise; altered/non-altered/deleted counts; version period filter; activity filter | All (Rel 6.1) | ❌ | M | M | view-edit-log-summary |
| TallyPrime Edit Log edition (cannot disable) | Separate product with audit trail permanently on for MCA Rule 3(1) compliance | Edit Log edition | ⚠️ audit always on, but no compliance-labelled report or attestation | M | S | tally-prime |
| Mark modified vouchers | F11 toggle; Marked Vouchers register; Clear All Marking; export marked vouchers as XML for the accountant | All | ❌ | M | M | mark-changed-vouchers-tally |
| Tally Audit statistics | Audit by voucher type (entered/altered counts, today's changes), masters (Accept One/All), users (per-user counts) | All | ❌ | M | M | tally-audit-tally |
| Event Log | F1 > Troubleshooting > Event Log: category (Browser, Remote, Sync, Import, Export), type (Info/Error/Warning), clear log | All | ⚠️ diagnostics + sync review items; no unified event log | L | S | work-from-home-or-anywhere |

## 3. Masters (ledgers, groups, parties)

| Feature / option | Tally detail (concrete sub-options) | Edition/add-on | Muneem today | Value | Effort | Source |
|---|---|---|---|---|---|---|
| User-defined account groups | Create group: Under (nested), Nature (Assets/Liabilities/Income/Expenses), 28 predefined groups | All | ⚠️ seeded COA, add/rename accounts; no user groups/sub-groups | M | M | groups-in-tallyprime |
| Group option: affects gross profit | "Does it affect Gross Profits" (direct vs indirect) | All | ❌ | L | S | groups-in-tallyprime |
| Group option: behaves like sub-ledger | Collapse ledgers into group in reports | All | ❌ | L | S | groups-in-tallyprime |
| Group option: nett Dr/Cr balances | "Nett Debit/Credit Balances for Reporting" | All | ❌ | L | S | groups-in-tallyprime |
| Group option: position index in reports | Ctrl+I > Position Index orders groups in BS | All | ❌ | L | S | balance-sheet-tally |
| Party groups (area / salesman sub-groups) | Sub-groups under Sundry Debtors/Creditors for group outstandings & reminders | All | ❌ | M | S | faq-sales |
| One party as both debtor and creditor | Single ledger used in sales and purchase, shown net in outstandings | All | ❌ customer and supplier are separate records | M | M | ledgers-in-tallyprime |
| Party contact block | Contact name, phone, primary mobile, fax, e-mail, CC e-mail, website | All | ⚠️ phone + e-mail only | M | S | set-up-party-ledger |
| Multiple mobile numbers per party | F12 Provide Multiple Mobile Nos. (contact name + mobile list) | All | ❌ | M | S | set-up-party-ledger |
| Default WhatsApp number(s) | F12 Set Default WhatsApp No.; one or many | All | ❌ | M | S | set-up-party-ledger |
| Multiple mailing addresses per party | Set/alter multiple mailing details: address types; pick billing/shipping per voucher | All | ❌ | H | S | company-features-f11-tally |
| Credit-days check during entry | Default credit period + "Check for credit days during voucher entry" warning | All | ⚠️ credit days stored; credit-limit check ✅; overdue-days warning on sale not present | M | S | set-up-party-ledger |
| Party PAN | PAN / IT No., PAN status codes, Name on PAN, PAN effective date | All | ❌ | M | S | create-tds-masters |
| Party registration type | Regular / Composition / Unregistered-Consumer / Regular-SEZ / Deemed exporter / Other territory; Is the party a transporter | All | ⚠️ supplier tax scheme; customer only GSTIN | M | S | india-gst-creating-party-ledgers-for-gst-tally |
| Effective-dated party GST history | History of registration changes per party | All | ❌ | L | M | setting-up-gst-in-tallyprime |
| Fetch party details by GSTIN | Alt+L pulls legal name, address, PAN, reg type, status from portal; compare Books vs Portal | All + TSS | ❌ | H | M | india-gst-creating-party-ledgers-for-gst-tally |
| Party filing history | Alt+S: GSTR-1/3B or CMP-08 filing, e-invoice applicability, last 6 months | All + TSS | ❌ | M | M | validate-party-gstin-uin |
| Create parties from GSTIN list | Bulk create from typed list or Excel column of GSTINs | All + TSS | ⚠️ party CSV import exists; no GSTIN lookup | M | M | india-gst-creating-party-ledgers-for-gst-tally |
| Validate Party GSTIN report | Active/cancelled/blocked status for all or period parties; update from portal | All + TSS | ❌ | H | M | validate-party-gstin-uin |
| Update Party GSTIN report | Group-wise grid to enter/correct GSTINs; export | All | ❌ | L | S | india-gst-update-party-gstin-uin-tally |
| Ledger aliases & language aliases | Multiple aliases; per-language name for printing | All | ❌ | M | S | ledgers-in-tallyprime |
| Multi-Masters grid (Alt+H) | Multi Create / Multi Alter of ledgers, items, godowns, cost centres in a grid | All | ⚠️ CSV/XLSX import only; no in-app bulk grid | M | M | inventory-storage-using-godowns-locations-tally |
| Copy masters across companies | F3 in alteration saves into another open company; bulk via Multi Alter | All | ❌ | L | S | groups-in-tallyprime |
| Ledger Contact Details report | Alt+G report with Multi Alter and Update Contact Details | All | ❌ | L | S | set-up-party-ledger |
| Party bank details / beneficiaries | Account no., IFSC, bank, transaction type; multiple beneficiaries with default; bulk import from Excel | All | ❌ | M | S | banking-setup |
| Bill-wise opening balance | Opening balance broken into bills with dates and due dates | All | ⚠️ single opening amount per party | M | S | bill-date-for-bill-wise-breakup-of-opening-balance-is-missing |
| Delete unused ledgers at once | Bulk delete of unused ledgers | All | ❌ | L | S | faq |
| Additional descriptions for ledgers | Extra description lines printed on invoices | All | ❌ | L | S | configure-for-print-export-share |

## 4. Vouchers & entry options

| Feature / option | Tally detail (concrete sub-options) | Edition/add-on | Muneem today | Value | Effort | Source |
|---|---|---|---|---|---|---|
| Contra voucher | F4 cash↔bank deposits/withdrawals with bank allocations, cash denominations, deposit slip | All | ⚠️ only via manual journal; register cash in/out exists for POS drawer | M | S | accounting-entry-tally |
| Memorandum voucher | Non-accounting voucher, convertible later; Memorandum Register; used in scenarios | All | ❌ | L | S | accounting-entry-tally |
| Reversing journal | "Applicable Upto" date, auto-reversed after; Reversing Journal Register | All | ⚠️ manual reversal ✅; no auto-dated reversal | L | S | accounting-entry-tally |
| Optional vouchers | Ctrl+L Optional/Regular; no books impact; Optional Vouchers exception register; prints as Proforma | All | ❌ | M | S | accounting-entry-tally |
| Post-dated vouchers | Ctrl+T; posts on its date; Post-Dated Vouchers register; Ledger Vouchers incl. post-dated | All | ❌ | H | M | accounting-entry-tally |
| User-defined voucher types | Name + "Select type of voucher" (e.g. Cash Sales, Credit Sales, Branch Transfer); abbreviation; activate/deactivate | All | ❌ fixed document types | M | M | voucher-types-tally |
| Effective dates for vouchers | Voucher type option; effective date shown top-right | All | ❌ | L | S | voucher-types-tally |
| Allow zero-valued transactions | Free samples / free items / blank cheques | All | ⚠️ not configurable; zero-price behaviour unverified | M | S | voucher-types-tally |
| Optional by default per voucher type | e.g. quotation or requisition types | All | ❌ | L | S | voucher-types-tally |
| Narration on every voucher | Common narration; per-ledger narration option | All | ⚠️ narration only on manual journals | M | S | accounting-entry-tally |
| Recall narration | Alt+R same party; Ctrl+R same voucher type | All | ❌ | L | S | keyboard-shortcuts-tally-prime |
| Default accounting allocations | Voucher type pre-fills recurring income/expense entries | All | ❌ | L | S | voucher-types-tally |
| WhatsApp voucher after saving | Voucher type option; share to party on save | All + WhatsApp | ❌ 📝 FR-085 | H | S | voucher-types-tally |
| Print voucher after saving | Per voucher type | All | ⚠️ POS prints on pay; no per-type toggle elsewhere | L | S | voucher-types-tally |
| Print formal receipt after saving | Receipt voucher prints a titled receipt with bank transaction details | All | ❌ no payment receipt print | H | S | payments-and-receipts-tally |
| Generate payment link/QR after saving | Sales, Debit Note, Delivery Note, Journal, POS, Sales Order | All + TSS | ❌ 📝 FR-095 | H | M | voucher-types-tally |
| Accounting Invoice mode | Ctrl+H: Item Invoice / Accounting Invoice (service ledgers by amount) / As Voucher | All | ⚠️ item invoice only; services need a product | M | M | sales-of-goods-services |
| Single vs double entry mode | Payment/receipt/contra entry styles; F7 convert to journal | All | ❌ | L | S | payments-and-receipts-tally |
| Reference no. & date on sale | F12 Provide Reference No. and Date; Use Voucher No. as Bill Reference | All | ❌ (no PO/reference on sale) | M | S | sales-of-goods-services |
| Separate buyer & consignee | Bill-to / ship-to with consignee GSTIN & state | All | ❌ | H | S | gst-sales-tally |
| Dispatch details | Dispatch doc no., dispatched through, destination, carrier, LR-RR no., motor vehicle no. | All | ❌ | H | S | gst-sales-tally |
| Order details on invoice | Order no(s), mode/terms of payment, other references, terms of delivery | All | ❌ | M | S | sales-of-goods-services |
| Export details | Port of loading/discharge, country, shipping bill no./date | All | ❌ | L | S | sales-of-goods-services |
| Marks / container no. / packages | Provide Marks or Container No.; No. of Packages | All | ❌ | L | S | sales-of-goods-services |
| Duplicate voucher | Alt+2 from Day Book; copy/paste vouchers (Ctrl+C/Ctrl+V) | All | ❌ | M | S | day-book-tally |
| Insert / add voucher from Day Book | Alt+I insert above (renumbers), Alt+A add at date | All | ❌ | L | S | day-book-tally |
| Alter a posted voucher | Edit any saved sale/purchase; edit-logged; GST status recomputed | All | ❌ cancel + re-create only | H | M | sales-of-goods-services |
| Bulk cancel from Day Book | Spacebar multi-select + Alt+X; Cancelled Vouchers exception report | All | ⚠️ single cancel only | L | S | faq-sales |
| Create master on the fly | Alt+C from party, item, ledger, unit, godown fields | All | ⚠️ pickers search existing; on-the-fly item create from billing not available | M | S | accounting-entry-tally |
| Alter master from voucher | Ctrl+Enter on a party/item | All | ❌ | L | S | keyboard-shortcuts-tally-prime |
| Previous/next voucher | PgUp / PgDn while in entry | All | ❌ | L | S | keyboard-shortcuts-tally-prime |
| Stock Query from voucher | Alt+S: previous sales qty/rate to this party, godown/batch stock, last purchase | All | ❌ | H | S | faq-sales |
| Rate from last sale to party | Rate auto-filled from previous sale | All | ❌ | M | S | point-of-sale-tally |
| Show party turnover & balance in entry | Show Turnover; Current Balance; Balances as on voucher date; Final Ledger Balance | All | ⚠️ credit-limit check uses balance; not displayed | M | S | sales-of-goods-services |
| Warn on negative cash balance | Voucher F12 | All | ❌ | L | S | sales-of-goods-services |
| Calculate tax on current subtotal | Tax after discount/charges ordering | All | ❌ | L | S | sales-of-goods-services |
| Per-line sales ledger | Select common ledger = No; choose sales ledger per item | All | ❌ | L | M | sales-receipts-additional-charges-discounts-free-items |
| Additional charges on invoice | Freight/packing/insurance ledgers as % or amount; GST apportioned into item value | All | ❌ no shipping/charges line on sale | H | S | sales-receipts-additional-charges-discounts-free-items |
| Cash/trade discount via ledger | F12 Provide Cash/Trade Discount; discount ledger totals | All | ⚠️ line + bill discount ✅; no separate cash-discount ledger | L | S | sales-receipts-additional-charges-discounts-free-items |
| Settlement discount on receipt | Discount ledger with negative amount in receipt | All | ⚠️ write-off ✅; no discount-allowed line in receipt | M | S | sales-receipts-additional-charges-discounts-free-items |
| Compound unit display | Show details of compound unit (12 Kgs 250 gms); compound unit based on rate | All | ❌ | L | S | inventory-entry-tally |
| Skip date field / next-day default | F12 Skip the Date field; date defaults to day after last entry | All | ❌ | L | S | accounting-entry-tally |
| Calculator | Ctrl+N panel; Alt+C on amount field | All | ❌ | L | S | keyboard-shortcuts-tally-prime |
| GST portal view of invoice | Ctrl+O preview of how the invoice appears on the portal | All | ❌ | L | S | gst-sales-tally |

## 5. Numbering & voucher class

| Feature / option | Tally detail (concrete sub-options) | Edition/add-on | Muneem today | Value | Effort | Source |
|---|---|---|---|---|---|---|
| Automatic (Manual Override) | Auto number editable; numbering continues from override; skipped numbers usable manually | All | ❌ | M | S | use-voucher-numbering-methods |
| Manual numbering | User types each number; optional duplicate prevention | All | ❌ (only purchase bill no.) | L | S | use-voucher-numbering-methods |
| Multi-user Auto | "1<Auto>" while concurrent users enter; number assigned on save | All | ⚠️ per-terminal prefixes avoid clashes instead | L | S | use-voucher-numbering-methods |
| Numbering method None | Numbering disabled for a type | All | ❌ | L | S | use-voucher-numbering-methods |
| Insert/delete behaviour | Renumber Vouchers vs Retain Original Voucher No. | All | ⚠️ always retains (no renumber); not configurable | L | S | use-voucher-numbering-methods |
| Reuse unused / deleted numbers | Show unused voucher nos.; Ctrl+Alt+U pick unused; reuse deleted numbers (7.1) | All | ❌ | L | S | release-notes-tallyprime-7-1 |
| Starting number, width, zero-fill | Additional numbering details: start no., width of numeric part, prefill with zero | All | ⚠️ fixed 6-digit zero-filled; no UI | M | S | use-voucher-numbering-methods |
| Restart numbering periodicity | Restart table: Applicable From, Starting No., Periodicity (e.g. monthly) | All | ⚠️ yearly restart only | L | S | use-voucher-numbering-methods |
| Date-effective prefix & suffix | Prefix Details and Suffix Details tables with Applicable From | All | ⚠️ terminal prefix + year; no suffix, no date-effective change | M | S | use-voucher-numbering-methods |
| Multiple numbering series per type | Define Numbering Series (per GSTIN, >₹50k EWB, inter/intra-state); pick series at entry; Alt+S create series | All (Rel 3.0+) | ⚠️ settings.createSeries backend only; no UI | M | S | set-up-vch-numbering-and-numbering-series-for-gst |
| Common series across GST registrations | F11 option | All | ❌ (single GSTIN) | L | S | essentials-for-your-gst-journey |
| 16-character GST number warning | "Warn when Voucher No. exceeds 16 characters"; ≤16, not starting with 0, / or - | All | ⚠️ format fits 16 chars; no validation for custom prefixes | L | S | missing-invalid-information-for-e-invoice-e-way-bill |
| Voucher class (templates) | Named class per voucher type for faster entry; not usable in alteration | All | ❌ | M | M | accounting-entry-tally |
| Class: include/exclude groups | Restrict Party A/c list to chosen groups | All | ❌ | L | S | accounting-entry-tally |
| Class: default item ledger allocation | Ledger(s) + %; tax ledgers inline; Override using Item Default | All | ❌ | L | M | accounting-entry-tally |
| Class: additional accounting entries | Auto-added freight/loading/rounding ledgers; Type of Calculation (user value, GST, rounding); Remove if Zero | All | ❌ | M | S | accounting-entry-tally |
| Class: POS payment-mode ledgers | Enable payment modes, map each to a ledger | All | ⚠️ fixed tender types (cash/UPI/card/other/credit) with fixed accounts | L | S | voucher-types-tally |
| Class: receipt/payment/contra prefill | Cash/bank source and destination prefilled | All | ❌ | L | S | accounting-entry-tally |
| Copy allocation details to items | Copy default ledgers + tax rates from one stock item to items/groups | All | ❌ | L | S | copy-accounting-details-tally |
| Invoice rounding method & limit | Rounding ledger: Not Applicable / Downward / Normal / Upward; limit 1, 5, 10… | All | ⚠️ round-to-rupee setting without UI; no method or limit choice | M | S | round-off-invoice-and-ledger-values |
| Tax ledger rounding | Duties & Taxes ledger rounding method/limit | All | ❌ | L | S | round-off-invoice-and-ledger-values |

## 6. Sales / POS

| Feature / option | Tally detail (concrete sub-options) | Edition/add-on | Muneem today | Value | Effort | Source |
|---|---|---|---|---|---|---|
| POS footer messages & title | Message to print (1) and (2); default title per POS type | All | ⚠️ pos.receiptFooter honoured but no UI | L | S | point-of-sale-tally |
| Gift voucher tender | Multi-mode payment (Alt+I): gift voucher ledger, card, cheque, cash tendered + balance | All | ❌ | M | M | point-of-sale-tally |
| Cheque tender | Cheque bank ledger in POS multi-mode | All | ⚠️ "other" tender only | L | S | point-of-sale-tally |
| Free quantity (Actual vs Billed qty) | Separate Actual and Billed Quantity columns (buy-1-get-1, schemes); Calculate MRP on billed qty | All | ❌ | H | S | point-of-sale-tally |
| Free item as zero-value line | Different free item via zero-valued transaction | All | ⚠️ unverified | M | S | point-of-sale-tally |
| Salesperson tracking | Salesperson as cost centre; sales by salesperson; commission base via Cost Centre Breakup | All | ❌ | H | M | salesperson-details-collection-commission-tally |
| Collection by salesperson | Allocate receipts to collector; commission on collection | All | ❌ | M | M | salesperson-details-collection-commission-tally |
| Agent commission tracking | Commission cost category + agent cost centres; category summary | All | ❌ | M | M | faq-sales |
| Gross profit per invoice | Day Book/Sales Register F7 Show Profit: value, cost, GP per invoice; cost by stock valuation | All | ⚠️ product profit report; no per-invoice GP | M | S | how-to-work-with-sales-register-in-tallyprime |
| Price level per invoice / party default | Select price level in voucher; party default price level; rate & discount auto | All | ⚠️ price lists exist; POS always uses default list | H | S | selling-buying-prices |
| Rate from standard selling price by date | Standard rates history auto-fills by voucher date | All | ⚠️ date-effective price list ✅ but not per-party | L | S | selling-buying-prices |
| Damaged returns excluded from stock | Damaged sales returns recorded separately, out of closing stock | All | ⚠️ return reasons exist; non-restock disposition unverified | M | S | sales-return-tally |
| Debit note to customer (price increase) | Item without qty/rate, amount = differential; GST reason; GSTR-1 CDN | All | ❌ | M | S | debit-note-post-sales-price-hike |
| Credit note for value decrease only | Rate-difference credit note without quantity | All | ⚠️ credit notes are return-driven | M | S | purchase-returns-tally |
| Consignment sales | Principal/agent flows with third-party godowns, Material In/Out | All | ❌ | L | L | consignment-transactions-tally |
| Fixed-asset sale | Accounting invoice with fixed-asset ledger; P/L on sale journal | All | ❌ | L | S | consignment-transactions-tally |
| Foreign-currency sale | Rate with currency symbol; dual-currency total on print | All | ❌ | L | M | create-sales-voucher-with-foreign-currency-and-print-invoice-in-tallyprime |
| E-commerce operator sales | Party marked e-Commerce Operator; GSTR-1 e-Commerce Summary tables 14/14A/15 | All (Rel 4.1+) | ❌ | M | M | gstr-1-report-in-tallyprime |
| Multiple sales ledgers per bill | Different sales ledger per line (e.g. local vs premium goods) | All | ❌ | L | S | sales-receipts-additional-charges-discounts-free-items |
| POS tax-inclusive class hiding tax on print | Inclusive-rate ledgers; tax back-calculated and hidden on print | All | ⚠️ price incl GST toggle ✅; hide-tax print option absent | L | S | faq-sales |

## 7. Orders, challans & delivery

| Feature / option | Tally detail (concrete sub-options) | Edition/add-on | Muneem today | Value | Effort | Source |
|---|---|---|---|---|---|---|
| Quotation | Sales Order marked Optional prints as QUOTATION | All | ❌ 📝 FR-086 | H | S | sales-order-tally |
| Proforma invoice | Optional sales voucher prints as Proforma Invoice | All | ❌ | M | S | print-invoices-reports |
| Sales Order voucher | Order no. (or per item), due date per item, split lots, batch/godown, additional ledgers | All | ❌ | M | M | sales-order-tally |
| Sales Order warnings | Warn on duplicate order no.; due date earlier than voucher date; credit-limit warning | All | ❌ | L | S | sales-order-tally |
| Invoice against sales order | Pick pending order lines, partial billing, order closes when fully billed | All | ❌ | M | M | sales-order-tally |
| Delivery Note (challan) | Tracking numbers; with/without order; inventory-only option; GST/EWB on challan | All | ⚠️ enum only 📝 FR-087 | H | M | sales-order-tally |
| Invoice against delivery notes | Select tracking nos.; consolidate qty of same items | All | ❌ | H | M | sales-order-tally |
| Rejection In | Goods rejected after delivery, before invoice | All | ❌ | L | S | sales-order-tally |
| Pre-close orders | Pre-Close Quantity + Reason + Closed-on date; from voucher or reports (Alt+W); re-open | All | ❌ | L | S | purchase-order-tally |
| Purchase Order voucher | Party, order no., per-item due date/qty/rate, order/import details | All | ❌ | M | M | purchase-order-tally |
| Receipt Note (GRN) | Tracking no. defaults to voucher no.; items prefilled from PO | All | ❌ | M | M | purchase-order-tally |
| Purchase against receipt note | Select receipt note; qty/rate editable; closes when billed | All | ❌ | M | M | purchase-order-tally |
| Rejection Out | Return goods after receipt note, before purchase | All | ❌ | L | S | purchase-order-tally |
| Material In / Material Out | Non-sale movements for job work and consignment, with GST | All | ❌ | L | M | gst-invoice-for-material-out |
| Order Outstandings reports | Sales/Purchase Order Outstandings by stock group, category, item, party group, ledger, all orders; due/overdue | All | ❌ | M | S | sales-order-tally |
| Order ageing | F6 Age-wise by bill date or due date, custom periods | All | ❌ | L | S | sales-order-tally |
| Pending orders summary | Orders count, opening, preclosed, delivered/received, closing value | All | ❌ | M | S | pending-orders-tally |
| Sales/Purchase Bills Pending | Goods delivered but bills not made; bills made but goods not delivered; mirror for purchases | All | ❌ | M | S | purchase-bills-pending |
| Orders Book (columnar) | Sales/Purchase Orders Book with auto columns and GP estimates | All | ❌ | L | S | sales-order-tally |
| Saleable / nett stock with orders | Stock Summary F9: Saleable Stock, SO outstanding, PO outstanding | All | ❌ | M | S | track-your-inventory-stock-summary-tally |
| Order verification status | Alt+R Verify / Remove Verify with note | All | ❌ | L | S | pending-orders-tally |

## 8. Printing & templates

| Feature / option | Tally detail (concrete sub-options) | Edition/add-on | Muneem today | Value | Effort | Source |
|---|---|---|---|---|---|---|
| Copies & copy labels | No. of copies per voucher type; Type of Copy Original/Duplicate/Triplicate/Quadruplicate/Extra (customer/transporter/office) | All | ❌ (thermal DUPLICATE on reprint only) | H | S | configure-for-print-export-share |
| Preview as default | Set Preview as default for print & WhatsApp | All | ⚠️ preview exists; not a default setting | L | S | configure-for-print-export-share |
| Title / subtitle per print | F7 Header: title, subtitle; default title per voucher type | All | ❌ | L | S | configure-for-print-export-share |
| Dot-matrix & draft formats | F8 Dot Matrix / Neat / Quick-Draft; custom dot-matrix paper | All | ❌ | M | M | configure-for-print-export-share |
| Pre-printed stationery | F9 Plain ↔ Pre-Printed Paper | All | ❌ | M | M | configure-for-print-export-share |
| Page range | F10 start from page / page range | All | ❌ | L | S | configure-for-print-export-share |
| Custom invoice size & margins | Height/width/margins; A5 half-size (5"); template margins | All | ⚠️ A4/A5/Letter presets only | M | S | configure-for-print-export-share |
| Two invoices per sheet | Pages per Sheet = 2 | All | ❌ | L | S | faq-sales |
| Optimise printing to save paper | More items per A4 for GST invoices | All | ❌ | L | S | configure-for-print-export-share |
| Consignee details on print | Show Consignee details; name/address from party master vs voucher | All | ❌ | H | S | configure-for-print-export-share |
| Additional descriptions on print | Additional descriptions for stock items / ledgers | All | ❌ | M | S | configure-for-print-export-share |
| GST analysis table | Show item-wise GST, GST rate %, GST Analysis (HSN-wise taxable/rate/tax), tax in words | All | ⚠️ HSN + tax split + amount in words ✅; HSN-wise analysis table and tax-in-words unverified | M | S | gst-comprehensive-invoice |
| Previous & current party balance on invoice | Show Previous and Current Balances of Ledger | All | ❌ | H | S | print-invoices-with-balances |
| Dispatch details on print | LR-RR no., motor vehicle no. | All | ❌ | H | S | configure-for-print-export-share |
| Export / marks / packages on print | Show Export details, Marks or Container No., No. of Packages | All | ❌ | L | S | configure-for-print-export-share |
| PAN / CIN on invoice | Show PAN/Income Tax No.; Show CIN | All | ⚠️ PAN on business; print toggle unverified; no CIN field | L | S | configure-for-print-export-share |
| Choose bank account to print | Show Bank Details: pick bank ledger; default bank per voucher type | All | ⚠️ one set of bank details in branding | L | S | configure-for-print-export-share |
| Declaration per voucher type | Set/alter declaration printed on all vouchers of a type | All | ⚠️ global terms only | L | S | voucher-types-tally |
| Named T&C sets | List of T&C per voucher type + default; single/double column display | All | ⚠️ single global terms text | M | S | terms-and-conditions-in-templates |
| Multi-logo template | Template 5: several brand logos | All | ❌ | L | S | use-preferred-template |
| Multi-address template | Template 6: branch/service-centre addresses | All | ❌ | M | S | use-preferred-template |
| Watermark | Paid / Cancelled watermark | All (Rel 7.1) | ❌ | M | S | print-documents |
| Header/footer images, fonts, colours | Image header & footer; custom fonts & colours | All (Rel 7.1) | ⚠️ accent colour + logo + signature; no header/footer images or fonts | M | S | release-notes-tallyprime-7-1 |
| Default template per voucher type | Alt+L set default; Ctrl+H change template at print; Ctrl+L save template with config | All | ⚠️ template choice is global | L | S | use-preferred-template |
| Print with/without colour | Alt+R | All | ❌ | L | S | use-preferred-template |
| Payment link / UPI QR on invoice | Method: Link / QR Code / Link & QR | All + TSS | ❌ | H | S | print-invoices-reports |
| UDYAM no. on documents | Show UDYAM Reg No. & enterprise type on invoices/orders/reminders | All | ❌ | L | S | set-up-udyam-regn-details-msme-companies |
| Godown name/address on print | Show godown name / address | All | ❌ | L | S | inventory-storage-using-godowns-locations-tally |
| Digital signature (DSC) on PDF | Dongle DSC; ask before signing; text or text+image; signatory name; app-wide or per doc | All (Rel 2.1+) | ⚠️ signature image ✅; no DSC signing | M | M | digital-signature-tallyprime |
| Print non-sales documents | Purchase, debit note, payment/receipt, journal, stock journal, orders, challans | All | ❌ sales + credit-note thermal only | H | M | print-documents |
| Multi-account printing | Print many ledgers/books/registers at once; group-wise sort; alphabetical range | All | ❌ | L | M | configure-for-print-export-share |
| Stripe view on print/export | Alternate row shading carried to print/export | All (Rel 5.0) | ❌ | L | S | working-with-reports |
| Auto wrap text in print | Wrap in vouchers/reports per voucher type | All (Rel 7.1) | ❌ | L | S | auto-wrap-text |
| Bilingual / regional-language print | Print language via language aliases; amount in words in that language | All | ⚠️ "bharat" Hindi+English template; no per-party language or other Indian languages | M | M | configure-for-print-export-share |

## 9. GST

| Feature / option | Tally detail (concrete sub-options) | Edition/add-on | Muneem today | Value | Effort | Source |
|---|---|---|---|---|---|---|
| Multiple GST registrations | Several GSTINs in one company; per-registration returns, series, e-invoice/EWB, LUT | All (Rel 3.0+) | ❌ one GSTIN; branches inherit it | M | L | set-up-gst-details-in-company |
| Regular-SEZ / Other-territory company | Registration type Regular-SEZ; Assessee of Other Territory | All | ❌ | L | S | set-up-gst-details-in-company |
| QRMP / quarterly GSTR-1 + IFF | Periodicity Monthly/Quarterly; IFF monthly upload; single file per quarter | All | ❌ monthly only | H | M | set-up-gst-details-in-company |
| Effective-dated company GST details | History of registration changes with effective dates | All | ❌ | L | S | set-up-gst-details-in-company |
| GST rate source hierarchy | Rates/HSN at company, group, ledger, item, item group, classification, or voucher; ledger-first vs item-first | All | ⚠️ per-product only | L | M | india-gst-manage-hsn-code-sac-and-tax-rates-tally |
| GST Classification master | Reusable HSN + rate template applied to many items; change once with date | All | ❌ | M | S | india-gst-create-use-and-update-gst-classifications-tally |
| Bulk GST rate update | GST Rate Setup report: rate-wise/HSN-wise views; Alt+S update selected with effective date; remove rates; change parent group; "not specified" section | All | ⚠️ missing-HSN report only; rates edited item by item | H | S | india-gst-rate-setup-tally |
| Effective-dated rate history per item | Every rate change asks for applicable-from date; vouchers use date-correct rate | All | ❌ | H | S | india-gst-rate-setup-tally |
| Slab-based GST rates | Rate by item price slab (e.g. ≤₹1000 5%, above 12/18%); slab on MRP option; include charges in slab | All | ❌ | H | S | set-up-stock-items-for-gst |
| Cess valuation types | Not applicable / on value / on quantity / value + quantity; override in invoice | All | ⚠️ cess in engine; cess fields not on product form | M | S | india-gst-create-use-and-update-gst-classifications-tally |
| GST on MRP (tobacco RSP rule) | Calculate GST on MRP incl. tax; 40%/18% from 1-Feb-2026; portal tolerance HSNs | All (Rel 7.1) | ❌ | M | S | gst-on-tobacco |
| Item flags: RCM / ITC / non-GST / capital goods | Applicable for reverse charge; eligible for ITC; is non-GST goods; ineligible u/s 17(5); nature Capital Goods | All | ⚠️ ITC-eligible per purchase line ✅; no RCM, capital-goods or 17(5) flags | M | S | set-up-stock-items-for-gst |
| Mixed supply | Combo item (BOM) taxed at highest component rate | All | ❌ | L | M | set-up-stock-items-for-gst |
| Composite supply | Service ledger included in assessable value, taxed with principal goods | All | ❌ | L | M | composite-supply-gst |
| Charges in assessable value | Freight/packing ledgers apportioned into taxable value by qty or value | All | ❌ | M | S | india-gst-expense-income-non-revenue-invoice-round-off-ledgers-tally |
| GST on non-revenue (asset sale) | "For Non-Revenue Accounts also" | All | ❌ | L | S | india-gst-expense-income-non-revenue-invoice-round-off-ledgers-tally |
| Built-in HSN/SAC list with descriptions | Pick HSN from list with auto description (Rel 7.1) | All | ❌ free-text HSN | M | S | validate-hsn-sac-stock-items |
| HSN validation against portal | Alt+B Get HSN/SAC Info; invalid-HSN summary | All + TSS | ❌ | M | M | validate-hsn-sac-stock-items |
| Minimum HSN length by turnover | 4 / 6 / 8 digits setting | All | ⚠️ missing-HSN report; no length rule | M | S | set-up-gst-rate-hsn-sac-details |
| Override GST details in voucher | Override taxable value, HSN, rate; O override vs Y record exception | All | ❌ | M | S | how-to-override-assessable-value-hsn-code-party-details-cess-valuation-method-in-sales-invoice |
| Place-of-supply override | Party Details PoS per voucher | All | ⚠️ backend supports; no UI | H | S | gst-sales-tally |
| Export with LUT / with payment | Exports Taxable / LUT-Bond / Exempt; LUT no. & validity; shipping bill details; hide IGST on print | All | ⚠️ zero-rated taxability ✅; no LUT details or export flow | L | M | export-goods-gst |
| SEZ supplies | Taxable / LUT / exempt to SEZ; IGST regardless of location | All | ❌ | L | M | supplies-to-sez-gst |
| Deemed export / high seas / embassy | Nature of transaction variants | All | ❌ | L | S | deemed-export-gst |
| Outward reverse-charge sales | Item/ledger RCM flag; no GST charged to registered buyer | All | ❌ | L | S | india-gst-outward-supply-rcm-tally |
| Reverse charge on purchases | RCM from registered/unregistered (GTA, legal, rent…); liability + ITC journals same or next period; RCM payment | All | ⚠️ reverse charge refused | H | M | india-gst-inward-supply-rcm-tally |
| Reverse Charge Supplies report | Liability vs ITC from RCM; balance to be booked; book from report | All | ❌ | M | S | reverse-charge-supplies-report |
| Import of goods | Bill of Entry no./date/port code; customs duty in taxable value; 3B import ITC | All | ❌ | M | M | india-gst-record-the-import-of-goods-under-gst-tally |
| Import of services (RCM) | Auto liability + ITC; 3B 3.1(d) | All | ❌ | L | S | india-gst-import-of-services-under-rcm-tally |
| GST on advance receipts | Advance Receipt with tax (Table 11A/11B); refund; re-open on return | All | ⚠️ advances tracked without GST liability | M | M | india-gst-advance-receipts-tally |
| Advance payment under RCM | Payment stat adjustment; auto-adjust advances FIFO | All | ❌ | L | S | india-gst-advance-payments-gst-reverse-charge-tally |
| GST stat adjustments | Increase/decrease liability; ITC reversal Rule 37/42/43, 17(5); ISD; reclaim | All | ⚠️ set-off + GST payment ✅; no reversal natures | M | M | tax-liability-ut-merger-tally |
| CDNUR original value choice | Interstate B2C credit note: original invoice ≤ / > ₹2.5 lakh decides 9B vs 7 | All | ❌ | L | S | b2c-large-invoices-5a-5b |
| Amendments via return effective date | Alter after filing; amended sections 9A/9C/10; amendment marked for future return | All | ❌ | M | M | gst-amendments-for-sales |
| Sign / mark return filed | GSTR-1 Sign (F10), 3B Mark as Filed; undo; edits after filing flagged | All | ❌ | H | S | gstr-1-report-in-tallyprime |
| Voucher GST statuses | Included / Not relevant / Uncertain / Modified after upload / Mismatch / Moved to other period | All | ⚠️ section totals only | M | M | gstr-1-report-in-tallyprime |
| Uncertain transactions & exception resolution | 30+ exception types; Accept as is; Update as per masters (bulk); ignore conflicts; resolve | All | ⚠️ missing-HSN only | H | M | rel-3-0-gstr-1-gstr-3b-exceptions-resolutions |
| GSTR-1 missing sections | Amended 9A/9C/10, advances 11A/11B, e-commerce 14/14A/15 | All | ⚠️ B2B/B2CL/B2CS/CDNR/CDNUR/EXP/EXEMP/HSN/DOCS present | M | M | gstr-1-report-in-tallyprime |
| GSTR-1 nature view | Local/Interstate/Export/SEZ split by taxable/exempt/nil/non-GST | All | ❌ | L | S | gstr-1-report-in-tallyprime |
| GSTR-1 JSON export | Portal JSON; section-wise; multi-period to one Excel | All | ❌ CSV/XLSX/PDF only | H | M | file-gstr-1-using-offline-tool |
| Connected GST filing | OTP login (30-day session), upload GSTR-1/3B, file with EVC/DSC, ARN, resume filing | All + TSS (Rel 5.0) | ❌ 📝 FR-092 | H | L | india-gst-filing-gstr1-tally |
| GSTR-1 books vs portal reconciliation | Download filed GSTR-1; reconciled / only books / only portal / different period | All + TSS | ❌ | M | M | india-gst-status-reconciliation-gstr-1-tally |
| Full GSTR-3B tables | 3.1(a-e), 3.2 interstate to unregistered/composition/UIN by PoS, 4A-4D ITC, 5 exempt inward, 5.1 interest/late fee | All | ⚠️ 3B summary; 3.2 PoS table and 4D detail unverified | H | M | gstr-3b-report |
| GSTR-3B JSON export / upload | Single JSON/Excel; offline-tool template; connected upload | All | ❌ | H | M | tallyprime-json-file-gstr-3b |
| ITC breakup of 3B | Current / from other periods / moved to other periods | All | ❌ | L | S | gstr-3b-report |
| GSTR-2A/2B reconciliation | Import portal JSON or download; reconciled/mismatched/only books/only portal/different period; potential matches; copy doc no.; set status | All (+TSS for download) | ❌ | H | L | gstr-2b-reconciliation |
| Reconciliation tolerances | Ignore leading zeros, special characters, taxable-value diff, round-off tolerance by amount and direction | All | ❌ | M | S | set-up-gst-details-in-company |
| IMS (Invoice Management System) | Download inward invoices; Accept/Reject/Pending/No Action; remarks; upload; IMS-ITC summary; recompute 2B | All + TSS (Rel 6.1) | ❌ | H | L | manage-ims-inward-supplies |
| ITC at risk outstanding | Bills Payable – GST, Ledger Outstandings – GST; settle by difference | All | ❌ | M | M | view-itc-at-risk-using-bills-payable-gst |
| GST Annual Computation | Year view for GSTR-9: liability, ITC, reversals, annual HSN summary | All | ❌ | M | M | gst-annual-computation-tally |
| GSTR-9 / 9C mapping | Table-by-table mapping and exports for annual return/reconciliation | All | ❌ | M | M | form-gstr-9-annual-returns |
| Composition CMP-08 & GSTR-4 | CMP-08 quarterly report and upload; GSTR-4 annual; GSTR-9A | All | ❌ (bill of supply ✅) | H | M | gstr-4-annual-returns |
| e-Invoice: IRN on save | Bill-to/ship-to place; IRN, Ack no., QR stored; ship-to GSTIN mandate (Advisory 661) | All + TSS | ❌ 📝 FR-089 | H | L | generate-irn-print-qr-code |
| e-Invoice: bulk & offline | Bulk Send for e-Invoicing; offline JSON (auto-split >2 MB); manual IRN update; Get IRN Info | All | ❌ | M | M | generate-bulk-irn-e-invoice |
| e-Invoice: cancel & undo | Cancel within 24h with reason; cancel & delete; mark cancelled elsewhere; undo | All + TSS | ❌ | H | S | cancel-irn-e-invoice |
| e-Invoice report | IRN register; uncertain; missing info; rejected; pending; mismatch with QR | All | ❌ | M | M | how-to-view-e-invoice-report-and-get-irn-information-tallyhelp |
| e-Invoice print IRN + QR | Print with IRN, Ack, signed QR | All | ❌ (columns only) | H | S | generate-irn-print-qr-code |
| e-Invoice sandbox | Test without live portal | All | ❌ | L | S | e-invoice-sandbox |
| e-Way Bill: generate | Sub type, document type, consignor/consignee, distance auto, transporter ID, mode, vehicle; thresholds; intrastate option | All + TSS | ❌ 📝 FR-090 | H | L | generate-e-way-bill-online |
| e-Way Bill: bulk & offline JSON | Bulk send; offline JSON incl. URD purchases; consolidated EWB | All | ❌ | M | M | generate-e-way-bill-offline |
| e-Way Bill: Part B / extend / cancel | Update vehicle (transshipment); extend validity within 8h; cancel within 24h; undo | All + TSS | ❌ | H | M | update-e-way-bill-part-b-online |
| e-Way Bill report & print | Register, rejected, pending, with/without Part B; EWB slip with QR | All | ❌ | M | M | e-way-bill-report-and-e-way-bill-info |
| Exclude voucher from EWB / gold rule | Per-voucher exclusion; Kerala gold without Part B | All (Rel 7.1) | ❌ | L | S | generate-e-way-bill-online |
| Duplicate document no. detection | Uncertain section in GST reports; update doc no. | All (Rel 7.0) | ❌ | M | S | manage-duplicate-nos-for-gst-vouchers |
| Inactive GSTIN → B2C conversion | Bulk convert B2B to B2C for inactive GSTINs | All (Rel 5.1) | ❌ | L | S | inactive-gstin |
| GST-TDS on metal scrap (GSTR-7) | 2% via journal; GSTR-7 data | All | ❌ | L | S | gst-tds-on-metal-scrap |
| B2CL threshold settings UI | Threshold + applicable from; effective dates for GSTR-1 vs 3B | All | ⚠️ setting honoured; no UI | L | S | b2c-large-invoices-5a-5b |
| GST activity tracking | Track GST Return Activities; notifications for upload/download status | All | ⚠️ in-app notifications exist; no GST due-date or filing alerts | M | S | refresh-gst-status-of-vouchers |

## 10. TDS / TCS / MSME / other statutory

| Feature / option | Tally detail (concrete sub-options) | Edition/add-on | Muneem today | Value | Effort | Source |
|---|---|---|---|---|---|---|
| TDS enablement & deductor details | TAN, deductor type, branch, responsible person; surcharge/cess slabs | All | ❌ 📝 FR-098 | M | M | tds-masters-tally |
| TDS Nature of Payment master | Section, payment code, rates with/without PAN, single-bill & aggregate thresholds, history; IT Act 2025 codes | All | ❌ | M | M | create-tds-masters |
| Deductee setup | Deductee type; PAN status codes; zero/lower deduction certificate with validity | All | ❌ | M | S | create-tds-masters |
| TDS on purchases/expenses | Auto-calc on 194C/194J/194I/194H; TDS on advance; reversal via debit note | All | ❌ | M | M | tds-on-purchase |
| 194Q TDS on purchase of goods | Threshold split in one voucher; 0.1% / 5% no-PAN | All | ❌ | M | M | tds-section-194q |
| 206AB/206CCA higher rate | Specified-person higher rate | All | ❌ | L | S | configure-specified-person-higher-tax-rate-under-section-206cca |
| TDS base incl./excl. GST | "Is TDS applicable" on GST duty ledgers | All | ❌ | L | S | india-gst-account-for-tds-on-purchases-under-gst-tally |
| TDS payment & challan reconciliation | Stat payment autofill; late fee; BSR/challan no./date | All | ❌ | M | S | tds-payment-and-late-fee-for-tds |
| TDS Outstandings report | By nature of payment, party-wise, overdue | All | ❌ | M | S | tds-outstanding-challan |
| Ledgers without PAN | Report with inline PAN entry | All | ❌ | M | S | tds-outstanding-challan |
| Form 26Q / Form 140 | Return report with uncertain categories; FVU .txt; save/revise | All | ❌ | M | L | form-26q-tally |
| Form 27Q / Form 144 | Non-resident TDS return | All | ❌ | L | M | tds-in-tallyprime |
| TCS setup & Nature of Goods | Collector details; scrap, minerals, motor vehicle >₹10L, luxury goods; realisation vs accrual | All | ❌ | M | M | tcs-tallyprime |
| TCS on sales | Aggregation per party vs threshold; govt-buyer and buyer-deductible exemptions; no-PAN higher rate | All | ❌ | M | M | tcs-tallyprime |
| TCS charged by supplier on purchases | Record TCS on purchase bill | All | ❌ | M | S | record-tcs-on-purchase |
| TCS outstanding, challan & Form 27EQ/143 | Outstanding, challan reconciliation, e-return SDF | All | ❌ | M | M | tcs-tallyprime |
| Company MSME/Udyam details | Enterprise type, Udyam no., effective-dated history | All (Rel 4.1) | ❌ | M | S | set-up-udyam-regn-details-msme-companies |
| Supplier MSME details | Micro/Small/Medium, Udyam no., activity type; bulk update | All | ❌ | H | S | set-up-udyam-details-msme-suppliers |
| MSME 45-day payables tracking | Bills of micro & small parties due in N days / overdue; 43B(h) list | All | ❌ | H | S | due-dates-for-payables-to-msme-suppliers |
| MSME Form 1 annexure | PAN-wise, paid/outstanding beyond 45 days; MCA template export | All (Rel 6.1) | ❌ | M | S | view-upload-msme-form-1-annexure |
| MSME penal interest | 3× RBI bank rate on delayed payments | All | ❌ | L | S | due-dates-for-payables-to-msme-suppliers |
| Legacy VAT / Excise / Service Tax | F11 toggles for pre-GST periods | All | ❌ | L | M | defining-tax-rates-at-company-level |

## 11. Inventory (godowns, batches, BOM, job work, price levels, valuation)

| Feature / option | Tally detail (concrete sub-options) | Edition/add-on | Muneem today | Value | Effort | Source |
|---|---|---|---|---|---|---|
| Multiple godowns with hierarchy | Godown master: aliases, Under (region > warehouse > rack), address, Allow storage of materials; Main Location default | All | ⚠️ one warehouse per branch, no UI 📝 FR-093 | H | M | inventory-storage-using-godowns-locations-tally |
| Godown allocation in vouchers | Split one line across godowns; each godown valued as own lot; opening per godown | All | ❌ | M | M | inventory-storage-using-godowns-locations-tally |
| Third-party stock godowns | Our stock with third party / third party stock with us | All | ❌ | L | M | consignment-transactions-tally |
| Inter-godown transfer | Stock Journal transfer class / "Use for Inter-Godown Transfers"; destination entered once; print destination | All | ❌ 📝 FR-093 | H | M | inventory-entry-tally |
| Conversion / repacking journal | Stock Journal consumption → production with different rates (bulk to packets) | All | ❌ | H | M | inventory-entry-tally |
| Stock journal additional cost | Track additional costs (ledger, %, amount) | All | ❌ | L | S | inventory-entry-tally |
| Batches with mfg & expiry | Maintain in batches; track mfg date; use expiry dates; new batch on the fly; split purchase into batches | All | ⚠️ schema-only 📝 FR-091 | H | M | manage-inventory-batch-wise-tally |
| Batch Summary / Batch Vouchers | Expiry date, days to expiry, expired-only filter, sort by expiry, negative batches | All | ❌ | H | S | manage-inventory-batch-wise-tally |
| Expired-batch controls | Use expired batches toggle; show zero-qty batches | All | ❌ | M | S | inventory-entry-tally |
| Ageing by expiry | Ageing style by expiry / mfg date / to-be-expired; expired batches only | All | ❌ | H | S | stock-ageing-analysis-report-tally |
| Bill of Materials | Multiple BoMs per item; unit of manufacture; component godown; co-product / by-product / scrap with cost %; copy BoM | All | ❌ | M | M | manage-inventory-in-manufacturing-tally |
| Manufacturing Journal | Components auto from BoM; additional cost %; effective rate of finished item | All | ❌ | M | M | manage-inventory-in-manufacturing-tally |
| Purchase requisition | Optional stock journal type used as requisition | All | ❌ | L | S | manage-inventory-in-manufacturing-tally |
| Job costing | Projects via cost centres + godowns; consumption class; Job Work Analysis (revenue, cost, P/L) | All | ❌ | L | M | job-costing-tally |
| Job work orders | Job Work In/Out Orders; Material In/Out against order; track components; allow auto-consumption | All | ❌ | L | L | job-work-setup |
| Material Movement Register | Job-work register (challan nos., process loss, scrap, GRN) | All | ❌ | L | M | job-worker |
| Stock with job worker / from party | Stock held at/for job workers | All | ❌ | L | M | principal-manufacturer |
| Issue / receipt variance analysis | Delivered vs ordered quantities for job work | All | ❌ | L | S | job-worker |
| Item cost tracking | Enable Cost Tracking: accumulate procurement/landing/manufacturing cost per lot | All | ❌ | L | M | inventory-tally |
| Named price levels | F11 multiple price levels (Wholesaler/Retailer/Dealer) | All | ⚠️ retail/wholesale/distributor/custom lists ✅ but not selectable at POS | H | S | selling-buying-prices |
| Price list discount % per slab | Qty slabs From/Less than with rate and Disc % ; cost price shown; history | All | ⚠️ qty breaks + date-effective ✅; no discount % column | M | S | selling-buying-prices |
| Party default price level | "Use Price Levels for Party Ledgers"; one per ledger, overridable | All | ❌ | H | S | selling-buying-prices |
| Bulk price revision | Alt+R revise prices/discounts by % or value for group/category & level from a date | All | ❌ | H | S | selling-buying-prices |
| Standard cost & selling price history | Date-wise standard rates auto-fill purchase/sale | All | ⚠️ single purchase/selling price on product | L | S | selling-buying-prices |
| Costing methods | Average (default), FIFO, FIFO perpetual, LIFO annual/perpetual, Last purchase, Standard, Monthly average, Zero cost; per item | All | ⚠️ moving weighted average only | M | M | stock-valuation-methods-tallyprime |
| Market valuation methods | Average price, Last sale price, Standard price, Zero price | All | ❌ | L | S | stock-valuation-methods-tallyprime |
| Compare valuation methods | BS/P&L/Stock Summary Alt+N columns by valuation method; Ctrl+B override | All | ❌ | L | S | stock-valuation-methods-tallyprime |
| Stock Summary columns | Opening, inwards, outwards, closing, gross value outwards, consumption & GP; period/company columns | All | ⚠️ stock valuation + stock movement reports; no combined summary with GP | M | S | track-your-inventory-stock-summary-tally |
| Stock item monthly summary | Monthly in/out/closing with graph; drill to vouchers | All | ⚠️ product ledger ✅; no monthly summary | L | S | track-your-inventory-stock-summary-tally |
| Stock Query | Last purchase/sale party, qty, rate, discount; godown/batch stock; same-category items; top buyers/sellers; reorders | All | ❌ | H | S | stock-query-tally |
| Movement Analysis | Inwards by supplier, outwards by buyer, basic vs effective (landed) rate; additional cost detail | All | ⚠️ stock movement report; no by-party/effective rate | M | S | movement-analysis-tally |
| Group / category movement analysis | Stock group and category movement with group-by options | All | ❌ | L | S | movement-analysis-tally |
| Group / Ledger Analysis | Items bought/sold per party or party group | All | ❌ | M | S | movement-analysis-tally |
| Stock Transfer Analysis | Goods in/out per stock journal type; wastage check | All | ❌ | L | S | movement-analysis-tally |
| Stock Ageing Analysis | User-defined slabs (0-45/45-90/90-180/180+); by purchase date; valuation method; drill to inward details | All | ❌ | H | S | stock-ageing-analysis-report-tally |
| Reorder levels in bulk | Reorder Level by item/group/category grid | All | ⚠️ per-product reorder level only | M | S | reorder-stock-items-reorder-status-and-reorder-quantity |
| Advanced reorder & MOQ | Consumption-based reorder over a period (higher/lower of fixed vs consumption); minimum order qty; rounding | All | ❌ | M | S | reorder-stock-items-reorder-status-and-reorder-quantity |
| Reorder Status report | Closing + pending PO − SO due; shortfall; order to be placed | All | ⚠️ low-stock list only | H | S | reorder-stock-items-reorder-status-and-reorder-quantity |
| Godown Summary | Location-wise stock; godown-type views; monthly; godown vouchers | All | ❌ | M | S | godown-summary-tally |
| Physical Stock Register | Count of physical stock vouchers by period | All | ⚠️ stock take ✅; no register | L | S | physical-stock-register-tally |
| Negative stock exception report | Ctrl+J negative stock items; daily negative stock | All | ⚠️ negative-stock policy exists (no UI); no exception report | M | S | verfication-stock-item-tally |
| Stock item verification | Current vs previous year: not used, only balances, opening differences | All | ❌ | L | S | verfication-stock-item-tally |
| Cost Estimation report | Item cost estimates by stock group | All | ❌ | L | S | manage-inventory-in-manufacturing-tally |
| Compound units | Box of 12 Nos; tail-unit display (12 Kgs 250 gms) | All | ⚠️ units + conversions ✅; no compound display | L | S | create-payroll-units-tally |
| Per-unit decimal places | Increase/decrease decimals of a unit | All | ⚠️ global 3dp | L | S | accounting-inventory |
| Part number on items | Use Part Number for stock items | All | ❌ | L | S | manage-stock-item-tally (UNVERIFIED) |
| Item description / notes / language alias | Additional description lines; notes; per-language name | All | ❌ | M | S | manage-stock-item-tally (UNVERIFIED) |
| MRP history (state-wise, dated) | MRP from-date with state-wise MRP; allow MRP edit in voucher | All | ⚠️ single MRP field | L | S | manage-stock-item-tally (UNVERIFIED) |
| Opening stock with godown/batch | Opening qty/rate/value allocated per godown and batch; bulk remove opening qty | All | ⚠️ opening stock import ✅; no godown/batch split | L | S | accounting-inventory |
| Stock group "quantities can be added" | Toggle so mixed-unit groups don't total qty | All | ❌ | L | S | manage-stock-item-tally (UNVERIFIED) |
| Delete unused stock items in bulk | Multi-delete blocked when used | All | ❌ | L | S | accounting-inventory |
| Landed-cost appropriation basis | Appropriate by Qty vs by Value per charge ledger | All | ⚠️ landed-cost charges ✅; basis choice unverified | L | S | additional-cost-of-purchase |

## 12. Payroll

| Feature / option | Tally detail (concrete sub-options) | Edition/add-on | Muneem today | Value | Effort | Source |
|---|---|---|---|---|---|---|
| Payroll module | F11 Maintain Payroll + Enable Payroll Statutory; PF/ESI/NPS/IT company codes | All | ❌ no payroll | M | L | enabling-payroll-in-tallyprime-tally |
| Employee master | Joining date, designation, location, bank, PAN, Aadhaar, UAN, PF/ESI no., PRAN, separation details, tax regime | All | ❌ | M | M | payroll-create-employees-tally |
| Employee groups & categories | Nested groups; categories for location/project | All | ❌ | L | S | payroll-create-employee-group-master-tally |
| Attendance & production types | Present, leave with/without pay, OT hours, piece-rate units, user calendar | All | ❌ | M | M | create-attendance-or-production-types-payroll |
| Attendance voucher & import | Autofill attendance; import from Excel/biometric via mapping | All | ❌ | M | M | create-attendance-or-production-vouchers-payroll-tally |
| Pay heads & calculation types | Earnings, deductions, reimbursements, loans/advances, employer contributions, gratuity; on attendance / computed formula / flat / production / user value; slabs; rounding | All | ❌ | M | L | earnings-pay-head-with-calculation-type-as-attendance-payroll |
| Salary structure | Per employee/group, effective-dated, copy from; increments & arrears | All | ❌ | M | M | define-salary-structure-for-employees-and-employee-groups |
| Payroll processing & payment | Payroll autofill; accrue to Salary Payable; pay with bank allocations; payroll payment advice | All | ❌ | M | M | salary-payment-tally |
| Salary advance & instalment recovery | Advance via payment; recover via payroll; carry forward | All | ❌ | M | S | tracking-loans-advances-tally |
| Payslips | Single & multi-employee payslips; print/e-mail/WhatsApp; pay sheet | All | ❌ | M | M | multi-pay-slip-tally |
| PF | EPF/EPS/EDLI/admin computation; monthly statement; Forms 3A/5/6A/10/12A; ECR export | All | ❌ | M | L | payroll-e-challan-returns-tally |
| ESI | Contributions; monthly statement; Form 3/5/6; e-return | All | ❌ | M | M | monthly-statement-esi-tally |
| Professional Tax | PT computation; monthly statement | All | ❌ | M | S | professional-tax-computation-report-tally |
| NPS | Employer/employee contributions; summary; PRAN not available | All | ❌ | L | S | payroll-features-of-tally-erp-tally |
| Salary TDS | IT declarations (HRA, 80C…), old/new regime, computation, projection, Form 16, 12BA, 24Q/Form 138 | All | ❌ | L | L | income-tax-declarations-tally |
| Gratuity | Gratuity pay head with slabs; Gratuity Summary | All | ❌ | L | S | payroll-create-gratuity-pay-head-tally |
| Payroll reports | Employee profile, head count, attendance sheet/register, payroll register, pay head breakup, payroll statement, statutory summary | All | ❌ | M | M | payroll-reports |

## 13. Banking

| Feature / option | Tally detail (concrete sub-options) | Edition/add-on | Muneem today | Value | Effort | Source |
|---|---|---|---|---|---|---|
| Bank ledger details | A/c holder, A/c no., IFSC (format-validated), SWIFT, bank name from list, branch, BSR | All | ⚠️ bank accounts in COA; bank details only for invoice print; no IFSC validation | L | S | banking-setup |
| Bank statement import | Excel/CSV/MT940; ~138 Indian bank formats; preview; reset imported data | All | ❌ 📝 FR-094 | H | M | bank-statement |
| Auto bank reconciliation | Exact / potential / partial matches; find match; modify/unlink; set status; 1:many | All (Rel 6.0) | ❌ | H | M | auto-bank-reconciliation |
| Match configuration | Amount tolerance, ignore zeros/special characters in refs, match window N days | All | ❌ | M | S | auto-bank-reconciliation |
| Vouchers from bank statement | Single, multi (common ledger), consolidated; bill-wise (7.1); created optional then reconciled | All | ❌ | H | M | auto-create-vouchers |
| Manual BRS | Enter bank date; view reconciled; undo | All | ❌ | H | S | manual-bank-reconciliation |
| Opening BRS | Reconciliation beginning date; opening unreconciled items | All | ❌ | M | S | bank-recon-setup |
| BRS Summary & Banking Activities | Books vs bank balance, only-in-books / only-in-bank, difference; counts per bank | All | ❌ | H | S | bank-recon-reports |
| Connected Banking | Live balance and statement (Axis, SBI, Kotak, ICICI); 2FA; admin approval | All + TSS | ❌ | M | L | connected-banking |
| Online payments from books | Send payments with bank OTP; single/daily limits; status | All + TSS (Rel 7.0) | ❌ | L | L | online-payments |
| e-Payments files | Payment instruction export for 18+ banks; reverse-file import; statuses; reset | All + TSS | ❌ | L | L | e-payments-report |
| Transfer mode ranges | NEFT/RTGS/IMPS amount ranges and preferred mode | All | ❌ | L | S | e-payments-set-up |
| Cheque book ranges | Multiple cheque books per bank; auto next cheque no. | All | ❌ | M | S | cheque-payments-set-up |
| Cheque printing | ~619 bank formats; user-defined; alignment; blank date; self cheque; bulk; company name toggle | All | ❌ | M | M | print-cheques |
| Cheque Register | Available / unreconciled / reconciled / blank / cancelled / out of period | All | ❌ | L | S | cheque-register |
| Blank cheques | Issue blank cheque; number locked | All | ❌ | L | S | issue-blank-cheques |
| Post-dated cheques | Record PDC; notional bank; PDC summary; auto-regularise; alter date/bank; bulk create | All | ❌ | H | M | post-dated-cheque-managment-tally |
| Deposit slips | Cash (with denominations) and cheque deposit slips; mark printed | All | ❌ | M | S | deposit-slips |
| Payment advice | Print/e-mail advice with bills, TDS, mode; auto advice via connected banking | All | ❌ | M | S | payment-advice |
| Bank status in voucher | Show bank date/status; set On Hold / Processed / Reconciled from voucher | All | ❌ | L | S | payments-and-receipts-tally |
| Stale cheques report | Instruments older than validity (3 months) | All | ❌ | L | S | stale-cheque-instruments-tally |
| Cash withdrawals/deposits analysis | Days delayed between instrument and bank date | All | ❌ | L | S | cash-withdraw-deposit-to-bank-tally |
| Bank OD limit | Set OD limit used in cash-flow projection | All | ❌ | L | S | cash-flow-and-projection-report-tally |
| Payment gateway ledger & reconciliation | Behave as payment gateway; import Razorpay/PayU statements; auto-reconcile; settlement contra | All | ❌ | M | M | payment-request |
| Bharat Connect for Business | B2B invoice & payment network (NBBL); send/receive invoices; acknowledge payments | All (Rel 6.0) | ❌ | L | L | bharat-connect-for-business |
| Cash denominations | Denomination details on contra / deposit slip | All | ⚠️ denomination count contract-only | M | S | deposit-slips |

## 14. Outstanding & credit control

| Feature / option | Tally detail (concrete sub-options) | Edition/add-on | Muneem today | Value | Effort | Source |
|---|---|---|---|---|---|---|
| Custom ageing slabs | F6 Ageing Method: by bill date or due date; user-defined periods | All | ⚠️ fixed buckets (not due/0-30/31-60/61-90/90+) | M | S | manage-receivables-outstanding-tally |
| Group outstandings & bill-wise views | Group → ledger-wise → bill-wise; nett balances; overdue only | All | ⚠️ party ageing ✅; no group/bill-wise drill | M | S | manage-receivables-outstanding-tally |
| Settle Bills from outstandings | Alt+B select bills → prefilled receipt/payment | All | ❌ | M | S | manage-outstanding-payables-tally |
| Reminder letters | Ageing range, due on, overdue days, post-dated, signatory; print/e-mail/WhatsApp; bulk for a group | All | ❌ 📝 FR-088 | H | M | print-invoices-reports |
| Confirmation of Accounts | Ledger statement with confirmation text + signatory; one or many ledgers | All | ⚠️ ledger statement export ✅; no confirmation letter | M | S | export-data-in-tally |
| Interest calculation (simple) | Per-ledger rate; style 365-day / calendar year / month; Dr/Cr balances; transaction-by-transaction | All | ❌ | M | M | interest-calculation-tally |
| Interest calculation (advanced) | Date-ranged rates; applicability past due date + grace days; slabs; rounding; per-transaction override | All | ❌ | M | M | interest-calculation-tally |
| Interest reports | Group / ledger interest calculation; bill-wise; overdue | All | ❌ | M | S | interest-calculation-tally |
| Book interest via debit/credit note | Voucher class for interest accounting; compound option; auto-fills pending interest | All | ❌ | M | S | interest-calculation-tally |
| Credit-limit monitoring report | Customers near/over limit in group outstandings | All | ⚠️ limit check at sale only | M | S | monitor-customer-credit-usage-in-tallyprime |
| Payment performance of debtors | Receivable turnover days; per-invoice paid date and delay | All | ❌ | M | S | ratio-analysis-tally |
| Pending receivables analysis | Net pending receivables/payables summary; debtors with credit balance exceptions | All | ⚠️ ageing ✅; no exception view | L | S | outstandings-tally |
| Outstandings with payment link | Payment link/QR on ledger outstandings & reminders; status of bills | All + TSS | ❌ | H | S | payment-request |

## 15. Cost centres, budgets & multi-currency

| Feature / option | Tally detail (concrete sub-options) | Edition/add-on | Muneem today | Value | Effort | Source |
|---|---|---|---|---|---|---|
| Cost centres | Hierarchy, aliases, categories (parallel allocation), allocation per ledger line, per-ledger applicability | All | ❌ | M | M | cost-centre-or-profit-centre-tally |
| Cost centre class | Predefined % allocation applied on save | All | ❌ | L | S | cost-centre-or-profit-centre-tally |
| Cost centre reports | Break-up, summary, monthly summary, category summary, column comparison | All | ❌ | M | S | cost-centre-or-profit-centre-tally |
| Budgets | On groups / ledgers / cost centres; nett transactions vs closing balance; multiple budgets | All | ❌ | M | M | budgets-tally |
| Budget variance | F10 in TB, group summary, monthly summary | All | ❌ | M | S | budgets-tally |
| Scenarios | Include optional/memo/reversing; exclude forex/inventory calcs; compare in BS/P&L with variance | All | ❌ | L | M | scenarios-tally |
| Currency master & rates | Symbol, ISO code, decimals, words after decimal; standard/selling/buying rates by date | All | ❌ INR only | L | M | create-alter-or-delete-currencies |
| Foreign-currency vouchers | Invoices/payments in foreign currency; last voucher rate | All | ❌ | L | M | create-sales-voucher-with-foreign-currency-and-print-invoice-in-tallyprime |
| Forex gain/loss | Unadjusted forex in BS; adjustment voucher class | All | ❌ | L | M | account-for-forex-gain-or-loss |
| Reports in foreign currency | Alter column to any currency; side-by-side currencies | All | ❌ | L | S | view-reports-with-foreign-currency |
| Forex opening balances | Opening bills in foreign currency | All | ❌ | L | S | provide-ledger-opening-balance-in-foreign-currency |

## 16. Reports (missing reports by name, then report options)

| Feature / option | Tally detail (concrete sub-options) | Edition/add-on | Muneem today | Value | Effort | Source |
|---|---|---|---|---|---|---|
| Cash Flow | Monthly inflow/outflow/nett with bar graph; drill to summary | All | ❌ | M | S | cash-flow-and-projection-report-tally |
| Cash Flow Projection | Bank balance + receivables − payables by due date to FY end; OD limit; include overdues/scenarios | All | ❌ | H | S | cash-flow-and-projection-report-tally |
| Funds Flow | Working capital movement; sources vs applications | All | ❌ | L | S | funds-flow-report-tally |
| Ratio Analysis | Working capital, current, quick, D/E, GP%, NP%, operating cost %, receivable days, ROI, inventory turnover; explanations | All | ❌ | M | S | ratio-analysis-tally |
| Receipts and Payments | Opening cash/bank → receipts/payments by group → closing | All | ❌ | L | S | payments-and-receipts-tally |
| Group Summary / Group Vouchers | Closing balances of a group; vouchers touching a group; credit/debit only | All | ❌ | M | S | group-summary |
| Ledger Monthly Summary | Month-wise Dr/Cr/closing per ledger | All | ❌ | M | S | cash-bank-book-tally |
| Daily cash breakup | Daily balances with highest/lowest in month; negative-cash days | All | ❌ | M | S | cash-bank-book-tally |
| Payment / Receipt registers (columnar) | Month-wise counts; expense/income ledgers as columns | All | ⚠️ Payments report exists; not columnar | L | S | payments-and-receipts-tally |
| Journal, Credit/Debit Note registers | Monthly registers with F8 columnar, narration, bill-wise | All | ⚠️ credit notes report ✅; journal/debit-note registers absent | L | S | sales-return-tally |
| Purchase Register (month-wise) | Month drill; columnar; extract | All | ⚠️ Purchases report ✅; no monthly/columnar | L | S | purchase-goods-and-services-tally |
| Columnar Sales Register | Party address, GSTIN, PAN, port code; item/ledger/group columns; Extract (Alt+F8) | All | ⚠️ sales register ✅; no columnar/extract options | M | S | how-to-work-with-sales-register-in-tallyprime |
| Sales by customer / party analysis | Ledger Analysis: items and values sold per party; top ledgers | All | ❌ | H | S | movement-analysis-tally |
| Statistics | Voucher-type and master counts; compare companies | All | ❌ | L | S | statistics-report-tally |
| Exception reports | Negative ledgers, negative stock, optional, cancelled, post-dated, overdue receivables/payables | All | ❌ | M | S | working-with-reports |
| Verification of Chart of Accounts | Squared-off, unused, regrouped, revenue with opening balance… vs previous year | All | ❌ | L | S | verification-charts-accounts-tally |
| Verification of Balances | Opening differences; closing against natural behaviour; ledger balance variance | All | ❌ | L | S | verification-balance-tally |
| Repeated transactions / Relative size factor | Same amount repeated per ledger; highest ÷ second-highest voucher | All | ❌ | L | S | data-analysis-tally |
| Highest and lowest value transactions | Per ledger with difference range and %; top 5 each | All | ❌ | L | S | highest-and-lowest-value-tally |
| Transactions on holiday | Weekly off + declared holidays configuration | All | ❌ | L | S | transactions-on-holiday-tally |
| Periodic payments & receipts | Mark periodic ledgers; CY vs PY amount and count variance | All | ❌ | L | S | periodic-payments-and-receipts-tally |
| Fixed Assets Analysis | Opening, additions (days held), deletions, closing | All | ❌ | L | S | fixed-assets-analysis-tally |
| Pending advances | Loans/advances given pending | All | ❌ | L | S | pending-advances-tally |
| Inter-bank transactions / analytical procedures | Inter-bank movement; comparison by group/cost centre | All | ❌ | L | S | data-analysis-tally |
| Voucher verification workflow | Sampling methods, verify/on hold, internal observation, external clarification by client, related party, forex vouchers | All | ❌ | L | M | voucher-verification-tally |
| Schedule III / NCE financial statements | Export TB to ICAI-format Excel template with notes, mapping, cash-flow statement | Plug-in (Rel 6.0/7.1) | ❌ | M | M | prepare-financial-statements |
| Configurable dashboard | Add/remove/expand tiles; tile types (top ledgers/items, cash flow, ratios, receivables, GSTR-2A, bank); per-tile period & graph type; position; save view | All (Rel 4.0) | ⚠️ fixed Today/Week/Month dashboard | M | M | dashboard |
| Share dashboard tiles | Print/export/e-mail/WhatsApp one or all tiles | All | ❌ | L | S | dashboard |
| Drill-down chain | TB/BS/P&L → group → ledger → voucher (Enter); Shift+Enter explode inline | All | ⚠️ ledger → voucher link only | H | M | working-with-reports |
| Detailed / condensed toggle | Alt+F5 on any report | All | ❌ | M | S | working-with-reports |
| Comparison columns | Alt+C new column (period, company, scenario, currency, budget, cost centre); Alt+A/Alt+D alter/delete | All | ❌ | H | M | working-with-reports |
| Auto columns | Alt+N repeat by day/week/fortnight/month/quarter/half-year/year, company, valuation method; total column | All | ❌ | H | M | working-with-reports |
| Scale factor | Ctrl+B: hundreds, thousands, lakhs, millions, crores | All | ❌ | M | S | cash-flow-and-projection-report-tally |
| Basis of values | Type of voucher entries (all / accounting / inventory; credit/debit only); include post-dated; forex only | All | ❌ | L | S | working-with-reports |
| Basic / multi / advanced filters | Ctrl+F look-for text; F6 multiple field conditions with and/or; F7 filter rows + calculate values; filter details | All (Rel 3.0) | ⚠️ date range + branch filter only | M | M | filter-reports |
| Range & value filters | Alt+F12 range on registers; Ctrl+F12 compute values from matching vouchers | All | ❌ | M | S | apply-range-value-filters |
| Saved views | Ctrl+L: default view, per company or all, with period/master; manage/delete | All (Rel 2.0) | ❌ | M | S | use-save-view-feature-in-tallyprime |
| Hide / restore lines | Ctrl+R remove line; Ctrl+U restore last; Alt+U restore all | All | ❌ | L | S | day-book-tally |
| Stripe view | Alternate row shading per report or app-wide | All (Rel 5.0) | ❌ | L | S | working-with-reports |
| BS / P&L formats | Horizontal T-form vs vertical; show percentages; gross profit section; loss under liabilities; working capital | All | ⚠️ single layout | M | S | balance-sheet-tally |
| Trial Balance options | Opening balance column; Dr/Cr transaction columns; nett; ledger-wise vs group-wise; expand all levels | All | ⚠️ basic TB | M | S | trial-balance-tally |
| Actual with post-dated values | BS/TB column type including post-dated | All | ❌ | L | S | faq-banking-tally |
| Day Book filters | Altered / deleted vouchers view; accounting-only / inventory-only; detailed tax breakup; voucher-type filter | All | ⚠️ day book ✅; filters absent | L | S | day-book-tally |
| Ledger Vouchers options | Running balance; credit/debit only; bill-wise view; mode of payment; include post-dated; cost centre detail | All | ⚠️ ledger view ✅; options absent | M | S | ledger-vouchers |
| Stock valuation in BS | F8 choose valuation method for closing stock in BS/P&L | All | ❌ | L | S | balance-sheet-tally |

## 17. Data management (backup, split, import, export, migration)

| Feature / option | Tally detail (concrete sub-options) | Edition/add-on | Muneem today | Value | Effort | Source |
|---|---|---|---|---|---|---|
| Backup while app closed | Scheduled backup runs even when TallyPrime is closed (scheduler service) | All + TSS (Rel 7.0) | ⚠️ schedule runs inside the app; background service unverified | M | M | backup-and-restore-in-tallyprime |
| Multiple named schedules & backup log | Once/daily/weekly/monthly per company; pause; log with status filter; move schedule between users | All | ⚠️ one schedule with retention 7/4/3 | L | S | manage-backup-schedules |
| Repair company data | Repair with before/after statistics; repair/migrate exceptions report; zero-command repair | All | ⚠️ diagnostics + audit verify; no user repair | L | M | repair-company-data-tally |
| Split company data | Verify then split from date / before date / into two companies; unreconciled BRS carried | All | ⚠️ year-end close ✅; no split into separate data files | L | M | split-company-data-tally |
| Voucher import from Excel | Transactions (sales, receipts, journals…) incl. multi-row ledgers, bill allocations, cost centres, GST/EWB fields | All (Rel 4.0) | ⚠️ only purchase-line CSV import | H | M | import-data-in-tally |
| Custom Excel mapping templates | Map any sheet: header/start row; compute value; fixed field values; exclude rows; unique-key rules; save per company | All | ⚠️ fixed column formats for products/parties | M | M | import-data-using-any-excel-file |
| XML / JSON import | Masters and vouchers from another Tally or ERP | All (JSON Rel 7.0) | ❌ | M | M | import-data-from-xml-or-json |
| Import options & exceptions | Behaviour if master exists; preview summary; backup before import; exceptions report | All | ⚠️ preview/round-trip for products; no import exceptions report across types | M | S | how-to-import-data-using-sample-excel-files-tallyhelp |
| Migration templates from other software | Busy, Marg, QuickBooks Desktop/Online, Odoo, Sage, Shopify | All | ❌ | H | M | import-data-in-tally |
| Full data export (masters + vouchers) | XML/JSON export; include dependent masters; export closing balance as opening | All | ⚠️ report exports only | M | M | export-data-in-tally |
| Export formats | ASCII, Excel, HTML, JPEG, JSON, PDF, XML; open file after export; timestamped names | All | ⚠️ CSV/XLSX/PDF | L | S | configure-for-print-export-share |
| Export for pivot table | Sales/purchase register with item, ledger, GST, dispatch, order properties for Excel pivot | All | ❌ | M | S | extracting-data-through-pivot-table-tally |
| ODBC live link | Excel Power Query refresh; Word mail merge from ledgers | All | ❌ | L | M | extracting-master-data-to-microsoft-excel-using-odbc-tally |
| Multi-user server monitoring | TallyPrime Server: live users, long holds, disconnect users, per-company activity counts | TPS | ⚠️ operator admin console (vendor side) only | L | M | company-view |

## 18. Connectivity (browser, remote, WhatsApp, e-mail, payment links)

| Feature / option | Tally detail (concrete sub-options) | Edition/add-on | Muneem today | Value | Effort | Source |
|---|---|---|---|---|---|---|
| Reports in Browser | Mobile-responsive reports; drill to vouchers; change period; download PDF/Excel; per-user access | All + TSS | ⚠️ /reports/daily cloud API only, no web view | H | M | tally-reports-in-browser-tally |
| Remote access | Remote user records/alters vouchers, prints, audits with per-user rights | All + TSS | ❌ (multi-device sync covers devices, not remote users) | M | L | remote-access-tally |
| Customer control centre | Web portal for licences, users, security levels, report access, central TDL | All | ⚠️ vendor operator console; no customer-facing portal | M | M | control-centre-tally |
| E-mail from the app | Sender profiles; Gmail/Microsoft OAuth or SMTP; templates; multiple recipients; file format choice | All | ❌ 📝 FR-085 (Save-as-PDF only) | H | M | e-mailing-in-tallyprime |
| E-mail beyond invoices | Payslips, reminder letters, multi-account reports, dashboard tiles | All | ❌ | M | S | e-mailing-in-tallyprime |
| WhatsApp Business API | Interakt BSP; Meta templates; Pay Now button; multiple recipients; send current or bulk | WhatsApp add-on (₹1,300/yr + wallet) | ❌ 📝 FR-085 / FR-088 | H | M | whatsapp-documents |
| UPI QR payment request | UPI merchant profile; QR on invoice/outstandings/reminders | All + TSS | ❌ 📝 FR-095 | H | S | payment-request |
| Gateway payment links | Razorpay/PayU merchant; link expiry; e-mail/SMS share; bulk from Day Book/outstandings; copy link | All + TSS | ❌ 📝 FR-095 | M | M | payment-request |
| Docs by Ira (AI bill capture) | PDF/image → sales/purchase/notes/orders vouchers; draft review; master mapping; duplicates; quota | Paid pages pack | ❌ | H | M | docs-by-ira |
| TallyIra mobile app | Scan/upload bills from phone into draft vouchers | Docs by Ira | ❌ 📝 FR-096 (mobile app) | M | M | voucher-creation-tallyira-app |
| MCP connector for AI assistants | Claude Desktop ↔ TallyPrime tools (masters, accounting, inventory, outstanding) | All (Rel 7.1 era) | ❌ | M | M | tallyprime-mcp-tools |
| Developer API | XML/JSON over HTTP (port 9000), ODBC, WebSocket, API Explorer | All | ❌ no user-facing API/webhooks | M | M | sample-xml |
| TallyCapital | CIBIL score, loan eligibility from books, loan application | Plug-in | ❌ | L | L | tallycapital-add-on |
| Cloud Access (hosted) | Hosted VM with browser client, 2FA, managed backups | TPCA ₹450–600/user/mo | ⚠️ cloud sync ✅; no browser client | M | L | ts:tallyprime-cloud-access |
| Tally export for accountants | Accountants receive data via sync, remote access, or XML import | All | ❌ no Tally-compatible export (XML) for a CA who uses Tally | H | M | sample-xml |

## 19. Customisation / TDL / plug-ins

| Feature / option | Tally detail (concrete sub-options) | Edition/add-on | Muneem today | Value | Effort | Source |
|---|---|---|---|---|---|---|
| TDL customisation (capability) | Tally Definition Language: custom fields, reports, invoice formats, integrations; local or account-level TDLs; per-user permission | All | ❌ no extension mechanism | M | L | customising-tallyprime |
| Custom fields (UDFs) on masters/vouchers | Added via TDL or partner add-ons | All + TDL | ❌ | M | M | customising-tallyprime |
| Template-level invoice styling | Form/part/line colour, style, background (developer) | All (Rel 7.1) | ⚠️ 10 fixed templates + branding | M | M | template-based-invoice-customisation |
| TallyShop marketplace | Partner add-ons; try/buy; filter by category/edition | All | ❌ | L | L | extend-using-tally-shop-add-ons-tally |
| Plug-in management | Built-in plug-ins enabled per licence; status report | All (Rel 5.0) | ❌ | L | M | tdls-and-add-ons-for-tallyprime |
| Amazon data import plug-in | Amazon B2B/B2C sales, returns, settlement, TDS/TCS files | Plug-in (Rel 7.1) | ❌ | M | M | amazon-data-import-plug-in |
| Partner implementation network | Tally Partners for customisation and support | — | ❌ | L | L | tdls-and-add-ons-for-tallyprime |

## 20. Keyboard, UX & language

| Feature / option | Tally detail (concrete sub-options) | Edition/add-on | Muneem today | Value | Effort | Source |
|---|---|---|---|---|---|---|
| Go To from anywhere | Alt+G searchable list of every report/voucher/master; Ctrl+G switch to | All | ❌ (global search 📝 FR-073) | H | S | quick-start-with-tallyprime |
| SmartFind | Alt+F fuzzy search across masters and vouchers; similar spellings; field:value queries; OR/NOT/>/<; history; all companies | All (Rel 7.0) | ❌ 📝 FR-073 | H | M | find-tallyprime |
| Voucher hotkeys everywhere | F4 Contra, F5 Payment, F6 Receipt, F7 Journal, F8 Sales, F9 Purchase, Alt+F6/Alt+F5 notes, Ctrl+F8/F9 orders, F10 other | All | ❌ shortcuts only inside POS | H | S | keyboard-shortcuts-tally-prime |
| Report hotkeys | Alt+C/A/D/N columns; Ctrl+B basis; Ctrl+H view; Ctrl+J exceptions; +/- next period; Shift+Enter explode | All | ❌ | M | S | keyboard-shortcuts-tally-prime |
| Global action keys | Ctrl+A save, Esc back, Ctrl+Q quit, Alt+D delete, Alt+X cancel, Ctrl+P print, Ctrl+E export, Ctrl+M e-mail | All | ⚠️ Ctrl/Cmd+A save in some forms; not consistent app-wide | M | S | keyboard-shortcuts-tally-prime |
| Mouse-free data entry | Enter moves field-to-field in every voucher and master; selection lists with type-ahead | All | ⚠️ keyboard-first only on POS | H | M | quick-start-with-tallyprime |
| Right button bar / bottom shortcut bar | Context buttons with underlined keys; hideable bottom bar | All | ❌ | M | S | quick-start-with-tallyprime |
| Change date / period anywhere | F2 date, Alt+F2 period on every screen | All | ⚠️ per-report date pickers | L | S | keyboard-shortcuts-tally-prime |
| Per-screen F12 configure | Every report/voucher has its own configuration panel | All | ❌ | M | M | quick-start-with-tallyprime |
| Data-entry in Indian languages | Ctrl+W: Hindi, Bengali, Tamil, Telugu, Marathi, Gujarati, Kannada, Malayalam, Punjabi, Oriya keyboards | All | ❌ English entry only | M | M | use-tallyprime-in-your-preferred-language |
| Language aliases for masters | Party/item names per language; print in customer's language | All | ❌ | M | M | use-tallyprime-in-your-preferred-language |
| Per-user display language | Each user picks UI language (Tally: English/Arabic/Bangla) | All | ⚠️ UI English; Hindi only in help | M | M | use-tallyprime-in-your-preferred-language |
| ₹ symbol key | Ctrl+4 / Alt+4 types ₹ | All | ❌ | L | S | keyboard-shortcuts-tally-prime |
| Display settings | Stripe view, auto wrap text, list aliases language, closing qty in item list | All | ❌ | L | S | set-up-tallyprime-auto-login-language-multiple-addresses |

## 21. Editions & pricing

| Feature / option | Tally detail (concrete sub-options) | Edition/add-on | Muneem today | Value | Effort | Source |
|---|---|---|---|---|---|---|
| Published price list | Silver ₹22,500 + GST perpetual (₹750/mo rental); Gold ₹67,500 (₹2,250/mo); feature parity across plans | Silver / Gold | ⚠️ pricing TBD | H | S | ts:buy-tally |
| Rental ↔ perpetual & upgrades | Pay difference to convert; Silver→Gold upgrade; 3 Silver → 1 multi-user | All | ⚠️ pricing TBD | M | S | ts:rental-to-perpetual-upgrade |
| Annual service subscription | TSS ₹4,500 / ₹13,500 per yr: upgrades + connected services; renew in-app; snooze reminder | TSS | ⚠️ pricing TBD (no in-app subscription view) | M | S | tally-software-services-tss |
| Free trial / educational mode | 7-day trial; unlicensed mode with date restriction | All | ⚠️ unverified | M | S | licensing-tallyprime |
| Auditor / CA edition | Discounted TSS for auditors; Tally.NET auditor access to client data | Auditor ₹6,750/yr | ❌ no accountant seat or CA access | H | M | tally-software-services-tss |
| Multi-user / multi-site licences | Gold unlimited LAN users; multi-site licence; licence from network | Gold | ⚠️ multi-terminal via cloud sync; licence model TBD | M | S | licensing-tallyprime |
| Server edition | TallyPrime Server for high concurrency, monitor, server-level permissions | TPS | ⚠️ cloud sync architecture; no on-prem server tier | L | L | tally-prime-server |
| Paid storage & usage packs | TallyDrive ₹100/mo per 10 GB; Docs by Ira page packs; WhatsApp wallet | Add-ons | ⚠️ cloud backup included; packs TBD | L | S | ts:tallyprime-total-cost-of-ownership-india |
| Subscriptions view | One screen with status/expiry of TSS, TallyDrive, Cloud Access; renew | All (Rel 7.1) | ❌ | L | S | release-notes-tallyprime-7-1 |
| About page / licence info | Edition, release, serial, rental validity, TDLs, data location | All | ⚠️ diagnostics screen; no licence details | L | S | about-page-in-tallyprime |

---

## Where Muneem is ahead of TallyPrime

- **Multi-device sync and cloud backup included.** Muneem has offline-first sync with a Go cloud, conflict review and device registration/revoke. Tally needs TSS for sync and remote access, Cloud Access at ₹450–600 per user per month, and TallyDrive storage at ₹100 per 10 GB per month.
- **Tamper-evident audit log that is always on.** Muneem's audit log is hash-chained and can be verified. In standard TallyPrime the Edit Log can be switched off; only the separate Edit Log edition locks it on.
- **Real POS counter operations.** Muneem has register sessions with float, cash in/out, safe drop, X/Z reports, blind close and a variance threshold. It also has ESC/POS thermal printing (58/80 mm, network or spooler), cash-drawer kick, a print queue and DUPLICATE reprints. Tally's own FAQ says POS has no cash-register or pole-display support and prints through generic printers.
- **Faster billing.** Muneem supports up to 20 barcodes per product with wedge-scanner billing, held bills with a recall list, UPI as a first-class tender, split tender, and a duplicate-bill warning. Tally puts a barcode in the item alias and holds a bill by opening a nested voucher.
- **Per-role money limits.** Muneem caps discount (maxDiscountBp) and refund amount (maxRefundPaise) per role. Tally can only allow or disallow a facility.
- **Immutable numbering.** Muneem numbers per terminal and per FY, never renumbers, and cancels a bill through a credit note. In Tally, Automatic numbering renumbers later vouchers on delete, date change or insert, which complicates GST document series.
- **Privacy compliance.** Muneem records DPDP consent per purpose and channel, with export and erase. Tally has nothing equivalent.
- **Indian bilingual invoice out of the box.** Muneem ships a Hindi + English "bharat" template among 10 templates, plus thermal formats. Tally's bilingual print targets Arabic (GCC); Indian languages need language aliases and configuration.
- **Bulk product import.** Muneem imports up to 20k products from CSV/XLSX and can export them back in the same format.
- **Modern UX.** Muneem has light/dark themes, a guided 12-step tour, an in-app manual in English and Hindi, auto-update channels, crash reporting and a diagnostics screen.
- **No GST-update paywall (pricing TBD).** When TSS lapses, Tally stops getting statutory updates. Muneem's model is "own your data", with no subscription lock planned for compliance updates.
