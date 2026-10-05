import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { BrowserWindow } from 'electron';

export interface PdfOptions { kind: 'a4' | 'thermal'; widthMm?: number; pageSize?: 'A4' | 'A5' | 'Letter' }
export type PdfSave = (html: string, suggestedName: string, opts: PdfOptions) => Promise<{ saved: boolean; fileName: string }>;

const MICRONS_PER_MM = 1000;

function sanitize(name: string): string {
  const base = name.replace(/[^\w.\- ]+/gu, '_').replace(/\s+/gu, ' ').trim() || 'invoice';
  return base.toLowerCase().endsWith('.pdf') ? base : `${base}.pdf`;
}

// A hidden, sandboxed window prints the invoice HTML to PDF and drops it in Downloads; the page's only assets are
// embedded data URLs, so nothing is fetched. Electron-only, imported lazily so the module stays testable.
export const savePdf: PdfSave = async (html, suggestedName, opts) => {
  const { app, BrowserWindow } = await import('electron');
  const thermal = opts.kind === 'thermal';
  const win = new BrowserWindow({
    show: false,
    webPreferences: { javascript: thermal, sandbox: true, contextIsolation: true, nodeIntegration: false, spellcheck: false, devTools: false },
  });
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (e) => e.preventDefault());
  try {
    await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    const pageOptions = thermal ? await thermalPage(win, opts.widthMm ?? 80) : { pageSize: opts.pageSize ?? 'A4' };
    const pdf = await win.webContents.printToPDF({ printBackground: true, margins: { marginType: 'none' }, ...pageOptions });
    const fileName = sanitize(suggestedName);
    await writeFile(join(app.getPath('downloads'), fileName), pdf);
    return { saved: true, fileName };
  } finally {
    win.destroy();
  }
};

// A roll has no fixed length, so measure the laid-out content and cut the page to it.
async function thermalPage(win: BrowserWindow, widthMm: number): Promise<{ pageSize: { width: number; height: number } }> {
  const px = Number(await win.webContents.executeJavaScript('document.documentElement.scrollHeight')) || 800;
  const heightMm = Math.max(40, Math.ceil((px * 25.4) / 96) + 4);
  return { pageSize: { width: Math.round(widthMm * MICRONS_PER_MM), height: Math.round(heightMm * MICRONS_PER_MM) } };
}
