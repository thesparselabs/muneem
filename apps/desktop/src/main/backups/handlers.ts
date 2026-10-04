import type { LocalBackup } from '@muneem/contracts';
import type { BackupLogEntry } from '@muneem/db-sqlite';
import type { Handlers } from '../ipc/gateway.js';
import type { BackupService } from './backupService.js';
import type { RestoreService } from './restoreService.js';
import type { BackupScheduler } from './scheduler.js';

export interface BackupHandlerDeps { backups: BackupService; restore: RestoreService; scheduler: BackupScheduler }

// Paths stay in main: the screen names a backup by its id.
export const localView = (b: BackupLogEntry): LocalBackup => ({
  id: b.id, kind: b.kind, createdAt: b.createdAt, bytes: b.bytes, verified: b.verified, encrypted: b.encrypted, businessId: b.businessId,
  schemaVersion: b.schemaVersion, error: b.error, cloudStatus: b.cloudStatus, cloudError: b.cloudError, uploadedAt: b.uploadedAt,
});

type BackupChannels = 'backups.list' | 'backups.runNow' | 'backups.verify' | 'backups.restore' | 'backups.restoreFromCloud';

export function backupHandlers(d: BackupHandlerDeps): Pick<Handlers, BackupChannels> {
  return {
    'backups.list': async () => {
      const businessId = d.backups.businessId();
      let cloud: Awaited<ReturnType<RestoreService['listCloud']>> = [];
      let cloudError: string | null = null;
      if (businessId) {
        try { cloud = await d.restore.listCloud(businessId); } catch (e) { cloudError = e instanceof Error ? e.message : String(e); }
      }
      return { local: d.backups.list().map(localView), cloud, cloudError, health: d.backups.health() };
    },
    'backups.runNow': async () => ({ backup: localView(await d.scheduler.now('manual')) }),
    'backups.verify': (i) => d.restore.verify(i),
    'backups.restore': (i) => d.restore.restore(i),
    'backups.restoreFromCloud': (i) => d.restore.restoreFromCloud(i.businessId),
  };
}
