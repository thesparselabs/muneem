import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { EMPTY_STOCK, issueStock, receiveStock, replayMovements, returnToSupplier, type StockMovementRecord, type StockState } from '../src/index.js';

describe('moving average costing (LLD §4.1)', () => {
  it('averages receipts and issues at the average', () => {
    let s: StockState = EMPTY_STOCK;
    s = receiveStock(s, 10_000, 100_000).state;          // 10 @ ₹100
    s = receiveStock(s, 10_000, 120_000).state;          // 10 @ ₹120 → avg ₹110
    const sold = issueStock(s, 5000, 0);
    expect(sold).toMatchObject({ unitCostPaise: 11_000, valueDeltaPaise: -55_000, provisional: false });
    expect(sold.state).toMatchObject({ qtyMilli: 15_000, valuePaise: 165_000 });
  });

  it('clamps value to zero when stock runs out, so no residue is left behind', () => {
    let s = receiveStock(EMPTY_STOCK, 3000, 1000).state;  // 3 @ 333.33…
    s = issueStock(s, 1000, 0).state;
    s = issueStock(s, 1000, 0).state;
    const last = issueStock(s, 1000, 0);
    expect(last.state).toMatchObject({ qtyMilli: 0, valuePaise: 0 });
    expect(last.valueDeltaPaise).toBe(-s.valuePaise);
  });

  it('issues below zero at the last known cost, marked provisional, and corrects on the next receipt', () => {
    let s = receiveStock(EMPTY_STOCK, 2000, 20_000).state;   // 2 @ ₹100
    const over = issueStock(s, 5000, 0);                     // 3 go negative
    expect(over).toMatchObject({ unitCostPaise: 10_000, provisional: true });
    expect(over.state).toMatchObject({ qtyMilli: -3000, valuePaise: -30_000 });
    s = over.state;
    const r = receiveStock(s, 10_000, 120_000);              // receipt @ ₹120 covers the 3 negative units
    expect(r.state).toMatchObject({ qtyMilli: 7000, valuePaise: 84_000 });
    expect(r.correctionPaise).toBe(-6000);                   // the 3 sold units really cost ₹20 more each
    expect(r.receiptDeltaPaise + r.correctionPaise).toBe(84_000 - -30_000);
  });

  it('a later sale never picks up the re-costing of units already sold below zero', () => {
    let s = issueStock(EMPTY_STOCK, 5000, 1000).state;            // sell 5 with no stock at ₹10 provisional
    expect(s).toMatchObject({ qtyMilli: -5000, valuePaise: -5000 });
    const r = receiveStock(s, 2000, 4000);                         // receive 2 at ₹20: covers 2 of the 5
    expect(r.correctionPaise).toBe(-2000);                         // those 2 really cost ₹10 more each
    s = r.state;
    expect(s).toMatchObject({ qtyMilli: -3000, valuePaise: -3000 }); // the other 3 keep their ₹10 provisional cost
    const sale = issueStock(s, 1000, 1000);
    expect(sale).toMatchObject({ unitCostPaise: 2000, valueDeltaPaise: -2000, provisional: true });
    const covered = receiveStock(sale.state, 10_000, 30_000);     // 10 at ₹30 covers the remaining 4
    expect(covered.correctionPaise).toBe(-(3 * 2000 + 1000));      // 3 units ₹10→₹30, 1 unit ₹20→₹30
    expect(covered.state).toMatchObject({ qtyMilli: 6000, valuePaise: 18_000 });
  });

  it('falls back to the given cost when there has never been a receipt', () => {
    expect(issueStock(EMPTY_STOCK, 1000, 4500)).toMatchObject({ unitCostPaise: 4500, provisional: true, valueDeltaPaise: -4500 });
  });
});

