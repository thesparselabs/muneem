import {
  EMPTY_STOCK, averageCostPaise, issueStock, newUlid, receiveStock, replayMovements, type StockMovementRecord, type StockState,
} from '@muneem/domain';
import type { Db } from '../open.js';
import { stmt } from '../statements.js';
import { nowIso, withTransaction } from '../uow.js';
import type { Actor } from './business.js';
import { getBranch } from './business.js';
import { recordChange, syncColumns } from './catalogWrite.js';

export type MovementType = 'opening' | 'sale' | 'adjustment' | 'purchase' | 'sale_return' | 'purchase_return' | 'cost_correction';
export type RefType = 'sale' | 'opening' | 'adjustment' | 'stock_take' | 'purchase' | 'sale_return' | 'purchase_return' | 'correction';
export type ReasonCode = 'damage' | 'theft' | 'expiry' | 'counting_error' | 'opening' | 'other';

export interface Warehouse { id: string; businessId: string; branchId: string; code: string; name: string }

export function defaultWarehouseId(db: Db, branchId: string): string | null {
  return (stmt(db, 'SELECT id FROM warehouse WHERE branch_id = ? AND is_default = 1 AND deleted_at IS NULL').pluck().get(branchId) as string | undefined) ?? null;
}

// One warehouse per branch until multi-warehouse lands (ADR-0021); made the first time stock moves.
export function ensureDefaultWarehouse(db: Db, businessId: string, branchId: string, actor: Actor): string {
  const existing = defaultWarehouseId(db, branchId);
  if (existing) return existing;
  const branch = getBranch(db, branchId)!;
  const id = newUlid();
  const s = syncColumns(actor);
  stmt(db, `INSERT INTO warehouse (id, business_id, branch_id, code, name, is_default, created_at, updated_at, created_by, device_id)
    VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, ?)`).run(id, businessId, branchId, branch.code, `${branch.name} store`, s.t, s.t, s.created_by, s.device_id);
  recordChange(db, businessId, actor, {
    action: 'warehouse.create', entityType: 'warehouse', entityId: id, operationType: 'create',
    after: { id, businessId, branchId, code: branch.code, name: `${branch.name} store` },
  });
  return id;
}

export function listWarehouses(db: Db, businessId: string): Warehouse[] {
  return stmt(db, 'SELECT id, business_id AS businessId, branch_id AS branchId, code, name FROM warehouse WHERE business_id = ? AND deleted_at IS NULL ORDER BY code')
    .all(businessId) as Warehouse[];
}

type LevelRow = { qty_milli: number; value_paise: number; last_unit_cost_paise: number };

export function stockState(db: Db, businessId: string, warehouseId: string, productId: string): StockState {
  const r = stmt(db, `SELECT qty_milli, value_paise, last_unit_cost_paise FROM stock_level
    WHERE business_id = ? AND warehouse_id = ? AND product_id = ? AND variant_id = ''`).get(businessId, warehouseId, productId) as LevelRow | undefined;
  return r ? { qtyMilli: r.qty_milli, valuePaise: r.value_paise, lastUnitCostPaise: r.last_unit_cost_paise } : EMPTY_STOCK;
}

function writeLevel(db: Db, businessId: string, warehouseId: string, productId: string, s: StockState, at: string): void {
  stmt(db, `INSERT INTO stock_level (business_id, warehouse_id, product_id, variant_id, qty_milli, value_paise, avg_cost_paise, last_unit_cost_paise, last_movement_at)
    VALUES (@businessId, @warehouseId, @productId, '', @qty, @value, @avg, @last, @at)
    ON CONFLICT (business_id, warehouse_id, product_id, variant_id) DO UPDATE SET qty_milli = @qty, value_paise = @value, avg_cost_paise = @avg,
      last_unit_cost_paise = @last, last_movement_at = @at`).run({
    businessId, warehouseId, productId, qty: s.qtyMilli, value: s.valuePaise, avg: averageCostPaise(s), last: s.lastUnitCostPaise, at,
  });
}

export function productFallbackCost(db: Db, productId: string): number {
  return (stmt(db, 'SELECT COALESCE(purchase_price_paise, 0) FROM product WHERE id = ?').pluck().get(productId) as number | undefined) ?? 0;
}

export interface MovementInput {
  businessId: string; warehouseId: string; productId: string; type: Exclude<MovementType, 'cost_correction'>;
  qtyMilli: number;            // signed, base units: positive receives, negative issues
  receiptValuePaise?: number;  // receipts only
  refType: RefType; refId: string; refLineId?: string | null; reasonCode?: ReasonCode | null; note?: string | null;
}

export interface PostedMovement {
  id: string; productId: string; type: MovementType; qtyMilli: number; valuePaise: number; unitCostPaise: number; provisional: boolean;
  refType: RefType; refId: string; refLineId: string | null; reasonCode: ReasonCode | null;
}

