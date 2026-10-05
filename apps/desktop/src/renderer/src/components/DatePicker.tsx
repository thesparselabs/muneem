import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '../lib/cn.js';
import { MOTION_FAST, usePrefersReducedMotion } from '../lib/motion.js';

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const parse = (v: string): Date | null => { const m = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(v); return m ? new Date(+m[1]!, +m[2]! - 1, +m[3]!) : null; };
const pretty = (v: string): string => { const d = parse(v); return d ? d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : ''; };

// A calendar popover that stands in for <input type="date">: value is a YYYY-MM-DD string; onChange gives the same.
export default function DatePicker({ id, value, onChange, max, min, required, className, 'aria-label': ariaLabel }:
  { id?: string; value: string; onChange: (v: string) => void; max?: string; min?: string; required?: boolean; className?: string; 'aria-label'?: string }) {
  const reduce = usePrefersReducedMotion();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(() => parse(value) ?? new Date());
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => { const d = parse(value); if (d) setView(d); }, [value]);
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e: MouseEvent) => { if (root.current && !root.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown); document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  const selected = parse(value);
  const first = new Date(view.getFullYear(), view.getMonth(), 1);
  const lead = first.getDay();
  const days = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
  const cells: (Date | null)[] = [...Array(lead).fill(null), ...Array.from({ length: days }, (_, i) => new Date(view.getFullYear(), view.getMonth(), i + 1))];
  const outOfRange = (d: Date) => (max && iso(d) > max) || (min && iso(d) < min);

  return (
    <div ref={root} className={cn('relative', className)}>
      <button type="button" id={id} aria-label={ariaLabel} onClick={() => setOpen((o) => !o)} aria-haspopup="dialog" aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 rounded-lg border border-input bg-card px-3 py-2 text-left text-sm transition-colors hover:border-input focus:border-primary focus:ring-2 focus:ring-primary/15">
        <span className={value ? '' : 'text-muted-foreground'}>{value ? pretty(value) : 'Select a date'}</span>
        <CalendarDays size={16} className="shrink-0 text-muted-foreground" aria-hidden />
        {required && <input tabIndex={-1} aria-hidden required value={value} onChange={() => undefined} className="sr-only" />}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div role="dialog" aria-label="Choose a date"
            initial={reduce ? false : { opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={reduce ? { opacity: 0 } : { opacity: 0, y: -4 }}
            transition={{ duration: MOTION_FAST }}
            className="absolute z-30 mt-1 w-64 rounded-xl border border-border bg-card p-3 shadow-lg">
            <div className="mb-2 flex items-center justify-between">
              <button type="button" className="btn-ghost p-1" aria-label="Previous month" onClick={() => setView(new Date(view.getFullYear(), view.getMonth() - 1, 1))}><ChevronLeft size={16} /></button>
              <span className="text-sm font-semibold">{MONTHS[view.getMonth()]} {view.getFullYear()}</span>
              <button type="button" className="btn-ghost p-1" aria-label="Next month" onClick={() => setView(new Date(view.getFullYear(), view.getMonth() + 1, 1))}><ChevronRight size={16} /></button>
            </div>
            <div className="grid grid-cols-7 gap-0.5 text-center text-xs text-muted-foreground">{WEEKDAYS.map((w) => <span key={w} className="py-1">{w}</span>)}</div>
            <div className="grid grid-cols-7 gap-0.5">
              {cells.map((d, i) => d === null ? <span key={`e${i}`} /> : (
                <button key={iso(d)} type="button" disabled={!!outOfRange(d)}
                  onClick={() => { onChange(iso(d)); setOpen(false); }}
                  aria-current={selected && iso(d) === iso(selected) ? 'date' : undefined}
                  className={cn('rounded-md py-1.5 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-40',
                    selected && iso(d) === iso(selected) ? 'bg-primary font-semibold text-primary-foreground' : 'hover:bg-accent')}>{d.getDate()}</button>
              ))}
            </div>
            <div className="mt-2 flex justify-between border-t border-border pt-2 text-xs">
              <button type="button" className="text-primary hover:underline" onClick={() => { onChange(iso(new Date())); setOpen(false); }}>Today</button>
              {!required && value && <button type="button" className="text-muted-foreground hover:underline" onClick={() => { onChange(''); setOpen(false); }}>Clear</button>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
