import { createReadStream } from 'node:fs';
import { Readable } from 'node:stream';
import { SignedHttp, type SignedBody, type SignedHttpOptions } from '../sync/signedHttp.js';
import { NETWORK_UNREACHABLE, TransportError } from '../sync/transport.js';
import type {
  BackupObjectUpload, BackupPresignRequest, BackupTransport, BackupUploadTarget, CloudBackupDownload, CloudBackupDto, EscrowedKey,
} from './transport.js';

const json = (v: unknown): SignedBody => ({ bytes: Buffer.from(JSON.stringify(v), 'utf8'), gzip: false });

// Signed /backups calls, and the unsigned PUT of the presigned URL (runs in the sync utility process).
export class HttpBackupTransport implements BackupTransport {
  private readonly http: SignedHttp;

  constructor(o: SignedHttpOptions, private readonly fetchImpl: typeof fetch = fetch, private readonly idleTimeoutMs = 60_000) {
    this.http = new SignedHttp(o);
  }

  presignBackup(request: BackupPresignRequest): Promise<BackupUploadTarget> {
    return this.http.send('POST', '/backups/presign', '', json(request));
  }

  confirmBackup(backupId: string): Promise<CloudBackupDto> {
    return this.http.send('POST', `/backups/${encodeURIComponent(backupId)}/confirm`, '', undefined);
  }

  listBackups(businessId: string): Promise<CloudBackupDto[]> {
    return this.http.send('GET', '/backups', `?${new URLSearchParams({ businessId }).toString()}`, undefined);
  }

  getBackup(backupId: string): Promise<CloudBackupDownload> {
    return this.http.send('GET', `/backups/${encodeURIComponent(backupId)}`, '', undefined);
  }

  async escrowBackupKey(key: EscrowedKey): Promise<void> {
    await this.http.send('POST', '/backups/key', '', json(key));
  }

  async fetchBackupKey(businessId: string, keyId?: string): Promise<EscrowedKey | null> {
    const query = new URLSearchParams({ businessId, ...(keyId && { keyId }) });
    try {
      return await this.http.send<EscrowedKey>('GET', '/backups/key', `?${query.toString()}`, undefined);
    } catch (e) {
      if (e instanceof TransportError && e.code === 'BACKUP_KEY_NOT_FOUND') return null;
      throw e;
    }
  }

  // Streams the file with its length (S3 refuses a chunked PUT); stalls longer than the idle timeout abort it.
  async uploadBackup(r: BackupObjectUpload, onProgress: (bytes: number) => void): Promise<void> {
    const ctrl = new AbortController();
    let timer = setTimeout(() => ctrl.abort(), this.idleTimeoutMs);
    let sent = 0;
    const file = createReadStream(r.path);
    file.on('data', (chunk) => {
      sent += chunk.length;
      clearTimeout(timer);
      timer = setTimeout(() => ctrl.abort(), this.idleTimeoutMs);
      onProgress(sent);
    });
    let res: Response;
    try {
      res = await this.fetchImpl(r.url, {
        method: 'PUT', body: Readable.toWeb(file) as ReadableStream, signal: ctrl.signal,
        headers: { 'Content-Length': String(r.bytes), 'Content-Type': 'application/octet-stream' }, duplex: 'half',
      } as RequestInit);
    } catch (e) {
      throw new TransportError(0, NETWORK_UNREACHABLE, `upload interrupted after ${sent} bytes: ${String(e)}`);
    } finally {
      clearTimeout(timer);
      file.destroy();
    }
    await res.arrayBuffer().catch(() => undefined);
    if (res.status === 403) throw new TransportError(403, 'BACKUP_URL_EXPIRED', 'The upload link expired');
    if (!res.ok) throw new TransportError(res.status, `HTTP_${res.status}`, `upload failed: HTTP ${res.status}`);
  }
}
