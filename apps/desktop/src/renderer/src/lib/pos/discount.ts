import type { DiscountInput } from '@muneem/contracts';
import { parseOptional } from '../money.js';

// An empty field means "no discount"; anything unreadable is an error, never a silent zero.
export function parseDiscount(kind: DiscountInput['kind'], text: string): { ok: true; discount: DiscountInput } | { ok: false; error: string } {
  if (kind === 'amount' && text.includes('%')) return { ok: false, error: 'Choose Percent for a % discount' };
  const value = parseOptional(text, 2);
  if (value === undefined) return { ok: true, discount: { kind, value: 0 } };
  if (value === null || value < 0) return { ok: false, error: kind === 'percent' ? 'Enter a percent such as 5 or 7.5' : 'Enter an amount such as 50 or 1,250.00' };
  if (kind === 'percent' && value > 10_000) return { ok: false, error: 'A discount cannot be more than 100%' };
  return { ok: true, discount: { kind, value } };
}
