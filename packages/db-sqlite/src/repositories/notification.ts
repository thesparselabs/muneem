import type { Notification, NotificationCounts, NotificationKind, NotificationPage, NotificationSeverity } from '@muneem/contracts';
import { newUlid } from '@muneem/domain';
import type { Db } from '../open.js';
import { stmt } from '../statements.js';
import { withTransaction } from '../uow.js';

export interface NotificationRaise {
  kind: NotificationKind; severity: NotificationSeverity; entityType: string; entityId: string; title: string; body: string; link: string | null;
}
// new and escalated are worth telling the user about; updated and unchanged are not.
export type RaiseOutcome = 'new' | 'escalated' | 'updated' | 'unchanged';
// Which notifications a reader may see: its business and the device scope, and the kinds its permissions allow.
export interface NotificationScope { scopes: readonly string[]; kinds: readonly NotificationKind[] }

type Row = {
  id: string; business_id: string; kind: NotificationKind; severity: NotificationSeverity; entity_type: string; entity_id: string; title: string; body: string;
  link: string | null; created_at: string; updated_at: string; read_at: string | null; dismissed_at: string | null; resolved_at: string | null;
};
const toNotification = (r: Row): Notification => ({
  id: r.id, kind: r.kind, severity: r.severity, entityType: r.entity_type, entityId: r.entity_id, title: r.title, body: r.body, link: r.link,
  createdAt: r.created_at, updatedAt: r.updated_at, readAt: r.read_at, dismissedAt: r.dismissed_at, resolvedAt: r.resolved_at,
});
const RANK: Record<NotificationSeverity, number> = { info: 0, warning: 1, critical: 2 };
const VISIBLE = `business_id IN (SELECT value FROM json_each(@scopes)) AND kind IN (SELECT value FROM json_each(@kinds))`;
const scopeParams = (s: NotificationScope) => ({ scopes: JSON.stringify(s.scopes), kinds: JSON.stringify(s.kinds) });

const openRow = (db: Db, businessId: string, r: Pick<NotificationRaise, 'kind' | 'entityType' | 'entityId'>) =>
  stmt(db, `SELECT * FROM notification WHERE business_id = ? AND kind = ? AND entity_type = ? AND entity_id = ? AND resolved_at IS NULL`)
    .get(businessId, r.kind, r.entityType, r.entityId) as Row | undefined;

// Idempotent per (business, kind, entity): one open row, refreshed in place; a worse severity brings a dismissed one back.
export function raiseNotification(db: Db, businessId: string, r: NotificationRaise, at: string): { id: string; outcome: RaiseOutcome } {
  return withTransaction(db, () => {
    const existing = openRow(db, businessId, r);
    if (!existing) {
      const id = newUlid();
      stmt(db, `INSERT INTO notification (id, business_id, kind, severity, entity_type, entity_id, title, body, link, created_at, updated_at)
        VALUES (@id, @businessId, @kind, @severity, @entityType, @entityId, @title, @body, @link, @at, @at)`).run({ id, businessId, ...r, at });
      return { id, outcome: 'new' };
    }
    if (existing.severity === r.severity && existing.title === r.title && existing.body === r.body && existing.link === r.link) {
      return { id: existing.id, outcome: 'unchanged' };
    }
    const escalated = RANK[r.severity] > RANK[existing.severity];
    stmt(db, `UPDATE notification SET severity = @severity, title = @title, body = @body, link = @link, updated_at = @at,
        read_at = CASE WHEN @escalated = 1 THEN NULL ELSE read_at END, dismissed_at = CASE WHEN @escalated = 1 THEN NULL ELSE dismissed_at END
      WHERE id = @id`).run({ id: existing.id, ...r, at, escalated: escalated ? 1 : 0 });
    return { id: existing.id, outcome: escalated ? 'escalated' : 'updated' };
  });
}

export function resolveNotification(db: Db, businessId: string, key: Pick<NotificationRaise, 'kind' | 'entityType' | 'entityId'>, at: string): boolean {
  return stmt(db, `UPDATE notification SET resolved_at = @at, updated_at = @at
    WHERE business_id = @businessId AND kind = @kind AND entity_type = @entityType AND entity_id = @entityId AND resolved_at IS NULL`)
    .run({ businessId, ...key, at }).changes > 0;
}

