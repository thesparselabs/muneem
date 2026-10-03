import { describe, expect, it } from 'vitest';
import { CustomerInput, SupplierInput } from '@muneem/contracts';
import {
  createBusiness, createCustomer, createSupplier, getCustomer, liveOpening, openItems, partyOutstanding, partyStatement, postPartyEntry,
  reconcilePartiesDb, searchSuppliers, setCustomerCreditLimit, setPartyOpening, updateCustomer, updateSupplier, withTransaction, type Db,
} from '../src/index.js';
import { ACTOR, ORG, freshDb } from './helpers.js';

async function shop(): Promise<{ db: Db; businessId: string }> {
  const db = await freshDb();
  const b = createBusiness(db, { organizationId: ORG, name: 'S', businessType: 'retail', stateCode: '07', taxScheme: 'regular', fyStartMonth: 4 }, ACTOR);
  return { db, businessId: b.id };
}
const supplierInput = (over: Partial<SupplierInput> = {}) => SupplierInput.parse({ name: 'Acme Traders', stateCode: '07', gstin: '07AAAAA0000A1Z5', ...over });
const outbox = (db: Db, entity: string) => db.prepare('SELECT COUNT(*) FROM sync_outbox WHERE entity_type = ?').pluck().get(entity);

describe('suppliers', () => {
  it('creates, searches and updates with optimistic versions, audited and queued', async () => {
    const { db, businessId } = await shop();
    const s = createSupplier(db, businessId, supplierInput({ creditDays: 30 }), ACTOR);
    expect(s).toMatchObject({ name: 'Acme Traders', stateCode: '07', taxScheme: 'regular', creditDays: 30, version: 1 });
    expect(searchSuppliers(db, businessId, 'acm', 10).map((x) => x.id)).toEqual([s.id]);
    expect(searchSuppliers(db, businessId, '', 10)).toHaveLength(1);
    const u = updateSupplier(db, s.id, 1, supplierInput({ name: 'Acme Traders Pvt', creditDays: 45 }), ACTOR);
    expect(u).toMatchObject({ name: 'Acme Traders Pvt', creditDays: 45, version: 2 });
    expect(() => updateSupplier(db, s.id, 1, supplierInput(), ACTOR)).toThrow('VERSION_CONFLICT');
    expect(outbox(db, 'supplier')).toBe(2);
  });

  it('names the field when GST details do not fit together', async () => {
    const { db, businessId } = await shop();
    expect(() => createSupplier(db, businessId, supplierInput({ stateCode: '27' }), ACTOR)).toThrow(expect.objectContaining({ fields: { stateCode: expect.stringContaining('07') } }));
    expect(() => createSupplier(db, businessId, supplierInput({ gstin: undefined }), ACTOR)).toThrow(expect.objectContaining({ fields: { gstin: expect.stringContaining('needs a GSTIN') } }));
    expect(() => createSupplier(db, businessId, supplierInput({ taxScheme: 'unregistered' }), ACTOR)).toThrow(expect.objectContaining({ fields: { gstin: expect.any(String) } }));
    expect(createSupplier(db, businessId, supplierInput({ taxScheme: 'unregistered', gstin: undefined }), ACTOR).taxScheme).toBe('unregistered');
  });
});

describe('customer credit terms', () => {
  it('keeps credit days across an update that leaves them out, and sets the limit only on its own path', async () => {
    const { db, businessId } = await shop();
    const c = createCustomer(db, businessId, CustomerInput.parse({ name: 'Ravi', creditDays: 15 }), ACTOR);
    expect(c).toMatchObject({ creditDays: 15, creditLimitPaise: null });
    const u = updateCustomer(db, c.id, 1, CustomerInput.parse({ name: 'Ravi K' }), ACTOR);
    expect(u).toMatchObject({ creditDays: 15, creditLimitPaise: null });
    const limited = setCustomerCreditLimit(db, c.id, 2, 500_000, ACTOR);
    expect(limited).toMatchObject({ creditLimitPaise: 500_000, version: 3 });
    expect(setCustomerCreditLimit(db, c.id, 3, null, ACTOR).creditLimitPaise).toBeNull();
    expect(() => setCustomerCreditLimit(db, c.id, 3, 1, ACTOR)).toThrow('VERSION_CONFLICT');
    expect(db.prepare("SELECT before_json, after_json FROM audit_log WHERE action = 'customer.credit_limit' ORDER BY seq").all()).toHaveLength(2);
    expect(outbox(db, 'customer_credit_limit')).toBe(2);
    expect(getCustomer(db, c.id)?.creditLimitPaise).toBeNull();
  });
});

