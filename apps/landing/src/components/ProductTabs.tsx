import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { AppWindow, Panel } from './ProductMock.tsx';
import Reveal from './Reveal.tsx';
import { TABS, type TabId } from '../site.ts';
import { EASE, usePrefersReducedMotion } from '../lib/motion.ts';

export default function ProductTabs() {
  const [active, setActive] = useState<TabId>('billing');
  const reduce = usePrefersReducedMotion();
  return (
    <section id="product" className="relative overflow-hidden py-20 sm:py-28">
      <div className="glow top-10 left-0 h-[300px] w-[300px] bg-primary/10" />
      <div className="container-x relative">
        <Reveal className="mx-auto max-w-2xl text-center">
          <span className="eyebrow">See it in action</span>
          <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">The product does the talking</h2>
          <p className="mt-3 text-ink-soft">Every screen is keyboard-first and quick. Switch through the parts of a working day.</p>
        </Reveal>

        <div role="tablist" aria-label="Product screens" className="mx-auto mt-10 flex max-w-md flex-wrap justify-center gap-1 rounded-full border border-line bg-white p-1">
          {TABS.map((t) => {
            const on = t.id === active;
            return (
              <button key={t.id} role="tab" aria-selected={on} onClick={() => setActive(t.id)}
                className={`relative rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${on ? 'text-white' : 'text-ink-soft hover:text-ink'}`}>
                {on && <motion.span layoutId="tab-pill" className="absolute inset-0 rounded-full bg-primary" transition={{ type: 'spring', stiffness: 400, damping: 32 }} />}
                <span className="relative">{t.label}</span>
              </button>
            );
          })}
        </div>

        <div className="mx-auto mt-8 max-w-4xl">
          <AnimatePresence mode="wait">
            <motion.div key={active}
              initial={reduce ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={reduce ? { opacity: 0 } : { opacity: 0, y: -10 }}
              transition={{ duration: 0.28, ease: EASE }}>
              <AppWindow active={active}><Panel id={active} /></AppWindow>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
