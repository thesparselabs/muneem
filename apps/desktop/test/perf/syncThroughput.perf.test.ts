import { gzipSync } from 'node:zlib';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PushRequest } from '@muneem/contracts';
import { runSoak } from '../soak/generator.js';
import { DEVICE_A, referenceCloud, referenceTransport, syncedAppOptions, syncUntilQuiet } from '../sync/syncHelpers.js';

const LINK_BPS = 512_000;
const ROUND_TRIP_MS = 400;
const WINDOW_MS = 10 * 60_000;

// NFR-022: 5,000 queued operations drain within 10 minutes on a 512 kbps link; the link time is modelled from the gzipped bodies actually sent.
describe('sync throughput (7h, NFR-022)', () => {
  afterEach(() => { vi.useRealTimers(); });

  it('a device holding 5,000+ operations drains them, batched and compressed, inside the stated window', async () => {
    const cloud = referenceCloud();
    const sent: number[] = [];
    vi.useFakeTimers({ toFake: ['Date'] });
    const run = await runSoak({
      seed: 22, days: 50, salesPerDay: 90, endDate: '2026-04-05', file: false, setTime: (ms) => vi.setSystemTime(ms),
      appOptions: {
        ...syncedAppOptions(cloud, DEVICE_A),
        syncTransport: (creds) => {
          const inner = referenceTransport(cloud, () => creds()?.deviceId ?? null);
          return { ...inner, push: (r: PushRequest) => { sent.push(gzipSync(Buffer.from(JSON.stringify(r), 'utf8')).length); return inner.push(r); } };
        },
      },
    });
    vi.useRealTimers();
    const queued = run.db.prepare("SELECT COUNT(*) FROM sync_outbox WHERE status = 'pending'").pluck().get() as number;
    expect(queued).toBeGreaterThanOrEqual(5000);

    const t0 = performance.now();
    await syncUntilQuiet(run.app, 200);
    const cpuMs = performance.now() - t0;
    const bytes = sent.reduce((s, n) => s + n, 0);
    const linkMs = (bytes * 8 * 1000) / LINK_BPS + sent.length * ROUND_TRIP_MS;
    console.info(`NFR-022: ${queued} operations in ${sent.length} pushes, ${(bytes / 1024).toFixed(0)} KiB gzipped, link ${(linkMs / 1000).toFixed(0)} s, local ${(cpuMs / 1000).toFixed(1)} s`);
    expect(run.db.prepare("SELECT COUNT(*) FROM sync_outbox WHERE status NOT IN ('sent', 'superseded')").pluck().get()).toBe(0);
    expect(Math.max(...sent)).toBeLessThanOrEqual(2 * 1024 * 1024);
    expect(linkMs + cpuMs).toBeLessThan(WINDOW_MS);
  }, 600_000);
});
