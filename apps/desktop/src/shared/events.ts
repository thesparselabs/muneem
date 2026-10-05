import type { HydrationStatus, NotificationKind, NotificationSeverity, Session, SyncStatus, UpdateStatus } from '@muneem/contracts';

/** Main → renderer push channels. Whitelisted in the generated preload. */
export interface PushEvents {
  'sync.status': SyncStatus;
  'connectivity.changed': { online: boolean; lastProbeAt: string | null; serverSkewMs: number | null };
  'session.changed': Session | null;
  'sync.hydration': HydrationStatus;
  'update.status': UpdateStatus;
  'notification.new': { id: string; kind: NotificationKind; severity: NotificationSeverity; title: string };
}
export type PushEventName = keyof PushEvents;
export const PUSH_EVENT_NAMES: readonly PushEventName[] = ['sync.status', 'connectivity.changed', 'session.changed', 'sync.hydration', 'update.status', 'notification.new'];
