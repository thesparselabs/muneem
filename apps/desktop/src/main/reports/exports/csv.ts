import Papa from 'papaparse';
import { numericValue } from './format.js';
import { bodyRows, headerLines, type ExportDocument, type ExportWriter } from './writer.js';

// UTF-8 with a BOM so Excel opens ₹ and Indic names correctly; numbers stay plain for re-use.
export class CsvWriter implements ExportWriter {
  readonly format = 'csv' as const;
  readonly extension = 'csv';

  write(doc: ExportDocument): Promise<Buffer> {
    const body = bodyRows(doc).map((r) => doc.columns.map((c) => numericValue(c.kind, r[c.key] ?? null)));
    const csv = Papa.unparse({ fields: doc.columns.map((c) => c.label), data: body });
    const header = doc.bare ? '' : `${headerLines(doc).map((l) => Papa.unparse([[l]])).join('\r\n')}\r\n\r\n`;
    return Promise.resolve(Buffer.from(`﻿${header}${csv}\r\n`, 'utf8'));
  }
}
