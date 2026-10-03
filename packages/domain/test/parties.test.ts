import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  ageingBucket, allocateAsChosen, allocateOldestFirst, chargeSign, daysPastDue, reconcileParties, type OpenItem, type PartyAllocation, type PartyDocument, type PartyEntry,
  type PartyType,
} from '../src/index.js';

const item = (id: string, dueDate: string, outstandingPaise: number, docDate = dueDate): OpenItem => ({ id, dueDate, docDate, outstandingPaise });

describe('allocation (ADR-0025)', () => {
  it('settles the oldest due first and keeps the rest as an advance', () => {
    const items = [item('B', '2026-10-20', 4000), item('A', '2026-10-10', 6000), item('C', '2026-10-30', 5000)];
    expect(allocateOldestFirst(items, 12_000)).toEqual({
      allocations: [{ itemId: 'A', amountPaise: 6000 }, { itemId: 'B', amountPaise: 4000 }, { itemId: 'C', amountPaise: 2000 }],
      unallocatedPaise: 0,
    });
    expect(allocateOldestFirst(items, 20_000).unallocatedPaise).toBe(5000);
  });

  it('breaks a due-date tie by document date, then by id', () => {
    const items = [item('Z', '2026-10-10', 100, '2026-10-02'), item('Y', '2026-10-10', 100, '2026-10-01'), item('X', '2026-10-10', 100, '2026-10-02')];
    expect(allocateOldestFirst(items, 300).allocations.map((a) => a.itemId)).toEqual(['Y', 'X', 'Z']);
  });

  it('takes the user\'s choice when it fits, and refuses one that does not', () => {
    const items = [item('A', '2026-10-10', 6000), item('B', '2026-10-20', 4000)];
    expect(allocateAsChosen(items, 5000, [{ itemId: 'B', amountPaise: 4000 }])).toEqual({ allocations: [{ itemId: 'B', amountPaise: 4000 }], unallocatedPaise: 1000 });
    expect(() => allocateAsChosen(items, 5000, [{ itemId: 'B', amountPaise: 4001 }])).toThrow(/exceeds/);
    expect(() => allocateAsChosen(items, 5000, [{ itemId: 'A', amountPaise: 3000 }, { itemId: 'B', amountPaise: 3000 }])).toThrow(/exceed the payment/);
    expect(() => allocateAsChosen(items, 5000, [{ itemId: 'Q', amountPaise: 1 }])).toThrow(/not open/);
    expect(() => allocateAsChosen(items, 5000, [{ itemId: 'A', amountPaise: 1 }, { itemId: 'A', amountPaise: 1 }])).toThrow(/twice/);
  });

  it('property: never allocates more than the payment or more than any item owes', () => {
    const items = fc.array(fc.record({ due: fc.integer({ min: 1, max: 28 }), owed: fc.integer({ min: 0, max: 100_000 }) }), { maxLength: 30 });
    fc.assert(fc.property(items, fc.integer({ min: 1, max: 1_000_000 }), (raw, amount) => {
      const open = raw.map((r, i) => item(`I${String(i).padStart(3, '0')}`, `2026-10-${String(r.due).padStart(2, '0')}`, r.owed));
      const { allocations, unallocatedPaise } = allocateOldestFirst(open, amount);
      const total = allocations.reduce((s, a) => s + a.amountPaise, 0);
      expect(total + unallocatedPaise).toBe(amount);
      expect(unallocatedPaise).toBeGreaterThanOrEqual(0);
      for (const a of allocations) expect(a.amountPaise).toBeLessThanOrEqual(open.find((o) => o.id === a.itemId)!.outstandingPaise);
      expect(unallocatedPaise === 0 || open.every((o) => (allocations.find((a) => a.itemId === o.id)?.amountPaise ?? 0) === o.outstandingPaise)).toBe(true);
    }), { numRuns: 300 });
  });
});

const PARTIES: { partyType: PartyType; partyId: string }[] = [
  { partyType: 'customer', partyId: 'C1' }, { partyType: 'customer', partyId: 'C2' },
  { partyType: 'supplier', partyId: 'S1' }, { partyType: 'supplier', partyId: 'S2' },
];

type Op =
  | { kind: 'charge'; party: number; amount: number }
  | { kind: 'settle'; party: number; amount: number }
  | { kind: 'allocateLater'; pick: number }
  | { kind: 'cancelSettlement'; pick: number }
  | { kind: 'cancelCharge'; pick: number };

const opArb: fc.Arbitrary<Op> = fc.oneof(
  fc.record({ kind: fc.constant('charge' as const), party: fc.nat(3), amount: fc.integer({ min: 1, max: 100_000 }) }),
  fc.record({ kind: fc.constant('settle' as const), party: fc.nat(3), amount: fc.integer({ min: 1, max: 100_000 }) }),
  fc.record({ kind: fc.constant('allocateLater' as const), pick: fc.nat() }),
  fc.record({ kind: fc.constant('cancelSettlement' as const), pick: fc.nat() }),
  fc.record({ kind: fc.constant('cancelCharge' as const), pick: fc.nat() }),
);

