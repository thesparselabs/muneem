import { useNavigate } from 'react-router-dom';
import { useUi } from '../store.js';
import { syncBadge, type BadgeTone } from '../lib/sync/status.js';
import { useNow } from '../lib/useNow.js';

const TONE: Record<BadgeTone, string> = {
  ok: 'bg-green-100 text-green-800', busy: 'bg-blue-100 text-blue-800', warn: 'bg-amber-100 text-amber-800', error: 'bg-red-100 text-red-800', idle: 'bg-slate-100 text-slate-700',
};

export default function SyncBadge() {
  const { sync, online } = useUi();
  const now = useNow();
  const nav = useNavigate();
  if (!sync) return null;
  const b = syncBadge(sync, online, now);
  return (
    <button type="button" aria-live="polite" title={b.title} onClick={() => nav('/diagnostics')}
      className={`rounded-full px-3 py-1 text-xs font-medium hover:underline ${TONE[b.tone]}`}>{b.label}</button>
  );
}
