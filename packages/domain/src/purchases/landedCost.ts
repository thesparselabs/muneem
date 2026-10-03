import { apportion } from '../money.js';
import { DomainError } from '../errors.js';

export interface LandedLineInput { taxablePaise: number; taxPaise: number; itcEligible: boolean }
export interface LandedLine { chargesPaise: number; landedValuePaise: number }

// ADR-0023: charges spread by taxable value (equally when every line is free); tax that cannot be claimed is part of the cost.
export function landedValues(lines: readonly LandedLineInput[], chargesPaise: number): LandedLine[] {
  if (!Number.isSafeInteger(chargesPaise) || chargesPaise < 0) throw new DomainError('INVALID_INPUT', `charges must be ≥ 0, got ${chargesPaise}`);
  if (lines.length === 0) {
    if (chargesPaise !== 0) throw new DomainError('INVALID_INPUT', 'charges need at least one line to land on');
    return [];
  }
  const weights = lines.map((l) => l.taxablePaise);
  const shares = apportion(chargesPaise, weights.some((w) => w > 0) ? weights : lines.map(() => 1));
  return lines.map((l, i) => {
    const share = shares[i]!;
    return { chargesPaise: share, landedValuePaise: l.taxablePaise + share + (l.itcEligible ? 0 : l.taxPaise) };
  });
}

export const BILL_TOLERANCE_PAISE = 100;

// The bill's own grand total wins within ±₹1 (stored as round-off); a bigger difference means a keying mistake.
export function billRoundOff(computedTotalPaise: number, billTotalPaise: number): number {
  const diff = billTotalPaise - computedTotalPaise;
  if (Math.abs(diff) > BILL_TOLERANCE_PAISE) throw new DomainError('INVALID_INPUT', `bill total differs from the lines by ${diff} paise`);
  return diff;
}
