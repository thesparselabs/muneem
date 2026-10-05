import type { Notification, NotificationCounts, NotificationKind, NotificationSeverity } from '@muneem/contracts';

export const SEVERITY_ORDER: readonly NotificationSeverity[] = ['critical', 'warning', 'info'];
export const SEVERITY_LABEL: Record<NotificationSeverity, string> = { critical: 'Needs action now', warning: 'Needs attention', info: 'For your information' };

const KIND_LABEL: Record<NotificationKind, string> = {
  low_stock: 'Low stock', customer_overdue: 'Customer overdue', supplier_due: 'Supplier payment', sync_blocked: 'Sync', backup_failed: 'Backup',
  backup_stale: 'Backup', audit_chain_broken: 'Audit trail', review_items: 'Review items', update_ready: 'Update',
};
export const kindLabel = (k: NotificationKind): string => KIND_LABEL[k] ?? k;

export interface SeverityGroup { severity: NotificationSeverity; label: string; items: Notification[] }

// Worst first; within a group the list keeps the order it came in (most recently changed first).
export function groupBySeverity(items: readonly Notification[]): SeverityGroup[] {
  return SEVERITY_ORDER.map((severity) => ({ severity, label: SEVERITY_LABEL[severity], items: items.filter((n) => n.severity === severity) }))
    .filter((g) => g.items.length > 0);
}

export interface Bell { count: string; tone: NotificationSeverity | 'none'; label: string }

// The bell counts what is unread and takes the colour of the worst open notification.
export function bell(c: NotificationCounts | undefined): Bell {
  if (!c || c.open === 0) return { count: '', tone: 'none', label: 'Notifications, none open' };
  const tone = SEVERITY_ORDER.find((s) => c.bySeverity[s] > 0) ?? 'info';
  return { count: c.unread === 0 ? '' : c.unread > 9 ? '9+' : String(c.unread), tone, label: `Notifications, ${c.unread} unread of ${c.open} open` };
}

// What the dashboard says about the centre: the worst kind of thing waiting, or nothing at all.
export function attentionNote(c: NotificationCounts | undefined): string | undefined {
  if (!c || c.open === 0) return undefined;
  const parts = SEVERITY_ORDER.filter((s) => c.bySeverity[s] > 0).map((s) => `${c.bySeverity[s]} ${s}`);
  return parts.join(' · ');
}
