import type { Business, Item, Party, Scenario } from './types.js';

// Rates are illustrative: they come from each shop's product master, never from code.
const ITEM = {
  atta: { name: 'Wheat atta 5 kg bag', hsn: '1101', uom: 'BAG', rateBp: 500 },
  soap: { name: 'Bath soap 100 g', hsn: '3401', uom: 'PCS', rateBp: 1800 },
  biscuits: { name: 'Biscuits 200 g', hsn: '1905', uom: 'PCS', rateBp: 1800 },
  milk: { name: 'Toned milk 1 L', hsn: '0401', uom: 'LTR', rateBp: 0, treatment: 'exempt' },
  salt: { name: 'Loose salt', hsn: '2501', uom: 'KG', rateBp: 0, treatment: 'nil_rated' },
  diesel: { name: 'High-speed diesel', hsn: '2710', uom: 'LTR', rateBp: 0, treatment: 'non_gst' },
  oil: { name: 'Mustard oil 1 L', hsn: '1514', uom: 'LTR', rateBp: 500 },
  ghee: { name: 'Desi ghee 1 L', hsn: '0405', uom: 'LTR', rateBp: 1200 },
  saree: { name: 'Hand-block saree', hsn: '5208', uom: 'PCS', rateBp: 500 },
  lamp: { name: 'Brass lamp', hsn: '7419', uom: 'PCS', rateBp: 1200 },
  sweets: { name: 'Kaju katli', hsn: '1704', uom: 'KG', rateBp: 500 },
  namkeen: { name: 'Namkeen 400 g', hsn: '2106', uom: 'PCS', rateBp: 1200 },
  sugar: { name: 'Sugar', hsn: '1701', uom: 'KG', rateBp: 500 },
  notebook: { name: 'Notebook', hsn: '4820', uom: 'PCS', rateBp: 500 },
  pen: { name: 'Ball pen', hsn: '9608', uom: 'PCS', rateBp: 500 },
  goldCoin: { name: 'Gold coin 24 ct', hsn: '7108', uom: 'G', rateBp: 300 },
  shirt: { name: 'Cotton shirt', hsn: '6205', uom: 'PCS', rateBp: 500 },
  jeans: { name: 'Denim jeans', hsn: '6203', uom: 'PCS', rateBp: 1800 },
  socks: { name: 'Socks', hsn: '6115', uom: 'PAIR', rateBp: 500 },
  cigarettes: { name: 'Cigarettes, pack of 10', hsn: '2402', uom: 'PKT', rateBp: 2800, cessRateBp: 500, cessPerUnitPaise: 1_000 },
  cola: { name: 'Cola 600 ml', hsn: '2202', uom: 'BTL', rateBp: 2800, cessRateBp: 1200 },
  fan: { name: 'Ceiling fan', hsn: '8414', uom: 'PCS', rateBp: 1800 },
  bulb: { name: 'LED bulb 9 W', hsn: '8539', uom: 'PCS', rateBp: 1800 },
  hamper: { name: 'Diwali gift hamper (staff gifts)', hsn: '2106', uom: 'PCS', rateBp: 1800 },
} satisfies Record<string, Item>;

const party = (id: string, name: string, stateCode: string, gstin?: string, scheme?: Party['scheme']): Party =>
  ({ id, name, stateCode, ...(gstin && { gstin }), ...(scheme && { scheme }) });
const MEHTA = party('C-MEHTA', 'Mehta Stores', '07', '07AABCM1234C1Z5');
const HARYANA_TRADERS = party('C-HRT', 'Haryana Traders', '06', '06AABCH5678D1Z9');
const DELHI_FOODS = party('S-DFD', 'Delhi Foods Distributors', '07', '07AAACD6666F1Z6');
const HARYANA_MILLS = party('S-HAM', 'Haryana Agro Mills', '06', '06AAACH7777G1Z7');
const AIRTEL = party('V-AIRTEL', 'Airtel Delhi', '07', '07AAACA9999J1Z9');

const shop = (name: string, stateCode = '07', o: Partial<Business> = {}): Business =>
  ({ name, stateCode, scheme: 'regular', roundToRupee: true, b2clThresholdPaise: 10_000_000, ...o });
const pct = (bp: number) => ({ kind: 'percent', value: bp }) as const;
const amt = (paise: number) => ({ kind: 'amount', value: paise }) as const;
const qty = (units: number) => units * 1000;

