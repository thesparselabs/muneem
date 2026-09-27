import type { Branch, Business, Terminal } from '@muneem/contracts';
import { newUlid } from '@muneem/domain';
import { appendAudit } from '../audit.js';
import type { Db } from '../open.js';
import { appendOutbox } from '../outbox.js';
import { nextLocalSeq } from '../sequence.js';
import { nowIso, withTransaction } from '../uow.js';

export interface Actor { userId: string; deviceId: string; terminalId?: string | null }

type BusinessRow = {
  id: string; organization_id: string; name: string; legal_name: string | null; business_type: Business['businessType'];
  address_line1: string | null; address_line2: string | null; city: string | null; state_code: string; pin_code: string | null;
  phone: string | null; email: string | null; gstin: string | null; pan: string | null; tax_scheme: Business['taxScheme'];
  fy_start_month: number; created_at: string; updated_at: string; version: number;
};
const toBusiness = (r: BusinessRow): Business => ({
  id: r.id, organizationId: r.organization_id, name: r.name, businessType: r.business_type, stateCode: r.state_code,
  taxScheme: r.tax_scheme, fyStartMonth: 4, createdAt: r.created_at, updatedAt: r.updated_at, version: r.version,
  ...(r.legal_name !== null && { legalName: r.legal_name }),
  ...(r.address_line1 !== null && { addressLine1: r.address_line1 }),
  ...(r.address_line2 !== null && { addressLine2: r.address_line2 }),
  ...(r.city !== null && { city: r.city }),
  ...(r.pin_code !== null && { pinCode: r.pin_code }),
  ...(r.phone !== null && { phone: r.phone }),
  ...(r.email !== null && { email: r.email }),
  ...(r.gstin !== null && { gstin: r.gstin }),
  ...(r.pan !== null && { pan: r.pan }),
});

export function ensureOrganization(db: Db, id: string, name: string): void {
  const t = nowIso();
  db.prepare('INSERT OR IGNORE INTO organization (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)').run(id, name, t, t);
}

export function getBusiness(db: Db, id: string): Business | null {
  const r = db.prepare('SELECT * FROM business WHERE id = ? AND deleted_at IS NULL').get(id) as BusinessRow | undefined;
  return r ? toBusiness(r) : null;
}
export function listBusinesses(db: Db): Business[] {
  return (db.prepare('SELECT * FROM business WHERE deleted_at IS NULL ORDER BY created_at').all() as BusinessRow[]).map(toBusiness);
}

export type BusinessCreate = Omit<Business, 'id' | 'createdAt' | 'updatedAt' | 'version'> & { id?: string };

/** One transaction: row + local_seq + audit (hash-chained) + outbox. Constraint 8 from day one. */
export function createBusiness(db: Db, input: BusinessCreate, actor: Actor): Business {
  return withTransaction(db, () => {
    const id = input.id ?? newUlid();
    const t = nowIso();
    ensureOrganization(db, input.organizationId, input.name);
    db.prepare(`INSERT INTO business (id, organization_id, name, legal_name, business_type, address_line1, address_line2, city, state_code,
        pin_code, phone, email, gstin, pan, tax_scheme, fy_start_month, created_at, updated_at, created_by, device_id)
      VALUES (@id, @organization_id, @name, @legal_name, @business_type, @address_line1, @address_line2, @city, @state_code,
        @pin_code, @phone, @email, @gstin, @pan, @tax_scheme, 4, @t, @t, @created_by, @device_id)`).run({
      id, organization_id: input.organizationId, name: input.name, legal_name: input.legalName ?? null, business_type: input.businessType,
      address_line1: input.addressLine1 ?? null, address_line2: input.addressLine2 ?? null, city: input.city ?? null, state_code: input.stateCode,
      pin_code: input.pinCode ?? null, phone: input.phone ?? null, email: input.email ?? null, gstin: input.gstin ?? null, pan: input.pan ?? null,
      tax_scheme: input.taxScheme, t, created_by: actor.userId, device_id: actor.deviceId,
    });
    const business = getBusiness(db, id)!;
    nextLocalSeq(db);
    appendAudit(db, { businessId: id, deviceId: actor.deviceId, userId: actor.userId, terminalId: actor.terminalId, action: 'business.create', entityType: 'business', entityId: id, after: business });
    appendOutbox(db, { businessId: id, deviceId: actor.deviceId, entityType: 'business', entityId: id, operationType: 'create', payload: business });
    return business;
  });
}

