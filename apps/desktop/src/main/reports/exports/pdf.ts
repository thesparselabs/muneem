import { displayValue } from './format.js';
import { headerLines, type ExportDocument, type ExportWriter } from './writer.js';

// Electron prints the HTML to PDF in a hidden window; tests inject their own renderer.
export type PdfRenderer = (html: string) => Promise<Buffer>;

const esc = (s: string): string => s.replace(/[&<>"]/gu, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const NUMERIC = new Set(['money', 'qty', 'number', 'percent']);

export function reportHtml(doc: ExportDocument): string {
  const [name, ...rest] = headerLines(doc);
  const cell = (tag: 'td' | 'th', kind: string, text: string) => `<${tag}${NUMERIC.has(kind) ? ' class="n"' : ''}>${esc(text)}</${tag}>`;
  const row = (r: Record<string, unknown>, bold = false) =>
    `<tr${bold ? ' class="t"' : ''}>${doc.columns.map((c) => cell('td', c.kind, displayValue(c.kind, (r[c.key] ?? null) as never))).join('')}</tr>`;
  return `<!doctype html><html><head><meta charset="utf-8"><style>
body{font-family:sans-serif;font-size:10px;margin:24px}h1{font-size:14px;margin:0}p{margin:2px 0;color:#444}
table{border-collapse:collapse;width:100%;margin-top:12px}th,td{border-bottom:1px solid #ddd;padding:3px 4px;text-align:left}
th{background:#f3f3f3}.n{text-align:right}.t td{font-weight:bold;border-top:1px solid #000}
</style></head><body><h1>${esc(name ?? '')}</h1>${rest.map((l) => `<p>${esc(l)}</p>`).join('')}
<table><thead><tr>${doc.columns.map((c) => cell('th', c.kind, c.label)).join('')}</tr></thead><tbody>
${doc.rows.map((r) => row(r)).join('\n')}${doc.totals ? row(doc.totals, true) : ''}</tbody></table></body></html>`;
}

export class PdfWriter implements ExportWriter {
  readonly format = 'pdf' as const;
  readonly extension = 'pdf';

  constructor(private readonly render: PdfRenderer) {}

  write(doc: ExportDocument): Promise<Buffer> { return this.render(reportHtml(doc)); }
}
