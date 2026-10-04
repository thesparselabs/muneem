import { AppError, type CloudBusiness, type HydrationStatus } from '@muneem/contracts';
import { getBusiness, getHydration, getMembership, listMemberships, META_KEYS, saveHydration, setMeta, unfinishedHydrations, type Db, type Hydration } from '@muneem/db-sqlite';
import type { Loggers } from '../../infra/logger.js';
import type { SessionService } from '../../services/session.js';
import type { HydrationGate } from './hydrationGate.js';
import type { HydrationTarget } from './hydrator.js';

export interface HydrationRunner { run(target: HydrationTarget): Promise<Hydration> }
interface CloudBusinessDto { id: string; name: string; state_code?: string | null }

export interface HydrationServiceDeps {
  db: () => Db;
  session: SessionService;
  gate: HydrationGate;
  runner: HydrationRunner;
  cloudDeviceId: () => string | null;
  listCloudBusinesses: () => Promise<CloudBusinessDto[]>;
  emit: (status: HydrationStatus) => void;
  afterReady: (businessId: string) => Promise<void>;
  log: Loggers['sync'];
}

// "Add this device to an existing business" (7f, FR-086): which business, how far the import is, and when billing may open.
export class HydrationService {
  private readonly running = new Map<string, Promise<Hydration>>();
  private linesTotal = new Map<string, number | null>();

  constructor(private readonly d: HydrationServiceDeps) {}

  status(businessId = this.d.session.get()?.businessId ?? null): HydrationStatus {
    const h = businessId ? getHydration(this.d.db(), businessId) : null;
    return this.view(businessId, h);
  }

  // Progress from the runner, kept so a status read between pages knows the bundle's size too.
  progress(h: Hydration, linesTotal: number | null): void {
    this.linesTotal.set(h.businessId, linesTotal);
    this.d.emit(this.view(h.businessId, h));
  }

  async listCloudBusinesses(): Promise<CloudBusiness[]> {
    const s = this.d.session.require();
    const local = (id: string) => getBusiness(this.d.db(), id) !== null;
    try {
      return (await this.d.listCloudBusinesses()).map((b) => ({ id: b.id, name: b.name, stateCode: b.state_code ?? null, onThisDevice: local(b.id) }));
    } catch (e) {
      this.d.log.warn({ err: String(e) }, 'listing cloud businesses failed; showing this user’s memberships');
      return listMemberships(this.d.db(), s.user.id).map((m) => ({ id: m.businessId, name: m.businessName ?? m.businessId, stateCode: null, onThisDevice: local(m.businessId) }));
    }
  }

  // The user must belong to the business; the session moves to it so the setup screen and the gate follow it.
  start(businessId: string): HydrationStatus {
    const s = this.d.session.require();
    const m = getMembership(this.d.db(), s.user.id, businessId);
    if (!m) throw new AppError('PERMISSION_DENIED', 'You are not a member of that business');
    const cloudDeviceId = this.d.cloudDeviceId();
    if (!cloudDeviceId) throw new AppError('INVALID_STATE', 'This device is not registered with the cloud yet. Sign in online first.');
    if (s.businessId !== businessId) this.select(businessId);
    const h = getHydration(this.d.db(), businessId);
    if (h ? h.status === 'ready' : getBusiness(this.d.db(), businessId) !== null) return this.status(businessId);
    if (!h) saveHydration(this.d.db(), businessId, { status: 'pending' }, new Date().toISOString());
    void this.launch({ businessId, cloudDeviceId });
    return this.status(businessId);
  }

  // Start-up: an import a killed run left part-way carries on by itself.
  resume(): Promise<Hydration[]> {
    const cloudDeviceId = this.d.cloudDeviceId();
    if (!cloudDeviceId) return Promise.resolve([]);
    return Promise.all(unfinishedHydrations(this.d.db()).map((h) => this.launch({ businessId: h.businessId, cloudDeviceId })));
  }

  launch(target: HydrationTarget): Promise<Hydration> {
    const current = this.running.get(target.businessId);
    if (current) return current;
    const run = this.d.runner.run(target).then(async (h) => {
      if (h.status === 'ready') await this.ready(target.businessId);
      return h;
    }).finally(() => this.running.delete(target.businessId));
    this.running.set(target.businessId, run);
    return run;
  }

  private async ready(businessId: string): Promise<void> {
    const s = this.d.session.get();
    if (s?.businessId === businessId) this.d.session.patch({});
    try {
      await this.d.afterReady(businessId);
    } catch (e) {
      this.d.log.warn({ businessId, err: String(e) }, 'pull after hydration failed; the scheduler will retry');
    }
  }

  private select(businessId: string): void {
    const s = this.d.session.require();
    const m = getMembership(this.d.db(), s.user.id, businessId)!;
    const db = this.d.db();
    setMeta(db, META_KEYS.activeBusinessId, businessId);
    setMeta(db, META_KEYS.activeBranchId, '');
    setMeta(db, META_KEYS.activeTerminalId, '');
    this.d.session.patch({
      businessId, organizationId: m.organizationId, branchId: null, terminalId: null, permVer: m.snapshot.permVer,
      user: { ...s.user, roles: m.snapshot.roles }, permissions: m.snapshot.grants.map((g) => g.permission),
    });
  }

  private view(businessId: string | null, h: Hydration | null): HydrationStatus {
    return {
      businessId, status: h?.status ?? 'none', held: businessId ? this.d.gate.holds(businessId) : false,
      bytesTotal: h?.bytesTotal ?? null, bytesDownloaded: h?.bytesDownloaded ?? 0,
      linesTotal: businessId ? this.linesTotal.get(businessId) ?? null : null, linesImported: h?.linesImported ?? 0,
      asOfSeq: h?.asOfSeq ?? null, error: h?.error ?? null, updatedAt: h?.updatedAt ?? null,
    };
  }
}
