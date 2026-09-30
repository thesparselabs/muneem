import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  DomainError,
  detectSymbology,
  exceedsMrp,
  fromBaseQty,
  isValidBarcode,
  mrpForUnit,
  normalizeName,
  parseScaled,
  resolvePrice,
  toBaseQty,
  type PriceItem,
} from '../src/index.js';

describe('normalizeName', () => {
  it('lowercases, strips Latin accents and collapses whitespace', () => {
    expect(normalizeName('  Café   CRÈME  ')).toBe('cafe creme');
    expect(normalizeName('ＡＢＣ　Soap')).toBe('abc soap');
  });
  it('keeps Indic vowel signs and viramas intact', () => {
    expect(normalizeName('चाय  पत्ती')).toBe('चाय पत्ती');
    expect(normalizeName('ಅಕ್ಕಿ')).toBe('ಅಕ್ಕಿ');
    expect(normalizeName('க்ஷீரம்')).toBe('க்ஷீரம்');
  });
  it('property: Devanagari text only loses repeated whitespace', () => {
    const devanagari = fc.string({ unit: fc.integer({ min: 0x0900, max: 0x097f }).map((c) => String.fromCodePoint(c)) });
    fc.assert(
      fc.property(devanagari, (s) => {
        expect(normalizeName(s)).toBe(s.normalize('NFKC').normalize('NFC').replace(/\s+/gu, ' ').trim());
      }),
    );
  });
  it('property: idempotent', () => {
    fc.assert(
      fc.property(fc.string(), (s) => {
        expect(normalizeName(normalizeName(s))).toBe(normalizeName(s));
      }),
    );
  });
});

describe('barcodes', () => {
  it.each([
    ['8901030865275', 'EAN13'],
    ['96385074', 'EAN8'],
    ['036000291452', 'UPCA'],
    ['ABC-123', 'CODE128'],
    ['8901030865279', 'CODE128'],
  ] as const)('detects %s as %s', (code, symbology) => {
    expect(detectSymbology(code)).toBe(symbology);
  });
  it('rejects a GTIN with a bad check digit and free text with padding', () => {
    expect(isValidBarcode('8901030865279', 'EAN13')).toBe(false);
    expect(isValidBarcode(' ABC', 'CODE128')).toBe(false);
    expect(isValidBarcode('', 'CODE128')).toBe(false);
  });
});

describe('uom conversion', () => {
  it('converts cases to base pieces and back', () => {
    expect(toBaseQty(2000, 24_000)).toBe(48_000);
    expect(fromBaseQty(48_000, 24_000)).toBe(2000);
    expect(toBaseQty(250, 1000)).toBe(250);
  });
  it('rejects non-positive factors', () => {
    expect(() => toBaseQty(1000, 0)).toThrow(DomainError);
    expect(() => fromBaseQty(1000, -5)).toThrow(DomainError);
  });
  it('property: whole-unit quantities round-trip exactly', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 100_000 }), fc.integer({ min: 1, max: 1000 }), (units, factor) => {
        const qty = units * 1000;
        expect(fromBaseQty(toBaseQty(qty, factor * 1000), factor * 1000)).toBe(qty);
      }),
    );
  });
});

