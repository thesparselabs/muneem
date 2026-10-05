import { createServer, type AddressInfo, type Server } from 'node:net';
import { describe, expect, it } from 'vitest';
import { newUlid } from '@muneem/domain';
import { CompleteSaleInput, ProductInput, SaleDraft } from '@muneem/contracts';
import { getPrintJob, type Db } from '@muneem/db-sqlite';
import type { App } from '../../src/main/app.js';
import { silentLoggers } from '../../src/main/infra/logger.js';
import { PrintQueue } from '../../src/main/services/print/printQueue.js';
import { PrinterConfigStore } from '../../src/main/services/print/printerConfig.js';
import type { ReceiptPrinter } from '../../src/main/services/print/printers.js';
import { caller, ownerAtTill, testApp } from '../helpers.js';

// A 9100-port receipt printer that can be unplugged and plugged back in on the same address.
async function tcpPrinter() {
  const jobs: Buffer[] = [];
  let server: Server | null = null;
  const listen = (port: number) => new Promise<number>((resolve) => {
    server = createServer((socket) => {
      const chunks: Buffer[] = [];
      socket.on('data', (d: Buffer) => chunks.push(d));
      socket.on('end', () => jobs.push(Buffer.concat(chunks)));
    });
    server.listen(port, '127.0.0.1', () => resolve((server!.address() as AddressInfo).port));
  });
  const port = await listen(0);
  return {
    port, jobs,
    unplug: () => new Promise<void>((r) => { server!.close(() => r()); }),
    plugIn: () => listen(port),
    received: async (n: number) => { for (let i = 0; i < 200 && jobs.length < n; i++) await new Promise((r) => setTimeout(r, 10)); return jobs.length; },
  };
}

async function till(config: Record<string, unknown>) {
  const t = await testApp();
  const { businessId } = await ownerAtTill(t.app);
  await caller(t.app).data('printer.setConfig', config);
  const pcs = t.app.catalog.listUoms().find((u) => u.code === 'PCS')!.id;
  const tea = t.app.products.create(ProductInput.parse({ name: 'Tea 250g', baseUomId: pcs, gstRateBp: 500, sellingPricePaise: 12_000 })).id;
  t.app.inventory.setOpeningStock({ lines: [{ productId: tea, qtyMilli: 100_000, unitCostPaise: 8_000 }] });
  await t.app.register.open(0);
  const draft = SaleDraft.parse({ lines: [{ productId: tea, uomId: pcs, qtyMilli: 1000 }] });
  const total = t.app.sales.quote(draft).totals.totalPaise;
  const input = () => ({ ...draft, commandId: newUlid(), expectedTotalPaise: total, tenders: [{ method: 'cash', amountPaise: total }] });
  return { ...t, businessId, input };
}

const jobOf = (db: Db, saleId: string) => db.prepare('SELECT id FROM print_job WHERE doc_id = ?').pluck().get(saleId) as string;
const docNumber = (app: App, saleId: string) => app.sales.get(saleId).docNumber;

describe('printer unplugged mid-shift (9g, NFR-012)', () => {
  it('a network printer pulled out fails its jobs without holding up billing; plugged back in, each retry prints exactly once', async () => {
    const printer = await tcpPrinter();
    const { app, db, businessId, input } = await till({ kind: 'network', host: '127.0.0.1', port: printer.port, widthChars: 32, openDrawer: false });
    const first = await caller(app).data<{ saleId: string }>('sales.complete', input());
    await app.printQueue.idle();
    expect(await printer.received(1)).toBe(1);

    await printer.unplug();
    const offline: string[] = [];
    for (let i = 0; i < 3; i++) {
      const started = performance.now();
      offline.push((await caller(app).data<{ saleId: string }>('sales.complete', input())).saleId);
      expect(performance.now() - started, 'the sale does not wait for the printer').toBeLessThan(1000);
    }
    await app.printQueue.idle();
    for (const saleId of offline) {
      expect(app.sales.get(saleId).status).toBe('posted');
      expect(getPrintJob(db, jobOf(db, saleId))).toMatchObject({ status: 'failed', errorMessage: expect.stringMatching(/ECONNREFUSED|did not respond/) });
    }

    await printer.plugIn();
    for (const saleId of offline) app.printQueue.retry(jobOf(db, saleId), businessId);
    await app.printQueue.idle();
    expect(await printer.received(4)).toBe(4);
    for (const saleId of [first.saleId, ...offline]) {
      expect(getPrintJob(db, jobOf(db, saleId))!.status).toBe('done');
      expect(printer.jobs.filter((j) => j.includes(Buffer.from(docNumber(app, saleId)))), docNumber(app, saleId)).toHaveLength(1);
    }
    expect(() => app.printQueue.retry(jobOf(db, offline[0]!), businessId)).toThrow(/Only a receipt that failed/);
    await printer.unplug();
  });

  it('a printer cut off mid-job or hanging marks the job failed while sales go on; the retry prints it once', async () => {
    const { app, db, dir, businessId, input } = await till({ kind: 'none' });
    let mode: 'cut' | 'hang' | 'ok' = 'cut';
    const printed: Buffer[] = [];
    const fake: ReceiptPrinter = {
      id: 'fake',
      print: async (job) => {
        const bytes = await job.escpos();
        if (mode === 'cut') throw new Error(`Printer connection reset after ${bytes.length >> 1} of ${bytes.length} bytes`);
        if (mode === 'hang') return new Promise<void>(() => undefined);
        printed.push(bytes);
      },
      kickDrawer: () => Promise.resolve(),
    };
    const queue = new PrintQueue({ db: () => db, config: new PrinterConfigStore(() => db), receiptsDir: dir, log: silentLoggers().hardware, deadlineMs: 200, printer: () => fake });
    const sale = app.sales.complete(CompleteSaleInput.parse(input()));
    await app.printQueue.idle();
    const jobId = jobOf(db, sale.saleId);
    expect(getPrintJob(db, jobId)!.status).toBe('failed');

    queue.retry(jobId, businessId);
    await queue.idle();
    expect(getPrintJob(db, jobId)).toMatchObject({ status: 'failed', errorMessage: expect.stringContaining('connection reset') });

    mode = 'hang';
    queue.retry(jobId, businessId);
    const during = [app.sales.complete(CompleteSaleInput.parse(input())), app.sales.complete(CompleteSaleInput.parse(input()))];
    expect(during.map((s) => app.sales.get(s.saleId).status)).toEqual(['posted', 'posted']);
    await queue.idle();
    expect(getPrintJob(db, jobId)).toMatchObject({ status: 'failed', errorMessage: expect.stringContaining('did not respond in time') });

    mode = 'ok';
    queue.retry(jobId, businessId);
    await queue.idle();
    expect(getPrintJob(db, jobId)).toMatchObject({ status: 'done' });
    expect(printed.filter((b) => b.includes(Buffer.from(docNumber(app, sale.saleId))))).toHaveLength(1);
    expect(() => queue.retry(jobId, businessId)).toThrow(/Only a receipt that failed/);
  });
});
