import { ProductUpdate, type Product } from '@muneem/contracts';
import type { Refs } from './importPlanner.js';
import type { RowDraft } from './rowParser.js';

// An import row only overwrites the columns it has; the base unit never changes, because stock is counted in it.
export function mergeForUpdate(existing: Product, d: RowDraft, refs: Refs): ProductUpdate {
  const known = new Set(existing.barcodes.map((b) => b.code));
  return ProductUpdate.parse({
    id: existing.id,
    version: existing.version,
    name: d.name,
    baseUomId: existing.baseUomId,
    taxTreatment: existing.taxTreatment,
    cessRateBp: existing.cessRateBp,
    cessPerUnitPaise: existing.cessPerUnitPaise,
    priceIsInclusive: existing.priceIsInclusive,
    allowNegativeStock: existing.allowNegativeStock,
    sku: d.sku ?? existing.sku,
    hsnCode: d.hsnCode ?? existing.hsnCode,
    categoryId: refs.categoryId ?? existing.categoryId,
    brandId: refs.brandId ?? existing.brandId,
    mrpPaise: d.mrpPaise ?? existing.mrpPaise,
    purchasePricePaise: d.purchasePricePaise ?? existing.purchasePricePaise,
    gstRateBp: d.gstRateBp ?? existing.gstRateBp,
    reorderLevelMilli: d.reorderLevelMilli ?? existing.reorderLevelMilli,
    sellingPricePaise: d.sellingPricePaise ?? existing.sellingPricePaise,
    barcodes: [
      ...existing.barcodes.map((b) => ({ code: b.code, symbology: b.symbology, uomId: b.uomId, packQtyMilli: b.packQtyMilli, isPrimary: b.isPrimary })),
      ...d.barcodes.filter((code) => !known.has(code)).map((code) => ({ code })),
    ],
    conversions: existing.conversions.map((c) => ({ fromUomId: c.fromUomId, factorMilli: c.factorMilli })),
  });
}
