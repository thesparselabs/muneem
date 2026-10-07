import { AnimatePresence, motion } from 'motion/react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { MOTION_FAST, usePrefersReducedMotion } from '../lib/motion.js';
import { useToasts, type ToastVariant } from '../lib/toast.js';

const ICON = { success: CheckCircle2, error: AlertCircle, info: Info };
const TONE: Record<ToastVariant, string> = {
  success: 'border-green-200 text-green-800 dark:text-green-400', error: 'border-red-200 text-destructive', info: 'border-border text-foreground',
};

export default function ToastViewport() {
  const { toasts, dismiss } = useToasts();
  const reduce = usePrefersReducedMotion();
  return (
    <div className="pointer-events-none fixed bottom-20 right-5 z-50 flex w-80 flex-col gap-2 print:hidden" role="region" aria-label="Notifications" aria-live="polite" aria-atomic="false">
      <AnimatePresence initial={false}>
        {toasts.map((t) => {
          const Icon = ICON[t.variant];
          return (
            <motion.div key={t.id} layout={!reduce}
              initial={reduce ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }} transition={{ duration: MOTION_FAST, ease: 'easeOut' }}
              className={`pointer-events-auto flex items-start gap-2 rounded-lg border bg-card px-3 py-2 text-sm shadow-sm ${TONE[t.variant]}`}>
              <Icon size={16} className="mt-0.5 shrink-0" aria-hidden />
              <span className="flex-1">{t.message}</span>
              <button onClick={() => dismiss(t.id)} aria-label="Dismiss" title="Dismiss" className="shrink-0 text-muted-foreground hover:text-foreground"><X size={14} aria-hidden /></button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
