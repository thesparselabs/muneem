import type { Permission } from '@muneem/contracts';
import type { Db } from '@muneem/db-sqlite';
import type { Handlers } from '../ipc/gateway.js';
import type { DetectorSources } from './detectors.js';
import { NotificationRunner } from './runner.js';
import { NotificationService, type NotificationNew } from './notificationService.js';

export { NotificationService, type NotifyInput, type NotificationNew } from './notificationService.js';
export { NotificationRunner } from './runner.js';
export type { DetectorSources } from './detectors.js';

export interface NotificationsDeps {
  db: () => Db;
  businessId: () => string | null;
  can: (p: Permission) => boolean;
  now: () => number;
  emit: (n: NotificationNew) => void;
  sources: DetectorSources;
  log: (err: unknown, kind: string) => void;
  schedule?: (fn: () => void, ms: number) => void;
}

export function createNotifications(d: NotificationsDeps) {
  const service = new NotificationService({ db: d.db, businessId: d.businessId, can: d.can, now: d.now, emit: d.emit });
  const runner = new NotificationRunner({
    service, sources: d.sources, hasBusiness: () => d.businessId() !== null, log: d.log, ...(d.schedule && { schedule: d.schedule }),
  });
  const handlers: Pick<Handlers, 'notifications.list' | 'notifications.counts' | 'notifications.markRead' | 'notifications.dismiss'> = {
    'notifications.list': (i) => service.list(i),
    'notifications.counts': () => service.counts(),
    'notifications.markRead': (i) => ({ changed: service.markRead(i.ids) }),
    'notifications.dismiss': (i) => ({ changed: service.dismiss(i.ids) }),
  };
  return { service, runner, handlers };
}
export type Notifications = ReturnType<typeof createNotifications>;
