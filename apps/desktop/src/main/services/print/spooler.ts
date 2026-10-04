import { PrinterName, type InstalledPrinter } from '@muneem/contracts';
import type { HtmlPage } from './receiptHtml.js';

export const MAX_JOB_BYTES = 4 * 1024 * 1024;

export interface PrinterDirectory { list(): Promise<InstalledPrinter[]> }
export interface RawJobRunner { run(printerName: string, bytes: Buffer): Promise<void> }
export interface PagePrinter { print(printerName: string, page: HtmlPage): Promise<void> }

// The Windows print spooler as the print queue sees it; tests and non-Windows builds supply their own.
export interface SpoolerTransport {
  list(): Promise<InstalledPrinter[]>;
  sendRaw(printerName: string, bytes: Buffer): Promise<void>;
  printPage(printerName: string, page: HtmlPage): Promise<void>;
}

export function assertPrinterName(name: string): void {
  const parsed = PrinterName.safeParse(name);
  if (!parsed.success || parsed.data !== name) throw new Error('That is not a valid printer name');
}

export function assertJobSize(bytes: Buffer): void {
  if (bytes.length === 0) throw new Error('Nothing to print');
  if (bytes.length > MAX_JOB_BYTES) throw new Error(`The print job is too large (${Math.ceil(bytes.length / 1024)} KB)`);
}

// Only a printer Windows itself lists can receive a job, so a stored or tampered name cannot reach anything else.
export class WindowsSpooler implements SpoolerTransport {
  constructor(private readonly d: { directory: PrinterDirectory; raw: RawJobRunner; pages: PagePrinter }) {}

  list(): Promise<InstalledPrinter[]> { return this.d.directory.list(); }

  async sendRaw(printerName: string, bytes: Buffer): Promise<void> {
    assertJobSize(bytes);
    await this.installed(printerName);
    await this.d.raw.run(printerName, bytes);
  }

  async printPage(printerName: string, page: HtmlPage): Promise<void> {
    await this.installed(printerName);
    await this.d.pages.print(printerName, page);
  }

  private async installed(printerName: string): Promise<void> {
    assertPrinterName(printerName);
    if (!(await this.d.directory.list()).some((p) => p.name === printerName)) {
      throw new Error(`The printer "${printerName}" is not installed on this computer; check it in Windows Settings > Printers`);
    }
  }
}

const notOnThisPlatform = (): Promise<never> => Promise.reject(new Error('Windows printers can only be used on Windows'));

export const noSpooler: SpoolerTransport = { list: () => Promise.resolve([]), sendRaw: notOnThisPlatform, printPage: notOnThisPlatform };
