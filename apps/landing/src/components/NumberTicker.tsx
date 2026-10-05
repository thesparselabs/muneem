import { useEffect, useRef, useState } from 'react';
import { animate, useInView } from 'motion/react';
import { usePrefersReducedMotion } from '../lib/motion.ts';

// Counts to its value the first time it scrolls into view. The label carries the final value for screen readers.
export default function NumberTicker({ value, format = (n) => String(Math.round(n)), className }:
  { value: number; format?: (n: number) => string; className?: string }) {
  const reduce = usePrefersReducedMotion();
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: '-15% 0px' });
  const [display, setDisplay] = useState(reduce ? value : 0);

  useEffect(() => {
    if (!inView || reduce) { setDisplay(value); return; }
    const controls = animate(0, value, { duration: 1.1, ease: [0.22, 1, 0.36, 1], onUpdate: setDisplay });
    return () => controls.stop();
  }, [inView, value, reduce]);

  return <span ref={ref} className={className} aria-label={format(value)}>{format(display)}</span>;
}
