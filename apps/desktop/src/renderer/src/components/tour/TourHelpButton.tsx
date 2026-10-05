import { useEffect, useRef, useState } from 'react';
import { BookOpen, HelpCircle, PlayCircle } from 'lucide-react';
import { useTour } from './TourProvider.js';
import { useHelp } from '../../lib/help/useHelp.js';

export default function TourHelpButton() {
  const { running, start } = useTour();
  const { open: drawerOpen, openHelp } = useHelp();
  const [menu, setMenu] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menu) return undefined;
    const onDown = (e: MouseEvent) => { if (!root.current?.contains(e.target as Node)) setMenu(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenu(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [menu]);

  if (running || drawerOpen) return null;
  const item = 'flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-foreground hover:bg-muted focus-visible:bg-muted focus-visible:outline-none';
  return (
    <div ref={root} className="fixed bottom-5 right-5 z-40 print:hidden">
      {menu && (
        <div role="menu" aria-label="Help" className="absolute bottom-14 right-0 w-48 rounded-lg border border-border bg-popover p-1 shadow-lg">
          <button type="button" role="menuitem" className={item} onClick={() => { setMenu(false); openHelp(); }}><BookOpen size={16} aria-hidden />User manual</button>
          <button type="button" role="menuitem" className={item} onClick={() => { setMenu(false); start(); }}><PlayCircle size={16} aria-hidden />Take a tour</button>
        </div>
      )}
      <button
        type="button"
        onClick={() => setMenu((m) => !m)}
        aria-label="Help"
        aria-haspopup="menu"
        aria-expanded={menu}
        title="Help"
        className="flex h-11 w-11 items-center justify-center rounded-full border border-border bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <HelpCircle size={20} aria-hidden />
      </button>
    </div>
  );
}
