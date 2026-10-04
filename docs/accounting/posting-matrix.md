# Posting matrix — as built (for CA review)

This lists every journal Muneem posts, one table per document. It is the reference for the rules in
`packages/domain/src/accounting/rules.ts` (ADR-0032), and each worked example is pinned by a unit test in
`packages/domain/test/accounting.test.ts`. Rows marked **◆** depart from LLD §5.2 or add to it; the reason is given
under the table.

**How to read it:**
- Amounts are rupees. Lines with a zero amount are not posted.
- A **signed** amount (round-off, corrections) moves to the other side when negative.
- Account codes are from the seeded chart (ADR-0031). UTGST posts to the SGST accounts.

**Which account money moves through:**
- **Sale tenders:** cash → 1100 Cash in Hand; UPI, card and other → 1250 Card/UPI Settlement Clearing.
- **Payments and expenses:** cash → 1100; UPI, card, bank, cheque and other → 1200 Bank Accounts.

## Sale

| Dr | Cr | Amount |
|---|---|---|
| 1100 Cash / 1250 Clearing | | takings by method, cash net of change |
| 1300 AR (customer) | | credit portion |
| | 4100 Sales — Goods | taxable value, net of all discounts |
| | 2210 / 2220 / 2230 / 2240 Output CGST / SGST / IGST / Cess | tax by head |
| | 4900 Round Off | round-off (signed) |
| 5100 COGS | 1400 Inventory | Σ line COGS at moving average |

*Example:* ₹1,000 taxable + 9% CGST + 9% SGST = ₹1,180, rounded to ₹1,179.60. The customer pays ₹500 cash, ₹300 UPI
and ₹379.60 on credit; COGS is ₹700.
- **Debits:** Cash 500, Clearing 300, AR 379.60, Round Off 0.40, COGS 700.
- **Credits:** Sales 1,000, Output CGST 90, Output SGST 90, Inventory 700.

## Credit note (sale return or cancel) ◆

| Dr | Cr | Amount |
|---|---|---|
| 4100 Sales — Goods ◆ | | the returned lines' taxable value |
| 2210 / 2220 / 2230 / 2240 Output CGST / SGST / IGST / Cess | | tax by head, each line's share of the sale line's own tax |
| 4900 Round Off | | the sale's round-off (signed), only on the note that completes a full return |
| | 1300 AR (customer) | the part that settles what the customer still owes on the bill, or all of it when credited to the account |
| | 1100 Cash / 1250 Clearing | the rest, refunded in cash, or by UPI or card |
| 1400 Inventory | 5100 COGS | the goods back at what they cost when sold: each line's share of the sale line's COGS |

*Example:* the whole of the sale above comes back after the customer has paid ₹79.60 of the ₹379.60 owed. ₹300
settles the rest of the bill and ₹879.60 is refunded in cash.
- **Debits:** Sales 1,000, Output CGST 90, Output SGST 90, Inventory 700.
- **Credits:** Round Off 0.40, Cash 879.60, AR 300, COGS 700.

◆ The return reverses revenue in 4100 itself rather than a separate Sales Returns account, so the P&L shows net sales.
A part return carries no round-off; the note that completes a full return takes back the sale's, so a bill returned
in any number of parts nets to exactly zero (ADR-0043). Cancelling a sale is the same journal for the whole bill.

## Purchase invoice

| Dr | Cr | Amount |
|---|---|---|
| 1400 Inventory | | landed cost: taxable + freight/charges + tax that cannot be claimed (ADR-0023) |
| 1510 / 1520 / 1530 / 1540 Input tax | | claimable tax by head |
| 4900 Round Off | | bill total − computed total (signed, at most ±₹1) |
| | 2100 AP (supplier) | the bill total |

*Example:* ₹1,000 + 2.5% CGST + 2.5% SGST + ₹100 freight, with a bill 50 paise higher.
- **Debits:** Inventory 1,100, Input CGST 25, Input SGST 25, Round Off 0.50.
- **Credit:** AP 1,150.50.

## Debit note (goods returned to the supplier) ◆

| Dr | Cr | Amount |
|---|---|---|
| 2100 AP (supplier) | | what the supplier owes back: taxable + tax (+ freight, if refunded) + round-off |
| 5110 Purchase-return Losses ◆ | | the returned goods' freight share the supplier keeps |
| | 1400 Inventory | the goods' landed cost (not the moving average, ADR-0024) |
| | 1510–1540 Input tax | claimed tax reversed, by head |
| | 4900 Round Off | the bill's round-off, only on the note that completes a full return |

*Example:* 2 of 20 bags go back, worth ₹100 + ₹2.50 + ₹2.50; their ₹10 freight share is not refunded.
- **Debits:** AP 105, Purchase-return Losses 10.
- **Credits:** Inventory 110, Input CGST 2.50, Input SGST 2.50.

**Cancelling a purchase** posts the exact reversal of its journal, dated the day of the cancel.

## Customer receipt ◆

