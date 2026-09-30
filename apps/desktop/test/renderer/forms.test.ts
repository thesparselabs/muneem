import { describe, expect, it } from 'vitest';
import type { Product } from '@muneem/contracts';
import { formatPaise, formatRateBp, parseOptional, scaledToText } from '../../src/renderer/src/lib/money.js';
import { emptyForm, formToInput, productToForm, rebaseForm } from '../../src/renderer/src/lib/productForm.js';
import { itemToRow, rowsToItems } from '../../src/renderer/src/lib/priceItems.js';

const PCS = '01J0000000000000000000PCS0';
const BOX = '01J0000000000000000000B0X0';

describe('money display', () => {
  it('formats paise with Indian grouping without float rounding', () => {
    expect(formatPaise(12_345_678_905)).toBe('₹12,34,56,789.05');
    expect(formatPaise(-50)).toBe('-₹0.50');
    expect(formatPaise(null)).toBe('—');
    expect(formatRateBp(1800)).toBe('18%');
    expect(formatRateBp(25)).toBe('0.25%');
    expect(scaledToText(24_000, 3)).toBe('24');
    expect(scaledToText(5500, 3)).toBe('5.5');
  });
  it('treats an empty field as "not given" and junk as an error', () => {
    expect(parseOptional('', 2)).toBeUndefined();
    expect(parseOptional('12.5', 2)).toBe(1250);
    expect(parseOptional('twelve', 2)).toBeNull();
  });
});

describe('product form', () => {
  it('turns a filled form into a valid ProductInput', () => {
    const r = formToInput({
      ...emptyForm(PCS), name: 'Parle-G', sku: ' PG100 ', mrp: '10', sellingPrice: '9.50', reorderLevel: '24',
      barcodes: [{ code: '8901030865275', uomId: '', isPrimary: true }, { code: '  ', uomId: '', isPrimary: false }],
      conversions: [{ fromUomId: BOX, factor: '24' }],
    });
    expect(r).toEqual({ ok: true, input: expect.objectContaining({
      name: 'Parle-G', sku: 'PG100', mrpPaise: 1000, sellingPricePaise: 950, reorderLevelMilli: 24_000, gstRateBp: 1800,
      barcodes: [expect.objectContaining({ code: '8901030865275', uomId: null, isPrimary: true })],
      conversions: [{ fromUomId: BOX, factorMilli: 24_000 }],
    }) });
  });
  it('reports bad amounts and missing names by field', () => {
    const r = formToInput({ ...emptyForm(PCS), mrp: '10.555', sellingPrice: 'abc' });
    expect(r.ok).toBe(false);
    expect(!r.ok && r.errors).toMatchObject({ name: expect.any(String), mrpPaise: expect.any(String), sellingPricePaise: expect.any(String) });
  });
  it('forces GST to 0 for exempt goods', () => {
    const r = formToInput({ ...emptyForm(PCS), name: 'Rice', taxTreatment: 'exempt', gstRateBp: 1800 });
    expect(r.ok && r.input.gstRateBp).toBe(0);
  });
  it('round-trips a saved product through the form', () => {
    const product: Product = {
      id: '01J00000000000000000000P01', businessId: '01J00000000000000000000B01', name: 'Toor Dal', sku: 'TOOR', baseUomId: PCS,
      taxTreatment: 'taxable', gstRateBp: 500, cessRateBp: 0, cessPerUnitPaise: 0, priceIsInclusive: true, mrpPaise: 15_000,
      sellingPricePaise: 14_050, reorderLevelMilli: 5500, isActive: true, createdAt: '2026-09-30T00:00:00.000Z', updatedAt: '2026-09-30T00:00:00.000Z', version: 3,
      barcodes: [{ id: '01J00000000000000000000C01', code: 'TOOR1', symbology: 'CODE128', uomId: null, packQtyMilli: 1000, isPrimary: true }],
      conversions: [],
    };
    const r = formToInput(productToForm(product));
    expect(r.ok && r.input).toMatchObject({ name: 'Toor Dal', sellingPricePaise: 14_050, mrpPaise: 15_000, reorderLevelMilli: 5500, gstRateBp: 500 });
  });
});

