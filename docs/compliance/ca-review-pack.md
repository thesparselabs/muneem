# Muneem — CA review pack: GST computation, returns and accounting entries

**Prepared:** 5 October 2026 (Stage 9h), for review by a practising Chartered Accountant before the pilot with five shops.
**Asked of the reviewer:** read sections 1–8, answer each question in section 9, and sign section 11.

## 1. Purpose and scope

Muneem is billing and accounting software for small Indian retail shops (kiranas, garments, electricals, sweet shops). It
runs on the shop's computer, works without the internet, and keeps a copy in the cloud. Every sale, return, purchase and
expense it records also writes a double-entry journal, and the GST returns are read from the same documents.

This pack sets out, in plain terms, **how Muneem calculates GST on a bill, which return table each figure lands in, and
which accounts each document debits and credits**, so that a CA can confirm the treatment is acceptable or tell us what to
change. Where we had to make a choice the law leaves open, or where we depart from our own design, section 9 asks you to
confirm it.

**In scope:**
- regular-scheme businesses supplying goods: tax invoices to registered (B2B) and unregistered (B2C) customers, within the
  state (CGST + SGST/UTGST) and across states (IGST), with compensation cess;
- composition-scheme businesses: bills of supply with no tax;
- exempt, nil-rated and non-GST items, alone or mixed with taxable items on one bill;
- tax-inclusive (MRP) and tax-exclusive prices, line and bill discounts, rounding and round-off;
- credit notes (part returns, full returns, cancellations) against B2B, B2CL and B2CS invoices;
- purchases with input tax credit (ITC) eligible or blocked, freight on purchases, debit notes to suppliers;
- expenses with and without ITC;
- GSTR-1 tables 4A, 5, 7, 8, 9B, 12 and 13; GSTR-3B tables 3.1, 4 and 5; the ITC register;
- the monthly set-off of output tax against ITC, payment by challan, and the year-end close.

**Not supported (the software refuses or does not produce these):** reverse-charge purchases (refused at entry),
e-invoicing (IRN) and e-way bills, TDS/TCS, GSTR-4 and CMP-08 for composition dealers, GSTR-2B matching, interest and late
fees, services-specific place-of-supply rules, batch and expiry tracking. Pilot shops are chosen so they do not need these.

**Companion documents (all in this repository):**
- [`scenario-workbook.md`](scenario-workbook.md) — twelve worked business days, with every bill line, return table and
  journal. Every number quoted below comes from it.
- [`posting-tables.md`](posting-tables.md) — every accounting rule as a table, **generated from the program's own rules**, so
  it cannot differ from what the software posts.
- [`../accounting/posting-matrix.md`](../accounting/posting-matrix.md) — the same rules in narrative form, with the reason for
  each departure from our design.
- Decision records [ADR-0023](../decisions/0023-purchase-invoice-and-landed-cost.md) (purchases),
  [ADR-0032](../decisions/0032-posting-matrix-as-built.md) (posting matrix),
  [ADR-0043](../decisions/0043-returns-and-credit-notes.md) (credit notes),
  [ADR-0044](../decisions/0044-gst-returns-and-set-off.md) (returns and set-off),
  [ADR-0045](../decisions/0045-year-end-close.md) (year end).

**How the numbers are checked.** The twelve scenarios were worked out by hand first. The software's two calculation engines —
one on the shop's computer, one on the server, which re-checks every bill a shop uploads — must reproduce them to the paisa,
and the test suite also proves, for every scenario, that the HSN summary equals the sum of the invoice lines, that the GSTR-1
totals equal the invoices less the credit notes, and that each return figure equals the movement on the matching tax account
in the books. Item rates in the examples are illustrative: rates come from each shop's product list, never from the program.

## 2. How the tax on a bill is calculated

All amounts are held in whole paise and quantities to three decimals (0.001 kg). Rounding is **half-up** (₹0.005 and above
rounds up) and happens **on each line**, never on the invoice total. The steps, in order:

1. **Supply type.** Place of supply equal to the shop's state → intra-state (CGST + SGST, or UTGST in a Union Territory
   without a legislature); otherwise inter-state (IGST). Place of supply defaults to the customer's state, else the shop's;
   the cashier can change it (scenario 03 ships to Maharashtra and Haryana).
