import { ProductInput, type Product, type ProductInput as ProductInputT } from '@muneem/contracts';
import { paiseToText, parseOptional, scaledToText } from './money.js';

export const GST_RATES_BP = [0, 25, 300, 500, 1200, 1800, 2800, 4000] as const;

export interface BarcodeRow { code: string; uomId: string; isPrimary: boolean }
export interface ConversionRow { fromUomId: string; factor: string }

export interface ProductForm {
  name: string; sku: string; hsnCode: string; categoryId: string; brandId: string; baseUomId: string;
  taxTreatment: ProductInputT['taxTreatment']; gstRateBp: number; priceIsInclusive: boolean;
  mrp: string; sellingPrice: string; purchasePrice: string; reorderLevel: string;
  barcodes: BarcodeRow[]; conversions: ConversionRow[];
}

export const emptyForm = (baseUomId: string): ProductForm => ({
  name: '', sku: '', hsnCode: '', categoryId: '', brandId: '', baseUomId, taxTreatment: 'taxable', gstRateBp: 1800,
  priceIsInclusive: true, mrp: '', sellingPrice: '', purchasePrice: '', reorderLevel: '', barcodes: [], conversions: [],
});

export function productToForm(p: Product): ProductForm {
  return {
    name: p.name, sku: p.sku ?? '', hsnCode: p.hsnCode ?? '', categoryId: p.categoryId ?? '', brandId: p.brandId ?? '',
    baseUomId: p.baseUomId, taxTreatment: p.taxTreatment, gstRateBp: p.gstRateBp, priceIsInclusive: p.priceIsInclusive,
    mrp: paiseToText(p.mrpPaise), sellingPrice: paiseToText(p.sellingPricePaise), purchasePrice: paiseToText(p.purchasePricePaise),
    reorderLevel: scaledToText(p.reorderLevelMilli, 3),
    barcodes: p.barcodes.map((b) => ({ code: b.code, uomId: b.uomId ?? '', isPrimary: b.isPrimary })),
    conversions: p.conversions.map((c) => ({ fromUomId: c.fromUomId, factor: scaledToText(c.factorMilli, 3) })),
  };
}

export type FormErrors = Record<string, string>;
export type FormResult = { ok: true; input: ProductInputT } | { ok: false; errors: FormErrors };

const blankToUndefined = (s: string): string | undefined => (s.trim() === '' ? undefined : s.trim());

export function formToInput(f: ProductForm): FormResult {
  const errors: FormErrors = {};
  const amount = (field: string, text: string, scale: number): number | undefined => {
    const v = parseOptional(text, scale);
    if (v === null) errors[field] = 'enter a number, e.g. 12.50';
    return v ?? undefined;
  };
  const raw = {
    name: f.name, sku: blankToUndefined(f.sku), hsnCode: blankToUndefined(f.hsnCode),
    categoryId: blankToUndefined(f.categoryId), brandId: blankToUndefined(f.brandId), baseUomId: f.baseUomId,
    taxTreatment: f.taxTreatment, gstRateBp: f.taxTreatment === 'taxable' ? f.gstRateBp : 0, priceIsInclusive: f.priceIsInclusive,
    mrpPaise: amount('mrpPaise', f.mrp, 2), sellingPricePaise: amount('sellingPricePaise', f.sellingPrice, 2),
    purchasePricePaise: amount('purchasePricePaise', f.purchasePrice, 2), reorderLevelMilli: amount('reorderLevelMilli', f.reorderLevel, 3),
    barcodes: f.barcodes.filter((b) => b.code.trim()).map((b) => ({ code: b.code.trim(), uomId: b.uomId || null, isPrimary: b.isPrimary })),
    conversions: f.conversions.filter((c) => c.fromUomId).map((c, i) => ({ fromUomId: c.fromUomId, factorMilli: amount(`conversions.${i}.factorMilli`, c.factor, 3) })),
  };
  const parsed = ProductInput.safeParse(raw);
  if (!parsed.success) for (const issue of parsed.error.issues) errors[issue.path.join('.')] ??= issue.message;
  return Object.keys(errors).length > 0 || !parsed.success ? { ok: false, errors } : { ok: true, input: parsed.data };
}
