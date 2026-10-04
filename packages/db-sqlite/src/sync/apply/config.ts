import { normalSide } from '@muneem/domain';
import { ensureOrganization } from '../../repositories/business.js';
import { stmt } from '../../statements.js';
import { resolver } from './aliases.js';
import { hasUnsentEdit, type ApplyContext } from './context.js';
import { bool, type MasterSpec } from './master.js';
import { exists, insertRow, pick, syncedColumns, updateRow, versioned } from './rows.js';
import { freeVariant } from './uniqueClash.js';

const BUSINESS_COLUMNS = {
  name: 'name', legalName: 'legal_name', businessType: 'business_type', addressLine1: 'address_line1', addressLine2: 'address_line2', city: 'city',
  stateCode: 'state_code', pinCode: 'pin_code', phone: 'phone', email: 'email', gstin: 'gstin', pan: 'pan', taxScheme: 'tax_scheme',
} as const;

// The business row has no business_id of its own, so it is upserted here rather than through applyMaster.
export function applyBusiness(ctx: ApplyContext): void {
  const { db, change } = ctx;
  const p = change.payload;
  if (hasUnsentEdit(db, ctx.businessId, 'business', change.entityId)) return;
  const row = pick(p, BUSINESS_COLUMNS, true);
  if (exists(db, 'business', change.entityId)) {
    updateRow(db, 'business', change.entityId, { ...row, ...versioned(ctx), updated_at: syncedColumns(ctx, p).updated_at });
    return;
  }
  ensureOrganization(db, String(p.organizationId), String(p.name));
  insertRow(db, 'business', { id: change.entityId, organization_id: p.organizationId, ...row, fy_start_month: p.fyStartMonth ?? 4, ...syncedColumns(ctx, p), ...versioned(ctx) });
}

export const BRANCH: MasterSpec = {
  table: 'branch',
  columns: (_ctx, p) => ({ ...pick(p, { code: 'code', name: 'name', addressLine1: 'address_line1', city: 'city', stateCode: 'state_code', gstin: 'gstin' }, true) }),
  inserted: (ctx, p) => ({
    is_default: p.isDefault && !stmt(ctx.db, 'SELECT 1 FROM branch WHERE business_id = ? AND is_default = 1 AND deleted_at IS NULL').get(ctx.businessId) ? 1 : 0,
  }),
  unique: [{ column: 'code', replacement: freeVariant(8) }],
};

// The device a terminal is bound to is that device's own business; a pulled binding is kept as sent.
export const TERMINAL: MasterSpec = {
  table: 'terminal',
  columns: (_ctx, p) => ({ ...pick(p, { branchId: 'branch_id', code: 'code', name: 'name', invoicePrefix: 'invoice_prefix', deviceId: 'device_id_bound' }, true) }),
  unique: [{ column: 'code', within: ['branch_id'], replacement: freeVariant(6) }, { column: 'invoice_prefix', replacement: freeVariant(4) }],
};

export const DOC_SERIES: MasterSpec = {
  table: 'doc_series',
  columns: (_ctx, p) => pick(p, { branchId: 'branch_id', terminalId: 'terminal_id', docType: 'doc_type', fy: 'fy', prefix: 'prefix', padWidth: 'pad_width' }, true),
  softDelete: false,
};

export const EXPENSE_CATEGORY: MasterSpec = {
  table: 'expense_category',
  columns: (_ctx, p) => pick(p, { code: 'code', name: 'name', accountCode: 'account_code' }, true),
  inserted: (_ctx, p) => ({ is_system: bool(p.isSystem) ?? 0 }),
  natural: {
    alias: 'expense_category',
    find: (ctx, r) => (stmt(ctx.db, 'SELECT id FROM expense_category WHERE business_id = ? AND code = ?').pluck().get(ctx.businessId, r.code) as string | undefined) ?? null,
  },
};

// Accounts are matched by code; a system account's type and role never change once made (trg_account_system).
export const ACCOUNT: MasterSpec = {
  table: 'account',
  columns: (_ctx, p) => ({ name: p.name }),
  inserted: (ctx, p) => ({
    code: p.code, type: p.type, role: p.role ?? null, parent_id: resolver(ctx.db, ctx.businessId)('account', p.parentId), normal_side: normalSide(p.type as never),
    is_group: bool(p.isGroup) ?? 0, is_system: bool(p.isSystem) ?? 0,
  }),
  natural: {
    alias: 'account',
    find: (ctx) => (stmt(ctx.db, 'SELECT id FROM account WHERE business_id = ? AND code = ? AND deleted_at IS NULL').pluck()
      .get(ctx.businessId, ctx.change.payload.code) as string | undefined) ?? null,
  },
};

export function applySetting(ctx: ApplyContext): void {
  const { db, businessId, change } = ctx;
  if (hasUnsentEdit(db, businessId, 'setting', change.entityId)) return;
  stmt(db, `INSERT INTO setting (business_id, key, value_json, updated_at, updated_by, version) VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT (business_id, key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at, updated_by = excluded.updated_by, version = excluded.version`)
    .run(businessId, change.entityId, JSON.stringify(change.payload.value ?? null), syncedColumns(ctx, change.payload).updated_at, ctx.actor.userId, change.version);
}
