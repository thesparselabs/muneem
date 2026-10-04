import { mkdirSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
import type { Change, Snapshot } from '@muneem/contracts';
import { applyChanges, finishHydration, getHydration, saveHydration, withTransaction, type Db, type Hydration, type HydrationPatch } from '@muneem/db-sqlite';
import type { Loggers } from '../../infra/logger.js';
import { isTransportError, type BundleFetcher, type Transport } from '../transport.js';
import { authorized } from '../wire.js';
import { importOrder, readHeader } from './bundleFile.js';

export const HYDRATION_PAGE = 500;
const SAVE_EVERY_BYTES = 1 << 20;
const MAX_BUILD_ATTEMPTS = 3;

export interface HydratorDeps {
  db: () => Db;
  transport: Transport;
  fetcher: BundleFetcher;
  dir: string;
  refreshAuth: () => Promise<boolean>;
  now: () => number;
  sleep: (ms: number) => Promise<void>;
  pollMs?: number;
  pageSize?: number;
  log: Loggers['sync'];
  onProgress: (h: Hydration, linesTotal: number | null) => void;
}

export interface HydrationTarget { businessId: string; cloudDeviceId: string }

const fileSize = (path: string): number => { try { return statSync(path).size; } catch { return 0; } };
const message = (e: unknown): string => (isTransportError(e) ? `${e.code}: ${e.message}` : e instanceof Error ? e.message : String(e));

// 7f: snapshot → resumable download → import in pages through the 7e apply path → cursors at asOfSeq. Every step reads
// where the last run stopped from hydration_state and the file on disk, so a killed run picks up where it was.
export class Hydrator {
  private linesTotal: number | null = null;

  constructor(private readonly d: HydratorDeps) {}

  private iso(): string { return new Date(this.d.now()).toISOString(); }
  private save(businessId: string, patch: HydrationPatch): Hydration {
    const h = saveHydration(this.d.db(), businessId, patch, this.iso());
    this.d.onProgress(h, this.linesTotal);
    return h;
  }
  private path(snapshotId: string): string { return join(this.d.dir, `${snapshotId}.ndjson.gz`); }
  private call<T>(f: (t: Transport) => Promise<T>): Promise<T> { return authorized(f, this.d.transport, this.d.refreshAuth); }

  async run(t: HydrationTarget): Promise<Hydration> {
    const existing = getHydration(this.d.db(), t.businessId);
    if (existing?.status === 'ready') return existing;
    try {
      const snapshot = this.downloaded(existing) ?? await this.readySnapshot(t.businessId);
      const path = this.path(snapshot.snapshotId);
      await this.download(t.businessId, snapshot, path);
      await this.import(t, path);
      const done = finishHydration(this.d.db(), t.businessId, snapshot.asOfSeq ?? 0, this.iso());
      rmSync(path, { force: true });
      this.d.onProgress(done, this.linesTotal);
      return done;
    } catch (e) {
      this.d.log.warn({ businessId: t.businessId, err: message(e) }, 'hydration stopped');
      return this.save(t.businessId, { status: 'failed', error: message(e) });
    }
  }

  // A bundle already whole on disk is imported without asking the cloud again, so an import resumes offline.
  private downloaded(h: Hydration | null): Snapshot | null {
    if (!h?.snapshotId || !h.bytesTotal || fileSize(this.path(h.snapshotId)) !== h.bytesTotal) return null;
    return { snapshotId: h.snapshotId, status: 'ready', asOfSeq: h.asOfSeq ?? 0, bytes: h.bytesTotal };
  }

  // The recorded snapshot if the cloud still has it, else a new one; a build that failed is asked for again.
  private async readySnapshot(businessId: string): Promise<Snapshot> {
    let snapshotId = getHydration(this.d.db(), businessId)?.snapshotId ?? null;
    for (let attempt = 0; attempt < MAX_BUILD_ATTEMPTS; attempt++) {
      if (!snapshotId) snapshotId = await this.request(businessId);
      const s = await this.poll(snapshotId);
      if (s?.status === 'ready') {
        this.save(businessId, { asOfSeq: s.asOfSeq ?? 0, bytesTotal: s.bytes ?? null });
        return s;
      }
      snapshotId = null;
    }
    throw new Error('the cloud could not build this business’s snapshot; try again later');
  }

  private async request(businessId: string): Promise<string> {
    const s = await this.call((t) => t.bootstrap({ businessId }));
    this.save(businessId, { snapshotId: s.snapshotId, status: 'pending', bytesDownloaded: 0, linesImported: 0, error: null });
    return s.snapshotId;
  }

  private async poll(snapshotId: string): Promise<Snapshot | null> {
    for (;;) {
      let s: Snapshot;
      try {
        s = await this.call((t) => t.snapshot(snapshotId));
      } catch (e) {
        if (isTransportError(e) && e.status === 404) return null;
        throw e;
      }
      if (s.status !== 'building') return s;
      await this.d.sleep(this.d.pollMs ?? 2_000);
    }
  }

  // Range from what is on disk; an expired URL is renewed by asking for the snapshot again.
  private async download(businessId: string, snapshot: Snapshot, path: string): Promise<void> {
    mkdirSync(this.d.dir, { recursive: true });
    const total = snapshot.bytes ?? 0;
    if (fileSize(path) > total && total > 0) rmSync(path);
    let url = snapshot.url!;
    let saved = fileSize(path);
    for (let renewed = false; ;) {
      const before = fileSize(path);
      if (total > 0 && before >= total) break;
      this.save(businessId, { status: 'downloading', bytesDownloaded: before, error: null });
      try {
        const after = await this.d.fetcher.download({ url, path, offset: before }, (bytes) => {
          if (bytes - saved < SAVE_EVERY_BYTES) return;
          saved = bytes;
          this.save(businessId, { bytesDownloaded: bytes });
        });
        if (total === 0) break;
        if (after <= before) throw new Error('the download stopped short');
      } catch (e) {
        if (renewed || !isTransportError(e) || e.code !== 'BUNDLE_URL_EXPIRED') throw e;
        renewed = true;
        url = (await this.call((t) => t.snapshot(snapshot.snapshotId))).url!;
      }
    }
    this.save(businessId, { bytesDownloaded: fileSize(path) });
  }

  // Pages of 500, each with its progress in one transaction: a kill replays at most one page, and replays change nothing.
  private async import(t: HydrationTarget, path: string): Promise<void> {
    const header = await readHeader(path);
    if (header.businessId !== t.businessId) throw new Error('the bundle is for another business');
    this.linesTotal = Object.values(header.counts).reduce((a, b) => a + b, 0);
    let done = getHydration(this.d.db(), t.businessId)?.linesImported ?? 0;
    this.save(t.businessId, { status: 'importing' });
    const size = this.d.pageSize ?? HYDRATION_PAGE;
    let page: Change[] = [];
    let seen = 0;
    for await (const change of importOrder(path)) {
      if (seen++ < done) continue;
      page.push(change);
      if (page.length < size) continue;
      done = this.commit(t, page, done);
      page = [];
    }
    if (page.length > 0) this.commit(t, page, done);
  }

  private commit(t: HydrationTarget, page: readonly Change[], done: number): number {
    const imported = done + page.length;
    const h = withTransaction(this.d.db(), () => {
      const r = applyChanges(this.d.db(), { ...t, includeOwn: true }, page);
      if (r.failed > 0) this.d.log.warn({ businessId: t.businessId, failed: r.failed }, 'hydration: changes listed for review');
      return saveHydration(this.d.db(), t.businessId, { linesImported: imported }, this.iso());
    });
    this.d.onProgress(h, this.linesTotal);
    return imported;
  }
}
