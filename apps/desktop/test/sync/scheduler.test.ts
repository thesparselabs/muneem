import { describe, expect, it } from 'vitest';
import { getSyncDevice } from '@muneem/db-sqlite';
import { SyncScheduler } from '../../src/main/sync/scheduler.js';
import type { SyncEngine, SyncRun } from '../../src/main/sync/syncEngine.js';
import { TransportError } from '../../src/main/sync/transport.js';
import { caller, ownerAtTill, testApp } from '../helpers.js';

// An engine that records each run and finishes it only when told to.
function fakeEngine() {
  const runs: { pull: boolean }[] = [];
  let release: (() => void) | null = null;
  const engine = {
    recovered: 0,
    retried: 0,
    recover() { this.recovered++; return 0; },
    retryNow() { this.retried++; return 0; },
    run(o: { pull: boolean }): Promise<SyncRun> {
      runs.push(o);
      return new Promise((r) => { release = () => r({ ran: true }); });
    },
  };
  const finish = async () => { const r = release; release = null; r?.(); await new Promise((x) => setImmediate(x)); };
  return { engine, runs, finish };
}

describe('sync scheduler (7d)', () => {
  it('does nothing until started; then start-up, online, nudges, the timer and retry each ask for a run, and runs never overlap', async () => {
    let now = 0;
    let tick: (() => void) | null = null;
    const { engine, runs, finish } = fakeEngine();
    const s = new SyncScheduler(engine as unknown as SyncEngine, {
      now: () => now, onError: () => undefined, setInterval: (fn) => { tick = fn; return {}; }, clearInterval: () => undefined,
    });
    s.nudge();
    s.online();
    expect(runs).toEqual([]);

    s.start();
    expect(engine.recovered).toBe(1);
    expect(runs).toEqual([{ pull: true }]);
    s.nudge();
    s.online();
    expect(runs).toHaveLength(1);
    await finish();
    expect(runs).toEqual([{ pull: true }, { pull: true }]);
    await finish();
    expect(runs).toHaveLength(2);

    now += 60_000;
    s.nudge();
    expect(runs.at(-1)).toEqual({ pull: false });
    await finish();
    now += 5 * 60_000;
    s.nudge();
    expect(runs.at(-1)).toEqual({ pull: true });
    await finish();
    tick!();
    expect(runs.at(-1)).toEqual({ pull: true });
    await finish();
    const retried = s.retry();
    expect(engine.retried).toBe(1);
    await finish();
    await retried;
    s.stop();
    s.online();
    expect(runs).toHaveLength(6);
  });

  it('a server that no longer accepts this version blocks sync until the app is updated', async () => {
    const wire = {
      push: async () => { throw new TransportError(426, 'UPGRADE_REQUIRED'); },
      pull: async () => { throw new Error('unused'); },
      bootstrap: async () => { throw new Error('unused'); },
      snapshot: async () => { throw new Error('unused'); },
    };
    const { app, db } = await testApp({ syncTransport: () => wire });
    await ownerAtTill(app);
    await app.syncEngine.run({ pull: true });
    expect(getSyncDevice(db)).toMatchObject({ status: 'upgrade_required' });
    expect(await caller(app).data('sync.retry')).toMatchObject({ state: 'blocked', detail: 'Update Muneem to keep syncing' });
  });
});
