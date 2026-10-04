import { TransportError, type BundleDownload, type BundleFetcher, type Credentials, type Transport } from './transport.js';

// The utility process only does HTTP, gzip and signing with what main hands it (HLD §3.1); main alone touches SQLite.
// It also writes a hydration bundle to the file main names (7f), so the download never passes through main.
export interface WorkerConfig { baseUrl: string; appVersion: string; schemaVersion: number; timeoutMs?: number }
export type WorkerOp = 'push' | 'pull' | 'bootstrap' | 'snapshot' | 'download';
export interface WorkerRequest { id: number; op: WorkerOp; arg: unknown; credentials: Credentials | null }
export type WorkerReply =
  | { id: number; ok: true; data: unknown }
  | { id: number; ok: false; error: { status: number; code: string; message: string } }
  | { id: number; progress: number };

// A message port, whichever kind: Electron's MessagePortMain in the app, Node's MessagePort in tests.
export interface Channel { send(message: unknown): void; onMessage(listener: (message: unknown) => void): void }

const isRequest = (m: unknown): m is WorkerRequest => !!m && typeof m === 'object' && typeof (m as WorkerRequest).id === 'number' && typeof (m as WorkerRequest).op === 'string';

function dispatch(m: WorkerRequest, t: Transport, fetcher: BundleFetcher | undefined, progress: (bytes: number) => void): Promise<unknown> {
  switch (m.op) {
    case 'push': return t.push(m.arg as never);
    case 'pull': return t.pull(m.arg as never);
    case 'bootstrap': return t.bootstrap(m.arg as never);
    case 'snapshot': return t.snapshot(m.arg as string);
    case 'download': return fetcher ? fetcher.download(m.arg as BundleDownload, progress) : Promise.reject(new TransportError(0, 'WORKER_ERROR', 'no downloader'));
  }
}

// The worker side: each request is sent with the credentials main attached to it; a download reports its progress as it goes.
export function serveTransport(channel: Channel, transportFor: (credentials: Credentials | null) => Transport, fetcher?: BundleFetcher): void {
  channel.onMessage((m) => {
    if (!isRequest(m)) return;
    dispatch(m, transportFor(m.credentials), fetcher, (progress) => channel.send({ id: m.id, progress } satisfies WorkerReply)).then(
      (data) => channel.send({ id: m.id, ok: true, data } satisfies WorkerReply),
      (e: unknown) => channel.send({
        id: m.id, ok: false,
        error: e instanceof TransportError ? { status: e.status, code: e.code, message: e.message } : { status: 0, code: 'WORKER_ERROR', message: String(e) },
      } satisfies WorkerReply),
    );
  });
}
