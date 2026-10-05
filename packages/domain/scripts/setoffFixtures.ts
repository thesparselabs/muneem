import { computeSetoff, DomainError, type GstHeads, type SetoffResult } from '../src/index.js';

export interface SetoffCase { name: string; liability: GstHeads; credit: GstHeads; expected?: SetoffResult; error?: string }
export interface SetoffFixtureFile { version: 1; cases: SetoffCase[] }

const h = (igstPaise: number, cgstPaise: number, sgstPaise: number, cessPaise = 0): GstHeads => ({ igstPaise, cgstPaise, sgstPaise, cessPaise });

type Hand = { name: string; liability: GstHeads; credit: GstHeads; check: { cash: GstHeads; creditLeft: GstHeads } | { error: string } };
const hand: Hand[] = [
  { name: 'HAND IGST credit is used up first even when CGST and SGST credit could pay', liability: h(1000, 500, 500, 50), credit: h(2000, 800, 800, 80),
    check: { cash: h(0, 0, 0, 0), creditLeft: h(0, 800, 800, 30) } },
  { name: 'HAND IGST credit pays IGST, then the CGST and SGST their own credit cannot cover', liability: h(1000, 900, 900), credit: h(1600, 600, 900),
    check: { cash: h(0, 0, 0), creditLeft: h(0, 300, 0) } },
  { name: 'HAND CGST credit never pays SGST', liability: h(0, 0, 1000), credit: h(0, 5000, 0), check: { cash: h(0, 0, 1000), creditLeft: h(0, 5000, 0) } },
  { name: 'HAND SGST credit pays IGST after SGST', liability: h(1000, 0, 200), credit: h(0, 0, 900), check: { cash: h(300, 0, 0), creditLeft: h(0, 0, 0) } },
  { name: 'HAND cess pays only cess', liability: h(100, 0, 0, 500), credit: h(0, 0, 0, 2000), check: { cash: h(100, 0, 0, 0), creditLeft: h(0, 0, 0, 1500) } },
  { name: 'HAND nothing to set off', liability: h(0, 0, 0), credit: h(0, 0, 0), check: { cash: h(0, 0, 0), creditLeft: h(0, 0, 0) } },
  { name: 'HAND negative liability refused', liability: h(-1, 0, 0), credit: h(0, 0, 0), check: { error: 'INVALID_INPUT' } },
];

function run(liability: GstHeads, credit: GstHeads): Pick<SetoffCase, 'expected' | 'error'> {
  try {
    return { expected: computeSetoff(liability, credit) };
  } catch (e) {
    if (e instanceof DomainError) return { error: e.code };
    throw e;
  }
}

// Deterministic pseudo-random spread over the shapes that matter: one head short, all short, credit only in IGST, and so on.
function generated(): SetoffCase[] {
  let seed = 20_261_004;
  const next = (max: number) => { seed = (seed * 1_103_515_245 + 12_345) % 2_147_483_648; return seed % (max + 1); };
  const heads = (max: number) => h(next(max), next(max), next(max), next(max) % 3 === 0 ? 0 : next(max));
  return Array.from({ length: 40 }, (_, i) => {
    const liability = heads(i % 4 === 0 ? 1_000 : 5_000_000);
    const credit = heads(i % 3 === 0 ? 10_000_000 : 3_000_000);
    return { name: `GEN ${i + 1}`, liability, credit, ...run(liability, credit) };
  });
}

export function setoffFixtures(): SetoffFixtureFile {
  const cases = hand.map((c): SetoffCase => {
    const got = run(c.liability, c.credit);
    if ('error' in c.check) {
      if (got.error !== c.check.error) throw new Error(`${c.name}: expected ${c.check.error}, got ${JSON.stringify(got)}`);
    } else if (JSON.stringify({ cash: got.expected?.cash, creditLeft: got.expected?.creditLeft }) !== JSON.stringify(c.check)) {
      throw new Error(`${c.name}: expected ${JSON.stringify(c.check)}, got ${JSON.stringify(got.expected)}`);
    }
    return { name: c.name, liability: c.liability, credit: c.credit, ...got };
  });
  return { version: 1, cases: [...cases, ...generated()] };
}
