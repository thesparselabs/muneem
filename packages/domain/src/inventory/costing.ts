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

// LLD §4.1 ISSUE, except below zero: units already sold short keep their cost; only this sale's units are added at the provisional cost.
export function issueStock(s: StockState, qtyMilli: number, fallbackUnitCostPaise: number): IssueResult {
  assertQty(qtyMilli);
  const unitCostPaise = s.qtyMilli > 0 ? divRound(s.valuePaise * MILLI, s.qtyMilli) : s.lastUnitCostPaise || Math.max(0, fallbackUnitCostPaise);
  const qty = s.qtyMilli - qtyMilli;
  let value: number;
  if (qty === 0) value = 0;
  else if (qty > 0) value = s.valuePaise - divRound(qtyMilli * unitCostPaise, MILLI);
  else if (s.qtyMilli > 0) value = divRound(qty * unitCostPaise, MILLI);
  else value = s.valuePaise - divRound(qtyMilli * unitCostPaise, MILLI);
  return {
    state: { qtyMilli: qty, valuePaise: value, lastUnitCostPaise: unitCostPaise },
    valueDeltaPaise: value - s.valuePaise,
    unitCostPaise,
    provisional: qty < 0,
  };
}

export interface ReceiptResult { state: StockState; receiptDeltaPaise: number; correctionPaise: number }

// LLD §4.1 RECEIPT; the units it covers below zero move from their provisional cost to this receipt's cost, returned as a correction.
export function receiveStock(s: StockState, qtyMilli: number, receiptValuePaise: number): ReceiptResult {
  assertQty(qtyMilli);
  if (!Number.isSafeInteger(receiptValuePaise) || receiptValuePaise < 0) throw new DomainError('INVALID_INPUT', `receipt value must be ≥ 0, got ${receiptValuePaise}`);
  const qty = s.qtyMilli + qtyMilli;
  const receiptUnitCost = divRound(receiptValuePaise * MILLI, qtyMilli);
  let correctionPaise = 0;
  if (s.qtyMilli < 0) {
    const covered = Math.min(-s.qtyMilli, qtyMilli);
    const provisionalCovered = divRound(-s.valuePaise * covered, -s.qtyMilli);
    const trueCovered = divRound(receiptValuePaise * covered, qtyMilli);
    correctionPaise = provisionalCovered - trueCovered;
  }
  return {
    state: { qtyMilli: qty, valuePaise: s.valuePaise + receiptValuePaise + correctionPaise, lastUnitCostPaise: receiptUnitCost },
    receiptDeltaPaise: receiptValuePaise,
    correctionPaise,
  };
}

// Receipts carry their value, issues their (negative) quantity and the unit cost used, corrections only a value.
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
