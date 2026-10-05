import type { ReportColumnKind, ReportDefinitionView, ReportParams } from '@muneem/contracts';
import { fyStartOf } from '@muneem/domain';
import { formatPaise, scaledToText } from '../money.js';

export interface ReportGroup { group: string; reports: ReportDefinitionView[] }

// Groups in the order the catalogue first names them, so related reports stay together.
export function groupReports(defs: readonly ReportDefinitionView[]): ReportGroup[] {
  const groups = new Map<string, ReportDefinitionView[]>();
  for (const d of defs) groups.set(d.group, [...(groups.get(d.group) ?? []), d]);
  return [...groups].map(([group, reports]) => ({ group, reports }));
}

// A range opens on this financial year to date; an as-of date on today.
export function defaultParams(def: ReportDefinitionView, today: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const p of def.params) {
    if (p.key === 'from') out.from = fyStartOf(today);
    else if (p.key === 'to' || p.key === 'asOf') out[p.key] = today;
    else out[p.key] = '';
  }
  return out;
}

const DATE = /^\d{4}-\d{2}-\d{2}$/u;

export function checkParams(def: ReportDefinitionView, values: Record<string, string>): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const p of def.params) {
    const v = values[p.key]?.trim() ?? '';
    if (!v) { if (p.required) errors[p.key] = `choose ${p.label.toLowerCase()}`; continue; }
    if (p.kind === 'date' && !DATE.test(v)) errors[p.key] = 'a date';
  }
  if (values.from && values.to && values.from > values.to) errors.from = 'after the end date';
  return errors;
}

export const runParams = (values: Record<string, string>): ReportParams =>
  Object.fromEntries(Object.entries(values).map(([k, v]) => [k, v.trim()]).filter(([, v]) => v !== ''));

// The same units the exports use: paise as rupees, milli-units as quantities, basis points as percent.
export function formatCell(kind: ReportColumnKind, value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (kind === 'money') return formatPaise(value);
  if (kind === 'qty') return `${value < 0 ? '-' : ''}${scaledToText(Math.abs(value), 3)}`;
  if (kind === 'percent') return `${(value / 100).toFixed(2)}%`;
  return String(value);
}

export const isNumeric = (kind: ReportColumnKind): boolean => kind === 'money' || kind === 'qty' || kind === 'number' || kind === 'percent';

export function periodLabel(values: Record<string, string>): string {
  if (values.from || values.to) return `${values.from || '…'} to ${values.to || '…'}`;
  return values.asOf ? `As of ${values.asOf}` : '';
}
