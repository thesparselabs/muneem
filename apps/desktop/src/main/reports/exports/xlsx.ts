import ExcelJS from 'exceljs';
import type { ReportColumnKind } from '@muneem/contracts';
import { numericValue } from './format.js';
import { headerLines, type ExportDocument, type ExportWriter } from './writer.js';

const NUM_FMT: Partial<Record<ReportColumnKind, string>> = { money: '#,##,##0.00', qty: '#,##0.###', percent: '0.00"%"' };

export class XlsxWriter implements ExportWriter {
  readonly format = 'xlsx' as const;
  readonly extension = 'xlsx';

  async write(doc: ExportDocument): Promise<Buffer> {
    const book = new ExcelJS.Workbook();
    const sheet = book.addWorksheet(doc.title.slice(0, 31));
    for (const line of headerLines(doc)) sheet.addRow([line]);
    sheet.getRow(1).font = { bold: true };
    sheet.addRow([]);
    const head = sheet.addRow(doc.columns.map((c) => c.label));
    head.font = { bold: true };
    const add = (r: Record<string, unknown>) => sheet.addRow(doc.columns.map((c) => numericValue(c.kind, (r[c.key] ?? null) as never)));
    for (const r of doc.rows) add(r);
    if (doc.totals) add(doc.totals).font = { bold: true };
    doc.columns.forEach((c, i) => {
      const col = sheet.getColumn(i + 1);
      col.width = Math.max(12, c.label.length + 2);
      if (NUM_FMT[c.kind]) col.numFmt = NUM_FMT[c.kind]!;
    });
    return Buffer.from(await book.xlsx.writeBuffer());
  }
}
