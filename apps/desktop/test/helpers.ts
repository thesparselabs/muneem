import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { ROLE_PRESETS } from '@muneem/contracts';
import { migrate, openDatabase, type Db } from '@muneem/db-sqlite';
import { createApp, type App } from '../src/main/app.js';
import { silentLoggers } from '../src/main/infra/logger.js';
import { MemorySecretStore, type SecretStore } from '../src/main/infra/secrets.js';
import type { BundleFetcher, Credentials, Transport } from '../src/main/sync/transport.js';
import type { ColdStart } from '../src/main/sync/hydration/hydrationGate.js';
import type { SaveFile } from '../src/main/reports/service.js';
import type { PdfRenderer } from '../src/main/reports/exports/pdf.js';
import type { BackupTransport, RestoreHost } from '../src/main/backups/index.js';
import type { CrashSend } from '../src/main/telemetry/crashReports.js';
import type { Updater } from '../src/main/update/updater.js';
import type { SpoolerTransport } from '../src/main/services/print/spooler.js';
import type { LineRasteriser } from '../src/main/services/print/raster.js';
import { WorkerReads, type BackgroundReads } from '../src/main/background/backgroundReads.js';

export interface FakeServer { calls: { method: string; path: string; body: unknown; headers: Record<string, string> }[]; online: boolean; respond: (method: string, path: string, body: unknown) => { status: number; body: unknown } }

export function fakeFetch(server: FakeServer): typeof fetch {
  return (async (input: string | URL | Request, init?: RequestInit) => {
    if (!server.online) throw new TypeError('fetch failed');
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
    const method = init?.method ?? 'GET';
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    const headers = Object.fromEntries(Object.entries((init?.headers as Record<string, string>) ?? {}));
    server.calls.push({ method, path: url.pathname, body, headers });
    const r = server.respond(method, url.pathname, body);
    return new Response(JSON.stringify(r.body), { status: r.status, headers: { 'Content-Type': 'application/json', 'X-Server-Time': new Date().toISOString() } });
  }) as typeof fetch;
}

export const USER_ID = '01J00000000000000000000A01'; // valid Crockford base32 (no I, L, O, U)
export const ORG_ID = '01J00000000000000000000B01';

export function loginResponse(over: Partial<{ memberships: unknown[]; max_offline_days: number }> = {}) {
  return {
    access_token: 'access.jwt', refresh_token: 'refresh-1', expires_in: 900, token_type: 'Bearer',
    user: { id: USER_ID, name: 'Aditya', identifier: '9999999999', mobile: '9999999999' },
    organizations: [{ id: ORG_ID, name: 'Aditya' }],
    memberships: over.memberships ?? [],
    offline_policy: { max_offline_days: over.max_offline_days ?? 30, pin_max_attempts: 5, pin_lockout_seconds: 300 },
    server_time: new Date().toISOString(),
  };
}

export function defaultServer(): FakeServer {
  const s: FakeServer = {
    calls: [], online: true,
    respond: (method, path, body) => {
      if (path === '/v1/health') return { status: 200, body: { status: 'ok', server_time: new Date().toISOString(), version: 'test', protocol: 1 } };
      if (path === '/v1/auth/login') {
        const b = body as { identifier: string; password: string };
        return b.password === 'correct-horse' ? { status: 200, body: loginResponse() } : { status: 401, body: { error: { code: 'INVALID_CREDENTIALS', class: 'auth', message: 'bad credentials' } } };
      }
      if (path === '/v1/devices/register') return { status: 201, body: { id: '01J00000000000000000000C01', installation_id: (body as { installation_id: string }).installation_id, status: 'active', created_at: new Date().toISOString() } };
      if (path === '/v1/auth/logout') return { status: 204, body: null };
      return { status: 404, body: { error: { code: 'NOT_FOUND', class: 'business_rule', message: 'nope' } } };
    },
  };
  return s;
}

export interface TestAppOptions {
  server?: FakeServer; now?: () => number; file?: boolean; dbFile?: string;
  syncTransport?: (credentials: () => Credentials | null) => Transport; random?: () => number; fetch?: typeof fetch;
  coldStart?: ColdStart; bundleFetcher?: BundleFetcher; apiBaseUrl?: string; secrets?: SecretStore;
  saveFile?: SaveFile; pdfRenderer?: PdfRenderer;
  backupTransport?: (credentials: () => Credentials | null) => BackupTransport; restoreHost?: RestoreHost;
  updater?: Updater; updateBaseUrl?: string; registerIdleMs?: number; appVersion?: string; crashSend?: CrashSend;
  printSpooler?: SpoolerTransport; lineRasteriser?: LineRasteriser;
  openDb?: (file: string) => Promise<Db>;
  backgroundReads?: BackgroundReads;
}

