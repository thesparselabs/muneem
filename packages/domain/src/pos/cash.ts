export interface CashFlows {
  openingPaise: number;
  cashTenderedPaise: number;
  changeGivenPaise: number;
  cashInPaise: number;
  cashOutPaise: number;
  safeDropPaise: number;
}

export const expectedCash = (c: CashFlows): number =>
  c.openingPaise + c.cashTenderedPaise - c.changeGivenPaise + c.cashInPaise - c.cashOutPaise - c.safeDropPaise;
