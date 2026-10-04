import { gzipSync } from 'node:zlib';
import { SYNC_HEADERS, SYNC_PROTOCOL, type PullResponse, type PushRequest, type PushResponse, type Snapshot } from '@muneem/contracts';
import { newUlid } from '@muneem/domain';
import { signRequest } from '../infra/cloudClient.js';
import { deviceTimestamp } from '../infra/signing.js';
import { NETWORK_UNREACHABLE, TransportError, type Credentials, type PullQuery, type Transport } from './transport.js';

export interface HttpTransportOptions {
  baseUrl: string;
  appVersion: string;
  schemaVersion: number;
  credentials: () => Credentials | null;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

type Method = 'GET' | 'POST';

// Signed HTTP with a gzipped body (7d). The signature covers the bytes actually sent, so it is made after compression.
export class HttpTransport implements Transport {
  constructor(private readonly o: HttpTransportOptions) {}

  push(request: PushRequest): Promise<PushResponse> {
    return this.send<PushResponse>('POST', '/sync/push', '', gzipSync(Buffer.from(JSON.stringify(request), 'utf8')));
  }

  pull(q: PullQuery): Promise<PullResponse> {
    const query = new URLSearchParams({ businessId: q.businessId, stream: q.stream, since: String(q.since), limit: String(q.limit) });
    return this.send<PullResponse>('GET', '/sync/pull', `?${query.toString()}`, undefined);
  }

  bootstrap(request: { businessId: string }): Promise<Snapshot> {
    return this.send<Snapshot>('POST', '/sync/bootstrap', '', gzipSync(Buffer.from(JSON.stringify(request), 'utf8')));
  }

  snapshot(snapshotId: string): Promise<Snapshot> {
    return this.send<Snapshot>('GET', `/sync/bootstrap/${encodeURIComponent(snapshotId)}`, '', undefined);
  }

  private headers(method: Method, path: string, body: Uint8Array | undefined): Record<string, string> {
    const creds = this.o.credentials();
    if (!creds) throw new TransportError(401, 'DEVICE_NOT_REGISTERED', 'This device is not registered with the cloud yet');
    const ts = deviceTimestamp();
    return {
      Accept: 'application/json',
      ...(body && { 'Content-Type': 'application/json', 'Content-Encoding': 'gzip' }),
      [SYNC_HEADERS.appVersion]: this.o.appVersion,
      [SYNC_HEADERS.schemaVersion]: String(this.o.schemaVersion),
      [SYNC_HEADERS.syncProtocol]: String(SYNC_PROTOCOL),
      [SYNC_HEADERS.requestId]: newUlid(),
      [SYNC_HEADERS.deviceTimestamp]: ts,
      [SYNC_HEADERS.deviceId]: creds.deviceId,
      [SYNC_HEADERS.deviceSignature]: signRequest(creds.privateKeyPem, method, path, ts, body),
      ...(creds.accessToken && { Authorization: `Bearer ${creds.accessToken}` }),
    };
  }

  private async send<T>(method: Method, route: string, query: string, body: Uint8Array | undefined): Promise<T> {
    const url = new URL(this.o.baseUrl.replace(/\/$/u, '') + route + query);
    const headers = this.headers(method, url.pathname, body);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), this.o.timeoutMs ?? 30_000);
    let res: Response;
    try {
      res = await (this.o.fetchImpl ?? fetch)(url, { method, headers, signal: ctrl.signal, ...(body && { body }) });
    } catch (e) {
      throw new TransportError(0, NETWORK_UNREACHABLE, String(e));
    } finally {
      clearTimeout(timer);
    }
    const text = await res.text();
    const data = text ? safeJson(text) : null;
    if (!res.ok) {
      const err = (data as { error?: { code?: string; message?: string } } | null)?.error;
      throw new TransportError(res.status, err?.code ?? `HTTP_${res.status}`, err?.message ?? `HTTP ${res.status}`);
    }
    return data as T;
  }
}

function safeJson(text: string): unknown {
  try { return JSON.parse(text); } catch { return text; }
}
