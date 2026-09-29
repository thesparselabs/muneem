import type { ProductInput } from '@muneem/contracts';
import { detectSymbology, exceedsMrp, isValidBarcode } from '@muneem/domain';

export type FieldErrors = Record<string, string>;

export function productFieldErrors(input: ProductInput): FieldErrors {
  const errors: FieldErrors = {};
  input.barcodes.forEach((b, i) => {
    if (b.symbology && !isValidBarcode(b.code, b.symbology)) errors[`barcodes.${i}.code`] = `not a valid ${b.symbology} barcode`;
  });
  const codes = input.barcodes.map((b) => b.code);
  const dup = codes.find((c, i) => codes.indexOf(c) !== i);
  if (dup) errors.barcodes = `barcode ${dup} is listed twice`;
  input.conversions.forEach((c, i) => {
    if (c.fromUomId === input.baseUomId) errors[`conversions.${i}.fromUomId`] = 'cannot convert the base unit to itself';
  });
  const from = input.conversions.map((c) => c.fromUomId);
  if (from.some((u, i) => from.indexOf(u) !== i)) errors.conversions = 'each unit can have only one conversion';
  if (input.sellingPricePaise !== undefined && exceedsMrp(input.sellingPricePaise, input.priceIsInclusive, input.mrpPaise)) {
    errors.sellingPricePaise = 'selling price is above MRP';
  }
  if (input.taxTreatment !== 'taxable' && input.gstRateBp !== 0) errors.gstRateBp = `GST rate must be 0 for ${input.taxTreatment} goods`;
  return errors;
}

export function resolvedSymbology(b: { code: string; symbology?: ProductInput['barcodes'][number]['symbology'] }) {
  return b.symbology ?? detectSymbology(b.code);
}