function insertMovement(db: Db, m: PostedMovement, businessId: string, warehouseId: string, note: string | null, actor: Actor, at: string): void {
  stmt(db, `INSERT INTO stock_movement (id, business_id, warehouse_id, product_id, movement_type, signed_qty_milli, unit_cost_paise, value_paise,
      cost_provisional, ref_type, ref_id, ref_line_id, reason_code, note, occurred_at, created_at, updated_at, created_by, device_id)
    VALUES (@id, @businessId, @warehouseId, @productId, @type, @qty, @unitCost, @value, @provisional, @refType, @refId, @refLineId, @reason, @note,
      @at, @at, @at, @createdBy, @deviceId)`).run({
    id: m.id, businessId, warehouseId, productId: m.productId, type: m.type, qty: m.qtyMilli, unitCost: m.unitCostPaise, value: m.valuePaise,
    provisional: m.provisional ? 1 : 0, refType: m.refType, refId: m.refId, refLineId: m.refLineId, reason: m.reasonCode, note,
    at, createdBy: actor.userId, deviceId: actor.deviceId,
  });
}

// The only writer of stock_level (LLD §4.2): the movement and the cache change together, through the costing engine.
export function postMovement(db: Db, input: MovementInput, actor: Actor): PostedMovement[] {
  const at = nowIso();
  const before = stockState(db, input.businessId, input.warehouseId, input.productId);
  const base = {
    productId: input.productId, type: input.type, qtyMilli: input.qtyMilli, refType: input.refType, refId: input.refId,
    refLineId: input.refLineId ?? null, reasonCode: input.reasonCode ?? null,
  };
  const posted: PostedMovement[] = [];
  let after: StockState;
  if (input.qtyMilli > 0) {
    const r = receiveStock(before, input.qtyMilli, input.receiptValuePaise ?? 0);
    posted.push({ ...base, id: newUlid(), valuePaise: r.receiptDeltaPaise, unitCostPaise: r.state.lastUnitCostPaise, provisional: false });
    if (r.correctionPaise !== 0) {
      posted.push({
        id: newUlid(), productId: input.productId, type: 'cost_correction', qtyMilli: 0, valuePaise: r.correctionPaise, unitCostPaise: 0,
        provisional: false, refType: 'correction', refId: posted[0]!.id, refLineId: null, reasonCode: null,
      });
    }
    after = r.state;
  } else {
    const r = issueStock(before, -input.qtyMilli, productFallbackCost(db, input.productId));
    posted.push({ ...base, id: newUlid(), valuePaise: r.valueDeltaPaise, unitCostPaise: r.unitCostPaise, provisional: r.provisional });
    after = r.state;
  }
  for (const m of posted) insertMovement(db, m, input.businessId, input.warehouseId, input.note ?? null, actor, at);
  writeLevel(db, input.businessId, input.warehouseId, input.productId, after, at);
  return posted;
}

// What an issue would cost right now, without writing anything; lines of the same product chain through the level.
export function planIssues(db: Db, businessId: string, warehouseId: string, lines: readonly { productId: string; qtyMilli: number }[]) {
  const states = new Map<string, StockState>();
  return lines.map((l) => {
    const before = states.get(l.productId) ?? stockState(db, businessId, warehouseId, l.productId);
    const r = issueStock(before, l.qtyMilli, productFallbackCost(db, l.productId));
    states.set(l.productId, r.state);
    return { productId: l.productId, unitCostPaise: r.unitCostPaise, cogsPaise: -r.valueDeltaPaise, provisional: r.provisional, qtyAfterMilli: r.state.qtyMilli };
  });
}

type MovementRow = { id: string; movement_type: MovementType; signed_qty_milli: number; value_paise: number; unit_cost_paise: number };
const kindOf = (r: MovementRow): StockMovementRecord['kind'] =>
  r.movement_type === 'cost_correction' ? 'correction' : r.signed_qty_milli > 0 ? 'receipt' : 'issue';

function movementRecords(db: Db, businessId: string, warehouseId: string, productId: string): MovementRow[] {
  return stmt(db, `SELECT id, movement_type, signed_qty_milli, value_paise, unit_cost_paise FROM stock_movement
    WHERE business_id = ? AND warehouse_id = ? AND product_id = ? ORDER BY rowid`).all(businessId, warehouseId, productId) as MovementRow[];
}

// levelDrift is healed by rewriting the cache; badMovementIds (e.g. sales costed from a drifted cache) are reported, never rewritten.
export interface StockDrift {
  warehouseId: string; productId: string; cached: StockState; projected: StockState; levelDrift: boolean; badMovementIds: string[];
}
export interface StockKey { warehouseId: string; productId: string }

