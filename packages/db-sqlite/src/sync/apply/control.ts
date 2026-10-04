import { financialYearOf, monthEnd, monthStart } from '@muneem/domain';
import { canonicalJson } from '../../canonical.js';
import { stmt } from '../../statements.js';
import { setSyncDeviceStatus } from '../syncState.js';
import { hasUnsentEdit, type ApplyContext } from './context.js';
import { exists, insertRow, syncedColumns, updateRow, versioned } from './rows.js';

// ADR-0040: periods are cloud-authoritative and matched by month, so a lock taken on one terminal holds on every other.
export function applyPeriod(ctx: ApplyContext): void {
  const { db, businessId, change } = ctx;
  const p = change.payload;
  const start = monthStart(String(p.periodStart));
  const local = (stmt(db, 'SELECT id FROM accounting_period WHERE business_id = ? AND period_start = ?').pluck().get(businessId, start) as string | undefined) ?? null;
  if (hasUnsentEdit(db, businessId, 'accounting_period', local ?? change.entityId)) return;
  const status = { status: p.status === 'locked' ? 'locked' : 'open', locked_at: p.lockedAt ?? null, locked_by: p.lockedBy ?? null, unlock_reason: p.unlockReason ?? null };
  if (local) {
    updateRow(db, 'accounting_period', local, { ...status, ...versioned(ctx) });
    return;
  }
  insertRow(db, 'accounting_period', {
    id: change.entityId, business_id: businessId, fy: p.fy ?? financialYearOf(start), period_start: start, period_end: p.periodEnd ?? monthEnd(start), ...status,
    ...syncedColumns(ctx, p), ...versioned(ctx),
  });
}

// Review items (ADR-0041) are kept as the cloud wrote them; 7g lists them under Settings → Review.
export function applyConflictLog(ctx: ApplyContext): void {
  const { db, businessId, change } = ctx;
  if (exists(db, 'conflict_log', change.entityId)) return;
  const p = change.payload;
  const json = (v: unknown) => (v === undefined ? null : canonicalJson(v));
  insertRow(db, 'conflict_log', {
    id: change.entityId, business_id: businessId, kind: p.kind ?? 'conflict', entity_type: p.entityType ?? '', entity_id: p.entityId ?? '', device_id: p.deviceId ?? null,
    rule: p.rule ?? '', winner: p.winner ?? 'cloud', field: p.field ?? null, cloud_value_json: json(p.cloudValue), device_value_json: json(p.deviceValue),
    occurred_at: p.at ?? new Date().toISOString(), received_at: new Date().toISOString(),
  });
}

// The Go cloud's review item: its kind names the rule and its detail holds both sides.
export function applyReviewItem(ctx: ApplyContext): void {
  const p = ctx.change.payload;
  const detail = (p.detail ?? {}) as Record<string, unknown>;
  applyConflictLog({
    ...ctx,
    change: {
      ...ctx.change,
      payload: {
        kind: p.kind, entityType: p.entityType, entityId: p.entityId, deviceId: p.deviceId, rule: detail.rule ?? p.kind, winner: p.kind === 'late_arrival' ? 'device' : 'cloud',
        cloudValue: detail.stored ?? detail, deviceValue: detail.sent, at: p.at,
      },
    },
  });
}

// 7c: a revocation names the device; this one stops syncing and says so.
export function applyDeviceMessage(ctx: ApplyContext): void {
  const p = ctx.change.payload;
  if (p.deviceId === ctx.cloudDeviceId && p.status === 'revoked') setSyncDeviceStatus(ctx.db, 'revoked', 'This device was removed from the business');
}
