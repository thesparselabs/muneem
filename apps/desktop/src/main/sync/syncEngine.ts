import { getSyncDevice, queueUnsentAudit, reclaimStale, recordPull, recordPush, retryNow, setSyncDeviceStatus, type Db, type PageResult } from '@muneem/db-sqlite';
import type { Loggers } from '../infra/logger.js';
import { Puller } from './puller.js';
import { Pusher, type PushOutcome } from './pusher.js';
import { isTransportError, type Transport } from './transport.js';
import { block, readiness, type IdentitySource } from './wire.js';

export const RECLAIM_AFTER_MS = 5 * 60_000;

export interface SyncEngineDeps {
  db: () => Db;
  transport: Transport;
  device: IdentitySource;
  businessId: () => string | null;
  schemaVersion: () => number;
  refreshAuth: () => Promise<boolean>;
  now: () => number;
  random: () => number;
  log: Loggers['sync'];
  onStatus: () => void;
  onApplied: (r: PageResult) => void;
  holds?: (businessId: string) => boolean;
}

export interface SyncRun { ran: boolean; reason?: string; push?: PushOutcome; pull?: PageResult; error?: string }

const message = (e: unknown): string => (isTransportError(e) ? `${e.code}: ${e.message}` : e instanceof Error ? e.message : String(e));

// Main's half of sync (7d/7e): the only writer of SQLite, driving whichever transport it was given.
export class SyncEngine {
  private readonly pusher: Pusher;
  private readonly puller: Puller;

  constructor(private readonly d: SyncEngineDeps) {
    this.pusher = new Pusher(d);
    this.puller = new Puller(d);
  }

  private iso(): string { return new Date(this.d.now()).toISOString(); }

  // Start-up recovery: operations claimed by a process that died mid-push go back to pending, a version block is
  // lifted so an updated app asks the server again, and audit rows not yet queued (from before 8g, or a restore) are.
  recover(): number {
    if (getSyncDevice(this.d.db())?.status === 'upgrade_required') setSyncDeviceStatus(this.d.db(), 'active', null);
    const audit = queueUnsentAudit(this.d.db());
    if (audit > 0) this.d.log.info({ audit }, 'queued audit rows for the cloud');
    const n = reclaimStale(this.d.db(), new Date(this.d.now() - RECLAIM_AFTER_MS).toISOString());
    if (n > 0) this.d.log.warn({ reclaimed: n }, 'reclaimed in-flight sync operations');
    return n;
  }

  retryNow(): number {
    const businessId = this.d.businessId();
    return businessId ? retryNow(this.d.db(), businessId) : 0;
  }

  async run(opts: { pull: boolean }): Promise<SyncRun> {
    const db = this.d.db();
    const ready = readiness(db, this.d.device, this.d.businessId(), this.d.schemaVersion());
    if (!ready.ready) return { ran: false, reason: ready.reason };
    if (this.d.holds?.(ready.identity.businessId)) return { ran: false, reason: 'This device is still importing the business' };
    const run: SyncRun = { ran: true };
    run.push = await this.pusher.pushAll(ready.identity);
    recordPush(db, this.iso(), run.push.error === null, run.push.error);
    this.d.onStatus();
    if (opts.pull && run.push.error === null) await this.pull(run, ready.identity);
    return run;
  }

  private async pull(run: SyncRun, identity: Parameters<Puller['pullAll']>[0]): Promise<void> {
    try {
      run.pull = await this.puller.pullAll(identity);
      recordPull(this.d.db(), this.iso(), true, run.pull.failed > 0 ? `${run.pull.failed} pulled changes could not be applied; see Review Items` : null);
      if (run.pull.failed > 0) this.d.log.warn({ failed: run.pull.failed }, 'pulled changes skipped and listed for review');
      if (run.pull.applied > 0) this.d.onApplied(run.pull);
    } catch (e) {
      block(this.d.db(), e);
      run.error = message(e);
      recordPull(this.d.db(), this.iso(), false, run.error);
      this.d.log.warn({ err: run.error }, 'sync pull failed');
    }
    this.d.onStatus();
  }
}
