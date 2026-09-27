/**
 * LIVE end-to-end (LLD §20 Stage 1 exit criterion): spawns the real Go API against the dev Postgres,
 * drives the desktop's real services (no fake fetch), then kills the server and logs in offline.
 * Opt-in: MUNEEM_LIVE_E2E=1 pnpm --filter @muneem/desktop exec vitest run test/e2e-live.test.ts
 * Requires: `docker compose up -d postgres && make -C cloud migrate-up db-roles`.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { migrate, openDatabase, verifyAuditChain, type Db } from '@muneem/db-sqlite';
import { createApp, type App } from '../src/main/app.js';
import { silentLoggers } from '../src/main/infra/logger.js';
import { MemorySecretStore } from '../src/main/infra/secrets.js';

const LIVE = !!process.env.MUNEEM_LIVE_E2E;
const PORT = 18080;
const BASE = `http://127.0.0.1:${PORT}/v1`;
const DATABASE_URL = process.env.MUNEEM_E2E_DATABASE_URL ?? 'postgres://muneem_app:muneem_app@localhost:5433/muneem?sslmode=disable';

let server: ChildProcess | null = null;
let app: App;
let db: Db;
const identifier = `9${String(Date.now()).slice(-9)}`; // unique mobile per run
const password = 'correct-horse-battery';

async function waitHealth(ms: number): Promise<void> {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    try { const r = await fetch(`${BASE}/health`); if (r.ok) return; } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error('Go API did not become healthy');
}

describe.skipIf(!LIVE)('LIVE Stage 1: install → register device → login → unplug → login offline', () => {
  beforeAll(async () => {
    // Build first and spawn the binary directly: killing `go run` would orphan the real server process.
    const cloudDir = resolve(__dirname, '../../../cloud');
    const bin = join(mkdtempSync(join(tmpdir(), 'muneem-api-')), 'api');
    await new Promise<void>((ok, fail) => {
      const b = spawn('go', ['build', '-o', bin, './cmd/api'], { cwd: cloudDir, stdio: ['ignore', 'ignore', 'inherit'] });
      b.on('exit', (code) => (code === 0 ? ok() : fail(new Error(`go build exited ${code}`))));
    });
    server = spawn(bin, [], {
      cwd: cloudDir,
      env: { ...process.env, DATABASE_URL, JWT_SECRET: 'e2e-secret', PORT: String(PORT), LOG_LEVEL: 'warn' },
      stdio: ['ignore', 'ignore', 'inherit'],
    });
    await waitHealth(90_000);
    const dir = mkdtempSync(join(tmpdir(), 'muneem-e2e-'));
    const file = join(dir, 'muneem.sqlite');
    db = openDatabase(file, { quickCheck: false });
    await migrate(db);
    app = createApp({
      db: () => db, dbFile: file, backupsDir: join(dir, 'backups'), bundlesDir: join(dir, 'bundles'),
      secrets: new MemorySecretStore(), loggers: silentLoggers(), apiBaseUrl: BASE, appVersion: '0.0.0-e2e', platform: 'linux',
      probeIntervalMs: 3_600_000,
    });
    app.device.ensureIdentity();
    await app.connectivity.probe();
  }, 120_000);

  afterAll(() => { server?.kill('SIGKILL'); db?.close(); });

  it('registers a user on the real server', async () => {
    expect(app.connectivity.online).toBe(true);
    const r = await app.auth.register({ name: 'E2E Owner', identifier, password });
    expect(r.userId).toMatch(/^[0-9A-Z]{26}$/);
  });

  it('logs in online, which registers the device and caches an offline credential', async () => {
    const s = await app.auth.login({ identifier, password });
    expect(s.mode).toBe('online');
    expect(s.user.identifier).toBe(identifier);
    expect(app.device.cloudDeviceId()).toMatch(/^[0-9A-Z]{26}$/);
    expect(db.prepare('SELECT COUNT(*) AS n FROM user_credential').get()).toEqual({ n: 1 });
  });

  it('a device-signed request verifies on the Go side (unix-seconds timestamp, raw Ed25519 key)', async () => {
    const me = await app.cloud.request<{ user: { identifier: string }; organizations: unknown[] }>('GET', '/me');
    expect(me.status).toBe(200);
    expect(me.data.user.identifier).toBe(identifier);
    expect(me.data.organizations.length).toBeGreaterThan(0);
    expect(me.headers.get('x-server-time')).toBeTruthy();
  });

  it('creates business/branch/terminal locally with audit chain + outbox (Stage 7 will push them)', () => {
    const b = app.business.create({ name: 'E2E Store', businessType: 'retail', stateCode: '07', taxScheme: 'regular', fyStartMonth: 4 });
    const br = app.business.createBranch({ code: 'DEL1', name: 'Delhi', stateCode: '07', isDefault: true });
    const t = app.business.createTerminal({ branchId: br.id, code: 'T01', name: 'Counter 1' });
    app.business.selectTerminal(t.id);
    const st = app.syncStatus();
    expect(st.state).toBe('queued');
    expect(st.pending).toBeGreaterThanOrEqual(3);
    expect(verifyAuditChain(db, b.id, app.device.localDeviceId()).ok).toBe(true);
  });

  it('after the server dies, offline login works with the cached credential and the wrong password fails', async () => {
    server!.kill('SIGKILL');
    await new Promise((r) => setTimeout(r, 500));
    await app.connectivity.probe();
    expect(app.connectivity.online).toBe(false);
    await app.auth.logout().catch(() => undefined);
    const s = await app.auth.loginOffline({ identifier, password });
    expect(s.mode).toBe('offline');
    expect(s.offlineDaysRemaining).toBeGreaterThan(0);
    await expect(app.auth.loginOffline({ identifier, password: 'wrong' })).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
    // auth.login must fall back to offline transparently when unreachable (FR-004)
    const s2 = await app.auth.login({ identifier, password });
    expect(s2.mode).toBe('offline');
  }, 30_000);
});
