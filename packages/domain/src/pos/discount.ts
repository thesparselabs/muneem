// Nearest basis point: per-line rounding can push an exact 5% a fraction of a paisa over, which must not read as 5.01%.
export function effectiveDiscountBp(preDiscountTaxablePaise: number, discountPaise: number): number {
  if (preDiscountTaxablePaise <= 0 || discountPaise <= 0) return 0;
  return Number((BigInt(discountPaise) * 20_000n + BigInt(preDiscountTaxablePaise)) / (2n * BigInt(preDiscountTaxablePaise)));
}
