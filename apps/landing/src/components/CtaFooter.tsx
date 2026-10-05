import { ArrowRight } from 'lucide-react';
import Reveal from './Reveal.tsx';
import { LogoMark } from './Logo.tsx';
import { BRAND, NAV } from '../site.ts';

export function Cta() {
  return (
    <section id="download" className="py-12 sm:py-16">
      <div className="container-x">
        <Reveal className="relative overflow-hidden rounded-3xl border border-line bg-cta px-6 py-14 text-center text-white sm:px-12">
          <span className="glow -top-20 left-1/2 h-72 w-[520px] -translate-x-1/2 bg-primary/40" />
          <div className="relative">
            <h2 className="mx-auto max-w-2xl text-3xl font-bold tracking-tight sm:text-4xl">Run your shop on {BRAND}</h2>
            <p className="mx-auto mt-3 max-w-md text-white/70">Set up in minutes. Works offline from day one. Your books stay on your computer.</p>
            <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <a href="#" className="btn-primary w-full sm:w-auto">Download for Windows <ArrowRight size={16} /></a>
              <a href="#" className="btn w-full border border-white/20 bg-white/5 text-white hover:bg-white/10 sm:w-auto">Talk to us</a>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="border-t border-line py-10">
      <div className="container-x flex flex-col items-center justify-between gap-6 sm:flex-row">
        <div className="flex items-center gap-2"><LogoMark size={26} /><span className="text-sm font-bold tracking-tight">{BRAND}</span></div>
        <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-ink-soft">
          {NAV.map((n) => <a key={n.href} href={n.href} className="transition-colors hover:text-ink">{n.label}</a>)}
        </nav>
        <p className="text-xs text-muted">© {new Date().getFullYear()} {BRAND}. Made in India.</p>
      </div>
    </footer>
  );
}
