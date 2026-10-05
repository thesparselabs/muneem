import { useEffect, useState } from 'react';
import type { Box } from './placement.js';

const PAD = 6;

function measure(el: HTMLElement): Box {
  const r = el.getBoundingClientRect();
  const top = Math.max(0, r.top - PAD);
  const left = Math.max(0, r.left - PAD);
  const bottom = Math.min(window.innerHeight, r.bottom + PAD);
  const right = Math.min(window.innerWidth, r.right + PAD);
  return { top, left, width: Math.max(0, right - left), height: Math.max(0, bottom - top) };
}

export function useTargetRect(el: HTMLElement | null): Box | null {
  const [box, setBox] = useState<Box | null>(null);
  useEffect(() => {
    if (!el) { setBox(null); return; }
    let raf = 0;
    const update = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => setBox(measure(el))); };
    setBox(measure(el));
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    const ro = new ResizeObserver(update);
    ro.observe(el);
    const settle = window.setTimeout(update, 250);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(settle);
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
      ro.disconnect();
    };
  }, [el]);
  return box;
}
