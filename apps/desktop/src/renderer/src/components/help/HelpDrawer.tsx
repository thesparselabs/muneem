import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { PlayCircle, X } from 'lucide-react';
import { cn } from '../../lib/cn.js';
import { helpFor, type HelpLang } from '../../lib/help/content.js';
import { useHelp } from '../../lib/help/useHelp.js';
import { useHelpLang } from '../../lib/help/useHelpLang.js';
import { useTour } from '../tour/TourProvider.js';

const LABELS: Record<HelpLang, { what: string; how: string; keys: string; tour: string; close: string }> = {
  en: { what: 'What this is for', how: 'How it works', keys: 'Shortcuts', tour: 'Show me (guided tour)', close: 'Close help' },
  hi: { what: 'यह किसलिए है', how: 'कैसे काम करता है', keys: 'शॉर्टकट', tour: 'मुझे दिखाइए (गाइडेड टूर)', close: 'सहायता बंद करें' },
};

const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

export default function HelpDrawer() {
  const { open, closeHelp } = useHelp();
  const { start } = useTour();
  const { pathname } = useLocation();
  const [lang, setLang] = useHelpLang();
  const reduce = useReducedMotion();
  const panel = useRef<HTMLDivElement>(null);
  const entry = helpFor(pathname, lang);
  const t = LABELS[lang];

  useEffect(() => {
    if (!open) return undefined;
    const prev = document.activeElement as HTMLElement | null;
    panel.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); closeHelp(); return; }
      if (e.key !== 'Tab' || !panel.current) return;
      const items = [...panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
      const first = items[0];
      const last = items[items.length - 1];
      if (!first || !last) return;
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    window.addEventListener('keydown', onKey, true);
    return () => { window.removeEventListener('keydown', onKey, true); prev?.focus(); };
  }, [open, closeHelp]);

  useEffect(() => { if (open) closeHelp(); }, [pathname]);

  const dur = reduce ? 0 : 0.22;
  return (
    <AnimatePresence>
      {open && (
        <div className="print:hidden">
          <motion.div
            className="fixed inset-0 z-50 bg-black/30"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: dur }}
            onClick={closeHelp} aria-hidden
          />
          <motion.aside
            ref={panel}
            role="dialog" aria-modal="true" aria-labelledby="help-title"
            className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-border bg-popover text-foreground shadow-2xl"
            initial={reduce ? { opacity: 0 } : { x: '100%' }} animate={reduce ? { opacity: 1 } : { x: 0 }} exit={reduce ? { opacity: 0 } : { x: '100%' }}
            transition={{ duration: dur, ease: 'easeOut' }}
          >
            <header className="flex items-center gap-2 border-b border-border px-5 py-3">
              <h2 id="help-title" className="flex-1 truncate text-lg font-semibold">{entry.title}</h2>
              <div role="group" aria-label="Language" className="flex overflow-hidden rounded-md border border-border text-xs">
                {(['en', 'hi'] as const).map((l) => (
                  <button
                    key={l} type="button" aria-pressed={lang === l} onClick={() => setLang(l)}
                    className={cn('px-2.5 py-1 transition-colors', lang === l ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:bg-muted')}
                  >{l === 'en' ? 'EN' : 'हिंदी'}</button>
                ))}
              </div>
              <button type="button" onClick={closeHelp} aria-label={t.close} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground">
                <X size={18} aria-hidden />
              </button>
            </header>
            <div className="flex-1 space-y-6 overflow-y-auto px-5 py-4">
              <section>
                <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t.what}</h3>
                <p className="text-sm leading-relaxed">{entry.whatFor}</p>
              </section>
              <section>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t.how}</h3>
                <ol className="space-y-2.5">
                  {entry.howItWorks.map((s, i) => (
                    <li key={i} className="flex gap-3 text-sm leading-relaxed">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">{i + 1}</span>
                      <span>{s}</span>
                    </li>
                  ))}
                </ol>
              </section>
              {entry.shortcuts && entry.shortcuts.length > 0 && (
                <section>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t.keys}</h3>
                  <ul className="space-y-1.5">
                    {entry.shortcuts.map((s) => (
                      <li key={s.keys} className="flex items-center gap-3 text-sm">
                        <kbd className="min-w-10 rounded border border-border bg-muted px-2 py-0.5 text-center font-mono text-xs text-foreground">{s.keys}</kbd>
                        <span className="text-muted-foreground">{s.does}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </div>
            <footer className="border-t border-border px-5 py-3">
              <button
                type="button"
                onClick={() => { closeHelp(); start(); }}
                className="flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              ><PlayCircle size={16} aria-hidden />{t.tour}</button>
            </footer>
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );
}
