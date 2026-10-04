import type { SyncEngine, SyncRun } from './syncEngine.js';

export interface SchedulerOptions {
  intervalMs?: number;
  busyPullEveryMs?: number;
  now: () => number;
  setInterval?: (fn: () => void, ms: number) => { unref?: () => void };
  clearInterval?: (handle: unknown) => void;
  onError: (e: unknown) => void;
}

// 7d triggers: start-up, back online, a nudge after each committed command, a 60 s timer and a manual retry.
// Runs never overlap; a trigger during a run asks for one more. Nudges push at once and pull at most every 5 minutes.
// Nothing runs until start(), so a composed app without sync (tests, setup) never touches the wire.
export class SyncScheduler {
  private started = false;
  private running: Promise<void> | null = null;
  private again: { pull: boolean } | null = null;
  private lastPullAt = Number.NEGATIVE_INFINITY;
  private timer: unknown = null;
  private lastRun: SyncRun | null = null;

  constructor(private readonly engine: SyncEngine, private readonly o: SchedulerOptions) {}

  start(): void {
    if (this.started) return;
    this.started = true;
    this.engine.recover();
    this.request({ pull: true });
    const every = this.o.setInterval ?? ((fn, ms) => setInterval(fn, ms));
    const t = every(() => this.request({ pull: true }), this.o.intervalMs ?? 60_000);
    t.unref?.();
    this.timer = t;
  }

  stop(): void {
    this.started = false;
    if (this.timer !== null) (this.o.clearInterval ?? ((h) => clearInterval(h as NodeJS.Timeout)))(this.timer);
    this.timer = null;
  }

  online(): void { this.request({ pull: true }); }
  nudge(): void { this.request({ pull: this.o.now() - this.lastPullAt >= (this.o.busyPullEveryMs ?? 5 * 60_000) }); }

  retry(): Promise<void> {
    this.engine.retryNow();
    this.request({ pull: true });
    return this.idle();
  }

  // After a hydration: a normal pull at once, through the scheduler when it runs, so runs never overlap.
  pullNow(): Promise<void> {
    if (!this.started) return this.engine.run({ pull: true }).then(() => undefined);
    this.request({ pull: true });
    return this.idle();
  }

  async idle(): Promise<void> {
    while (this.running) await this.running;
  }

  last(): SyncRun | null { return this.lastRun; }

  private request(r: { pull: boolean }): void {
    if (!this.started) return;
    if (this.running) {
      this.again = { pull: (this.again?.pull ?? false) || r.pull };
      return;
    }
    this.running = this.loop(r).finally(() => { this.running = null; });
  }

  private async loop(first: { pull: boolean }): Promise<void> {
    let next: { pull: boolean } | null = first;
    while (next) {
      const pull = next.pull;
      this.again = null;
      try {
        this.lastRun = await this.engine.run({ pull });
        if (pull && this.lastRun.ran) this.lastPullAt = this.o.now();
      } catch (e) {
        this.o.onError(e);
      }
      next = this.again;
    }
  }
}
