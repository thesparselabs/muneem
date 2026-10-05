export interface CashFlows {
  openingPaise: number;
  cashTenderedPaise: number;
  changeGivenPaise: number;
  cashInPaise: number;
  cashOutPaise: number;
  safeDropPaise: number;
  // Cash paid back on credit notes (ADR-0043); absent on flows recorded before returns existed.
  cashRefundPaise?: number;
}

export const expectedCash = (c: CashFlows): number =>
  c.openingPaise + c.cashTenderedPaise - c.changeGivenPaise + c.cashInPaise - c.cashOutPaise - c.safeDropPaise - (c.cashRefundPaise ?? 0);
