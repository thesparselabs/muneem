const DECIMAL = /^(-)?(\d*)(?:\.(\d*))?$/;

// "₹1,234.50" at scale 2 → 123450, using string digits only so no float ever touches money.
// Commas are only thousands grouping, Indian (1,23,456) or international (123,456); "10,5" is a mistake, not 10.5.
const GROUPED = /^-?\d{1,3}((,\d{2})*,\d{3}|(,\d{3})+)(\.\d*)?$/u;

export function parseScaled(text: string, scale: number): number | null {
  const bare = text.replace(/[₹\s%]/gu, '').replace(/^rs\.?/iu, '');
  if (bare.includes(',') && !GROUPED.test(bare)) return null;
  const cleaned = bare.replace(/,/gu, '');
  const m = DECIMAL.exec(cleaned);
  if (!m || (m[2] === '' && (m[3] ?? '') === '')) return null;
  const whole = m[2] || '0';
  const fraction = m[3] ?? '';
  if (fraction.length > scale && /[1-9]/.test(fraction.slice(scale))) return null;
  const value = Number(whole + fraction.slice(0, scale).padEnd(scale, '0'));
  if (!Number.isSafeInteger(value)) return null;
  return m[1] ? -value : value;
}
