import type { ReportColumnKind } from '@muneem/contracts';
import type { Cell } from '../definition.js';

const inr = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const qty = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 3 });

// Money is paise and quantities milli-units everywhere; exports show rupees and units.
export function numericValue(kind: ReportColumnKind, v: Cell): Cell {
  if (typeof v !== 'number') return v;
  if (kind === 'money') return v / 100;
  if (kind === 'qty') return v / 1000;
  if (kind === 'percent') return v / 100;
  return v;
}

export function displayValue(kind: ReportColumnKind, v: Cell): string {
  if (v === null) return '';
  if (typeof v !== 'number') return v;
  if (kind === 'money') return inr.format(v / 100);
  if (kind === 'qty') return qty.format(v / 1000);
  if (kind === 'percent') return `${(v / 100).toFixed(2)}%`;
  return String(v);
}
