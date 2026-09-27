import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { migrate, openDatabase, type Db } from '@muneem/db-sqlite';
import { createApp, type App } from '../src/main/app.js';
import { silentLoggers } from '../src/main/infra/logger.js';
import { MemorySecretStore } from '../src/main/infra/secrets.js';

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

export async function testApp(opts: { server?: FakeServer; now?: () => number; file?: boolean } = {}): Promise<{ app: App; db: Db; server: FakeServer; dir: string }> {
  const server = opts.server ?? defaultServer();
  const dir = mkdtempSync(join(tmpdir(), 'muneem-desktop-'));
  const file = opts.file ? join(dir, 'muneem.sqlite') : ':memory:';
  const db = openDatabase(file, { quickCheck: false });
  await migrate(db);
  const app = createApp({
    db: () => db, dbFile: file, backupsDir: join(dir, 'backups'), bundlesDir: join(dir, 'bundles'), secrets: new MemorySecretStore(), loggers: silentLoggers(),
    apiBaseUrl: 'http://cloud.test/v1', appVersion: '0.0.0-test', platform: 'linux', fetchImpl: fakeFetch(server), probeIntervalMs: 3_600_000, ...(opts.now && { now: opts.now }),
  });
  app.device.ensureIdentity();
  await app.connectivity.probe();
  return { app, db, server, dir };
}