// A model of the sub-ledger: every document writes its entry, payments allocate oldest first, cancellations reverse.
function simulate(ops: readonly Op[]) {
  const entries: PartyEntry[] = [];
  const charges: PartyDocument[] = [];
  const settlements: PartyDocument[] = [];
  const allocations: PartyAllocation[] = [];
  const used = (id: string) => allocations.filter((a) => a.live && (a.sourceId === id || a.targetId === id)).reduce((s, a) => s + a.amountPaise, 0);
  const allocate = (s: PartyDocument) => {
    const open = charges.filter((c) => c.live && c.partyType === s.partyType && c.partyId === s.partyId)
      .map((c, i) => item(c.id, `2026-10-${String((i % 28) + 1).padStart(2, '0')}`, c.amountPaise - used(c.id)));
    const left = s.amountPaise - used(s.id);
    if (left === 0) return;
    for (const a of allocateOldestFirst(open, left).allocations) allocations.push({ sourceId: s.id, targetId: a.itemId, amountPaise: a.amountPaise, live: true });
  };
  ops.forEach((o, n) => {
    if (o.kind === 'charge' || o.kind === 'settle') {
      const p = PARTIES[o.party]!;
      const doc = { ...p, id: `${o.kind}${n}`, amountPaise: o.amount, live: true };
      const sign = chargeSign(p.partyType) * (o.kind === 'charge' ? 1 : -1);
      entries.push({ ...p, amountPaise: sign * o.amount });
      if (o.kind === 'charge') charges.push(doc);
      else { settlements.push(doc); allocate(doc); }
      return;
    }
    if (o.kind === 'allocateLater') {
      const live = settlements.filter((s) => s.live);
      if (live.length > 0) allocate(live[o.pick % live.length]!);
      return;
    }
    if (o.kind === 'cancelSettlement') {
      const live = settlements.filter((s) => s.live);
      if (live.length === 0) return;
      const s = live[o.pick % live.length]!;
      s.live = false;
      allocations.filter((a) => a.sourceId === s.id).forEach((a) => { a.live = false; });
      entries.push({ partyType: s.partyType, partyId: s.partyId, amountPaise: chargeSign(s.partyType) * s.amountPaise });
      return;
    }
    const free = charges.filter((c) => c.live && used(c.id) === 0);
    if (free.length === 0) return;
    const c = free[o.pick % free.length]!;
    c.live = false;
    entries.push({ partyType: c.partyType, partyId: c.partyId, amountPaise: -chargeSign(c.partyType) * c.amountPaise });
  });
  return { entries, charges, settlements, allocations };
}

describe('party sub-ledger reconciliation (Stage 5 exit criterion, ADR-0022)', () => {
  it('property: entries equal open charges less unallocated settlements, per party, after any sequence', () => {
    fc.assert(fc.property(fc.array(opArb, { maxLength: 60 }), (ops) => {
      const ledger = simulate(ops);
      expect(reconcileParties(ledger)).toEqual({ mismatches: [], faults: [] });
    }), { numRuns: 500 });
  });

  it('signs balances so a customer owes and a supplier is owed', () => {
    const r = reconcileParties({
      entries: [{ partyType: 'customer', partyId: 'C1', amountPaise: 100 }, { partyType: 'supplier', partyId: 'S1', amountPaise: -50 }],
      charges: [], settlements: [], allocations: [],
    });
    expect(r.mismatches).toEqual([
      { partyType: 'customer', partyId: 'C1', ledgerPaise: 100, openItemsPaise: 0 },
      { partyType: 'supplier', partyId: 'S1', ledgerPaise: -50, openItemsPaise: 0 },
    ]);
  });

  it('names a tampered entry, an over-allocation, a cross-party allocation and one onto a cancelled document', () => {
    const ledger = simulate([{ kind: 'charge', party: 0, amount: 1000 }, { kind: 'settle', party: 0, amount: 400 }, { kind: 'charge', party: 1, amount: 500 }]);
    ledger.entries[0] = { ...ledger.entries[0]!, amountPaise: 999 };
    expect(reconcileParties(ledger).mismatches).toEqual([{ partyType: 'customer', partyId: 'C1', ledgerPaise: 599, openItemsPaise: 600 }]);

    const over = simulate([{ kind: 'charge', party: 0, amount: 1000 }, { kind: 'settle', party: 0, amount: 400 }]);
    over.allocations.push({ sourceId: 'settle1', targetId: 'charge0', amountPaise: 100, live: true });
    expect(reconcileParties(over).faults).toContainEqual({ kind: 'over_allocated', documentId: 'settle1', allocatedPaise: 500, amountPaise: 400 });

    const cross = simulate([{ kind: 'charge', party: 0, amount: 1000 }, { kind: 'settle', party: 1, amount: 400 }]);
    cross.allocations.push({ sourceId: 'settle1', targetId: 'charge0', amountPaise: 100, live: true });
    expect(reconcileParties(cross).faults).toContainEqual({ kind: 'cross_party', sourceId: 'settle1', targetId: 'charge0' });

    const dead = simulate([{ kind: 'charge', party: 0, amount: 1000 }, { kind: 'settle', party: 0, amount: 400 }]);
    dead.charges[0]!.live = false;
    expect(reconcileParties(dead).faults).toContainEqual({ kind: 'dead_document', sourceId: 'settle1', targetId: 'charge0' });
  });
});

describe('ageing (5b)', () => {
  it('ages from the due date, with each boundary in the lower bucket', () => {
    const asOf = '2026-12-31';
    expect(ageingBucket('2027-01-01', asOf)).toBe('notDue');
    expect(ageingBucket('2026-12-31', asOf)).toBe('days0to30');
    expect(ageingBucket('2026-12-01', asOf)).toBe('days0to30');
    expect(ageingBucket('2026-11-30', asOf)).toBe('days31to60');
    expect(ageingBucket('2026-11-01', asOf)).toBe('days31to60');
    expect(ageingBucket('2026-10-31', asOf)).toBe('days61to90');
    expect(ageingBucket('2026-10-02', asOf)).toBe('days61to90');
    expect(ageingBucket('2026-10-01', asOf)).toBe('over90');
    expect(daysPastDue('2026-02-28', '2026-03-01')).toBe(1);
    expect(() => ageingBucket('31/12/2026', asOf)).toThrow(/business date/);
  });
});
