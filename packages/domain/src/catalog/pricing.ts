import { divRound } from '../money.js';
import { MILLI, toBaseQty } from './uom.js';

export interface PriceItem {
  readonly uomId: string;
  readonly minQtyMilli: number;
  readonly pricePaise: number;
  readonly isInclusive: boolean;
  readonly effectiveFrom: string;
  readonly effectiveTo?: string | null;
}

export interface PriceQuery {
  readonly uomId: string;
  readonly qtyMilli: number;
  readonly on: string;
  readonly baseUomId: string;
  readonly factorMilli?: number;
}

export interface ResolvedPrice {
  readonly pricePaise: number;
  readonly isInclusive: boolean;
  readonly source: 'exact' | 'converted';
}

const effectiveOn = (item: PriceItem, on: string): boolean =>
  item.effectiveFrom <= on && (item.effectiveTo == null || on < item.effectiveTo);

function bestMatch(items: readonly PriceItem[], uomId: string, qtyMilli: number, on: string): PriceItem | undefined {
  return items
    .filter((i) => i.uomId === uomId && i.minQtyMilli <= qtyMilli && effectiveOn(i, on))
    .sort((a, b) => b.minQtyMilli - a.minQtyMilli || (a.effectiveFrom < b.effectiveFrom ? 1 : -1))[0];
}

export function resolvePrice(items: readonly PriceItem[], q: PriceQuery): ResolvedPrice | null {
  const exact = bestMatch(items, q.uomId, q.qtyMilli, q.on);
  if (exact) return { pricePaise: exact.pricePaise, isInclusive: exact.isInclusive, source: 'exact' };
  if (q.uomId === q.baseUomId || q.factorMilli === undefined) return null;
  const base = bestMatch(items, q.baseUomId, toBaseQty(q.qtyMilli, q.factorMilli), q.on);
  if (!base) return null;
  return {
    pricePaise: divRound(base.pricePaise * q.factorMilli, MILLI),
    isInclusive: base.isInclusive,
    source: 'converted',
  };
}

// An exclusive price cannot be compared to MRP without the tax rate, so only inclusive prices are checked here.
export function exceedsMrp(pricePaise: number, isInclusive: boolean, mrpPaise: number | null | undefined): boolean {
  return isInclusive && mrpPaise != null && pricePaise > mrpPaise;
}

export const mrpForUnit = (mrpPaise: number, factorMilli: number): number => divRound(mrpPaise * factorMilli, MILLI);