describe('resolvePrice', () => {
  const item = (p: Partial<PriceItem>): PriceItem => ({
    uomId: 'pcs',
    minQtyMilli: 0,
    pricePaise: 1000,
    isInclusive: true,
    effectiveFrom: '2026-01-01',
    ...p,
  });
  const q = { uomId: 'pcs', baseUomId: 'pcs', qtyMilli: 1000, on: '2026-06-01' };

  it('picks the highest quantity break at or below the quantity', () => {
    const items = [item({}), item({ minQtyMilli: 10_000, pricePaise: 900 }), item({ minQtyMilli: 50_000, pricePaise: 800 })];
    expect(resolvePrice(items, { ...q, qtyMilli: 12_000 })?.pricePaise).toBe(900);
    expect(resolvePrice(items, { ...q, qtyMilli: 9_999 })?.pricePaise).toBe(1000);
  });
  it('respects the effective window and prefers the newest price', () => {
    const items = [
      item({ effectiveTo: '2026-03-01' }),
      item({ effectiveFrom: '2026-03-01', pricePaise: 1100 }),
      item({ effectiveFrom: '2026-07-01', pricePaise: 1200 }),
    ];
    expect(resolvePrice(items, { ...q, on: '2026-02-01' })?.pricePaise).toBe(1000);
    expect(resolvePrice(items, q)?.pricePaise).toBe(1100);
    expect(resolvePrice(items, { ...q, on: '2026-07-01' })?.pricePaise).toBe(1200);
    expect(resolvePrice(items, { ...q, on: '2025-12-31' })).toBeNull();
  });
  it('falls back to the base price times the conversion factor', () => {
    const r = resolvePrice([item({ pricePaise: 1250 })], { ...q, uomId: 'case', factorMilli: 24_000 });
    expect(r).toEqual({ pricePaise: 30_000, isInclusive: true, source: 'converted' });
  });
  it('uses the base-quantity break for a converted price', () => {
    const items = [item({}), item({ minQtyMilli: 24_000, pricePaise: 900 })];
    expect(resolvePrice(items, { ...q, uomId: 'case', factorMilli: 24_000 })?.pricePaise).toBe(21_600);
  });
  it('property: result is independent of item order', () => {
    const arbItem = fc.record({
      uomId: fc.constant('pcs'),
      minQtyMilli: fc.integer({ min: 0, max: 5 }).map((n) => n * 1000),
      pricePaise: fc.integer({ min: 0, max: 100_000 }),
      isInclusive: fc.boolean(),
      effectiveFrom: fc.constantFrom('2026-01-01', '2026-02-01', '2026-03-01'),
    });
    fc.assert(
      fc.property(fc.uniqueArray(arbItem, { selector: (i) => `${i.minQtyMilli}|${i.effectiveFrom}` }), (items) => {
        const a = resolvePrice(items, { ...q, qtyMilli: 3000 });
        const b = resolvePrice([...items].reverse(), { ...q, qtyMilli: 3000 });
        expect(a).toEqual(b);
      }),
    );
  });
});

describe('mrpForUnit', () => {
  it('scales the base-unit MRP to a pack', () => {
    expect(mrpForUnit(2000, 24_000)).toBe(48_000);
    expect(mrpForUnit(2000, 1000)).toBe(2000);
    expect(mrpForUnit(999, 500)).toBe(500);
  });
});

describe('exceedsMrp', () => {
  it('flags only inclusive prices above MRP', () => {
    expect(exceedsMrp(1100, true, 1000)).toBe(true);
    expect(exceedsMrp(1000, true, 1000)).toBe(false);
    expect(exceedsMrp(1100, false, 1000)).toBe(false);
    expect(exceedsMrp(1100, true, null)).toBe(false);
  });
});

describe('parseScaled', () => {
  it.each([
    ['₹1,234.50', 2, 123_450],
    ['12', 2, 1200],
    ['0.5', 2, 50],
    ['18%', 2, 1800],
    ['2.5', 3, 2500],
    ['Rs. 99', 2, 9900],
    ['1.230', 2, 123],
  ] as const)('%s at scale %i → %i', (text, scale, expected) => {
    expect(parseScaled(text, scale)).toBe(expected);
  });
  it.each(['', 'abc', '1.234', '1.2.3', '.', '1e5'])('rejects %j', (text) => {
    expect(parseScaled(text, 2)).toBeNull();
  });
  it('property: agrees with integer arithmetic for any paise amount', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 1e12 }), (p) => {
        expect(parseScaled(`${Math.floor(p / 100)}.${String(p % 100).padStart(2, '0')}`, 2)).toBe(p);
      }),
    );
  });
});
