import { formatRupees, parseScaled } from '@muneem/domain';

export function formatPaise(paise: number | null | undefined): string {
  return paise === null || paise === undefined ? '—' : formatRupees(paise);
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
