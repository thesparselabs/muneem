import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { RestoreResult } from '@muneem/contracts';
import { canonicalJson, restoreDatabaseFile } from '@muneem/db-sqlite';
import type { App } from '../../src/main/app.js';
import { MemorySecretStore } from '../../src/main/infra/secrets.js';
import { caller, USER_ID } from '../helpers.js';
import { FakeBackupCloud } from '../backups/fakeBackupCloud.js';
import { runSoak } from '../soak/generator.js';
import { DEVICE_C } from '../sync/cloudHarness.js';
import { books, bundleDownloader, DEVICE_A, DEVICE_B, healthy, hydrate, ownerMembership, referenceCloud, syncedAppOptions, syncedDevice, syncUntilQuiet } from '../sync/syncHelpers.js';

const HEALTHY = { tieOuts: [], replay: [], partyMismatches: [], allocationFaults: [] };
const LOGIN = { identifier: '9999999999', password: 'correct-horse' };
const DAYS = Number(process.env.MUNEEM_EXIT_DAYS ?? 420);

// The Trial Balance as the bytes a report would hand over: canonical JSON, one string per date.
const trialBalances = (app: App, dates: readonly string[]) => dates.map((asOf) => canonicalJson(app.statements.trialBalance({ asOf })));

// Stage 8 exit (LLD §20): restore-to-new-device produces a byte-identical Trial Balance, by hydration and by cloud backup.
describe('Stage 8 exit: a restored device has the byte-identical Trial Balance', () => {
  afterEach(() => { vi.useRealTimers(); });

  it(`after ${DAYS} days with returns, GST set-offs and two year-ends, B (hydrated) and C (cloud backup) match A at every month end`, async () => {
    const cloud = referenceCloud();
    cloud.registerDevice(DEVICE_C, USER_ID);
    const objects = new FakeBackupCloud();
    let businessId = '';
    const memberships = () => (businessId ? [ownerMembership(businessId)] : []);
    const backupOpts = { backupTransport: objects.transportFor.bind(objects), bundleFetcher: objects.downloader() };

    vi.useFakeTimers({ toFake: ['Date'] });
    const run = await runSoak({
      seed: 8, days: DAYS, salesPerDay: 3, endDate: '2026-04-20', file: true, setTime: (ms) => vi.setSystemTime(ms), yearEnd: true,
      appOptions: { ...syncedAppOptions(cloud, DEVICE_A, memberships), ...backupOpts },
    });
    businessId = run.businessId;
    expect(run.yearEnd.closed.map((c) => c.fy)).toEqual(['2024-25', '2025-26']);
    expect(run.counts.creditNotes).toBeGreaterThan(0);
    await syncUntilQuiet(run.app);
    await caller(run.app).data('backups.runNow');
    expect(await run.app.backups.uploader.uploadPending()).toEqual({ uploaded: 1, failed: 0 });
    const dates = [...run.monthEnds, run.endDate];

    // B: a new device hydrated from the cloud's bundle.
    const b = await syncedDevice(cloud, DEVICE_B, memberships, { coldStart: 'hydrate', bundleFetcher: bundleDownloader(cloud) });
    await caller(b.app).data('auth.login', LOGIN);
    expect((await hydrate(b.app, businessId)).status).toBe('ready');

    // C: a new device restored from the encrypted cloud backup, then caught up by a pull.
    const secretsC = new MemorySecretStore();
    const installed: string[] = [];
    const c = await syncedDevice(cloud, DEVICE_C, memberships, { file: true, secrets: secretsC, restoreHost: { install: (f) => { installed.push(f); } }, ...backupOpts });
    await caller(c.app).data('auth.login', LOGIN);
    expect(await caller(c.app).data<RestoreResult>('backups.restoreFromCloud', { businessId, confirm: true })).toMatchObject({ restarting: true });
    const cFile = join(c.dir, 'muneem.sqlite');
    c.app.closeReadConnections();
    c.db.close();
    restoreDatabaseFile(installed[0]!, cFile);
    rmSync(installed[0]!, { force: true });
    const c2 = await syncedDevice(cloud, DEVICE_C, memberships, { dbFile: cFile, secrets: secretsC, ...backupOpts });
    await caller(c2.app).data('auth.login', LOGIN);
    await syncUntilQuiet(c2.app);

    const reference = trialBalances(run.app, dates);
    expect(reference.length).toBeGreaterThan(12);
    expect(trialBalances(b.app, dates)).toEqual(reference);
    expect(trialBalances(c2.app, dates)).toEqual(reference);
    for (const db of [b.db, c2.db]) {
      expect(books(db, businessId)).toEqual(books(run.db, businessId));
      expect(healthy(db, businessId)).toEqual(HEALTHY);
    }
    console.info(`exit: ${run.counts.sales} sales, ${dates.length} Trial Balances byte-identical on A, B (hydrated) and C (cloud backup)`);
  }, 900_000);
});
