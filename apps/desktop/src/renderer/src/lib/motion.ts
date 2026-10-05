import { useReducedMotion } from 'motion/react';

export const MOTION_FAST = 0.14;
export const MOTION_BASE = 0.2;

// A single switch for the whole renderer: honour the OS setting, and let a test or kiosk force it off.
export function usePrefersReducedMotion(): boolean {
  const system = useReducedMotion() ?? false;
  return system || document.documentElement.dataset.reduceMotion === 'true';
}
