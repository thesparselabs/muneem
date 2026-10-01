import type { PrintLine } from './layout.js';

const ESC = 0x1b;
const GS = 0x1d;
const INIT = [ESC, 0x40];
const ALIGN = { left: 0, center: 1, right: 2 } as const;
const FEED_AND_CUT = [ESC, 0x64, 4, GS, 0x56, 66, 0];
export const DRAWER_KICK = [ESC, 0x70, 0, 25, 250];

// Plain ESC/POS code page: anything outside ASCII prints as '?' until bitmap text lands (Indic names need it).
export function toPrinterAscii(text: string): string {
  return text.replace(/₹/gu, 'Rs').normalize('NFKD').replace(/[̀-ͯ]/gu, '').replace(/[^\x20-\x7e]/gu, '?');
}

export function encodeEscPos(lines: readonly PrintLine[], opts: { openDrawer: boolean; cut: boolean }): Buffer {
  const bytes: number[] = [...INIT];
  if (opts.openDrawer) bytes.push(...DRAWER_KICK);
  for (const l of lines) {
    bytes.push(ESC, 0x61, ALIGN[l.align], ESC, 0x45, l.bold ? 1 : 0, GS, 0x21, l.double ? 0x11 : 0x00);
    for (const ch of toPrinterAscii(l.text)) bytes.push(ch.charCodeAt(0));
    bytes.push(0x0a);
  }
  bytes.push(ESC, 0x45, 0, GS, 0x21, 0);
  if (opts.cut) bytes.push(...FEED_AND_CUT);
  return Buffer.from(bytes);
}

export const drawerOnly = (): Buffer => Buffer.from([...INIT, ...DRAWER_KICK]);
