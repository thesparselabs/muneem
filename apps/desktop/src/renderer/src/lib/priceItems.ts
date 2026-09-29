import { PriceListItemInput, type PriceListItem } from '@muneem/contracts';
import type { z } from 'zod';
import { paiseToText, parseOptional, scaledToText } from './money.js';

export interface PriceRow { uomId: string; minQty: string; price: string; isInclusive: boolean; effectiveFrom: string; effectiveTo: string }
type ItemInput = z.input<typeof PriceListItemInput>;

export const itemToRow = (i: PriceListItem): PriceRow => ({
  uomId: i.uomId, minQty: scaledToText(i.minQtyMilli, 3), price: paiseToText(i.pricePaise), isInclusive: i.isInclusive,
  effectiveFrom: i.effectiveFrom, effectiveTo: i.effectiveTo ?? '',
});

export function rowsToItems(rows: readonly PriceRow[]): { ok: true; items: ItemInput[] } | { ok: false; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  const items = rows.map((r, i): ItemInput => {
    const price = parseOptional(r.price, 2);
    const minQty = parseOptional(r.minQty, 3);
    if (price === null || price === undefined) errors[`items.${i}.pricePaise`] = 'enter a price';
    if (minQty === null) errors[`items.${i}.minQtyMilli`] = 'enter a quantity';
    return {
      uomId: r.uomId, minQtyMilli: minQty ?? 0, pricePaise: price ?? 0, isInclusive: r.isInclusive, effectiveFrom: r.effectiveFrom,
      ...(r.effectiveTo && { effectiveTo: r.effectiveTo }),
    };
  });
  for (const [i, item] of items.entries()) {
    const parsed = PriceListItemInput.safeParse(item);
    if (!parsed.success) for (const issue of parsed.error.issues) errors[`items.${i}.${issue.path.join('.')}`] ??= issue.message;
  }
  return Object.keys(errors).length > 0 ? { ok: false, errors } : { ok: true, items };
}
