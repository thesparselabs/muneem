import type { AllocationChoice, ChargeRef } from '@muneem/contracts';
import { allocateOldestFirst } from '@muneem/domain';
import { parseOptional } from '../money.js';

export interface GridItem { type: ChargeRef['type']; id: string; docNumber?: string | undefined; docDate: string; dueDate: string; openPaise: number }
export type GridMode = 'auto' | 'choose';

export interface GridSummary { amounts: Map<string, number>; allocatedPaise: number; advancePaise: number; errors: Record<string, string> }

// Auto previews exactly what the server will do (the same domain function); Choose takes the typed amounts.
export function summarise(mode: GridMode, items: readonly GridItem[], amountPaise: number, typed: Readonly<Record<string, string>>): GridSummary {
  const amounts = new Map<string, number>();
  const errors: Record<string, string> = {};
  if (mode === 'auto') {
    if (amountPaise > 0) {
      for (const a of allocateOldestFirst(items.map((i) => ({ id: i.id, dueDate: i.dueDate, docDate: i.docDate, outstandingPaise: i.openPaise })), amountPaise).allocations) {
        amounts.set(a.itemId, a.amountPaise);
      }
    }
  } else {
    for (const item of items) {
      const v = parseOptional(typed[item.id] ?? '', 2);
      if (v === undefined || v === 0) continue;
      if (v === null || v < 0) errors[item.id] = 'not an amount';
      else if (v > item.openPaise) errors[item.id] = 'more than is open';
      else amounts.set(item.id, v);
    }
  }
  const allocatedPaise = [...amounts.values()].reduce((s, v) => s + v, 0);
  if (allocatedPaise > amountPaise) errors.total = 'allocations add up to more than the payment';
  return { amounts, allocatedPaise, advancePaise: Math.max(0, amountPaise - allocatedPaise), errors };
}

export function toChoice(mode: GridMode, items: readonly GridItem[], summary: GridSummary): AllocationChoice {
  if (mode === 'auto') return 'auto';
  return items.filter((i) => summary.amounts.has(i.id)).map((i) => ({ type: i.type, id: i.id, amountPaise: summary.amounts.get(i.id)! }));
}
