import { AppError, type Customer, type CustomerConsent, type CustomerInput } from '@muneem/contracts';
import { newUlid, normalizeName, stateOfGstin } from '@muneem/domain';
import type { Db } from '../open.js';
import { stmt } from '../statements.js';
import { nowIso, withTransaction } from '../uow.js';
import type { Actor } from './business.js';
import { recordChange, syncColumns } from './catalogWrite.js';
import { listConsents } from './customerConsent.js';

type CustomerRow = {
  id: string; business_id: string; name: string; phone: string | null; email: string | null; gstin: string | null;
  state_code: string | null; address_line1: string | null; city: string | null; pin_code: string | null; version: number;
  credit_days: number; credit_limit_paise: number | null; erased_at: string | null;
};
const toCustomer = (r: CustomerRow, consents: CustomerConsent[] = []): Customer => ({
  id: r.id, businessId: r.business_id, name: r.name, version: r.version, creditDays: r.credit_days, creditLimitPaise: r.credit_limit_paise,
  ...(r.phone !== null && { phone: r.phone }),
  ...(r.email !== null && { email: r.email }),
  ...(r.gstin !== null && { gstin: r.gstin }),
  ...(r.state_code !== null && { stateCode: r.state_code }),
  ...(r.address_line1 !== null && { addressLine1: r.address_line1 }),
  ...(r.city !== null && { city: r.city }),
  ...(r.pin_code !== null && { pinCode: r.pin_code }),
  ...(consents.length > 0 && { consents }),
  ...(r.erased_at !== null && { erasedAt: r.erased_at }),
});

// A GSTIN fixes the customer's state; a different state alongside it is a typo, not a choice.
function columns(input: CustomerInput) {
  const fromGstin = input.gstin ? stateOfGstin(input.gstin) : undefined;
  if (fromGstin && input.stateCode && input.stateCode !== fromGstin) {
    throw new AppError('VALIDATION_FAILED', 'State does not match the GSTIN', { stateCode: `the GSTIN is from state ${fromGstin}` });
  }
  return {
    name: input.name, name_norm: normalizeName(input.name), phone: input.phone ?? null, email: input.email ?? null,
    gstin: input.gstin ?? null, state_code: fromGstin ?? input.stateCode ?? null, address_line1: input.addressLine1 ?? null,
    city: input.city ?? null, pin_code: input.pinCode ?? null, credit_days: input.creditDays ?? null,
  };
}

// ADR-0050: an erased profile stays blank; its invoices keep the snapshot they were made with.
export function refuseErased(c: Customer): void {
  if (c.erasedAt) throw new AppError('INVALID_STATE', 'This customer\'s profile was erased');
}

export function getCustomer(db: Db, id: string): Customer | null {
  const r = stmt(db, 'SELECT * FROM customer WHERE id = ? AND deleted_at IS NULL').get(id) as CustomerRow | undefined;
  return r ? toCustomer(r, listConsents(db, r.id)) : null;
}

export function searchCustomers(db: Db, businessId: string, query: string, limit: number): Customer[] {
  const q = query.trim();
  const norm = normalizeName(q);
  return (stmt(db, `SELECT * FROM customer WHERE business_id = @businessId AND deleted_at IS NULL AND erased_at IS NULL
      AND (@q = '' OR (name_norm >= @norm AND name_norm < @normEnd) OR phone LIKE @phone OR gstin = @gstin)
    ORDER BY name_norm, id LIMIT @limit`).all({
    businessId, q, norm, normEnd: norm + '\uffff', phone: `${q.replace(/[%_]/gu, '')}%`, gstin: q.toUpperCase(), limit,
  }) as CustomerRow[]).map((r) => toCustomer(r));
}

export function createCustomer(db: Db, businessId: string, input: CustomerInput, actor: Actor): Customer {
  const c = columns(input);
  return withTransaction(db, () => {
    const id = newUlid();
    const s = syncColumns(actor);
    stmt(db, `INSERT INTO customer (id, business_id, name, name_norm, phone, email, gstin, state_code, address_line1, city, pin_code,
        credit_days, created_at, updated_at, created_by, device_id)
      VALUES (@id, @business_id, @name, @name_norm, @phone, @email, @gstin, @state_code, @address_line1, @city, @pin_code,
        COALESCE(@credit_days, 0), @t, @t, @created_by, @device_id)`).run({ id, business_id: businessId, ...c, ...s });
    const customer = getCustomer(db, id)!;
    recordChange(db, businessId, actor, { action: 'customer.create', entityType: 'customer', entityId: id, operationType: 'create', after: customer });
    return customer;
  });
}

export function updateCustomer(db: Db, id: string, expectedVersion: number, input: CustomerInput, actor: Actor): Customer {
  const c = columns(input);
  return withTransaction(db, () => {
    const before = getCustomer(db, id);
    if (!before) throw new Error('NOT_FOUND');
    if (before.version !== expectedVersion) throw new Error('VERSION_CONFLICT');
    refuseErased(before);
    stmt(db, `UPDATE customer SET name=@name, name_norm=@name_norm, phone=@phone, email=@email, gstin=@gstin, state_code=@state_code,
        address_line1=@address_line1, city=@city, pin_code=@pin_code, credit_days=COALESCE(@credit_days, credit_days), updated_at=@t, version=version+1, sync_state='pending'
      WHERE id=@id AND version=@v`).run({ id, v: expectedVersion, t: nowIso(), ...c });
    const after = getCustomer(db, id)!;
    recordChange(db, before.businessId, actor, { action: 'customer.update', entityType: 'customer', entityId: id, operationType: 'update', before, after });
    return after;
  });
}

// ADR-0026: the limit is a control value, changed only through this path and audited on its own.
export function setCustomerCreditLimit(db: Db, id: string, expectedVersion: number, limitPaise: number | null, actor: Actor): Customer {
  return withTransaction(db, () => {
    const before = getCustomer(db, id);
    if (!before) throw new Error('NOT_FOUND');
    if (before.version !== expectedVersion) throw new Error('VERSION_CONFLICT');
    refuseErased(before);
    stmt(db, `UPDATE customer SET credit_limit_paise=@limit, updated_at=@t, version=version+1, sync_state='pending' WHERE id=@id AND version=@v`)
      .run({ id, v: expectedVersion, limit: limitPaise, t: nowIso() });
    const after = getCustomer(db, id)!;
    recordChange(db, before.businessId, actor, {
      action: 'customer.credit_limit', entityType: 'customer_credit_limit', entityId: id, operationType: 'update',
      before: { creditLimitPaise: before.creditLimitPaise }, after: { creditLimitPaise: after.creditLimitPaise, version: after.version },
    });
    return after;
  });
}
