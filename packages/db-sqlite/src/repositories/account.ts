import { CHART_OF_ACCOUNTS, newUlid, normalSide, type AccountRole, type AccountType } from '@muneem/domain';
import type { Db } from '../open.js';
import { stmt } from '../statements.js';
import { withTransaction } from '../uow.js';
import type { Actor } from './business.js';
import { recordChange, syncColumns } from './catalogWrite.js';

export interface AccountRow {
  id: string; businessId: string; code: string; name: string; type: AccountType; role: AccountRole | null; parentId: string | null;
  normalSide: 'debit' | 'credit'; isGroup: boolean; isSystem: boolean;
}
type Raw = {
  id: string; business_id: string; code: string; name: string; type: AccountType; role: AccountRole | null; parent_id: string | null;
  normal_side: 'debit' | 'credit'; is_group: number; is_system: number;
};
const toAccount = (r: Raw): AccountRow => ({
  id: r.id, businessId: r.business_id, code: r.code, name: r.name, type: r.type, role: r.role, parentId: r.parent_id,
  normalSide: r.normal_side, isGroup: r.is_group === 1, isSystem: r.is_system === 1,
});

export function listAccounts(db: Db, businessId: string): AccountRow[] {
  return (stmt(db, 'SELECT * FROM account WHERE business_id = ? AND deleted_at IS NULL ORDER BY code').all(businessId) as Raw[]).map(toAccount);
}

// LLD §5.1 + ADR-0031, seeded per business on first use like the catalog defaults; idempotent by code.
export function ensureChartOfAccounts(db: Db, businessId: string, actor: Actor): void {
  withTransaction(db, () => {
    const existing = new Map((stmt(db, 'SELECT code, id FROM account WHERE business_id = ? AND deleted_at IS NULL').all(businessId) as { code: string; id: string }[])
      .map((r) => [r.code, r.id]));
    for (const a of CHART_OF_ACCOUNTS) {
      if (existing.has(a.code)) continue;
      const id = newUlid();
      const s = syncColumns(actor);
      const parentId = a.group ? existing.get(a.group) ?? null : null;
      stmt(db, `INSERT INTO account (id, business_id, code, name, type, role, parent_id, normal_side, is_group, is_system, created_at, updated_at, created_by, device_id)
        VALUES (@id, @businessId, @code, @name, @type, @role, @parentId, @side, @isGroup, 1, @t, @t, @created_by, @device_id)`).run({
        id, businessId, code: a.code, name: a.name, type: a.type, role: a.role ?? null, parentId, side: normalSide(a.type), isGroup: a.isGroup ? 1 : 0, ...s,
      });
      existing.set(a.code, id);
      recordChange(db, businessId, actor, {
        action: 'account.create', entityType: 'account', entityId: id, operationType: 'create',
        after: { id, code: a.code, name: a.name, type: a.type, role: a.role ?? null, parentId, isGroup: !!a.isGroup, isSystem: true },
      });
    }
  });
}

// What the posting service resolves a rule's roles and codes against.
export function accountIdsByRoleAndCode(db: Db, businessId: string): { byRole: Map<AccountRole, string>; byCode: Map<string, string> } {
  const rows = listAccounts(db, businessId);
  return {
    byRole: new Map(rows.flatMap((a) => (a.role ? [[a.role, a.id] as const] : []))),
    byCode: new Map(rows.map((a) => [a.code, a.id] as const)),
  };
}
