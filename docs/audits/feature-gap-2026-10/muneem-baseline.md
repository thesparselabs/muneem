# Muneem — verified feature inventory at HEAD 7f3e450 (from code)

Legend: ✅ built (backend+UI) · ⚠️ partial (backend-only / schema-only / limited) · 📝 planned not built · ❌ absent

## Backend without UI (⚠️)
auth.setPin (no PIN setup screen), business.update (no edit business), settings.get/listSeries/createSeries (no custom number series UI), pos.zReport recall, sales.getReceipt, returns.get/getReceipt, inventory.listWarehouses. Settings keys honoured but no UI: pos.roundToRupee, pos.blindClose, pos.varianceThresholdPaise, gst.b2clThreshold(s), inventory.negativeStock (block/warn/allow), pos.receiptFooter. Only crash-reporting toggle has UI.

## 1 Setup
✅ Wizard Business→Branch→Terminal. Business: name, legal name, type (retail/wholesale/distribution/service/restaurant/trading/other), state, city, PIN, phone, GST scheme (regular/composition/unregistered), GSTIN, PAN. FY fixed April. Branch code/name/address; GSTIN inherited (no per-branch GSTIN). Terminal code/name/invoice prefix (1–4).
✅ Add device from cloud bundle. ⚠️ more branches/terminals: API only. ❌ multi-business switcher.

## 2 Users/auth
✅ online + offline login (30 days). ⚠️ PIN switch-user (no setup). ✅ RBAC resource×action with limits maxDiscountBp, maxRefundPaise, backdateDays; presets owner/manager/cashier/accountant/inventory. ❌ invite staff / assign roles (cloud only creates owner). ❌ approvals workflow, manager PIN override. ✅ device registration/revoke.

## 3 Catalog
✅ product: name, SKU, HSN/SAC, category, brand, base unit, tax treatment (taxable/nil/exempt/non-GST/zero), GST rate 0/0.25/3/5/12/18/28/40, price incl GST toggle, MRP, selling, purchase price, reorder level, deactivate. ⚠️ cess fields & per-product negative stock not on form. ✅ ≤20 barcodes/product (symbology not editable), wedge scanner. ✅ units + per-product conversions; custom units. ✅ nested categories, brands. ⚠️ price lists (retail/wholesale/distributor/custom, qty breaks, date-effective) but POS always uses default list — no per-customer/per-sale list. ✅ search. ✅ CSV/XLSX import (20k rows) + export round-trip. ⚠️ variants schema-only. ❌ barcode/label printing. ❌ composite items/BOM, services-specific items, item images.

## 4 POS/sales
✅ cart, qty 3dp, line & bill discount (amt/%) with cashier limits, live GST split, round-off, stock warnings, duplicate-bill warning, recent bills. ⚠️ place-of-supply override no UI. ✅ tax invoice / bill of supply auto. ✅ tenders cash/UPI/card/other/credit, split tender, change on cash only, credit limit check. ✅ register sessions: float, cash in/out, safe drop, X/Z, blind close. ⚠️ denomination count contract-only. ✅ hold/park. ✅ numbering PREFIX/YYYY/000001 per terminal per FY; ⚠️ no custom series UI. ✅ returns/credit notes (partial, reasons, refund cash/UPI/card/account), whole-bill cancel via credit note. ✅ sales list. ❌ edit posted bill; ❌ customer price list; ❌ invoice due date/payment terms on A4; ❌ shipping charges/adjustment line on sale; ❌ salesperson; ❌ custom fields; ❌ attachments.

## 5 Printing
✅ 10 templates (minimal, classic, modern, compact-gst, bold, elegant, creative, bharat Hindi+EN, thermal-80, thermal-58). ✅ branding: accent, logo, signature, signatory, terms, bank details, footer, A4/A5/Letter. ✅ print fields incl HSN, tax split, amount in words. ❌ UPI/payment QR, e-invoice QR/IRN (columns only), MRP column, due date. ✅ preview/print/PDF — sales only. ✅ thermal ESC/POS: network 9100, Windows spooler, simulator; text/raster; 32/42/48 cols; drawer kick; print queue; DUPLICATE reprints. ⚠️ ₹/Hindi only in raster via Windows spooler. ✅ credit note thermal. ❌ print debit notes, payment receipts, purchase docs, statements as PDF document. ❌ template designer/custom fields on template, multiple copies (original/duplicate/triplicate labels on A4).

## 6 Document types
✅ tax invoice, bill of supply, credit note, purchase, debit note, payment/receipt, expense, journal, GST set-off, GST payment. ⚠️ delivery challan enum only (📝 FR-087). 📝 estimates/quotes (FR-086). ❌ proforma, recurring (📝 FR-097), sales orders, purchase orders, GRN, retainer/advance invoice, self-invoice.

## 7 Parties
✅ customer: name, phone, email, GSTIN, state, address line 1, city, PIN, credit days, credit limit. ✅ supplier + tax scheme. ✅ opening balance. ✅ ledger/statement with export. ✅ ageing buckets (not due/0-30/31-60/61-90/90+/advance). ✅ credit-limit check, write-off. ✅ DPDP consent per purpose/channel, export, erase. ✅ party import (new). ❌ multiple/shipping addresses, contact persons, customer portal, refund customer advance, party groups, credit-period interest.

