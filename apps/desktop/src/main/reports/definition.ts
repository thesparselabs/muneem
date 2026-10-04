import type { Permission, ReportColumn, ReportParamField, ReportParams } from '@muneem/contracts';
import type { Db } from '@muneem/db-sqlite';

export type Cell = string | number | null;
export type Row = Record<string, Cell>;
export interface ReportRows { rows: Row[]; totals?: Row | null }
export interface ReportScope { db: Db; businessId: string; today: string }

// ADR-0046: one definition per report; the screen, the run and every export read the same columns.
export interface ReportDefinition {
  id: string;
  title: string;
  group: string;
  permission: Permission;
  params: ReportParamField[];
  columns: ReportColumn[];
  run(scope: ReportScope, params: ReportParams): ReportRows;
}

export const dateParam = (key: string, label: string, required = true): ReportParamField => ({ key, label, kind: 'date', required });
export const branchParam: ReportParamField = { key: 'branchId', label: 'Branch', kind: 'branch', required: false };
