import { describe, expect, it } from 'vitest';
import { CHART_OF_ACCOUNTS } from '@muneem/domain';
import { accountIdsByRoleAndCode, createBusiness, ensureChartOfAccounts, listAccounts, type Db } from '../src/index.js';
import { ACTOR, ORG, freshDb } from './helpers.js';

async function shop(): Promise<{ db: Db; businessId: string }> {
  const db = await freshDb();
  const b = createBusiness(db, { organizationId: ORG, name: 'S', businessType: 'retail', stateCode: '07', taxScheme: 'regular', fyStartMonth: 4 }, ACTOR);
  ensureChartOfAccounts(db, b.id, ACTOR);
  return { db, businessId: b.id };
}

describe('chart of accounts seed (ADR-0031)', () => {
  it('seeds every account once, under its group, audited and queued', async () => {
    const { db, businessId } = await shop();
    ensureChartOfAccounts(db, businessId, ACTOR);
    const accounts = listAccounts(db, businessId);
    expect(accounts).toHaveLength(CHART_OF_ACCOUNTS.length);
    const byCode = new Map(accounts.map((a) => [a.code, a]));
    expect(byCode.get('1300')).toMatchObject({ role: 'ar', type: 'asset', normalSide: 'debit', isSystem: true, parentId: byCode.get('1000')!.id });
    expect(byCode.get('2100')).toMatchObject({ role: 'ap', normalSide: 'credit' });
    expect(byCode.get('5000')).toMatchObject({ isGroup: true, parentId: null });
    expect(accountIdsByRoleAndCode(db, businessId).byRole.get('inventory')).toBe(byCode.get('1400')!.id);
    expect(db.prepare("SELECT COUNT(*) FROM sync_outbox WHERE entity_type = 'account'").pluck().get()).toBe(CHART_OF_ACCOUNTS.length);
  });

  it('never lets a system account be retyped or deleted', async () => {
    const { db } = await shop();
    expect(() => db.exec("UPDATE account SET type = 'expense', normal_side = 'debit' WHERE code = '1300'")).toThrow(/retyped/);
    expect(() => db.exec("UPDATE account SET deleted_at = 'now' WHERE code = '1300'")).toThrow(/cannot be deleted/);
    expect(() => db.exec("DELETE FROM account WHERE code = '1300'")).toThrow(/never deleted/);
    expect(db.prepare("UPDATE account SET name = 'Debtors' WHERE code = '1300'").run().changes).toBe(1);
  });
});

describe('0012_accounting', () => {
  async function ledger() {
    const { db, businessId } = await shop();
    const ids = accountIdsByRoleAndCode(db, businessId);
    db.prepare(`INSERT INTO accounting_period (id, business_id, fy, period_start, period_end, created_at, updated_at, created_by, device_id)
      VALUES ('P1', ?, '2026-27', '2026-10-01', '2026-10-31', 'a', 'a', 'u', 'd')`).run(businessId);
    const entry = (id: string, over: Partial<Record<string, string | number | null>> = {}) => db.prepare(`INSERT INTO journal_entry (id, business_id, entry_no,
        entry_date, doc_date, fy, period_id, source, ref_type, ref_id, debit_total_paise, credit_total_paise, is_reversal_of, late_posting,
        created_at, updated_at, created_by, device_id)
      VALUES (@id, @b, 'N1', @entryDate, @docDate, '2026-27', 'P1', @source, 'sale', @refId, @dr, @cr, @rev, @late, 'a', 'a', 'u', 'd')`).run({
      id, b: businessId, entryDate: '2026-10-04', docDate: '2026-10-04', source: 'sale', refId: 'S1', dr: 1000, cr: 1000, rev: null, late: 0, ...over,
    });
    const line = (id: string, entryId: string, accountId: string, dr: number, cr: number, lineNo = 1) => () => db.prepare(`INSERT INTO journal_line (id, entry_id,
        business_id, line_no, account_id, debit_paise, credit_paise) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(id, entryId, businessId, lineNo, accountId, dr, cr);
    return { db, ids, entry, line };
  }

  it('refuses an unbalanced or empty journal, and a late posting dated before its document', async () => {
    const { entry } = await ledger();
    expect(() => entry('J1', { dr: 1000, cr: 999 })).toThrow(/CHECK/);
    expect(() => entry('J1', { dr: 0, cr: 0 })).toThrow(/CHECK/);
    expect(() => entry('J1', { late: 1 })).toThrow(/CHECK/);
    expect(() => entry('J1', { late: 1, docDate: '2026-09-28' })).not.toThrow();
  });

  it('refuses a two-sided, negative or group-account line', async () => {
    const { ids, entry, line } = await ledger();
    entry('J1');
    const cash = ids.byRole.get('cash')!;
    expect(line('L1', 'J1', cash, 1000, 1000)).toThrow(/CHECK/);
    expect(line('L1', 'J1', cash, -5, 0)).toThrow(/CHECK/);
    expect(line('L1', 'J1', ids.byCode.get('1000')!, 1000, 0)).toThrow(/group account/);
    expect(line('L1', 'J1', cash, 1000, 0)).not.toThrow();
  });

  it('allows one journal per document and one reversal of it, and never changes either', async () => {
    const { db, entry } = await ledger();
    entry('J1');
    expect(() => entry('J2')).toThrow(/UNIQUE/);
    entry('J3', { rev: 'J1' });
    expect(() => entry('J4', { rev: 'J1' })).toThrow(/UNIQUE/);
    expect(() => db.exec("UPDATE journal_entry SET debit_total_paise = 5, credit_total_paise = 5 WHERE id = 'J1'")).toThrow(/append-only/);
    expect(() => db.exec("DELETE FROM journal_entry WHERE id = 'J1'")).toThrow(/append-only/);
    expect(db.prepare("UPDATE journal_entry SET sync_state = 'synced' WHERE id = 'J1'").run().changes).toBe(1);
  });

  it("keeps an account's normal side tied to its type", async () => {
    const { db } = await shop();
    const b = db.prepare('SELECT id FROM business').pluck().get() as string;
    expect(() => db.prepare(`INSERT INTO account (id, business_id, code, name, type, normal_side, created_at, updated_at, created_by, device_id)
      VALUES ('X', ?, '1210', 'HDFC', 'asset', 'credit', 'a', 'a', 'u', 'd')`).run(b)).toThrow(/CHECK/);
  });
});
