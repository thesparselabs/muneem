import { PrinterConfig } from '@muneem/contracts';

export interface PrinterForm {
  kind: PrinterConfig['kind'];
  host: string;
  port: string;
  printerName: string;
  mode: PrinterConfig['mode'];
  rupee: PrinterConfig['rupee'];
  widthChars: PrinterConfig['widthChars'];
  openDrawer: boolean;
}

export const configToForm = (c: PrinterConfig): PrinterForm => ({
  kind: c.kind, host: c.host ?? '', port: String(c.port), printerName: c.printerName ?? '', mode: c.mode, rupee: c.rupee, widthChars: c.widthChars, openDrawer: c.openDrawer,
});

// Only the fields of the chosen kind are sent, so a stale address or printer name from another kind is never saved.
export function formToConfig(f: PrinterForm): { ok: true; config: PrinterConfig } | { ok: false; message: string } {
  const parsed = PrinterConfig.safeParse({
    kind: f.kind, port: Number(f.port), widthChars: f.widthChars, openDrawer: f.openDrawer, rupee: f.rupee,
    mode: f.kind === 'spooler' ? f.mode : 'escpos',
    ...(f.kind === 'network' && f.host.trim() && { host: f.host }),
    ...(f.kind === 'spooler' && f.printerName && { printerName: f.printerName }),
  });
  return parsed.success ? { ok: true, config: parsed.data } : { ok: false, message: parsed.error.issues.map((i) => i.message).join('; ') };
}