describe('opening balances', () => {
  async function parties() {
    const { db, businessId } = await shop();
    const customer = createCustomer(db, businessId, CustomerInput.parse({ name: 'Ravi' }), ACTOR);
    const supplier = createSupplier(db, businessId, supplierInput(), ACTOR);
    return { db, businessId, customer: customer.id, supplier: supplier.id };
  }
  const entry = (db: Db, refId: string) => db.prepare("SELECT entry_kind, amount_paise FROM party_ledger_entry WHERE ref_id = ? ORDER BY rowid").all(refId);

  it('signs the entry by side for all four party/side pairs', async () => {
    const { db, businessId, customer, supplier } = await parties();
    const cases = [
      ['customer', customer, 'receivable', 1000], ['supplier', supplier, 'payable', -2000],
    ] as const;
    for (const [type, id, side, signed] of cases) {
      const o = setPartyOpening(db, businessId, type, id, { side, amountPaise: Math.abs(signed), asOfDate: '2026-04-01' }, ACTOR);
      expect(entry(db, o.id)).toEqual([{ entry_kind: 'post', amount_paise: signed }]);
    }
    const advance = setPartyOpening(db, businessId, 'customer', customer, { side: 'payable', amountPaise: 300, asOfDate: '2026-04-01' }, ACTOR);
    expect(entry(db, advance.id)).toEqual([{ entry_kind: 'post', amount_paise: -300 }]);
    const owedBySupplier = setPartyOpening(db, businessId, 'supplier', supplier, { side: 'receivable', amountPaise: 400, asOfDate: '2026-04-01' }, ACTOR);
    expect(entry(db, owedBySupplier.id)).toEqual([{ entry_kind: 'post', amount_paise: 400 }]);
    expect(reconcilePartiesDb(db, businessId)).toEqual({ mismatches: [], faults: [] });
  });

  it('replaces the live opening in one go, reversing the old entry', async () => {
    const { db, businessId, customer } = await parties();
    const first = setPartyOpening(db, businessId, 'customer', customer, { side: 'receivable', amountPaise: 1000, asOfDate: '2026-04-01' }, ACTOR);
    const second = setPartyOpening(db, businessId, 'customer', customer, { side: 'receivable', amountPaise: 1500, asOfDate: '2026-04-01' }, ACTOR);
    expect(entry(db, first.id)).toEqual([{ entry_kind: 'post', amount_paise: 1000 }, { entry_kind: 'cancel', amount_paise: -1000 }]);
    expect(liveOpening(db, businessId, 'customer', customer)?.id).toBe(second.id);
    expect(db.prepare('SELECT SUM(amount_paise) FROM party_ledger_entry').pluck().get()).toBe(1500);
    expect(outbox(db, 'party_opening')).toBe(3);
    expect(reconcilePartiesDb(db, businessId)).toEqual({ mismatches: [], faults: [] });
  });

  it('refuses to replace an opening that payments are allocated to, leaving it as it was', async () => {
    const { db, businessId, supplier } = await parties();
    const o = setPartyOpening(db, businessId, 'supplier', supplier, { side: 'payable', amountPaise: 1000, asOfDate: '2026-04-01' }, ACTOR);
    const t = "'a', 'a', 'u', 'd'";
    db.exec(`
      INSERT INTO branch (id, business_id, code, name, state_code, created_at, updated_at, created_by, device_id) VALUES ('br', '${businessId}', 'B', 'B', '07', ${t});
      INSERT INTO doc_series (id, business_id, branch_id, doc_type, fy, prefix, created_at, updated_at, created_by, device_id) VALUES ('pay', '${businessId}', 'br', 'payment', '2026-27', 'PY', ${t});
      INSERT INTO payment (id, business_id, branch_id, direction, party_type, party_id, series_id, doc_number, doc_seq, payment_date, fy, method, amount_paise, created_at, updated_at, created_by, device_id)
        VALUES ('p1', '${businessId}', 'br', 'out', 'supplier', '${supplier}', 'pay', 'PY1', 1, '2026-10-03', '2026-27', 'cash', 400, ${t});
      INSERT INTO allocation (id, business_id, party_type, party_id, source_type, source_id, target_type, target_id, amount_paise, allocated_at, created_at, updated_at, created_by, device_id)
        VALUES ('a1', '${businessId}', 'supplier', '${supplier}', 'payment', 'p1', 'opening', '${o.id}', 400, 'a', ${t});
    `);
    withTransaction(db, () => postPartyEntry(db, { businessId, partyType: 'supplier', partyId: supplier, refType: 'payment', refId: 'p1', kind: 'post', amountPaise: 400, docDate: '2026-10-03' }, ACTOR));
    expect(() => setPartyOpening(db, businessId, 'supplier', supplier, { side: 'payable', amountPaise: 2000, asOfDate: '2026-04-01' }, ACTOR)).toThrow(/allocated/);
    expect(liveOpening(db, businessId, 'supplier', supplier)).toMatchObject({ id: o.id, settledPaise: 400 });
    expect(openItems(db, { businessId, partyType: 'supplier', partyId: supplier })).toEqual([
      { role: 'charge', type: 'opening', id: o.id, docNumber: null, docDate: '2026-04-01', dueDate: '2026-04-01', amountPaise: 1000, openPaise: 600 },
    ]);
    expect(reconcilePartiesDb(db, businessId)).toEqual({ mismatches: [], faults: [] });
  });
});

