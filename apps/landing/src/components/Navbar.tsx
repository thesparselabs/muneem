import { useEffect, useState } from 'react';
import { cn } from '../lib/cn.ts';
import { NAV } from '../site.ts';
import Logo from './Logo.tsx';
import ThemeToggle from './ThemeToggle.tsx';

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header className={cn('fixed inset-x-0 top-0 z-50 transition-all duration-300',
      scrolled ? 'border-b border-line bg-card/80 backdrop-blur-md shadow-[0_1px_0_rgba(14,15,26,0.04)]' : 'border-b border-transparent bg-transparent')}>
      <nav className="container-x flex h-16 items-center justify-between">
        <a href="#top" aria-label="Lekha home"><Logo /></a>
        <div className="hidden items-center gap-8 md:flex">
          {NAV.map((n) => <a key={n.href} href={n.href} className="text-sm font-medium text-ink-soft transition-colors hover:text-ink">{n.label}</a>)}
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <a href="#download" className="btn-ghost hidden sm:inline-flex">Sign in</a>
          <a href="#download" className="btn-primary">Get started</a>
        </div>
      </nav>
    </header>
  );
}
