import type { CloudClient } from './cloudClient.js';
import type { EventBus } from './events.js';

/** Real HTTP probe, never navigator.onLine (LLD §8.3). */
export class Connectivity {
  online = false;
  lastProbeAt: string | null = null;
  serverSkewMs: number | null = null;
  private timer: NodeJS.Timeout | null = null;

  constructor(private readonly cloud: CloudClient, private readonly events: EventBus, private readonly intervalMs = 30_000) {}

  start(): void {
    void this.probe();
    this.timer = setInterval(() => void this.probe(), this.intervalMs);
    this.timer.unref?.();
  }
  stop(): void { if (this.timer) clearInterval(this.timer); this.timer = null; }

  async probe(): Promise<boolean> {
    const was = this.online;
    try {
      const r = await this.cloud.request<{ server_time: string }>('GET', '/health', undefined, { auth: false });
      this.online = true;
      const st = Date.parse(r.data?.server_time ?? '');
      if (Number.isFinite(st)) this.serverSkewMs = st - Date.now();
    } catch {
      this.online = false;
    }
    this.lastProbeAt = new Date().toISOString();
    if (was !== this.online) this.events.emit('connectivity.changed', this.snapshot());
    return this.online;
  }
  snapshot() { return { online: this.online, lastProbeAt: this.lastProbeAt, serverSkewMs: this.serverSkewMs }; }
}
