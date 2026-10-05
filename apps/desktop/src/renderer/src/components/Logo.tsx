// The Muneem mark: a rounded gradient badge with three rising bars (a shop's growth) over a ledger baseline,
// and a rupee stroke. Geometric so it stays crisp from a 16px favicon to the login screen.
export function LogoMark({ size = 40, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" className={className} role="img" aria-label="Muneem">
      <defs>
        <linearGradient id="muneem-badge" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
          <stop stopColor="#2563eb" />
          <stop offset="1" stopColor="#1d4ed8" />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="11" fill="url(#muneem-badge)" />
      <rect x="11.5" y="21" width="4" height="7.5" rx="2" fill="#ffffff" fillOpacity="0.72" />
      <rect x="18" y="17" width="4" height="11.5" rx="2" fill="#ffffff" fillOpacity="0.86" />
      <rect x="24.5" y="12" width="4" height="16.5" rx="2" fill="#ffffff" />
      <path d="M11 30.5 h18" stroke="#ffffff" strokeOpacity="0.55" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M12.5 11 h7 M12.5 14 h7 M19 11 c0 3.4 -2.6 3.4 -5 3.4 l4.4 3.6" stroke="#ffffff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

export default function Logo({ size = 40, className, wordmark = true }: { size?: number; className?: string; wordmark?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className ?? ''}`}>
      <LogoMark size={size} />
      {wordmark && <span className="font-semibold tracking-tight" style={{ fontSize: size * 0.6 }}>Muneem</span>}
    </span>
  );
}
