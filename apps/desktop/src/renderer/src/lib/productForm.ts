import { ProductInput, type Barcode, type Product, type ProductInput as ProductInputT } from '@muneem/contracts';

type Symbology = Barcode['symbology'];
import { paiseToText, parseOptional, scaledToText } from './money.js';

export const GST_RATES_BP = [0, 25, 300, 500, 1200, 1800, 2800, 4000] as const;

// The screen does not edit symbology or pack quantity; they are sent back only while the row matches what was saved.
export interface SavedBarcode { code: string; uomId: string; packQtyMilli: number; symbology: Symbology }
export interface BarcodeRow { code: string; uomId: string; isPrimary: boolean; saved?: SavedBarcode }
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
    barcodes: p.barcodes.map((b) => {
      const uomId = b.uomId ?? '';
      return { code: b.code, uomId, isPrimary: b.isPrimary, saved: { code: b.code, uomId, packQtyMilli: b.packQtyMilli, symbology: b.symbology } };
    }),
    conversions: p.conversions.map((c) => ({ fromUomId: c.fromUomId, factor: scaledToText(c.factorMilli, 3) })),
  };
}

export type FormErrors = Record<string, string>;
export type FormResult = { ok: true; input: ProductInputT } | { ok: false; errors: FormErrors };

const blankToUndefined = (s: string): string | undefined => (s.trim() === '' ? undefined : s.trim());

// With a baseline (the product as loaded), an untouched selling price is left out so it cannot overwrite a newer one.
export function formToInput(f: ProductForm, baseline?: ProductForm): FormResult {
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
    mrpPaise: amount('mrpPaise', f.mrp, 2),
    ...(!(baseline && f.sellingPrice === baseline.sellingPrice) && { sellingPricePaise: amount('sellingPricePaise', f.sellingPrice, 2) }),
    purchasePricePaise: amount('purchasePricePaise', f.purchasePrice, 2), reorderLevelMilli: amount('reorderLevelMilli', f.reorderLevel, 3),
    barcodes: f.barcodes.filter((b) => b.code.trim()).map((b) => {
      const untouched = b.saved && b.saved.code === b.code.trim() && b.saved.uomId === b.uomId;
      return {
        code: b.code.trim(), uomId: b.uomId || null, isPrimary: b.isPrimary,
        ...(untouched && { packQtyMilli: b.saved!.packQtyMilli, symbology: b.saved!.symbology }),
      };
    }),
    conversions: f.conversions.filter((c) => c.fromUomId).map((c, i) => ({ fromUomId: c.fromUomId, factorMilli: amount(`conversions.${i}.factorMilli`, c.factor, 3) })),
  };
  const parsed = ProductInput.safeParse(raw);
  if (!parsed.success) for (const issue of parsed.error.issues) errors[issue.path.join('.')] ??= issue.message;
  return Object.keys(errors).length > 0 || !parsed.success ? { ok: false, errors } : { ok: true, input: parsed.data };
}

// Fields the user has not changed since `baseline` take the value from `fresh`; their edits are kept.
export function rebaseForm(form: ProductForm, baseline: ProductForm, fresh: ProductForm): ProductForm {
  const keys = Object.keys(form) as (keyof ProductForm)[];
  const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
  return Object.fromEntries(keys.map((k) => [k, same(form[k], baseline[k]) ? fresh[k] : form[k]])) as unknown as ProductForm;
}