describe('postPartyEntry', () => {
  it('refuses a zero amount and a cancel that does not reverse its post, and is idempotent per document and kind', async () => {
    const { db, businessId } = await shop();
    const e = { businessId, partyType: 'customer' as const, partyId: 'C1', refType: 'sale' as const, refId: 'S1', docDate: '2026-10-03' };
    const post = (kind: 'post' | 'cancel', amountPaise: number) => withTransaction(db, () => postPartyEntry(db, { ...e, kind, amountPaise }, ACTOR));
    expect(() => post('post', 0)).toThrow(/non-zero/);
    expect(() => post('cancel', -100)).toThrow(/reverse/);
    const first = post('post', 100);
    expect(post('post', 100).id).toBe(first.id);
    expect(() => post('post', 101)).toThrow(/different/);
    expect(() => post('cancel', 100)).toThrow(/reverse/);
    expect(post('cancel', -100).kind).toBe('cancel');
  });

  it('lets reconciliation name an entry that does not match its documents', async () => {
    const { db, businessId } = await shop();
    const c = createCustomer(db, businessId, CustomerInput.parse({ name: 'Ravi' }), ACTOR);
    setPartyOpening(db, businessId, 'customer', c.id, { side: 'receivable', amountPaise: 1000, asOfDate: '2026-04-01' }, ACTOR);
    withTransaction(db, () => postPartyEntry(db, { businessId, partyType: 'customer', partyId: c.id, refType: 'sale', refId: 'ghost', kind: 'post', amountPaise: 50, docDate: '2026-10-03' }, ACTOR));
    expect(reconcilePartiesDb(db, businessId).mismatches).toEqual([{ partyType: 'customer', partyId: c.id, ledgerPaise: 1050, openItemsPaise: 1000 }]);
  });
});

describe('party statement and outstanding', () => {
  it('runs the balance in date order, pages, and brackets a date range with opening and closing balances', async () => {
    const { db, businessId } = await shop();
    const p = { businessId, partyType: 'customer' as const, partyId: 'C1' };
    const amounts: [string, number][] = [['2026-10-01', 500], ['2026-10-03', -200], ['2026-10-02', 300], ['2026-10-05', 1000]];
    amounts.forEach(([docDate, amountPaise], i) => withTransaction(db, () => postPartyEntry(db, { ...p, refType: 'sale', refId: `S${i}`, kind: 'post', amountPaise, docDate }, ACTOR)));
    const all = partyStatement(db, p, { limit: 100 });
    expect(all.items.map((l) => [l.docDate, l.amountPaise, l.balancePaise])).toEqual([
      ['2026-10-01', 500, 500], ['2026-10-02', 300, 800], ['2026-10-03', -200, 600], ['2026-10-05', 1000, 1600],
    ]);
    expect(all).toMatchObject({ openingBalancePaise: 0, closingBalancePaise: 1600, nextCursor: null });
    const first = partyStatement(db, p, { limit: 2 });
    const rest = partyStatement(db, p, { limit: 2, cursor: first.nextCursor! });
    expect([...first.items, ...rest.items].map((l) => l.balancePaise)).toEqual([500, 800, 600, 1600]);
    expect(rest.nextCursor).toBeNull();
    expect(partyStatement(db, p, { from: '2026-10-02', to: '2026-10-03', limit: 100 })).toMatchObject({
      openingBalancePaise: 500, closingBalancePaise: 600, items: [{ balancePaise: 800 }, { balancePaise: 600 }],
    });
  });

  it('ages open items into buckets either side of each boundary and shows advances apart', async () => {
    const { db, businessId } = await shop();
    const dues = ['2027-01-01', '2026-12-31', '2026-12-01', '2026-11-30', '2026-11-01', '2026-10-31', '2026-10-02', '2026-10-01'];
    const ids = dues.map((d, i) => {
      const c = createCustomer(db, businessId, CustomerInput.parse({ name: `C${i}` }), ACTOR);
      setPartyOpening(db, businessId, 'customer', c.id, { side: 'receivable', amountPaise: 100 * (i + 1), asOfDate: d }, ACTOR);
      return c.id;
    });
    const adv = createCustomer(db, businessId, CustomerInput.parse({ name: 'Z advance' }), ACTOR);
    setPartyOpening(db, businessId, 'customer', adv.id, { side: 'payable', amountPaise: 50, asOfDate: '2026-04-01' }, ACTOR);
    const o = partyOutstanding(db, businessId, 'customer', '2026-12-31');
    expect(o.totals).toEqual({
      notDuePaise: 0, days0to30Paise: 200 + 300, days31to60Paise: 400 + 500, days61to90Paise: 600 + 700, over90Paise: 800, advancePaise: 50,
      netPaise: 200 + 300 + 400 + 500 + 600 + 700 + 800 - 50,
    });
    expect(o.rows.find((r) => r.partyId === ids[0])).toBeUndefined();
    expect(partyOutstanding(db, businessId, 'customer', '2027-01-01').totals.notDuePaise).toBe(0);
    expect(partyOutstanding(db, businessId, 'customer', '2027-01-01', ids[0]).rows).toEqual([
      expect.objectContaining({ partyId: ids[0], days0to30Paise: 100, netPaise: 100 }),
    ]);
    expect(o.rows.find((r) => r.partyId === adv.id)).toMatchObject({ advancePaise: 50, netPaise: -50 });
  });
});
