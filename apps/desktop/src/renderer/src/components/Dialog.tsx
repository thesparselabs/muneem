import { useEffect, useRef, type ReactNode } from 'react';

export default function Dialog({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    panel.current?.querySelector<HTMLElement>('input, select, button')?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40" role="presentation">
      <div ref={panel} role="dialog" aria-modal="true" aria-label={title} className={`card max-h-[90vh] overflow-auto ${wide ? 'w-[720px]' : 'w-[460px]'}`}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button type="button" className="btn-secondary py-1" onClick={onClose} aria-label="Close">Esc</button>
        </div>
        {children}
      </div>
    </div>
  );
}
