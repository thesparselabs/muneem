import type { StockRow } from '@muneem/contracts';
import { parseOptional } from '../money.js';

export interface CountDiff { productId: string; name: string; uomCode: string; systemMilli: number; countedMilli: number; diffMilli: number }
// Each count keeps the row it was made against, so changing the filter or search never loses it.
export type Counts = Readonly<Record<string, { row: StockRow; text: string }>>;

export function setCount(counts: Counts, row: StockRow, text: string): Counts {
  if (text.trim() === '') {
    const next = { ...counts };
    delete next[row.productId];
    return next;
  }
  return { ...counts, [row.productId]: { row, text } };
}

// Blank means "not counted", not zero.
export function countDiffs(counts: Counts): { diffs: CountDiff[]; errors: Record<string, string>; counted: number } {
  const diffs: CountDiff[] = [];
  const errors: Record<string, string> = {};
  let counted = 0;
  for (const { row: r, text } of Object.values(counts)) {
    if (text.trim() === '') continue;
    counted++;
    const value = parseOptional(text, 3);
    if (value === null || value === undefined || value < 0) { errors[r.productId] = 'enter a count of 0 or more'; continue; }
    diffs.push({ productId: r.productId, name: r.name, uomCode: r.uomCode, systemMilli: r.qtyMilli, countedMilli: value, diffMilli: value - r.qtyMilli });
  }
  return { diffs, errors, counted };
}

// Every count that blocks posting, by product name, including ones hidden by the current filter or search.
export const countProblems = (counts: Counts, errors: Readonly<Record<string, string>>): string[] =>
  Object.keys(errors).map((id) => `${counts[id]?.row.name ?? id} ("${counts[id]?.text ?? ''}")`);
