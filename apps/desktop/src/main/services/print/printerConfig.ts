import { PrinterConfig } from '@muneem/contracts';
import { getMeta, setMeta, type Db } from '@muneem/db-sqlite';

const KEY = 'printer.config';
// No printer yet means receipts go to files, so billing and reprints can be checked end to end.
export const DEFAULT_PRINTER: PrinterConfig = { kind: 'simulator', port: 9100, widthChars: 42, openDrawer: true };

// Device-local: each till has its own printer, so this lives in app_meta and never syncs (ADR-0015).
export class PrinterConfigStore {
  constructor(private readonly db: () => Db) {}

  get(): PrinterConfig {
    const raw = getMeta(this.db(), KEY);
    const parsed = raw ? PrinterConfig.safeParse(JSON.parse(raw)) : null;
    return parsed?.success ? parsed.data : DEFAULT_PRINTER;
  }

  set(config: PrinterConfig): PrinterConfig {
    setMeta(this.db(), KEY, JSON.stringify(config));
    return config;
  }
}
