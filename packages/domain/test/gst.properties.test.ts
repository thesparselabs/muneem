import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { computeInvoice, pctOf, type GstInvoiceInput, type GstLineInput, type TaxTreatment } from '../src/index.js';

const RATES = [0, 25, 150, 300, 500, 1200, 1800, 2800];
const arbLine = (): fc.Arbitrary<GstLineInput> =>
  fc.record({
    qtyMilli: fc.oneof(fc.integer({ min: 1, max: 20 }).map((n) => n * 1000), fc.integer({ min: 1, max: 5_000_000 })),
    unitPricePaise: fc.integer({ min: 0, max: 50_000_000 }),
    priceIsInclusive: fc.boolean(),
    lineDiscount: fc.oneof(
      fc.constant({ kind: 'amount' as const, value: 0 }),
      fc.record({ kind: fc.constant('percent' as const), value: fc.integer({ min: 0, max: 5000 }) }),
    ),
    gstRateBp: fc.constantFrom(...RATES),
    cessRateBp: fc.constantFrom(0, 0, 0, 100, 1200, 2200),
    cessPerUnitPaise: fc.constantFrom(0, 0, 0, 400),
    taxTreatment: fc.constantFrom<TaxTreatment>('taxable', 'taxable', 'taxable', 'exempt', 'nil_rated', 'non_gst'),
  });

export const arbInvoice = (): fc.Arbitrary<GstInvoiceInput> =>
  fc.record({
    docType: fc.constantFrom('tax_invoice', 'credit_note') as fc.Arbitrary<'tax_invoice' | 'credit_note'>,
    supplierStateCode: fc.constant('07'),
    placeOfSupplyStateCode: fc.constantFrom('07', '06', '27'),
    isUnionTerritoryWithoutLegislature: fc.constant(false),
    taxScheme: fc.constantFrom('regular', 'regular', 'regular', 'composition') as fc.Arbitrary<'regular' | 'composition'>,
    customerGstin: fc.option(fc.constant('07AAAAA0000A1Z5'), { nil: undefined }),
    billDiscount: fc.oneof(
      fc.constant({ kind: 'amount' as const, value: 0 }),
      fc.record({ kind: fc.constant('percent' as const), value: fc.integer({ min: 0, max: 3000 }) }),
    ),
    roundToRupee: fc.boolean(),
    b2clThresholdPaise: fc.constant(10_000_000),
    lines: fc.array(arbLine(), { minLength: 1, maxLength: 40 }),
  });

describe('GST engine invariants', () => {
  it('totals re-sum, tax halves re-sum, discounts apportion exactly', () => {
    fc.assert(
      fc.property(arbInvoice(), (inv) => {
        const r = computeInvoice(inv);
        const sumL = (k: keyof (typeof r.lines)[number]) => r.lines.reduce((a, l) => a + l[k], 0);
        expect(r.taxablePaise).toBe(sumL('taxablePaise'));
        expect(r.totalPaise).toBe(r.taxablePaise + r.cgstPaise + r.sgstPaise + r.igstPaise + r.cessPaise + r.roundOffPaise);
        expect(sumL('apportionedBillDiscountPaise')).toBe(r.billDiscountPaise);
        if (r.supplyType === 'intra') expect(r.igstPaise).toBe(0);
        else expect(r.cgstPaise + r.sgstPaise).toBe(0);
        r.lines.forEach((l, i) => {
          const inL = inv.lines[i]!;
          expect(l.totalPaise).toBe(l.taxablePaise + l.cgstPaise + l.sgstPaise + l.igstPaise + l.cessPaise);
          if (inv.taxScheme === 'regular' && inL.taxTreatment === 'taxable' && r.supplyType === 'intra') {
            expect(l.cgstPaise + l.sgstPaise).toBe(pctOf(l.taxablePaise, inL.gstRateBp));
            expect(Math.abs(l.cgstPaise - l.sgstPaise)).toBeLessThanOrEqual(1);
          }
        });
        if (inv.roundToRupee) {
          expect(r.totalPaise % 100).toBe(0);
          expect(Math.abs(r.roundOffPaise)).toBeLessThanOrEqual(50);
        } else expect(r.roundOffPaise).toBe(0);
        if (inv.taxScheme !== 'regular') expect(r.cgstPaise + r.sgstPaise + r.igstPaise + r.cessPaise).toBe(0);
      }),
      { numRuns: 500 },
    );
  });

  it('inclusive → exclusive → inclusive round-trips within 1 paise per line', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100_000_000 }),
        fc.constantFrom(25, 150, 300, 500, 1200, 1800, 2800),
        (pricePaise, rate) => {
          const r = computeInvoice({
            docType: 'tax_invoice', supplierStateCode: '07', placeOfSupplyStateCode: '07',
            isUnionTerritoryWithoutLegislature: false, taxScheme: 'regular', roundToRupee: false,
            billDiscount: { kind: 'amount', value: 0 }, b2clThresholdPaise: 10_000_000,
            lines: [{ qtyMilli: 1000, unitPricePaise: pricePaise, priceIsInclusive: true,
              lineDiscount: { kind: 'amount', value: 0 }, gstRateBp: rate, cessRateBp: 0, cessPerUnitPaise: 0, taxTreatment: 'taxable' }],
          });
          expect(Math.abs(r.totalPaise - pricePaise)).toBeLessThanOrEqual(1);
        },
      ),
    );
  });

  it('an inclusive price with ad valorem and per-unit cess still totals the price, within 2 paise', () => {
    fc.assert(
      fc.property(fc.integer({ min: 2_000, max: 100_000_000 }), fc.constantFrom(0, 100, 500, 1200, 2200), fc.constantFrom(0, 400, 2_000), (pricePaise, cessRateBp, cessPerUnitPaise) => {
        const r = computeInvoice({
          docType: 'tax_invoice', supplierStateCode: '07', placeOfSupplyStateCode: '07', isUnionTerritoryWithoutLegislature: false, taxScheme: 'regular',
          roundToRupee: false, billDiscount: { kind: 'amount', value: 0 }, b2clThresholdPaise: 10_000_000,
          lines: [{ qtyMilli: 1000, unitPricePaise: pricePaise, priceIsInclusive: true, lineDiscount: { kind: 'amount', value: 0 }, gstRateBp: 2800, cessRateBp, cessPerUnitPaise, taxTreatment: 'taxable' }],
        });
        expect(Math.abs(r.totalPaise - pricePaise)).toBeLessThanOrEqual(2);
      }),
    );
  });

  it('is deterministic', () => {
    fc.assert(fc.property(arbInvoice(), (inv) => {
      expect(computeInvoice(inv)).toEqual(computeInvoice(structuredClone(inv)));
    }));
  });
});
