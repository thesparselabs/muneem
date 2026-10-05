import type { ExecFileException } from 'node:child_process';
import { PassThrough } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { CompleteSaleInput, type InstalledPrinter } from '@muneem/contracts';
import { newUlid } from '@muneem/domain';
import { getPrintJob } from '@muneem/db-sqlite';
import { silentLoggers } from '../src/main/infra/logger.js';
import { DRAWER_KICK, drawerOnly } from '../src/main/services/print/escpos.js';
import { PrintQueue } from '../src/main/services/print/printQueue.js';
import { PrinterConfigStore } from '../src/main/services/print/printerConfig.js';
import { POWERSHELL_ARGS, PowerShellRawJob, RAW_PRINT_SCRIPT, type ExecFn, type ExecOptions } from '../src/main/services/print/rawSpoolJob.js';
import type { HtmlPage } from '../src/main/services/print/receiptHtml.js';
import { MAX_JOB_BYTES, WindowsSpooler, type SpoolerTransport } from '../src/main/services/print/spooler.js';
import { caller, ownerAtTill, testApp } from './helpers.js';

interface Call { file: string; args: readonly string[]; options: ExecOptions; stdin: Buffer }

// Stands in for child_process.execFile: records what would run and answers like the helper would.
type Failure = { killed?: boolean; code?: number; message?: string };
function fakeExec(answer: (call: Call) => { error?: Failure; stderr?: string } = () => ({})) {
  const calls: Call[] = [];
  const exec: ExecFn = (file, args, options, done) => {
    const stdin = new PassThrough();
    const chunks: Buffer[] = [];
    stdin.on('data', (c: Buffer) => chunks.push(c));
    stdin.on('end', () => {
      const call = { file, args, options, stdin: Buffer.concat(chunks) };
      calls.push(call);
      const r = answer(call);
      done(r.error ? Object.assign(new Error(r.error.message ?? 'Command failed'), r.error) as ExecFileException : null, '', r.stderr ?? '');
    });
    return { stdin };
  };
  return { exec, calls };
}

const WINDOWS_ENV = { SystemRoot: 'C:\\Windows', TEMP: 'C:\\Temp' };
const TRICKY = 'EPSON"; Remove-Item C:\\ -Recurse; $x="';

describe('PowerShell RAW spooler job', () => {
  it('runs Windows PowerShell by absolute path with a fixed script; the name goes only in the environment and the bytes only on stdin', async () => {
    const { exec, calls } = fakeExec();
    const job = new PowerShellRawJob({ timeoutMs: 20_000, exec, env: WINDOWS_ENV });
    await job.run(TRICKY, Buffer.from([0x1b, 0x40, 0x41]));
    const [call] = calls;
    expect(call!.file).toBe('C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe');
    expect(call!.args).toEqual(POWERSHELL_ARGS);
    expect(call!.args.join(' ')).not.toContain('EPSON');
    const script = Buffer.from(call!.args.at(-1)!, 'base64').toString('utf16le');
    expect(script).toBe(RAW_PRINT_SCRIPT);
    expect(script).toContain('$env:MUNEEM_PRINTER');
    expect(script).toContain('DataType = "RAW"');
    expect(call!.options).toMatchObject({ env: { ...WINDOWS_ENV, MUNEEM_PRINTER: TRICKY }, timeout: 20_000, killSignal: 'SIGKILL', windowsHide: true });
    expect(call!.options).not.toHaveProperty('shell');
    expect(call!.stdin).toEqual(Buffer.from([0x1b, 0x40, 0x41]));
  });

  it('refuses names with control characters, over-long names and over-sized or empty jobs before starting anything', async () => {
    const { exec, calls } = fakeExec();
    const job = new PowerShellRawJob({ timeoutMs: 1000, exec, env: WINDOWS_ENV });
    for (const name of ['EPSON\r\nTM', 'EPSON\u0000', ' EPSON', 'x'.repeat(257), '']) {
      await expect(job.run(name, Buffer.from([1]))).rejects.toThrow('not a valid printer name');
    }
    await expect(job.run('EPSON', Buffer.alloc(MAX_JOB_BYTES + 1))).rejects.toThrow('too large');
    await expect(job.run('EPSON', Buffer.alloc(0))).rejects.toThrow('Nothing to print');
    expect(calls).toHaveLength(0);
  });

  it('a helper killed at the time limit is reported as a timeout', async () => {
    const { exec } = fakeExec(() => ({ error: { killed: true } }));
    await expect(new PowerShellRawJob({ timeoutMs: 20_000, exec, env: WINDOWS_ENV }).run('EPSON', Buffer.from([1])))
      .rejects.toThrow('did not take the job within 20 s');
  });

  it("the spooler's own reason reaches the cashier, without PowerShell noise", async () => {
    const stderr = '#< CLIXML\r\n<Objs Version="1.1.0.1"></Objs>\r\nMUNEEM-ERROR: The printer name is invalid\r\n';
    const { exec } = fakeExec(() => ({ error: { code: 3 }, stderr }));
    await expect(new PowerShellRawJob({ timeoutMs: 1000, exec, env: WINDOWS_ENV }).run('EPSON', Buffer.from([1])))
      .rejects.toThrow('The printer "EPSON" refused the job: The printer name is invalid');
  });
});

