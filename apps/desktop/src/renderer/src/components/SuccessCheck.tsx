import { motion } from 'motion/react';
import { usePrefersReducedMotion } from '../lib/motion.js';

// Confirms a completed action (payment taken). Draws the ring then the tick; static under reduced motion.
export default function SuccessCheck({ size = 48, className }: { size?: number; className?: string }) {
  const reduce = usePrefersReducedMotion();
  return (
    <svg width={size} height={size} viewBox="0 0 52 52" className={className} role="img" aria-label="Done">
      <motion.circle cx="26" cy="26" r="24" fill="none" stroke="#16a34a" strokeWidth="2.5"
        initial={reduce ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.3, ease: 'easeOut' }} />
      <motion.path d="M16 27 l7 7 l14 -15" fill="none" stroke="#16a34a" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
        initial={reduce ? false : { pathLength: 0 }} animate={{ pathLength: 1 }}
        transition={{ duration: 0.25, ease: 'easeOut', delay: reduce ? 0 : 0.25 }} />
    </svg>
  );
}
