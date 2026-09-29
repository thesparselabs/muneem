import { AppError, ROLE_PRESETS, type Branch, type Business, type Contract, type Terminal } from '@muneem/contracts';
import type { z } from 'zod';
import { newUlid } from '@muneem/domain';
import {
  bindTerminal, createBranch, createBusiness, createTerminal, ensureCatalogDefaults, getBusiness, getMeta, grantLocalOwnership, listBranches, listTerminals,
  META_KEYS, setMeta, updateBusiness, withTransaction, type Db,
} from '@muneem/db-sqlite';
import type { SessionService } from './session.js';
import type { DeviceService } from './device.js';

export interface BusinessDeps { db: () => Db; session: SessionService; device: DeviceService }

export class BusinessService {
  constructor(private readonly d: BusinessDeps) {}
  private actor() {
    const s = this.d.session.require();
    return { userId: s.user.id, deviceId: this.d.device.localDeviceId(), terminalId: s.terminalId };
  }
  private activeBusinessId(): string {
    const s = this.d.session.require();
    if (!s.businessId) throw new AppError('INVALID_STATE', 'No active business. Complete setup first.');
    return s.businessId;
  }

  get(): Business | null {
    const s = this.d.session.get();
    return s?.businessId ? getBusiness(this.d.db(), s.businessId) : null;
  }

  /** Local creation: row + audit + outbox in one transaction; owner preset granted locally until the cloud confirms. */
  create(input: Omit<Business, 'id' | 'organizationId' | 'createdAt' | 'updatedAt' | 'version'>): Business {
    const s = this.d.session.require();
    const db = this.d.db();
    const orgs = JSON.parse(getMeta(db, `orgs:${s.user.id}`) ?? '[]') as { id: string; name: string }[];
    const organizationId = s.organizationId ?? orgs[0]?.id ?? newUlid();
    const actor = this.actor();
    const business = withTransaction(db, () => {
      const b = createBusiness(db, { ...input, organizationId }, actor);
      grantLocalOwnership(db, s.user.id, b.id, organizationId, b.name, ROLE_PRESETS.owner!);
      ensureCatalogDefaults(db, b.id, actor);
      setMeta(db, META_KEYS.activeBusinessId, b.id);
      setMeta(db, META_KEYS.activeBranchId, '');
      setMeta(db, META_KEYS.activeTerminalId, '');
      return b;
    });
    this.d.session.patch({ organizationId, businessId: business.id, branchId: null, terminalId: null, user: { ...s.user, roles: ['owner'] } });
    return business;
  }

  update(input: z.output<Contract['business.update']['input']>): Business {
    const { id, version, ...rest } = input;
    const patch = Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== undefined)) as Partial<Omit<Business, 'id' | 'organizationId' | 'createdAt' | 'updatedAt' | 'version'>>;
    if (id !== this.activeBusinessId()) throw new AppError('PERMISSION_DENIED', 'Not the active business');
    return updateBusiness(this.d.db(), id, version, patch, this.actor());
  }

  getBranches(): Branch[] { return listBranches(this.d.db(), this.activeBusinessId()); }
  createBranch(input: Omit<Branch, 'id' | 'businessId' | 'createdAt' | 'version'>): Branch {
    const b = createBranch(this.d.db(), this.activeBusinessId(), input, this.actor());
    if (b.isDefault && !this.d.session.require().branchId) {
      setMeta(this.d.db(), META_KEYS.activeBranchId, b.id);
      this.d.session.patch({ branchId: b.id });
    }
    return b;
  }
  getTerminals(branchId?: string): Terminal[] { return listTerminals(this.d.db(), this.activeBusinessId(), branchId); }
  createTerminal(input: { branchId: string; code: string; name: string }): Terminal {
    return createTerminal(this.d.db(), this.activeBusinessId(), input, this.actor());
  }
  /** Bind this device to a terminal and make it the session's terminal. */
  selectTerminal(terminalId: string) {
    const t = bindTerminal(this.d.db(), terminalId, this.actor());
    setMeta(this.d.db(), META_KEYS.activeBranchId, t.branchId);
    setMeta(this.d.db(), META_KEYS.activeTerminalId, t.id);
    return this.d.session.patch({ branchId: t.branchId, terminalId: t.id });
  }
}