// A detector's whole answer for one kind: raise each condition that holds and resolve the open ones that no longer do.
export function reconcileNotifications(
  db: Db, businessId: string, kind: NotificationKind, current: readonly NotificationRaise[], at: string,
): { raised: { id: string; outcome: RaiseOutcome; raise: NotificationRaise }[]; resolved: number } {
  return withTransaction(db, () => {
    const raised = current.map((r) => ({ ...raiseNotification(db, businessId, r, at), raise: r }));
    const keep = new Set(current.map((r) => `${r.entityType}:${r.entityId}`));
    const open = stmt(db, 'SELECT entity_type, entity_id FROM notification WHERE business_id = ? AND kind = ? AND resolved_at IS NULL')
      .all(businessId, kind) as { entity_type: string; entity_id: string }[];
    let resolved = 0;
    for (const o of open) {
      if (!keep.has(`${o.entity_type}:${o.entity_id}`) && resolveNotification(db, businessId, { kind, entityType: o.entity_type, entityId: o.entity_id }, at)) resolved++;
    }
    return { raised, resolved };
  });
}

type Cursor = { u: string; id: string };
const encode = (c: Cursor): string => Buffer.from(JSON.stringify(c)).toString('base64url');
function decode(s: string | undefined): Cursor | null {
  if (!s) return null;
  try { return JSON.parse(Buffer.from(s, 'base64url').toString('utf8')) as Cursor; } catch { return null; }
}

// Most recently changed first; open = still true and not dismissed.
export function listNotifications(db: Db, scope: NotificationScope, f: { status: 'open' | 'all'; limit: number; cursor?: string | undefined }): NotificationPage {
  const after = decode(f.cursor);
  const rows = stmt(db, `SELECT * FROM notification WHERE ${VISIBLE}
      AND (@open = 0 OR (resolved_at IS NULL AND dismissed_at IS NULL))
      AND (@afterU IS NULL OR (updated_at, id) < (@afterU, @afterId))
    ORDER BY updated_at DESC, id DESC LIMIT @limit`).all({
    ...scopeParams(scope), open: f.status === 'open' ? 1 : 0, afterU: after?.u ?? null, afterId: after?.id ?? null, limit: f.limit + 1,
  }) as Row[];
  const page = rows.slice(0, f.limit);
  const last = page.at(-1);
  return { items: page.map(toNotification), nextCursor: rows.length > f.limit && last ? encode({ u: last.updated_at, id: last.id }) : null };
}

export function notificationCounts(db: Db, scope: NotificationScope): NotificationCounts {
  const rows = stmt(db, `SELECT severity, COUNT(*) AS n, SUM(read_at IS NULL) AS unread FROM notification
    WHERE ${VISIBLE} AND resolved_at IS NULL AND dismissed_at IS NULL GROUP BY severity`).all(scopeParams(scope)) as { severity: NotificationSeverity; n: number; unread: number }[];
  const counts: NotificationCounts = { open: 0, unread: 0, bySeverity: { info: 0, warning: 0, critical: 0 } };
  for (const r of rows) {
    counts.open += r.n;
    counts.unread += r.unread;
    counts.bySeverity[r.severity] = r.n;
  }
  return counts;
}

function markOpen(db: Db, column: 'read_at' | 'dismissed_at', scope: NotificationScope, ids: readonly string[] | undefined, at: string): number {
  return stmt(db, `UPDATE notification SET ${column} = @at WHERE ${VISIBLE} AND ${column} IS NULL AND resolved_at IS NULL
      AND (@all = 1 OR id IN (SELECT value FROM json_each(@ids)))`)
    .run({ ...scopeParams(scope), at, all: ids === undefined ? 1 : 0, ids: JSON.stringify(ids ?? []) }).changes;
}

export const markNotificationsRead = (db: Db, scope: NotificationScope, ids: readonly string[] | undefined, at: string): number => markOpen(db, 'read_at', scope, ids, at);
export const dismissNotifications = (db: Db, scope: NotificationScope, ids: readonly string[] | undefined, at: string): number => markOpen(db, 'dismissed_at', scope, ids, at);