function fakeSpooler(installed: string[], behaviour: { raw?: (name: string, bytes: Buffer) => Promise<void>; page?: (name: string, page: HtmlPage) => Promise<void> } = {}) {
  const raw: { name: string; bytes: Buffer }[] = [];
  const pages: { name: string; page: HtmlPage }[] = [];
  const spooler = new WindowsSpooler({
    directory: { list: () => Promise.resolve(installed.map((name): InstalledPrinter => ({ name, displayName: name }))) },
    raw: { run: (name, bytes) => { raw.push({ name, bytes }); return behaviour.raw?.(name, bytes) ?? Promise.resolve(); } },
    pages: { print: (name, page) => { pages.push({ name, page }); return behaviour.page?.(name, page) ?? Promise.resolve(); } },
  });
  return { spooler, raw, pages };
}

describe('Windows spooler', () => {
  it('only sends to a printer Windows lists', async () => {
    const { spooler, raw } = fakeSpooler(['TVS RP3160 Gold']);
    await expect(spooler.sendRaw(TRICKY, Buffer.from([1]))).rejects.toThrow('is not installed on this computer');
    await expect(spooler.printPage('Other', { html: '', widthMicrons: 80_000, heightMicrons: 100_000 })).rejects.toThrow('is not installed');
    await spooler.sendRaw('TVS RP3160 Gold', Buffer.from([1]));
    expect(raw.map((r) => r.name)).toEqual(['TVS RP3160 Gold']);
  });
});

async function billedApp(printSpooler: SpoolerTransport, config: Record<string, unknown>) {
  const t = await testApp({ printSpooler });
  const api = caller(t.app);
  await ownerAtTill(t.app);
  await api.data('printer.setConfig', { kind: 'spooler', printerName: 'TVS RP3160 Gold', port: 9100, widthChars: 32, openDrawer: true, ...config });
  const pcs = (await api.data<{ id: string; code: string }[]>('catalog.listUoms')).find((u) => u.code === 'PCS')!.id;
  const tea = await api.data<{ id: string }>('products.create', { name: 'चाय पत्ती 250g', baseUomId: pcs, gstRateBp: 500, sellingPricePaise: 4100 });
  t.app.register.open(0);
  const sale = t.app.sales.complete(CompleteSaleInput.parse({
    lines: [{ productId: tea.id, uomId: pcs, qtyMilli: 1000 }], commandId: newUlid(), expectedTotalPaise: 4100, tenders: [{ method: 'cash', amountPaise: 5000 }],
  }));
  await t.app.printQueue.idle();
  const jobId = t.db.prepare('SELECT id FROM print_job WHERE doc_id = ?').pluck().get(sale.saleId) as string;
  return { ...t, api, sale, jobId };
}

