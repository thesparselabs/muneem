import { describe, expect, it } from 'vitest';
import { AppError, CustomerInput } from '@muneem/contracts';
import {
  addCashMovement, closeSession, createBranch, createBusiness, createCustomer, createTerminal, getOpenSession, openSession,
  searchCustomers, sessionReport, updateCustomer, verifyAuditChain, zReport, type Db,
} from '../src/index.js';
import { ACTOR, ORG, freshDb } from './helpers.js';

async function till(): Promise<{ db: Db; businessId: string; branchId: string; terminalId: string }> {
  const db = await freshDb();
  const b = createBusiness(db, { organizationId: ORG, name: 'Shop', businessType: 'retail', stateCode: '07', taxScheme: 'regular', fyStartMonth: 4 }, ACTOR);
  const br = createBranch(db, b.id, { code: 'DEL1', name: 'Delhi', stateCode: '07', isDefault: true }, ACTOR);
  const t = createTerminal(db, b.id, { branchId: br.id, code: 'T01', name: 'Till 1' }, ACTOR);
  return { db, businessId: b.id, branchId: br.id, terminalId: t.id };
}

describe('customers', () => {
  it('derives the state from the GSTIN and refuses a contradicting state', async () => {
    const { db, businessId } = await till();
    const c = createCustomer(db, businessId, CustomerInput.parse({ name: 'Gupta Traders', gstin: '27AAAAA0000A1Z5', phone: '9876543210' }), ACTOR);
    expect(c).toMatchObject({ stateCode: '27', version: 1 });
    expect(() => createCustomer(db, businessId, CustomerInput.parse({ name: 'X', gstin: '27AAAAA0000A1Z6', stateCode: '07' }), ACTOR)).toThrow(AppError);
    const u = updateCustomer(db, c.id, 1, CustomerInput.parse({ name: 'Gupta Traders Pvt Ltd', gstin: '27AAAAA0000A1Z5' }), ACTOR);
    expect(u.version).toBe(2);
  });

  it('finds customers by name prefix, phone prefix or exact GSTIN', async () => {
    const { db, businessId } = await till();
    createCustomer(db, businessId, CustomerInput.parse({ name: 'Ramesh Kumar', phone: '9876543210' }), ACTOR);
    createCustomer(db, businessId, CustomerInput.parse({ name: 'Gupta Traders', gstin: '27AAAAA0000A1Z5' }), ACTOR);
    expect(searchCustomers(db, businessId, 'ram', 10).map((c) => c.name)).toEqual(['Ramesh Kumar']);
    expect(searchCustomers(db, businessId, '98765', 10).map((c) => c.name)).toEqual(['Ramesh Kumar']);
    expect(searchCustomers(db, businessId, '27aaaaa0000a1z5', 10).map((c) => c.name)).toEqual(['Gupta Traders']);
  });
});

describe('register sessions', () => {
  it('numbers sessions per terminal and allows one open at a time', async () => {
    const t = await till();
    const s1 = openSession(t.db, t, 50_000, ACTOR);
    expect(s1).toMatchObject({ sessionNo: 1, status: 'open' });
    expect(() => openSession(t.db, t, 0, ACTOR)).toThrow(/already open/);
    closeSession(t.db, s1.id, { countedCashPaise: 50_000, approvedBy: null, varianceLimitPaise: 10_000 }, ACTOR);
    expect(openSession(t.db, t, 0, ACTOR).sessionNo).toBe(2);
  });

  it('computes expected cash from the float and cash movements, and freezes the Z report', async () => {
    const t = await till();
    const s = openSession(t.db, t, 50_000, ACTOR);
    addCashMovement(t.db, s.id, { kind: 'cash_in', amountPaise: 10_000, reason: 'change float top-up' }, ACTOR);
    addCashMovement(t.db, s.id, { kind: 'cash_out', amountPaise: 2000, reason: 'tea' }, ACTOR);
    addCashMovement(t.db, s.id, { kind: 'safe_drop', amountPaise: 30_000, reason: 'safe' }, ACTOR);
    expect(sessionReport(t.db, s.id)).toMatchObject({ expectedCashPaise: 28_000, final: false });
    const z = closeSession(t.db, s.id, { countedCashPaise: 27_950, approvedBy: null, varianceLimitPaise: 10_000 }, ACTOR);
    expect(z).toMatchObject({ final: true, expectedCashPaise: 28_000, countedCashPaise: 27_950, variancePaise: -50 });
    expect(zReport(t.db, s.id)).toEqual(z);
    expect(getOpenSession(t.db, t.businessId, t.terminalId)).toBeNull();
    expect(() => addCashMovement(t.db, s.id, { kind: 'cash_in', amountPaise: 1, reason: 'late' }, ACTOR)).toThrow(/Open the register/);
    expect(verifyAuditChain(t.db, t.businessId, ACTOR.deviceId).ok).toBe(true);
  });

  it('needs a manager when the variance is above the limit, and refuses to close with held bills', async () => {
    const t = await till();
    const s = openSession(t.db, t, 50_000, ACTOR);
    expect(() => closeSession(t.db, s.id, { countedCashPaise: 30_000, approvedBy: null, varianceLimitPaise: 10_000 }, ACTOR)).toThrow(/manager/);
    t.db.prepare("INSERT INTO held_bill (id, business_id, terminal_id, session_id, cart_json, held_by, held_at) VALUES ('h', ?, ?, ?, '{}', 'u', 'now')")
      .run(t.businessId, t.terminalId, s.id);
    expect(() => closeSession(t.db, s.id, { countedCashPaise: 50_000, approvedBy: null, varianceLimitPaise: 10_000 }, ACTOR)).toThrow(/held bills/);
    t.db.prepare("DELETE FROM held_bill WHERE id = 'h'").run();
    expect(closeSession(t.db, s.id, { countedCashPaise: 30_000, approvedBy: 'manager-1', varianceLimitPaise: 10_000 }, ACTOR).variancePaise).toBe(-20_000);
    expect(t.db.prepare('SELECT variance_approved_by FROM pos_session WHERE id = ?').pluck().get(s.id)).toBe('manager-1');
  });
});