## 8 Purchases/expenses
✅ purchase entry (bill no/date, due date, lines w/ ITC eligible, bill discount, landed-cost charges, total check, CSV line import). ✅ purchase return→debit note, cancel purchase. ⚠️ reverse charge refused. ✅ expenses: 8 fixed categories, paid-by modes, vendor GSTIN, ITC. ❌ custom expense categories, recurring expenses, mileage, bill of entry/imports, debit note cancel, TDS/TCS (📝 FR-098), purchase orders.

## 9 Payments
✅ in/out, methods cash/UPI/card/bank/cheque/other, auto (oldest-first) or manual allocation, advances, allocate credits, cancel. ❌ cheque clearing/PDC, bank reconciliation/statement import (📝 FR-094), payment links/gateways (📝 FR-095), payment receipt print.

## 10 Inventory
✅ stock list, product ledger, adjustments w/ reasons, stock take, opening stock import, moving weighted average valuation, low stock, negative stock policy (no UI), stock reconciliation view. ⚠️ warehouses: one per branch, no UI (📝 FR-093). ⚠️ batch/expiry schema-only (📝 FR-091). ❌ serials, transfers, BOM/manufacturing, job work, FIFO/other valuation methods, reorder suggestions/PO generation.

## 11 Accounting
✅ seeded COA, add/rename accounts, auto posting, account ledger, cash/bank/day book, manual journal + reversal, TB, P&L, BS w/ branch filter, monthly period lock/unlock, late postings, year-end close. ❌ multi-company, cost centres, budgets/scenarios, cash flow/funds flow, ratio analysis, interest calc, multi-currency (INR only), reporting tags.

## 12 GST
✅ engine CGST/SGST/UTGST/IGST/cess, composition→bill of supply, nil/exempt/non-GST/zero, B2CL threshold. ✅ GST Returns screen monthly: GSTR-1 sections B2B/B2CL/B2CS/CDNR/CDNUR/EXP/EXEMP/HSN/DOCS as CSV (offline-tool format)/XLSX/PDF; GSTR-3B summary; ITC register; missing HSN. ✅ GST set-off, challan payments (CPIN/CIN). ❌ GSTR-1 JSON, 2A/2B reconciliation, GSTR-9, IMS, CMP-08. 📝 direct filing (FR-092), e-invoice (FR-089), e-way bill (FR-090). ⚠️ reverse charge refused. ❌ LUT/export workflow, SEZ, multi-GSTIN.

## 13 Reports (all CSV/XLSX/PDF export + print; range+branch filter)
Accounts: TB, P&L, BS, General ledger, Cash/Bank/Day book. Sales: by day, monthly, by product, by category, by payment method, product profit, credit notes, Z reports, sales register. Purchases, Expenses, Payments, Cash report. Stock valuation, stock movement. Receivables/Payables ageing, customer/supplier ledger. GST: 10 GSTR-1 sections, 3B, ITC register, missing HSN. Lists: products, customers, suppliers, COA. ❌ scheduled/emailed reports, custom report builder, comparative periods, saved filters, drill-down to voucher (verify), sales by customer/salesperson, tax summary by rate, inventory ageing, dead stock, reorder report.

## 14 Dashboard/notifications/help
✅ dashboard Today/Week/Month with KPIs and charts. ✅ in-app notifications (low stock, overdue, supplier due, sync, backup, audit chain, review items, update). ❌ OS notifications. 📝 SMS/WhatsApp reminders (FR-088; only consent). ❌ global search (FR-073), attachments (FR-075). ✅ 12-step tour (EN), in-app manual EN/HI.

## 15 Sharing/integrations/platforms
📝 WhatsApp/email sharing (FR-085) — only Save-as-PDF. ❌ payment gateways, UPI collect, customer portal, weighing scale, mobile app (📝 FR-096), web app, AI assistant, API/webhooks for users, Tally export, marketplace/integrations, multi-currency.

## 16 Sync/cloud/backup/audit
✅ offline-first sync w/ Go cloud, conflicts, review items. ⚠️ /reports/daily API only (no web view). ✅ operator admin console. ✅ encrypted backups (schedule, retention 7/4/3, cloud upload w/ key escrow, verify, restore). ✅ hash-chained audit log + verify. ⚠️ no audit-log viewer (edit log browsing). ✅ diagnostics, crash reports, auto-update channels.

## 17 UX
✅ POS keys F2 search, F3 customer, F4 bill discount, F5 pay, F6 hold, F7 held, F9 reprint, Esc, Enter. ❌ shortcuts outside POS, configurable keys. ✅ light/dark. ⚠️ UI English only (Hindi in help, bharat template, raster receipts).

Note: earlier docs/competitive-audit.md overstated ₹/Indic thermal (only raster+spooler) and "GSTR JSON groundwork" (no JSON export).
