import { AppError } from '@muneem/contracts';
import { ensureCatalogDefaults, type Actor, type Db } from '@muneem/db-sqlite';
import type { DeviceService } from './device.js';
import type { SessionService } from './session.js';

export interface CatalogContextDeps { db: () => Db; session: SessionService; device: DeviceService; now?: () => number }

const localDate = (ms: number): string => new Date(ms).toLocaleDateString('en-CA');

// Shared by the catalog services: who is acting, for which business, on which business date.
export class CatalogContext {
  private readonly seeded = new Set<string>();
  constructor(private readonly d: CatalogContextDeps) {}

  db(): Db { return this.d.db(); }

  actor(): Actor {
    const s = this.d.session.require();
    return { userId: s.user.id, deviceId: this.d.device.localDeviceId(), terminalId: s.terminalId };
  }

  // Businesses created before Stage 2 get their units and Retail list on first catalog use.
  businessId(): string {
    const s = this.d.session.require();
    if (!s.businessId) throw new AppError('INVALID_STATE', 'No active business. Complete setup first.');
    if (!this.seeded.has(s.businessId)) {
      ensureCatalogDefaults(this.d.db(), s.businessId, this.actor());
      this.seeded.add(s.businessId);
    }
    return s.businessId;
  }

  today(): string { return localDate(this.d.now?.() ?? Date.now()); }

  branchId(): string | null { return this.d.session.require().branchId; }
}
