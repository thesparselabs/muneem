import { readFileSync, readdirSync } from 'node:fs';
import { createServer, type AddressInfo } from 'node:net';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CompleteSaleInput, type ReceiptDoc } from '@muneem/contracts';
import { newUlid } from '@muneem/domain';
import { getPrintJob, insertPrintJob, type Db } from '@muneem/db-sqlite';
import { silentLoggers } from '../src/main/infra/logger.js';
import { DRAWER_KICK, encodeEscPos, toPrinterAscii } from '../src/main/services/print/escpos.js';
import { columns, layoutReceipt, renderText, wrap } from '../src/main/services/print/layout.js';
import { PrintQueue } from '../src/main/services/print/printQueue.js';
import { PrinterConfigStore } from '../src/main/services/print/printerConfig.js';
import { NetworkEscPosPrinter, type ReceiptPrinter } from '../src/main/services/print/printers.js';
import { caller, ownerAtTill, testApp } from './helpers.js';

const DOC: ReceiptDoc = {
  title: 'TAX INVOICE', duplicate: false, copyNo: 1,
  header: { businessName: 'Sharma General Store', lines: ['12 Chandni Chowk, Delhi', 'Ph: 9999999999'], gstin: '07AAAAA0000A1Z5' },
  docNumber: 'DE01/2627/000042', docDate: '2026-10-02', time: '14:05', terminalCode: 'T01', cashier: 'Aditya',
  customer: { name: 'Gupta Traders', gstin: '07BBBBB1111B1Z5' }, placeOfSupply: '07',
  lines: [
    { name: 'Lux Soap 100g', hsnCode: '3401', qty: '2 PCS', unitPricePaise: 4130, discountPaise: 0, amountPaise: 8260 },
    { name: 'Tata Salt Iodised Crystal 1kg Family Pack', qty: '1.5 KG', unitPricePaise: 2800, discountPaise: 200, amountPaise: 4000 },
  ],
  totals: { grossPaise: 12_460, discountPaise: 200, taxablePaise: 10_900, cgstPaise: 680, sgstPaise: 680, igstPaise: 0, cessPaise: 0, roundOffPaise: -60, totalPaise: 12_200, stateTaxLabel: 'SGST' },
  taxSummary: [{ rateBp: 500, taxablePaise: 3810, cgstPaise: 95, sgstPaise: 95, igstPaise: 0 }, { rateBp: 1800, taxablePaise: 7090, cgstPaise: 585, sgstPaise: 585, igstPaise: 0 }],
  tenders: [{ method: 'UPI', amountPaise: 5000, reference: 'UPI-778899' }, { method: 'CASH', amountPaise: 10_000 }],
  changePaise: 2800, footer: ['Thank you! Visit again.'],
};

describe('receipt layout', () => {
  it('matches the reviewed 42-column receipt', () => {
    const text = renderText(layoutReceipt(DOC, 42), 42);
    expect(text).toBe(readFileSync(new URL('./fixtures/print/receipt-42.txt', import.meta.url), 'utf8'));
    for (const line of text.split('\n')) expect(line.length).toBeLessThanOrEqual(42);
  });
  it('fits 32 columns and marks duplicates', () => {
    const text = renderText(layoutReceipt({ ...DOC, duplicate: true, copyNo: 2 }, 32), 32);
    for (const line of text.split('\n')) expect(line.length).toBeLessThanOrEqual(32);
    expect(text).toContain('*** DUPLICATE (copy 2) ***');
  });
  it('prints the composition declaration at the top of a bill of supply (CGST rule 5(1)(g))', () => {
    const declaration = 'Composition taxable person, not eligible to collect tax on supplies';
    const lines = renderText(layoutReceipt({ ...DOC, title: 'BILL OF SUPPLY', declaration }, 42), 42).split('\n').map((l) => l.trim());
    const title = lines.indexOf('BILL OF SUPPLY');
    expect(lines.slice(title + 1, title + 3).join(' ')).toBe(declaration);
    expect(lines.filter((l) => l.startsWith('Composition'))).toHaveLength(1);
  });
  it('wraps long words and keeps amounts on the paper', () => {
    expect(wrap('Supercalifragilistic soap', 10)).toEqual(['Supercalif', 'ragilistic', 'soap']);
    expect(columns('A very long product description', '1,234.50', 20)).toBe('A very long 1,234.50');
  });
});

