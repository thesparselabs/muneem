import type { PrintJobSummary, ReceiptDoc } from '@muneem/contracts';
import { newUlid } from '@muneem/domain';
import {
  firstPrintJobFor, getPrintJob, insertPrintJob, listPrintJobs, markPrintJob, nextCopyNo, unfinishedPrintJobIds, type Db,
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

  resumeUnfinished(): void { for (const id of unfinishedPrintJobIds(this.d.db())) this.enqueue(id); }

  retry(jobId: string): void {
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
    const db = this.d.db();
    const job = getPrintJob(db, jobId);
    if (!job || job.status === 'done' || job.status === 'cancelled') return;
    markPrintJob(db, jobId, 'printing');
    const config = this.d.config.get();
    try {
      const lines = layoutReceipt(job.doc as ReceiptDoc, config.widthChars);
      const bytes = encodeEscPos(lines, { openDrawer: job.openDrawer && config.openDrawer, cut: true });
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
