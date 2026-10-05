import type { ReportColumn, ReportColumnKind, ReportParams } from '@muneem/contracts';
import { fyStartOf } from '@muneem/domain';
import type { ReportRange } from '@muneem/db-sqlite';
import { branchParam, dateParam, type Row, type ReportScope } from '../definition.js';

export const rangeParams = [dateParam('from', 'From', false), dateParam('to', 'To', false), branchParam];

// An open range runs from the start of the financial year to today.
export function rangeOf(scope: ReportScope, p: ReportParams): ReportRange {
  const to = p.to ?? scope.today;
  return { businessId: scope.businessId, from: p.from ?? fyStartOf(to), to, branchId: p.branchId ?? null };
}

export const col = (key: string, label: string, kind: ReportColumnKind = 'text'): ReportColumn => ({ key, label, kind });

// Σ of the numeric columns named, under a label in the first column.
export function totalsOf(rows: readonly Row[], columns: readonly ReportColumn[], keys: readonly string[]): Row {
  const out: Row = Object.fromEntries(columns.map((c) => [c.key, null]));
  out[columns[0]!.key] = 'Total';
  for (const k of keys) out[k] = rows.reduce((s, r) => s + (typeof r[k] === 'number' ? r[k] : 0), 0);
  return out;
}
