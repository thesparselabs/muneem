import type { StockRow } from '@muneem/contracts';
import { parseOptional } from '../money.js';

export interface CountDiff { productId: string; name: string; uomCode: string; systemMilli: number; countedMilli: number; diffMilli: number }

// Only products with a count entered take part; a blank count means "not counted", not zero.
export function countDiffs(rows: readonly StockRow[], counts: Readonly<Record<string, string>>): { diffs: CountDiff[]; errors: Record<string, string> } {
  const diffs: CountDiff[] = [];
  const errors: Record<string, string> = {};
  for (const r of rows) {
    const text = counts[r.productId];
    if (text === undefined || text.trim() === '') continue;
    const counted = parseOptional(text, 3);
    if (counted === null || counted === undefined || counted < 0) { errors[r.productId] = 'enter a count of 0 or more'; continue; }
    diffs.push({ productId: r.productId, name: r.name, uomCode: r.uomCode, systemMilli: r.qtyMilli, countedMilli: counted, diffMilli: counted - r.qtyMilli });
  }
  return { diffs, errors };
}
