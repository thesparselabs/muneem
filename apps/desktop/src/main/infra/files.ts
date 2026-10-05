import { BrowserWindow, dialog } from 'electron';
import { writeFile } from 'node:fs/promises';
import { basename } from 'node:path';

// The user picks where an export goes; the renderer never sees a path.
export function electronSaveFile(parent: () => BrowserWindow | null) {
  return async (suggestedName: string, bytes: Buffer): Promise<{ saved: boolean; fileName: string }> => {
    const win = parent();
    const options = { defaultPath: suggestedName };
    const r = win ? await dialog.showSaveDialog(win, options) : await dialog.showSaveDialog(options);
    if (r.canceled || !r.filePath) return { saved: false, fileName: suggestedName };
    await writeFile(r.filePath, bytes);
    return { saved: true, fileName: basename(r.filePath) };
  };
}

// Reports print to PDF from a hidden, sandboxed window with no scripts.
export async function electronHtmlToPdf(html: string): Promise<Buffer> {
  const win = new BrowserWindow({ show: false, webPreferences: { javascript: false, sandbox: true, contextIsolation: true, nodeIntegration: false } });
  try {
    await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    return await win.webContents.printToPDF({ pageSize: 'A4', printBackground: true, margins: { marginType: 'default' } });
  } finally {
    win.destroy();
  }
}
