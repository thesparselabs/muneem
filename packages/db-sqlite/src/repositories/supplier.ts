import { AppError, type Supplier, type SupplierInput } from '@muneem/contracts';
import { newUlid, normalizeName, stateOfGstin } from '@muneem/domain';
import type { Db } from '../open.js';
import { stmt } from '../statements.js';
import { nowIso, withTransaction } from '../uow.js';
import type { Actor } from './business.js';
import { recordChange, syncColumns } from './catalogWrite.js';

type SupplierRow = {
  id: string; business_id: string; name: string; phone: string | null; email: string | null; gstin: string | null; state_code: string;
  tax_scheme: Supplier['taxScheme']; address_line1: string | null; city: string | null; pin_code: string | null; credit_days: number; version: number;
};
const toSupplier = (r: SupplierRow): Supplier => ({
  id: r.id, businessId: r.business_id, name: r.name, stateCode: r.state_code, taxScheme: r.tax_scheme, creditDays: r.credit_days, version: r.version,
  ...(r.phone !== null && { phone: r.phone }),
  ...(r.email !== null && { email: r.email }),
  ...(r.gstin !== null && { gstin: r.gstin }),
  ...(r.address_line1 !== null && { addressLine1: r.address_line1 }),
  ...(r.city !== null && { city: r.city }),
  ...(r.pin_code !== null && { pinCode: r.pin_code }),
});

// A registered supplier has a GSTIN from its own state; an unregistered one has none (the table's CHECKs, said in words).
function columns(input: SupplierInput) {
  const fields: Record<string, string> = {};
  if (input.gstin && stateOfGstin(input.gstin) !== input.stateCode) fields.stateCode = `the GSTIN is from state ${stateOfGstin(input.gstin)}`;
  if (input.taxScheme === 'unregistered' && input.gstin) fields.gstin = 'an unregistered supplier has no GSTIN';
  if (input.taxScheme !== 'unregistered' && !input.gstin) fields.gstin = 'a registered supplier needs a GSTIN';
  if (Object.keys(fields).length > 0) throw new AppError('VALIDATION_FAILED', 'Check the supplier\'s GST details', fields);
  return {
    name: input.name, name_norm: normalizeName(input.name), phone: input.phone ?? null, email: input.email ?? null, gstin: input.gstin ?? null,
    state_code: input.stateCode, tax_scheme: input.taxScheme, address_line1: input.addressLine1 ?? null, city: input.city ?? null,
    pin_code: input.pinCode ?? null, credit_days: input.creditDays,
  };
}

export function getSupplier(db: Db, id: string): Supplier | null {
  const r = stmt(db, 'SELECT * FROM supplier WHERE id = ? AND deleted_at IS NULL').get(id) as SupplierRow | undefined;
  return r ? toSupplier(r) : null;
}

export function searchSuppliers(db: Db, businessId: string, query: string, limit: number): Supplier[] {
  const q = query.trim();
  const norm = normalizeName(q);
  return (stmt(db, `SELECT * FROM supplier WHERE business_id = @businessId AND deleted_at IS NULL
      AND (@q = '' OR (name_norm >= @norm AND name_norm < @normEnd) OR phone LIKE @phone OR gstin = @gstin)
    ORDER BY name_norm, id LIMIT @limit`).all({
    businessId, q, norm, normEnd: norm + '￿', phone: `${q.replace(/[%_]/gu, '')}%`, gstin: q.toUpperCase(), limit,
  }) as SupplierRow[]).map(toSupplier);
}

export function createSupplier(db: Db, businessId: string, input: SupplierInput, actor: Actor): Supplier {
  const c = columns(input);
  return withTransaction(db, () => {
    const id = newUlid();
    stmt(db, `INSERT INTO supplier (id, business_id, name, name_norm, phone, email, gstin, state_code, tax_scheme, address_line1, city, pin_code,
        credit_days, created_at, updated_at, created_by, device_id)
      VALUES (@id, @business_id, @name, @name_norm, @phone, @email, @gstin, @state_code, @tax_scheme, @address_line1, @city, @pin_code,
        @credit_days, @t, @t, @created_by, @device_id)`).run({ id, business_id: businessId, ...c, ...syncColumns(actor) });
    const supplier = getSupplier(db, id)!;
    recordChange(db, businessId, actor, { action: 'supplier.create', entityType: 'supplier', entityId: id, operationType: 'create', after: supplier });
    return supplier;
  });
}

export function updateSupplier(db: Db, id: string, expectedVersion: number, input: SupplierInput, actor: Actor): Supplier {
  const c = columns(input);
  return withTransaction(db, () => {
    const before = getSupplier(db, id);
    if (!before) throw new Error('NOT_FOUND');
    if (before.version !== expectedVersion) throw new Error('VERSION_CONFLICT');
    stmt(db, `UPDATE supplier SET name=@name, name_norm=@name_norm, phone=@phone, email=@email, gstin=@gstin, state_code=@state_code,
        tax_scheme=@tax_scheme, address_line1=@address_line1, city=@city, pin_code=@pin_code, credit_days=@credit_days, updated_at=@t,
        version=version+1, sync_state='pending'
      WHERE id=@id AND version=@v`).run({ id, v: expectedVersion, t: nowIso(), ...c });
    const after = getSupplier(db, id)!;
    recordChange(db, before.businessId, actor, { action: 'supplier.update', entityType: 'supplier', entityId: id, operationType: 'update', before, after });
    return after;
  });
}
