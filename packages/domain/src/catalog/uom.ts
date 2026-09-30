import { divRound } from '../money.js';
import { DomainError } from '../errors.js';

export const MILLI = 1000;

function assertFactor(factorMilli: number): void {
  if (!Number.isSafeInteger(factorMilli) || factorMilli <= 0) {
    throw new DomainError('INVALID_INPUT', `conversion factor must be a positive integer, got ${String(factorMilli)}`);
  }
}

export function toBaseQty(qtyMilli: number, factorMilli: number): number {
  assertFactor(factorMilli);
  return divRound(qtyMilli * factorMilli, MILLI);
}

export function fromBaseQty(baseQtyMilli: number, factorMilli: number): number {
  assertFactor(factorMilli);
  return divRound(baseQtyMilli * MILLI, factorMilli);
}
