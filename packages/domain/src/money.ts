import { DomainError } from './errors.js';

/** Integer paise. 1 INR = 100 paise. */
export type Paise = number & { readonly __brand: 'Paise' };
/** Integer milli-units. 1 unit = 1000. Supports 3 dp quantities (weighed goods). */
export type MilliQty = number & { readonly __brand: 'MilliQty' };
/** Integer basis points. 18% = 1800; 0.25% = 25. */
export type BasisPts = number & { readonly __brand: 'BasisPts' };

export const paise = (n: number): Paise => assertSafeInt(n, 'paise') as Paise;
export const milli = (n: number): MilliQty => assertSafeInt(n, 'milli') as MilliQty;
export const bp = (n: number): BasisPts => assertSafeInt(n, 'bp') as BasisPts;

export function assertSafeInt(n: number, what = 'value'): number {
  if (!Number.isSafeInteger(n)) {
    throw new DomainError('OVERFLOW', `${what} must be a safe integer, got ${String(n)}`);
  }
  return n;
}

/**
 * HALF_UP division on the absolute value, sign preserved (₹ convention, matches GSTN examples).
 * The ONLY rounding primitive in the codebase. Mirrored exactly by cloud/internal/domain/money.
 */
export function divRound(numerator: number, denominator: number): number {
  assertSafeInt(numerator, 'numerator');
  assertSafeInt(denominator, 'denominator');
  if (denominator === 0) throw new DomainError('DIVIDE_BY_ZERO', 'divRound by zero');
  const sign = Math.sign(numerator) * Math.sign(denominator) || 1;
  const n = Math.abs(numerator);
  const d = Math.abs(denominator);
  // (2n + d) must stay a safe integer or the float floor is wrong; refuse rather than drift.
  const twoNPlusD = 2 * n + d;
  assertSafeInt(twoNPlusD, 'divRound intermediate');
  const r = sign * Math.floor(twoNPlusD / (2 * d));
  return r === 0 ? 0 : r; // never -0: Go int64 has no negative zero and fixtures must match byte-for-byte
}

/** base × bp / 10000, HALF_UP. */
export function pctOf(base: number, rateBp: number): number {
  const product = base * rateBp;
  assertSafeInt(product, 'pctOf intermediate');
  return divRound(product, 10_000);
}

/**
 * Largest-remainder apportionment (LLD §1.3). Guarantee: Σ result === total, exactly, always,
 * with a deterministic tie-break (larger remainder first, then lower index).
 * BigInt intermediates: total × weight can exceed 2^53 on a 500-line wholesale invoice.
 */
export function apportion(total: number, weights: readonly number[]): number[] {
  assertSafeInt(total, 'total');
  for (const w of weights) {
    assertSafeInt(w, 'weight');
    if (w < 0) throw new DomainError('INVALID_INPUT', 'apportion weights must be >= 0');
  }
  const sum = weights.reduce((a, b) => a + b, 0);
  if (sum === 0) {
    if (total !== 0) throw new DomainError('INVALID_INPUT', 'cannot apportion a non-zero total over zero weights');
    return weights.map(() => 0);
  }
  const S = BigInt(sum);
  const T = BigInt(total);
  const base: number[] = [];
  const rem: bigint[] = [];
  for (const w of weights) {
    const num = T * BigInt(w);
    let q = num / S; // BigInt division truncates toward zero
    let r = num % S;
    // Normalise so remainder is always in [0, S) — required for a negative total to distribute deterministically.
    if (r < 0n) {
      q -= 1n;
      r += S;
    }
    base.push(Number(q));
    rem.push(r);
  }
  let left = total - base.reduce((a, b) => a + b, 0);
  const order = rem
    .map((r, i) => ({ i, r }))
    .sort((a, b) => (a.r < b.r ? 1 : a.r > b.r ? -1 : a.i - b.i));
  for (const { i } of order) {
    if (left <= 0) break;
    base[i] = (base[i] ?? 0) + 1;
    left--;
  }
  return base;
}

/** Sum of safe integers, checked. */
export function sumInts(values: readonly number[]): number {
  let s = 0;
  for (const v of values) s = assertSafeInt(s + assertSafeInt(v));
  return s;
}