2. **Line value.** Quantity × price, rounded to the paisa (2.5 g of gold at ₹7,123.45/g = ₹17,808.625 → ₹17,808.63).
3. **Tax-inclusive prices** (MRP) are converted to a taxable value: *(price − any per-unit cess) ÷ (1 + GST rate + ad valorem
   cess rate)*. Soap at MRP ₹45 × 3 = ₹135.00 → taxable ₹114.41, GST ₹20.59 (₹10.30 + ₹10.29), total exactly ₹135.00.
4. **Line discount** comes off the taxable value.
5. **Bill discount** is spread over the lines in proportion to their value after line discounts (largest-remainder
   method, so the shares add up to the discount exactly), **before** tax. Scenario 07: 10% off a ₹5,061.91 bill = ₹506.19,
   shared ₹185.29 / ₹284.90 / ₹36.00 across shirts (5%), jeans (18%) and socks (5%).
6. **Tax per line.** GST = taxable × rate, rounded. CGST = taxable × half the rate, rounded; **SGST = GST − CGST**, so the two
   halves always add back to the line's tax (one may be a paisa more than the other). Cess = taxable × cess rate, rounded,
   plus quantity × any per-unit cess. Exempt, nil-rated and non-GST lines, and every line of a composition dealer, carry no
   tax.
7. **Totals** are the sums of the lines.
8. **Round-off** (a per-business setting): the total is rounded to the nearest rupee (₹x.50 rounds up) and the difference is
   shown on the bill and posted to *4900 Round Off* — never to sales or tax.

**Why line-level rounding matters** (scenario 06): three notebooks at ₹10.25 at 5% carry ₹0.51 tax each (₹0.26 CGST +
₹0.25 SGST), ₹1.53 in all; working on the invoice total would give ₹1.54. Line-level rounding is what the buyer's books
and the GST portal see line by line.

**Cess** (scenario 08). Cigarettes at MRP ₹150 a pack with 28% GST, 5% cess and ₹10-a-pack cess: two packs = ₹300.00;
less ₹20.00 per-unit cess = ₹280.00 ÷ 1.33 = taxable ₹210.53; GST ₹58.95 (₹29.47 + ₹29.48); cess ₹10.53 + ₹20.00 = ₹30.53;
line total ₹300.01. Cola at MRP ₹40 with 28% GST and 12% cess: ₹120.00 ÷ 1.40 = ₹85.71 + GST ₹24.00 + cess ₹10.29 = ₹120.00.

**Composition dealers** (scenario 04) issue a **bill of supply**: the same steps with no tax at all, titled "BILL OF
SUPPLY", with the words *"Composition taxable person, not eligible to collect tax on supplies"* printed at the top (CGST
Rules, rule 5(1)(g)). They claim no ITC: GST on their purchases is added to the cost of the goods (₹2,100 of sugar + ₹105 tax
= stock at ₹2,205). Nothing of theirs appears in GSTR-1 or GSTR-3B.

**Which GSTR-1 group a bill belongs to** (decided when the bill is saved):

| Bill | Group |
|---|---|
| Customer has a GSTIN | B2B |
| No GSTIN, inter-state, invoice value **above** the B2CL limit (₹1,00,000, a dated setting) | B2CL |
| Every line exempt / nil-rated / non-GST | that treatment (reported in table 8) |
| Any other bill to an unregistered customer | B2CS |
| Composition or unregistered business | not reported |
| Credit note | CDNR if the customer has a GSTIN, else CDNUR (but see table 9B below) |

Scenario 03: an invoice that works out to ₹1,00,000.01 rounds to ₹1,00,000.00 and stays in B2CS, because it is not *above*
the limit; ₹1,06,400 to Maharashtra is B2CL.

## 3. GSTR-1: where each figure goes

Each **line** is placed by its own treatment first, then by the bill's group (ADR-0044):

| GSTR-1 table | What goes in | Example (scenario) |
|---|---|---|
| 4A B2B | taxable lines of B2B bills, one row per invoice and rate | 02: Mehta Stores, ₹4,233.00, rows at 5% / 12% / 18% |
| 5 B2CL | taxable lines of B2CL bills, per invoice and rate | 03: ₹1,06,400 lamp to Maharashtra |
| 7 B2CS | taxable lines of B2CS bills, per place of supply and rate, **net of credit notes against B2CS bills** | 01: Delhi 5% ₹500.00, 18% ₹208.19 |
| 8 Nil/exempt/non-GST | every nil-rated, exempt and non-GST line, even on a B2B or B2CS bill, split inter/intra-state and registered/unregistered | 05: diesel ₹4,500 and milk ₹280 on a B2B bill go to "intra-state, registered" |
| 9B CDNR | credit notes against B2B invoices | 09: ₹2,183.00 and ₹7,717.00 to Bright Builders |
| 9B CDNUR | credit notes against B2CL invoices (type B2CL) and exports | 09: ₹21,830 against the UP fan invoice |
| 12 HSN summary | every reported line, net of credit notes, by B2B/B2C, HSN, unit (UQC) and rate | 06: gold 2.5 GMS, ₹18,342.89 |
| 13 Documents issued | first and last number of each invoice and credit-note series in the month; gaps counted as cancelled | 09: invoices 3, credit notes 4 |

