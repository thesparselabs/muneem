import { BRAND } from '../site.ts';

export function LogoMark({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" className={className} role="img" aria-label={BRAND}>
      <defs>
        <linearGradient id="muneem-badge" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
          <stop stopColor="#8b5cf6" />
          <stop offset="1" stopColor="#5b21b6" />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="11" fill="url(#muneem-badge)" />
      <rect x="11.5" y="21" width="4" height="7.5" rx="2" fill="#ffffff" fillOpacity="0.72" />
      <rect x="18" y="17" width="4" height="11.5" rx="2" fill="#ffffff" fillOpacity="0.86" />
      <rect x="24.5" y="12" width="4" height="16.5" rx="2" fill="#fbbf24" />
      <path d="M11 30.5 h18" stroke="#ffffff" strokeOpacity="0.55" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export default function Logo({ size = 30 }: { size?: number }) {
  return (
    <span className="inline-flex items-center gap-2">
      <LogoMark size={size} />
      <span className="text-lg font-bold tracking-tight">{BRAND}</span>
    </span>
  );
}
