# Posting tables (generated)

Generated from `packages/domain/src/accounting/rules.ts` by `pnpm --filter @muneem/domain gen:compliance`. Do not edit by hand:
`packages/domain/test/complianceDocs.test.ts` fails when this file and the rules differ. The narrative version, with the reasons
for each departure from the design, is `docs/accounting/posting-matrix.md`; the worked examples below are its examples, posted
through the real rules.

**How to read a table.** Each row is one journal line the rule can write. *Amount (fact)* names the field of the document the
amount comes from. A line whose amount is zero is not written, and a negative (signed) amount — round-off, a cost correction,
cash in or out — is written on the other side. Every journal must balance or it is refused.

## Which account money moves through

| Method | Sale tender | Payment, receipt or expense |
|---|---|---|
| cash | 1100 Cash in Hand | 1100 Cash in Hand |
| upi | 1250 Card/UPI Settlement Clearing | 1200 Bank Accounts |
| card | 1250 Card/UPI Settlement Clearing | 1200 Bank Accounts |
| bank | 1250 Card/UPI Settlement Clearing | 1200 Bank Accounts |
| cheque | 1250 Card/UPI Settlement Clearing | 1200 Bank Accounts |
| other | 1250 Card/UPI Settlement Clearing | 1200 Bank Accounts |

## Sale — `SALE_RULE`

| # | Side | Account | Amount (fact) | Only when | Party |
|---|---|---|---|---|---|
| 1 | Dr | 1100 Cash in Hand | `cashPaise` |  |  |
| 2 | Dr | 1250 Card/UPI Settlement Clearing | `clearingPaise` |  |  |
| 3 | Dr | 1300 Accounts Receivable | `creditPaise` |  | customer (by `customerId`) |
| 4 | Cr | 4100 Sales — Goods | `taxablePaise` |  |  |
| 5 | Cr | 2210 Output CGST | `tax.cgstPaise` |  |  |
| 6 | Cr | 2220 Output SGST/UTGST | `tax.sgstPaise` |  |  |
| 7 | Cr | 2230 Output IGST | `tax.igstPaise` |  |  |
| 8 | Cr | 2240 Output Cess | `tax.cessPaise` |  |  |
| 9 | Cr | 4900 Round Off | `roundOffPaise` |  |  |
| 10 | Dr | 5100 Cost of Goods Sold | `cogsPaise` |  |  |
| 11 | Cr | 1400 Inventory | `cogsPaise` |  |  |

*Worked example:* ₹1,000 taxable + 9% CGST + 9% SGST, rounded to ₹1,179.60; ₹500 cash, ₹300 UPI, the rest on credit; COGS ₹700.

| Dr | Cr | Account |
|---:|---:|---|
| 500.00 |  | 1100 Cash in Hand |
| 300.00 |  | 1250 Card/UPI Settlement Clearing |
| 379.60 |  | 1300 Accounts Receivable |
|  | 1,000.00 | 4100 Sales — Goods |
|  | 90.00 | 2210 Output CGST |
|  | 90.00 | 2220 Output SGST/UTGST |
| 0.40 |  | 4900 Round Off |
| 700.00 |  | 5100 Cost of Goods Sold |
|  | 700.00 | 1400 Inventory |

## Credit note (sale return or cancel) — `SALE_RETURN_RULE`

| # | Side | Account | Amount (fact) | Only when | Party |
|---|---|---|---|---|---|
| 1 | Dr | 4100 Sales — Goods | `taxablePaise` |  |  |
| 2 | Dr | 2210 Output CGST | `tax.cgstPaise` |  |  |
| 3 | Dr | 2220 Output SGST/UTGST | `tax.sgstPaise` |  |  |
| 4 | Dr | 2230 Output IGST | `tax.igstPaise` |  |  |
| 5 | Dr | 2240 Output Cess | `tax.cessPaise` |  |  |
| 6 | Dr | 4900 Round Off | `roundOffPaise` |  |  |
| 7 | Cr | 1100 Cash in Hand | `cashPaise` |  |  |
| 8 | Cr | 1250 Card/UPI Settlement Clearing | `clearingPaise` |  |  |
| 9 | Cr | 1300 Accounts Receivable | `creditPaise` |  | customer (by `customerId`) |
| 10 | Dr | 1400 Inventory | `costPaise` |  |  |
| 11 | Cr | 5100 Cost of Goods Sold | `costPaise` |  |  |

