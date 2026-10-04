import { AppError, type Customer, type SetConsentInput } from '@muneem/contracts';
import { newUlid, normalizeName } from '@muneem/domain';
import type { Db } from '../open.js';
import { stmt } from '../statements.js';
import { nowIso, withTransaction } from '../uow.js';
import type { Actor } from './business.js';
import { recordChange } from './catalogWrite.js';
import { getCustomer, refuseErased } from './customer.js';
import { partyBalance } from './partyQuery.js';

export interface CustomerDocument { type: string; id: string; docNumber: string | null; docDate: string; amountPaise: number; status: string }

// Every document made out to the customer, cash sales included, for a data-access request (FR-104).
export function customerDocuments(db: Db, businessId: string, customerId: string): CustomerDocument[] {
  return (stmt(db, `SELECT 'sale' AS type, id, doc_number, doc_date, total_paise AS amount, status FROM sale WHERE business_id = @b AND customer_id = @c
    UNION ALL SELECT 'credit_note', id, doc_number, doc_date, total_paise, status FROM credit_note WHERE business_id = @b AND customer_id = @c
    UNION ALL SELECT 'payment', id, doc_number, payment_date, amount_paise, status FROM payment WHERE business_id = @b AND party_type = 'customer' AND party_id = @c
    UNION ALL SELECT 'write_off', id, NULL, doc_date, amount_paise, status FROM write_off WHERE business_id = @b AND customer_id = @c
    UNION ALL SELECT 'opening', id, NULL, as_of_date, amount_paise, status FROM party_opening WHERE business_id = @b AND party_type = 'customer' AND party_id = @c
    ORDER BY 4, 1, 2`).all({ b: businessId, c: customerId }) as { type: string; id: string; doc_number: string | null; doc_date: string; amount: number; status: string }[])
    .map((r) => ({ type: r.type, id: r.id, docNumber: r.doc_number, docDate: r.doc_date, amountPaise: r.amount, status: r.status }));
}

function liveCustomer(db: Db, id: string): Customer {
  const c = getCustomer(db, id);
  if (!c) throw new Error('NOT_FOUND');
  refuseErased(c);
  return c;
}

// A consent change is a customer change: the version moves and the whole customer, consents included, goes to the cloud.
function bumpCustomer(db: Db, before: Customer, actor: Actor, action: string, detail: unknown, at: string, wire: Record<string, null> = {}): Customer {
  stmt(db, "UPDATE customer SET updated_at = ?, version = version + 1, sync_state = 'pending' WHERE id = ?").run(at, before.id);
  const after = getCustomer(db, before.id)!;
  recordChange(db, before.businessId, actor, { action, entityType: 'customer', entityId: before.id, operationType: 'update', before: detail, after: { ...wire, ...after } });
  return after;
}

export function giveConsent(db: Db, input: SetConsentInput, actor: Actor): Customer {
  return withTransaction(db, () => {
    const before = liveCustomer(db, input.customerId);
    if (!before.phone) throw new AppError('VALIDATION_FAILED', 'Add a phone number before recording consent to message it', { phone: 'required for SMS or WhatsApp' });
    const active = before.consents?.find((c) => c.purpose === input.purpose && c.channel === input.channel && c.withdrawnAt === null);
    if (active) return before;
    const at = nowIso();
    stmt(db, `INSERT INTO customer_consent (id, business_id, customer_id, purpose, channel, method, given_at, captured_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(newUlid(), before.businessId, before.id, input.purpose, input.channel, input.method, at, actor.userId, at, at);
    return bumpCustomer(db, before, actor, 'customer.consent_given', { purpose: input.purpose, channel: input.channel, method: input.method }, at);
  });
}

export function withdrawConsent(db: Db, customerId: string, consentId: string, actor: Actor): Customer {
  return withTransaction(db, () => {
    const before = liveCustomer(db, customerId);
    const at = nowIso();
    const changed = stmt(db, 'UPDATE customer_consent SET withdrawn_at = ?, updated_at = ? WHERE id = ? AND customer_id = ? AND withdrawn_at IS NULL')
      .run(at, at, consentId, customerId).changes;
    if (changed === 0) {
      if (!before.consents?.some((c) => c.id === consentId)) throw new Error('NOT_FOUND');
      return before;
    }
    return bumpCustomer(db, before, actor, 'customer.consent_withdrawn', { consentId }, at);
  });
}

// Sent as explicit nulls so no copy of the profile, merged or stored, keeps an old value by omission.
const ERASED_FIELDS = { phone: null, email: null, gstin: null, addressLine1: null, city: null, pinCode: null } as const;

// FR-104: the profile is blanked and every consent withdrawn; sales, receipts and their customer snapshots stay as the law requires.
export function eraseCustomer(db: Db, customerId: string, expectedVersion: number, reason: string, actor: Actor): Customer {
  return withTransaction(db, () => {
    const before = liveCustomer(db, customerId);
    if (before.version !== expectedVersion) throw new Error('VERSION_CONFLICT');
    if (partyBalance(db, { businessId: before.businessId, partyType: 'customer', partyId: customerId }) !== 0) {
      throw new AppError('INVALID_STATE', 'Settle this customer\'s balance before erasing the profile');
    }
    const at = nowIso();
    const name = `Erased customer ${customerId.slice(-6)}`;
    stmt(db, `UPDATE customer SET name = @name, name_norm = @norm, phone = NULL, email = NULL, gstin = NULL, address_line1 = NULL, city = NULL, pin_code = NULL,
        credit_limit_paise = NULL, erased_at = @at WHERE id = @id`).run({ id: customerId, name, norm: normalizeName(name), at });
    stmt(db, 'UPDATE customer_consent SET withdrawn_at = ?, updated_at = ? WHERE customer_id = ? AND withdrawn_at IS NULL').run(at, at, customerId);
    return bumpCustomer(db, before, actor, 'customer.erase', { reason }, at, ERASED_FIELDS);
  });
}