| Dr | Cr | Amount |
|---|---|---|
| 1100 Cash / 1200 Bank | | amount received |
| | 1300 AR (customer) | the whole amount, including any advance ◆ |

◆ LLD §5.2 credits the unallocated part to 2400 Advances from Customers. Muneem keeps it in 1300 as a credit
balance on the customer. The Balance Sheet presents customers with credit balances as advances, and an advance
applied later needs no second journal.

## Supplier payment

| Dr | Cr | Amount |
|---|---|---|
| 2100 AP (supplier) | | amount paid |
| | 1100 Cash / 1200 Bank | amount paid |

**Cancelling a receipt or a payment** posts the exact reversal of its journal.

## Write-off ◆

| Dr | Cr | Amount |
|---|---|---|
| 5470 Bad Debts ◆ | | amount written off |
| | 1300 AR (customer) | amount written off |

## Expense

| Dr | Cr | Amount |
|---|---|---|
| The category's account (5400–5900) | | the amount, plus any tax that cannot be claimed |
| 1510–1540 Input tax | | claimable tax by head |
| | 1100 Cash / 1200 Bank | the total, when paid |
| | 2100 AP (supplier) | the total, when on credit |

*Example:* an internet bill on credit: ₹100 + 9% + 9%.
- **Debits:** Internet 100, Input CGST 9, Input SGST 9.
- **Credit:** AP 118.

## Stock

| Document | Dr | Cr | Amount |
|---|---|---|---|
| Opening stock ◆ | 1400 Inventory | 3400 Opening Balance Equity | value received |
| Adjustment / stock take, loss | 5200 Shrinkage | 1400 Inventory | value at average cost |
| Adjustment / stock take, gain | 1400 Inventory | 4400 Inventory Gain | value at average cost |
| Cost correction ◆ (signed) | 1400 Inventory | 5100 COGS | the re-costing of units sold below zero (ADR-0018) |

Every amount is the stock movements' recorded value, so 1400 equals the inventory valuation.

## Opening balances ◆

| Party, side | Dr | Cr |
|---|---|---|
| Customer owes us | 1300 AR (customer) | 3400 Opening Balance Equity |
| Customer's advance | 3400 Opening Balance Equity | 1300 AR (customer) |
| We owe a supplier | 3400 Opening Balance Equity | 2100 AP (supplier) |
| Supplier owes us | 2100 AP (supplier) | 3400 Opening Balance Equity |

## Register and drawer

| Event | Dr | Cr |
|---|---|---|
| Close, cash over | 1100 Cash | 4300 Other Income |
| Close, cash short | 5900 Other Expenses | 1100 Cash |
| Cash in, no document ◆ | 1100 Cash | 1199 Cash to classify |
| Cash out, no document ◆ | 1199 Cash to classify | 1100 Cash |
| Safe drop | — | — (cash to cash, not posted) |

◆ The drawer does not know why cash went in or out, so it waits in 1199 with the reason as narration until the
accountant reclassifies it, for example to Drawings or an expense.

Cash that moves for a payment, an expense or a credit note's cash refund posts with that document, not here. A cash
refund lowers the register's expected cash like change given.

**Opening a register posts nothing.** The float comes from cash the business already holds, and 1100 is all the
business's cash, in the drawer and out of it. The cash a shop starts with is recorded once, as a manual journal:
Dr 1100 Cash, Cr 3400 Opening Balance Equity. Until it is, 1100 shows only what has moved since, and can read below
zero even though the drawer holds money.

## GST set-off ◆

| Dr | Cr | Amount |
|---|---|---|
| 2210 / 2220 / 2230 / 2240 Output CGST / SGST / IGST / Cess | | each head's balance at the month's last day, cleared in full |
| | 1510 / 1520 / 1530 / 1540 Input CGST / SGST / IGST / Cess | the credit used from each head, in the statutory order |
| | 2300 GST Payable | what credit could not cover, paid later by challan |

*Example:* output CGST 892.44, SGST 892.43 and cess 99.16 against input IGST 324.00 and cess 18.00. IGST credit pays
CGST first (the head its own credit cannot cover), cess credit pays cess, and the rest is payable.
- **Debits:** Output CGST 892.44, Output SGST 892.43, Output Cess 99.16.
- **Credits:** Input IGST 324.00, Input Cess 18.00, GST Payable 1,542.03.

◆ Posted on the month's last day, numbered `T1S/…`; it never touches AR, AP or Inventory (ADR-0035, ADR-0044).

## GST payment (challan)

| Dr | Cr | Amount |
|---|---|---|
| 2300 GST Payable | 1200 Bank | the challan's total; its heads are kept on the document |

## Not posted yet

- **Year end:** the closing and opening journals come in Stage 8. Until then, retained earnings are computed on the
  Balance Sheet.
- **Card/UPI settlement** (Dr Bank, Dr Bank Charges, Cr Clearing) is a manual journal.
- **Reverse-charge purchases** are refused (ADR-0023).