*Worked example:* The whole of that sale comes back after ₹79.60 of the credit was paid: ₹300 settles the bill, ₹879.60 is refunded in cash.

| Dr | Cr | Account |
|---:|---:|---|
| 1,000.00 |  | 4100 Sales — Goods |
| 90.00 |  | 2210 Output CGST |
| 90.00 |  | 2220 Output SGST/UTGST |
|  | 0.40 | 4900 Round Off |
|  | 879.60 | 1100 Cash in Hand |
|  | 300.00 | 1300 Accounts Receivable |
| 700.00 |  | 1400 Inventory |
|  | 700.00 | 5100 Cost of Goods Sold |

## Purchase invoice — `PURCHASE_RULE`

| # | Side | Account | Amount (fact) | Only when | Party |
|---|---|---|---|---|---|
| 1 | Dr | 1400 Inventory | `inventoryPaise` |  |  |
| 2 | Dr | 1510 Input CGST | `itc.cgstPaise` |  |  |
| 3 | Dr | 1520 Input SGST/UTGST | `itc.sgstPaise` |  |  |
| 4 | Dr | 1530 Input IGST | `itc.igstPaise` |  |  |
| 5 | Dr | 1540 Input Cess | `itc.cessPaise` |  |  |
| 6 | Dr | 4900 Round Off | `roundOffPaise` |  |  |
| 7 | Cr | 2100 Accounts Payable | `totalPaise` |  | supplier (by `supplierId`) |

*Worked example:* ₹1,000 + 2.5% CGST + 2.5% SGST + ₹100 freight, with a bill 50 paise higher.

| Dr | Cr | Account |
|---:|---:|---|
| 1,100.00 |  | 1400 Inventory |
| 25.00 |  | 1510 Input CGST |
| 25.00 |  | 1520 Input SGST/UTGST |
| 0.50 |  | 4900 Round Off |
|  | 1,150.50 | 2100 Accounts Payable |

## Debit note (goods returned to the supplier) — `DEBIT_NOTE_RULE`

| # | Side | Account | Amount (fact) | Only when | Party |
|---|---|---|---|---|---|
| 1 | Dr | 2100 Accounts Payable | `totalPaise` |  | supplier (by `supplierId`) |
| 2 | Dr | 5110 Purchase-return Losses | `lossPaise` |  |  |
| 3 | Cr | 1400 Inventory | `inventoryPaise` |  |  |
| 4 | Cr | 1510 Input CGST | `itcReversed.cgstPaise` |  |  |
| 5 | Cr | 1520 Input SGST/UTGST | `itcReversed.sgstPaise` |  |  |
| 6 | Cr | 1530 Input IGST | `itcReversed.igstPaise` |  |  |
| 7 | Cr | 1540 Input Cess | `itcReversed.cessPaise` |  |  |
| 8 | Cr | 4900 Round Off | `roundOffPaise` |  |  |

*Worked example:* 2 of 20 bags go back, worth ₹100 + ₹2.50 + ₹2.50; their ₹10 freight share is not refunded.

| Dr | Cr | Account |
|---:|---:|---|
| 105.00 |  | 2100 Accounts Payable |
| 10.00 |  | 5110 Purchase-return Losses |
|  | 110.00 | 1400 Inventory |
|  | 2.50 | 1510 Input CGST |
|  | 2.50 | 1520 Input SGST/UTGST |

## Customer receipt — `RECEIPT_RULE`

| # | Side | Account | Amount (fact) | Only when | Party |
|---|---|---|---|---|---|
| 1 | Dr | by `method`, e.g. 1200 Bank Accounts | `amountPaise` |  |  |
| 2 | Cr | 1300 Accounts Receivable | `amountPaise` |  | customer (by `partyId`) |

*Worked example:* ₹500 received by UPI.

| Dr | Cr | Account |
|---:|---:|---|
| 500.00 |  | 1200 Bank Accounts |
|  | 500.00 | 1300 Accounts Receivable |

## Supplier payment — `SUPPLIER_PAYMENT_RULE`

| # | Side | Account | Amount (fact) | Only when | Party |
|---|---|---|---|---|---|
| 1 | Dr | 2100 Accounts Payable | `amountPaise` |  | supplier (by `partyId`) |
| 2 | Cr | by `method`, e.g. 1100 Cash in Hand | `amountPaise` |  |  |