export async function testApp(opts: TestAppOptions = {}): Promise<{ app: App; db: Db; server: FakeServer; dir: string }> {
  const server = opts.server ?? defaultServer();
  const dir = opts.dbFile ? dirname(opts.dbFile) : mkdtempSync(join(tmpdir(), 'muneem-desktop-'));
  const file = opts.dbFile ?? (opts.file ? join(dir, 'muneem.sqlite') : ':memory:');
  const db = opts.openDb ? await opts.openDb(file) : openDatabase(file, { quickCheck: false });
  await migrate(db);
  const app = createApp({
    db: () => db, dbFile: file, receiptsDir: join(dir, 'receipts'), backupsDir: join(dir, 'backups'), bundlesDir: join(dir, 'bundles'), secrets: opts.secrets ?? new MemorySecretStore(), loggers: silentLoggers(),
    apiBaseUrl: opts.apiBaseUrl ?? 'http://cloud.test/v1', appVersion: opts.appVersion ?? '0.0.0-test', platform: 'linux', fetchImpl: opts.fetch ?? fakeFetch(server), probeIntervalMs: 3_600_000, ...(opts.now && { now: opts.now }),
    ...(opts.syncTransport && { syncTransport: opts.syncTransport }), ...(opts.random && { random: opts.random }),
    ...(opts.saveFile && { saveFile: opts.saveFile }), ...(opts.pdfRenderer && { pdfRenderer: opts.pdfRenderer }),
    ...(opts.backupTransport && { backupTransport: opts.backupTransport }), ...(opts.restoreHost && { restoreHost: opts.restoreHost }),
    ...(opts.updater && { updater: opts.updater }), ...(opts.updateBaseUrl && { updateBaseUrl: opts.updateBaseUrl }),
    ...(opts.registerIdleMs !== undefined && { registerIdleMs: opts.registerIdleMs }), ...(opts.crashSend && { crashSend: opts.crashSend }),
    ...(opts.printSpooler && { printSpooler: opts.printSpooler }), ...(opts.lineRasteriser && { lineRasteriser: opts.lineRasteriser }),
    ...(opts.backgroundReads && { backgroundReads: opts.backgroundReads }),
    coldStart: opts.coldStart ?? 'pull', ...(opts.bundleFetcher && { bundleFetcher: opts.bundleFetcher }), sleep: async () => undefined,
  });
  app.device.ensureIdentity();
  await app.connectivity.probe();
  return { app, db, server, dir };
}

// The shipped read worker, run from its TypeScript source.
export const readWorker = (dbFile: string) => new WorkerReads(new URL('../src/read-worker/index.ts', import.meta.url), { dbFile }, ['--import', 'tsx']);

export type Envelope<T> = { ok: true; data: T } | { ok: false; error: { code: string; message: string; fields?: Record<string, string> } };

export function caller(app: App) {
  const call = <T = unknown>(channel: string, input: unknown = {}) => app.gateway.handle(channel, input, 1) as Promise<Envelope<T>>;
  const data = async <T>(channel: string, input: unknown = {}): Promise<T> => {
    const r = await call<T>(channel, input);
    if (!r.ok) throw new Error(`${channel}: ${JSON.stringify(r.error)}`);
    return r.data;
  };
  return { call, data };
}

// Owner logged in, with a business, a Delhi branch and terminal T01 selected on this device.
export async function ownerAtTill(app: App, over: { stateCode?: string; taxScheme?: string; gstin?: string; identifier?: string; password?: string } = {}): Promise<{ businessId: string; branchId: string; terminalId: string }> {
  const { data } = caller(app);
  await data('auth.login', { identifier: over.identifier ?? '9999999999', password: over.password ?? 'correct-horse' });
  const stateCode = over.stateCode ?? '07';
  const b = await data<{ id: string }>('business.create', {
    name: 'Sharma Store', businessType: 'retail', stateCode, taxScheme: over.taxScheme ?? 'regular', ...(over.gstin && { gstin: over.gstin }),
  });
  const br = await data<{ id: string }>('business.createBranch', { code: 'DEL1', name: 'Main', stateCode, isDefault: true });
  const t = await data<{ id: string }>('business.createTerminal', { branchId: br.id, code: 'T01', name: 'Till 1' });
  await data('business.selectTerminal', { terminalId: t.id });
  return { businessId: b.id, branchId: br.id, terminalId: t.id };
}

export function grantRole(db: Db, app: App, role: string): void {
  db.prepare('UPDATE user_membership SET grants_json = ? WHERE user_id = ?').run(JSON.stringify(ROLE_PRESETS[role]), app.session.require().user.id);
}
