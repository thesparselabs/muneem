import { divRound } from '../money.js';
import { DomainError } from '../errors.js';

// What q more units of a line carry, given `before` already taken: cumulative rounding, so every way of returning
// the whole line adds up to exactly the line.
export function cumulativeShare(amount: number, wholeQty: number, beforeQty: number, qty: number): number {
  for (const [v, what] of [[amount, 'amount'], [wholeQty, 'line quantity'], [beforeQty, 'quantity already returned'], [qty, 'quantity']] as const) {
    if (!Number.isSafeInteger(v) || v < 0) throw new DomainError('INVALID_INPUT', `${what} must be a whole number ≥ 0, got ${v}`);
  }
  if (wholeQty === 0 || beforeQty + qty > wholeQty) throw new DomainError('INVALID_INPUT', `cannot take ${qty} more of ${wholeQty} after ${beforeQty}`);
  return divRound(amount * (beforeQty + qty), wholeQty) - divRound(amount * beforeQty, wholeQty);
}
