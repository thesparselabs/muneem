import { AppError, type ExportFormat, type ExportReportResult, type Permission, type ReportDefinitionView, type ReportParams, type ReportResult } from '@muneem/contracts';
import type { Db } from '@muneem/db-sqlite';
import type { ReportCatalogue } from './catalogue.js';
import type { ReportDefinition, Row } from './definition.js';
import type { ExportDocument, ExportWriter } from './exports/writer.js';

export const MAX_ROWS = 50_000;
const DATE = /^\d{4}-\d{2}-\d{2}$/u;

export interface SaveFile { (suggestedName: string, bytes: Buffer): Promise<{ saved: boolean; fileName: string }> }

export interface ReportServiceDeps {
  catalogue: ReportCatalogue;
  readDb: () => Db;
  businessId: () => string;
  today: () => string;
  can: (permission: Permission) => boolean;
  business: () => { name: string; gstin: string | null };
  writers: readonly ExportWriter[];
  saveFile: SaveFile;
  now?: () => Date;
}

// ADR-0046: runs a report on a read-only connection and hands the same result to the screen or an export writer.
export class ReportService {
  constructor(private readonly d: ReportServiceDeps) {}

  list(): ReportDefinitionView[] {
    return this.d.catalogue.list().filter((r) => this.d.can(r.permission))
      .map((r) => ({ id: r.id, title: r.title, group: r.group, params: r.params, columns: r.columns }));
  }

  run(id: string, params: ReportParams): ReportResult {
    const def = this.allowed(id);
    const out = def.run({ db: this.d.readDb(), businessId: this.d.businessId(), today: this.d.today() }, this.checked(def, params));
    return {
      id: def.id, title: def.title, columns: def.columns, rows: out.rows.slice(0, MAX_ROWS), totals: out.totals ?? null,
      truncated: out.rows.length > MAX_ROWS, generatedAt: (this.d.now?.() ?? new Date()).toISOString(),
    };
  }

  async export(id: string, params: ReportParams, format: ExportFormat): Promise<ExportReportResult> {
    const writer = this.d.writers.find((w) => w.format === format);
    if (!writer) throw new AppError('VALIDATION_FAILED', 'This export format is not available', { format: 'unsupported' });
    const result = this.run(id, params);
    const bytes = await writer.write(this.document(this.d.catalogue.get(id), params, result));
    const name = `${result.title} ${params.to ?? params.asOf ?? this.d.today()}.${writer.extension}`.replace(/[\\/:*?"<>|]/gu, '-');
    const saved = await this.d.saveFile(name, bytes);
    return { ...saved, bytes: bytes.length };
  }

  private document(def: ReportDefinition, params: ReportParams, r: ReportResult): ExportDocument {
    return {
      title: def.title, business: this.d.business(), generatedAt: r.generatedAt, columns: r.columns, rows: r.rows as Row[], totals: r.totals as Row | null,
      params: def.params.filter((p) => params[p.key]).map((p) => ({ label: p.label, value: params[p.key]! })), ...(def.bare && { bare: true }),
    };
  }

  private allowed(id: string): ReportDefinition {
    const def = this.d.catalogue.get(id);
    if (!this.d.can(def.permission)) throw new AppError('PERMISSION_DENIED', 'You cannot run this report');
    return def;
  }

  private checked(def: ReportDefinition, params: ReportParams): ReportParams {
    const fields: Record<string, string> = {};
    for (const p of def.params) {
      const v = params[p.key];
      if (!v) { if (p.required) fields[p.key] = 'required'; continue; }
      if (p.kind === 'date' && !DATE.test(v)) fields[p.key] = 'a date (YYYY-MM-DD)';
      if (p.kind === 'select' && p.options && !p.options.some((o) => o.value === v)) fields[p.key] = 'not an option';
    }
    if (params.from && params.to && params.from > params.to) fields.from = 'after the end date';
    if (Object.keys(fields).length > 0) throw new AppError('VALIDATION_FAILED', 'Check the report options', fields);
    return params;
  }
}
