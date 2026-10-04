import { NOTIFICATION_KINDS, type NotificationKind, type Permission } from '@muneem/contracts';
import { DEVICE_AUDIT_SCOPE } from '@muneem/db-sqlite';

// Device-wide notifications are stored under the device scope and shown in whichever business is open.
export const DEVICE_SCOPE = DEVICE_AUDIT_SCOPE;
export const DEVICE_KINDS: ReadonlySet<NotificationKind> = new Set(['sync_blocked', 'backup_failed', 'backup_stale', 'audit_chain_broken', 'update_ready']);

// ADR-0050: a kind is shown only to users who could act on its subject; null = everyone signed in.
export const KIND_PERMISSION: Readonly<Record<NotificationKind, Permission | null>> = {
  low_stock: 'inventory.view',
  customer_overdue: 'customers.view',
  supplier_due: 'suppliers.view',
  sync_blocked: 'sync.view',
  backup_failed: 'diagnostics.view',
  backup_stale: 'diagnostics.view',
  audit_chain_broken: 'diagnostics.view',
  review_items: 'sync.view',
  update_ready: null,
};

export const visibleKinds = (can: (p: Permission) => boolean): NotificationKind[] =>
  NOTIFICATION_KINDS.filter((k) => { const p = KIND_PERMISSION[k]; return p === null || can(p); });
