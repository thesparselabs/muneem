import { createPublicKey, verify } from 'node:crypto';
import { MessageChannel, type MessagePort } from 'node:worker_threads';
import { gunzipSync } from 'node:zlib';
import { afterEach, describe, expect, it } from 'vitest';
import { SYNC_HEADERS, type SyncStream } from '@muneem/contracts';
import { ServerError, type ReferenceServer } from '@muneem/sync-reference';
import { signingString } from '../../src/main/infra/signing.js';
import { HttpTransport } from '../../src/main/sync/httpTransport.js';
import { TransportError, type Credentials, type Transport } from '../../src/main/sync/transport.js';
import { UtilityTransport } from '../../src/main/sync/utilityTransport.js';
import { serveTransport, type Channel } from '../../src/main/sync/workerProtocol.js';
import { caller, fakeFetch, ownerAtTill, testApp } from '../helpers.js';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { books, bundleDownloader, DEVICE_A, DEVICE_B, deviceServer, ownerMembership, referenceCloud, referenceTransport, syncUntilQuiet, type BundleFetchLog } from './syncHelpers.js';

interface Seen { method: string; path: string; headers: Record<string, string> }

// The reference server behind HTTP: gunzips, checks each device's signature against the key it registered, and answers errors as JSON.
function cloudFetch(cloud: ReferenceServer, cloudId: string, memberships: () => unknown[], seen: Seen[]): typeof fetch {
  const auth = deviceServer(cloudId, memberships);
  let publicKey = '';
  const base = fakeFetch({ ...auth, respond: (m, p, b) => {
    if (p === '/v1/devices/register') publicKey = (b as { public_key: string }).public_key;
    return auth.respond(m, p, b);
  } });
  const answer = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });
  return (async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
    if (!url.pathname.startsWith('/v1/sync/')) return base(input, init);
    const headers = init!.headers as Record<string, string>;
    const raw = init!.body ? Buffer.from(init!.body as Uint8Array) : undefined;
    seen.push({ method: init!.method!, path: url.pathname, headers });
    const key = createPublicKey({ key: Buffer.concat([Buffer.from('302a300506032b6570032100', 'hex'), Buffer.from(publicKey, 'base64')]), format: 'der', type: 'spki' });
    const signed = Buffer.from(signingString(init!.method!, url.pathname, headers[SYNC_HEADERS.deviceTimestamp]!, raw));
    if (!verify(null, signed, key, Buffer.from(headers[SYNC_HEADERS.deviceSignature]!, 'base64'))) return answer(401, { error: { code: 'SIGNATURE_INVALID' } });
    const device = headers[SYNC_HEADERS.deviceId]!;
    const q = url.searchParams;
    try {
      return answer(200, url.pathname === '/v1/sync/push'
        ? await cloud.push(device, JSON.parse(gunzipSync(raw!).toString('utf8')))
        : await cloud.pull(device, { businessId: q.get('businessId')!, stream: q.get('stream') as SyncStream, since: Number(q.get('since')), limit: Number(q.get('limit')) }));
    } catch (e) {
      if (e instanceof ServerError) return answer(e.status, { error: { code: e.code, message: e.message } });
      throw e;
    }
  }) as typeof fetch;
}

const portChannel = (port: MessagePort): Channel => ({ send: (m) => port.postMessage(m), onMessage: (l) => port.on('message', l) });

const open: MessagePort[] = [];
afterEach(() => { for (const p of open.splice(0)) p.close(); });

// The utility process in miniature: serveTransport on one end of a real MessageChannel, HTTP behind it.
function overPort(credentials: () => Credentials | null, http: (c: Credentials | null) => Transport, timeoutMs?: number): UtilityTransport {
  const { port1, port2 } = new MessageChannel();
  open.push(port1, port2);
  serveTransport(portChannel(port2), http);
  return new UtilityTransport(portChannel(port1), credentials, timeoutMs);
}

