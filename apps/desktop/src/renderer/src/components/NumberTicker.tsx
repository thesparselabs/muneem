import { useEffect, useRef, useState } from 'react';
import { animate } from 'motion/react';
import { MOTION_BASE, usePrefersReducedMotion } from '../lib/motion.js';

// A value that counts to its target. The label reads the final value so screen readers skip the in-between frames.
export default function NumberTicker({ value, format = (n) => String(Math.round(n)), className }:
  { value: number; format?: (n: number) => string; className?: string }) {
  const reduce = usePrefersReducedMotion();
  const [display, setDisplay] = useState(value);
  const prev = useRef(value);
  useEffect(() => {
    if (reduce || prev.current === value) { setDisplay(value); prev.current = value; return; }
    const controls = animate(prev.current, value, { duration: MOTION_BASE, ease: 'easeOut', onUpdate: setDisplay });
    prev.current = value;
    return () => controls.stop();
  }, [value, reduce]);
  return <span className={className} aria-label={format(value)}>{format(display)}</span>;
}