*Worked example:* ₹500 paid in cash.

| Dr | Cr | Account |
|---:|---:|---|
| 500.00 |  | 2100 Accounts Payable |
|  | 500.00 | 1100 Cash in Hand |

## Write-off — `WRITE_OFF_RULE`

| # | Side | Account | Amount (fact) | Only when | Party |
|---|---|---|---|---|---|
| 1 | Dr | 5470 Bad Debts | `amountPaise` |  |  |
| 2 | Cr | 1300 Accounts Receivable | `amountPaise` |  | customer (by `customerId`) |

*Worked example:* ₹200 written off.

| Dr | Cr | Account |
|---:|---:|---|
| 200.00 |  | 5470 Bad Debts |
|  | 200.00 | 1300 Accounts Receivable |

## Expense — `EXPENSE_RULE`

| # | Side | Account | Amount (fact) | Only when | Party |
|---|---|---|---|---|---|
| 1 | Dr | by `expenseAccount.code`, e.g. 5440 Internet | `expensePaise` |  |  |
| 2 | Dr | 1510 Input CGST | `itc.cgstPaise` |  |  |
| 3 | Dr | 1520 Input SGST/UTGST | `itc.sgstPaise` |  |  |
| 4 | Dr | 1530 Input IGST | `itc.igstPaise` |  |  |
| 5 | Dr | 1540 Input Cess | `itc.cessPaise` |  |  |
| 6 | Dr | 4900 Round Off | `roundOffPaise` |  |  |
| 7 | Cr | by `method`, e.g. 1200 Bank Accounts | `totalPaise` | `method` |  |
| 8 | Cr | 2100 Accounts Payable | `totalPaise` | `method` | supplier (by `supplierId`) |

*Worked example:* An internet bill on credit: ₹100 + 9% + 9%.

| Dr | Cr | Account |
|---:|---:|---|
| 100.00 |  | 5440 Internet |
| 9.00 |  | 1510 Input CGST |
| 9.00 |  | 1520 Input SGST/UTGST |
|  | 118.00 | 2100 Accounts Payable |

## Opening stock — `OPENING_STOCK_RULE`

| # | Side | Account | Amount (fact) | Only when | Party |
|---|---|---|---|---|---|
| 1 | Dr | 1400 Inventory | `valuePaise` |  |  |
| 2 | Cr | 3400 Opening Balance Equity | `valuePaise` |  |  |

*Worked example:* ₹5,000 of stock on day one.

| Dr | Cr | Account |
|---:|---:|---|
| 5,000.00 |  | 1400 Inventory |
|  | 5,000.00 | 3400 Opening Balance Equity |

## Stock adjustment / stock take — `STOCK_ADJUSTMENT_RULE`

| # | Side | Account | Amount (fact) | Only when | Party |
|---|---|---|---|---|---|
| 1 | Dr | 5200 Inventory Shrinkage/Write-off | `lossPaise` |  |  |
| 2 | Cr | 1400 Inventory | `lossPaise` |  |  |
| 3 | Dr | 1400 Inventory | `gainPaise` |  |  |
| 4 | Cr | 4400 Inventory Gain | `gainPaise` |  |  |

*Worked example:* ₹15 of stock short at average cost.

| Dr | Cr | Account |
|---:|---:|---|
| 15.00 |  | 5200 Inventory Shrinkage/Write-off |
|  | 15.00 | 1400 Inventory |

## Cost correction — `COST_CORRECTION_RULE`

| # | Side | Account | Amount (fact) | Only when | Party |
|---|---|---|---|---|---|
| 1 | Dr | 1400 Inventory | `valuePaise` |  |  |
| 2 | Cr | 5100 Cost of Goods Sold | `valuePaise` |  |  |

*Worked example:* Units sold below zero re-costed ₹2.50 higher.

| Dr | Cr | Account |
|---:|---:|---|
| 2.50 |  | 1400 Inventory |
|  | 2.50 | 5100 Cost of Goods Sold |

## Party opening balance — `PARTY_OPENING_RULE`

| # | Side | Account | Amount (fact) | Only when | Party |
|---|---|---|---|---|---|
| 1 | Dr | by `partyType`, e.g. 1300 Accounts Receivable | `signedPaise` |  | by `partyType`, `partyId` |
| 2 | Cr | 3400 Opening Balance Equity | `signedPaise` |  |  |

