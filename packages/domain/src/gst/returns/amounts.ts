import type { GstHeads, TaxAmounts } from './types.js';

export const ZERO_HEADS: GstHeads = { igstPaise: 0, cgstPaise: 0, sgstPaise: 0, cessPaise: 0 };
export const ZERO_AMOUNTS: TaxAmounts = { taxablePaise: 0, ...ZERO_HEADS };

export const amountsOf = (a: TaxAmounts, sign = 1): TaxAmounts => ({
  taxablePaise: sign * a.taxablePaise, igstPaise: sign * a.igstPaise, cgstPaise: sign * a.cgstPaise, sgstPaise: sign * a.sgstPaise, cessPaise: sign * a.cessPaise,
});

export const headsOf = (a: GstHeads): GstHeads => ({ igstPaise: a.igstPaise, cgstPaise: a.cgstPaise, sgstPaise: a.sgstPaise, cessPaise: a.cessPaise });

export function addInto<T extends TaxAmounts>(target: T, a: TaxAmounts, sign = 1): T {
  target.taxablePaise += sign * a.taxablePaise;
  target.igstPaise += sign * a.igstPaise;
  target.cgstPaise += sign * a.cgstPaise;
  target.sgstPaise += sign * a.sgstPaise;
  target.cessPaise += sign * a.cessPaise;
  return target;
}

export const sumAmounts = (rows: readonly TaxAmounts[], sign = 1): TaxAmounts => rows.reduce((t, r) => addInto(t, r, sign), { ...ZERO_AMOUNTS });

export const addHeads = (a: GstHeads, b: GstHeads, sign = 1): GstHeads => ({
  igstPaise: a.igstPaise + sign * b.igstPaise, cgstPaise: a.cgstPaise + sign * b.cgstPaise, sgstPaise: a.sgstPaise + sign * b.sgstPaise,
  cessPaise: a.cessPaise + sign * b.cessPaise,
});

export const taxOf = (a: GstHeads): number => a.igstPaise + a.cgstPaise + a.sgstPaise + a.cessPaise;

// Groups rows by a key, keeping first-seen order, then sorts by the key for a stable output.
export function groupBy<T, R>(items: readonly T[], key: (t: T) => string, make: (t: T) => R, add: (r: R, t: T) => void): R[] {
  const by = new Map<string, R>();
  for (const t of items) {
    const k = key(t);
    let r = by.get(k);
    if (!r) { r = make(t); by.set(k, r); }
    add(r, t);
  }
  return [...by.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([, r]) => r);
}
