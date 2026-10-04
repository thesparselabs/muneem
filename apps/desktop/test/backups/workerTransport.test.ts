import { createHash, generateKeyPairSync, randomBytes } from 'node:crypto';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MessageChannel, type MessagePort } from 'node:worker_threads';
import { afterEach, describe, expect, it } from 'vitest';
import { SYNC_HEADERS } from '@muneem/contracts';
import { HttpBackupTransport } from '../../src/main/backups/httpBackupTransport.js';
import type { Credentials, Transport } from '../../src/main/sync/transport.js';
import { UtilityTransport } from '../../src/main/sync/utilityTransport.js';
import { serveTransport, type Channel } from '../../src/main/sync/workerProtocol.js';
import { FakeBackupCloud } from './fakeBackupCloud.js';

const portChannel = (port: MessagePort): Channel => ({ send: (m) => port.postMessage(m), onMessage: (l) => port.on('message', l) });
const open: MessagePort[] = [];
afterEach(() => { for (const p of open.splice(0)) p.close(); });

const credentials = (): Credentials => ({
  deviceId: 'DEV1', accessToken: 'access.jwt',
  privateKeyPem: generateKeyPairSync('ed25519').privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
});

function file(bytes: number): string {
  const path = join(mkdtempSync(join(tmpdir(), 'muneem-upload-')), 'b.mbk');
  writeFileSync(path, randomBytes(bytes));
  return path;
}

describe('backup calls over the sync utility process (8f)', () => {
  it('every backup op crosses the port with main\'s credentials; an upload reports progress; a missing key is null', async () => {
    const cloud = new FakeBackupCloud();
    const { port1, port2 } = new MessageChannel();
    open.push(port1, port2);
    serveTransport(portChannel(port2), () => ({}) as Transport, undefined, (c) => cloud.transportFor(() => c));
    const creds = credentials();
    const worker = new UtilityTransport(portChannel(port1), () => creds, 2_000);

    expect(await worker.fetchBackupKey('BIZ')).toBeNull();
    await worker.escrowBackupKey({ businessId: 'BIZ', keyId: '0011223344556677', key: randomBytes(32).toString('base64') });
    expect(await worker.fetchBackupKey('BIZ')).toMatchObject({ keyId: '0011223344556677' });
    const path = file(5000);
    const sha256 = createHash('sha256').update(readFileSync(path)).digest('hex');
    const target = await worker.presignBackup({ businessId: 'BIZ', bytes: 5000, sha256, keyId: '0011223344556677', schemaVersion: 15 });
    const progress: number[] = [];
    await worker.uploadBackup({ url: target.url, path, bytes: 5000 }, (n) => progress.push(n));
    expect(progress.at(-1)).toBe(5000);
    expect(await worker.confirmBackup(target.backupId)).toMatchObject({ backupId: target.backupId, deviceId: 'DEV1' });
    expect((await worker.listBackups('BIZ')).map((b) => b.backupId)).toEqual([target.backupId]);
    expect(await worker.getBackup(target.backupId)).toMatchObject({ url: expect.stringContaining(target.backupId) });
    await expect(worker.getBackup('nope')).rejects.toMatchObject({ status: 404, code: 'NOT_FOUND' });
  });
});

describe('HTTP backup transport (8f)', () => {
  it('signs the /backups calls and PUTs the file with its length to the presigned URL, unsigned', async () => {
    const seen: { url: string; method: string; headers: Record<string, string>; body: Buffer | null }[] = [];
    const fetchImpl = (async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      let body: Buffer | null = null;
      if (init?.body instanceof ReadableStream) {
        const chunks: Uint8Array[] = [];
        for await (const c of init.body as unknown as AsyncIterable<Uint8Array>) chunks.push(c);
        body = Buffer.concat(chunks);
      } else if (init?.body) body = Buffer.from(init.body as Uint8Array);
      seen.push({ url, method: init?.method ?? 'GET', headers: (init?.headers ?? {}) as Record<string, string>, body });
      if (url.endsWith('/backups/key?businessId=BIZ')) return Response.json({ error: { code: 'BACKUP_KEY_NOT_FOUND' } }, { status: 404 });
      return url.includes('objects.test') ? new Response(null, { status: 200 }) : Response.json({ backupId: 'BK1', url: 'https://objects.test/BK1', expiresAt: '2026-10-04T13:00:00Z' });
    }) as typeof fetch;
    const t = new HttpBackupTransport({ baseUrl: 'http://cloud.test/v1', appVersion: 't', schemaVersion: 15, credentials, fetchImpl }, fetchImpl);

    expect(await t.fetchBackupKey('BIZ')).toBeNull();
    const target = await t.presignBackup({ businessId: 'BIZ', bytes: 3000, sha256: 'a'.repeat(64), keyId: '0011223344556677', schemaVersion: 15 });
    const path = file(3000);
    await t.uploadBackup({ url: target.url, path, bytes: 3000 }, () => undefined);

    const [key, presign, put] = seen;
    expect(key!.headers[SYNC_HEADERS.deviceSignature]).toBeTruthy();
    expect(presign).toMatchObject({ url: 'http://cloud.test/v1/backups/presign', method: 'POST' });
    expect(presign!.headers[SYNC_HEADERS.deviceSignature]).toBeTruthy();
    expect(JSON.parse(presign!.body!.toString())).toMatchObject({ businessId: 'BIZ', bytes: 3000 });
    expect(put).toMatchObject({ url: 'https://objects.test/BK1', method: 'PUT' });
    expect(put!.headers['Content-Length']).toBe('3000');
    expect(put!.headers[SYNC_HEADERS.deviceSignature]).toBeUndefined();
    expect(put!.body!.length).toBe(3000);
  });
});
