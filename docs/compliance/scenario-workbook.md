# Golden tax scenarios — workbook (generated)

Generated from `packages/domain/fixtures/compliance/scenarios.json` by `pnpm --filter @muneem/domain gen:compliance`. Do not edit
by hand: `packages/domain/test/complianceDocs.test.ts` fails when this file and the fixtures differ. Every scenario's key
numbers were worked out by hand and are asserted against the engines (TypeScript on the shop's computer, Go on the server)
before the file is written; the tables below are what the engines compute. Amounts are rupees; a blank cell is zero.

## 01 kirana counter: intra-state B2C, exclusive and inclusive prices, an exempt line

A Delhi kirana sells atta and soap for cash, then biscuits (MRP, tax inclusive) and exempt milk by UPI. Bills round to the rupee.

*Business:* Sharma Kirana, state 07, regular scheme, bills rounded to the rupee.

**S1 — tax invoice T1/2627/00001** of 2026-10-05, walk-in; place of supply 07 (intra-state); GSTR-1 bucket `b2cs`.

| Item | HSN | Qty | Price | Line disc. | Bill disc. share | Taxable | CGST | SGST/UTGST | IGST | Cess | Line total |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Wheat atta 5 kg bag @ 5% | 1101 | 2 BAG | 250.00 |  |  | 500.00 | 12.50 | 12.50 |  |  | 525.00 |
| Bath soap 100 g @ 18% | 3401 | 3 PCS | 35.50 |  |  | 106.50 | 9.59 | 9.58 |  |  | 125.67 |

Round-off 0.33; **invoice value ₹651.00**.

**S2 — tax invoice T1/2627/00002** of 2026-10-05, walk-in; place of supply 07 (intra-state); GSTR-1 bucket `b2cs`.

| Item | HSN | Qty | Price | Line disc. | Bill disc. share | Taxable | CGST | SGST/UTGST | IGST | Cess | Line total |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Biscuits 200 g @ 18% | 1905 | 4 PCS | 30.00 incl. |  |  | 101.69 | 9.15 | 9.15 |  |  | 119.99 |
| Toned milk 1 L (exempt) | 0401 | 2 LTR | 56.00 |  |  | 112.00 |  |  |  |  | 112.00 |

Round-off 0.01; **invoice value ₹232.00**.

*B2CS (7)*

| POS | Rate | Taxable | CGST | SGST/UTGST | IGST | Cess |
|---|---:|---:|---:|---:|---:|---:|
| 07 | 5% | 500.00 | 12.50 | 12.50 |  |  |
| 07 | 18% | 208.19 | 18.74 | 18.73 |  |  |

*Nil, exempt and non-GST (8)*

| Kind | Nil-rated | Exempt | Non-GST |
|---|---:|---:|---:|
| intra-state, unregistered |  | 112.00 |  |

*HSN summary (12)*

| Recipient | HSN | UQC | Qty | Rate | Total value | Taxable | CGST | SGST/UTGST | IGST | Cess |
|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| B2C | 0401 | LTR | 2 | 0% | 112.00 | 112.00 |  |  |  |  |
| B2C | 1101 | BAG | 2 | 5% | 525.00 | 500.00 | 12.50 | 12.50 |  |  |
| B2C | 1905 | PCS | 4 | 18% | 119.99 | 101.69 | 9.15 | 9.15 |  |  |
| B2C | 3401 | PCS | 3 | 18% | 125.67 | 106.50 | 9.59 | 9.58 |  |  |

*Documents issued (13)*

| Nature | From | To | Total | Cancelled |
|---|---|---|---:|---:|
| invoice | T1/2627/00001 | T1/2627/00002 | 2 | 0 |

*GSTR-3B*

| Table | Description | Taxable | CGST | SGST/UTGST | IGST | Cess |
|---|---|---:|---:|---:|---:|---:|
| 3.1a | Outward taxable supplies (other than zero rated, nil rated and exempted) | 708.19 | 31.24 | 31.23 |  |  |
| 3.1c | Other outward supplies (nil rated, exempted) | 112.00 |  |  |  |  |

*Journals*

| Document | Date | Dr | Cr | Account |
|---|---|---:|---:|---|
| S1 | 2026-10-05 | 651.00 |  | 1100 Cash in Hand |
|  |  |  | 606.50 | 4100 Sales — Goods |
|  |  |  | 22.09 | 2210 Output CGST |
|  |  |  | 22.08 | 2220 Output SGST/UTGST |
|  |  |  | 0.33 | 4900 Round Off |
|  |  | 515.00 |  | 5100 Cost of Goods Sold |
|  |  |  | 515.00 | 1400 Inventory |
| S2 | 2026-10-05 | 232.00 |  | 1250 Card/UPI Settlement Clearing |
|  |  |  | 213.69 | 4100 Sales — Goods |
|  |  |  | 9.15 | 2210 Output CGST |
|  |  |  | 9.15 | 2220 Output SGST/UTGST |
|  |  |  | 0.01 | 4900 Round Off |
|  |  | 196.00 |  | 5100 Cost of Goods Sold |
|  |  |  | 196.00 | 1400 Inventory |

## 02 wholesale: B2B intra-state with a bill discount over three rates (C-4), B2B inter-state with a line discount

A Delhi wholesaler bills a Delhi retailer on credit with ₹100 off the bill, and a Haryana trader (IGST) with 5% off the soap line.

*Business:* Gupta Wholesale, state 07, regular scheme, bills rounded to the rupee.

**S1 — tax invoice T1/2627/00101** of 2026-10-06, Mehta Stores, GSTIN 07AABCM1234C1Z5; place of supply 07 (intra-state); GSTR-1 bucket `b2b`. Bill discount ₹100.00.

| Item | HSN | Qty | Price | Line disc. | Bill disc. share | Taxable | CGST | SGST/UTGST | IGST | Cess | Line total |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Mustard oil 1 L @ 5% | 1514 | 10 LTR | 150.00 |  | 38.17 | 1,461.83 | 36.55 | 36.54 |  |  | 1,534.92 |
| Bath soap 100 g @ 18% | 3401 | 24 PCS | 32.50 |  | 19.85 | 760.15 | 68.41 | 68.42 |  |  | 896.98 |
| Desi ghee 1 L @ 12% | 0405 | 3 LTR | 550.00 |  | 41.98 | 1,608.02 | 96.48 | 96.48 |  |  | 1,800.98 |

Round-off 0.12; **invoice value ₹4,233.00**.

**S2 — tax invoice T1/2627/00102** of 2026-10-06, Haryana Traders, GSTIN 06AABCH5678D1Z9; place of supply 06 (inter-state); GSTR-1 bucket `b2b`.

| Item | HSN | Qty | Price | Line disc. | Bill disc. share | Taxable | CGST | SGST/UTGST | IGST | Cess | Line total |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Bath soap 100 g @ 18% | 3401 | 48 PCS | 32.50 | 78.00 |  | 1,482.00 |  |  | 266.76 |  | 1,748.76 |
| Mustard oil 1 L @ 5% | 1514 | 20 LTR | 150.00 |  |  | 3,000.00 |  |  | 150.00 |  | 3,150.00 |

Round-off 0.24; **invoice value ₹4,899.00**.

*B2B (4A)*

| GSTIN | Invoice | Value | POS | Rate | Taxable | CGST | SGST/UTGST | IGST | Cess |
|---|---|---:|---|---:|---:|---:|---:|---:|---:|
| 06AABCH5678D1Z9 | T1/2627/00102 | 4,899.00 | 06 | 5% | 3,000.00 |  |  | 150.00 |  |
| 06AABCH5678D1Z9 | T1/2627/00102 | 4,899.00 | 06 | 18% | 1,482.00 |  |  | 266.76 |  |
| 07AABCM1234C1Z5 | T1/2627/00101 | 4,233.00 | 07 | 5% | 1,461.83 | 36.55 | 36.54 |  |  |
| 07AABCM1234C1Z5 | T1/2627/00101 | 4,233.00 | 07 | 12% | 1,608.02 | 96.48 | 96.48 |  |  |
| 07AABCM1234C1Z5 | T1/2627/00101 | 4,233.00 | 07 | 18% | 760.15 | 68.41 | 68.42 |  |  |

*HSN summary (12)*

| Recipient | HSN | UQC | Qty | Rate | Total value | Taxable | CGST | SGST/UTGST | IGST | Cess |
|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| B2B | 0405 | LTR | 3 | 12% | 1,800.98 | 1,608.02 | 96.48 | 96.48 |  |  |
| B2B | 1514 | LTR | 30 | 5% | 4,684.92 | 4,461.83 | 36.55 | 36.54 | 150.00 |  |
| B2B | 3401 | PCS | 72 | 18% | 2,645.74 | 2,242.15 | 68.41 | 68.42 | 266.76 |  |

*Documents issued (13)*

| Nature | From | To | Total | Cancelled |
|---|---|---|---:|---:|
| invoice | T1/2627/00101 | T1/2627/00102 | 2 | 0 |

*GSTR-3B*

| Table | Description | Taxable | CGST | SGST/UTGST | IGST | Cess |
|---|---|---:|---:|---:|---:|---:|
| 3.1a | Outward taxable supplies (other than zero rated, nil rated and exempted) | 8,312.00 | 201.44 | 201.44 | 416.76 |  |

*Journals*

| Document | Date | Dr | Cr | Account |
|---|---|---:|---:|---|
| S1 | 2026-10-06 | 4,233.00 |  | 1300 Accounts Receivable (customer:C-MEHTA) |
|  |  |  | 3,830.00 | 4100 Sales — Goods |
|  |  |  | 201.44 | 2210 Output CGST |
|  |  |  | 201.44 | 2220 Output SGST/UTGST |
|  |  |  | 0.12 | 4900 Round Off |
|  |  | 3,340.00 |  | 5100 Cost of Goods Sold |
|  |  |  | 3,340.00 | 1400 Inventory |
| S2 | 2026-10-06 | 4,899.00 |  | 1250 Card/UPI Settlement Clearing |
|  |  |  | 4,482.00 | 4100 Sales — Goods |
|  |  |  | 416.76 | 2230 Output IGST |
|  |  |  | 0.24 | 4900 Round Off |
|  |  | 3,800.00 |  | 5100 Cost of Goods Sold |
|  |  |  | 3,800.00 | 1400 Inventory |

## 03 inter-state B2C: small (B2CS), large (B2CL) and an invoice of exactly ₹1,00,000

A Jaipur crafts shop ships sarees and a lamp to customers in other states. The B2CL line is "invoice value above ₹1,00,000"; a bill that rounds to exactly ₹1,00,000.00 stays in B2CS.

*Business:* Jaipur Handicrafts, state 08, regular scheme, bills rounded to the rupee.

**S1 — tax invoice T1/2627/00011** of 2026-10-07, walk-in; place of supply 27 (inter-state); GSTR-1 bucket `b2cs`.

| Item | HSN | Qty | Price | Line disc. | Bill disc. share | Taxable | CGST | SGST/UTGST | IGST | Cess | Line total |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Hand-block saree @ 5% | 5208 | 2 PCS | 2,400.00 |  |  | 4,800.00 |  |  | 240.00 |  | 5,040.00 |

Round-off 0.00; **invoice value ₹5,040.00**.

**S2 — tax invoice T1/2627/00012** of 2026-10-07, walk-in; place of supply 27 (inter-state); GSTR-1 bucket `b2cl`.

| Item | HSN | Qty | Price | Line disc. | Bill disc. share | Taxable | CGST | SGST/UTGST | IGST | Cess | Line total |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Brass lamp @ 12% | 7419 | 1 PCS | 95,000.00 |  |  | 95,000.00 |  |  | 11,400.00 |  | 1,06,400.00 |

Round-off 0.00; **invoice value ₹1,06,400.00**.

**S3 — tax invoice T1/2627/00013** of 2026-10-08, walk-in; place of supply 06 (inter-state); GSTR-1 bucket `b2cs`.

| Item | HSN | Qty | Price | Line disc. | Bill disc. share | Taxable | CGST | SGST/UTGST | IGST | Cess | Line total |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Hand-block saree @ 5% | 5208 | 1 PCS | 95,238.10 |  |  | 95,238.10 |  |  | 4,761.91 |  | 1,00,000.01 |

Round-off −0.01; **invoice value ₹1,00,000.00**.

*B2CL (5)*

| Invoice | Value | POS | Rate | Taxable | CGST | SGST/UTGST | IGST | Cess |
|---|---:|---|---:|---:|---:|---:|---:|---:|
| T1/2627/00012 | 1,06,400.00 | 27 | 12% | 95,000.00 |  |  | 11,400.00 |  |

*B2CS (7)*

| POS | Rate | Taxable | CGST | SGST/UTGST | IGST | Cess |
|---|---:|---:|---:|---:|---:|---:|
| 06 | 5% | 95,238.10 |  |  | 4,761.91 |  |
| 27 | 5% | 4,800.00 |  |  | 240.00 |  |

*HSN summary (12)*

| Recipient | HSN | UQC | Qty | Rate | Total value | Taxable | CGST | SGST/UTGST | IGST | Cess |
|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| B2C | 5208 | PCS | 3 | 5% | 1,05,040.01 | 1,00,038.10 |  |  | 5,001.91 |  |
| B2C | 7419 | PCS | 1 | 12% | 1,06,400.00 | 95,000.00 |  |  | 11,400.00 |  |

*Documents issued (13)*

| Nature | From | To | Total | Cancelled |
|---|---|---|---:|---:|
| invoice | T1/2627/00011 | T1/2627/00013 | 3 | 0 |

*GSTR-3B*

| Table | Description | Taxable | CGST | SGST/UTGST | IGST | Cess |
|---|---|---:|---:|---:|---:|---:|
| 3.1a | Outward taxable supplies (other than zero rated, nil rated and exempted) | 1,95,038.10 |  |  | 16,401.91 |  |

*Journals*

| Document | Date | Dr | Cr | Account |
|---|---|---:|---:|---|
| S1 | 2026-10-07 | 5,040.00 |  | 1100 Cash in Hand |
|  |  |  | 4,800.00 | 4100 Sales — Goods |
|  |  |  | 240.00 | 2230 Output IGST |
|  |  | 3,000.00 |  | 5100 Cost of Goods Sold |
|  |  |  | 3,000.00 | 1400 Inventory |
| S2 | 2026-10-07 | 1,06,400.00 |  | 1250 Card/UPI Settlement Clearing |
|  |  |  | 95,000.00 | 4100 Sales — Goods |
|  |  |  | 11,400.00 | 2230 Output IGST |
|  |  | 60,000.00 |  | 5100 Cost of Goods Sold |
|  |  |  | 60,000.00 | 1400 Inventory |
| S3 | 2026-10-08 | 1,00,000.00 |  | 1100 Cash in Hand |
|  |  |  | 95,238.10 | 4100 Sales — Goods |
|  |  |  | 4,761.91 | 2230 Output IGST |
|  |  | 0.01 |  | 4900 Round Off |
|  |  | 70,000.00 |  | 5100 Cost of Goods Sold |
|  |  |  | 70,000.00 | 1400 Inventory |

## 04 composition dealer: bills of supply, no tax, no ITC, nothing in GSTR-1

A UP sweet shop under the composition scheme sells to a walk-in and a registered customer, and buys sugar from a regular supplier. The printed bill of supply carries "Composition taxable person, not eligible to collect tax on supplies" at the top (CGST rule 5(1)(g)).

*Business:* Verma Sweets, state 09, composition scheme, bills rounded to the rupee.

**S1 — bill of supply T1/2627/00201** of 2026-10-09, walk-in; place of supply 09 (intra-state); GSTR-1 bucket `na`.

| Item | HSN | Qty | Price | Line disc. | Bill disc. share | Taxable | CGST | SGST/UTGST | IGST | Cess | Line total |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Kaju katli @ 5% | 1704 | 1.5 KG | 900.00 |  |  | 1,350.00 |  |  |  |  | 1,350.00 |
| Namkeen 400 g @ 12% | 2106 | 3 PCS | 45.50 |  |  | 136.50 |  |  |  |  | 136.50 |

Round-off 0.50; **invoice value ₹1,487.00**.

**S2 — bill of supply T1/2627/00202** of 2026-10-09, Ram Caterers, GSTIN 09AAACR1111A1Z1; place of supply 09 (intra-state); GSTR-1 bucket `na`. Bill discount 2%.

| Item | HSN | Qty | Price | Line disc. | Bill disc. share | Taxable | CGST | SGST/UTGST | IGST | Cess | Line total |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Kaju katli @ 5% | 1704 | 5 KG | 900.00 |  | 90.00 | 4,410.00 |  |  |  |  | 4,410.00 |

Round-off 0.00; **invoice value ₹4,410.00**.

*Purchases, debit notes and expenses*

| Document | Supplier | Taxable | CGST | SGST/UTGST | IGST | Cess | ITC claimed | Total |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| P1 purchase LKO/3391 | Lucknow Sugar Traders (regular, 09) | 2,100.00 | 52.50 | 52.50 |  |  | 0.00 | 2,205.00 |

GSTR-1: not applicable (not a regular-scheme business).

*Journals*

| Document | Date | Dr | Cr | Account |
|---|---|---:|---:|---|
| S1 | 2026-10-09 | 1,487.00 |  | 1100 Cash in Hand |
|  |  |  | 1,486.50 | 4100 Sales — Goods |
|  |  |  | 0.50 | 4900 Round Off |
|  |  | 990.00 |  | 5100 Cost of Goods Sold |
|  |  |  | 990.00 | 1400 Inventory |
| S2 | 2026-10-09 | 4,410.00 |  | 1250 Card/UPI Settlement Clearing |
|  |  |  | 4,410.00 | 4100 Sales — Goods |
|  |  | 3,000.00 |  | 5100 Cost of Goods Sold |
|  |  |  | 3,000.00 | 1400 Inventory |
| P1 | 2026-10-03 | 2,205.00 |  | 1400 Inventory |
|  |  |  | 2,205.00 | 2100 Accounts Payable (supplier:S-LKO) |

## 05 exempt, nil-rated and non-GST lines mixed with taxable lines on one invoice

A Punjab highway store sells diesel (non-GST), soap and milk to a registered transporter on one bill, and salt and milk, then only diesel, to walk-ins. Each line goes to its own GSTR-1 table.

*Business:* Highway Mart, state 03, regular scheme, bills rounded to the rupee.

**S1 — tax invoice T1/2627/00301** of 2026-10-10, Singh Transport, GSTIN 03AAACS3333C1Z3; place of supply 03 (intra-state); GSTR-1 bucket `b2b`.

| Item | HSN | Qty | Price | Line disc. | Bill disc. share | Taxable | CGST | SGST/UTGST | IGST | Cess | Line total |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| High-speed diesel (non-gst) | 2710 | 50 LTR | 90.00 |  |  | 4,500.00 |  |  |  |  | 4,500.00 |
| Bath soap 100 g @ 18% | 3401 | 10 PCS | 35.00 |  |  | 350.00 | 31.50 | 31.50 |  |  | 413.00 |
| Toned milk 1 L (exempt) | 0401 | 5 LTR | 56.00 |  |  | 280.00 |  |  |  |  | 280.00 |

Round-off 0.00; **invoice value ₹5,193.00**.

**S2 — tax invoice T1/2627/00302** of 2026-10-10, walk-in; place of supply 03 (intra-state); GSTR-1 bucket `exempt`.

| Item | HSN | Qty | Price | Line disc. | Bill disc. share | Taxable | CGST | SGST/UTGST | IGST | Cess | Line total |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Loose salt (nil-rated) | 2501 | 2 KG | 28.00 |  |  | 56.00 |  |  |  |  | 56.00 |
| Toned milk 1 L (exempt) | 0401 | 2 LTR | 56.00 |  |  | 112.00 |  |  |  |  | 112.00 |

Round-off 0.00; **invoice value ₹168.00**.

**S3 — tax invoice T1/2627/00303** of 2026-10-10, walk-in; place of supply 03 (intra-state); GSTR-1 bucket `non_gst`.

| Item | HSN | Qty | Price | Line disc. | Bill disc. share | Taxable | CGST | SGST/UTGST | IGST | Cess | Line total |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| High-speed diesel (non-gst) | 2710 | 10 LTR | 90.00 |  |  | 900.00 |  |  |  |  | 900.00 |

Round-off 0.00; **invoice value ₹900.00**.

*B2B (4A)*

| GSTIN | Invoice | Value | POS | Rate | Taxable | CGST | SGST/UTGST | IGST | Cess |
|---|---|---:|---|---:|---:|---:|---:|---:|---:|
| 03AAACS3333C1Z3 | T1/2627/00301 | 5,193.00 | 03 | 18% | 350.00 | 31.50 | 31.50 |  |  |

*Nil, exempt and non-GST (8)*

| Kind | Nil-rated | Exempt | Non-GST |
|---|---:|---:|---:|
| intra-state, registered |  | 280.00 | 4,500.00 |
| intra-state, unregistered | 56.00 | 112.00 | 900.00 |

*HSN summary (12)*

| Recipient | HSN | UQC | Qty | Rate | Total value | Taxable | CGST | SGST/UTGST | IGST | Cess |
|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| B2B | 0401 | LTR | 5 | 0% | 280.00 | 280.00 |  |  |  |  |
| B2B | 2710 | LTR | 50 | 0% | 4,500.00 | 4,500.00 |  |  |  |  |
| B2B | 3401 | PCS | 10 | 18% | 413.00 | 350.00 | 31.50 | 31.50 |  |  |
| B2C | 0401 | LTR | 2 | 0% | 112.00 | 112.00 |  |  |  |  |
| B2C | 2501 | KGS | 2 | 0% | 56.00 | 56.00 |  |  |  |  |
| B2C | 2710 | LTR | 10 | 0% | 900.00 | 900.00 |  |  |  |  |

*Documents issued (13)*

| Nature | From | To | Total | Cancelled |
|---|---|---|---:|---:|
| invoice | T1/2627/00301 | T1/2627/00303 | 3 | 0 |

*GSTR-3B*

| Table | Description | Taxable | CGST | SGST/UTGST | IGST | Cess |
|---|---|---:|---:|---:|---:|---:|
| 3.1a | Outward taxable supplies (other than zero rated, nil rated and exempted) | 350.00 | 31.50 | 31.50 |  |  |
| 3.1c | Other outward supplies (nil rated, exempted) | 448.00 |  |  |  |  |
| 3.1e | Non-GST outward supplies | 5,400.00 |  |  |  |  |

*Journals*

| Document | Date | Dr | Cr | Account |
|---|---|---:|---:|---|
| S1 | 2026-10-10 | 5,193.00 |  | 1300 Accounts Receivable (customer:C-SINGH) |
|  |  |  | 5,130.00 | 4100 Sales — Goods |
|  |  |  | 31.50 | 2210 Output CGST |
|  |  |  | 31.50 | 2220 Output SGST/UTGST |
|  |  | 4,750.00 |  | 5100 Cost of Goods Sold |
|  |  |  | 4,750.00 | 1400 Inventory |
| S2 | 2026-10-10 | 168.00 |  | 1100 Cash in Hand |
|  |  |  | 168.00 | 4100 Sales — Goods |
|  |  | 140.00 |  | 5100 Cost of Goods Sold |
|  |  |  | 140.00 | 1400 Inventory |
| S3 | 2026-10-10 | 900.00 |  | 1100 Cash in Hand |
|  |  |  | 900.00 | 4100 Sales — Goods |
|  |  | 850.00 |  | 5100 Cost of Goods Sold |
|  |  |  | 850.00 | 1400 Inventory |

## 06 rounding (C-3): tax per line, halves that re-sum, weighed quantity, inclusive MRP, round-off at exactly 50 paise

Three ₹10.25 notebooks taxed line by line (₹1.53 of tax, not the ₹1.54 an invoice-level calculation gives), 2.5 g of gold, and soap at MRP with a pen that brings the bill to exactly ₹144.50.

*Business:* Sharma General & Jewellers, state 07, regular scheme, bills rounded to the rupee.

**S1 — tax invoice T1/2627/00401** of 2026-10-11, walk-in; place of supply 07 (intra-state); GSTR-1 bucket `b2cs`.

| Item | HSN | Qty | Price | Line disc. | Bill disc. share | Taxable | CGST | SGST/UTGST | IGST | Cess | Line total |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Notebook @ 5% | 4820 | 1 PCS | 10.25 |  |  | 10.25 | 0.26 | 0.25 |  |  | 10.76 |
| Notebook @ 5% | 4820 | 1 PCS | 10.25 |  |  | 10.25 | 0.26 | 0.25 |  |  | 10.76 |
| Notebook @ 5% | 4820 | 1 PCS | 10.25 |  |  | 10.25 | 0.26 | 0.25 |  |  | 10.76 |

Round-off −0.28; **invoice value ₹32.00**.

**S2 — tax invoice T1/2627/00402** of 2026-10-11, walk-in; place of supply 07 (intra-state); GSTR-1 bucket `b2cs`.

| Item | HSN | Qty | Price | Line disc. | Bill disc. share | Taxable | CGST | SGST/UTGST | IGST | Cess | Line total |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Gold coin 24 ct @ 3% | 7108 | 2.5 G | 7,123.45 |  |  | 17,808.63 | 267.13 | 267.13 |  |  | 18,342.89 |

Round-off 0.11; **invoice value ₹18,343.00**.

**S3 — tax invoice T1/2627/00403** of 2026-10-11, walk-in; place of supply 07 (intra-state); GSTR-1 bucket `b2cs`.

| Item | HSN | Qty | Price | Line disc. | Bill disc. share | Taxable | CGST | SGST/UTGST | IGST | Cess | Line total |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Bath soap 100 g @ 18% | 3401 | 3 PCS | 45.00 incl. |  |  | 114.41 | 10.30 | 10.29 |  |  | 135.00 |
| Ball pen @ 5% | 9608 | 1 PCS | 9.05 |  |  | 9.05 | 0.23 | 0.22 |  |  | 9.50 |

Round-off 0.50; **invoice value ₹145.00**.

*B2CS (7)*

| POS | Rate | Taxable | CGST | SGST/UTGST | IGST | Cess |
|---|---:|---:|---:|---:|---:|---:|
| 07 | 3% | 17,808.63 | 267.13 | 267.13 |  |  |
| 07 | 5% | 39.80 | 1.01 | 0.97 |  |  |
| 07 | 18% | 114.41 | 10.30 | 10.29 |  |  |

*HSN summary (12)*

| Recipient | HSN | UQC | Qty | Rate | Total value | Taxable | CGST | SGST/UTGST | IGST | Cess |
|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| B2C | 3401 | PCS | 3 | 18% | 135.00 | 114.41 | 10.30 | 10.29 |  |  |
| B2C | 4820 | PCS | 3 | 5% | 32.28 | 30.75 | 0.78 | 0.75 |  |  |
| B2C | 7108 | GMS | 2.5 | 3% | 18,342.89 | 17,808.63 | 267.13 | 267.13 |  |  |
| B2C | 9608 | PCS | 1 | 5% | 9.50 | 9.05 | 0.23 | 0.22 |  |  |

*Documents issued (13)*

| Nature | From | To | Total | Cancelled |
|---|---|---|---:|---:|
| invoice | T1/2627/00401 | T1/2627/00403 | 3 | 0 |

*GSTR-3B*

| Table | Description | Taxable | CGST | SGST/UTGST | IGST | Cess |
|---|---|---:|---:|---:|---:|---:|
| 3.1a | Outward taxable supplies (other than zero rated, nil rated and exempted) | 17,962.84 | 278.44 | 278.39 |  |  |

*Journals*

| Document | Date | Dr | Cr | Account |
|---|---|---:|---:|---|
| S1 | 2026-10-11 | 32.00 |  | 1100 Cash in Hand |
|  |  |  | 30.75 | 4100 Sales — Goods |
|  |  |  | 0.78 | 2210 Output CGST |
|  |  |  | 0.75 | 2220 Output SGST/UTGST |
|  |  | 0.28 |  | 4900 Round Off |
|  |  | 21.00 |  | 5100 Cost of Goods Sold |
|  |  |  | 21.00 | 1400 Inventory |
| S2 | 2026-10-11 | 18,343.00 |  | 1100 Cash in Hand |
|  |  |  | 17,808.63 | 4100 Sales — Goods |
|  |  |  | 267.13 | 2210 Output CGST |
|  |  |  | 267.13 | 2220 Output SGST/UTGST |
|  |  |  | 0.11 | 4900 Round Off |
|  |  | 17,250.00 |  | 5100 Cost of Goods Sold |
|  |  |  | 17,250.00 | 1400 Inventory |
| S3 | 2026-10-11 | 145.00 |  | 1100 Cash in Hand |
|  |  |  | 123.46 | 4100 Sales — Goods |
|  |  |  | 10.53 | 2210 Output CGST |
|  |  |  | 10.51 | 2220 Output SGST/UTGST |
|  |  |  | 0.50 | 4900 Round Off |
|  |  | 80.00 |  | 5100 Cost of Goods Sold |
|  |  |  | 80.00 | 1400 Inventory |

## 07 discounts (C-4): line discounts first, then a 10% bill discount apportioned before tax over mixed rates

A Bengaluru garment shop: two MRP shirts with ₹50 off, jeans with 5% off and socks, then 10% off the whole bill. The bill discount is spread over the lines by value (largest remainder) before any tax is worked out.

*Business:* Kumar Garments, state 29, regular scheme, bills rounded to the rupee.

**S1 — tax invoice T1/2627/00501** of 2026-10-12, walk-in; place of supply 29 (intra-state); GSTR-1 bucket `b2cs`. Bill discount 10%.

| Item | HSN | Qty | Price | Line disc. | Bill disc. share | Taxable | CGST | SGST/UTGST | IGST | Cess | Line total |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Cotton shirt @ 5% | 6205 | 2 PCS | 999.00 incl. | 50.00 | 185.29 | 1,667.57 | 41.69 | 41.69 |  |  | 1,750.95 |
| Denim jeans @ 18% | 6203 | 1 PCS | 2,999.00 | 149.95 | 284.90 | 2,564.15 | 230.77 | 230.78 |  |  | 3,025.70 |
| Socks @ 5% | 6115 | 3 PAIR | 120.00 |  | 36.00 | 324.00 | 8.10 | 8.10 |  |  | 340.20 |

Round-off 0.15; **invoice value ₹5,117.00**.

*B2CS (7)*

| POS | Rate | Taxable | CGST | SGST/UTGST | IGST | Cess |
|---|---:|---:|---:|---:|---:|---:|
| 29 | 5% | 1,991.57 | 49.79 | 49.79 |  |  |
| 29 | 18% | 2,564.15 | 230.77 | 230.78 |  |  |

*HSN summary (12)*

| Recipient | HSN | UQC | Qty | Rate | Total value | Taxable | CGST | SGST/UTGST | IGST | Cess |
|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| B2C | 6115 | PRS | 3 | 5% | 340.20 | 324.00 | 8.10 | 8.10 |  |  |
| B2C | 6203 | PCS | 1 | 18% | 3,025.70 | 2,564.15 | 230.77 | 230.78 |  |  |
| B2C | 6205 | PCS | 2 | 5% | 1,750.95 | 1,667.57 | 41.69 | 41.69 |  |  |

*Documents issued (13)*

| Nature | From | To | Total | Cancelled |
|---|---|---|---:|---:|
| invoice | T1/2627/00501 | T1/2627/00501 | 1 | 0 |

*GSTR-3B*

| Table | Description | Taxable | CGST | SGST/UTGST | IGST | Cess |
|---|---|---:|---:|---:|---:|---:|
| 3.1a | Outward taxable supplies (other than zero rated, nil rated and exempted) | 4,555.72 | 280.56 | 280.57 |  |  |

*Journals*

| Document | Date | Dr | Cr | Account |
|---|---|---:|---:|---|
| S1 | 2026-10-12 | 5,117.00 |  | 1100 Cash in Hand |
|  |  |  | 4,555.72 | 4100 Sales — Goods |
|  |  |  | 280.56 | 2210 Output CGST |
|  |  |  | 280.57 | 2220 Output SGST/UTGST |
|  |  |  | 0.15 | 4900 Round Off |
|  |  | 2,720.00 |  | 5100 Cost of Goods Sold |
|  |  |  | 2,720.00 | 1400 Inventory |

## 08 cess: ad valorem and per-unit, at MRP (inclusive) and wholesale (exclusive, inter-state)

A Delhi paan shop sells cigarettes (28% + 5% cess + ₹10 a pack) and cola (28% + 12% cess) at MRP, and 100 packs to a Haryana retailer.

*Business:* Paan Corner, state 07, regular scheme, bills rounded to the rupee.

**S1 — tax invoice T1/2627/00601** of 2026-10-13, walk-in; place of supply 07 (intra-state); GSTR-1 bucket `b2cs`.

| Item | HSN | Qty | Price | Line disc. | Bill disc. share | Taxable | CGST | SGST/UTGST | IGST | Cess | Line total |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Cigarettes, pack of 10 @ 28% | 2402 | 2 PKT | 150.00 incl. |  |  | 210.53 | 29.47 | 29.48 |  | 30.53 | 300.01 |
| Cola 600 ml @ 28% | 2202 | 3 BTL | 40.00 incl. |  |  | 85.71 | 12.00 | 12.00 |  | 10.29 | 120.00 |

Round-off −0.01; **invoice value ₹420.00**.

**S2 — tax invoice T1/2627/00602** of 2026-10-13, Panipat Pan Bhandar, GSTIN 06AAACP4444D1Z4; place of supply 06 (inter-state); GSTR-1 bucket `b2b`.

| Item | HSN | Qty | Price | Line disc. | Bill disc. share | Taxable | CGST | SGST/UTGST | IGST | Cess | Line total |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Cigarettes, pack of 10 @ 28% | 2402 | 100 PKT | 100.00 |  |  | 10,000.00 |  |  | 2,800.00 | 1,500.00 | 14,300.00 |

Round-off 0.00; **invoice value ₹14,300.00**.

*B2B (4A)*

| GSTIN | Invoice | Value | POS | Rate | Taxable | CGST | SGST/UTGST | IGST | Cess |
|---|---|---:|---|---:|---:|---:|---:|---:|---:|
| 06AAACP4444D1Z4 | T1/2627/00602 | 14,300.00 | 06 | 28% | 10,000.00 |  |  | 2,800.00 | 1,500.00 |

*B2CS (7)*

| POS | Rate | Taxable | CGST | SGST/UTGST | IGST | Cess |
|---|---:|---:|---:|---:|---:|---:|
| 07 | 28% | 296.24 | 41.47 | 41.48 |  | 40.82 |

*HSN summary (12)*

| Recipient | HSN | UQC | Qty | Rate | Total value | Taxable | CGST | SGST/UTGST | IGST | Cess |
|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| B2B | 2402 | PAC | 100 | 28% | 14,300.00 | 10,000.00 |  |  | 2,800.00 | 1,500.00 |
| B2C | 2202 | BTL | 3 | 28% | 120.00 | 85.71 | 12.00 | 12.00 |  | 10.29 |
| B2C | 2402 | PAC | 2 | 28% | 300.01 | 210.53 | 29.47 | 29.48 |  | 30.53 |

*Documents issued (13)*

| Nature | From | To | Total | Cancelled |
|---|---|---|---:|---:|
| invoice | T1/2627/00601 | T1/2627/00602 | 2 | 0 |

*GSTR-3B*

| Table | Description | Taxable | CGST | SGST/UTGST | IGST | Cess |
|---|---|---:|---:|---:|---:|---:|
| 3.1a | Outward taxable supplies (other than zero rated, nil rated and exempted) | 10,296.24 | 41.47 | 41.48 | 2,800.00 | 1,540.82 |

*Journals*

| Document | Date | Dr | Cr | Account |
|---|---|---:|---:|---|
| S1 | 2026-10-13 | 420.00 |  | 1100 Cash in Hand |
|  |  |  | 296.24 | 4100 Sales — Goods |
|  |  |  | 41.47 | 2210 Output CGST |
|  |  |  | 41.48 | 2220 Output SGST/UTGST |
|  |  |  | 40.82 | 2240 Output Cess |
|  |  | 0.01 |  | 4900 Round Off |
|  |  | 255.00 |  | 5100 Cost of Goods Sold |
|  |  |  | 255.00 | 1400 Inventory |
| S2 | 2026-10-13 | 14,300.00 |  | 1250 Card/UPI Settlement Clearing |
|  |  |  | 10,000.00 | 4100 Sales — Goods |
|  |  |  | 2,800.00 | 2230 Output IGST |
|  |  |  | 1,500.00 | 2240 Output Cess |
|  |  | 9,000.00 |  | 5100 Cost of Goods Sold |
|  |  |  | 9,000.00 | 1400 Inventory |

## 09 credit notes: partial and completing returns against B2B (CDNR), a cancel against B2CS, a part return against B2CL (CDNUR)

An electrical shop returns one fan to a builder (to their account), then the rest of that bill (which takes back its round-off); cancels a walk-in bill with a cash refund; and takes back 10 of 60 fans shipped to UP.

*Business:* Sharma Electricals, state 07, regular scheme, bills rounded to the rupee.

**S1 — tax invoice T1/2627/00701** of 2026-10-03, Bright Builders, GSTIN 07AAACB5555E1Z5; place of supply 07 (intra-state); GSTR-1 bucket `b2b`.

| Item | HSN | Qty | Price | Line disc. | Bill disc. share | Taxable | CGST | SGST/UTGST | IGST | Cess | Line total |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Ceiling fan @ 18% | 8414 | 4 PCS | 1,850.00 |  |  | 7,400.00 | 666.00 | 666.00 |  |  | 8,732.00 |
| LED bulb 9 W @ 18% | 8539 | 10 PCS | 99.00 |  |  | 990.00 | 89.10 | 89.10 |  |  | 1,168.20 |

Round-off −0.20; **invoice value ₹9,900.00**.

**S2 — tax invoice T1/2627/00702** of 2026-10-05, walk-in; place of supply 07 (intra-state); GSTR-1 bucket `b2cs`.

| Item | HSN | Qty | Price | Line disc. | Bill disc. share | Taxable | CGST | SGST/UTGST | IGST | Cess | Line total |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| LED bulb 9 W @ 18% | 8539 | 3 PCS | 99.00 |  |  | 297.00 | 26.73 | 26.73 |  |  | 350.46 |

Round-off −0.46; **invoice value ₹350.00**.

**S3 — tax invoice T1/2627/00703** of 2026-10-06, walk-in; place of supply 09 (inter-state); GSTR-1 bucket `b2cl`.

| Item | HSN | Qty | Price | Line disc. | Bill disc. share | Taxable | CGST | SGST/UTGST | IGST | Cess | Line total |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Ceiling fan @ 18% | 8414 | 60 PCS | 1,850.00 |  |  | 1,11,000.00 |  |  | 19,980.00 |  | 1,30,980.00 |

Round-off 0.00; **invoice value ₹1,30,980.00**.

*Credit notes*

| Note | Against | Returned | Taxable | CGST | SGST/UTGST | IGST | Cess | Round-off | Value | To account | Refunded |
|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| CN1 T1C/2627/00001 | T1/2627/00701 | 1 × Ceiling fan | 1,850.00 | 166.50 | 166.50 |  |  |  | 2,183.00 | 2,183.00 |  |
| CN2 T1C/2627/00002 | T1/2627/00702 | 3 × LED bulb 9 W | 297.00 | 26.73 | 26.73 |  |  | −0.46 | 350.00 |  | 350.00 cash |
| CN3 T1C/2627/00003 | T1/2627/00703 | 10 × Ceiling fan | 18,500.00 |  |  | 3,330.00 |  |  | 21,830.00 |  | 21,830.00 upi |
| CN4 T1C/2627/00004 | T1/2627/00701 | 3 × Ceiling fan; 10 × LED bulb 9 W | 6,540.00 | 588.60 | 588.60 |  |  | −0.20 | 7,717.00 | 7,717.00 |  |

*B2B (4A)*

| GSTIN | Invoice | Value | POS | Rate | Taxable | CGST | SGST/UTGST | IGST | Cess |
|---|---|---:|---|---:|---:|---:|---:|---:|---:|
| 07AAACB5555E1Z5 | T1/2627/00701 | 9,900.00 | 07 | 18% | 8,390.00 | 755.10 | 755.10 |  |  |

*B2CL (5)*

| Invoice | Value | POS | Rate | Taxable | CGST | SGST/UTGST | IGST | Cess |
|---|---:|---|---:|---:|---:|---:|---:|---:|
| T1/2627/00703 | 1,30,980.00 | 09 | 18% | 1,11,000.00 |  |  | 19,980.00 |  |

*B2CS (7)*

| POS | Rate | Taxable | CGST | SGST/UTGST | IGST | Cess |
|---|---:|---:|---:|---:|---:|---:|
| 07 | 18% |  |  |  |  |  |

*CDNR (9B, registered)*

| GSTIN | Note | Value | Rate | Taxable | CGST | SGST/UTGST | IGST | Cess |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| 07AAACB5555E1Z5 | T1C/2627/00001 | 2,183.00 | 18% | 1,850.00 | 166.50 | 166.50 |  |  |
| 07AAACB5555E1Z5 | T1C/2627/00004 | 7,717.00 | 18% | 6,540.00 | 588.60 | 588.60 |  |  |

*CDNUR (9B, unregistered)*

| Type | Note | Value | POS | Rate | Taxable | CGST | SGST/UTGST | IGST | Cess |
|---|---|---:|---|---:|---:|---:|---:|---:|---:|
| B2CL | T1C/2627/00003 | 21,830.00 | 09 | 18% | 18,500.00 |  |  | 3,330.00 |  |

*HSN summary (12)*

| Recipient | HSN | UQC | Qty | Rate | Total value | Taxable | CGST | SGST/UTGST | IGST | Cess |
|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| B2B | 8414 | PCS | 0 | 18% | 0.00 |  |  |  |  |  |
| B2B | 8539 | PCS | 0 | 18% | 0.00 |  |  |  |  |  |
| B2C | 8414 | PCS | 50 | 18% | 1,09,150.00 | 92,500.00 |  |  | 16,650.00 |  |
| B2C | 8539 | PCS | 0 | 18% | 0.00 |  |  |  |  |  |

*Documents issued (13)*

| Nature | From | To | Total | Cancelled |
|---|---|---|---:|---:|
| invoice | T1/2627/00701 | T1/2627/00703 | 3 | 0 |
| credit note | T1C/2627/00001 | T1C/2627/00004 | 4 | 0 |

*GSTR-3B*

| Table | Description | Taxable | CGST | SGST/UTGST | IGST | Cess |
|---|---|---:|---:|---:|---:|---:|
| 3.1a | Outward taxable supplies (other than zero rated, nil rated and exempted) | 92,500.00 |  |  | 16,650.00 |  |

*Journals*

| Document | Date | Dr | Cr | Account |
|---|---|---:|---:|---|
| S1 | 2026-10-03 | 9,900.00 |  | 1300 Accounts Receivable (customer:C-BRIGHT) |
|  |  |  | 8,390.00 | 4100 Sales — Goods |
|  |  |  | 755.10 | 2210 Output CGST |
|  |  |  | 755.10 | 2220 Output SGST/UTGST |
|  |  | 0.20 |  | 4900 Round Off |
|  |  | 6,200.00 |  | 5100 Cost of Goods Sold |
|  |  |  | 6,200.00 | 1400 Inventory |
| S2 | 2026-10-05 | 350.00 |  | 1100 Cash in Hand |
|  |  |  | 297.00 | 4100 Sales — Goods |
|  |  |  | 26.73 | 2210 Output CGST |
|  |  |  | 26.73 | 2220 Output SGST/UTGST |
|  |  | 0.46 |  | 4900 Round Off |
|  |  | 180.00 |  | 5100 Cost of Goods Sold |
|  |  |  | 180.00 | 1400 Inventory |
| S3 | 2026-10-06 | 1,30,980.00 |  | 1250 Card/UPI Settlement Clearing |
|  |  |  | 1,11,000.00 | 4100 Sales — Goods |
|  |  |  | 19,980.00 | 2230 Output IGST |
|  |  | 84,000.00 |  | 5100 Cost of Goods Sold |
|  |  |  | 84,000.00 | 1400 Inventory |
| CN1 | 2026-10-05 | 1,850.00 |  | 4100 Sales — Goods |
|  |  | 166.50 |  | 2210 Output CGST |
|  |  | 166.50 |  | 2220 Output SGST/UTGST |
|  |  |  | 2,183.00 | 1300 Accounts Receivable (customer:C-BRIGHT) |
|  |  | 1,400.00 |  | 1400 Inventory |
|  |  |  | 1,400.00 | 5100 Cost of Goods Sold |
| CN2 | 2026-10-05 | 297.00 |  | 4100 Sales — Goods |
|  |  | 26.73 |  | 2210 Output CGST |
|  |  | 26.73 |  | 2220 Output SGST/UTGST |
|  |  |  | 0.46 | 4900 Round Off |
|  |  |  | 350.00 | 1100 Cash in Hand |
|  |  | 180.00 |  | 1400 Inventory |
|  |  |  | 180.00 | 5100 Cost of Goods Sold |
| CN3 | 2026-10-08 | 18,500.00 |  | 4100 Sales — Goods |
|  |  | 3,330.00 |  | 2230 Output IGST |
|  |  |  | 21,830.00 | 1250 Card/UPI Settlement Clearing |
|  |  | 14,000.00 |  | 1400 Inventory |
|  |  |  | 14,000.00 | 5100 Cost of Goods Sold |
| CN4 | 2026-10-10 | 6,540.00 |  | 4100 Sales — Goods |
|  |  | 588.60 |  | 2210 Output CGST |
|  |  | 588.60 |  | 2220 Output SGST/UTGST |
|  |  |  | 0.20 | 4900 Round Off |
|  |  |  | 7,717.00 | 1300 Accounts Receivable (customer:C-BRIGHT) |
|  |  | 4,800.00 |  | 1400 Inventory |
|  |  |  | 4,800.00 | 5100 Cost of Goods Sold |

## 10 purchases and expenses: ITC eligible and blocked, freight, a composition supplier, a debit note, expenses with and without ITC

A Delhi kirana buys from a Delhi distributor (with freight, a 50-paise bill difference and staff gift hampers whose ITC is blocked), from a Haryana mill (IGST) and from a composition dairy; returns part of the first bill; and books internet, an AC repair from Haryana on credit, electricity (no GSTIN) and a staff meal (ITC blocked).

*Business:* Sharma Kirana, state 07, regular scheme, bills rounded to the rupee.

*Purchases, debit notes and expenses*

| Document | Supplier | Taxable | CGST | SGST/UTGST | IGST | Cess | ITC claimed | Total |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| P1 purchase DFD/1021 | Delhi Foods Distributors (regular, 07) | 6,000.00 | 358.00 | 358.00 |  |  | 356.00 | 7,316.50 |
| P2 purchase HAM/552 | Haryana Agro Mills (regular, 06) | 8,000.00 |  |  | 400.00 |  | 400.00 | 8,400.00 |
| P3 purchase LD/77 | Yamuna Dairy (composition, 07) | 5,000.00 |  |  |  |  | 0.00 | 5,000.00 |
| DN1 debit note | against P1 | 2,120.00 | 118.00 | 118.00 |  |  | −56.00 | 2,356.00 |
| E1 expense 5440 | Airtel Delhi | 1,000.00 | 90.00 | 90.00 |  |  | 180.00 | 1,180.00 |
| E2 expense 5450 | Cool Air Services | 2,000.00 |  |  | 360.00 |  | 360.00 | 2,360.00 |
| E3 expense 5420 | BSES Yamuna (no GSTIN) | 3,500.00 |  |  |  |  | 0.00 | 3,500.00 |
| E4 expense 5900 | Punjabi Dhaba | 500.00 | 12.50 | 12.50 |  |  | 0.00 | 525.00 |

*GSTR-3B*

| Table | Description | Taxable | CGST | SGST/UTGST | IGST | Cess |
|---|---|---:|---:|---:|---:|---:|
| 4A5 | ITC available — all other ITC |  | 268.00 | 268.00 | 760.00 |  |
| 4B2 | ITC reversed — others |  | 28.00 | 28.00 |  |  |
| 4C | Net ITC available (A) − (B) |  | 240.00 | 240.00 | 760.00 |  |
| 4D2 | Ineligible ITC — others |  | 102.50 | 102.50 |  |  |

| Table 5 | Inter-state | Intra-state |
|---|---:|---:|
| From a supplier under composition scheme, exempt and nil rated supply |  | 5,000.00 |

*Journals*

| Document | Date | Dr | Cr | Account |
|---|---|---:|---:|---|
| P1 | 2026-10-02 | 6,960.00 |  | 1400 Inventory |
|  |  | 178.00 |  | 1510 Input CGST |
|  |  | 178.00 |  | 1520 Input SGST/UTGST |
|  |  | 0.50 |  | 4900 Round Off |
|  |  |  | 7,316.50 | 2100 Accounts Payable (supplier:S-DFD) |
| P2 | 2026-10-04 | 8,000.00 |  | 1400 Inventory |
|  |  | 400.00 |  | 1530 Input IGST |
|  |  |  | 8,400.00 | 2100 Accounts Payable (supplier:S-HAM) |
| P3 | 2026-10-05 | 5,000.00 |  | 1400 Inventory |
|  |  |  | 5,000.00 | 2100 Accounts Payable (supplier:S-DAIRY) |
| DN1 | 2026-10-08 | 2,356.00 |  | 2100 Accounts Payable (supplier:S-DFD) |
|  |  | 212.00 |  | 5110 Purchase-return Losses |
|  |  |  | 2,512.00 | 1400 Inventory |
|  |  |  | 28.00 | 1510 Input CGST |
|  |  |  | 28.00 | 1520 Input SGST/UTGST |
| E1 | 2026-10-06 | 1,000.00 |  | 5440 Internet |
|  |  | 90.00 |  | 1510 Input CGST |
|  |  | 90.00 |  | 1520 Input SGST/UTGST |
|  |  |  | 1,180.00 | 1200 Bank Accounts |
| E2 | 2026-10-07 | 2,000.00 |  | 5450 Repairs |
|  |  | 360.00 |  | 1530 Input IGST |
|  |  |  | 2,360.00 | 2100 Accounts Payable (supplier:V-COOL) |
| E3 | 2026-10-08 | 3,500.00 |  | 5420 Electricity |
|  |  |  | 3,500.00 | 1100 Cash in Hand |
| E4 | 2026-10-09 | 525.00 |  | 5900 Other Expenses |
|  |  |  | 525.00 | 1100 Cash in Hand |

## 11 month-end set-off with mixed heads: IGST credit first (rule 88A), cess only against cess, the rest by challan

A Delhi wholesaler's October: CGST/SGST and cess on local sales, IGST on a Haryana sale; IGST credit from a Haryana purchase, CGST/SGST and cess credit from a local one. IGST credit pays IGST, then CGST; SGST and part of cess are paid in cash.

*Business:* Gupta Wholesale, state 07, regular scheme.

**S1 — tax invoice T1/2627/00801** of 2026-10-14, Mehta Stores, GSTIN 07AABCM1234C1Z5; place of supply 07 (intra-state); GSTR-1 bucket `b2b`.

| Item | HSN | Qty | Price | Line disc. | Bill disc. share | Taxable | CGST | SGST/UTGST | IGST | Cess | Line total |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Bath soap 100 g @ 18% | 3401 | 40 PCS | 25.00 |  |  | 1,000.00 | 90.00 | 90.00 |  |  | 1,180.00 |

Round-off 0.00; **invoice value ₹1,180.00**.

**S2 — tax invoice T1/2627/00802** of 2026-10-15, Haryana Traders, GSTIN 06AABCH5678D1Z9; place of supply 06 (inter-state); GSTR-1 bucket `b2b`.

| Item | HSN | Qty | Price | Line disc. | Bill disc. share | Taxable | CGST | SGST/UTGST | IGST | Cess | Line total |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Mustard oil 1 L @ 5% | 1514 | 10 LTR | 100.00 |  |  | 1,000.00 |  |  | 50.00 |  | 1,050.00 |

Round-off 0.00; **invoice value ₹1,050.00**.

**S3 — tax invoice T1/2627/00803** of 2026-10-16, walk-in; place of supply 07 (intra-state); GSTR-1 bucket `b2cs`.

| Item | HSN | Qty | Price | Line disc. | Bill disc. share | Taxable | CGST | SGST/UTGST | IGST | Cess | Line total |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Cola 600 ml @ 28% | 2202 | 10 BTL | 10.00 |  |  | 100.00 | 14.00 | 14.00 |  | 12.00 | 140.00 |

Round-off 0.00; **invoice value ₹140.00**.

*Purchases, debit notes and expenses*

| Document | Supplier | Taxable | CGST | SGST/UTGST | IGST | Cess | ITC claimed | Total |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| P1 purchase HAM/601 | Haryana Agro Mills (regular, 06) | 2,400.00 |  |  | 120.00 |  | 120.00 | 2,520.00 |
| P2 purchase DFD/1100 | Delhi Foods Distributors (regular, 07) | 850.00 | 27.00 | 27.00 |  | 6.00 | 60.00 | 910.00 |

*B2B (4A)*

| GSTIN | Invoice | Value | POS | Rate | Taxable | CGST | SGST/UTGST | IGST | Cess |
|---|---|---:|---|---:|---:|---:|---:|---:|---:|
| 06AABCH5678D1Z9 | T1/2627/00802 | 1,050.00 | 06 | 5% | 1,000.00 |  |  | 50.00 |  |
| 07AABCM1234C1Z5 | T1/2627/00801 | 1,180.00 | 07 | 18% | 1,000.00 | 90.00 | 90.00 |  |  |

*B2CS (7)*

| POS | Rate | Taxable | CGST | SGST/UTGST | IGST | Cess |
|---|---:|---:|---:|---:|---:|---:|
| 07 | 28% | 100.00 | 14.00 | 14.00 |  | 12.00 |

*HSN summary (12)*

| Recipient | HSN | UQC | Qty | Rate | Total value | Taxable | CGST | SGST/UTGST | IGST | Cess |
|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| B2B | 1514 | LTR | 10 | 5% | 1,050.00 | 1,000.00 |  |  | 50.00 |  |
| B2B | 3401 | PCS | 40 | 18% | 1,180.00 | 1,000.00 | 90.00 | 90.00 |  |  |
| B2C | 2202 | BTL | 10 | 28% | 140.00 | 100.00 | 14.00 | 14.00 |  | 12.00 |

*Documents issued (13)*

| Nature | From | To | Total | Cancelled |
|---|---|---|---:|---:|
| invoice | T1/2627/00801 | T1/2627/00803 | 3 | 0 |

*GSTR-3B*

| Table | Description | Taxable | CGST | SGST/UTGST | IGST | Cess |
|---|---|---:|---:|---:|---:|---:|
| 3.1a | Outward taxable supplies (other than zero rated, nil rated and exempted) | 2,100.00 | 104.00 | 104.00 | 50.00 | 12.00 |
| 4A5 | ITC available — all other ITC |  | 27.00 | 27.00 | 120.00 | 6.00 |
| 4C | Net ITC available (A) − (B) |  | 27.00 | 27.00 | 120.00 | 6.00 |

*Set-off*

|  | IGST | CGST | SGST | Cess |
|---|---:|---:|---:|---:|
| Liability (output) | 50.00 | 104.00 | 104.00 | 12.00 |
| Credit (input) | 120.00 | 27.00 | 27.00 | 6.00 |
| Paid in cash |  | 7.00 | 77.00 | 6.00 |
| Credit carried forward |  |  |  |  |

Credit used, in order: IGST → IGST 50.00; IGST → CGST 70.00; CGST → CGST 27.00; SGST → SGST 27.00; Cess → cess 6.00.

*Journals*

| Document | Date | Dr | Cr | Account |
|---|---|---:|---:|---|
| S1 | 2026-10-14 | 1,180.00 |  | 1300 Accounts Receivable (customer:C-MEHTA) |
|  |  |  | 1,000.00 | 4100 Sales — Goods |
|  |  |  | 90.00 | 2210 Output CGST |
|  |  |  | 90.00 | 2220 Output SGST/UTGST |
|  |  | 800.00 |  | 5100 Cost of Goods Sold |
|  |  |  | 800.00 | 1400 Inventory |
| S2 | 2026-10-15 | 1,050.00 |  | 1250 Card/UPI Settlement Clearing |
|  |  |  | 1,000.00 | 4100 Sales — Goods |
|  |  |  | 50.00 | 2230 Output IGST |
|  |  | 850.00 |  | 5100 Cost of Goods Sold |
|  |  |  | 850.00 | 1400 Inventory |
| S3 | 2026-10-16 | 140.00 |  | 1100 Cash in Hand |
|  |  |  | 100.00 | 4100 Sales — Goods |
|  |  |  | 14.00 | 2210 Output CGST |
|  |  |  | 14.00 | 2220 Output SGST/UTGST |
|  |  |  | 12.00 | 2240 Output Cess |
|  |  | 60.00 |  | 5100 Cost of Goods Sold |
|  |  |  | 60.00 | 1400 Inventory |
| P1 | 2026-10-02 | 2,400.00 |  | 1400 Inventory |
|  |  | 120.00 |  | 1530 Input IGST |
|  |  |  | 2,520.00 | 2100 Accounts Payable (supplier:S-HAM) |
| P2 | 2026-10-03 | 850.00 |  | 1400 Inventory |
|  |  | 27.00 |  | 1510 Input CGST |
|  |  | 27.00 |  | 1520 Input SGST/UTGST |
|  |  | 6.00 |  | 1540 Input Cess |
|  |  |  | 910.00 | 2100 Accounts Payable (supplier:S-DFD) |
| SETOFF | 2026-10-31 | 50.00 |  | 2230 Output IGST |
|  |  | 104.00 |  | 2210 Output CGST |
|  |  | 104.00 |  | 2220 Output SGST/UTGST |
|  |  | 12.00 |  | 2240 Output Cess |
|  |  |  | 27.00 | 1510 Input CGST |
|  |  |  | 27.00 | 1520 Input SGST/UTGST |
|  |  |  | 120.00 | 1530 Input IGST |
|  |  |  | 6.00 | 1540 Input Cess |
|  |  |  | 90.00 | 2300 GST Payable |
| CHALLAN | 2026-11-18 | 90.00 |  | 2300 GST Payable |
|  |  |  | 90.00 | 1200 Bank Accounts |

## 12 year-end close: March set-off with credit carried forward, then income and expense to retained earnings

A Delhi kirana's last month of FY 2025-26: a purchase, two sales, rent and internet. March's output tax is covered by credit, and the year closes on 31 March with a profit of ₹3,073.27 to 3300 Retained Earnings.

*Business:* Sharma Kirana, state 07, regular scheme, bills rounded to the rupee.

**S1 — tax invoice T1/2526/00901** of 2026-03-10, walk-in; place of supply 07 (intra-state); GSTR-1 bucket `b2cs`.

| Item | HSN | Qty | Price | Line disc. | Bill disc. share | Taxable | CGST | SGST/UTGST | IGST | Cess | Line total |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Mustard oil 1 L @ 5% | 1514 | 300 LTR | 150.00 |  |  | 45,000.00 | 1,125.00 | 1,125.00 |  |  | 47,250.00 |

Round-off 0.00; **invoice value ₹47,250.00**.

**S2 — tax invoice T1/2526/00902** of 2026-03-20, walk-in; place of supply 07 (intra-state); GSTR-1 bucket `b2cs`.

| Item | HSN | Qty | Price | Line disc. | Bill disc. share | Taxable | CGST | SGST/UTGST | IGST | Cess | Line total |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Bath soap 100 g @ 18% | 3401 | 7 PCS | 35.50 |  |  | 248.50 | 22.37 | 22.36 |  |  | 293.23 |

Round-off −0.23; **invoice value ₹293.00**.

*Purchases, debit notes and expenses*

| Document | Supplier | Taxable | CGST | SGST/UTGST | IGST | Cess | ITC claimed | Total |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| P1 purchase DFD/0977 | Delhi Foods Distributors (regular, 07) | 48,000.00 | 1,200.00 | 1,200.00 |  |  | 2,400.00 | 50,400.00 |
| E1 expense 5400 | Shop landlord (no GSTIN) | 5,000.00 |  |  |  |  | 0.00 | 5,000.00 |
| E2 expense 5440 | Airtel Delhi | 1,000.00 | 90.00 | 90.00 |  |  | 180.00 | 1,180.00 |

*B2CS (7)*

| POS | Rate | Taxable | CGST | SGST/UTGST | IGST | Cess |
|---|---:|---:|---:|---:|---:|---:|
| 07 | 5% | 45,000.00 | 1,125.00 | 1,125.00 |  |  |
| 07 | 18% | 248.50 | 22.37 | 22.36 |  |  |

*HSN summary (12)*

| Recipient | HSN | UQC | Qty | Rate | Total value | Taxable | CGST | SGST/UTGST | IGST | Cess |
|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| B2C | 1514 | LTR | 300 | 5% | 47,250.00 | 45,000.00 | 1,125.00 | 1,125.00 |  |  |
| B2C | 3401 | PCS | 7 | 18% | 293.23 | 248.50 | 22.37 | 22.36 |  |  |

*Documents issued (13)*

| Nature | From | To | Total | Cancelled |
|---|---|---|---:|---:|
| invoice | T1/2526/00901 | T1/2526/00902 | 2 | 0 |

*GSTR-3B*

| Table | Description | Taxable | CGST | SGST/UTGST | IGST | Cess |
|---|---|---:|---:|---:|---:|---:|
| 3.1a | Outward taxable supplies (other than zero rated, nil rated and exempted) | 45,248.50 | 1,147.37 | 1,147.36 |  |  |
| 4A5 | ITC available — all other ITC |  | 1,290.00 | 1,290.00 |  |  |
| 4C | Net ITC available (A) − (B) |  | 1,290.00 | 1,290.00 |  |  |

*Set-off*

|  | IGST | CGST | SGST | Cess |
|---|---:|---:|---:|---:|
| Liability (output) |  | 1,147.37 | 1,147.36 |  |
| Credit (input) |  | 1,290.00 | 1,290.00 |  |
| Paid in cash |  |  |  |  |
| Credit carried forward |  | 142.63 | 142.64 |  |

Credit used, in order: CGST → CGST 1,147.37; SGST → SGST 1,147.36.

*Journals*

| Document | Date | Dr | Cr | Account |
|---|---|---:|---:|---|
| S1 | 2026-03-10 | 47,250.00 |  | 1100 Cash in Hand |
|  |  |  | 45,000.00 | 4100 Sales — Goods |
|  |  |  | 1,125.00 | 2210 Output CGST |
|  |  |  | 1,125.00 | 2220 Output SGST/UTGST |
|  |  | 36,000.00 |  | 5100 Cost of Goods Sold |
|  |  |  | 36,000.00 | 1400 Inventory |
| S2 | 2026-03-20 | 293.00 |  | 1100 Cash in Hand |
|  |  |  | 248.50 | 4100 Sales — Goods |
|  |  |  | 22.37 | 2210 Output CGST |
|  |  |  | 22.36 | 2220 Output SGST/UTGST |
|  |  | 0.23 |  | 4900 Round Off |
|  |  | 175.00 |  | 5100 Cost of Goods Sold |
|  |  |  | 175.00 | 1400 Inventory |
| P1 | 2026-03-05 | 48,000.00 |  | 1400 Inventory |
|  |  | 1,200.00 |  | 1510 Input CGST |
|  |  | 1,200.00 |  | 1520 Input SGST/UTGST |
|  |  |  | 50,400.00 | 2100 Accounts Payable (supplier:S-DFD) |
| E1 | 2026-03-01 | 5,000.00 |  | 5400 Rent |
|  |  |  | 5,000.00 | 1200 Bank Accounts |
| E2 | 2026-03-05 | 1,000.00 |  | 5440 Internet |
|  |  | 90.00 |  | 1510 Input CGST |
|  |  | 90.00 |  | 1520 Input SGST/UTGST |
|  |  |  | 1,180.00 | 1200 Bank Accounts |
| SETOFF | 2026-03-31 | 1,147.37 |  | 2210 Output CGST |
|  |  | 1,147.36 |  | 2220 Output SGST/UTGST |
|  |  |  | 1,147.37 | 1510 Input CGST |
|  |  |  | 1,147.36 | 1520 Input SGST/UTGST |
| CL/2526 | 2026-03-31 | 45,248.50 |  | 4100 Sales — Goods |
|  |  |  | 0.23 | 4900 Round Off |
|  |  |  | 36,175.00 | 5100 Cost of Goods Sold |
|  |  |  | 5,000.00 | 5400 Rent |
|  |  |  | 1,000.00 | 5440 Internet |
|  |  |  | 3,073.27 | 3300 Retained Earnings |
