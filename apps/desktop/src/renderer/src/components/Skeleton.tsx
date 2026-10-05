import { cn } from '../lib/cn.js';

// A loading placeholder. The pulse stops under reduced motion via the global floor in styles.css.
export default function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-md bg-muted-foreground/15', className)} aria-hidden />;
}
