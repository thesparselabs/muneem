import { AppError } from '@muneem/contracts';
import { createDocSeries, getSetting, listDocSeries, setSetting, type Db } from '@muneem/db-sqlite';
import type { DeviceService } from './device.js';
import type { SessionService } from './session.js';

export class SettingsService {
  constructor(private readonly d: { db: () => Db; session: SessionService; device: DeviceService }) {}
  private ctx() {
    const s = this.d.session.require();
    if (!s.businessId) throw new AppError('INVALID_STATE', 'No active business');
    return { businessId: s.businessId, actor: { userId: s.user.id, deviceId: this.d.device.localDeviceId(), terminalId: s.terminalId } };
  }
  get(key: string) { return { value: getSetting(this.d.db(), this.ctx().businessId, key) }; }
  set(key: string, value: unknown) { const c = this.ctx(); setSetting(this.d.db(), c.businessId, key, value, c.actor); return { ok: true as const }; }
  listSeries() {
    return listDocSeries(this.d.db(), this.ctx().businessId).map((s) => ({ ...s, docType: s.docType as never }));
  }
  createSeries(input: { branchId: string | null; terminalId: string | null; docType: string; fy: string; prefix: string; padWidth: number }) {
    const c = this.ctx();
    const s = createDocSeries(this.d.db(), c.businessId, input, c.actor);
    return { ...s, docType: s.docType as never };
  }
}
