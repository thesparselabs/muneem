import type { UpdateStatus } from '@muneem/contracts';
import type { Db } from '@muneem/db-sqlite';
import { lastMigrationFailure } from '../infra/db.js';
import type { Loggers } from '../infra/logger.js';
import type { Handlers } from '../ipc/gateway.js';
import { defaultChannelFor, metaChannelStore } from './channels.js';
import { InstallGate } from './installGate.js';
import { PosActivity } from './posActivity.js';
import { UpdateService } from './updateService.js';
import type { Updater } from './updater.js';

export interface UpdatesConfig {
  db: () => Db;
  updater: Updater | null;
  baseUrl: string;
  appVersion: string;
  installationId: () => string;
  registerOpen: () => boolean;
  emit: (status: UpdateStatus) => void;
  now: () => number;
  log: Loggers['app'];
  registerIdleMs?: number;
}

type UpdateHandlers = Pick<Handlers, 'update.getStatus' | 'update.checkNow' | 'update.installNow' | 'update.setChannel' | 'pos.reportCart'>;

// Stage 8i composition: what the till is doing, when an install may happen, and the update service with its IPC.
export function createUpdates(c: UpdatesConfig) {
  const activity = new PosActivity(c.now);
  const gate = new InstallGate({ activity: () => activity.snapshot(), registerOpen: c.registerOpen, now: c.now, ...(c.registerIdleMs !== undefined && { registerIdleMs: c.registerIdleMs }) });
  const service = new UpdateService({
    updater: c.updater, baseUrl: c.baseUrl, channels: metaChannelStore(c.db, defaultChannelFor(c.appVersion)), installationId: c.installationId,
    currentVersion: c.appVersion, gate, lastMigrationFailure: () => lastMigrationFailure(c.db()), emit: c.emit, now: c.now, log: c.log,
  });
  const handlers: UpdateHandlers = {
    'update.getStatus': () => service.status(),
    'update.checkNow': () => service.checkNow(),
    'update.installNow': () => service.installNow(),
    'update.setChannel': (i) => service.setChannel(i.channel),
    'pos.reportCart': (i) => { activity.reportCart(i.lines); return { ok: true as const }; },
  };
  return { activity, gate, service, handlers };
}
export type Updates = ReturnType<typeof createUpdates>;

export { FolderUpdater } from './folderUpdater.js';
