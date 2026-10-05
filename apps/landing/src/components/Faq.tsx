import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Plus } from 'lucide-react';
import Reveal from './Reveal.tsx';
import { FAQS } from '../site.ts';
import { EASE, usePrefersReducedMotion } from '../lib/motion.ts';

export default function Faq() {
  const [open, setOpen] = useState<number | null>(0);
  const reduce = usePrefersReducedMotion();
  return (
    <section id="faq" className="py-20 sm:py-28">
      <div className="container-x max-w-3xl">
        <Reveal className="text-center">
          <span className="eyebrow">Questions</span>
          <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">Good to know</h2>
        </Reveal>
        <div className="mt-10 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-white">
          {FAQS.map((f, i) => {
            const on = open === i;
            return (
              <div key={f.q}>
                <button onClick={() => setOpen(on ? null : i)} aria-expanded={on}
                  className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left">
                  <span className="font-medium">{f.q}</span>
                  <Plus size={18} className={`shrink-0 text-muted transition-transform duration-200 ${on ? 'rotate-45' : ''}`} />
                </button>
                <AnimatePresence initial={false}>
                  {on && (
                    <motion.div key="body"
                      initial={reduce ? { opacity: 1 } : { height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
                      transition={{ duration: 0.26, ease: EASE }} className="overflow-hidden">
                      <p className="px-5 pb-4 text-sm leading-relaxed text-ink-soft">{f.a}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
