import type { GstHeads, GstSetoffPreview } from '@muneem/contracts';
import { parseOptional } from '../money.js';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// The current month and the ones before it, newest first, as first days ('2026-05-01').
export function recentMonths(today: string, count: number): string[] {
  const y = Number(today.slice(0, 4));
  const m = Number(today.slice(5, 7)) - 1;
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(Date.UTC(y, m - i, 1));
    return d.toISOString().slice(0, 10);
  });
}

export const previousMonth = (today: string): string => recentMonths(today, 2)[1]!;
export const monthLabel = (month: string): string => `${MONTH_NAMES[Number(month.slice(5, 7)) - 1]} ${month.slice(0, 4)}`;

export const HEAD_LABELS: readonly [keyof GstHeads, string][] = [['igstPaise', 'IGST'], ['cgstPaise', 'CGST'], ['sgstPaise', 'SGST/UTGST'], ['cessPaise', 'Cess']];

// The utilisation as "IGST credit → CGST: ₹x" lines, leaving out moves of nothing.
export function utilisationRows(u: GstSetoffPreview['utilisation']): { from: string; to: string; paise: number }[] {
  const moves: [keyof typeof u, string, string][] = [
    ['igstToIgstPaise', 'IGST', 'IGST'], ['igstToCgstPaise', 'IGST', 'CGST'], ['igstToSgstPaise', 'IGST', 'SGST/UTGST'],
    ['cgstToCgstPaise', 'CGST', 'CGST'], ['cgstToIgstPaise', 'CGST', 'IGST'], ['sgstToSgstPaise', 'SGST/UTGST', 'SGST/UTGST'],
    ['sgstToIgstPaise', 'SGST/UTGST', 'IGST'], ['cessToCessPaise', 'Cess', 'Cess'],
  ];
  return moves.filter(([k]) => u[k] > 0).map(([k, from, to]) => ({ from, to, paise: u[k] }));
}

export type ChallanText = Record<keyof GstHeads, string>;
export const EMPTY_CHALLAN: ChallanText = { igstPaise: '', cgstPaise: '', sgstPaise: '', cessPaise: '' };

// Rupee amounts typed per head → paise; an unreadable amount names its field, and a challan must pay something.
export function parseChallan(text: ChallanText): { heads: GstHeads } | { error: string } {
  const heads = { igstPaise: 0, cgstPaise: 0, sgstPaise: 0, cessPaise: 0 };
  for (const [k, label] of HEAD_LABELS) {
    const v = parseOptional(text[k], 2);
    if (v === null || (v !== undefined && v < 0)) return { error: `${label} is not an amount` };
    heads[k] = v ?? 0;
  }
  if (heads.igstPaise + heads.cgstPaise + heads.sgstPaise + heads.cessPaise === 0) return { error: 'Enter the tax paid' };
  return { heads };
}

export const challanFromCash = (cash: GstHeads): ChallanText =>
  Object.fromEntries(HEAD_LABELS.map(([k]) => [k, cash[k] > 0 ? `${Math.trunc(cash[k] / 100)}.${String(cash[k] % 100).padStart(2, '0')}` : ''])) as ChallanText;
