// The Muneem mark: an M struck through like a currency sign. Colours are the theme's teal and lilac, fixed so it matches the app icon.
export function LogoMark({ size = 40, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" className={className} role="img" aria-label="Muneem">
      <defs>
        <linearGradient id="muneem-badge" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
          <stop stopColor="#127367" />
          <stop offset="1" stopColor="#003a32" />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="10" fill="url(#muneem-badge)" />
      <rect x="0.5" y="0.5" width="39" height="39" rx="9.5" fill="none" stroke="#ffffff" strokeOpacity="0.14" />
      <path d="M20 7.5v25" fill="none" stroke="#f0d7ff" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M11.5 27.5v-15l8.5 9.5 8.5-9.5v15" fill="none" stroke="#ffffff" strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round" />
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
