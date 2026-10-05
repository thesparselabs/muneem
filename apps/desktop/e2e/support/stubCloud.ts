import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { gunzipSync } from 'node:zlib';
import { ROLE_PRESETS, SYNC_HEADERS, type Grant, type SyncStream } from '@muneem/contracts';
import { isServerError, ReferenceServer } from '@muneem/sync-reference';

interface StubUser { id: string; identifier: string; password: string; name: string; role: 'owner' | 'cashier' }
export const OWNER: StubUser = { id: '01J00000000000000000000A01', identifier: '9999999999', password: 'correct-horse', name: 'Aditya', role: 'owner' };
export const CASHIER: StubUser = { id: '01J00000000000000000000A02', identifier: '8888888888', password: 'cashier-pass', name: 'Ravi', role: 'cashier' };
const USERS = [OWNER, CASHIER];
const ORG_ID = '01J00000000000000000000B01';

export interface StubCloud { url: string; calls: string[]; setOnline: (online: boolean) => void; close: () => Promise<void> }

type Reply = { status: number; body: unknown };

const wireGrant = (g: Grant) => ({
  permission: g.permission,
  ...(g.limit && { limit: { max_discount_bp: g.limit.maxDiscountBp, max_refund_paise: g.limit.maxRefundPaise, backdate_days: g.limit.backdateDays } }),
});

// Like the Go cloud, sign-in lists the businesses synced up so far, with the user's role in each.
const membership = (user: StubUser, businessId: string, name: string) => ({
  organization_id: ORG_ID, business_id: businessId, business_name: name, roles: [user.role],
  permission_snapshot: { perm_ver: 1, roles: [user.role], grants: ROLE_PRESETS[user.role]!.map(wireGrant), issued_at: new Date().toISOString() },
});

const loginReply = (user: StubUser, businesses: Map<string, string>): Reply => ({
  status: 200,
  body: {
    access_token: `access.${user.role}`, refresh_token: `refresh-${user.role}`, expires_in: 900, token_type: 'Bearer',
    user: { id: user.id, name: user.name, identifier: user.identifier, mobile: user.identifier },
    organizations: [{ id: ORG_ID, name: OWNER.name }], memberships: [...businesses].map(([id, name]) => membership(user, id, name)),
    offline_policy: { max_offline_days: 30, pin_max_attempts: 5, pin_lockout_seconds: 300 },
    server_time: new Date().toISOString(),
  },
});

const notFound: Reply = { status: 404, body: { error: { code: 'NOT_FOUND', class: 'business_rule', message: 'not in the stub cloud' } } };

async function readBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  if (chunks.length === 0) return undefined;
  const raw = Buffer.concat(chunks);
  const text = (req.headers['content-encoding'] === 'gzip' ? gunzipSync(raw) : raw).toString('utf8');
  return text ? JSON.parse(text) : undefined;
}

// The cloud a UI test talks to: auth and device registration answered inline, sync by the reference server (ADR-0042).
export function routeCloud(sync: ReferenceServer) {
  let deviceNo = 0;
  const businesses = new Map<string, string>();
  const remember = (body: unknown) => {
    for (const op of (body as { operations?: { entityType: string; entityId: string; payload: { name?: string } }[] }).operations ?? []) {
      if (op.entityType === 'business') businesses.set(op.entityId, op.payload.name ?? '');
    }
  };
  return async (method: string, url: URL, body: unknown, deviceId: string): Promise<Reply> => {
    const path = url.pathname.replace(/^\/v1/u, '');
    if (path === '/health') return { status: 200, body: { status: 'ok', server_time: new Date().toISOString(), version: 'stub', protocol: 1 } };
    if (path === '/auth/login') {
      const b = body as { identifier: string; password: string };
      const user = USERS.find((u) => u.identifier === b.identifier && u.password === b.password);
      return user ? loginReply(user, businesses) : { status: 401, body: { error: { code: 'INVALID_CREDENTIALS', class: 'auth', message: 'bad credentials' } } };
    }
    if (path === '/auth/logout') return { status: 204, body: null };
    if (path === '/devices/register') {
      const id = `01J000000000000000000D${String(++deviceNo).padStart(4, '0')}`;
      sync.registerDevice(id, OWNER.id);
      return { status: 201, body: { id, installation_id: (body as { installation_id: string }).installation_id, status: 'active', created_at: new Date().toISOString() } };
    }
    if (path === '/sync/push' && method === 'POST') {
      const pushed = await sync.push(deviceId, body);
      remember(body);
      return { status: 200, body: pushed };
    }
    if (path === '/sync/pull') {
      const q = url.searchParams;
      return { status: 200, body: await sync.pull(deviceId, { businessId: q.get('businessId')!, stream: q.get('stream') as SyncStream, since: Number(q.get('since')), limit: Number(q.get('limit')) }) };
    }
    return notFound;
  };
}

export async function startStubCloud(): Promise<StubCloud> {
  const sync = new ReferenceServer();
  for (const u of USERS) sync.addMember(u.id, ORG_ID);
  const route = routeCloud(sync);
  const calls: string[] = [];
  let online = true;
  const server: Server = createServer((req: IncomingMessage, res: ServerResponse) => {
    if (!online) { req.socket.destroy(); return; }
    void (async () => {
      const url = new URL(req.url ?? '/', 'http://stub');
      calls.push(`${req.method} ${url.pathname}`);
      let reply: Reply;
      try {
        reply = await route(req.method ?? 'GET', url, await readBody(req), String(req.headers[SYNC_HEADERS.deviceId.toLowerCase()] ?? ''));
      } catch (e) {
        reply = isServerError(e) ? { status: e.status, body: { error: { code: e.code, class: 'sync', message: e.message } } } : { status: 500, body: { error: { code: 'INTERNAL', message: String(e) } } };
      }
      res.writeHead(reply.status, { 'Content-Type': 'application/json', [SYNC_HEADERS.serverTime]: new Date().toISOString() });
      res.end(reply.body === null ? undefined : JSON.stringify(reply.body));
    })();
  });
  await new Promise<void>((ok) => server.listen(0, '127.0.0.1', ok));
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}/v1`, calls,
    setOnline: (next) => { online = next; if (!next) server.closeAllConnections(); },
    close: () => new Promise((ok) => { server.closeAllConnections(); server.close(() => ok()); }),
  };
}