*Worked example:* A customer owed ₹1,200 on day one.

| Dr | Cr | Account |
|---:|---:|---|
| 1,200.00 |  | 1300 Accounts Receivable |
|  | 1,200.00 | 3400 Opening Balance Equity |

## Register close — `REGISTER_VARIANCE_RULE`

| # | Side | Account | Amount (fact) | Only when | Party |
|---|---|---|---|---|---|
| 1 | Dr | 1100 Cash in Hand | `variancePaise` | `variancePaise` |  |
| 2 | Cr | 4300 Other Income | `variancePaise` | `variancePaise` |  |
| 3 | Dr | 5900 Other Expenses | `variancePaise` | `variancePaise` |  |
| 4 | Cr | 1100 Cash in Hand | `variancePaise` | `variancePaise` |  |

*Worked example:* The drawer is ₹5 short.

| Dr | Cr | Account |
|---:|---:|---|
| 5.00 |  | 5900 Other Expenses |
|  | 5.00 | 1100 Cash in Hand |

## GST set-off — `GST_SETOFF_RULE`

| # | Side | Account | Amount (fact) | Only when | Party |
|---|---|---|---|---|---|
| 1 | Dr | 2230 Output IGST | `liability.igstPaise` |  |  |
| 2 | Dr | 2210 Output CGST | `liability.cgstPaise` |  |  |
| 3 | Dr | 2220 Output SGST/UTGST | `liability.sgstPaise` |  |  |
| 4 | Dr | 2240 Output Cess | `liability.cessPaise` |  |  |
| 5 | Cr | 1510 Input CGST | `creditUsed.cgstPaise` |  |  |
| 6 | Cr | 1520 Input SGST/UTGST | `creditUsed.sgstPaise` |  |  |
| 7 | Cr | 1530 Input IGST | `creditUsed.igstPaise` |  |  |
| 8 | Cr | 1540 Input Cess | `creditUsed.cessPaise` |  |  |
| 9 | Cr | 2300 GST Payable | `cashPaise` |  |  |

*Worked example:* Output CGST 892.44, SGST 892.43 and cess 99.16 against input IGST 324.00 and cess 18.00.

| Dr | Cr | Account |
|---:|---:|---|
| 892.44 |  | 2210 Output CGST |
| 892.43 |  | 2220 Output SGST/UTGST |
| 99.16 |  | 2240 Output Cess |
|  | 324.00 | 1530 Input IGST |
|  | 18.00 | 1540 Input Cess |
|  | 1,542.03 | 2300 GST Payable |

## GST payment (challan) — `GST_PAYMENT_RULE`

| # | Side | Account | Amount (fact) | Only when | Party |
|---|---|---|---|---|---|
| 1 | Dr | 2300 GST Payable | `totalPaise` |  |  |
| 2 | Cr | 1200 Bank Accounts | `totalPaise` |  |  |

*Worked example:* The set-off above paid by challan.

| Dr | Cr | Account |
|---:|---:|---|
| 1,542.03 |  | 2300 GST Payable |
|  | 1,542.03 | 1200 Bank Accounts |

## Cash in or out of the drawer, no document — `CASH_MOVEMENT_RULE`

| # | Side | Account | Amount (fact) | Only when | Party |
|---|---|---|---|---|---|
| 1 | Dr | 1100 Cash in Hand | `direction`, `amountPaise` |  |  |
| 2 | Cr | 1199 Cash to classify | `direction`, `amountPaise` |  |  |

*Worked example:* ₹2,000 put into the drawer.

| Dr | Cr | Account |
|---:|---:|---|
| 2,000.00 |  | 1100 Cash in Hand |
|  | 2,000.00 | 1199 Cash to classify |

## Year-end close — `closingLines`

Each income and expense account's movement over the year is posted to its opposite side, and the difference goes to
3300 Retained Earnings (credit for a profit, debit for a loss). Dated 31 March, numbered `CL/2526` (ADR-0045).

*Worked example:* sales 1,00,000.00, COGS 60,000.00 and rent 12,000.00.

| Dr | Cr | Account |
|---:|---:|---|
| 1,00,000.00 |  | 4100 Sales — Goods |
|  | 60,000.00 | 5100 Cost of Goods Sold |
|  | 12,000.00 | 5400 Rent |
|  | 28,000.00 | 3300 Retained Earnings |
