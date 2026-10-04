import { DomainError, allocateOldestFirst, type AllocationResult, type OpenItem } from '../src/index.js';

export interface AllocationCase { name: string; items: OpenItem[]; amountPaise: number; expected?: AllocationResult; error?: string }
export interface AllocationFixtureFile { version: 1; cases: AllocationCase[] }

const item = (id: string, dueDate: string, outstandingPaise: number, docDate = dueDate): OpenItem => ({ id, dueDate, docDate, outstandingPaise });

type Hand = { name: string; items: OpenItem[]; amountPaise: number; check: AllocationResult | { error: string } };
const hand: Hand[] = [
  { name: 'HAND oldest due first, rest left as an advance', items: [item('B', '2026-10-20', 4000), item('A', '2026-10-10', 6000), item('C', '2026-10-30', 5000)],
    amountPaise: 20_000, check: { allocations: [{ itemId: 'A', amountPaise: 6000 }, { itemId: 'B', amountPaise: 4000 }, { itemId: 'C', amountPaise: 5000 }], unallocatedPaise: 5000 } },
  { name: 'HAND partial last item', items: [item('A', '2026-10-10', 6000), item('B', '2026-10-20', 4000)],
    amountPaise: 7000, check: { allocations: [{ itemId: 'A', amountPaise: 6000 }, { itemId: 'B', amountPaise: 1000 }], unallocatedPaise: 0 } },
  { name: 'HAND due-date tie broken by doc date, then id', items: [item('Z', '2026-10-10', 100, '2026-10-02'), item('Y', '2026-10-10', 100, '2026-10-01'), item('X', '2026-10-10', 100, '2026-10-02')],
    amountPaise: 300, check: { allocations: [{ itemId: 'Y', amountPaise: 100 }, { itemId: 'X', amountPaise: 100 }, { itemId: 'Z', amountPaise: 100 }], unallocatedPaise: 0 } },
  { name: 'HAND settled and credit items are skipped', items: [item('A', '2026-10-01', 0), item('B', '2026-10-02', -500), item('C', '2026-10-03', 900)],
    amountPaise: 1000, check: { allocations: [{ itemId: 'C', amountPaise: 900 }], unallocatedPaise: 100 } },
  { name: 'HAND nothing open: all unallocated', items: [], amountPaise: 2500, check: { allocations: [], unallocatedPaise: 2500 } },
  { name: 'HAND zero payment refused', items: [item('A', '2026-10-01', 100)], amountPaise: 0, check: { error: 'INVALID_INPUT' } },
  { name: 'HAND negative payment refused', items: [item('A', '2026-10-01', 100)], amountPaise: -1, check: { error: 'INVALID_INPUT' } },
];

function run(items: OpenItem[], amountPaise: number): Pick<AllocationCase, 'expected' | 'error'> {
  try {
    return { expected: allocateOldestFirst(items, amountPaise) };
  } catch (e) {
    if (e instanceof DomainError) return { error: e.code };
    throw e;
  }
}

// A deterministic grid: ids in creation order, due dates that repeat so the tie-breaks are exercised.
function grid(): AllocationCase[] {
  const cases: AllocationCase[] = [];
  for (let n = 1; n <= 12; n++) {
    const items = Array.from({ length: n }, (_, k) => item(
      `01J${String(1000 + ((k * 7) % n)).padStart(23, '0')}`, `2026-0${1 + (k % 3)}-1${k % 2}`, ((k * 3517) % 9000) - 500, `2026-0${1 + (k % 2)}-0${1 + (k % 5)}`,
    ));
    const open = items.reduce((s, i) => s + Math.max(0, i.outstandingPaise), 0);
    for (const amountPaise of [1, Math.max(1, Math.floor(open / 2)), open || 1, open + 777]) {
      cases.push({ name: `GRID n=${n} amount=${amountPaise}`, items, amountPaise, ...run(items, amountPaise) });
    }
  }
  return cases;
}

export function allocationFixtures(): AllocationFixtureFile {
  const cases = hand.map((h): AllocationCase => {
    const got = run(h.items, h.amountPaise);
    if (JSON.stringify(got.error ? { error: got.error } : got.expected) !== JSON.stringify(h.check)) {
      throw new Error(`HAND-VERIFIED MISMATCH "${h.name}": got ${JSON.stringify(got)}`);
    }
    return { name: h.name, items: h.items, amountPaise: h.amountPaise, ...got };
  });
  return { version: 1, cases: [...cases, ...grid()] };
}
