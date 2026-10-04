import type { ExportFormat, ReportColumn } from '@muneem/contracts';
import type { Row } from '../definition.js';

export interface ExportDocument {
  title: string;
  business: { name: string; gstin: string | null };
  params: { label: string; value: string }[];
  generatedAt: string;
  columns: ReportColumn[];
  rows: Row[];
  totals: Row | null;
  bare?: boolean;
}

export interface ExportWriter {
  readonly format: ExportFormat;
  readonly extension: string;
  write(doc: ExportDocument): Promise<Buffer>;
}

// A bare export keeps only the column headings and the rows.
export const bodyRows = (doc: ExportDocument): Row[] => [...doc.rows, ...(doc.totals && !doc.bare ? [doc.totals] : [])];

export const headerLines = (doc: ExportDocument): string[] => [
  doc.business.name, ...(doc.business.gstin ? [`GSTIN ${doc.business.gstin}`] : []), doc.title,
  ...doc.params.map((p) => `${p.label}: ${p.value}`), `Generated ${doc.generatedAt}`,
];
