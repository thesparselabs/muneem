import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { X } from 'lucide-react';
import { useTour } from './TourProvider.js';
import { useTargetRect } from './useTargetRect.js';
import { placeCard } from './placement.js';

const CARD_W = 340;

export default function TourOverlay() {
  const { running, step, target, index, total, next, back, stop } = useTour();
  const reduce = useReducedMotion();
  const rect = useTargetRect(target);
  const cardRef = useRef<HTMLDivElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const [cardH, setCardH] = useState(220);
  const [vp, setVp] = useState({ w: window.innerWidth, h: window.innerHeight });

  useEffect(() => {
    const on = () => setVp({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  useLayoutEffect(() => { if (cardRef.current) setCardH(cardRef.current.offsetHeight); }, [step, rect]);
  useEffect(() => { if (step) nextRef.current?.focus(); }, [step]);

  if (!running || !step) return null;
  const pos = placeCard(rect, { width: Math.min(CARD_W, vp.w - 32), height: cardH }, vp.w, vp.h);
  const dur = reduce ? 0 : 0.22;
  const last = index === total - 1;

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') { e.stopPropagation(); stop(); }
    else if (e.key === 'ArrowRight') next();
    else if (e.key === 'ArrowLeft') back();
    else if (e.key === 'Tab') {
      const f = cardRef.current?.querySelectorAll<HTMLElement>('button');
      if (!f?.length) return;
      const first = f[0]!, end = f[f.length - 1]!;
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); end.focus(); }
      else if (!e.shiftKey && document.activeElement === end) { e.preventDefault(); first.focus(); }
    }
  };

  return (
    <div className="fixed inset-0 z-[60] print:hidden" onKeyDown={onKeyDown}>
      <div className="absolute inset-0" aria-hidden onClick={stop} style={rect ? undefined : { background: 'rgba(0,0,0,0.55)' }} />
      {rect && (
        <motion.div
          aria-hidden
          className="pointer-events-none absolute rounded-lg ring-2 ring-ring"
          initial={false}
          animate={{ top: rect.top, left: rect.left, width: rect.width, height: rect.height }}
          transition={{ duration: dur, ease: 'easeOut' }}
          style={{ boxShadow: '0 0 0 9999px rgba(0,0,0,0.55)' }}
        />
      )}
      <AnimatePresence mode="wait">
        <motion.div
          key={step.id}
          ref={cardRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="tour-title"
          aria-describedby="tour-body"
          className="absolute rounded-xl border border-border bg-card p-4 text-foreground shadow-xl"
          style={{ top: pos.top, left: pos.left, width: Math.min(CARD_W, vp.w - 32) }}
          initial={{ opacity: 0, y: reduce ? 0 : 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: dur }}
        >
          <div className="flex items-start justify-between gap-2">
            <h2 id="tour-title" className="text-base font-semibold">{step.title}</h2>
            <button type="button" onClick={stop} aria-label="Close tour" className="rounded p-1 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <X size={16} aria-hidden />
            </button>
          </div>
          <p id="tour-body" className="mt-2 text-sm text-muted-foreground">{step.body}</p>
          <div className="mt-4 flex items-center justify-between">
            <span className="text-xs text-muted-foreground" aria-live="polite">{index + 1} / {total}</span>
            <div className="flex items-center gap-2">
              {!last && <button type="button" onClick={stop} className="rounded px-2 py-1 text-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Skip</button>}
              {index > 0 && <button type="button" onClick={back} className="rounded border border-border px-3 py-1 text-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Back</button>}
              <button ref={nextRef} type="button" onClick={next} className="rounded bg-primary px-3 py-1 text-sm font-medium text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{last ? 'Finish' : 'Next'}</button>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