export function stockKeys(db: Db, businessId: string, productIds?: readonly string[]): StockKey[] {
  const keys = stmt(db, `SELECT warehouse_id AS warehouseId, product_id AS productId FROM stock_movement WHERE business_id = ?
    UNION SELECT warehouse_id, product_id FROM stock_level WHERE business_id = ? ORDER BY 2, 1`).all(businessId, businessId) as StockKey[];
  const wanted = productIds ? new Set(productIds) : null;
  return wanted ? keys.filter((k) => wanted.has(k.productId)) : keys;
}

// replay = projection for the given levels: re-run the engine over each level's movements, in the order written.
export function replayKeys(db: Db, businessId: string, keys: readonly StockKey[]): StockDrift[] {
  const drift: StockDrift[] = [];
  for (const k of keys) {
    const rows = movementRecords(db, businessId, k.warehouseId, k.productId);
    const { state, mismatches } = replayMovements(rows.map((r) => ({ kind: kindOf(r), qtyMilli: r.signed_qty_milli, valuePaise: r.value_paise, unitCostPaise: r.unit_cost_paise })));
    // The cache is the projection of the stored movements, so Σ movement values = Σ levels whatever the costs were.
    const projected: StockState = {
      qtyMilli: rows.reduce((sum, r) => sum + r.signed_qty_milli, 0), valuePaise: rows.reduce((sum, r) => sum + r.value_paise, 0),
      lastUnitCostPaise: state.lastUnitCostPaise,
    };
    const cached = stockState(db, businessId, k.warehouseId, k.productId);
    const levelDrift = cached.qtyMilli !== projected.qtyMilli || cached.valuePaise !== projected.valuePaise || cached.lastUnitCostPaise !== projected.lastUnitCostPaise;
    if (levelDrift || mismatches.length > 0) drift.push({ ...k, cached, projected, levelDrift, badMovementIds: mismatches.map((i) => rows[i]?.id ?? 'end') });
  }
  return drift;
}

export const replayCheck = (db: Db, businessId: string, productIds?: readonly string[]): StockDrift[] => replayKeys(db, businessId, stockKeys(db, businessId, productIds));

// Replays again inside the write transaction, so a sale made since the levels were found drifted is never overwritten.
export function rewriteLevels(db: Db, businessId: string, keys: readonly StockKey[]): number {
  return withTransaction(db, () => {
    const at = nowIso();
    const drift = replayKeys(db, businessId, keys).filter((d) => d.levelDrift);
    for (const d of drift) writeLevel(db, businessId, d.warehouseId, d.productId, d.projected, at);
    return drift.length;
  });
}

export const rebuildStockLevels = (db: Db, businessId: string, productIds?: readonly string[]): number =>
  rewriteLevels(db, businessId, stockKeys(db, businessId, productIds));

export function movementsForRef(db: Db, businessId: string, refType: RefType, refId: string): PostedMovement[] {
  return (stmt(db, `SELECT id, product_id, movement_type, signed_qty_milli, value_paise, unit_cost_paise, cost_provisional, ref_type, ref_id, ref_line_id, reason_code
    FROM stock_movement WHERE business_id = ? AND ref_type = ? AND ref_id = ? ORDER BY rowid`).all(businessId, refType, refId) as {
    id: string; product_id: string; movement_type: MovementType; signed_qty_milli: number; value_paise: number; unit_cost_paise: number;
    cost_provisional: number; ref_type: RefType; ref_id: string; ref_line_id: string | null; reason_code: ReasonCode | null;
  }[]).map((r) => ({
    id: r.id, productId: r.product_id, type: r.movement_type, qtyMilli: r.signed_qty_milli, valuePaise: r.value_paise, unitCostPaise: r.unit_cost_paise,
    provisional: r.cost_provisional === 1, refType: r.ref_type, refId: r.ref_id, refLineId: r.ref_line_id, reasonCode: r.reason_code,
  }));
}

export function insertAdjustmentHeader(
  db: Db, h: { id: string; businessId: string; warehouseId: string; kind: 'opening' | 'adjustment' | 'stock_take'; note: string | null }, actor: Actor,
): void {
  const s = syncColumns(actor);
  stmt(db, `INSERT INTO stock_adjustment (id, business_id, warehouse_id, kind, note, created_at, updated_at, created_by, device_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(h.id, h.businessId, h.warehouseId, h.kind, h.note, s.t, s.t, s.created_by, s.device_id);
}

export function hasMovements(db: Db, businessId: string, warehouseId: string, productId: string): boolean {
  return stmt(db, 'SELECT 1 FROM stock_movement WHERE business_id = ? AND warehouse_id = ? AND product_id = ? LIMIT 1').get(businessId, warehouseId, productId) !== undefined;
}

export function hasOpening(db: Db, businessId: string, warehouseId: string, productId: string): boolean {
  return stmt(db, "SELECT 1 FROM stock_movement WHERE business_id = ? AND warehouse_id = ? AND product_id = ? AND movement_type = 'opening' LIMIT 1")
    .get(businessId, warehouseId, productId) !== undefined;
}
