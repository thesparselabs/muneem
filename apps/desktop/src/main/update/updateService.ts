import { AppError, type MigrationFailure, type UpdateChannel, type UpdateState, type UpdateStatus } from '@muneem/contracts';
import type { Loggers } from '../infra/logger.js';
import { channelFeedUrl, type ChannelStore } from './channels.js';
import { inRollout } from './cohort.js';
import type { InstallGate } from './installGate.js';
import type { Updater } from './updater.js';

export interface UpdateServiceDeps {
  // null when this build cannot update itself (an unpackaged dev run without a feed).
  updater: Updater | null;
  baseUrl: string;
  channels: ChannelStore;
  installationId: () => string;
  currentVersion: string;
  gate: InstallGate;
  lastMigrationFailure: () => MigrationFailure | null;
  emit: (status: UpdateStatus) => void;
  now: () => number;
  log: Loggers['app'];
}

interface Progress { state: UpdateState; availableVersion: string | null; percent: number | null; error: string | null; checkedAt: string | null }

const IDLE: Progress = { state: 'idle', availableVersion: null, percent: null, error: null, checkedAt: null };

// ADR-0049: check the channel's feed, keep to this device's rollout cohort, download in the background, install on request.
export class UpdateService {
  private p: Progress;
  private downloading: Promise<void> | null = null;
  private checking: Promise<UpdateStatus> | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(private readonly d: UpdateServiceDeps) {
    this.p = d.updater ? IDLE : { ...IDLE, state: 'disabled' };
    d.updater?.setFeed(channelFeedUrl(d.baseUrl, d.channels.get()));
  }

  status(): UpdateStatus {
    return {
      ...this.p, channel: this.d.channels.get(), currentVersion: this.d.currentVersion,
      installBlockedReason: this.p.state === 'ready' ? this.d.gate.blockedReason() : null, lastMigrationFailure: this.d.lastMigrationFailure(),
    };
  }

  checkNow(): Promise<UpdateStatus> {
    this.checking ??= this.check().finally(() => { this.checking = null; });
    return this.checking;
  }

  // Resolves once a background download started by a check has finished or failed.
  async idle(): Promise<void> {
    await this.checking;
    await this.downloading;
  }

  setChannel(channel: UpdateChannel): Promise<UpdateStatus> {
    if (channel === this.d.channels.get()) return Promise.resolve(this.status());
    if (this.downloading) throw new AppError('INVALID_STATE', 'An update is downloading; change the channel when it has finished');
    this.d.channels.set(channel);
    this.d.updater?.setFeed(channelFeedUrl(this.d.baseUrl, channel));
    this.d.log.info({ channel }, 'update channel changed');
    if (this.p.state !== 'ready') this.set({ ...IDLE, state: this.d.updater ? 'idle' : 'disabled' });
    return this.checkNow();
  }

  installNow(): UpdateStatus {
    if (!this.d.updater || this.p.state !== 'ready') throw new AppError('INVALID_STATE', 'No update is ready to install');
    const blocked = this.d.gate.blockedReason();
    if (blocked) throw new AppError('INVALID_STATE', blocked);
    this.d.log.warn({ version: this.p.availableVersion }, 'restarting to install an update');
    this.d.updater.install();
    return this.status();
  }

  start(everyMs: number, firstAfterMs: number): void {
    if (!this.d.updater || this.timer) return;
    const run = () => void this.checkNow().catch(() => undefined);
    setTimeout(run, firstAfterMs).unref?.();
    this.timer = setInterval(run, everyMs);
    this.timer.unref?.();
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private async check(): Promise<UpdateStatus> {
    const updater = this.d.updater;
    if (!updater || this.downloading || this.p.state === 'ready') return this.status();
    this.set({ ...this.p, state: 'checking', error: null });
    try {
      const offered = await updater.check();
      const checkedAt = new Date(this.d.now()).toISOString();
      if (!offered || !inRollout(this.d.installationId(), offered.stagingPercentage)) {
        if (offered) this.d.log.info({ version: offered.version, rollout: offered.stagingPercentage }, 'update not yet rolled out to this device');
        this.set({ ...IDLE, state: 'up_to_date', checkedAt });
        return this.status();
      }
      this.set({ state: 'available', availableVersion: offered.version, percent: 0, error: null, checkedAt });
      this.downloading = this.download(updater, offered.version).finally(() => { this.downloading = null; });
    } catch (e) {
      this.fail(e);
    }
    return this.status();
  }

  private async download(updater: Updater, version: string): Promise<void> {
    try {
      await updater.download((pr) => {
        const percent = Math.floor(pr.percent);
        if (this.p.state !== 'downloading' || percent !== this.p.percent) this.set({ ...this.p, state: 'downloading', percent });
      });
      this.set({ ...this.p, state: 'ready', percent: 100 });
      this.d.log.info({ version }, 'update downloaded and verified');
    } catch (e) {
      this.fail(e);
    }
  }

  private fail(e: unknown): void {
    const error = e instanceof Error ? e.message : String(e);
    this.d.log.error({ code: 'UPDATE_FAILED', err: error }, 'update check or download failed');
    this.set({ ...this.p, state: 'error', percent: null, error });
  }

  private set(p: Progress): void {
    this.p = p;
    this.d.emit(this.status());
  }
}
