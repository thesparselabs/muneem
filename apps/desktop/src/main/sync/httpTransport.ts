import { gzipSync } from 'node:zlib';
import type { PullResponse, PushRequest, PushResponse, Snapshot } from '@muneem/contracts';
import { SignedHttp, type SignedBody, type SignedHttpOptions } from './signedHttp.js';
import type { PullQuery, Transport } from './transport.js';

export type HttpTransportOptions = SignedHttpOptions;

const gzipJson = (v: unknown): SignedBody => ({ bytes: gzipSync(Buffer.from(JSON.stringify(v), 'utf8')), gzip: true });

// Signed HTTP with a gzipped body (7d).
export class HttpTransport implements Transport {
  private readonly http: SignedHttp;

  constructor(o: HttpTransportOptions) { this.http = new SignedHttp(o); }

  push(request: PushRequest): Promise<PushResponse> {
    return this.http.send<PushResponse>('POST', '/sync/push', '', gzipJson(request));
  }

  pull(q: PullQuery): Promise<PullResponse> {
    const query = new URLSearchParams({ businessId: q.businessId, stream: q.stream, since: String(q.since), limit: String(q.limit) });
    return this.http.send<PullResponse>('GET', '/sync/pull', `?${query.toString()}`, undefined);
  }

  bootstrap(request: { businessId: string }): Promise<Snapshot> {
    return this.http.send<Snapshot>('POST', '/sync/bootstrap', '', gzipJson(request));
  }

  snapshot(snapshotId: string): Promise<Snapshot> {
    return this.http.send<Snapshot>('GET', `/sync/bootstrap/${encodeURIComponent(snapshotId)}`, '', undefined);
  }
}
