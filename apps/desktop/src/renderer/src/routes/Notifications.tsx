import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import type { Notification, NotificationSeverity } from '@muneem/contracts';
import { api, errorMessage } from '../api.js';
import { groupBySeverity, kindLabel } from '../lib/notifications.js';
import { ago } from '../lib/sync/status.js';
import { useNow } from '../lib/useNow.js';
import { Bell, CheckCheck, CheckCircle2, ExternalLink, ChevronDown, Check, X } from 'lucide-react';

const BORDER: Record<NotificationSeverity, string> = { critical: 'border-l-red-600', warning: 'border-l-amber-500', info: 'border-l-primary' };

export default function Notifications() {
  const [status, setStatus] = useState<'open' | 'all'>('open');
  const [error, setError] = useState<string | null>(null);
  const qc = useQueryClient();
  const nav = useNavigate();
  const now = useNow();
  const list = useInfiniteQuery({
    queryKey: ['notifications', 'list', status],
    queryFn: ({ pageParam }) => api.notifications.list({ status, limit: 50, ...(pageParam && { cursor: pageParam }) }),
    initialPageParam: '', getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
  const act = async (f: () => Promise<unknown>) => {
    try { await f(); setError(null); } catch (e) { setError(errorMessage(e)); }
    void qc.invalidateQueries({ queryKey: ['notifications'] });
  };
  const open = (n: Notification) => act(async () => {
    if (!n.readAt) await api.notifications.markRead({ ids: [n.id] });
    if (n.link) nav(n.link);
  });
  const items = list.data?.pages.flatMap((p) => p.items) ?? [];
  return (
    <div className="max-w-6xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-2xl font-semibold"><Bell size={22} className="text-primary" aria-hidden />Notifications</h1>
        <div className="flex gap-2">
          <div role="tablist" aria-label="Which notifications" className="flex rounded border border-border bg-card text-sm">
            {(['open', 'all'] as const).map((s) => (
              <button key={s} type="button" role="tab" aria-selected={status === s} className={`px-3 py-1 ${status === s ? 'bg-accent font-medium text-primary' : ''}`} onClick={() => setStatus(s)}>
                {s === 'open' ? 'Open' : 'All, with resolved'}
              </button>
            ))}
          </div>
          <button type="button" className="btn-secondary gap-1.5 py-1" onClick={() => void act(() => api.notifications.markRead({}))}><CheckCheck size={14} aria-hidden />Mark all read</button>
        </div>
      </div>
      {error && <p className="err" role="alert">{error}</p>}
      {list.error && <p className="err" role="alert">{errorMessage(list.error)}</p>}
      {list.data && items.length === 0 && <p className="card flex items-center gap-2 text-muted-foreground"><CheckCircle2 size={18} className="text-green-700 dark:text-green-400" aria-hidden />Nothing needs your attention.</p>}
      {groupBySeverity(items).map((g) => (
        <section key={g.severity} aria-labelledby={`sev-${g.severity}`} className="space-y-2">
          <h2 id={`sev-${g.severity}`} className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{g.label} ({g.items.length})</h2>
          <ul className="space-y-2">
            {g.items.map((n) => (
              <li key={n.id} className={`card border-l-4 ${BORDER[n.severity]} ${n.readAt || n.resolvedAt ? 'opacity-75' : ''}`}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">{kindLabel(n.kind)} · {ago(n.updatedAt, now)}{n.resolvedAt && ' · resolved'}{n.dismissedAt && !n.resolvedAt && ' · dismissed'}</p>
                    <p className={n.readAt ? '' : 'font-semibold'}>{n.title}</p>
                    <p className="text-sm text-muted-foreground">{n.body}</p>
                  </div>
                  {!n.resolvedAt && (
                    <div className="flex shrink-0 gap-2 text-sm">
                      {n.link && <button type="button" className="btn-primary px-2 py-1" aria-label="Open" title="Open" onClick={() => void open(n)}><ExternalLink size={14} aria-hidden /></button>}
                      {!n.readAt && <button type="button" className="btn-secondary px-2 py-1" aria-label="Mark read" title="Mark read" onClick={() => void act(() => api.notifications.markRead({ ids: [n.id] }))}><Check size={14} aria-hidden /></button>}
                      {!n.dismissedAt && <button type="button" className="btn-secondary px-2 py-1" aria-label="Dismiss" title="Dismiss" onClick={() => void act(() => api.notifications.dismiss({ ids: [n.id] }))}><X size={14} aria-hidden /></button>}
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
      {list.hasNextPage && <button type="button" className="btn-secondary" onClick={() => void list.fetchNextPage()}><ChevronDown size={16} aria-hidden />Show more</button>}
    </div>
  );
}
