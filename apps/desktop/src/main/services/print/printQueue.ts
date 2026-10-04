import { AppError, type InstalledPrinter, type PrintJobSummary, type PrinterConfig, type ReceiptDoc } from '@muneem/contracts';
import { newUlid } from '@muneem/domain';
import {
  firstPrintJobFor, getPrintJob, insertPrintJob, listPrintJobs, markPrintJob, nextCopyNo, unfinishedPrintJobs, type Db,
} from '@muneem/db-sqlite';
import type { Logger } from '../../infra/logger.js';
import { renderEscPos } from './escpos.js';
import { layoutReceipt, renderText, rupeeText, type PrintLine } from './layout.js';
import type { PrinterConfigStore } from './printerConfig.js';
import { printerFor, type ReceiptJob, type ReceiptPrinter } from './printers.js';
import type { LineRasteriser } from './raster.js';
import { receiptHtml } from './receiptHtml.js';
import { noSpooler, type SpoolerTransport } from './spooler.js';

export interface PrintQueueDeps {
  db: () => Db;
  config: PrinterConfigStore;
  receiptsDir: string;
  log: Logger;
  timeoutMs?: number;
  deadlineMs?: number;
  spooler?: SpoolerTransport;
  rasteriser?: LineRasteriser;
  printer?: (config: PrinterConfig) => ReceiptPrinter;
}

const DEFAULT_TIMEOUT_MS = 5000;
// Every transport has its own timeout; this outer bound catches one that hangs anyway, so the queue always moves on.
const DEFAULT_DEADLINE_MS = 30_000;

function withDeadline<T>(work: Promise<T>, ms: number, message: string): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const late = new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error(message)), ms); });
  return Promise.race([work, late]).finally(() => clearTimeout(timer));
}

// Jobs print one at a time, after the sale has committed; every outcome is recorded on the job and nothing is thrown back.
export class PrintQueue {
  private chain: Promise<void> = Promise.resolve();
  constructor(private readonly d: PrintQueueDeps) {}

  enqueue(jobId: string): void { this.chain = this.chain.then(() => this.process(jobId)); }
  idle(): Promise<void> { return this.chain; }

  // A job caught mid-print may already be on paper, and yesterday's queue is stale; both wait for the cashier instead.
  resumeUnfinished(today: string): void {
    const db = this.d.db();
    for (const job of unfinishedPrintJobs(db)) {
      if (job.status === 'printing') markPrintJob(db, job.id, 'failed', 'interrupted while printing; check the printer, then retry or reprint');
      else if (new Date(job.createdAt).toLocaleDateString('en-CA') < today) markPrintJob(db, job.id, 'failed', 'not printed before the app closed on an earlier day; retry if still needed');
      else this.enqueue(job.id);
    }
  }

  retry(jobId: string, businessId: string): void {
    const job = getPrintJob(this.d.db(), jobId);
    if (!job || job.businessId !== businessId) throw new Error('NOT_FOUND');
    if (job.status !== 'failed') throw new AppError('INVALID_STATE', 'Only a receipt that failed to print can be retried; use Reprint for another copy');
    markPrintJob(this.d.db(), jobId, 'queued');
    this.enqueue(jobId);
  }

  reprint(saleId: string, createdBy: string): string {
    const db = this.d.db();
    const original = firstPrintJobFor(db, saleId);
    if (!original) throw new Error('NOT_FOUND');
    const copyNo = nextCopyNo(db, saleId);
    const id = newUlid();
    insertPrintJob(db, id, {
      businessId: original.businessId, docType: original.docType, docId: saleId, copyNo, isDuplicate: true, openDrawer: false, createdBy,
      doc: { ...(original.doc as ReceiptDoc), duplicate: true, copyNo },
    });
    this.enqueue(id);
    return id;
  }

  list(businessId: string, limit: number): PrintJobSummary[] { return listPrintJobs(this.d.db(), businessId, limit); }

  installedPrinters(): Promise<InstalledPrinter[]> {
    return withDeadline((this.d.spooler ?? noSpooler).list(), this.deadline(), 'Windows did not list its printers in time');
  }

  async openDrawer(): Promise<void> {
    await withDeadline(this.printer().kickDrawer(), this.deadline(), 'The printer did not open the drawer in time');
    this.d.log.info('drawer opened on request');
  }

  // Shows on paper whether ₹ and Indic text come out right on this printer.
  async testPrint(): Promise<void> {
    const config = this.d.config.get();
    const lines: PrintLine[] = [
      { text: 'Muneem test print', align: 'center', bold: true },
      { text: `Width ${config.widthChars} columns`, align: 'center' },
      { text: `Rupee: ${rupeeText(config.rupee)} 1,234.50`, align: 'left' },
      { text: 'हिंदी: नमस्ते, धन्यवाद', align: 'left' },
      { text: 'தமிழ்: வணக்கம்', align: 'left' },
    ];
    await withDeadline(this.printer().print(this.job(lines, `test-${newUlid()}`, false, config)), this.deadline(), 'The printer did not respond in time');
  }

  private deadline(): number { return this.d.deadlineMs ?? DEFAULT_DEADLINE_MS; }

  private printer(): ReceiptPrinter {
    const config = this.d.config.get();
    if (this.d.printer) return this.d.printer(config);
    return printerFor(config, {
      receiptsDir: this.d.receiptsDir, timeoutMs: this.d.timeoutMs ?? DEFAULT_TIMEOUT_MS, ...(this.d.spooler && { spooler: this.d.spooler }),
      onDrawerError: (e) => this.d.log.warn({ err: e instanceof Error ? e.message : String(e) }, 'receipt printed but the drawer did not open'),
    });
  }

  private job(lines: PrintLine[], name: string, openDrawer: boolean, config: PrinterConfig): ReceiptJob {
    return {
      name, openDrawer, text: renderText(lines, config.widthChars),
      escpos: () => renderEscPos(lines, config.widthChars, { openDrawer, cut: true, rupee: config.rupee }, this.d.rasteriser,
        (e) => this.d.log.warn({ err: e instanceof Error ? e.message : String(e) }, 'could not draw a receipt line as an image; it prints as plain text')),
      page: () => receiptHtml(lines, config.widthChars),
    };
  }

  private async process(jobId: string): Promise<void> {
    try {
      await this.print(jobId);
    } catch (e) {
      this.d.log.error({ jobId, err: e instanceof Error ? e.message : String(e) }, 'print queue could not record a job; it will be retried at next start');
    }
  }

  private async print(jobId: string): Promise<void> {
    const db = this.d.db();
    const job = getPrintJob(db, jobId);
    if (!job || job.status === 'done' || job.status === 'cancelled') return;
    markPrintJob(db, jobId, 'printing');
    const config = this.d.config.get();
    try {
      const doc = job.doc as ReceiptDoc;
      const lines = layoutReceipt(doc, config.widthChars, config.rupee);
      const openDrawer = job.openDrawer && job.attemptCount === 0 && config.openDrawer;
      const receipt = this.job(lines, `${doc.docNumber.replace(/\//gu, '-')}-copy${job.copyNo}`, openDrawer, config);
      await withDeadline(this.printer().print(receipt), this.deadline(), 'The printer did not respond in time; check the paper before retrying');
      markPrintJob(db, jobId, 'done');
      this.d.log.info({ jobId, copyNo: job.copyNo }, 'receipt printed');
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      markPrintJob(db, jobId, 'failed', message);
      this.d.log.warn({ jobId, err: message }, 'receipt print failed');
    }
  }
}
