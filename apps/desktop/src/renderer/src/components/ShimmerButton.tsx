import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '../lib/cn.js';

// The one accent CTA (Take payment). A slow sheen crosses the primary button; the sheen is decorative and the
// global reduced-motion floor stops it.
const ShimmerButton = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement>>(
  ({ className, children, ...props }, ref) => (
    <button ref={ref} {...props} className={cn('btn-primary relative isolate overflow-hidden', className)}>
      <span aria-hidden
        className="pointer-events-none absolute inset-0 -translate-x-full animate-[shimmer_2.6s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-white/25 to-transparent" />
      <span className="relative">{children}</span>
    </button>
  ),
);
ShimmerButton.displayName = 'ShimmerButton';
export default ShimmerButton;
