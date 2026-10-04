import Papa from 'papaparse';
import { numericValue } from './format.js';
import { headerLines, type ExportDocument, type ExportWriter } from './writer.js';

// UTF-8 with a BOM so Excel opens ₹ and Indic names correctly; numbers stay plain for re-use.
export class CsvWriter implements ExportWriter {
  readonly format = 'csv' as const;
  readonly extension = 'csv';

  write(doc: ExportDocument): Promise<Buffer> {
    const body = [...doc.rows, ...(doc.totals ? [doc.totals] : [])].map((r) => doc.columns.map((c) => numericValue(c.kind, r[c.key] ?? null)));
    const csv = Papa.unparse({ fields: doc.columns.map((c) => c.label), data: body });
    const header = headerLines(doc).map((l) => Papa.unparse([[l]])).join('\r\n');
    return Promise.resolve(Buffer.from(`﻿${header}\r\n\r\n${csv}\r\n`, 'utf8'));
  }
}
