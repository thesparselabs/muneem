import { normalizeName } from '@muneem/domain';
import { hasUnsentEdit, type ApplyContext } from './context.js';
import type { MasterSpec } from './master.js';
import { exists, pick, updateRow } from './rows.js';

const CONTACT = { phone: 'phone', email: 'email', gstin: 'gstin', addressLine1: 'address_line1', city: 'city', pinCode: 'pin_code' } as const;

export const CUSTOMER: MasterSpec = {
  table: 'customer',
  columns: (_ctx, p) => ({
    ...pick(p, { name: 'name', ...CONTACT, stateCode: 'state_code' }, true), name_norm: normalizeName(String(p.name)), credit_days: p.creditDays ?? 0,
    ...('creditLimitPaise' in p && { credit_limit_paise: p.creditLimitPaise ?? null }),
  }),
};

export const SUPPLIER: MasterSpec = {
  table: 'supplier',
  columns: (_ctx, p) => ({
    ...pick(p, { name: 'name', ...CONTACT, stateCode: 'state_code', taxScheme: 'tax_scheme' }, true), name_norm: normalizeName(String(p.name)),
    credit_days: p.creditDays ?? 0,
  }),
};

// ADR-0026: the limit is its own entity on the wire, keyed by the customer.
export function applyCreditLimit(ctx: ApplyContext): void {
  const { db, businessId, change } = ctx;
  if (!exists(db, 'customer', change.entityId) || hasUnsentEdit(db, businessId, 'customer_credit_limit', change.entityId)) return;
  updateRow(db, 'customer', change.entityId, { credit_limit_paise: change.payload.creditLimitPaise ?? null });
}