export function updateBusiness(db: Db, id: string, expectedVersion: number, patch: Partial<BusinessCreate>, actor: Actor): Business {
  return withTransaction(db, () => {
    const before = getBusiness(db, id);
    if (!before) throw new Error('NOT_FOUND');
    if (before.version !== expectedVersion) throw new Error('VERSION_CONFLICT');
    const merged = { ...before, ...patch };
    db.prepare(`UPDATE business SET name=@name, legal_name=@legal_name, business_type=@business_type, address_line1=@address_line1,
        address_line2=@address_line2, city=@city, state_code=@state_code, pin_code=@pin_code, phone=@phone, email=@email, gstin=@gstin,
        pan=@pan, tax_scheme=@tax_scheme, updated_at=@t, version=version+1, sync_state='pending' WHERE id=@id AND version=@v`).run({
      id, v: expectedVersion, name: merged.name, legal_name: merged.legalName ?? null, business_type: merged.businessType,
      address_line1: merged.addressLine1 ?? null, address_line2: merged.addressLine2 ?? null, city: merged.city ?? null, state_code: merged.stateCode,
      pin_code: merged.pinCode ?? null, phone: merged.phone ?? null, email: merged.email ?? null, gstin: merged.gstin ?? null, pan: merged.pan ?? null,
      tax_scheme: merged.taxScheme, t: nowIso(),
    });
    const after = getBusiness(db, id)!;
    nextLocalSeq(db);
    appendAudit(db, { businessId: id, deviceId: actor.deviceId, userId: actor.userId, terminalId: actor.terminalId, action: 'business.update', entityType: 'business', entityId: id, before, after });
    appendOutbox(db, { businessId: id, deviceId: actor.deviceId, entityType: 'business', entityId: id, operationType: 'update', payload: after });
    return after;
  });
}

