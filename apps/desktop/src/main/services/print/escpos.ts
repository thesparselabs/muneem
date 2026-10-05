import type { PrintLine, RupeeStyle } from './layout.js';
import { fitsPlan, planRasterLine, type LineRasteriser, type RasterBitmap } from './raster.js';

const ESC = 0x1b;
const GS = 0x1d;
const INIT = [ESC, 0x40];
const ALIGN = { left: 0, center: 1, right: 2 } as const;
const FEED_AND_CUT = [ESC, 0x64, 4, GS, 0x56, 66, 0];
export const DRAWER_KICK = [ESC, 0x70, 0, 25, 250];

export interface EscPosOptions { openDrawer: boolean; cut: boolean; rupee?: RupeeStyle }

const foldAccents = (text: string): string => text.normalize('NFKD').replace(/[̀-ͯ]/gu, '');

// The printer's own code page is plain ASCII: what cannot be shown there prints as '?' unless the line goes as an image.
export function toPrinterAscii(text: string): string {
  return foldAccents(text.replace(/₹/gu, 'Rs')).replace(/[^\x20-\x7e]/gu, '?');
}

export function needsRaster(text: string, rupee: RupeeStyle = 'Rs'): boolean {
  return /[^\x20-\x7e]/u.test(foldAccents(rupee === 'Rs' ? text.replace(/₹/gu, 'Rs') : text));
}

export function rasterCommand(b: RasterBitmap): number[] {
  const stride = b.widthDots / 8;
  return [ESC, 0x61, 0, GS, 0x76, 0x30, 0, stride & 0xff, stride >> 8, b.heightDots & 0xff, b.heightDots >> 8, ...b.bits];
}

export function encodeEscPos(lines: readonly PrintLine[], opts: EscPosOptions & { raster?: ReadonlyMap<number, RasterBitmap> }): Buffer {
  const bytes: number[] = [...INIT];
  if (opts.openDrawer) bytes.push(...DRAWER_KICK);
  lines.forEach((l, i) => {
    const image = opts.raster?.get(i);
    if (image) { bytes.push(...rasterCommand(image)); return; }
    bytes.push(ESC, 0x61, ALIGN[l.align], ESC, 0x45, l.bold ? 1 : 0, GS, 0x21, l.double ? 0x11 : 0x00);
    for (const ch of toPrinterAscii(l.text)) bytes.push(ch.charCodeAt(0));
    bytes.push(0x0a);
  });
  bytes.push(ESC, 0x45, 0, GS, 0x21, 0);
  if (opts.cut) bytes.push(...FEED_AND_CUT);
  return Buffer.from(bytes);
}

// ASCII lines stay text for speed; only lines the code page cannot carry become images. Without a rasteriser they fall back to '?'.
export async function renderEscPos(
  lines: readonly PrintLine[], widthChars: number, opts: EscPosOptions, rasteriser?: LineRasteriser, onRasterError?: (e: unknown) => void,
): Promise<Buffer> {
  const wanted = lines.flatMap((l, i) => (needsRaster(l.text, opts.rupee) ? [i] : []));
  const raster = new Map<number, RasterBitmap>();
  if (rasteriser && wanted.length > 0) {
    const plans = wanted.map((i) => planRasterLine(lines[i]!, widthChars));
    try {
      const images = await rasteriser.rasterise(plans);
      wanted.forEach((lineNo, k) => { const b = images[k]; if (fitsPlan(b, plans[k]!)) raster.set(lineNo, b); });
    } catch (e) {
      onRasterError?.(e);
    }
  }
  return encodeEscPos(lines, { ...opts, raster });
}

export const drawerOnly = (): Buffer => Buffer.from([...INIT, ...DRAWER_KICK]);
