import type { BackupTransport } from '../backups/transport.js';
import { TransportError, type BundleDownload, type BundleFetcher, type Credentials, type Transport } from './transport.js';

// The utility process only does HTTP, gzip and signing with what main hands it (HLD §3.1); main alone touches SQLite.
// It also writes a hydration bundle to the file main names (7f), so the download never passes through main, and streams an
// encrypted backup from the file main names to its presigned URL (8f).
export interface WorkerConfig { baseUrl: string; appVersion: string; schemaVersion: number; timeoutMs?: number }
export type WorkerOp = 'push' | 'pull' | 'bootstrap' | 'snapshot' | 'download'
  | 'backupPresign' | 'backupUpload' | 'backupConfirm' | 'backupList' | 'backupGet' | 'backupKeyPut' | 'backupKeyGet';
export interface WorkerRequest { id: number; op: WorkerOp; arg: unknown; credentials: Credentials | null }
export type WorkerReply =
  | { id: number; ok: true; data: unknown }
  | { id: number; ok: false; error: { status: number; code: string; message: string } }
  | { id: number; progress: number };

// A message port, whichever kind: Electron's MessagePortMain in the app, Node's MessagePort in tests.
export interface Channel { send(message: unknown): void; onMessage(listener: (message: unknown) => void): void }

const isRequest = (m: unknown): m is WorkerRequest => !!m && typeof m === 'object' && typeof (m as WorkerRequest).id === 'number' && typeof (m as WorkerRequest).op === 'string';

const unavailable = (what: string) => Promise.reject(new TransportError(0, 'WORKER_ERROR', `no ${what}`));

function dispatchBackup(m: WorkerRequest, b: BackupTransport | undefined, progress: (bytes: number) => void): Promise<unknown> {
  if (!b) return unavailable('backup transport');
  const a = m.arg as never;
  switch (m.op) {
    case 'backupPresign': return b.presignBackup(a);
    case 'backupUpload': return b.uploadBackup(a, progress);
    case 'backupConfirm': return b.confirmBackup(a);
    case 'backupList': return b.listBackups(a);
    case 'backupGet': return b.getBackup(a);
    case 'backupKeyPut': return b.escrowBackupKey(a);
    default: {
      const { businessId, keyId } = m.arg as { businessId: string; keyId?: string };
      return b.fetchBackupKey(businessId, keyId);
    }
  }
}

function dispatch(m: WorkerRequest, t: Transport, fetcher: BundleFetcher | undefined, backups: BackupTransport | undefined, progress: (bytes: number) => void): Promise<unknown> {
  switch (m.op) {
    case 'push': return t.push(m.arg as never);
    case 'pull': return t.pull(m.arg as never);
    case 'bootstrap': return t.bootstrap(m.arg as never);
    case 'snapshot': return t.snapshot(m.arg as string);
    case 'download': return fetcher ? fetcher.download(m.arg as BundleDownload, progress) : unavailable('downloader');
    default: return dispatchBackup(m, backups, progress);
  }
}

// The worker side: each request is sent with the credentials main attached to it; a download reports its progress as it goes.
export function serveTransport(
  channel: Channel, transportFor: (credentials: Credentials | null) => Transport, fetcher?: BundleFetcher, backupsFor?: (credentials: Credentials | null) => BackupTransport,
): void {
  channel.onMessage((m) => {
    if (!isRequest(m)) return;
    dispatch(m, transportFor(m.credentials), fetcher, backupsFor?.(m.credentials), (progress) => channel.send({ id: m.id, progress } satisfies WorkerReply)).then(
      (data) => channel.send({ id: m.id, ok: true, data } satisfies WorkerReply),
      (e: unknown) => channel.send({
        id: m.id, ok: false,
        error: e instanceof TransportError ? { status: e.status, code: e.code, message: e.message } : { status: 0, code: 'WORKER_ERROR', message: String(e) },
      } satisfies WorkerReply),
    );
  });
}