A zero-rated line is reported with its bill (exports, or B2B at rate 0). Exports without IGST are type WOPAY.

**Checks the software makes for every month:** HSN summary = Σ invoice lines − Σ credit-note lines (taxable, each tax,
quantity); GSTR-1 = Σ invoices − Σ credit notes; GSTR-3B 3.1 output tax = the month's movement on each output tax account;
GSTR-3B 4C = the month's movement on each input tax account.

## 4. GSTR-3B

| Table | Source |
|---|---|
| 3.1(a) | taxable lines (not zero-rated), net of credit notes |
| 3.1(b) | zero-rated lines |
| 3.1(c) | nil-rated and exempt lines |
| 3.1(d) | always zero: reverse charge is not supported |
| 3.1(e) | non-GST lines |
| 4A(5) | eligible ITC on purchases and on expenses with a GSTIN |
| 4B(2) | ITC reversed: debit notes and cancelled purchases or expenses, in the month the reversal posts |
| 4C | 4A − 4B |
| 4D(2) | tax on purchase lines or expenses marked "ITC not eligible" (e.g. section 17(5)) |
| 5 | purchases from composition suppliers and nil/exempt purchase lines; non-GST purchase lines (expenses left out) |

Scenario 10: 4A IGST ₹760.00, CGST ₹268.00, SGST ₹268.00; 4B CGST ₹28.00, SGST ₹28.00 (oil returned); 4C IGST ₹760.00,
CGST ₹240.00, SGST ₹240.00; 4D CGST ₹102.50, SGST ₹102.50 (gift hampers ₹180 less ₹90 returned, plus a ₹12.50 staff meal);
table 5 intra-state ₹5,000 from a composition dairy.

**ITC rules as built.** ITC is claimed only when both the supplier and the shop are on the regular scheme; any line can be
marked "not eligible". Tax that cannot be claimed becomes part of the goods' cost (purchases) or of the expense. A purchase
counts in the month of the **supplier's bill date**, not the date it is entered.

## 5. Set-off (monthly)

At the end of each month, a set-off document moves output tax against ITC in the order the law allows (CGST Act s.49 and
rule 88A):

1. **IGST credit** — first against IGST; then against whatever CGST and SGST their own credit cannot cover (CGST first,
   then SGST); then any CGST, then SGST left.
2. **CGST credit** — against CGST, then IGST. Never against SGST.
3. **SGST/UTGST credit** — against SGST, then IGST. Never against CGST.
4. **Cess credit** — only against cess.
5. What credit cannot cover is moved to *2300 GST Payable* and paid by challan.

Scenario 11 (October): liability IGST ₹50, CGST ₹104, SGST ₹104, cess ₹12; credit IGST ₹120, CGST ₹27, SGST ₹27, cess ₹6.
IGST credit pays IGST ₹50 and CGST ₹70; CGST credit pays CGST ₹27; SGST credit pays SGST ₹27; cess credit pays cess ₹6.
Cash payable: CGST ₹7, SGST ₹77, cess ₹6 = ₹90, paid by challan on 18 November.

| Dr | Cr | Account |
|---:|---:|---|
| 50.00 | | 2230 Output IGST |
| 104.00 | | 2210 Output CGST |
| 104.00 | | 2220 Output SGST/UTGST |
| 12.00 | | 2240 Output Cess |
| | 27.00 | 1510 Input CGST |
| | 27.00 | 1520 Input SGST/UTGST |
| | 120.00 | 1530 Input IGST |
| | 6.00 | 1540 Input Cess |
| | 90.00 | 2300 GST Payable |

The challan then posts Dr 2300 GST Payable ₹90, Cr 1200 Bank ₹90. A set-off never touches customers, suppliers or stock,
and is refused for a month that is locked (filed).

## 6. How each document posts

