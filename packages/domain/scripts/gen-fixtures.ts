/**
 * Generates packages/domain/fixtures/gst/*.json — the cross-language golden vectors.
 *
 * Provenance: HAND-VERIFIED cases carry expected values typed in by a human and are asserted
 * against the engine here (a mismatch aborts generation). All other cases are engine-generated
 * and FROZEN: once committed, a diff in this file's output is a behaviour change that must be
 * reviewed deliberately, never regenerated to "make it green".
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { computeInvoice } from '../src/index.js';
import type { Discount, GstFixtureCase, GstFixtureFile, GstInvoiceInput, GstLineInput, TaxTreatment } from '../src/index.js';
import { allocationFixtures } from './allocationFixtures.js';
import { returnFixtures } from './returnFixtures.js';
import { setoffFixtures } from './setoffFixtures.js';

const out = fileURLToPath(new URL('../fixtures/gst/', import.meta.url));
mkdirSync(out, { recursive: true });

const NO: Discount = { kind: 'amount', value: 0 };
const line = (o: Partial<GstLineInput> = {}): GstLineInput => ({
  qtyMilli: 1000, unitPricePaise: 10_000, priceIsInclusive: false, lineDiscount: NO,
  gstRateBp: 1800, cessRateBp: 0, cessPerUnitPaise: 0, taxTreatment: 'taxable', ...o,
});
const inv = (o: Partial<GstInvoiceInput> = {}): GstInvoiceInput => ({
  docType: 'tax_invoice', supplierStateCode: '07', placeOfSupplyStateCode: '07',
  isUnionTerritoryWithoutLegislature: false, taxScheme: 'regular', billDiscount: NO,
  roundToRupee: false, b2clThresholdPaise: 10_000_000, lines: [line()], ...o,
});

type Hand = { name: string; input: GstInvoiceInput; check: Record<string, number | string> };
const hand: Hand[] = [
  { name: 'HAND ₹100 excl @18% intra: 900+900', input: inv(),
    check: { taxablePaise: 10_000, cgstPaise: 900, sgstPaise: 900, igstPaise: 0, totalPaise: 11_800, gstr1Bucket: 'b2cs' } },
  { name: 'HAND ₹118 incl @18% intra back-calc', input: inv({ lines: [line({ unitPricePaise: 11_800, priceIsInclusive: true })] }),
    check: { grossPaise: 11_800, taxablePaise: 10_000, cgstPaise: 900, sgstPaise: 900, totalPaise: 11_800 } },
  { name: 'HAND ₹100 incl @5%: 9524 + 476', input: inv({ lines: [line({ priceIsInclusive: true, gstRateBp: 500 })] }),
    check: { taxablePaise: 9_524, cgstPaise: 238, sgstPaise: 238, totalPaise: 10_000 } },
  { name: 'HAND ₹1,00,000 @0.25% (gold): halves 12500/12500', input: inv({ lines: [line({ unitPricePaise: 10_000_000, gstRateBp: 25 })] }),
    check: { cgstPaise: 12_500, sgstPaise: 12_500, totalPaise: 10_025_000 } },
  { name: 'HAND ₹100 excl @18% inter: IGST 1800', input: inv({ placeOfSupplyStateCode: '06' }),
    check: { cgstPaise: 0, sgstPaise: 0, igstPaise: 1_800, totalPaise: 11_800 } },
  { name: 'HAND 3×₹10 with ₹1 bill discount → 34/33/33', input: inv({ billDiscount: { kind: 'amount', value: 100 }, lines: [line({ unitPricePaise: 1000 }), line({ unitPricePaise: 1000 }), line({ unitPricePaise: 1000 })] }),
    check: { billDiscountPaise: 100, taxablePaise: 2_900 } },
  { name: 'HAND round-off up: 118.51 → 119.00', input: inv({ roundToRupee: true, lines: [line({ unitPricePaise: 10_043 })] }),
    check: { roundOffPaise: 49, totalPaise: 11_900 } }, // 10043×1.18 = 11850.74 → 11851
  { name: 'HAND round-off exactly .50 → up', input: inv({ roundToRupee: true, lines: [line({ unitPricePaise: 5_000, gstRateBp: 1800 }), line({ unitPricePaise: 5_042, gstRateBp: 1800 })] }),
    check: { roundOffPaise: 50, totalPaise: 11_900 } }, // 5900 + 5949.56→5950 = 11850
  { name: 'HAND round-off down: 118.49 → 118.00', input: inv({ roundToRupee: true, lines: [line({ unitPricePaise: 10_041 })] }),
    check: { roundOffPaise: -49, totalPaise: 11_800 } }, // 10041×1.18 = 11848.38 → 11848 → wait, see assert
  { name: 'HAND composition: bill of supply, no tax, bucket na', input: inv({ taxScheme: 'composition', docType: 'bill_of_supply' }),
    check: { cgstPaise: 0, sgstPaise: 0, igstPaise: 0, totalPaise: 10_000, gstr1Bucket: 'na' } },
  { name: 'HAND B2B bucket with GSTIN', input: inv({ customerGstin: '07AAAAA0000A1Z5' }), check: { gstr1Bucket: 'b2b' } },
  { name: 'HAND credit note with GSTIN → cdnr', input: inv({ docType: 'credit_note', customerGstin: '07AAAAA0000A1Z5' }), check: { gstr1Bucket: 'cdnr' } },
  { name: 'HAND credit note without GSTIN → cdnur', input: inv({ docType: 'credit_note' }), check: { gstr1Bucket: 'cdnur' } },
  { name: 'HAND inter-state B2C above threshold → b2cl', input: inv({ placeOfSupplyStateCode: '27', b2clThresholdPaise: 10_000, lines: [line({ unitPricePaise: 100_000 })] }), check: { gstr1Bucket: 'b2cl' } },
  { name: 'HAND all exempt → exempt bucket, zero tax', input: inv({ lines: [line({ taxTreatment: 'exempt', gstRateBp: 0 })] }), check: { gstr1Bucket: 'exempt', totalPaise: 10_000 } },
  { name: 'HAND UT without legislature → utgst label', input: inv({ supplierStateCode: '04', placeOfSupplyStateCode: '04', isUnionTerritoryWithoutLegislature: true }), check: { stateTaxKind: 'utgst', cgstPaise: 900, sgstPaise: 900 } },
  { name: 'HAND 1.250 kg @ ₹100/kg @5%', input: inv({ lines: [line({ qtyMilli: 1250, unitPricePaise: 10_000, gstRateBp: 500 })] }),
    check: { grossPaise: 12_500, cgstPaise: 313, sgstPaise: 312, totalPaise: 13_125 } }, // tax 625 → cgst divRound(12500*500,20000)=312.5→313
  { name: 'HAND inclusive MRP with 12% cess (aerated) divides by 10000+2800+1200', input: inv({ lines: [line({ unitPricePaise: 14_000, priceIsInclusive: true, gstRateBp: 2800, cessRateBp: 1200 })] }),
    check: { taxablePaise: 10_000, cgstPaise: 1_400, sgstPaise: 1_400, cessPaise: 1_200, totalPaise: 14_000 } },
  // (15000 − 1000 per-unit cess) × 10000 / 13300 = 10526.32 → 10526; tax 2947 (1474 + 1473); cess 526 + 1000; total 14999 ≈ MRP.
  { name: 'HAND inclusive MRP with per-unit cess keeps the total at the MRP', input: inv({ lines: [line({ unitPricePaise: 15_000, priceIsInclusive: true, gstRateBp: 2800, cessRateBp: 500, cessPerUnitPaise: 1_000 })] }),
    check: { taxablePaise: 10_526, cgstPaise: 1_474, sgstPaise: 1_473, cessPaise: 1_526, totalPaise: 14_999 } },
  { name: 'HAND single paise invoice @18%', input: inv({ lines: [line({ unitPricePaise: 1 })] }),
    check: { taxablePaise: 1, cgstPaise: 0, sgstPaise: 0, totalPaise: 1 } },
];
// Fix the one comment above: 10041 × 1.18 = 11848.38 → 11848 → round to 11800 → -48. Assert the real value.
hand[8]!.check = { roundOffPaise: -48, totalPaise: 11_800 };

const cases: GstFixtureCase[] = [];
for (const h of hand) {
  const r = computeInvoice(h.input);
  for (const [k, v] of Object.entries(h.check)) {
    const got = (r as unknown as Record<string, unknown>)[k];
    if (got !== v) throw new Error(`HAND-VERIFIED MISMATCH "${h.name}" ${k}: expected ${String(v)} got ${String(got)}`);
  }
  cases.push({ name: h.name, input: h.input, expected: r });
}

// Engine-generated grid (frozen once committed)
const rates = [0, 25, 150, 300, 500, 1200, 1800, 2800];
const prices = [1, 99, 1_000, 9_999, 12_345, 100_000, 4_999_900];
for (const rate of rates) for (const incl of [false, true]) for (const pos of ['07', '27']) {
  const lines = prices.map((p, i) => line({ unitPricePaise: p, priceIsInclusive: incl, gstRateBp: rate, qtyMilli: (i % 3) * 1000 + 1000 }));
  cases.push({ name: `GRID rate=${rate} incl=${incl} pos=${pos}`, input: inv({ placeOfSupplyStateCode: pos, lines }), expected: computeInvoice(inv({ placeOfSupplyStateCode: pos, lines })) });
}
const discounts: Discount[] = [{ kind: 'percent', value: 1000 }, { kind: 'percent', value: 1250 }, { kind: 'amount', value: 777 }, { kind: 'percent', value: 33 }];
for (const bd of discounts) for (const ld of discounts) for (const round of [false, true]) {
  const i = inv({ billDiscount: bd, roundToRupee: round, lines: [
    line({ unitPricePaise: 12_345, lineDiscount: ld, gstRateBp: 1200 }),
    line({ unitPricePaise: 6_789, priceIsInclusive: true, lineDiscount: ld, gstRateBp: 500, qtyMilli: 3000 }),
    line({ unitPricePaise: 1_00_000, gstRateBp: 2800, cessRateBp: 100, cessPerUnitPaise: 400, qtyMilli: 2000 }),
    line({ unitPricePaise: 4_500, gstRateBp: 0, taxTreatment: 'nil_rated' }),
  ] });
  cases.push({ name: `DISC bill=${bd.kind}:${bd.value} line=${ld.kind}:${ld.value} round=${round}`, input: i, expected: computeInvoice(i) });
}
const mixes: TaxTreatment[][] = [['exempt', 'nil_rated'], ['non_gst'], ['zero_rated'], ['taxable', 'exempt'], ['nil_rated']];
for (const m of mixes) {
  const i = inv({ lines: m.map((t, k) => line({ taxTreatment: t, gstRateBp: t === 'taxable' ? 1800 : 0, unitPricePaise: 5_000 + k })) });
  cases.push({ name: `MIX ${m.join('+')}`, input: i, expected: computeInvoice(i) });
}
{ // 500-line wholesale invoice with a bill discount — BigInt apportionment path
  const i = inv({ billDiscount: { kind: 'percent', value: 250 }, roundToRupee: true,
    lines: Array.from({ length: 500 }, (_, k) => line({ unitPricePaise: 1_000_000 + k * 37, qtyMilli: (k % 12 + 1) * 1000, gstRateBp: rates[k % rates.length]! })) });
  cases.push({ name: 'WHOLESALE 500 lines 2.5% bill discount, rupee round-off', input: i, expected: computeInvoice(i) });
}

const file: GstFixtureFile = { version: 1, cases };
writeFileSync(out + 'gst-golden.json', JSON.stringify(file, null, 1) + '\n');
console.log(`wrote ${cases.length} cases (${hand.length} hand-verified)`);

const parties = fileURLToPath(new URL('../fixtures/parties/', import.meta.url));
mkdirSync(parties, { recursive: true });
const allocation = allocationFixtures();
writeFileSync(parties + 'allocation.json', JSON.stringify(allocation, null, 1) + '\n');
console.log(`wrote ${allocation.cases.length} allocation cases`);

const returns = fileURLToPath(new URL('../fixtures/returns/', import.meta.url));
mkdirSync(returns, { recursive: true });
const returnCases = returnFixtures();
writeFileSync(returns + 'return-golden.json', JSON.stringify(returnCases, null, 1) + '\n');
console.log(`wrote ${returnCases.cases.length} return cases`);

const setoffDir = fileURLToPath(new URL('../fixtures/setoff/', import.meta.url));
mkdirSync(setoffDir, { recursive: true });
const setoff = setoffFixtures();
writeFileSync(setoffDir + 'setoff-golden.json', JSON.stringify(setoff, null, 1) + '\n');
console.log(`wrote ${setoff.cases.length} set-off cases`);