describe('transports (7d)', () => {
  it('a whole app syncs over signed, gzipped HTTP; another pulls it the same way', async () => {
    const cloud = referenceCloud();
    const seen: Seen[] = [];
    const a = await testApp({ server: deviceServer(DEVICE_A), fetch: cloudFetch(cloud, DEVICE_A, () => [], seen) });
    const { businessId } = await ownerAtTill(a.app);
    a.app.customers.create({ name: 'Ravi' });
    await syncUntilQuiet(a.app);
    const b = await testApp({ server: deviceServer(DEVICE_B), fetch: cloudFetch(cloud, DEVICE_B, () => [ownerMembership(businessId)], seen) });
    await caller(b.app).data('auth.login', { identifier: '9999999999', password: 'correct-horse' });
    await syncUntilQuiet(b.app);
    expect(books(b.db, businessId)).toEqual(books(a.db, businessId));
    expect(b.db.prepare('SELECT name FROM customer').pluck().all()).toEqual(['Ravi']);

    const push = seen.find((s) => s.path === '/v1/sync/push')!;
    expect(push.headers).toMatchObject({
      'Content-Encoding': 'gzip', [SYNC_HEADERS.syncProtocol]: '1', [SYNC_HEADERS.appVersion]: '0.0.0-test', [SYNC_HEADERS.deviceId]: DEVICE_A,
      Authorization: 'Bearer access.jwt', [SYNC_HEADERS.schemaVersion]: expect.stringMatching(/^\d+$/),
    });
    expect(seen.filter((s) => s.path === '/v1/sync/pull' && s.headers[SYNC_HEADERS.deviceId] === DEVICE_B).length).toBeGreaterThanOrEqual(4);
  });

  it('the utility-process proxy carries calls, fresh credentials and errors over a MessagePort', async () => {
    const cloud = referenceCloud();
    const seen: Seen[] = [];
    const fetchImpl = cloudFetch(cloud, DEVICE_A, () => [], seen);
    let asked = 0;
    const a = await testApp({
      server: deviceServer(DEVICE_A), fetch: fetchImpl,
      syncTransport: (credentials) => overPort(() => { asked++; return credentials(); }, (c) => new HttpTransport({ baseUrl: 'http://cloud.test/v1', appVersion: '0.0.0-test', schemaVersion: 14, credentials: () => c, fetchImpl })),
    });
    const { businessId } = await ownerAtTill(a.app);
    await syncUntilQuiet(a.app);
    expect(a.db.prepare("SELECT COUNT(*) FROM sync_outbox WHERE status <> 'sent'").pluck().get()).toBe(0);
    expect(cloud.business(businessId)).toBeDefined();
    expect(asked).toBe(seen.length);

    const unregistered = overPort(() => null, (c) => new HttpTransport({ baseUrl: 'http://cloud.test/v1', appVersion: 'x', schemaVersion: 14, credentials: () => c, fetchImpl }));
    await expect(unregistered.pull({ businessId, stream: 'masters', since: 0, limit: 1 })).rejects.toMatchObject({ status: 401, code: 'DEVICE_NOT_REGISTERED' });
    const hung = overPort(() => null, () => ({ push: () => new Promise(() => undefined), pull: () => new Promise(() => undefined), bootstrap: () => new Promise(() => undefined), snapshot: () => new Promise(() => undefined) }), 50);
    await expect(hung.pull({ businessId, stream: 'masters', since: 0, limit: 1 })).rejects.toBeInstanceOf(TransportError);
  });

  it('the utility process writes a hydration bundle to the file main names, with progress, and resumes it with Range', async () => {
    const cloud = referenceCloud();
    const a = await testApp({ syncTransport: () => referenceTransport(cloud, () => DEVICE_A) });
    const { businessId } = await ownerAtTill(a.app);
    await syncUntilQuiet(a.app);
    const { snapshotId } = await cloud.bootstrap(DEVICE_A, { businessId });
    const { url, bytes } = await cloud.snapshot(DEVICE_A, snapshotId);
    const path = join(mkdtempSync(join(tmpdir(), 'muneem-bundle-')), 'b.ndjson.gz');
    const log: BundleFetchLog = { ranges: [] };
    const { port1, port2 } = new MessageChannel();
    open.push(port1, port2);
    serveTransport(portChannel(port2), () => referenceTransport(cloud, () => DEVICE_A), bundleDownloader(cloud, log));
    const worker = new UtilityTransport(portChannel(port1), () => null, 1_000);
    const seenProgress: number[] = [];
    await worker.download({ url: url!, path, offset: 0 }, (n) => seenProgress.push(n));
    expect(seenProgress.at(-1)).toBe(bytes);
    expect(readFileSync(path)).toEqual(cloud.bundleObject(url!).body);
    expect(await worker.download({ url: url!, path, offset: bytes! }, () => undefined)).toBe(bytes);
    expect(log.ranges).toEqual([null, `bytes=${bytes!}-`]);
  });
});