describe('print queue on a Windows printer (NFR-012)', () => {
  it('ESC/POS mode sends one RAW job with the drawer kick after a cash sale', async () => {
    const { spooler, raw } = fakeSpooler(['TVS RP3160 Gold']);
    const { db, jobId } = await billedApp(spooler, { mode: 'escpos', rupee: 'symbol' });
    expect(getPrintJob(db, jobId)!.status).toBe('done');
    expect(raw).toHaveLength(1);
    expect([...raw[0]!.bytes.subarray(2, 7)]).toEqual(DRAWER_KICK);
  });

  it('image mode prints the page through the driver, then kicks the drawer with a RAW job', async () => {
    const { spooler, raw, pages } = fakeSpooler(['TVS RP3160 Gold']);
    const { db, jobId } = await billedApp(spooler, { mode: 'image', rupee: 'symbol' });
    expect(getPrintJob(db, jobId)!.status).toBe('done');
    expect(pages).toHaveLength(1);
    expect(pages[0]!.page).toMatchObject({ widthMicrons: 58_000 });
    expect(pages[0]!.page.html).toContain('चाय पत्ती 250g');
    expect(pages[0]!.page.html).toContain('₹ 41.00');
    expect(raw.map((r) => r.bytes)).toEqual([drawerOnly()]);
  });

  it('a drawer that fails after an image receipt printed does not fail the receipt', async () => {
    const { spooler } = fakeSpooler(['TVS RP3160 Gold'], { raw: () => Promise.reject(new Error('drawer port not wired')) });
    const { db, jobId } = await billedApp(spooler, { mode: 'image' });
    expect(getPrintJob(db, jobId)!.status).toBe('done');
  });

  it('a spooler that hangs or times out marks the job failed, leaves the sale posted, and a retry prints it', async () => {
    let behave: 'hang' | 'timeout' | 'ok' = 'hang';
    const flaky = fakeSpooler(['TVS RP3160 Gold'], {
      raw: () => (behave === 'hang' ? new Promise<void>(() => undefined)
        : behave === 'timeout' ? Promise.reject(new Error('The printer "TVS RP3160 Gold" did not take the job within 20 s')) : Promise.resolve()),
    });
    const { app, db, sale, dir } = await billedApp(fakeSpooler(['TVS RP3160 Gold']).spooler, { mode: 'escpos' });
    const queue = new PrintQueue({ db: () => db, config: new PrinterConfigStore(() => db), receiptsDir: dir, log: silentLoggers().hardware, spooler: flaky.spooler, deadlineMs: 50 });
    const jobId = queue.reprint(sale.saleId, 'u');
    await queue.idle();
    expect(getPrintJob(db, jobId)).toMatchObject({ status: 'failed', errorMessage: expect.stringContaining('did not respond in time') });
    expect(app.sales.get(sale.saleId).status).toBe('posted');

    behave = 'timeout';
    queue.retry(jobId, getPrintJob(db, jobId)!.businessId);
    await queue.idle();
    expect(getPrintJob(db, jobId)).toMatchObject({ status: 'failed', errorMessage: expect.stringContaining('did not take the job within 20 s') });

    behave = 'ok';
    queue.retry(jobId, getPrintJob(db, jobId)!.businessId);
    await queue.idle();
    expect(getPrintJob(db, jobId)).toMatchObject({ status: 'done', attemptCount: 3 });
  });

  it('lists installed printers over IPC, kicks the drawer through the spooler, and test-prints ₹ and Indic lines', async () => {
    const { spooler, raw } = fakeSpooler(['TVS RP3160 Gold', 'Microsoft Print to PDF']);
    const { api } = await billedApp(spooler, { mode: 'escpos', rupee: 'symbol' });
    expect(await api.data('printer.listInstalled')).toEqual([{ name: 'TVS RP3160 Gold', displayName: 'TVS RP3160 Gold' }, { name: 'Microsoft Print to PDF', displayName: 'Microsoft Print to PDF' }]);
    raw.length = 0;
    await api.data('drawer.open');
    expect(raw.map((r) => r.bytes)).toEqual([drawerOnly()]);
    await api.data('printer.testPrint');
    expect(raw[1]!.bytes.includes(Buffer.from('Muneem test print'))).toBe(true);
  });

  it('off Windows there are no installed printers and a spooler setting fails cleanly', async () => {
    const t = await testApp();
    const api = caller(t.app);
    await ownerAtTill(t.app);
    expect(await api.data('printer.listInstalled')).toEqual([]);
    await api.data('printer.setConfig', { kind: 'spooler', printerName: 'TVS RP3160 Gold', port: 9100, widthChars: 42, openDrawer: true });
    expect(await api.call('printer.testPrint')).toMatchObject({ ok: false });
  });
});
