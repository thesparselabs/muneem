import { useRef, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { cn } from '../lib/cn.js';

const HOLD_MS = 700;

// Press and hold to confirm a destructive action; the hold itself is the confirmation (works with or without motion).
export default function HoldToDelete({ onConfirm, label = 'Hold to delete', className, disabled }:
  { onConfirm: () => void; label?: string; className?: string; disabled?: boolean }) {
  const [progress, setProgress] = useState(0);
  const raf = useRef<number | null>(null);
  const started = useRef(0);

  const stop = () => { if (raf.current) cancelAnimationFrame(raf.current); raf.current = null; setProgress(0); };
  const tick = (now: number) => {
    const p = Math.min(1, (now - started.current) / HOLD_MS);
    setProgress(p);
    if (p >= 1) { raf.current = null; setProgress(0); onConfirm(); return; }
    raf.current = requestAnimationFrame(tick);
  };
  const begin = () => { if (disabled || raf.current) return; started.current = performance.now(); raf.current = requestAnimationFrame(tick); };

  return (
    <button type="button" disabled={disabled} aria-label={label}
      onPointerDown={begin} onPointerUp={stop} onPointerLeave={stop}
      onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) { e.preventDefault(); begin(); } }}
      onKeyUp={(e) => { if (e.key === 'Enter' || e.key === ' ') stop(); }}
      className={cn('relative overflow-hidden rounded-md border border-red-300 px-4 py-2 text-sm font-medium text-destructive disabled:opacity-50', className)}>
      <span className="absolute inset-y-0 left-0 bg-red-100 dark:bg-red-500/20" style={{ width: `${progress * 100}%` }} aria-hidden />
      <span className="relative inline-flex items-center gap-1.5"><Trash2 size={14} aria-hidden /> {label}</span>
    </button>
  );
}
