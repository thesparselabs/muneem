import type { TenderLine } from '@muneem/contracts';
import { settleTenders, type Settlement } from '@muneem/domain';
import { parseOptional } from '../money.js';

export interface TenderRow { method: TenderLine['method']; amount: string; reference: string }

export function rowsToTenders(rows: readonly TenderRow[]): { ok: true; tenders: TenderLine[] } | { ok: false; error: string } {
  const tenders: TenderLine[] = [];
  for (const r of rows) {
    if (r.amount.trim() === '') continue;
    const paise = parseOptional(r.amount, 2);
    if (paise === null || paise === undefined || paise <= 0) return { ok: false, error: `Enter a valid ${r.method.toUpperCase()} amount` };
    tenders.push({ method: r.method, amountPaise: paise, ...(r.reference.trim() && { reference: r.reference.trim() }) });
  }
  return { ok: true, tenders };
}

export function previewSettlement(totalPaise: number, rows: readonly TenderRow[]): Settlement | { ok: false; reason: 'invalid'; error: string } {
  const parsed = rowsToTenders(rows);
  return parsed.ok ? settleTenders(totalPaise, parsed.tenders) : { ok: false, reason: 'invalid', error: parsed.error };
}
