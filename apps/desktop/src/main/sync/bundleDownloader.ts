import { open } from 'node:fs/promises';
import { NETWORK_UNREACHABLE, TransportError, type BundleDownload, type BundleFetcher } from './transport.js';

// A presigned bundle URL (ADR-0038, 7f): unsigned GET, resumed with Range; every chunk is on disk before it is reported.
export class HttpBundleDownloader implements BundleFetcher {
  constructor(private readonly fetchImpl: typeof fetch = fetch, private readonly idleTimeoutMs = 60_000) {}

  async download(r: BundleDownload, onProgress: (bytes: number) => void): Promise<number> {
    const ctrl = new AbortController();
    let timer = setTimeout(() => ctrl.abort(), this.idleTimeoutMs);
    const touch = () => { clearTimeout(timer); timer = setTimeout(() => ctrl.abort(), this.idleTimeoutMs); };
    try {
      const res = await this.get(r, ctrl.signal);
      if (res.status === 416) return r.offset;
      if (res.status === 403) throw new TransportError(403, 'BUNDLE_URL_EXPIRED', 'The download link expired');
      if (!res.ok || !res.body) throw new TransportError(res.status, `HTTP_${res.status}`);
      return await this.write(r, res, onProgress, touch);
    } finally {
      clearTimeout(timer);
    }
  }

  private async get(r: BundleDownload, signal: AbortSignal): Promise<Response> {
    try {
      return await this.fetchImpl(r.url, { signal, ...(r.offset > 0 && { headers: { Range: `bytes=${r.offset}-` } }) });
    } catch (e) {
      throw new TransportError(0, NETWORK_UNREACHABLE, String(e));
    }
  }

  // A 200 to a ranged request means the server sent the whole object, so the file starts again.
  private async write(r: BundleDownload, res: Response, onProgress: (bytes: number) => void, touch: () => void): Promise<number> {
    const resumed = res.status === 206 && r.offset > 0;
    const file = await open(r.path, resumed ? 'a' : 'w');
    let bytes = resumed ? r.offset : 0;
    try {
      for await (const chunk of res.body as unknown as AsyncIterable<Uint8Array>) {
        await file.write(chunk);
        bytes += chunk.byteLength;
        touch();
        onProgress(bytes);
      }
    } catch (e) {
      throw new TransportError(0, NETWORK_UNREACHABLE, `download interrupted at ${bytes} bytes: ${String(e)}`);
    } finally {
      await file.close();
    }
    return bytes;
  }
}
