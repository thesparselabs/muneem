import { mkdirSync, writeFileSync } from 'node:fs';
import { createConnection } from 'node:net';
import { join } from 'node:path';
import type { PrinterConfig } from '@muneem/contracts';

export interface ReceiptPrinter {
  readonly id: string;
  send(bytes: Buffer, text: string, name: string): Promise<void>;
}

export class NoPrinter implements ReceiptPrinter {
  readonly id = 'none';
  send(): Promise<void> { return Promise.reject(new Error('No receipt printer is set up')); }
}

// Writes what would have been printed, as text for people and as the raw ESC/POS bytes, so receipts can be checked without hardware.
export class SimulatorPrinter implements ReceiptPrinter {
  readonly id = 'simulator';
  constructor(private readonly dir: string) {}
  send(bytes: Buffer, text: string, name: string): Promise<void> {
    mkdirSync(this.dir, { recursive: true });
    writeFileSync(join(this.dir, `${name}.txt`), text);
    writeFileSync(join(this.dir, `${name}.bin`), bytes);
    return Promise.resolve();
  }
}

export class NetworkEscPosPrinter implements ReceiptPrinter {
  readonly id: string;
  constructor(private readonly host: string, private readonly port: number, private readonly timeoutMs: number) {
    this.id = `network:${host}:${port}`;
  }
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

export function printerFor(config: PrinterConfig, receiptsDir: string, timeoutMs: number): ReceiptPrinter {
  if (config.kind === 'simulator') return new SimulatorPrinter(receiptsDir);
  if (config.kind === 'network' && config.host) return new NetworkEscPosPrinter(config.host, config.port, timeoutMs);
  return new NoPrinter();
}