describe('return to supplier (ADR-0024)', () => {
  it('takes goods out at what they were bought for, not the average', () => {
    let s = receiveStock(EMPTY_STOCK, 10_000, 100_000).state;     // 10 @ ₹100
    s = receiveStock(s, 10_000, 140_000).state;                    // 10 @ ₹140 → avg ₹120
    const r = returnToSupplier(s, 5000, 70_000);                   // 5 of the ₹140 lot go back
    expect(r).toMatchObject({ returnDeltaPaise: -70_000, correctionPaise: 0, unitCostPaise: 14_000, provisional: false });
    expect(r.state).toMatchObject({ qtyMilli: 15_000, valuePaise: 170_000 });
  });

  it('books what is left as a correction when the return empties the stock', () => {
    let s = receiveStock(EMPTY_STOCK, 10_000, 100_000).state;
    s = receiveStock(s, 10_000, 140_000).state;
    s = issueStock(s, 10_000, 0).state;                            // 10 sold at ₹120 → ₹120,000 left
    const r = returnToSupplier(s, 10_000, 140_000);                // the ₹140 lot goes back
    expect(r.state).toMatchObject({ qtyMilli: 0, valuePaise: 0 });
    expect(r.correctionPaise).toBe(20_000);
    expect(r.returnDeltaPaise + r.correctionPaise).toBe(-s.valuePaise);
  });

  it('never leaves value below zero while stock remains', () => {
    const s = receiveStock(EMPTY_STOCK, 10_000, 10_000).state;   // 10 @ ₹10
    const r = returnToSupplier(s, 5000, 50_000);                   // 5 bought at ₹100 go back
    expect(r.state).toMatchObject({ qtyMilli: 5000, valuePaise: 0 });
    expect(r.correctionPaise).toBe(40_000);
  });

  it('values goods returned past zero at the return cost, marked provisional', () => {
    const s = receiveStock(EMPTY_STOCK, 2000, 20_000).state;
    const r = returnToSupplier(s, 5000, 60_000);                   // 5 @ ₹120 go back, only 2 on hand
    expect(r).toMatchObject({ provisional: true, unitCostPaise: 12_000 });
    expect(r.state).toMatchObject({ qtyMilli: -3000, valuePaise: -36_000 });
  });
});

const op = fc.oneof(
  fc.record({ kind: fc.constant('receive' as const), qtyMilli: fc.integer({ min: 1, max: 50_000 }), valuePaise: fc.integer({ min: 0, max: 5_000_000 }) }),
  fc.record({ kind: fc.constant('issue' as const), qtyMilli: fc.integer({ min: 1, max: 50_000 }), fallbackPaise: fc.integer({ min: 0, max: 50_000 }) }),
  fc.record({ kind: fc.constant('return' as const), qtyMilli: fc.integer({ min: 1, max: 50_000 }), valuePaise: fc.integer({ min: 0, max: 5_000_000 }) }),
);

function run(ops: Array<{ kind: 'receive' | 'issue' | 'return'; qtyMilli: number; valuePaise?: number; fallbackPaise?: number }>) {
  let s: StockState = EMPTY_STOCK;
  const records: StockMovementRecord[] = [];
  for (const o of ops) {
    if (o.kind === 'receive') {
      const r = receiveStock(s, o.qtyMilli, o.valuePaise!);
      records.push({ kind: 'receipt', qtyMilli: o.qtyMilli, valuePaise: r.receiptDeltaPaise, unitCostPaise: 0 });
      if (r.correctionPaise !== 0) records.push({ kind: 'correction', qtyMilli: 0, valuePaise: r.correctionPaise, unitCostPaise: 0 });
      s = r.state;
    } else if (o.kind === 'return') {
      const r = returnToSupplier(s, o.qtyMilli, o.valuePaise!);
      records.push({ kind: 'return', qtyMilli: -o.qtyMilli, valuePaise: r.returnDeltaPaise, unitCostPaise: r.unitCostPaise });
      if (r.correctionPaise !== 0) records.push({ kind: 'correction', qtyMilli: 0, valuePaise: r.correctionPaise, unitCostPaise: 0 });
      s = r.state;
    } else {
      const r = issueStock(s, o.qtyMilli, o.fallbackPaise!);
      expect(r.unitCostPaise).toBeGreaterThanOrEqual(0);
      records.push({ kind: 'issue', qtyMilli: -o.qtyMilli, valuePaise: r.valueDeltaPaise, unitCostPaise: r.unitCostPaise });
      s = r.state;
    }
    if (s.qtyMilli === 0) expect(s.valuePaise).toBe(0);
    if (s.qtyMilli > 0) expect(s.valuePaise).toBeGreaterThanOrEqual(0);
  }
  return { state: s, records };
}

describe('replay = projection (Stage 4 exit criterion)', () => {
  it('property: replaying the recorded movements rebuilds the same level and the same value deltas', () => {
    fc.assert(fc.property(fc.array(op, { maxLength: 40 }), (ops) => {
      const { state, records } = run(ops);
      const replayed = replayMovements(records);
      expect(replayed.state).toEqual(state);
      expect(replayed.mismatches).toEqual([]);
      expect(records.reduce((sum, m) => sum + m.valuePaise, 0)).toBe(state.valuePaise);
      expect(records.reduce((sum, m) => sum + m.qtyMilli, 0)).toBe(state.qtyMilli);
    }), { numRuns: 500 });
  });

  it('reports a tampered movement as a mismatch', () => {
    const { records } = run([{ kind: 'receive', qtyMilli: 1000, valuePaise: 500 }, { kind: 'issue', qtyMilli: 1000, fallbackPaise: 0 }]);
    records[1] = { ...records[1]!, valuePaise: -400 };
    expect(replayMovements(records).mismatches).toEqual([1]);
  });
});
