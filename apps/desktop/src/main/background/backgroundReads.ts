import { Worker } from 'node:worker_threads';
import { AppError, type ErrorCode } from '@muneem/contracts';
import type { Db } from '@muneem/db-sqlite';
import { runReadJob, type JobInput, type JobOutput, type ReadJob } from './jobs.js';

export interface BackgroundReads {
  run<K extends ReadJob>(kind: K, input: JobInput<K>): Promise<JobOutput<K>>;
  close(): Promise<void>;
}

export interface JobError { code?: ErrorCode; message: string; fields?: Record<string, string> }
export type JobReply = { id: number; ok: true; value: unknown } | { id: number; ok: false; error: JobError };
export interface WorkerSetup { dbFile: string; nativeBinding?: string | undefined }

export const toJobError = (e: unknown): JobError => (e instanceof AppError
  ? { code: e.code, message: e.message, ...(e.fields && { fields: e.fields }) }
  : { message: e instanceof Error ? e.message : String(e) });
const fromJobError = (e: JobError): Error => (e.code ? new AppError(e.code, e.message, e.fields) : new Error(e.message));

// In-memory databases (tests) cannot be shared with a worker, so their jobs run here on the given connection.
export class InlineReads implements BackgroundReads {
  constructor(private readonly db: () => Db) {}
  run<K extends ReadJob>(kind: K, input: JobInput<K>): Promise<JobOutput<K>> {
    try { return Promise.resolve(runReadJob(this.db(), kind, input)); } catch (e) { return Promise.reject(e); }
  }
  close(): Promise<void> { return Promise.resolve(); }
}

// ADR-0058: one worker thread with its own read-only connection, started on first use; jobs queue in order.
export class WorkerReads implements BackgroundReads {
  private worker: Worker | null = null;
  private nextId = 1;
  private readonly pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();

  constructor(private readonly entry: string | URL, private readonly setup: WorkerSetup, private readonly execArgv: string[] = []) {}

  run<K extends ReadJob>(kind: K, input: JobInput<K>): Promise<JobOutput<K>> {
    const id = this.nextId++;
    return new Promise<JobOutput<K>>((resolve, reject) => {
      this.pending.set(id, { resolve: resolve as (v: unknown) => void, reject });
      const w = this.started();
      w.ref();
      w.postMessage({ id, kind, input });
    });
  }

  async close(): Promise<void> {
    const w = this.worker;
    this.worker = null;
    if (w) await w.terminate();
  }

  private started(): Worker {
    if (this.worker) return this.worker;
    const w = new Worker(this.entry, { workerData: this.setup, execArgv: this.execArgv });
    w.on('message', (reply: JobReply) => {
      const p = this.pending.get(reply.id);
      this.pending.delete(reply.id);
      if (this.pending.size === 0) w.unref();
      if (reply.ok) p?.resolve(reply.value); else p?.reject(fromJobError(reply.error));
    });
    w.on('error', (e) => this.failAll(e));
    w.on('exit', (code) => { if (this.worker === w) this.worker = null; if (code !== 0) this.failAll(new Error(`read worker exited with code ${code}`)); });
    this.worker = w;
    return w;
  }

  private failAll(e: Error): void {
    for (const p of this.pending.values()) p.reject(e);
    this.pending.clear();
  }
}
