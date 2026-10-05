import type { Variants } from 'motion/react';
import { useReducedMotion } from 'motion/react';

export const EASE = [0.22, 1, 0.36, 1] as const;

export function usePrefersReducedMotion(): boolean {
  return useReducedMotion() ?? false;
}

// A fade-up used by every scroll reveal; distance and duration stay small.
export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE } },
};

// A parent that staggers its children's reveals.
export const stagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
};
