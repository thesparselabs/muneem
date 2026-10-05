import { mkdirSync, writeFileSync } from 'node:fs';
import { createConnection } from 'node:net';
import { join } from 'node:path';
import type { PrinterConfig } from '@muneem/contracts';
import { newUlid } from '@muneem/domain';
import { drawerOnly } from './escpos.js';
import type { HtmlPage } from './receiptHtml.js';
import { noSpooler, type SpoolerTransport } from './spooler.js';

// One receipt, renderable either way; a printer asks only for the form it can take.
export interface ReceiptJob {
  readonly name: string;
  readonly text: string;
  readonly openDrawer: boolean;
  escpos(): Promise<Buffer>;
  page(): HtmlPage;
}

export interface ReceiptPrinter {
  readonly id: string;
  print(job: ReceiptJob): Promise<void>;
  kickDrawer(): Promise<void>;
}

export class NoPrinter implements ReceiptPrinter {
  readonly id = 'none';
  constructor(private readonly reason = 'No receipt printer is set up') {}
  print(): Promise<void> { return Promise.reject(new Error(this.reason)); }
  kickDrawer(): Promise<void> { return Promise.reject(new Error(this.reason)); }
}

// Writes what would have been printed, as text for people, the raw ESC/POS bytes and the image-mode page, so receipts can be checked without hardware.
export class SimulatorPrinter implements ReceiptPrinter {
  readonly id = 'simulator';
  constructor(private readonly dir: string) {}
  async print(job: ReceiptJob): Promise<void> {
    const bytes = await job.escpos();
    mkdirSync(this.dir, { recursive: true });
    writeFileSync(join(this.dir, `${job.name}.txt`), job.text);
    writeFileSync(join(this.dir, `${job.name}.bin`), bytes);
    writeFileSync(join(this.dir, `${job.name}.html`), job.page().html);
  }
  kickDrawer(): Promise<void> {
    mkdirSync(this.dir, { recursive: true });
    writeFileSync(join(this.dir, `drawer-${newUlid()}.bin`), drawerOnly());
    return Promise.resolve();
  }
}

export class NetworkEscPosPrinter implements ReceiptPrinter {
  readonly id: string;
  constructor(private readonly host: string, private readonly port: number, private readonly timeoutMs: number) {
    this.id = `network:${host}:${port}`;
  }
  async print(job: ReceiptJob): Promise<void> { await this.send(await job.escpos()); }
  kickDrawer(): Promise<void> { return this.send(drawerOnly()); }

  send(bytes: Buffer): Promise<void> {
    return new Promise((resolve, reject) => {
      const socket = createConnection({ host: this.host, port: this.port });
      const fail = (e: Error) => { socket.destroy(); reject(e); };
      socket.setTimeout(this.timeoutMs, () => fail(new Error(`Printer at ${this.host}:${this.port} did not respond`)));
      socket.once('error', fail);
      socket.once('connect', () => socket.end(bytes, () => resolve()));
    });
  }
}

// An installed Windows printer: ESC/POS bytes as a RAW spooler job, or the receipt as a page through its driver. The drawer is always a RAW kick.
export class SpoolerPrinter implements ReceiptPrinter {
  readonly id: string;
  constructor(
    private readonly printerName: string, private readonly mode: PrinterConfig['mode'], private readonly spooler: SpoolerTransport,
    private readonly onDrawerError: (e: unknown) => void,
  ) {
    this.id = `spooler:${printerName}`;
  }

  async print(job: ReceiptJob): Promise<void> {
    if (this.mode === 'escpos') { await this.spooler.sendRaw(this.printerName, await job.escpos()); return; }
    await this.spooler.printPage(this.printerName, job.page());
    if (job.openDrawer) await this.kickDrawer().catch(this.onDrawerError); // the receipt is out; a stuck drawer must not reprint it
  }

  kickDrawer(): Promise<void> { return this.spooler.sendRaw(this.printerName, drawerOnly()); }
}

export interface PrinterDeps { receiptsDir: string; timeoutMs: number; spooler?: SpoolerTransport; onDrawerError: (e: unknown) => void }

export function printerFor(config: PrinterConfig, d: PrinterDeps): ReceiptPrinter {
  if (config.kind === 'simulator') return new SimulatorPrinter(d.receiptsDir);
  if (config.kind === 'network' && config.host) return new NetworkEscPosPrinter(config.host, config.port, d.timeoutMs);
  if (config.kind === 'spooler' && config.printerName) return new SpoolerPrinter(config.printerName, config.mode, d.spooler ?? noSpooler, d.onDrawerError);
  return new NoPrinter();
}
