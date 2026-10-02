import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { EMPTY_STOCK, issueStock, receiveStock, replayMovements, type StockMovementRecord, type StockState } from '../src/index.js';

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

  it('falls back to the given cost when there has never been a receipt', () => {
    expect(issueStock(EMPTY_STOCK, 1000, 4500)).toMatchObject({ unitCostPaise: 4500, provisional: true, valueDeltaPaise: -4500 });
  });
});

const op = fc.oneof(
  fc.record({ kind: fc.constant('receive' as const), qtyMilli: fc.integer({ min: 1, max: 50_000 }), valuePaise: fc.integer({ min: 0, max: 5_000_000 }) }),
  fc.record({ kind: fc.constant('issue' as const), qtyMilli: fc.integer({ min: 1, max: 50_000 }), fallbackPaise: fc.integer({ min: 0, max: 50_000 }) }),
);

function run(ops: Array<{ kind: 'receive' | 'issue'; qtyMilli: number; valuePaise?: number; fallbackPaise?: number }>) {
  let s: StockState = EMPTY_STOCK;
  const records: StockMovementRecord[] = [];
  for (const o of ops) {
    if (o.kind === 'receive') {
      const r = receiveStock(s, o.qtyMilli, o.valuePaise!);
      records.push({ kind: 'receipt', qtyMilli: o.qtyMilli, valuePaise: r.receiptDeltaPaise, unitCostPaise: 0 });
      if (r.correctionPaise !== 0) records.push({ kind: 'correction', qtyMilli: 0, valuePaise: r.correctionPaise, unitCostPaise: 0 });
      s = r.state;
    } else {
      const r = issueStock(s, o.qtyMilli, o.fallbackPaise!);
      expect(r.unitCostPaise).toBeGreaterThanOrEqual(0);
      records.push({ kind: 'issue', qtyMilli: -o.qtyMilli, valuePaise: r.valueDeltaPaise, unitCostPaise: r.unitCostPaise });
      s = r.state;
    }
    if (s.qtyMilli === 0) expect(s.valuePaise).toBe(0);
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