describe('ESC/POS encoding', () => {
  it('initialises, kicks the drawer when asked, and feeds and cuts at the end', () => {
    const bytes = encodeEscPos(layoutReceipt(DOC, 42), { openDrawer: true, cut: true });
    expect([...bytes.subarray(0, 2)]).toEqual([0x1b, 0x40]);
    expect([...bytes.subarray(2, 7)]).toEqual(DRAWER_KICK);
    expect([...bytes.subarray(-4)]).toEqual([0x1d, 0x56, 66, 0]);
    const noDrawer = encodeEscPos(layoutReceipt(DOC, 42), { openDrawer: false, cut: true });
    expect(noDrawer.includes(Buffer.from(DRAWER_KICK))).toBe(false);
  });
  it('keeps to ASCII so a plain printer code page cannot garble it', () => {
    expect(toPrinterAscii('₹10 Café चाय')).toBe('Rs10 Cafe ???');
  });
});

async function billedApp() {
  const t = await testApp();
  const api = caller(t.app);
  await ownerAtTill(t.app);
  const pcs = (await api.data<{ id: string; code: string }[]>('catalog.listUoms')).find((u) => u.code === 'PCS')!.id;
  const soap = await api.data<{ id: string }>('products.create', { name: 'Lux Soap', baseUomId: pcs, gstRateBp: 1800, sellingPricePaise: 4100 });
  t.app.register.open(0);
  const sale = t.app.sales.complete(CompleteSaleInput.parse({
    lines: [{ productId: soap.id, uomId: pcs, qtyMilli: 1000 }], commandId: newUlid(), expectedTotalPaise: 4100, tenders: [{ method: 'cash', amountPaise: 5000 }],
  }));
  await t.app.printQueue.idle();
  return { ...t, api, sale };
}

const failing = (message: string): ReceiptPrinter => ({ id: 'broken', print: () => Promise.reject(new Error(message)), kickDrawer: () => Promise.reject(new Error(message)) });
const recording = (onJob: (bytes: Buffer, name: string) => void): ReceiptPrinter => ({
  id: 'mem', print: async (job) => onJob(await job.escpos(), job.name), kickDrawer: () => Promise.resolve(),
});
const queueWith = (db: Db, printer: ReceiptPrinter, dir: string) =>
  new PrintQueue({ db: () => db, config: new PrinterConfigStore(() => db), receiptsDir: dir, log: silentLoggers().hardware, printer: () => printer });

