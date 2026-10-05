import { useNavigate } from 'react-router-dom';
import { useUi } from '../store.js';
import { syncBadge, type BadgeTone } from '../lib/sync/status.js';
import { useNow } from '../lib/useNow.js';

const TONE: Record<BadgeTone, string> = {
  ok: 'bg-green-100 dark:bg-green-500/20 text-green-800 dark:text-green-400', busy: 'bg-accent text-primary', warn: 'bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300', error: 'bg-red-100 dark:bg-red-500/20 text-destructive', idle: 'bg-muted text-muted-foreground',
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
