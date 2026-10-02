import { divRound } from '../money.js';
import { DomainError } from '../errors.js';

const MILLI = 1000;

// One (product, warehouse) level. Unit costs are paise per base unit; quantities are milli base units.
export interface StockState { qtyMilli: number; valuePaise: number; lastUnitCostPaise: number }
export const EMPTY_STOCK: StockState = { qtyMilli: 0, valuePaise: 0, lastUnitCostPaise: 0 };

export const averageCostPaise = (s: StockState): number => (s.qtyMilli > 0 ? divRound(s.valuePaise * MILLI, s.qtyMilli) : s.lastUnitCostPaise);

function assertQty(qtyMilli: number): void {
  if (!Number.isSafeInteger(qtyMilli) || qtyMilli <= 0) throw new DomainError('INVALID_INPUT', `stock quantity must be positive, got ${qtyMilli}`);
}

export interface IssueResult { state: StockState; valueDeltaPaise: number; unitCostPaise: number; provisional: boolean }

// LLD §4.1 ISSUE. Below zero the cost is provisional (last known cost, else the fallback) and is corrected on the next receipt.
export function issueStock(s: StockState, qtyMilli: number, fallbackUnitCostPaise: number): IssueResult {
  assertQty(qtyMilli);
  const unitCostPaise = s.qtyMilli > 0 ? divRound(s.valuePaise * MILLI, s.qtyMilli) : s.lastUnitCostPaise || Math.max(0, fallbackUnitCostPaise);
  const qty = s.qtyMilli - qtyMilli;
  let value = s.valuePaise - divRound(qtyMilli * unitCostPaise, MILLI);
  if (qty === 0) value = 0;
  if (qty < 0) value = divRound(qty * unitCostPaise, MILLI);
  return {
    state: { qtyMilli: qty, valuePaise: value, lastUnitCostPaise: unitCostPaise },
    valueDeltaPaise: value - s.valuePaise,
    unitCostPaise,
    provisional: qty < 0,
  };
}

export interface ReceiptResult { state: StockState; receiptDeltaPaise: number; correctionPaise: number }

// LLD §4.1 RECEIPT. Units that were sold below zero at a provisional cost are re-costed at this receipt's cost;
// the difference is returned separately so it can be booked as a cost correction (COGS ↔ inventory).
export function receiveStock(s: StockState, qtyMilli: number, receiptValuePaise: number): ReceiptResult {
  assertQty(qtyMilli);
  if (!Number.isSafeInteger(receiptValuePaise) || receiptValuePaise < 0) throw new DomainError('INVALID_INPUT', `receipt value must be ≥ 0, got ${receiptValuePaise}`);
  const qty = s.qtyMilli + qtyMilli;
  const receiptUnitCost = divRound(receiptValuePaise * MILLI, qtyMilli);
  const plain = s.valuePaise + receiptValuePaise;
  let target = plain;
  if (s.qtyMilli < 0) {
    if (qty > 0) target = divRound(receiptValuePaise * qty, qtyMilli);
    else if (qty === 0) target = 0;
    else target = divRound(qty * s.lastUnitCostPaise, MILLI);
  }
  return {
    state: { qtyMilli: qty, valuePaise: target, lastUnitCostPaise: receiptUnitCost },
    receiptDeltaPaise: receiptValuePaise,
    correctionPaise: target - plain,
  };
}

// A stored movement as the engine needs it: receipts carry their value, issues their quantity (negative) and the
// unit cost they used (which is also the fallback to reuse), corrections only a value.
export interface StockMovementRecord { kind: 'receipt' | 'issue' | 'correction'; qtyMilli: number; valuePaise: number; unitCostPaise: number }

// replay(movements) = projection: re-run the engine over the stored movements and point at any delta it disagrees with.
export function replayMovements(records: readonly StockMovementRecord[]): { state: StockState; mismatches: number[] } {
  let s: StockState = EMPTY_STOCK;
  const mismatches: number[] = [];
  let expectedCorrection: number | null = null;
  records.forEach((m, i) => {
    if (m.kind === 'correction') {
      if (expectedCorrection !== m.valuePaise) mismatches.push(i);
      s = { ...s, valuePaise: s.valuePaise + m.valuePaise };
      expectedCorrection = null;
      return;
    }
    if (expectedCorrection !== null && expectedCorrection !== 0) mismatches.push(i);
    expectedCorrection = null;
    if (m.kind === 'receipt') {
      const r = receiveStock(s, m.qtyMilli, m.valuePaise);
      s = { ...r.state, valuePaise: s.valuePaise + r.receiptDeltaPaise };
      if (r.correctionPaise !== 0) expectedCorrection = r.correctionPaise;
      return;
    }
    const r = issueStock(s, -m.qtyMilli, m.unitCostPaise);
    if (r.valueDeltaPaise !== m.valuePaise || r.unitCostPaise !== m.unitCostPaise) mismatches.push(i);
    s = r.state;
  });
  if (expectedCorrection !== null && expectedCorrection !== 0) mismatches.push(records.length);
  return { state: s, mismatches };
}