type BranchRow = { id: string; business_id: string; code: string; name: string; address_line1: string | null; city: string | null; state_code: string; gstin: string | null; is_default: number; created_at: string; version: number };
const toBranch = (r: BranchRow): Branch => ({
  id: r.id, businessId: r.business_id, code: r.code, name: r.name, stateCode: r.state_code, isDefault: r.is_default === 1, createdAt: r.created_at, version: r.version,
  ...(r.address_line1 !== null && { addressLine1: r.address_line1 }), ...(r.city !== null && { city: r.city }), ...(r.gstin !== null && { gstin: r.gstin }),
});
export function listBranches(db: Db, businessId: string): Branch[] {
  return (db.prepare('SELECT * FROM branch WHERE business_id = ? AND deleted_at IS NULL ORDER BY is_default DESC, code').all(businessId) as BranchRow[]).map(toBranch);
}
export function getBranch(db: Db, id: string): Branch | null {
  const r = db.prepare('SELECT * FROM branch WHERE id = ? AND deleted_at IS NULL').get(id) as BranchRow | undefined;
  return r ? toBranch(r) : null;
}
export function createBranch(db: Db, businessId: string, input: Omit<Branch, 'id' | 'businessId' | 'createdAt' | 'version'> & { id?: string }, actor: Actor): Branch {
  return withTransaction(db, () => {
    const id = input.id ?? newUlid();
    const t = nowIso();
    const hasDefault = db.prepare('SELECT 1 FROM branch WHERE business_id = ? AND is_default = 1 AND deleted_at IS NULL').get(businessId);
    db.prepare(`INSERT INTO branch (id, business_id, code, name, address_line1, city, state_code, gstin, is_default, created_at, updated_at, created_by, device_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(id, businessId, input.code, input.name, input.addressLine1 ?? null, input.city ?? null,
      input.stateCode, input.gstin ?? null, input.isDefault || !hasDefault ? 1 : 0, t, t, actor.userId, actor.deviceId);
    const branch = getBranch(db, id)!;
    nextLocalSeq(db);
    appendAudit(db, { businessId, deviceId: actor.deviceId, userId: actor.userId, terminalId: actor.terminalId, action: 'branch.create', entityType: 'branch', entityId: id, after: branch });
    appendOutbox(db, { businessId, deviceId: actor.deviceId, entityType: 'branch', entityId: id, operationType: 'create', payload: branch });
    return branch;
  });
}

type TerminalRow = { id: string; business_id: string; branch_id: string; code: string; name: string; device_id_bound: string | null; created_at: string; version: number };
const toTerminal = (r: TerminalRow): Terminal => ({ id: r.id, businessId: r.business_id, branchId: r.branch_id, code: r.code, name: r.name, deviceId: r.device_id_bound, createdAt: r.created_at, version: r.version });
export function listTerminals(db: Db, businessId: string, branchId?: string): Terminal[] {
  const rows = branchId
    ? db.prepare('SELECT * FROM terminal WHERE business_id = ? AND branch_id = ? AND deleted_at IS NULL ORDER BY code').all(businessId, branchId)
    : db.prepare('SELECT * FROM terminal WHERE business_id = ? AND deleted_at IS NULL ORDER BY branch_id, code').all(businessId);
  return (rows as TerminalRow[]).map(toTerminal);
}
export function getTerminal(db: Db, id: string): Terminal | null {
  const r = db.prepare('SELECT * FROM terminal WHERE id = ? AND deleted_at IS NULL').get(id) as TerminalRow | undefined;
  return r ? toTerminal(r) : null;
}
export function createTerminal(db: Db, businessId: string, input: { id?: string; branchId: string; code: string; name: string }, actor: Actor): Terminal {
  return withTransaction(db, () => {
    const id = input.id ?? newUlid();
    const t = nowIso();
    db.prepare(`INSERT INTO terminal (id, business_id, branch_id, code, name, created_at, updated_at, created_by, device_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(id, businessId, input.branchId, input.code, input.name, t, t, actor.userId, actor.deviceId);
    const terminal = getTerminal(db, id)!;
    nextLocalSeq(db);
    appendAudit(db, { businessId, deviceId: actor.deviceId, userId: actor.userId, terminalId: actor.terminalId, action: 'terminal.create', entityType: 'terminal', entityId: id, after: terminal });
    appendOutbox(db, { businessId, deviceId: actor.deviceId, entityType: 'terminal', entityId: id, operationType: 'create', payload: terminal });
    return terminal;
  });
}
/** Bind this device to a terminal (one device ↔ one terminal at a time). */
export function bindTerminal(db: Db, terminalId: string, actor: Actor): Terminal {
  return withTransaction(db, () => {
    const before = getTerminal(db, terminalId);
    if (!before) throw new Error('NOT_FOUND');
    db.prepare("UPDATE terminal SET device_id_bound = NULL, updated_at = ?, version = version + 1, sync_state = 'pending' WHERE device_id_bound = ? AND id <> ?").run(nowIso(), actor.deviceId, terminalId);
    db.prepare("UPDATE terminal SET device_id_bound = ?, updated_at = ?, version = version + 1, sync_state = 'pending' WHERE id = ?").run(actor.deviceId, nowIso(), terminalId);
    const after = getTerminal(db, terminalId)!;
    nextLocalSeq(db);
    appendAudit(db, { businessId: after.businessId, deviceId: actor.deviceId, userId: actor.userId, terminalId, action: 'terminal.bind', entityType: 'terminal', entityId: terminalId, before, after });
    appendOutbox(db, { businessId: after.businessId, deviceId: actor.deviceId, entityType: 'terminal', entityId: terminalId, operationType: 'update', payload: after });
    return after;
  });
}
