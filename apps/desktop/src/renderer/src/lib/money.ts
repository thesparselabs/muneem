import { parseScaled } from '@muneem/domain';

const grouping = new Intl.NumberFormat('en-IN');

export function formatPaise(paise: number | null | undefined): string {
  if (paise === null || paise === undefined) return '—';
  const sign = paise < 0 ? '-' : '';
  const abs = Math.abs(paise);
  return `${sign}₹${grouping.format(Math.trunc(abs / 100))}.${String(abs % 100).padStart(2, '0')}`;
}

export const paiseToText = (paise: number | undefined): string =>
  paise === undefined ? '' : `${Math.trunc(paise / 100)}.${String(paise % 100).padStart(2, '0')}`;

export const scaledToText = (value: number | undefined, scale: number): string => {
  if (value === undefined) return '';
  const unit = 10 ** scale;
  const fraction = String(value % unit).padStart(scale, '0').replace(/0+$/u, '');
  return fraction ? `${Math.trunc(value / unit)}.${fraction}` : String(Math.trunc(value / unit));
};

export const formatRateBp = (bp: number): string => `${scaledToText(bp, 2)}%`;

// '' → undefined (field left empty); anything unparseable → null so the form can show an error.
export function parseOptional(text: string, scale: number): number | undefined | null {
  if (text.trim() === '') return undefined;
  return parseScaled(text, scale);
}
