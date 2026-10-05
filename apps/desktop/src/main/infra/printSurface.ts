import { BrowserWindow, session, type Session } from 'electron';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { InstalledPrinter } from '@muneem/contracts';
import type { Logger } from './logger.js';
import type { LineRasteriser, RasterBitmap, RasterPlan } from '../services/print/raster.js';
import type { HtmlPage } from '../services/print/receiptHtml.js';
import type { PagePrinter, PrinterDirectory } from '../services/print/spooler.js';

const PARTITION = 'muneem-print';
const FONT_FILES = [['Muneem Devanagari', 'NotoSansDevanagari-Regular.ttf'], ['Muneem Tamil', 'NotoSansTamil-Regular.ttf']] as const;

// Runs only inside the hidden print page: draws each planned line on a canvas and packs it to 1-bit rows (high bit = leftmost dot).
const RASTER_PAGE = `<!doctype html><html><head><meta charset="utf-8"></head><body><script>
const FAMILY = 'Consolas, "DejaVu Sans Mono", "Muneem Devanagari", "Muneem Tamil", "Nirmala UI", sans-serif';
window.muneemFonts = async (fonts) => {
  for (const f of fonts) document.fonts.add(await new FontFace(f.family, Uint8Array.from(atob(f.data), (c) => c.charCodeAt(0))).load());
  return fonts.length;
};
window.muneemRaster = async (plans) => {
  const out = [];
  for (const p of plans) {
    const canvas = document.createElement('canvas');
    canvas.width = p.widthDots; canvas.height = p.heightDots;
    const g = canvas.getContext('2d', { willReadFrequently: true });
    const font = (p.bold ? 'bold ' : '') + p.fontPx + 'px ' + FAMILY;
    await document.fonts.load(font, p.runs.map((r) => r.text).join(' '));
    g.fillStyle = '#fff'; g.fillRect(0, 0, p.widthDots, p.heightDots);
    g.fillStyle = '#000'; g.font = font; g.textBaseline = 'alphabetic';
    for (const r of p.runs) g.fillText(r.text, r.x, p.baseline, r.maxWidth);
    const px = g.getImageData(0, 0, p.widthDots, p.heightDots).data;
    const stride = p.widthDots / 8;
    const bits = new Uint8Array(stride * p.heightDots);
    for (let y = 0; y < p.heightDots; y++) for (let x = 0; x < p.widthDots; x++) if (px[(y * p.widthDots + x) * 4] < 128) bits[y * stride + (x >> 3)] |= 0x80 >> (x & 7);
    let s = '';
    for (const b of bits) s += String.fromCharCode(b);
    out.push(btoa(s));
  }
  return out;
};
</script></body></html>`;

function timeBox<T>(work: Promise<T>, ms: number, message: string): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  return Promise.race([work, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error(message)), ms); })]).finally(() => clearTimeout(timer));
}

// Print windows get their own session that can load nothing from anywhere, so receipt text can never fetch or navigate.
function printSession(): Session {
  const ses = session.fromPartition(PARTITION, { cache: false });
  ses.webRequest.onBeforeRequest((details, cb) => cb({ cancel: !details.url.startsWith('data:') }));
  ses.setPermissionRequestHandler((_wc, _permission, cb) => cb(false));
  return ses;
}

function hiddenWindow(javascript: boolean): BrowserWindow {
  const win = new BrowserWindow({
    show: false, width: 800, height: 600, skipTaskbar: true,
    webPreferences: { session: printSession(), javascript, sandbox: true, contextIsolation: true, nodeIntegration: false, spellcheck: false, devTools: false },
  });
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (e) => e.preventDefault());
  return win;
}

// One long-lived hidden page for drawing raster lines and asking Electron for the installed printers.
export class HiddenPrintPage {
  private win: Promise<BrowserWindow> | null = null;
  constructor(private readonly fontsDir: string, private readonly log: Logger) {}

  get(): Promise<BrowserWindow> {
    this.win ??= this.open().catch((e: unknown) => { this.win = null; throw e; });
    return this.win;
  }

  close(): void {
    const pending = this.win;
    this.win = null;
    void pending?.then((w) => { if (!w.isDestroyed()) w.destroy(); }).catch(() => undefined);
  }

  private async open(): Promise<BrowserWindow> {
    const win = hiddenWindow(true);
    win.on('closed', () => { this.win = null; });
    await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(RASTER_PAGE)}`);
    await win.webContents.executeJavaScript(`window.muneemFonts(${JSON.stringify(this.fonts())})`);
    return win;
  }

  private fonts(): { family: string; data: string }[] {
    return FONT_FILES.flatMap(([family, file]) => {
      const path = join(this.fontsDir, file);
      if (existsSync(path)) return [{ family, data: readFileSync(path).toString('base64') }];
      this.log.warn({ path }, 'receipt font missing; Indic lines use the system fonts');
      return [];
    });
  }
}

export class ElectronRasteriser implements LineRasteriser {
  constructor(private readonly page: HiddenPrintPage, private readonly timeoutMs: number) {}

  async rasterise(plans: readonly RasterPlan[]): Promise<RasterBitmap[]> {
    const win = await this.page.get();
    const work = win.webContents.executeJavaScript(`window.muneemRaster(${JSON.stringify(plans)})`) as Promise<unknown>;
    const encoded = await timeBox(work, this.timeoutMs, 'drawing the receipt lines took too long').catch((e: unknown) => { this.page.close(); throw e; });
    if (!Array.isArray(encoded) || encoded.length !== plans.length) throw new Error('the print page returned the wrong number of lines');
    return plans.map((p, i) => ({ widthDots: p.widthDots, heightDots: p.heightDots, bits: Buffer.from(String(encoded[i]), 'base64') }));
  }
}

export class ElectronPrinterDirectory implements PrinterDirectory {
  constructor(private readonly page: HiddenPrintPage) {}

  async list(): Promise<InstalledPrinter[]> {
    const printers = await (await this.page.get()).webContents.getPrintersAsync();
    return printers.flatMap((p) => {
      const parsed = InstalledPrinter.safeParse({ name: p.name, displayName: (p.displayName || p.name).slice(0, 256) });
      return parsed.success && parsed.data.name === p.name ? [parsed.data] : [];
    });
  }
}

// The image fallback: the receipt page goes to the printer's own driver, silently, sized to the roll.
export class ElectronPagePrinter implements PagePrinter {
  constructor(private readonly timeoutMs: number) {}

  async print(printerName: string, page: HtmlPage): Promise<void> {
    const win = hiddenWindow(false);
    try {
      await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(page.html)}`);
      const printed = new Promise<void>((resolve, reject) => {
        win.webContents.print({
          silent: true, deviceName: printerName, printBackground: false, color: false, margins: { marginType: 'none' },
          pageSize: { width: page.widthMicrons, height: page.heightMicrons },
        }, (ok, reason) => (ok ? resolve() : reject(new Error(`The printer "${printerName}" did not print the receipt: ${reason || 'unknown reason'}`))));
      });
      await timeBox(printed, this.timeoutMs, `The printer "${printerName}" did not take the receipt in time`);
    } finally {
      win.destroy();
    }
  }
}

export const receiptFontsDir = (packaged: boolean, appDir: string): string =>
  packaged ? join(process.resourcesPath, 'fonts') : join(appDir, '../../resources/fonts');
