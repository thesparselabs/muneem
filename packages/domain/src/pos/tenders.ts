export type TenderMethod = 'cash' | 'upi' | 'card' | 'other' | 'credit';
export interface TenderInput { method: TenderMethod; amountPaise: number }
export interface SettledTender extends TenderInput { changePaise: number }

export type Settlement =
  | { ok: true; paidPaise: number; changePaise: number; tenders: SettledTender[] }
  | { ok: false; reason: 'short'; shortByPaise: number }
  | { ok: false; reason: 'non_cash_over_total' | 'non_positive' };

// Σ tenders − change = total; only cash can be over-tendered, and the change comes back out of the cash tenders.
export function settleTenders(totalPaise: number, tenders: readonly TenderInput[]): Settlement {
  if (tenders.some((t) => !Number.isSafeInteger(t.amountPaise) || t.amountPaise <= 0)) return { ok: false, reason: 'non_positive' };
  const paidPaise = tenders.reduce((s, t) => s + t.amountPaise, 0);
  const nonCash = tenders.filter((t) => t.method !== 'cash').reduce((s, t) => s + t.amountPaise, 0);
  if (nonCash > totalPaise) return { ok: false, reason: 'non_cash_over_total' };
  if (paidPaise < totalPaise) return { ok: false, reason: 'short', shortByPaise: totalPaise - paidPaise };
  let changeLeft = paidPaise - totalPaise;
  const settled = [...tenders].reverse().map((t): SettledTender => {
    const changePaise = t.method === 'cash' ? Math.min(changeLeft, t.amountPaise) : 0;
    changeLeft -= changePaise;
    return { ...t, changePaise };
  }).reverse();
  return { ok: true, paidPaise, changePaise: paidPaise - totalPaise, tenders: settled };
}

// ADR-0026: no limit set counts as ₹0, so "no limit" never means "unlimited"; an advance (negative balance) adds room.
export const creditAvailable = (balancePaise: number, limitPaise: number | null): number => (limitPaise ?? 0) - balancePaise;
