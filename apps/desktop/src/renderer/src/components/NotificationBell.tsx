import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { NotificationSeverity } from '@muneem/contracts';
import { api } from '../api.js';
import { bell } from '../lib/notifications.js';

const TONE: Record<NotificationSeverity | 'none', string> = {
  critical: 'bg-red-600 text-white', warning: 'bg-amber-500 text-white', info: 'bg-blue-600 text-white', none: 'hidden',
};

export function useNotificationCounts() {
  // Notifications raised while signing in arrive before the bell mounts, so it reads afresh every time it appears.
  return useQuery({ queryKey: ['notifications', 'counts'], queryFn: () => api.notifications.counts({}), refetchInterval: 60_000, refetchOnMount: 'always', retry: false });
}

export default function NotificationBell() {
  const qc = useQueryClient();
  const counts = useNotificationCounts();
  useEffect(() => api.events.on('notification.new', () => { void qc.invalidateQueries({ queryKey: ['notifications'] }); }), [qc]);
  const b = bell(counts.data);
  return (
    <Link to="/notifications" aria-label={b.label} title={b.label} className="relative rounded-full p-1 hover:bg-slate-100">
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-slate-700" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
      </svg>
      {b.count && <span className={`absolute -right-1 -top-1 min-w-[1.1rem] rounded-full px-1 text-center text-[10px] font-semibold leading-4 ${TONE[b.tone]}`}>{b.count}</span>}
    </Link>
  );
}
