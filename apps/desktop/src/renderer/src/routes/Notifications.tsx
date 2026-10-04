import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import type { Notification, NotificationSeverity } from '@muneem/contracts';
import { api, errorMessage } from '../api.js';
import { groupBySeverity, kindLabel } from '../lib/notifications.js';
import { ago } from '../lib/sync/status.js';
import { useNow } from '../lib/useNow.js';

const BORDER: Record<NotificationSeverity, string> = { critical: 'border-l-red-600', warning: 'border-l-amber-500', info: 'border-l-blue-500' };

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
    <div className="max-w-4xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Notifications</h1>
        <div className="flex gap-2">
          <div role="tablist" aria-label="Which notifications" className="flex rounded border bg-white text-sm">
            {(['open', 'all'] as const).map((s) => (
              <button key={s} type="button" role="tab" aria-selected={status === s} className={`px-3 py-1 ${status === s ? 'bg-blue-50 font-medium text-blue-800' : ''}`} onClick={() => setStatus(s)}>
                {s === 'open' ? 'Open' : 'All, with resolved'}
              </button>
            ))}
          </div>
          <button type="button" className="btn-secondary py-1" onClick={() => void act(() => api.notifications.markRead({}))}>Mark all read</button>
        </div>
      </div>
      {error && <p className="err" role="alert">{error}</p>}
      {list.error && <p className="err" role="alert">{errorMessage(list.error)}</p>}
      {list.data && items.length === 0 && <p className="text-slate-500">Nothing needs your attention.</p>}
      {groupBySeverity(items).map((g) => (
        <section key={g.severity} aria-labelledby={`sev-${g.severity}`} className="space-y-2">
          <h2 id={`sev-${g.severity}`} className="text-sm font-semibold uppercase tracking-wide text-slate-600">{g.label} ({g.items.length})</h2>
          <ul className="space-y-2">
            {g.items.map((n) => (
              <li key={n.id} className={`card border-l-4 ${BORDER[n.severity]} ${n.readAt || n.resolvedAt ? 'opacity-75' : ''}`}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs text-slate-500">{kindLabel(n.kind)} · {ago(n.updatedAt, now)}{n.resolvedAt && ' · resolved'}{n.dismissedAt && !n.resolvedAt && ' · dismissed'}</p>
                    <p className={n.readAt ? '' : 'font-semibold'}>{n.title}</p>
                    <p className="text-sm text-slate-700">{n.body}</p>
                  </div>
                  {!n.resolvedAt && (
                    <div className="flex shrink-0 gap-2 text-sm">
                      {n.link && <button type="button" className="btn-primary py-1" onClick={() => void open(n)}>Open</button>}
                      {!n.readAt && <button type="button" className="btn-secondary py-1" onClick={() => void act(() => api.notifications.markRead({ ids: [n.id] }))}>Mark read</button>}
                      {!n.dismissedAt && <button type="button" className="btn-secondary py-1" onClick={() => void act(() => api.notifications.dismiss({ ids: [n.id] }))}>Dismiss</button>}
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
      {list.hasNextPage && <button type="button" className="btn-secondary" onClick={() => void list.fetchNextPage()}>Show more</button>}
    </div>
  );
}
