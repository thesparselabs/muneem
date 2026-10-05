import { cn } from '../lib/cn.js';

// A loading placeholder. The pulse stops under reduced motion via the global floor in styles.css.
export default function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-md bg-slate-200/70', className)} aria-hidden />;
}
