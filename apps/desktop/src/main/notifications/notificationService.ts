import type { NotificationCounts, NotificationKind, NotificationPage, NotificationSeverity, Permission } from '@muneem/contracts';
import {
  dismissNotifications, listNotifications, markNotificationsRead, notificationCounts, reconcileNotifications, resolveNotification, raiseNotification,
  type Db, type NotificationRaise, type NotificationScope,
} from '@muneem/db-sqlite';
import { DEVICE_KINDS, DEVICE_SCOPE, visibleKinds } from './kinds.js';

export interface NotificationNew { id: string; kind: NotificationKind; severity: NotificationSeverity; title: string }

export interface NotificationServiceDeps {
  db: () => Db;
  businessId: () => string | null;
  can: (p: Permission) => boolean;
  now: () => number;
  emit: (n: NotificationNew) => void;
}

// What an outside caller (the 8i updater, a future cloud message) passes to raise one notification.
export type NotifyInput = Omit<NotificationRaise, 'kind'>;

// ADR-0050: raise-or-update and resolve per (kind, entity), and reading the centre as the signed-in user may see it.
export class NotificationService {
  constructor(private readonly d: NotificationServiceDeps) {}

  private at(): string { return new Date(this.d.now()).toISOString(); }

  private scopeOf(kind: NotificationKind): string | null {
    return DEVICE_KINDS.has(kind) ? DEVICE_SCOPE : this.d.businessId();
  }

  private announce(outcome: string, id: string, r: NotificationRaise): void {
    if (outcome === 'new' || outcome === 'escalated') this.d.emit({ id, kind: r.kind, severity: r.severity, title: r.title });
  }

  // A detector's full answer for its kind; returns false when there is no business to hold it.
  reconcile(kind: NotificationKind, current: readonly Omit<NotificationRaise, 'kind'>[]): boolean {
    const scope = this.scopeOf(kind);
    if (!scope) return false;
    const { raised } = reconcileNotifications(this.d.db(), scope, kind, current.map((c) => ({ ...c, kind })), this.at());
    for (const r of raised) this.announce(r.outcome, r.id, r.raise);
    return true;
  }

  /** The hook for other modules (e.g. the 8i updater: `notify('update_ready', {...})`); idempotent per entity. */
  notify(kind: NotificationKind, n: NotifyInput): void {
    const scope = this.scopeOf(kind);
    if (!scope) return;
    const raise = { ...n, kind };
    const r = raiseNotification(this.d.db(), scope, raise, this.at());
    this.announce(r.outcome, r.id, raise);
  }

  resolve(kind: NotificationKind, entityType: string, entityId: string): void {
    const scope = this.scopeOf(kind);
    if (scope) resolveNotification(this.d.db(), scope, { kind, entityType, entityId }, this.at());
  }

  private visible(): NotificationScope {
    const businessId = this.d.businessId();
    return { scopes: businessId ? [businessId, DEVICE_SCOPE] : [DEVICE_SCOPE], kinds: visibleKinds(this.d.can) };
  }

  list(f: { status: 'open' | 'all'; limit: number; cursor?: string | undefined }): NotificationPage { return listNotifications(this.d.db(), this.visible(), f); }
  counts(): NotificationCounts { return notificationCounts(this.d.db(), this.visible()); }
  markRead(ids?: readonly string[]): number { return markNotificationsRead(this.d.db(), this.visible(), ids, this.at()); }
  dismiss(ids?: readonly string[]): number { return dismissNotifications(this.d.db(), this.visible(), ids, this.at()); }
}
