import type { PullResponse, PushResponse, Snapshot } from '@muneem/contracts';
import { ServerError } from './errors.js';
import { Prng } from './prng.js';
import type { PullQuery, SyncServer } from './server.js';

export interface FaultOptions {
  seed: number;
  drop?: number;            // the request never reaches the server
  dropResponse?: number;    // the server acts on it, the answer is lost
  duplicate?: number;       // the request is delivered twice
  error500?: number;        // the server answers 500 without acting
  reorder?: number;         // the request is held until the next one finishes
  delayMs?: readonly [number, number];
  clockSkewMs?: number;     // the server's clock, as the device sees it, is this far off
}

export type FaultKind = 'drop' | 'drop_response' | 'duplicate' | 'error500' | 'reorder' | 'partition' | 'delivered';
export interface FaultEvent { call: 'push' | 'pull' | 'bootstrap' | 'snapshot'; deviceId: string; fault: FaultKind }

export class NetworkError extends ServerError {
  constructor(detail: string) { super(0, 'NETWORK_UNREACHABLE', detail); this.name = 'NetworkError'; }
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

// ADR-0042: a seeded wrapper that drops, duplicates, reorders and delays calls, partitions the network, answers 500 and skews clocks.
export class FaultInjector implements SyncServer {
  readonly events: FaultEvent[] = [];
  private readonly rng: Prng;
  private partitioned = false;
  private nextDone: Promise<void> = new Promise(() => undefined);
  private releaseNext: () => void = () => undefined;

  constructor(private readonly inner: SyncServer, private opts: FaultOptions, private readonly sleep: (ms: number) => Promise<void> = defaultSleep) {
    this.rng = new Prng(opts.seed);
    this.armNext();
  }

  configure(opts: Partial<Omit<FaultOptions, 'seed'>>): void { this.opts = { ...this.opts, ...opts }; }
  partition(on: boolean): void { this.partitioned = on; }
  heal(): void {
    this.partitioned = false;
    this.opts = { seed: this.opts.seed };
  }

  push(deviceId: string, body: unknown): Promise<PushResponse> { return this.call('push', deviceId, () => this.inner.push(deviceId, body)); }
  pull(deviceId: string, q: PullQuery): Promise<PullResponse> { return this.call('pull', deviceId, () => this.inner.pull(deviceId, q)); }
  bootstrap(deviceId: string, body: { businessId: string }): Promise<Snapshot> { return this.call('bootstrap', deviceId, () => this.inner.bootstrap(deviceId, body)); }
  snapshot(deviceId: string, snapshotId: string): Promise<Snapshot> { return this.call('snapshot', deviceId, () => this.inner.snapshot(deviceId, snapshotId)); }

  private armNext(): void {
    this.nextDone = new Promise((resolve) => { this.releaseNext = resolve; });
  }

  private record(call: FaultEvent['call'], deviceId: string, fault: FaultKind): void { this.events.push({ call, deviceId, fault }); }

  private async call<T>(call: FaultEvent['call'], deviceId: string, send: () => Promise<T>): Promise<T> {
    const o = this.opts;
    try {
      if (o.delayMs) await this.sleep(this.rng.int(o.delayMs[0], o.delayMs[1]));
      if (this.partitioned) { this.record(call, deviceId, 'partition'); throw new NetworkError('partitioned'); }
      if (this.rng.chance(o.drop ?? 0)) { this.record(call, deviceId, 'drop'); throw new NetworkError('request dropped'); }
      if (this.rng.chance(o.error500 ?? 0)) { this.record(call, deviceId, 'error500'); throw new ServerError(500, 'SERVER_BUSY'); }
      if (this.rng.chance(o.reorder ?? 0)) {
        this.record(call, deviceId, 'reorder');
        await Promise.race([this.nextDone, this.sleep(25)]);
      }
      const duplicate = this.rng.chance(o.duplicate ?? 0);
      const answer = await send();
      if (duplicate) { this.record(call, deviceId, 'duplicate'); await send().catch(() => undefined); }
      if (this.rng.chance(o.dropResponse ?? 0)) { this.record(call, deviceId, 'drop_response'); throw new NetworkError('response lost'); }
      this.record(call, deviceId, 'delivered');
      return this.skewed(answer);
    } finally {
      this.releaseNext();
      this.armNext();
    }
  }

  private skewed<T>(answer: T): T {
    const skew = this.opts.clockSkewMs ?? 0;
    const a = answer as { serverTime?: string };
    if (!skew || typeof a.serverTime !== 'string') return answer;
    return { ...answer, serverTime: new Date(Date.parse(a.serverTime) + skew).toISOString() };
  }
}