describe('saving an existing product', () => {
  const saved: Product = {
    id: '01J00000000000000000000P01', businessId: '01J00000000000000000000B01', name: 'Parle-G', baseUomId: PCS,
    taxTreatment: 'taxable', gstRateBp: 1800, cessRateBp: 0, cessPerUnitPaise: 0, priceIsInclusive: true, mrpPaise: 1000,
    sellingPricePaise: 950, isActive: true, createdAt: '2026-09-30T00:00:00.000Z', updatedAt: '2026-09-30T00:00:00.000Z', version: 1,
    barcodes: [{ id: '01J00000000000000000000C01', code: 'CASE24', symbology: 'CODE128', uomId: BOX, packQtyMilli: 2000, isPrimary: true }],
    conversions: [{ id: '01J00000000000000000000V01', fromUomId: BOX, toUomId: PCS, factorMilli: 24_000 }],
  };

  it('does not send the selling price unless the user changed it', () => {
    const baseline = productToForm(saved);
    const untouched = formToInput({ ...baseline, name: 'Parle-G Gold' }, baseline);
    expect(untouched.ok && 'sellingPricePaise' in untouched.input).toBe(false);
    const edited = formToInput({ ...baseline, sellingPrice: '9.00' }, baseline);
    expect(edited.ok && edited.input.sellingPricePaise).toBe(900);
  });

  it('takes fresh values for fields the user has not touched and keeps their edits', () => {
    const baseline = productToForm(saved);
    const fresh = productToForm({ ...saved, sellingPricePaise: 900, mrpPaise: 1200 });
    const rebased = rebaseForm({ ...baseline, mrp: '11.00' }, baseline, fresh);
    expect(rebased).toMatchObject({ sellingPrice: '9.00', mrp: '11.00' });
  });

  it('keeps a barcode pack quantity and symbology through the form', () => {
    const r = formToInput(productToForm(saved));
    expect(r.ok && r.input.barcodes).toEqual([{ code: 'CASE24', symbology: 'CODE128', uomId: BOX, packQtyMilli: 2000, isPrimary: true }]);
  });
});

describe('price list rows', () => {
  it('converts rows to items and back', () => {
    const rows = [{ uomId: PCS, minQty: '12', price: '9', isInclusive: true, effectiveFrom: '2026-10-01', effectiveTo: '' }];
    expect(!rowsToItems([...rows, ...rows]).ok).toBe(true);
    const r = rowsToItems(rows);
    expect(r).toEqual({ ok: true, items: [{ uomId: PCS, minQtyMilli: 12_000, pricePaise: 900, isInclusive: true, effectiveFrom: '2026-10-01' }] });
    const saved = { id: 'i', priceListId: 'l', productId: 'p', uomId: PCS, minQtyMilli: 12_000, pricePaise: 900, isInclusive: true, effectiveFrom: '2026-10-01' };
    expect(itemToRow(saved)).toEqual({ ...rows[0], price: '9.00' });
  });
  it('rejects an end date before the start date', () => {
    const r = rowsToItems([{ uomId: PCS, minQty: '0', price: '9', isInclusive: true, effectiveFrom: '2026-10-05', effectiveTo: '2026-10-01' }]);
    expect(!r.ok && r.errors).toEqual({ 'items.0.effectiveTo': 'must be after the "from" date' });
  });
  it('rejects a missing price or bad date', () => {
    const r = rowsToItems([{ uomId: PCS, minQty: '0', price: '', isInclusive: true, effectiveFrom: 'soon', effectiveTo: '' }]);
    expect(!r.ok && Object.keys(r.errors).sort()).toEqual(['items.0.effectiveFrom', 'items.0.pricePaise']);
  });
});
