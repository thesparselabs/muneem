import type { PrintLine } from './layout.js';

export interface HtmlPage { html: string; widthMicrons: number; heightMicrons: number }

const FAMILY = `Consolas, 'DejaVu Sans Mono', 'Nirmala UI', 'Noto Sans Devanagari', monospace`;
const MONO_ADVANCE_EM = 0.6;
const LINE_HEIGHT = 1.25;
const FEED_MM = 8;

export const paperMm = (widthChars: number): 58 | 80 => (widthChars === 32 ? 58 : 80);
const printableMm = (paper: 58 | 80): number => (paper === 58 ? 48 : 72);
const round2 = (n: number): number => Math.round(n * 100) / 100;

const escapeHtml = (s: string): string =>
  s.replace(/&/gu, '&amp;').replace(/</gu, '&lt;').replace(/>/gu, '&gt;').replace(/"/gu, '&quot;').replace(/'/gu, '&#39;');

const classes = (l: PrintLine): string =>
  [l.align === 'center' ? 'c' : l.align === 'right' ? 'r' : '', l.bold ? 'b' : '', l.double ? 'd' : ''].filter(Boolean).join(' ');

// For a printer that only takes driver (GDI) jobs: the same laid-out lines as one roll-paper page, sized to its content.
export function receiptHtml(lines: readonly PrintLine[], widthChars: number): HtmlPage {
  const paper = paperMm(widthChars);
  const printable = printableMm(paper);
  const margin = (paper - printable) / 2;
  const fontMm = round2(printable / widthChars / MONO_ADVANCE_EM);
  const contentMm = lines.reduce((sum, l) => sum + fontMm * LINE_HEIGHT * (l.double ? 2 : 1), 0);
  const heightMm = Math.ceil(2 * margin + contentMm + FEED_MM);
  const rows = lines.map((l) => {
    const cls = classes(l);
    return `<div${cls ? ` class="${cls}"` : ''}>${escapeHtml(l.text) || '&nbsp;'}</div>`;
  });
  const html = [
    '<!doctype html><html><head><meta charset="utf-8"><style>',
    `@page{size:${paper}mm ${heightMm}mm;margin:0}`,
    `body{margin:0;padding:${margin}mm;width:${printable}mm;font:${fontMm}mm/${LINE_HEIGHT} ${FAMILY};color:#000;background:#fff}`,
    `div{white-space:pre;overflow:hidden}.c{text-align:center}.r{text-align:right}.b{font-weight:700}.d{font-size:${round2(fontMm * 2)}mm}`,
    '</style></head><body>',
    ...rows,
    '</body></html>',
  ].join('\n');
  return { html, widthMicrons: paper * 1000, heightMicrons: heightMm * 1000 };
}
