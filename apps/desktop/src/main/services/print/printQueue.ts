import { AppError, type PrintJobSummary, type ReceiptDoc } from '@muneem/contracts';
import { newUlid } from '@muneem/domain';
import {
  firstPrintJobFor, getPrintJob, insertPrintJob, listPrintJobs, markPrintJob, nextCopyNo, unfinishedPrintJobs, type Db,
} from '@muneem/db-sqlite';
import type { Logger } from '../../infra/logger.js';
import { drawerOnly, encodeEscPos } from './escpos.js';
import { layoutReceipt, renderText } from './layout.js';
import type { PrinterConfigStore } from './printerConfig.js';
import { printerFor, type ReceiptPrinter } from './printers.js';

export interface PrintQueueDeps {
  db: () => Db;
  config: PrinterConfigStore;
  receiptsDir: string;
  log: Logger;
  timeoutMs?: number;
  printer?: (config: ReturnType<PrinterConfigStore['get']>) => ReceiptPrinter;
}

const DEFAULT_TIMEOUT_MS = 5000;

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

  async openDrawer(): Promise<void> {
    await this.printer().send(drawerOnly(), '[drawer]', `drawer-${newUlid()}`);
    this.d.log.info('drawer opened on request');
  }

  async testPrint(): Promise<void> {
    const config = this.d.config.get();
    const lines = [{ text: 'Muneem test print', align: 'center' as const, bold: true }, { text: `Width ${config.widthChars} columns`, align: 'center' as const }];
    await this.printer().send(encodeEscPos(lines, { openDrawer: false, cut: true }), renderText(lines, config.widthChars), `test-${newUlid()}`);
  }

  private printer(): ReceiptPrinter {
    const config = this.d.config.get();
    return this.d.printer ? this.d.printer(config) : printerFor(config, this.d.receiptsDir, this.d.timeoutMs ?? DEFAULT_TIMEOUT_MS);
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
      const lines = layoutReceipt(job.doc as ReceiptDoc, config.widthChars);
      const firstAttempt = job.attemptCount === 0;
      const bytes = encodeEscPos(lines, { openDrawer: job.openDrawer && firstAttempt && config.openDrawer, cut: true });
      await this.printer().send(bytes, renderText(lines, config.widthChars), `${(job.doc as ReceiptDoc).docNumber.replace(/\//gu, '-')}-copy${job.copyNo}`);
      markPrintJob(db, jobId, 'done');
      this.d.log.info({ jobId, copyNo: job.copyNo }, 'receipt printed');
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      markPrintJob(db, jobId, 'failed', message);
      this.d.log.warn({ jobId, err: message }, 'receipt print failed');
    }
  }
}
