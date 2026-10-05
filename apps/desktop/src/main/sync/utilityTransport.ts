import type { PullResponse, PushRequest, PushResponse, Snapshot } from '@muneem/contracts';
import type {
  BackupObjectUpload, BackupPresignRequest, BackupTransport, BackupUploadTarget, CloudBackupDownload, CloudBackupDto, EscrowedKey,
} from '../backups/transport.js';
import { NETWORK_UNREACHABLE, TransportError, type BundleDownload, type BundleFetcher, type Credentials, type PullQuery, type Transport } from './transport.js';
import type { Channel, WorkerOp, WorkerReply } from './workerProtocol.js';

interface Waiting { resolve(v: unknown): void; reject(e: unknown): void; timer: NodeJS.Timeout; onProgress?: (bytes: number) => void }

// Main's side of the utility process (7d): every call goes over the port with fresh credentials and comes back as data or a TransportError.
export class UtilityTransport implements Transport, BundleFetcher, BackupTransport {
  private nextId = 1;
  private readonly waiting = new Map<number, Waiting>();

  constructor(private readonly channel: Channel, private readonly credentials: () => Credentials | null, private readonly timeoutMs = 60_000) {
    channel.onMessage((m) => this.settle(m as WorkerReply));
  }

  push(request: PushRequest): Promise<PushResponse> { return this.call('push', request) as Promise<PushResponse>; }
  pull(query: PullQuery): Promise<PullResponse> { return this.call('pull', query) as Promise<PullResponse>; }
  bootstrap(request: { businessId: string }): Promise<Snapshot> { return this.call('bootstrap', request) as Promise<Snapshot>; }
  snapshot(snapshotId: string): Promise<Snapshot> { return this.call('snapshot', snapshotId) as Promise<Snapshot>; }

  // A download may run for minutes; it times out only when no progress arrives for the timeout.
  download(request: BundleDownload, onProgress: (bytes: number) => void): Promise<number> {
    return this.call('download', request, onProgress) as Promise<number>;
  }

  presignBackup(request: BackupPresignRequest): Promise<BackupUploadTarget> { return this.call('backupPresign', request) as Promise<BackupUploadTarget>; }
  confirmBackup(backupId: string): Promise<CloudBackupDto> { return this.call('backupConfirm', backupId) as Promise<CloudBackupDto>; }
  listBackups(businessId: string): Promise<CloudBackupDto[]> { return this.call('backupList', businessId) as Promise<CloudBackupDto[]>; }
  getBackup(backupId: string): Promise<CloudBackupDownload> { return this.call('backupGet', backupId) as Promise<CloudBackupDownload>; }
  async escrowBackupKey(key: EscrowedKey): Promise<void> { await this.call('backupKeyPut', key); }
  fetchBackupKey(businessId: string, keyId?: string): Promise<EscrowedKey | null> {
    return this.call('backupKeyGet', { businessId, ...(keyId && { keyId }) }) as Promise<EscrowedKey | null>;
  }

  // Like a download, an upload times out only when no progress arrives for the timeout.
  async uploadBackup(request: BackupObjectUpload, onProgress: (bytes: number) => void): Promise<void> {
    await this.call('backupUpload', request, onProgress);
  }

  // A worker that died or hung fails its calls as unreachable, so the engine backs off and retries.
  failAll(reason: string): void {
    for (const [id, w] of this.waiting) {
      clearTimeout(w.timer);
      w.reject(new TransportError(0, NETWORK_UNREACHABLE, reason));
      this.waiting.delete(id);
    }
  }

  private expiry(id: number): NodeJS.Timeout {
    const timer = setTimeout(() => {
      const w = this.waiting.get(id);
      this.waiting.delete(id);
      w?.reject(new TransportError(0, NETWORK_UNREACHABLE, 'sync worker timed out'));
    }, this.timeoutMs);
    timer.unref?.();
    return timer;
  }

  private call(op: WorkerOp, arg: unknown, onProgress?: (bytes: number) => void): Promise<unknown> {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.waiting.set(id, { resolve, reject, timer: this.expiry(id), ...(onProgress && { onProgress }) });
      this.channel.send({ id, op, arg, credentials: this.credentials() });
    });
  }

  private settle(reply: WorkerReply): void {
    const w = this.waiting.get(reply?.id);
    if (!w) return;
    clearTimeout(w.timer);
    if ('progress' in reply) {
      w.timer = this.expiry(reply.id);
      w.onProgress?.(reply.progress);
      return;
    }
    this.waiting.delete(reply.id);
    if (reply.ok) w.resolve(reply.data);
    else w.reject(new TransportError(reply.error.status, reply.error.code, reply.error.message));
  }
}