The full rule for every document is in [`posting-tables.md`](posting-tables.md); the worked examples below come from the
scenarios. Account numbers are from the standard chart Muneem sets up for every shop.

**Sale** (scenario 01, bill T1/2627/00001): atta 2 × ₹250 at 5% (CGST ₹12.50 + SGST ₹12.50) and soap 3 × ₹35.50 at 18%
(₹19.17 = ₹9.59 + ₹9.58); ₹650.67 rounded to ₹651.00, paid in cash; cost of the goods ₹515.

| Dr | Cr | Account |
|---:|---:|---|
| 651.00 | | 1100 Cash in Hand (card and UPI go to 1250 Card/UPI Settlement Clearing; credit to 1300 Accounts Receivable) |
| | 606.50 | 4100 Sales — Goods (net of all discounts) |
| | 22.09 | 2210 Output CGST |
| | 22.08 | 2220 Output SGST/UTGST |
| | 0.33 | 4900 Round Off |
| 515.00 | | 5100 Cost of Goods Sold (moving average cost) |
| | 515.00 | 1400 Inventory |

**Credit note** (scenario 09). Cancelling a ₹350.00 walk-in bill (₹297.00 + ₹26.73 + ₹26.73, rounded down by ₹0.46),
refunded in cash: Dr Sales 297.00, Dr Output CGST 26.73, Dr Output SGST 26.73, Cr Round Off 0.46, Cr Cash 350.00; and the
bulbs back into stock at what they cost, Dr Inventory 180.00, Cr COGS 180.00. A part return carries no round-off; the
note that completes a bill takes back the bill's round-off, so a bill returned in parts nets to exactly zero (CN1 + CN4
against Bright Builders: ₹2,183.00 + ₹7,717.00 = ₹9,900.00, which clears what the builder owed).

**Purchase** (scenario 10, bill DFD/1021): oil ₹2,800 at 5%, soap ₹1,200 at 18%, gift hampers ₹2,000 at 18% with ITC blocked
(staff gifts, s.17(5)), freight ₹600 spread by value (₹280 / ₹120 / ₹200), and the supplier's bill 50 paise above our total.

| Dr | Cr | Account |
|---:|---:|---|
| 6,960.00 | | 1400 Inventory (oil 3,080 + soap 1,320 + hampers 2,560, which include their ₹360 blocked tax) |
| 178.00 | | 1510 Input CGST |
| 178.00 | | 1520 Input SGST/UTGST |
| 0.50 | | 4900 Round Off (bill total − our total, accepted within ±₹1) |
| | 7,316.50 | 2100 Accounts Payable (Delhi Foods Distributors) |

**Debit note** (scenario 10): 8 of 20 oil and 1 of 2 hampers go back; the supplier keeps the freight. Dr AP 2,356.00, Dr 5110
Purchase-return Losses 212.00 (the freight share), Cr Inventory 2,512.00 (the goods at their purchase cost), Cr Input CGST
28.00, Cr Input SGST 28.00 (the oil's claimed tax; the hamper's was never claimed).

**Expense** (scenario 10): an AC repair from a Haryana firm, ₹2,360 including 18%, on credit: Dr 5450 Repairs 2,000.00, Dr
Input IGST 360.00, Cr AP 2,360.00. A staff meal with blocked ITC: Dr 5900 Other Expenses 525.00, Cr Cash 525.00.
Electricity from a supplier without a GSTIN: Dr 5420 Electricity 3,500.00, Cr Cash 3,500.00.

**Other documents** (rules in [`posting-tables.md`](posting-tables.md)): customer receipts and supplier payments, write-offs,
opening stock and party opening balances, stock adjustments, register over/short, cash in and out of the drawer, GST
payment.

## 7. Year end

On 31 March each income and expense account is closed to *3300 Retained Earnings* in one closing journal, numbered
`CL/2526` for FY 2025-26. Scenario 12 (a profit of ₹3,073.27):

| Dr | Cr | Account |
|---:|---:|---|
| 45,248.50 | | 4100 Sales — Goods |
| | 0.23 | 4900 Round Off |
| | 36,175.00 | 5100 Cost of Goods Sold |
| | 5,000.00 | 5400 Rent |
| | 1,000.00 | 5440 Internet |
| | 3,073.27 | 3300 Retained Earnings |

