import { z } from 'zod';
import { IsoDateTime, Ulid } from './schemas.js';

// FR-074 / ADR-0050: what the notification centre raises; each kind is raised, updated and resolved per entity.
export const NOTIFICATION_KINDS = [
  'low_stock', 'customer_overdue', 'supplier_due', 'sync_blocked', 'backup_failed', 'backup_stale', 'audit_chain_broken', 'review_items', 'update_ready',
] as const;
export const NotificationKind = z.enum(NOTIFICATION_KINDS);
export type NotificationKind = z.infer<typeof NotificationKind>;

export const NOTIFICATION_SEVERITIES = ['info', 'warning', 'critical'] as const;
export const NotificationSeverity = z.enum(NOTIFICATION_SEVERITIES);
export type NotificationSeverity = z.infer<typeof NotificationSeverity>;

export const Notification = z.object({
  id: Ulid, kind: NotificationKind, severity: NotificationSeverity, entityType: z.string(), entityId: z.string(),
  title: z.string(), body: z.string(), link: z.string().nullable(),
  createdAt: IsoDateTime, updatedAt: IsoDateTime, readAt: IsoDateTime.nullable(), dismissedAt: IsoDateTime.nullable(), resolvedAt: IsoDateTime.nullable(),
});
export type Notification = z.infer<typeof Notification>;

// open = still true and not dismissed; all = everything kept, newest first.
export const ListNotificationsInput = z.object({
  status: z.enum(['open', 'all']).default('open'),
  limit: z.number().int().min(1).max(200).default(50),
  cursor: z.string().max(200).optional(),
});
export const NotificationPage = z.object({ items: z.array(Notification), nextCursor: z.string().nullable() });
export type NotificationPage = z.infer<typeof NotificationPage>;

// No ids = every open notification this user can see.
export const NotificationIdsInput = z.object({ ids: z.array(Ulid).max(500).optional() });
export const NotificationChanged = z.object({ changed: z.number().int() });

export const NotificationCounts = z.object({
  open: z.number().int(), unread: z.number().int(),
  bySeverity: z.object({ info: z.number().int(), warning: z.number().int(), critical: z.number().int() }),
});
export type NotificationCounts = z.infer<typeof NotificationCounts>;
