import { DomainError } from '../errors.js';
import { assertSafeInt } from '../money.js';
import type { GstHeads } from './returns/types.js';

// The only moves the law allows (CGST Act s.49, rule 88A): CGST and SGST/UTGST credit never pay each other, cess pays only cess.
export interface SetoffUtilisation {
  igstToIgstPaise: number; igstToCgstPaise: number; igstToSgstPaise: number;
  cgstToCgstPaise: number; cgstToIgstPaise: number;
  sgstToSgstPaise: number; sgstToIgstPaise: number;
  cessToCessPaise: number;
}
export interface SetoffResult {
  liability: GstHeads; credit: GstHeads; utilisation: SetoffUtilisation;
  creditUsed: GstHeads; creditLeft: GstHeads; cash: GstHeads;
}

function validate(h: GstHeads, what: string): void {
  for (const [k, v] of Object.entries(h)) {
    assertSafeInt(v, `${what} ${k}`);
    if (v < 0) throw new DomainError('INVALID_INPUT', `${what} ${k} must be >= 0`);
  }
}

// ADR-0044: IGST credit first — to IGST, then to whatever CGST and SGST their own credit cannot cover, then CGST, then SGST;
// CGST credit to CGST then IGST; SGST credit to SGST then IGST; cess to cess. What is left of the liability is paid in cash.
export function computeSetoff(liability: GstHeads, credit: GstHeads): SetoffResult {
  validate(liability, 'liability');
  validate(credit, 'credit');
  const owe = { ...liability };
  const have = { ...credit };
  const use = (from: keyof GstHeads, to: keyof GstHeads, cap = owe[to]): number => {
    const amount = Math.min(have[from], owe[to], cap);
    have[from] -= amount;
    owe[to] -= amount;
    return amount;
  };
  const igstToIgst = use('igstPaise', 'igstPaise');
  const cgstShort = Math.max(0, owe.cgstPaise - have.cgstPaise);
  const sgstShort = Math.max(0, owe.sgstPaise - have.sgstPaise);
  let igstToCgst = use('igstPaise', 'cgstPaise', cgstShort);
  let igstToSgst = use('igstPaise', 'sgstPaise', sgstShort);
  igstToCgst += use('igstPaise', 'cgstPaise');
  igstToSgst += use('igstPaise', 'sgstPaise');
  const utilisation: SetoffUtilisation = {
    igstToIgstPaise: igstToIgst, igstToCgstPaise: igstToCgst, igstToSgstPaise: igstToSgst,
    cgstToCgstPaise: use('cgstPaise', 'cgstPaise'), cgstToIgstPaise: use('cgstPaise', 'igstPaise'),
    sgstToSgstPaise: use('sgstPaise', 'sgstPaise'), sgstToIgstPaise: use('sgstPaise', 'igstPaise'),
    cessToCessPaise: use('cessPaise', 'cessPaise'),
  };
  return {
    liability: { ...liability }, credit: { ...credit }, utilisation, creditUsed: creditUsedBy(utilisation), creditLeft: have, cash: owe,
  };
}

export const creditUsedBy = (u: SetoffUtilisation): GstHeads => ({
  igstPaise: u.igstToIgstPaise + u.igstToCgstPaise + u.igstToSgstPaise, cgstPaise: u.cgstToCgstPaise + u.cgstToIgstPaise,
  sgstPaise: u.sgstToSgstPaise + u.sgstToIgstPaise, cessPaise: u.cessToCessPaise,
});

export const liabilityMetBy = (u: SetoffUtilisation): GstHeads => ({
  igstPaise: u.igstToIgstPaise + u.cgstToIgstPaise + u.sgstToIgstPaise, cgstPaise: u.igstToCgstPaise + u.cgstToCgstPaise,
  sgstPaise: u.igstToSgstPaise + u.sgstToSgstPaise, cessPaise: u.cessToCessPaise,
});
