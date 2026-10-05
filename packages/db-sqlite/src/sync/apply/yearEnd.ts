import { AppError } from '@muneem/contracts';
import { dropUnsentFyClose, fyCloseFor, insertFyClose, postClosing, supersedeFyClose, updateFyClose, type Closing, type FyCloseRow } from '../../repositories/yearEnd.js';
import type { ApplyContext } from './context.js';
import { recordLocalReview } from './review.js';

const str = (v: unknown): string | null => (typeof v === 'string' && v.length > 0 ? v : null);

// Another device's close of the same year won at the cloud: this one is dropped, and never posted anything here (ADR-0045).
function supersede(ctx: ApplyContext, local: FyCloseRow): void {
  if (local.status === 'closed' && local.closings.some((c) => c.journal)) {
    throw new AppError('INVALID_STATE', `${local.fy} was already closed here by ${local.id}; the cloud holds ${ctx.change.entityId}`);
  }
  supersedeFyClose(ctx.db, local.id);
  dropUnsentFyClose(ctx.db, ctx.businessId, local.id);
  recordLocalReview(ctx.db, {
    id: `fy-close-superseded:${local.id}`, businessId: ctx.businessId, kind: 'fy_close_superseded', entityType: 'fy_close', entityId: local.id,
    rule: 'one_close_per_year', winner: 'cloud', field: 'fy', cloudValue: ctx.change.entityId, deviceValue: local.id,
  });
}

// An adjustment this device asked for that the cloud did not take (another device adjusted first) is dropped too.
function stalePending(ctx: ApplyContext, local: FyCloseRow, closings: readonly Closing[], version: number): Closing | null {
  const pending = local.pending;
  if (!pending) return null;
  if (closings.some((c) => c.version === pending.version && c.journal?.id === pending.journal?.id)) return null;
  if (pending.version > version) return pending;
  dropUnsentFyClose(ctx.db, ctx.businessId, local.id, 'update');
  recordLocalReview(ctx.db, {
    id: `fy-reclose-superseded:${local.id}:${pending.version}`, businessId: ctx.businessId, kind: 'fy_close_superseded', entityType: 'fy_close', entityId: local.id,
    rule: 'one_adjustment_per_version', winner: 'cloud', field: 'version', cloudValue: version, deviceValue: pending.version,
  });
  return null;
}

// ADR-0045: the cloud's close is the business's close, matched by year. Its journals post here as they did at the origin,
// into the year's March whether or not that month is locked.
export function applyFyClose(ctx: ApplyContext): void {
  const { db, businessId, change } = ctx;
  const p = change.payload;
  const fy = String(p.fy);
  const closings = (Array.isArray(p.closings) ? p.closings : []) as Closing[];
  const version = Number(p.version ?? closings.length);
  let local = fyCloseFor(db, businessId, fy);
  if (local && local.id !== change.entityId) {
    supersede(ctx, local);
    local = null;
  }
  const closed = { status: 'closed' as const, version, closings, closedAt: str(p.closedAt) ?? str(p.createdAt), closedBy: str(p.closedBy) ?? str(p.createdBy) };
  if (local) updateFyClose(db, local.id, { ...closed, pending: stalePending(ctx, local, closings, version) });
  else insertFyClose(db, { id: change.entityId, businessId, fy, pending: null, ...closed }, ctx.actor, str(p.createdAt) ?? undefined);
  for (const c of closings) postClosing(db, businessId, c, ctx.actor);
}
