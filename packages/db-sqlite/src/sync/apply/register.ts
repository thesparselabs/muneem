import { getTerminal } from '../../repositories/business.js';
import { canonicalJson } from '../../canonical.js';
import type { ApplyContext, Payload } from './context.js';
import { statusIs, type DocumentApplier } from './documents.js';
import { exists, insertRow, updateRow } from './rows.js';

function openSession(ctx: ApplyContext, p: Payload): void {
  const at = String(p.openedAt ?? new Date().toISOString());
  insertRow(ctx.db, 'pos_session', {
    id: ctx.change.entityId, business_id: ctx.businessId, branch_id: getTerminal(ctx.db, String(p.terminalId))!.branchId, terminal_id: p.terminalId,
    session_no: p.sessionNo, opened_by: p.openedBy ?? ctx.actor.userId, opened_at: at, opening_cash_paise: p.openingCashPaise, status: 'open',
    created_at: at, updated_at: at, created_by: ctx.actor.userId, device_id: ctx.actor.deviceId, version: 1, sync_state: 'synced',
  });
}

// The Z report the origin froze at close is the session's record here too.
function closeSession(ctx: ApplyContext, z: Payload): void {
  if (statusIs('pos_session', 'closed')(ctx)) return;
  updateRow(ctx.db, 'pos_session', ctx.change.entityId, {
    status: 'closed', closed_by: ctx.actor.userId, closed_at: z.closedAt, expected_cash_paise: z.expectedCashPaise, counted_cash_paise: z.countedCashPaise,
    variance_paise: z.variancePaise, z_report_json: canonicalJson(z), updated_at: z.closedAt, version: ctx.change.version, sync_state: 'synced',
  });
}

export const POS_SESSION: DocumentApplier = { table: 'pos_session', create: openSession, update: closeSession };

export function applyCashMovement(ctx: ApplyContext): void {
  const p = ctx.change.payload;
  if (exists(ctx.db, 'cash_movement', ctx.change.entityId)) return;
  const at = new Date().toISOString();
  insertRow(ctx.db, 'cash_movement', {
    id: ctx.change.entityId, business_id: ctx.businessId, session_id: p.sessionId, kind: p.kind, amount_paise: p.amountPaise, reason: p.reason,
    created_at: at, updated_at: at, created_by: ctx.actor.userId, device_id: ctx.actor.deviceId, sync_state: 'synced',
  });
}
