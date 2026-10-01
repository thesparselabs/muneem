// Rounded up, so a discount even slightly over a permission limit is never let through by rounding.
export function effectiveDiscountBp(preDiscountTaxablePaise: number, discountPaise: number): number {
  if (preDiscountTaxablePaise <= 0 || discountPaise <= 0) return 0;
  const n = BigInt(discountPaise) * 10_000n;
  const d = BigInt(preDiscountTaxablePaise);
  return Number((n + d - 1n) / d);
}
