import { motion } from 'motion/react';
import { ArrowRight, CloudOff, FileCheck2, IndianRupee, Sparkles } from 'lucide-react';
import { AppWindow, DashboardPanel } from './ProductMock.tsx';
import { BRAND } from '../site.ts';
import { EASE } from '../lib/motion.ts';

const BADGES = [
  { icon: FileCheck2, label: 'GST-ready' },
  { icon: CloudOff, label: 'Works offline' },
  { icon: IndianRupee, label: 'Made in India' },
];

export default function Hero() {
  return (
    <section id="top" className="grain relative overflow-hidden pt-32 pb-16 sm:pt-36">
      <div className="glow -top-24 left-1/2 h-[420px] w-[720px] -translate-x-1/2 bg-primary/15" />
      <div className="glow top-40 right-0 h-[320px] w-[320px] bg-accent/10" />
      <div className="container-x relative">
        <motion.div className="mx-auto max-w-3xl text-center"
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: EASE }}>
          <span className="eyebrow"><Sparkles size={13} className="text-primary" /> {BRAND} for retail & distribution</span>
          <h1 className="mt-5 text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl">
            The fast way to bill,<br className="hidden sm:block" /> and keep <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">perfect books</span>.
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-base text-ink-soft sm:text-lg">
            {BRAND} runs your counter and your accounts in one place — GST invoices, inventory, udhaar and reports — fast, offline, and built for Indian shops.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <a href="#download" className="btn-primary w-full sm:w-auto">Get started free <ArrowRight size={16} /></a>
            <a href="#product" className="btn-ghost w-full sm:w-auto">See the product</a>
          </div>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs font-medium text-muted">
            {BADGES.map((b) => <span key={b.label} className="inline-flex items-center gap-1.5"><b.icon size={14} className="text-accent" /> {b.label}</span>)}
          </div>
        </motion.div>

        <motion.div className="relative mx-auto mt-14 max-w-4xl"
          initial={{ opacity: 0, y: 36 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.15, ease: EASE }}>
          <div className="animate-float">
            <AppWindow active="dashboard"><DashboardPanel /></AppWindow>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
