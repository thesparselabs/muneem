import { z } from 'zod';

// ADR-0046: a report describes its parameters and columns, so the screen, the run and every export share one shape.
export const ReportColumnKind = z.enum(['text', 'date', 'money', 'qty', 'number', 'percent']);
export type ReportColumnKind = z.infer<typeof ReportColumnKind>;
export const ReportColumn = z.object({ key: z.string(), label: z.string(), kind: ReportColumnKind });
export type ReportColumn = z.infer<typeof ReportColumn>;

export const ReportParamField = z.object({
  key: z.string(), label: z.string(), kind: z.enum(['date', 'branch', 'text', 'select']), required: z.boolean(),
  options: z.array(z.object({ value: z.string(), label: z.string() })).optional(),
});
export type ReportParamField = z.infer<typeof ReportParamField>;

export const ReportDefinitionView = z.object({ id: z.string(), title: z.string(), group: z.string(), params: z.array(ReportParamField), columns: z.array(ReportColumn) });
export type ReportDefinitionView = z.infer<typeof ReportDefinitionView>;

const Cell = z.union([z.string(), z.number(), z.null()]);
export const ReportParams = z.record(z.string().max(64), z.string().max(200));
export type ReportParams = z.infer<typeof ReportParams>;

export const ReportResult = z.object({
  id: z.string(), title: z.string(), columns: z.array(ReportColumn), rows: z.array(z.record(Cell)), totals: z.record(Cell).nullable(),
  truncated: z.boolean(), generatedAt: z.string(),
});
export type ReportResult = z.infer<typeof ReportResult>;

export const RunReportInput = z.object({ id: z.string().max(80), params: ReportParams.default({}) });
export const ExportFormat = z.enum(['csv', 'xlsx', 'pdf']);
export type ExportFormat = z.infer<typeof ExportFormat>;
export const ExportReportInput = RunReportInput.extend({ format: ExportFormat });
export const ExportReportResult = z.object({ saved: z.boolean(), fileName: z.string(), bytes: z.number().int() });
export type ExportReportResult = z.infer<typeof ExportReportResult>;