export const SCENARIOS: Scenario[] = [
  {
    name: 'HAND 01 kirana counter: intra-state B2C, exclusive and inclusive prices, an exempt line',
    story: 'A Delhi kirana sells atta and soap for cash, then biscuits (MRP, tax inclusive) and exempt milk by UPI. Bills round to the rupee.',
    business: shop('Sharma Kirana'),
    sales: [
      { ref: 'S1', number: 'T1/2627/00001', date: '2026-10-05', lines: [
        { item: ITEM.atta, qtyMilli: qty(2), unitPricePaise: 25_000, cogsPaise: 44_000 },
        { item: ITEM.soap, qtyMilli: qty(3), unitPricePaise: 3_550, cogsPaise: 7_500 },
      ] },
      { ref: 'S2', number: 'T1/2627/00002', date: '2026-10-05', paid: { upi: 23_200 }, lines: [
        { item: ITEM.biscuits, qtyMilli: qty(4), unitPricePaise: 3_000, inclusive: true, cogsPaise: 9_600 },
        { item: ITEM.milk, qtyMilli: qty(2), unitPricePaise: 5_600, cogsPaise: 10_000 },
      ] },
    ],
    hand: {
      values: {
        // S1: 500.00 @5% → 12.50 + 12.50; 106.50 @18% → 19.17 = 9.59 + 9.58 (CGST takes the half paisa); 650.67 → 651.00.
        'invoices.S1.result.taxablePaise': 60_650, 'invoices.S1.result.cgstPaise': 2_209, 'invoices.S1.result.sgstPaise': 2_208,
        'invoices.S1.result.roundOffPaise': 33, 'invoices.S1.result.totalPaise': 65_100, 'invoices.S1.result.gstr1Bucket': 'b2cs',
        // S2: 120.00 incl ÷ 1.18 = 101.69; tax 18.30 = 9.15 + 9.15; milk 112.00 exempt; 231.99 → 232.00.
        'invoices.S2.result.lines.0.taxablePaise': 10_169, 'invoices.S2.result.lines.0.totalPaise': 11_999, 'invoices.S2.result.cgstPaise': 915,
        'invoices.S2.result.roundOffPaise': 1, 'invoices.S2.result.totalPaise': 23_200,
        'gstr1.b2cs.0.rateBp': 500, 'gstr1.b2cs.0.taxablePaise': 50_000, 'gstr1.b2cs.0.cgstPaise': 1_250,
        'gstr1.b2cs.1.rateBp': 1800, 'gstr1.b2cs.1.taxablePaise': 20_819, 'gstr1.b2cs.1.cgstPaise': 1_874, 'gstr1.b2cs.1.sgstPaise': 1_873,
        'gstr1.exemp.3.kind': 'intra_unregistered', 'gstr1.exemp.3.exemptPaise': 11_200,
        'gstr1.hsn.0.hsn': '0401', 'gstr1.hsn.0.uqc': 'LTR', 'gstr1.hsn.0.totalValuePaise': 11_200,
        'gstr1.hsn.1.hsn': '1101', 'gstr1.hsn.1.uqc': 'BAG', 'gstr1.hsn.1.totalValuePaise': 52_500,
        'gstr1.hsn.2.hsn': '1905', 'gstr1.hsn.2.qtyMilli': 4_000, 'gstr1.hsn.2.totalValuePaise': 11_999,
        'gstr1.hsn.3.hsn': '3401', 'gstr1.hsn.3.cgstPaise': 959, 'gstr1.hsn.3.sgstPaise': 958, 'gstr1.hsn.3.totalValuePaise': 12_567,
        'gstr1.docs.0.total': 2, 'gstr1.docs.0.cancelled': 0,
        'gstr3b.rows.0.code': '3.1a', 'gstr3b.rows.0.taxablePaise': 70_819, 'gstr3b.rows.2.code': '3.1c', 'gstr3b.rows.2.taxablePaise': 11_200,
      },
      journals: {
        S1: ['Dr 1100 651.00', 'Cr 4100 606.50', 'Cr 2210 22.09', 'Cr 2220 22.08', 'Cr 4900 0.33', 'Dr 5100 515.00', 'Cr 1400 515.00'],
        S2: ['Dr 1250 232.00', 'Cr 4100 213.69', 'Cr 2210 9.15', 'Cr 2220 9.15', 'Cr 4900 0.01', 'Dr 5100 196.00', 'Cr 1400 196.00'],
      },
    },
  },
  {
    name: 'HAND 02 wholesale: B2B intra-state with a bill discount over three rates (C-4), B2B inter-state with a line discount',
    story: 'A Delhi wholesaler bills a Delhi retailer on credit with ₹100 off the bill, and a Haryana trader (IGST) with 5% off the soap line.',
    business: shop('Gupta Wholesale'),
    sales: [
      { ref: 'S1', number: 'T1/2627/00101', date: '2026-10-06', customer: MEHTA, paid: {}, billDiscount: amt(10_000), lines: [
        { item: ITEM.oil, qtyMilli: qty(10), unitPricePaise: 15_000, cogsPaise: 130_000 },
        { item: ITEM.soap, qtyMilli: qty(24), unitPricePaise: 3_250, cogsPaise: 60_000 },
        { item: ITEM.ghee, qtyMilli: qty(3), unitPricePaise: 55_000, cogsPaise: 144_000 },
      ] },
      { ref: 'S2', number: 'T1/2627/00102', date: '2026-10-06', customer: HARYANA_TRADERS, paid: { upi: 489_900 }, lines: [
        { item: ITEM.soap, qtyMilli: qty(48), unitPricePaise: 3_250, lineDiscount: pct(500), cogsPaise: 120_000 },
        { item: ITEM.oil, qtyMilli: qty(20), unitPricePaise: 15_000, cogsPaise: 260_000 },
      ] },
    ],
    hand: {
      values: {
        // ₹100 over 1,500 / 780 / 1,650: 38.1679 / 19.8473 / 41.9847 → 38.16 / 19.84 / 41.98 + the 2 paise to the largest remainders.
        'invoices.S1.result.lines.0.apportionedBillDiscountPaise': 3_817, 'invoices.S1.result.lines.1.apportionedBillDiscountPaise': 1_985,
        'invoices.S1.result.lines.2.apportionedBillDiscountPaise': 4_198,
        'invoices.S1.result.lines.0.cgstPaise': 3_655, 'invoices.S1.result.lines.0.sgstPaise': 3_654,
        'invoices.S1.result.lines.1.cgstPaise': 6_841, 'invoices.S1.result.lines.1.sgstPaise': 6_842,
        'invoices.S1.result.lines.2.cgstPaise': 9_648, 'invoices.S1.result.lines.2.sgstPaise': 9_648,
        'invoices.S1.result.taxablePaise': 383_000, 'invoices.S1.result.roundOffPaise': 12, 'invoices.S1.result.totalPaise': 423_300,
        'invoices.S1.result.gstr1Bucket': 'b2b',
        'invoices.S2.result.lineDiscountPaise': 7_800, 'invoices.S2.result.igstPaise': 41_676, 'invoices.S2.result.totalPaise': 489_900,
        'invoices.S2.result.supplyType': 'inter',
        'gstr1.b2b.0.gstin': '06AABCH5678D1Z9', 'gstr1.b2b.0.rateBp': 500, 'gstr1.b2b.0.igstPaise': 15_000,
        'gstr1.b2b.1.rateBp': 1800, 'gstr1.b2b.1.taxablePaise': 148_200, 'gstr1.b2b.1.igstPaise': 26_676,
        'gstr1.b2b.2.invoiceValuePaise': 423_300, 'gstr1.b2b.2.taxablePaise': 146_183, 'gstr1.b2b.3.rateBp': 1200, 'gstr1.b2b.3.cgstPaise': 9_648,
        'gstr1.b2b.4.taxablePaise': 76_015,
        'gstr1.hsn.0.hsn': '0405', 'gstr1.hsn.0.totalValuePaise': 180_098,
        'gstr1.hsn.1.hsn': '1514', 'gstr1.hsn.1.qtyMilli': 30_000, 'gstr1.hsn.1.taxablePaise': 446_183, 'gstr1.hsn.1.totalValuePaise': 468_492,
        'gstr1.hsn.2.hsn': '3401', 'gstr1.hsn.2.taxablePaise': 224_215, 'gstr1.hsn.2.totalValuePaise': 264_574,
        'gstr1.net.taxablePaise': 831_200, 'gstr1.net.igstPaise': 41_676, 'gstr1.net.cgstPaise': 20_144, 'gstr1.net.sgstPaise': 20_144,
      },
      journals: {
        S1: ['Dr 1300 4233.00', 'Cr 4100 3830.00', 'Cr 2210 201.44', 'Cr 2220 201.44', 'Cr 4900 0.12', 'Dr 5100 3340.00', 'Cr 1400 3340.00'],
        S2: ['Dr 1250 4899.00', 'Cr 4100 4482.00', 'Cr 2230 416.76', 'Cr 4900 0.24', 'Dr 5100 3800.00', 'Cr 1400 3800.00'],
      },
    },
  },
  {
    name: 'HAND 03 inter-state B2C: small (B2CS), large (B2CL) and an invoice of exactly ₹1,00,000',
    story: 'A Jaipur crafts shop ships sarees and a lamp to customers in other states. The B2CL line is "invoice value above ₹1,00,000"; '
      + 'a bill that rounds to exactly ₹1,00,000.00 stays in B2CS.',
    business: shop('Jaipur Handicrafts', '08'),
    sales: [
      { ref: 'S1', number: 'T1/2627/00011', date: '2026-10-07', placeOfSupply: '27', lines: [
        { item: ITEM.saree, qtyMilli: qty(2), unitPricePaise: 240_000, cogsPaise: 300_000 },
      ] },
      { ref: 'S2', number: 'T1/2627/00012', date: '2026-10-07', placeOfSupply: '27', paid: { upi: 10_640_000 }, lines: [
        { item: ITEM.lamp, qtyMilli: qty(1), unitPricePaise: 9_500_000, cogsPaise: 6_000_000 },
      ] },
      { ref: 'S3', number: 'T1/2627/00013', date: '2026-10-08', placeOfSupply: '06', lines: [
        { item: ITEM.saree, qtyMilli: qty(1), unitPricePaise: 9_523_810, cogsPaise: 7_000_000 },
      ] },
    ],
    hand: {
      values: {
        'invoices.S1.result.igstPaise': 24_000, 'invoices.S1.result.totalPaise': 504_000, 'invoices.S1.result.gstr1Bucket': 'b2cs',
        'invoices.S2.result.igstPaise': 1_140_000, 'invoices.S2.result.totalPaise': 10_640_000, 'invoices.S2.result.gstr1Bucket': 'b2cl',
        // 95,238.10 × 5% = 4,761.905 → 4,761.91; 1,00,000.01 rounds to 1,00,000.00, which is not above the threshold.
        'invoices.S3.result.igstPaise': 476_191, 'invoices.S3.result.roundOffPaise': -1, 'invoices.S3.result.totalPaise': 10_000_000,
        'invoices.S3.result.gstr1Bucket': 'b2cs',
        'gstr1.b2cl.0.placeOfSupply': '27', 'gstr1.b2cl.0.invoiceValuePaise': 10_640_000, 'gstr1.b2cl.0.igstPaise': 1_140_000,
        'gstr1.b2cs.0.placeOfSupply': '06', 'gstr1.b2cs.0.taxablePaise': 9_523_810, 'gstr1.b2cs.0.igstPaise': 476_191,
        'gstr1.b2cs.1.placeOfSupply': '27', 'gstr1.b2cs.1.taxablePaise': 480_000, 'gstr1.b2cs.1.igstPaise': 24_000,
        'gstr1.hsn.0.hsn': '5208', 'gstr1.hsn.0.qtyMilli': 3_000, 'gstr1.hsn.0.taxablePaise': 10_003_810, 'gstr1.hsn.0.totalValuePaise': 10_504_001,
        'gstr1.hsn.1.hsn': '7419', 'gstr1.hsn.1.totalValuePaise': 10_640_000,
      },
      journals: {
        S2: ['Dr 1250 106400.00', 'Cr 4100 95000.00', 'Cr 2230 11400.00', 'Dr 5100 60000.00', 'Cr 1400 60000.00'],
        S3: ['Dr 1100 100000.00', 'Cr 4100 95238.10', 'Cr 2230 4761.91', 'Dr 4900 0.01', 'Dr 5100 70000.00', 'Cr 1400 70000.00'],
      },
    },
  },
  {
    name: 'HAND 04 composition dealer: bills of supply, no tax, no ITC, nothing in GSTR-1',
    story: 'A UP sweet shop under the composition scheme sells to a walk-in and a registered customer, and buys sugar from a regular supplier. '
      + 'The printed bill of supply carries "Composition taxable person, not eligible to collect tax on supplies" at the top (CGST rule 5(1)(g)).',
    business: shop('Verma Sweets', '09', { scheme: 'composition' }),
    sales: [
      { ref: 'S1', number: 'T1/2627/00201', date: '2026-10-09', lines: [
        { item: ITEM.sweets, qtyMilli: 1_500, unitPricePaise: 90_000, cogsPaise: 90_000 },
        { item: ITEM.namkeen, qtyMilli: qty(3), unitPricePaise: 4_550, cogsPaise: 9_000 },
      ] },
      { ref: 'S2', number: 'T1/2627/00202', date: '2026-10-09', customer: party('C-RAM', 'Ram Caterers', '09', '09AAACR1111A1Z1'),
        paid: { upi: 441_000 }, billDiscount: pct(200), lines: [{ item: ITEM.sweets, qtyMilli: qty(5), unitPricePaise: 90_000, cogsPaise: 300_000 }] },
    ],
    purchases: [
      { ref: 'P1', number: 'T1P/2627/00001', date: '2026-10-03', supplierInvoiceNo: 'LKO/3391', supplier: party('S-LKO', 'Lucknow Sugar Traders', '09', '09AAACS2222B1Z2'),
        lines: [{ item: ITEM.sugar, qtyMilli: qty(50), unitPricePaise: 4_200 }] },
    ],
    hand: {
      values: {
        'invoices.S1.input.docType': 'bill_of_supply', 'invoices.S1.result.cgstPaise': 0, 'invoices.S1.result.sgstPaise': 0,
        // 1,350.00 + 136.50 = 1,486.50: exactly 50 paise rounds up to 1,487.00.
        'invoices.S1.result.roundOffPaise': 50, 'invoices.S1.result.totalPaise': 148_700, 'invoices.S1.result.gstr1Bucket': 'na',
        'invoices.S2.result.billDiscountPaise': 9_000, 'invoices.S2.result.totalPaise': 441_000, 'invoices.S2.result.gstr1Bucket': 'na',
        // The supplier charges 2.5% + 2.5%; a composition dealer cannot claim it, so it is part of the sugar's cost.
        'invoices.P1.result.cgstPaise': 5_250, 'purchases.P1.landedPaise.0': 220_500, 'purchases.P1.itc.cgstPaise': 0,
        'gstr1.applicable': false, 'gstr3b.applicable': false, 'itcRegister.0.ineligiblePaise': 10_500,
      },
      journals: {
        S1: ['Dr 1100 1487.00', 'Cr 4100 1486.50', 'Cr 4900 0.50', 'Dr 5100 990.00', 'Cr 1400 990.00'],
        P1: ['Dr 1400 2205.00', 'Cr 2100 2205.00'],
      },
    },
  },
  {
    name: 'HAND 05 exempt, nil-rated and non-GST lines mixed with taxable lines on one invoice',
    story: 'A Punjab highway store sells diesel (non-GST), soap and milk to a registered transporter on one bill, and salt and milk, '
      + 'then only diesel, to walk-ins. Each line goes to its own GSTR-1 table.',
    business: shop('Highway Mart', '03'),
    sales: [
      { ref: 'S1', number: 'T1/2627/00301', date: '2026-10-10', customer: party('C-SINGH', 'Singh Transport', '03', '03AAACS3333C1Z3'), paid: {}, lines: [
        { item: ITEM.diesel, qtyMilli: qty(50), unitPricePaise: 9_000, cogsPaise: 425_000 },
        { item: ITEM.soap, qtyMilli: qty(10), unitPricePaise: 3_500, cogsPaise: 25_000 },
        { item: ITEM.milk, qtyMilli: qty(5), unitPricePaise: 5_600, cogsPaise: 25_000 },
      ] },
      { ref: 'S2', number: 'T1/2627/00302', date: '2026-10-10', lines: [
        { item: ITEM.salt, qtyMilli: qty(2), unitPricePaise: 2_800, cogsPaise: 4_000 },
        { item: ITEM.milk, qtyMilli: qty(2), unitPricePaise: 5_600, cogsPaise: 10_000 },
      ] },
      { ref: 'S3', number: 'T1/2627/00303', date: '2026-10-10', lines: [{ item: ITEM.diesel, qtyMilli: qty(10), unitPricePaise: 9_000, cogsPaise: 85_000 }] },
    ],
    hand: {
      values: {
        'invoices.S1.result.taxablePaise': 513_000, 'invoices.S1.result.cgstPaise': 3_150, 'invoices.S1.result.totalPaise': 519_300,
        'invoices.S1.result.gstr1Bucket': 'b2b', 'invoices.S2.result.gstr1Bucket': 'exempt', 'invoices.S3.result.gstr1Bucket': 'non_gst',
        'gstr1.b2b.0.taxablePaise': 35_000, 'gstr1.b2b.0.cgstPaise': 3_150, 'gstr1.b2b.0.invoiceValuePaise': 519_300,
        'gstr1.exemp.1.kind': 'intra_registered', 'gstr1.exemp.1.exemptPaise': 28_000, 'gstr1.exemp.1.nonGstPaise': 450_000,
        'gstr1.exemp.3.kind': 'intra_unregistered', 'gstr1.exemp.3.nilPaise': 5_600, 'gstr1.exemp.3.exemptPaise': 11_200, 'gstr1.exemp.3.nonGstPaise': 90_000,
        'gstr3b.rows.0.taxablePaise': 35_000, 'gstr3b.rows.2.taxablePaise': 44_800, 'gstr3b.rows.4.code': '3.1e', 'gstr3b.rows.4.taxablePaise': 540_000,
        'gstr1.hsn.1.recipient': 'b2b', 'gstr1.hsn.1.hsn': '2710', 'gstr1.hsn.1.taxablePaise': 450_000,
        'gstr1.hsn.2.hsn': '3401', 'gstr1.hsn.2.totalValuePaise': 41_300, 'gstr1.hsn.4.hsn': '2501', 'gstr1.hsn.4.uqc': 'KGS',
      },
      journals: {
        S1: ['Dr 1300 5193.00', 'Cr 4100 5130.00', 'Cr 2210 31.50', 'Cr 2220 31.50', 'Dr 5100 4750.00', 'Cr 1400 4750.00'],
        S2: ['Dr 1100 168.00', 'Cr 4100 168.00', 'Dr 5100 140.00', 'Cr 1400 140.00'],
      },
    },
  },
  {
    name: 'HAND 06 rounding (C-3): tax per line, halves that re-sum, weighed quantity, inclusive MRP, round-off at exactly 50 paise',
    story: 'Three ₹10.25 notebooks taxed line by line (₹1.53 of tax, not the ₹1.54 an invoice-level calculation gives), 2.5 g of gold, '
      + 'and soap at MRP with a pen that brings the bill to exactly ₹144.50.',
    business: shop('Sharma General & Jewellers'),
    sales: [
      { ref: 'S1', number: 'T1/2627/00401', date: '2026-10-11', lines: [1, 2, 3].map(() => ({ item: ITEM.notebook, qtyMilli: qty(1), unitPricePaise: 1_025, cogsPaise: 700 })) },
      { ref: 'S2', number: 'T1/2627/00402', date: '2026-10-11', lines: [{ item: ITEM.goldCoin, qtyMilli: 2_500, unitPricePaise: 712_345, cogsPaise: 1_725_000 }] },
      { ref: 'S3', number: 'T1/2627/00403', date: '2026-10-11', lines: [
        { item: ITEM.soap, qtyMilli: qty(3), unitPricePaise: 4_500, inclusive: true, cogsPaise: 7_500 },
        { item: ITEM.pen, qtyMilli: qty(1), unitPricePaise: 905, cogsPaise: 500 },
      ] },
    ],
    hand: {
      values: {
        // Each line: 10.25 × 5% = 0.5125 → 0.51, split 0.26 + 0.25 (CGST = 10.25 × 2.5% = 0.25625 → 0.26).
        'invoices.S1.result.lines.0.cgstPaise': 26, 'invoices.S1.result.lines.0.sgstPaise': 25,
        'invoices.S1.result.cgstPaise': 78, 'invoices.S1.result.sgstPaise': 75, 'invoices.S1.result.roundOffPaise': -28, 'invoices.S1.result.totalPaise': 3_200,
        // 2.5 g × 7,123.45 = 17,808.625 → 17,808.63; 3% = 534.2589 → 534.26 = 267.13 + 267.13.
        'invoices.S2.result.grossPaise': 1_780_863, 'invoices.S2.result.cgstPaise': 26_713, 'invoices.S2.result.sgstPaise': 26_713,
        'invoices.S2.result.roundOffPaise': 11, 'invoices.S2.result.totalPaise': 1_834_300,
        // 135.00 ÷ 1.18 = 114.4068 → 114.41; tax 20.59 = 10.30 + 10.29; the line totals exactly the MRP.
        'invoices.S3.result.lines.0.taxablePaise': 11_441, 'invoices.S3.result.lines.0.cgstPaise': 1_030, 'invoices.S3.result.lines.0.sgstPaise': 1_029,
        'invoices.S3.result.lines.0.totalPaise': 13_500, 'invoices.S3.result.lines.1.totalPaise': 950,
        'invoices.S3.result.roundOffPaise': 50, 'invoices.S3.result.totalPaise': 14_500,
        'gstr1.b2cs.0.rateBp': 300, 'gstr1.b2cs.0.taxablePaise': 1_780_863,
        'gstr1.b2cs.1.rateBp': 500, 'gstr1.b2cs.1.taxablePaise': 3_980, 'gstr1.b2cs.1.cgstPaise': 101, 'gstr1.b2cs.1.sgstPaise': 97,
        'gstr1.b2cs.2.rateBp': 1800, 'gstr1.b2cs.2.taxablePaise': 11_441,
        'gstr1.hsn.1.hsn': '4820', 'gstr1.hsn.1.qtyMilli': 3_000, 'gstr1.hsn.1.totalValuePaise': 3_228,
        'gstr1.hsn.2.hsn': '7108', 'gstr1.hsn.2.uqc': 'GMS', 'gstr1.hsn.2.qtyMilli': 2_500, 'gstr1.hsn.2.totalValuePaise': 1_834_289,
      },
      journals: {
        S1: ['Dr 1100 32.00', 'Cr 4100 30.75', 'Cr 2210 0.78', 'Cr 2220 0.75', 'Dr 4900 0.28', 'Dr 5100 21.00', 'Cr 1400 21.00'],
        S2: ['Dr 1100 18343.00', 'Cr 4100 17808.63', 'Cr 2210 267.13', 'Cr 2220 267.13', 'Cr 4900 0.11', 'Dr 5100 17250.00', 'Cr 1400 17250.00'],
      },
    },
  },
  {
    name: 'HAND 07 discounts (C-4): line discounts first, then a 10% bill discount apportioned before tax over mixed rates',
    story: 'A Bengaluru garment shop: two MRP shirts with ₹50 off, jeans with 5% off and socks, then 10% off the whole bill. '
      + 'The bill discount is spread over the lines by value (largest remainder) before any tax is worked out.',
    business: shop('Kumar Garments', '29'),
    sales: [
      { ref: 'S1', number: 'T1/2627/00501', date: '2026-10-12', billDiscount: pct(1_000), lines: [
        { item: ITEM.shirt, qtyMilli: qty(2), unitPricePaise: 99_900, inclusive: true, lineDiscount: amt(5_000), cogsPaise: 110_000 },
        { item: ITEM.jeans, qtyMilli: qty(1), unitPricePaise: 299_900, lineDiscount: pct(500), cogsPaise: 150_000 },
        { item: ITEM.socks, qtyMilli: qty(3), unitPricePaise: 12_000, cogsPaise: 12_000 },
      ] },
    ],
    hand: {
      values: {
        // Shirts: 1,998.00 ÷ 1.05 = 1,902.86, less ₹50 = 1,852.86. Jeans: 2,999.00 less 149.95 = 2,849.05. Socks 360.00.
        'invoices.S1.result.lines.0.grossExPaise': 190_286, 'invoices.S1.result.lines.1.lineDiscountPaise': 14_995,
        // 10% of 5,061.91 = 506.19, spread 185.29 / 284.90 / 36.00.
        'invoices.S1.result.billDiscountPaise': 50_619, 'invoices.S1.result.lines.0.apportionedBillDiscountPaise': 18_529,
        'invoices.S1.result.lines.1.apportionedBillDiscountPaise': 28_490, 'invoices.S1.result.lines.2.apportionedBillDiscountPaise': 3_600,
        'invoices.S1.result.lines.0.taxablePaise': 166_757, 'invoices.S1.result.lines.1.taxablePaise': 256_415, 'invoices.S1.result.lines.2.taxablePaise': 32_400,
        'invoices.S1.result.lines.1.cgstPaise': 23_077, 'invoices.S1.result.lines.1.sgstPaise': 23_078,
        'invoices.S1.result.cgstPaise': 28_056, 'invoices.S1.result.sgstPaise': 28_057, 'invoices.S1.result.roundOffPaise': 15, 'invoices.S1.result.totalPaise': 511_700,
        'gstr1.hsn.0.hsn': '6115', 'gstr1.hsn.0.uqc': 'PRS',
      },
      journals: {
        S1: ['Dr 1100 5117.00', 'Cr 4100 4555.72', 'Cr 2210 280.56', 'Cr 2220 280.57', 'Cr 4900 0.15', 'Dr 5100 2720.00', 'Cr 1400 2720.00'],
      },
    },
  },
  {
    name: 'HAND 08 cess: ad valorem and per-unit, at MRP (inclusive) and wholesale (exclusive, inter-state)',
    story: 'A Delhi paan shop sells cigarettes (28% + 5% cess + ₹10 a pack) and cola (28% + 12% cess) at MRP, and 100 packs to a Haryana retailer.',
    business: shop('Paan Corner'),
    sales: [
      { ref: 'S1', number: 'T1/2627/00601', date: '2026-10-13', lines: [
        { item: ITEM.cigarettes, qtyMilli: qty(2), unitPricePaise: 15_000, inclusive: true, cogsPaise: 18_000 },
        { item: ITEM.cola, qtyMilli: qty(3), unitPricePaise: 4_000, inclusive: true, cogsPaise: 7_500 },
      ] },
      { ref: 'S2', number: 'T1/2627/00602', date: '2026-10-13', customer: party('C-PAN', 'Panipat Pan Bhandar', '06', '06AAACP4444D1Z4'), paid: { upi: 1_430_000 },
        lines: [{ item: ITEM.cigarettes, qtyMilli: qty(100), unitPricePaise: 10_000, cogsPaise: 900_000 }] },
    ],
    hand: {
      values: {
        // (300.00 − 20.00 per-unit cess) ÷ 1.33 = 210.53; GST 58.95 = 29.47 + 29.48; cess 10.53 + 20.00.
        'invoices.S1.result.lines.0.taxablePaise': 21_053, 'invoices.S1.result.lines.0.cgstPaise': 2_947, 'invoices.S1.result.lines.0.sgstPaise': 2_948,
        'invoices.S1.result.lines.0.cessPaise': 3_053, 'invoices.S1.result.lines.0.totalPaise': 30_001,
        // 120.00 ÷ 1.40 = 85.71; GST 24.00; cess 10.29; exactly the MRP.
        'invoices.S1.result.lines.1.taxablePaise': 8_571, 'invoices.S1.result.lines.1.cessPaise': 1_029, 'invoices.S1.result.lines.1.totalPaise': 12_000,
        'invoices.S1.result.cessPaise': 4_082, 'invoices.S1.result.roundOffPaise': -1, 'invoices.S1.result.totalPaise': 42_000,
        'invoices.S2.result.igstPaise': 280_000, 'invoices.S2.result.cessPaise': 150_000, 'invoices.S2.result.totalPaise': 1_430_000,
        'gstr1.b2b.0.cessPaise': 150_000, 'gstr1.b2cs.0.cessPaise': 4_082, 'gstr1.b2cs.0.cgstPaise': 4_147, 'gstr1.b2cs.0.sgstPaise': 4_148,
        'gstr1.hsn.0.recipient': 'b2b', 'gstr1.hsn.0.uqc': 'PAC', 'gstr1.hsn.0.totalValuePaise': 1_430_000,
        'gstr1.hsn.1.hsn': '2202', 'gstr1.hsn.1.cessPaise': 1_029, 'gstr1.hsn.2.hsn': '2402', 'gstr1.hsn.2.totalValuePaise': 30_001,
      },
      journals: {
        S1: ['Dr 1100 420.00', 'Cr 4100 296.24', 'Cr 2210 41.47', 'Cr 2220 41.48', 'Cr 2240 40.82', 'Dr 4900 0.01', 'Dr 5100 255.00', 'Cr 1400 255.00'],
        S2: ['Dr 1250 14300.00', 'Cr 4100 10000.00', 'Cr 2230 2800.00', 'Cr 2240 1500.00', 'Dr 5100 9000.00', 'Cr 1400 9000.00'],
      },
    },
  },
  {
    name: 'HAND 09 credit notes: partial and completing returns against B2B (CDNR), a cancel against B2CS, a part return against B2CL (CDNUR)',
    story: 'An electrical shop returns one fan to a builder (to their account), then the rest of that bill (which takes back its round-off); '
      + 'cancels a walk-in bill with a cash refund; and takes back 10 of 60 fans shipped to UP.',
    business: shop('Sharma Electricals'),
    sales: [
      { ref: 'S1', number: 'T1/2627/00701', date: '2026-10-03', customer: party('C-BRIGHT', 'Bright Builders', '07', '07AAACB5555E1Z5'), paid: {}, lines: [
        { item: ITEM.fan, qtyMilli: qty(4), unitPricePaise: 185_000, cogsPaise: 560_000 },
        { item: ITEM.bulb, qtyMilli: qty(10), unitPricePaise: 9_900, cogsPaise: 60_000 },
      ] },
      { ref: 'S2', number: 'T1/2627/00702', date: '2026-10-05', lines: [{ item: ITEM.bulb, qtyMilli: qty(3), unitPricePaise: 9_900, cogsPaise: 18_000 }] },
      { ref: 'S3', number: 'T1/2627/00703', date: '2026-10-06', placeOfSupply: '09', paid: { upi: 13_098_000 }, lines: [
        { item: ITEM.fan, qtyMilli: qty(60), unitPricePaise: 185_000, cogsPaise: 8_400_000 },
      ] },
    ],
    creditNotes: [
      { ref: 'CN1', number: 'T1C/2627/00001', date: '2026-10-05', saleRef: 'S1', lines: [{ line: 0, qtyMilli: qty(1) }], refundBy: 'account' },
      { ref: 'CN2', number: 'T1C/2627/00002', date: '2026-10-05', saleRef: 'S2', lines: [{ line: 0, qtyMilli: qty(3) }], refundBy: 'cash' },
      { ref: 'CN3', number: 'T1C/2627/00003', date: '2026-10-08', saleRef: 'S3', lines: [{ line: 0, qtyMilli: qty(10) }], refundBy: 'upi' },
      { ref: 'CN4', number: 'T1C/2627/00004', date: '2026-10-10', saleRef: 'S1', lines: [{ line: 0, qtyMilli: qty(3) }, { line: 1, qtyMilli: qty(10) }], refundBy: 'cash' },
    ],
    hand: {
      values: {
        'invoices.S1.result.cgstPaise': 75_510, 'invoices.S1.result.roundOffPaise': -20, 'invoices.S1.result.totalPaise': 990_000,
        'invoices.S2.result.roundOffPaise': -46, 'invoices.S2.result.totalPaise': 35_000, 'invoices.S3.result.gstr1Bucket': 'b2cl',
        'creditNotes.CN1.result.taxablePaise': 185_000, 'creditNotes.CN1.result.cgstPaise': 16_650, 'creditNotes.CN1.result.roundOffPaise': 0,
        'creditNotes.CN1.result.totalPaise': 218_300, 'creditNotes.CN1.toAccountPaise': 218_300,
        'creditNotes.CN2.result.roundOffPaise': -46, 'creditNotes.CN2.result.totalPaise': 35_000, 'creditNotes.CN2.refundPaise': 35_000,
        'creditNotes.CN3.result.taxablePaise': 1_850_000, 'creditNotes.CN3.result.igstPaise': 333_000, 'creditNotes.CN3.result.totalPaise': 2_183_000,
        // The rest of S1: 7,400 − 1,850 for the fans, 990 for the bulbs, and the bill's −0.20 back; all of it settles what the builder owes.
        'creditNotes.CN4.result.taxablePaise': 654_000, 'creditNotes.CN4.result.cgstPaise': 58_860, 'creditNotes.CN4.result.roundOffPaise': -20,
        'creditNotes.CN4.result.totalPaise': 771_700, 'creditNotes.CN4.result.completesSale': true, 'creditNotes.CN4.toAccountPaise': 771_700,
        'creditNotes.CN4.refundPaise': 0,
        'gstr1.b2b.0.taxablePaise': 839_000, 'gstr1.b2b.0.invoiceValuePaise': 990_000,
        'gstr1.cdnr.0.noteNumber': 'T1C/2627/00001', 'gstr1.cdnr.0.noteValuePaise': 218_300, 'gstr1.cdnr.1.noteValuePaise': 771_700, 'gstr1.cdnr.1.cgstPaise': 58_860,
        'gstr1.b2cs.0.taxablePaise': 0, 'gstr1.b2cs.0.cgstPaise': 0,
        'gstr1.b2cl.0.invoiceValuePaise': 13_098_000, 'gstr1.cdnur.0.urType': 'B2CL', 'gstr1.cdnur.0.noteValuePaise': 2_183_000, 'gstr1.cdnur.0.igstPaise': 333_000,
        'gstr1.net.taxablePaise': 9_250_000, 'gstr1.net.igstPaise': 1_665_000, 'gstr1.net.cgstPaise': 0, 'gstr1.net.sgstPaise': 0,
        'gstr1.hsn.2.recipient': 'b2c', 'gstr1.hsn.2.hsn': '8414', 'gstr1.hsn.2.qtyMilli': 50_000, 'gstr1.hsn.2.totalValuePaise': 10_915_000,
        'gstr1.docs.0.total': 3, 'gstr1.docs.1.nature': 'credit_note', 'gstr1.docs.1.total': 4,
      },
      journals: {
        CN1: ['Dr 4100 1850.00', 'Dr 2210 166.50', 'Dr 2220 166.50', 'Cr 1300 2183.00', 'Dr 1400 1400.00', 'Cr 5100 1400.00'],
        CN2: ['Dr 4100 297.00', 'Dr 2210 26.73', 'Dr 2220 26.73', 'Cr 4900 0.46', 'Cr 1100 350.00', 'Dr 1400 180.00', 'Cr 5100 180.00'],
        CN3: ['Dr 4100 18500.00', 'Dr 2230 3330.00', 'Cr 1250 21830.00', 'Dr 1400 14000.00', 'Cr 5100 14000.00'],
        CN4: ['Dr 4100 6540.00', 'Dr 2210 588.60', 'Dr 2220 588.60', 'Cr 4900 0.20', 'Cr 1300 7717.00', 'Dr 1400 4800.00', 'Cr 5100 4800.00'],
      },
    },
  },
  {
    name: 'HAND 10 purchases and expenses: ITC eligible and blocked, freight, a composition supplier, a debit note, expenses with and without ITC',
    story: 'A Delhi kirana buys from a Delhi distributor (with freight, a 50-paise bill difference and staff gift hampers whose ITC is blocked), '
      + 'from a Haryana mill (IGST) and from a composition dairy; returns part of the first bill; and books internet, an AC repair from '
      + 'Haryana on credit, electricity (no GSTIN) and a staff meal (ITC blocked).',
    business: shop('Sharma Kirana'),
    purchases: [
      { ref: 'P1', number: 'T1P/2627/00001', date: '2026-10-02', supplierInvoiceNo: 'DFD/1021', supplier: DELHI_FOODS, chargesPaise: 60_000, billTotalPaise: 731_650, lines: [
        { item: ITEM.oil, qtyMilli: qty(20), unitPricePaise: 14_000 },
        { item: ITEM.soap, qtyMilli: qty(48), unitPricePaise: 2_500 },
        { item: ITEM.hamper, qtyMilli: qty(2), unitPricePaise: 100_000, itcEligible: false },
      ] },
      { ref: 'P2', number: 'T1P/2627/00002', date: '2026-10-04', supplierInvoiceNo: 'HAM/552', supplier: HARYANA_MILLS,
        lines: [{ item: ITEM.atta, qtyMilli: qty(40), unitPricePaise: 20_000 }] },
      { ref: 'P3', number: 'T1P/2627/00003', date: '2026-10-05', supplierInvoiceNo: 'LD/77',
        supplier: party('S-DAIRY', 'Yamuna Dairy', '07', '07AAACL8888H1Z8', 'composition'), lines: [{ item: ITEM.ghee, qtyMilli: qty(10), unitPricePaise: 50_000 }] },
    ],
    debitNotes: [
      { ref: 'DN1', number: 'T1D/2627/00001', date: '2026-10-08', purchaseRef: 'P1', lines: [{ line: 0, qtyMilli: qty(8) }, { line: 2, qtyMilli: qty(1) }] },
    ],
    expenses: [
      { ref: 'E1', number: 'T1E/2627/00001', date: '2026-10-06', vendor: AIRTEL, accountCode: '5440', amountPaise: 100_000, gstRateBp: 1800, method: 'bank' },
      { ref: 'E2', number: 'T1E/2627/00002', date: '2026-10-07', vendor: party('V-COOL', 'Cool Air Services', '06', '06AAACT1234K1Z2'), accountCode: '5450',
        amountPaise: 236_000, inclusive: true, gstRateBp: 1800, method: 'credit' },
      { ref: 'E3', number: 'T1E/2627/00003', date: '2026-10-08', vendor: party('V-BSES', 'BSES Yamuna', '07'), accountCode: '5420', amountPaise: 350_000, method: 'cash' },
      { ref: 'E4', number: 'T1E/2627/00004', date: '2026-10-09', vendor: party('V-DHABA', 'Punjabi Dhaba', '07', '07AAACP1212L1Z3'), accountCode: '5900',
        amountPaise: 50_000, gstRateBp: 500, itcEligible: false, method: 'cash' },
    ],
    hand: {
      values: {
        // ₹600 freight over 2,800 / 1,200 / 2,000 of taxable value: 280 / 120 / 200; the hampers also carry their ₹360 of blocked tax.
        'purchases.P1.landedPaise.0': 308_000, 'purchases.P1.landedPaise.1': 132_000, 'purchases.P1.landedPaise.2': 256_000,
        'purchases.P1.itc.cgstPaise': 17_800, 'purchases.P1.itc.sgstPaise': 17_800, 'purchases.P1.roundOffPaise': 50, 'purchases.P1.totalPaise': 731_650,
        'invoices.P2.result.igstPaise': 40_000, 'invoices.P3.result.cgstPaise': 0, 'invoices.P3.input.docType': 'bill_of_supply',
        // 8 of 20 oil and 1 of 2 hampers: tax back 28 + 28 on the oil only; the freight share (112 + 100) is kept by the supplier.
        'debitNotes.DN1.taxablePaise': 212_000, 'debitNotes.DN1.cgstPaise': 11_800, 'debitNotes.DN1.inventoryPaise': 251_200,
        'debitNotes.DN1.itcReversed.cgstPaise': 2_800, 'debitNotes.DN1.lossPaise': 21_200, 'debitNotes.DN1.totalPaise': 235_600,
        'invoices.E2.result.taxablePaise': 200_000, 'invoices.E2.result.igstPaise': 36_000,
        'gstr3b.rows.5.code': '4A5', 'gstr3b.rows.5.igstPaise': 76_000, 'gstr3b.rows.5.cgstPaise': 26_800, 'gstr3b.rows.5.sgstPaise': 26_800,
        'gstr3b.rows.6.code': '4B2', 'gstr3b.rows.6.cgstPaise': 2_800, 'gstr3b.rows.6.sgstPaise': 2_800,
        'gstr3b.rows.7.code': '4C', 'gstr3b.rows.7.igstPaise': 76_000, 'gstr3b.rows.7.cgstPaise': 24_000,
        'gstr3b.rows.8.code': '4D2', 'gstr3b.rows.8.cgstPaise': 10_250, 'gstr3b.rows.8.sgstPaise': 10_250,
        'gstr3b.inward.0.intraPaise': 500_000, 'gstr3b.inward.1.intraPaise': 0,
      },
      journals: {
        P1: ['Dr 1400 6960.00', 'Dr 1510 178.00', 'Dr 1520 178.00', 'Dr 4900 0.50', 'Cr 2100 7316.50'],
        P2: ['Dr 1400 8000.00', 'Dr 1530 400.00', 'Cr 2100 8400.00'],
        P3: ['Dr 1400 5000.00', 'Cr 2100 5000.00'],
        DN1: ['Dr 2100 2356.00', 'Dr 5110 212.00', 'Cr 1400 2512.00', 'Cr 1510 28.00', 'Cr 1520 28.00'],
        E1: ['Dr 5440 1000.00', 'Dr 1510 90.00', 'Dr 1520 90.00', 'Cr 1200 1180.00'],
        E2: ['Dr 5450 2000.00', 'Dr 1530 360.00', 'Cr 2100 2360.00'],
        E3: ['Dr 5420 3500.00', 'Cr 1100 3500.00'],
        E4: ['Dr 5900 525.00', 'Cr 1100 525.00'],
      },
    },
  },
  {
    name: 'HAND 11 month-end set-off with mixed heads: IGST credit first (rule 88A), cess only against cess, the rest by challan',
    story: 'A Delhi wholesaler\'s October: CGST/SGST and cess on local sales, IGST on a Haryana sale; IGST credit from a Haryana purchase, '
      + 'CGST/SGST and cess credit from a local one. IGST credit pays IGST, then CGST; SGST and part of cess are paid in cash.',
    business: shop('Gupta Wholesale', '07', { roundToRupee: false }),
    sales: [
      { ref: 'S1', number: 'T1/2627/00801', date: '2026-10-14', customer: MEHTA, paid: {}, lines: [{ item: ITEM.soap, qtyMilli: qty(40), unitPricePaise: 2_500, cogsPaise: 80_000 }] },
      { ref: 'S2', number: 'T1/2627/00802', date: '2026-10-15', customer: HARYANA_TRADERS, paid: { upi: 105_000 }, lines: [
        { item: ITEM.oil, qtyMilli: qty(10), unitPricePaise: 10_000, cogsPaise: 85_000 },
      ] },
      { ref: 'S3', number: 'T1/2627/00803', date: '2026-10-16', lines: [{ item: ITEM.cola, qtyMilli: qty(10), unitPricePaise: 1_000, cogsPaise: 6_000 }] },
    ],
    purchases: [
      { ref: 'P1', number: 'T1P/2627/00011', date: '2026-10-02', supplierInvoiceNo: 'HAM/601', supplier: HARYANA_MILLS,
        lines: [{ item: ITEM.atta, qtyMilli: qty(12), unitPricePaise: 20_000 }] },
      { ref: 'P2', number: 'T1P/2627/00012', date: '2026-10-03', supplierInvoiceNo: 'DFD/1100', supplier: DELHI_FOODS, lines: [
        { item: ITEM.oil, qtyMilli: qty(8), unitPricePaise: 10_000 },
        { item: ITEM.cola, qtyMilli: qty(5), unitPricePaise: 1_000 },
      ] },
    ],
    setoff: { date: '2026-10-31', challanDate: '2026-11-18' },
    hand: {
      values: {
        'setoff.liability.igstPaise': 5_000, 'setoff.liability.cgstPaise': 10_400, 'setoff.liability.sgstPaise': 10_400, 'setoff.liability.cessPaise': 1_200,
        'setoff.credit.igstPaise': 12_000, 'setoff.credit.cgstPaise': 2_700, 'setoff.credit.sgstPaise': 2_700, 'setoff.credit.cessPaise': 600,
        'setoff.result.utilisation.igstToIgstPaise': 5_000, 'setoff.result.utilisation.igstToCgstPaise': 7_000, 'setoff.result.utilisation.igstToSgstPaise': 0,
        'setoff.result.utilisation.cgstToCgstPaise': 2_700, 'setoff.result.utilisation.sgstToSgstPaise': 2_700, 'setoff.result.utilisation.cessToCessPaise': 600,
        'setoff.result.cash.igstPaise': 0, 'setoff.result.cash.cgstPaise': 700, 'setoff.result.cash.sgstPaise': 7_700, 'setoff.result.cash.cessPaise': 600,
        'setoff.result.creditLeft.igstPaise': 0,
        'gstr3b.outputTax.cgstPaise': 10_400, 'gstr3b.netItc.igstPaise': 12_000,
      },
      journals: {
        SETOFF: ['Dr 2230 50.00', 'Dr 2210 104.00', 'Dr 2220 104.00', 'Dr 2240 12.00', 'Cr 1510 27.00', 'Cr 1520 27.00', 'Cr 1530 120.00', 'Cr 1540 6.00', 'Cr 2300 90.00'],
        CHALLAN: ['Dr 2300 90.00', 'Cr 1200 90.00'],
      },
    },
  },
  {
    name: 'HAND 12 year-end close: March set-off with credit carried forward, then income and expense to retained earnings',
    story: 'A Delhi kirana\'s last month of FY 2025-26: a purchase, two sales, rent and internet. March\'s output tax is covered by credit, '
      + 'and the year closes on 31 March with a profit of ₹3,073.27 to 3300 Retained Earnings.',
    business: shop('Sharma Kirana'),
    sales: [
      { ref: 'S1', number: 'T1/2526/00901', date: '2026-03-10', lines: [{ item: ITEM.oil, qtyMilli: qty(300), unitPricePaise: 15_000, cogsPaise: 3_600_000 }] },
      { ref: 'S2', number: 'T1/2526/00902', date: '2026-03-20', lines: [{ item: ITEM.soap, qtyMilli: qty(7), unitPricePaise: 3_550, cogsPaise: 17_500 }] },
    ],
    purchases: [
      { ref: 'P1', number: 'T1P/2526/00031', date: '2026-03-05', supplierInvoiceNo: 'DFD/0977', supplier: DELHI_FOODS,
        lines: [{ item: ITEM.oil, qtyMilli: qty(400), unitPricePaise: 12_000 }] },
    ],
    expenses: [
      { ref: 'E1', number: 'T1E/2526/00041', date: '2026-03-01', vendor: party('V-LANDLORD', 'Shop landlord', '07'), accountCode: '5400', amountPaise: 500_000, method: 'bank' },
      { ref: 'E2', number: 'T1E/2526/00042', date: '2026-03-05', vendor: AIRTEL, accountCode: '5440', amountPaise: 100_000, gstRateBp: 1800, method: 'bank' },
    ],
    setoff: { date: '2026-03-31', challanDate: '2026-04-18' },
    yearEnd: { fy: '2025-26' },
    hand: {
      values: {
        // 248.50 × 18% = 44.73 = 22.37 + 22.36; 293.23 → 293.00.
        'invoices.S2.result.cgstPaise': 2_237, 'invoices.S2.result.sgstPaise': 2_236, 'invoices.S2.result.roundOffPaise': -23,
        'setoff.result.cash.cgstPaise': 0, 'setoff.result.cash.sgstPaise': 0, 'setoff.result.creditLeft.cgstPaise': 14_263, 'setoff.result.creditLeft.sgstPaise': 14_264,
      },
      journals: {
        S1: ['Dr 1100 47250.00', 'Cr 4100 45000.00', 'Cr 2210 1125.00', 'Cr 2220 1125.00', 'Dr 5100 36000.00', 'Cr 1400 36000.00'],
        SETOFF: ['Dr 2210 1147.37', 'Dr 2220 1147.36', 'Cr 1510 1147.37', 'Cr 1520 1147.36'],
        'CL/2526': ['Dr 4100 45248.50', 'Cr 4900 0.23', 'Cr 5100 36175.00', 'Cr 5400 5000.00', 'Cr 5440 1000.00', 'Cr 3300 3073.27'],
      },
    },
  },
];
