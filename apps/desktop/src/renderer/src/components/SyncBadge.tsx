import { useUi } from '../store.js';

/** LLD §8.4 status labels. */
export default function SyncBadge() {
  const { sync, online } = useUi();
  if (!sync) return null;
  const map = {
    synced: ['✓ Synced', 'bg-green-100 text-green-800'],
    syncing: [`⟳ Syncing ${sync.inFlight}`, 'bg-blue-100 text-blue-800'],
    queued: [`⚠ ${sync.pending} waiting · ${online ? 'sync pending' : 'offline'}`, 'bg-amber-100 text-amber-800'],
    degraded: [`⚠ retrying (${sync.failed} failed)`, 'bg-amber-100 text-amber-800'],
    blocked: ['✕ Needs attention', 'bg-red-100 text-red-800'],
    never: [online ? '– Not synced yet' : '– Offline', 'bg-slate-100 text-slate-700'],
  } as const;
  const [label, cls] = map[sync.state];
  return <span role="status" aria-live="polite" className={`rounded-full px-3 py-1 text-xs font-medium ${cls}`} title={sync.detail ?? undefined}>{label}</span>;
}