describe('print queue', () => {
  it('prints the receipt to the simulator right after the sale', async () => {
    const { dir, sale } = await billedApp();
    const files = readdirSync(join(dir, 'receipts'));
    expect(files.some((f) => f.endsWith('-copy1.txt'))).toBe(true);
    expect(readFileSync(join(dir, 'receipts', files.find((f) => f.endsWith('.txt'))!), 'utf8')).toContain(sale.docNumber);
  });

  it('a printer failure marks the job failed and never touches the sale; retry prints it', async () => {
    const { app, db, dir, sale } = await billedApp();
    const broken = queueWith(db, failing('paper out'), dir);
    const jobId = broken.reprint(sale.saleId, 'u');
    await broken.idle();
    expect(getPrintJob(db, jobId)).toMatchObject({ status: 'failed', errorMessage: 'paper out', attemptCount: 1, isDuplicate: true, copyNo: 2 });
    expect(app.sales.get(sale.saleId).status).toBe('posted');
    app.printQueue.retry(jobId, getPrintJob(db, jobId)!.businessId);
    await app.printQueue.idle();
    expect(getPrintJob(db, jobId)).toMatchObject({ status: 'done', attemptCount: 2 });
    expect(readFileSync(join(dir, 'receipts', `${sale.docNumber.replace(/\//gu, '-')}-copy2.txt`), 'utf8')).toContain('DUPLICATE');
  });

  it('picks up jobs left queued by a crash', async () => {
    const { db, dir, sale } = await billedApp();
    const original = getPrintJob(db, db.prepare('SELECT id FROM print_job LIMIT 1').pluck().get() as string)!;
    insertPrintJob(db, 'stuck-job', { businessId: original.businessId, docType: 'sale', docId: sale.saleId, doc: original.doc, openDrawer: false, copyNo: 9, isDuplicate: true, createdBy: 'u' });
    const sent: string[] = [];
    const recovered = queueWith(db, recording((_b, name) => sent.push(name)), dir);
    recovered.resumeUnfinished(new Date().toLocaleDateString('en-CA'));
    await recovered.idle();
    expect(getPrintJob(db, 'stuck-job')!.status).toBe('done');
    expect(sent).toEqual([expect.stringContaining('copy9')]);
  });

  it('never throws when the job cannot even be recorded (for example, the database is busy)', async () => {
    const { db, dir, sale } = await billedApp();
    const queue = queueWith(db, failing('unused'), dir);
    db.exec("CREATE TRIGGER busy BEFORE UPDATE ON print_job BEGIN SELECT RAISE(ABORT, 'database is locked'); END");
    queue.reprint(sale.saleId, 'u');
    await expect(queue.idle()).resolves.toBeUndefined();
    db.exec('DROP TRIGGER busy');
  });

  it('only failed jobs of this business can be retried, and a retry never opens the drawer', async () => {
    const { api, app, db, sale } = await billedApp();
    const original = db.prepare('SELECT id FROM print_job WHERE doc_id = ?').pluck().get(sale.saleId) as string;
    expect(await api.call('printer.retryJob', { jobId: original })).toMatchObject({ ok: false, error: { code: 'INVALID_STATE' } });
    db.prepare("UPDATE print_job SET status = 'failed', error_message = 'paper out' WHERE id = ?").run(original);
    const kicks: boolean[] = [];
    const retrying = queueWith(db, recording((bytes) => kicks.push(bytes.includes(Buffer.from(DRAWER_KICK)))), '');
    retrying.retry(original, getPrintJob(db, original)!.businessId);
    await retrying.idle();
    expect(getPrintJob(db, original)!.status).toBe('done');
    expect(kicks).toEqual([false]);
    expect(() => retrying.retry(original, 'another-business')).toThrow();
    void app;
  });

  it('after a crash, an interrupted job and an old queued job are marked failed instead of printing again', async () => {
    const { db, dir, sale } = await billedApp();
    const original = getPrintJob(db, db.prepare('SELECT id FROM print_job LIMIT 1').pluck().get() as string)!;
    const add = (id: string, status: string, createdAt: string) => {
      insertPrintJob(db, id, { businessId: original.businessId, docType: 'sale', docId: sale.saleId, doc: original.doc, openDrawer: true, copyNo: 1, isDuplicate: false, createdBy: 'u' });
      db.prepare('UPDATE print_job SET status = ?, created_at = ? WHERE id = ?').run(status, createdAt, id);
    };
    add('was-printing', 'printing', new Date().toISOString());
    add('yesterday', 'queued', '2020-01-01T10:00:00.000Z');
    add('today', 'queued', new Date().toISOString());
    const sent: string[] = [];
    const q = queueWith(db, recording((_b, name) => sent.push(name)), dir);
    q.resumeUnfinished(new Date().toLocaleDateString('en-CA'));
    await q.idle();
    expect(getPrintJob(db, 'was-printing')).toMatchObject({ status: 'failed', errorMessage: expect.stringContaining('interrupted') });
    expect(getPrintJob(db, 'yesterday')).toMatchObject({ status: 'failed', errorMessage: expect.stringContaining('earlier day') });
    expect(getPrintJob(db, 'today')!.status).toBe('done');
    expect(sent).toHaveLength(1);
  });

  it('reprint over IPC creates a duplicate copy', async () => {
    const { api, app, db, sale } = await billedApp();
    const { jobId } = await api.data<{ jobId: string }>('printer.reprint', { saleId: sale.saleId });
    await app.printQueue.idle();
    expect(getPrintJob(db, jobId)).toMatchObject({ status: 'done', copyNo: 2, isDuplicate: true });
    expect(await api.data('printer.getQueue', {})).toHaveLength(2);
  });
});

describe('network printer', () => {
  it('sends the bytes to TCP port 9100-style listeners', async () => {
    const received: Buffer[] = [];
    const server = createServer((s) => s.on('data', (d) => received.push(d)));
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
    const { port } = server.address() as AddressInfo;
    await new NetworkEscPosPrinter('127.0.0.1', port, 2000).send(Buffer.from([0x1b, 0x40, 0x41]));
    await new Promise((r) => setTimeout(r, 50));
    server.close();
    expect(Buffer.concat(received)).toEqual(Buffer.from([0x1b, 0x40, 0x41]));
  });
  it('fails cleanly when nothing is listening', async () => {
    const server = createServer();
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
    const { port } = server.address() as AddressInfo;
    await new Promise<void>((r) => server.close(() => r()));
    await expect(new NetworkEscPosPrinter('127.0.0.1', port, 2000).send(Buffer.from([1]))).rejects.toThrow();
  });
});
