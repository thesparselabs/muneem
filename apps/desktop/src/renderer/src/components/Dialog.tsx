import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

// Focus starts in the body, on a field that takes typing, so Enter submits the dialog's form instead of pressing Close.
const FIRST_FIELD = 'input:not([type=radio]):not([type=checkbox]):not(:disabled), select:not(:disabled), textarea, button:not(:disabled)';

export default function Dialog({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  const body = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    body.current?.querySelector<HTMLElement>(FIRST_FIELD)?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); close.current(); } };
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      if (opener?.isConnected) opener.focus();
    };
  }, []);
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50" role="presentation">
      <div role="dialog" aria-modal="true" aria-label={title} className={`card max-h-[90vh] overflow-auto ${wide ? 'w-[min(880px,94vw)]' : 'w-[460px]'}`}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button type="button" className="btn-ghost p-1.5" onClick={onClose} aria-label="Close" title="Close (Esc)"><X size={18} aria-hidden /></button>
        </div>
        <div ref={body}>{children}</div>
      </div>
    </div>
  );
}
