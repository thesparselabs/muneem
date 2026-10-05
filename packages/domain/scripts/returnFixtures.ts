import { computeReturn, DomainError, type ReturnInput, type ReturnResult, type SoldLine } from '../src/index.js';

export interface ReturnCase { name: string; input: ReturnInput; expected?: ReturnResult; error?: string }
export interface ReturnFixtureFile { version: 1; cases: ReturnCase[] }

const sold = (o: Partial<SoldLine> = {}): SoldLine => ({
  qtyMilli: 3000, baseQtyMilli: 3000, taxablePaise: 10_001, cgstPaise: 900, sgstPaise: 900, igstPaise: 0, cessPaise: 0, cogsPaise: 7000, ...o,
});
const only = (returnedBeforeMilli: number, qtyMilli: number, line = sold()): ReturnInput =>
  ({ lines: [{ line, returnedBeforeMilli, qtyMilli }], saleRoundOffPaise: -1, roundOffReturnedPaise: 0 });
const lineOut = (o: Partial<ReturnResult['lines'][number]>) => ({
  qtyMilli: 1000, baseQtyMilli: 1000, taxablePaise: 0, cgstPaise: 0, sgstPaise: 0, igstPaise: 0, cessPaise: 0, totalPaise: 0, costPaise: 0, ...o,
});
const result = (l: ReturnResult['lines'][number], roundOffPaise: number, completesSale: boolean): ReturnResult => ({
  lines: [l], taxablePaise: l.taxablePaise, cgstPaise: l.cgstPaise, sgstPaise: l.sgstPaise, igstPaise: l.igstPaise, cessPaise: l.cessPaise,
  roundOffPaise, totalPaise: l.totalPaise + roundOffPaise, costPaise: l.costPaise, completesSale,
});

type Hand = { name: string; input: ReturnInput; check: ReturnResult | { error: string } };
const hand: Hand[] = [
  { name: 'HAND first of three units: 10001/3 rounds up to 3334', input: only(0, 1000),
    check: result(lineOut({ taxablePaise: 3334, cgstPaise: 300, sgstPaise: 300, totalPaise: 3934, costPaise: 2333 }), 0, false) },
  { name: 'HAND second of three units takes what the first left: 6667 − 3334', input: only(1000, 1000),
    check: result(lineOut({ taxablePaise: 3333, cgstPaise: 300, sgstPaise: 300, totalPaise: 3933, costPaise: 2334 }), 0, false) },
  { name: 'HAND last unit completes the sale and takes back its round-off', input: only(2000, 1000),
    check: result(lineOut({ taxablePaise: 3334, cgstPaise: 300, sgstPaise: 300, totalPaise: 3934, costPaise: 2333 }), -1, true) },
  { name: 'HAND whole line at once is the line exactly', input: only(0, 3000),
    check: result(lineOut({ qtyMilli: 3000, baseQtyMilli: 3000, taxablePaise: 10_001, cgstPaise: 900, sgstPaise: 900, totalPaise: 11_801, costPaise: 7000 }), -1, true) },
  { name: 'HAND a box line returns its base units in proportion', input: only(0, 500, sold({ qtyMilli: 2000, baseQtyMilli: 24_000, igstPaise: 1800, cgstPaise: 0, sgstPaise: 0 })),
    check: result(lineOut({ qtyMilli: 500, baseQtyMilli: 6000, taxablePaise: 2500, igstPaise: 450, totalPaise: 2950, costPaise: 1750 }), 0, false) },
  { name: 'HAND more than is left refused', input: only(2000, 2000), check: { error: 'INVALID_INPUT' } },
  { name: 'HAND nothing to return refused', input: { lines: [], saleRoundOffPaise: 0, roundOffReturnedPaise: 0 }, check: { error: 'INVALID_INPUT' } },
];

function run(input: ReturnInput): Pick<ReturnCase, 'expected' | 'error'> {
  try {
    return { expected: computeReturn(input) };
  } catch (e) {
    if (e instanceof DomainError) return { error: e.code };
    throw e;
  }
}

// Deterministic lines (odd amounts, cess, inter-state) returned in parts: first, middle and last pieces, and the whole.
function grid(): ReturnCase[] {
  const cases: ReturnCase[] = [];
  for (let n = 1; n <= 8; n++) {
    const qtyMilli = n * 1250;
    const intra = n % 2 === 0;
    const taxable = 99_991 * n + 7;
    const tax = Math.floor(taxable * 0.18);
    const line = sold({
      qtyMilli, baseQtyMilli: qtyMilli * (n % 3 === 0 ? 12 : 1), taxablePaise: taxable, cgstPaise: intra ? Math.floor(tax / 2) : 0,
      sgstPaise: intra ? tax - Math.floor(tax / 2) : 0, igstPaise: intra ? 0 : tax, cessPaise: n % 4 === 0 ? 1237 * n : 0, cogsPaise: 70_013 * n,
    });
    const cuts = [0, Math.floor(qtyMilli / 3), Math.floor((2 * qtyMilli) / 3), qtyMilli];
    for (let k = 0; k < 3; k++) {
      const input: ReturnInput = { lines: [{ line, returnedBeforeMilli: cuts[k]!, qtyMilli: cuts[k + 1]! - cuts[k]! }], saleRoundOffPaise: n * 7 - 30, roundOffReturnedPaise: 0 };
      cases.push({ name: `GRID n=${n} part ${k + 1} of 3`, input, ...run(input) });
    }
    const whole: ReturnInput = {
      lines: [{ line, returnedBeforeMilli: 0, qtyMilli }, { line: sold(), returnedBeforeMilli: 1000, qtyMilli: 2000 }], saleRoundOffPaise: 45, roundOffReturnedPaise: 0,
    };
    cases.push({ name: `GRID n=${n} two lines, the rest of the bill`, input: whole, ...run(whole) });
  }
  return cases;
}

export function returnFixtures(): ReturnFixtureFile {
  const cases = hand.map((h): ReturnCase => {
    const got = run(h.input);
    if (JSON.stringify(got.error ? { error: got.error } : got.expected) !== JSON.stringify(h.check)) {
      throw new Error(`HAND-VERIFIED MISMATCH "${h.name}": got ${JSON.stringify(got)}`);
    }
    return { name: h.name, input: h.input, ...got };
  });
  return { version: 1, cases: [...cases, ...grid()] };
}
