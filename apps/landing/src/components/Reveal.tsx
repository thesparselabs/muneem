import type { ReactNode } from 'react';
import { motion } from 'motion/react';
import { fadeUp, stagger } from '../lib/motion.ts';

// A section that fades its children up as it enters the viewport; set `group` to stagger the children.
export default function Reveal({ children, className, group = false, as = 'div', id }:
  { children: ReactNode; className?: string; group?: boolean; as?: 'div' | 'section'; id?: string }) {
  const Tag = as === 'section' ? motion.section : motion.div;
  return (
    <Tag id={id} className={className} variants={group ? stagger : fadeUp}
      initial="hidden" whileInView="show" viewport={{ once: true, margin: '-10% 0px' }}>
      {children}
    </Tag>
  );
}

export function RevealItem({ children, className }: { children: ReactNode; className?: string }) {
  return <motion.div variants={fadeUp} className={className}>{children}</motion.div>;
}
