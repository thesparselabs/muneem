const DECIMAL = /^(-)?(\d*)(?:\.(\d*))?$/;

// "₹1,234.50" at scale 2 → 123450, using string digits only so no float ever touches money.
export function parseScaled(text: string, scale: number): number | null {
  const cleaned = text.replace(/[₹,\s%]/gu, '').replace(/^rs\.?/iu, '');
  const m = DECIMAL.exec(cleaned);
  if (!m || (m[2] === '' && (m[3] ?? '') === '')) return null;
  const whole = m[2] || '0';
  const fraction = m[3] ?? '';
  if (fraction.length > scale && /[1-9]/.test(fraction.slice(scale))) return null;
  const value = Number(whole + fraction.slice(0, scale).padEnd(scale, '0'));
  if (!Number.isSafeInteger(value)) return null;
  return m[1] ? -value : value;
}