The close needs every month of the year locked and, for a regular-scheme shop, the last month with GST activity set off
(March's ITC of ₹142.63 CGST and ₹142.64 SGST is carried forward). Balance-sheet accounts carry on without an opening
journal, and a closed year's Profit and Loss still reads as it did before the close.

## 8. What this review found and changed

1. **Per-unit cess on MRP items was charged on top of the MRP** (fixed). A ₹150 pack carrying ₹10 per-unit cess billed
   ₹160.00 because only the ad valorem cess was taken out of the tax-inclusive price. The per-unit cess is now taken out
   first (section 2, step 3), so the bill totals the MRP.
2. **The composition declaration printed at the bottom of the bill of supply** (fixed). Rule 5(1)(g) asks for it at the
   top; it now prints directly under the title.
3. **Zero rows after full returns** (not changed; question C6). When every invoice in a B2CS rate group is returned, the
   B2CS table and the HSN summary keep a row of zeros.

## 9. Questions for the CA

For each question, tick one answer. "Current" is what the software does today; a "No" means we change it before the pilot.

### A. GST returns (ADR-0044)

| # | Question | Current | Answer |
|---|---|---|---|
| A1 | A document is reported in the month its journal posted. A bill dated in a month already filed (locked) is reported in the next open month's return, with its own invoice date. Acceptable? | Yes, next open month | ☐ Yes ☐ No: |
| A2 | Credit notes against B2CS invoices are netted into B2CS (table 7) as negatives in the same state and rate, and against exports into CDNUR type EXPWOP/EXPWP. Acceptable? | Netted | ☐ Yes ☐ No: |
| A3 | A credit note that cancels a whole bill does not make the invoice "cancelled" in table 13: the invoice was issued and is reported, and the note reverses it. Acceptable? | Not cancelled | ☐ Yes ☐ No: |
| A4 | Ineligible ITC is shown in 4D(2). Or should it be shown in 4A and reversed in 4B(1)? | 4D(2) | ☐ 4D(2) ☐ 4A + 4B(1) |
| A5 | GSTR-3B table 5 leaves out expenses (an expense does not record why it was untaxed), and purchase debit notes are not counted in table 13. Acceptable? | Left out | ☐ Yes ☐ No: |
| A6 | IGST credit is used up on CGST/SGST before CGST/SGST credit, even when that leaves CGST/SGST credit unused (rule 88A). Acceptable? | IGST first | ☐ Yes ☐ No: |
| A7 | IGST credit left after IGST is applied first to the CGST that CGST credit cannot cover, then to SGST. Scenario 11 pays CGST ₹7 and SGST ₹77 in cash; an equal split would pay ₹42 and ₹42. Which? | CGST shortfall first | ☐ CGST first ☐ Equal split ☐ Other: |
| A8 | The HSN summary includes nil-rated, exempt **and non-GST** lines (scenario 05: diesel). Should non-GST lines be left out of table 12? | Included | ☐ Keep ☐ Leave non-GST out |

### B. Departures in the posting matrix (◆ rows)

| # | Question | Current | Answer |
|---|---|---|---|
| B1 | A credit note reverses revenue in 4100 Sales itself, not a separate Sales Returns account, so the P&L shows net sales. Acceptable? | 4100 | ☐ Yes ☐ Use a Sales Returns account |
| B2 | Only the note that completes a full return takes back the bill's round-off; part returns carry none. Acceptable? | Last note | ☐ Yes ☐ No: |
| B3 | On a debit note, freight the supplier keeps goes to 5110 Purchase-return Losses, and goods leave stock at their purchase (landed) cost, not the moving average. Acceptable? | 5110, landed cost | ☐ Yes ☐ No: |
| B4 | Customer receipts post wholly to 1300 Accounts Receivable; an advance is a credit balance on the customer, shown as "Advances from customers" on the Balance Sheet, rather than 2400. Acceptable? | 1300 | ☐ Yes ☐ Use 2400 |
| B5 | Write-offs go to 5470 Bad Debts. Acceptable? | 5470 | ☐ Yes ☐ No: |
| B6 | Opening stock and party opening balances post against 3400 Opening Balance Equity. Acceptable? | 3400 | ☐ Yes ☐ No: |
| B7 | Cost corrections (stock sold before it was received, re-costed later) move value between 1400 Inventory and 5100 COGS. Acceptable? | 1400 / 5100 | ☐ Yes ☐ No: |
| B8 | Cash put into or taken out of the drawer without a document waits in 1199 Cash to classify until the accountant reclassifies it. Acceptable? | 1199 | ☐ Yes ☐ No: |
| B9 | The GST set-off is its own document, posted on the month's last day, clearing each output account in full against the credit used and 2300 GST Payable. Acceptable? | As in section 5 | ☐ Yes ☐ No: |
| B10 | The year-end closing journal is dated 31 March inside the locked March, numbered `CL/2526`; there is no opening journal; a late document reaching a closed year gets an adjusting closing journal `CL/2526/2`. Acceptable? | As in section 7 | ☐ Yes ☐ No: |

### C. How tax is computed

| # | Question | Current | Answer |
|---|---|---|---|
| C1 | Tax is rounded on each line (half-up), CGST is half the rate rounded and SGST is the rest. Acceptable? | Per line | ☐ Yes ☐ Per invoice |
| C2 | Every discount — line or bill, including the POS "F4" discount — is given before tax and reduces the taxable value (s.15(3)(a)); a bill discount is spread over all lines by value, **including exempt and non-GST lines**. Acceptable? | All pre-tax, all lines | ☐ Yes ☐ Taxable lines only ☐ Other: |
| C3 | A tax-inclusive price includes any per-unit cess; the taxable value is (price − per-unit cess) ÷ (1 + GST rate + cess rate). Acceptable? | As stated | ☐ Yes ☐ No: |
| C4 | Round-off to the nearest rupee (₹x.50 up) is optional per shop and posts to 4900 Round Off (an income account); a purchase bill's total is accepted within ±₹1 of ours, the difference also to 4900. Acceptable? | 4900 | ☐ Yes ☐ No: |
| C5 | B2CL is decided on the invoice value **after** round-off and only when it is strictly above the limit. Acceptable? | After round-off, above | ☐ Yes ☐ No: |
| C6 | Rows that net to zero after full returns stay in B2CS and the HSN summary (and in the CSV export). Drop them? | Kept | ☐ Keep ☐ Drop |
| C7 | A purchase's ITC belongs to the month of the supplier's bill date (also its posting date). Acceptable? | Bill date | ☐ Yes ☐ Date received |

### D. Composition, reverse charge

| # | Question | Current | Answer |
|---|---|---|---|
| D1 | A composition dealer's bill of supply carries, at the top, exactly: *"Composition taxable person, not eligible to collect tax on supplies"*. Is the wording and position right? | Under the title | ☐ Yes ☐ Change to: |
| D2 | A composition dealer's **credit note** does not carry the declaration. Should it? | No | ☐ No ☐ Yes |
| D3 | Composition dealers get no GSTR-4 or CMP-08 figures, so pilot shops must be on the regular scheme. Acceptable for the pilot? | Not produced | ☐ Yes ☐ No |
| D4 | Reverse-charge purchases are refused rather than recorded, so pilot shops must not need them (3.1(d) is always zero). Acceptable for the pilot? | Refused | ☐ Yes ☐ No |

## 10. Known limits the reviewer should be aware of

- **Two devices setting off the same month offline** both stand; Muneem flags the duplicate for review. Shops are told to
  set off from one device, online, after filing.
- **Card/UPI settlement** (Dr Bank, Dr Bank Charges, Cr Clearing) is a manual journal for now, so 1250 grows until it is
  settled.
- **Services:** the place-of-supply rules for services are not modelled; pilot shops sell goods.
- **Rates and the B2CL limit** come from settings with effective dates, so a rate notification needs no new software.

## 11. Sign-off

I have reviewed this pack, the scenario workbook and the posting tables, and record my answers above and below.

| | |
|---|---|
| Name | |
| Membership no. (ICAI) | |
| Firm and FRN | |
| Date | |
| Scope reviewed | ☐ Sections 1–8 ☐ Scenario workbook ☐ Posting tables ☐ Other: |
| Opinion | ☐ Acceptable as built ☐ Acceptable with the changes marked in section 9 ☐ Not acceptable (reasons attached) |
| Signature | |

**Answers summary** (copy from section 9):

| Question | Answer | Note |
|---|---|---|
| A1 | | |
| A2 | | |
| A3 | | |
| A4 | | |
| A5 | | |
| A6 | | |
| A7 | | |
| A8 | | |
| B1 | | |
| B2 | | |
| B3 | | |
| B4 | | |
| B5 | | |
| B6 | | |
| B7 | | |
| B8 | | |
| B9 | | |
| B10 | | |
| C1 | | |
| C2 | | |
| C3 | | |
| C4 | | |
| C5 | | |
| C6 | | |
| C7 | | |
| D1 | | |
| D2 | | |
| D3 | | |
| D4 | | |
