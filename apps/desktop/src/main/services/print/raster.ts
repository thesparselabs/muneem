import { placed, type PrintLine } from './layout.js';

// One text column on a thermal head is 12 dots (Font A); a raster row is taller than a text row so matras and descenders fit.
export const CELL_DOTS = 12;
const ROW_DOTS = 32;
const FONT_PX = 22;
const BASELINE_DOTS = 23;

export interface RasterRun { text: string; x: number; maxWidth: number }
export interface RasterPlan { widthDots: number; heightDots: number; fontPx: number; baseline: number; bold: boolean; runs: RasterRun[] }
// One bit per dot, rows top to bottom, the leftmost dot in the high bit (the ESC/POS GS v 0 layout).
export interface RasterBitmap { widthDots: number; heightDots: number; bits: Buffer }

export interface LineRasteriser {
  rasterise(plans: readonly RasterPlan[]): Promise<RasterBitmap[]>;
}

export const paperDots = (widthChars: number): number => Math.ceil((widthChars * CELL_DOTS) / 8) * 8;
const isAscii = (s: string): boolean => /^[\x20-\x7e]*$/u.test(s);

// Words keep the column the text layout gave them, so amounts stay under each other; an Indic phrase stays one run so it shapes as a whole.
export function planRasterLine(line: PrintLine, widthChars: number): RasterPlan {
  const scale = line.double ? 2 : 1;
  const cell = CELL_DOTS * scale;
  const cols = Math.floor(widthChars / scale);
  const runs: { text: string; col: number }[] = [];
  for (const m of placed(line, cols).matchAll(/\S+/gu)) {
    const last = runs.at(-1);
    const joins = last && last.col + last.text.length + 1 === m.index && !(isAscii(last.text) && isAscii(m[0]));
    if (joins) last.text = `${last.text} ${m[0]}`;
    else runs.push({ text: m[0], col: m.index });
  }
  return {
    widthDots: paperDots(widthChars), heightDots: ROW_DOTS * scale, fontPx: FONT_PX * scale, baseline: BASELINE_DOTS * scale, bold: !!line.bold,
    runs: runs.map((r, i) => {
      const room = (runs[i + 1]?.col ?? cols + 1) - 1 - r.col;
      return { text: r.text, x: r.col * cell, maxWidth: Math.max(1, isAscii(r.text) ? Math.min(r.text.length, room) : room) * cell };
    }),
  };
}

export const fitsPlan = (b: RasterBitmap | undefined, p: RasterPlan): b is RasterBitmap =>
  !!b && b.widthDots === p.widthDots && b.heightDots === p.heightDots && b.bits.length === (p.widthDots / 8) * p.heightDots;
