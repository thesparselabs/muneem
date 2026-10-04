import { DomainError } from '../errors.js';
import { cumulativeShare } from '../purchases/returns.js';

// A sale line as stored: its quantity in the sale's unit, its base quantity, its tax snapshot and what it cost.
export interface SoldLine {
  qtyMilli: number; baseQtyMilli: number; taxablePaise: number;
  cgstPaise: number; sgstPaise: number; igstPaise: number; cessPaise: number; cogsPaise: number;
}
export interface ReturnLineInput { line: SoldLine; returnedBeforeMilli: number; qtyMilli: number }
export interface ReturnInput {
  lines: readonly ReturnLineInput[];
  saleRoundOffPaise: number;
  // Round-off already taken back by earlier credit notes of the same sale.
  roundOffReturnedPaise: number;
}

export interface ReturnLineResult {
  qtyMilli: number; baseQtyMilli: number; taxablePaise: number;
  cgstPaise: number; sgstPaise: number; igstPaise: number; cessPaise: number; totalPaise: number; costPaise: number;
}
export interface ReturnResult {
  lines: ReturnLineResult[];
  taxablePaise: number; cgstPaise: number; sgstPaise: number; igstPaise: number; cessPaise: number;
  roundOffPaise: number; totalPaise: number; costPaise: number;
  completesSale: boolean;
}

const SHARED = ['baseQtyMilli', 'taxablePaise', 'cgstPaise', 'sgstPaise', 'igstPaise', 'cessPaise'] as const;

// ADR-0043: each returned line carries the sale line's own amounts in proportion, rounded cumulatively, so returning a
// line in any number of parts adds up to the line exactly; the note that completes the sale also takes back its round-off.
export function computeReturnLine(r: ReturnLineInput): ReturnLineResult {
  const share = (amount: number) => cumulativeShare(amount, r.line.qtyMilli, r.returnedBeforeMilli, r.qtyMilli);
  const s = Object.fromEntries(SHARED.map((k) => [k, share(r.line[k])])) as Record<(typeof SHARED)[number], number>;
  return {
    qtyMilli: r.qtyMilli, ...s, totalPaise: s.taxablePaise + s.cgstPaise + s.sgstPaise + s.igstPaise + s.cessPaise, costPaise: share(r.line.cogsPaise),
  };
}

export function computeReturn(input: ReturnInput): ReturnResult {
  for (const [v, what] of [[input.saleRoundOffPaise, 'sale round-off'], [input.roundOffReturnedPaise, 'round-off returned']] as const) {
    if (!Number.isSafeInteger(v)) throw new DomainError('INVALID_INPUT', `${what} must be whole paise, got ${v}`);
  }
  if (input.lines.length === 0) throw new DomainError('INVALID_INPUT', 'a return needs at least one line');
  const lines = input.lines.map(computeReturnLine);
  const sum = (k: keyof ReturnLineResult) => lines.reduce((s, l) => s + l[k], 0);
  const completesSale = input.lines.every((l) => l.returnedBeforeMilli + l.qtyMilli === l.line.qtyMilli);
  const roundOffPaise = completesSale ? input.saleRoundOffPaise - input.roundOffReturnedPaise : 0;
  return {
    lines, taxablePaise: sum('taxablePaise'), cgstPaise: sum('cgstPaise'), sgstPaise: sum('sgstPaise'), igstPaise: sum('igstPaise'), cessPaise: sum('cessPaise'),
    roundOffPaise, totalPaise: sum('totalPaise') + roundOffPaise, costPaise: sum('costPaise'), completesSale,
  };
}
