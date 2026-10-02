import { AppError, SETTING_SCHEMAS, type Permission, type SettingKey, type SettingValue } from '@muneem/contracts';
import { getSetting, type Actor, type Db, type Till } from '@muneem/db-sqlite';
import type { Rbac } from '../../rbac.js';
import type { CatalogContext } from '../catalogContext.js';
import type { SessionService } from '../session.js';

// Everything a POS service needs to know about who is billing, where, and under which business settings.
export class PosContext {
  constructor(readonly catalog: CatalogContext, private readonly session: SessionService, private readonly rbac: Rbac) {}

  db(): Db { return this.catalog.db(); }
  actor(): Actor { return this.catalog.actor(); }
  businessId(): string { return this.catalog.businessId(); }
  today(): string { return this.catalog.today(); }
  userId(): string { return this.session.require().user.id; }

  till(): Till {
    const s = this.session.require();
    if (!s.branchId || !s.terminalId) throw new AppError('INVALID_STATE', 'Select a terminal for this device first');
    return { businessId: this.businessId(), branchId: s.branchId, terminalId: s.terminalId };
  }

  can(permission: Permission): boolean { return this.rbac.has(this.session.require(), permission) !== null; }
  maxDiscountBp(): number | undefined { return this.rbac.has(this.session.require(), 'sales.create')?.limit?.maxDiscountBp; }

  // A stored value that no longer fits its schema (older build, hand edit) falls back rather than breaking billing.
  setting<K extends SettingKey>(key: K, fallback: SettingValue<K>): SettingValue<K> {
    const parsed = SETTING_SCHEMAS[key].safeParse(getSetting(this.db(), this.businessId(), key));
    return parsed.success ? (parsed.data as SettingValue<K>) : fallback;
  }
}
