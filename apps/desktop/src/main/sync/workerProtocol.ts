import { TransportError, type Credentials, type Transport } from './transport.js';

// The utility process only does HTTP, gzip and signing with what main hands it (HLD §3.1); main alone touches SQLite.
export interface WorkerConfig { baseUrl: string; appVersion: string; schemaVersion: number; timeoutMs?: number }
export type WorkerOp = 'push' | 'pull' | 'bootstrap';
export interface WorkerRequest { id: number; op: WorkerOp; arg: unknown; credentials: Credentials | null }
export type WorkerReply = { id: number; ok: true; data: unknown } | { id: number; ok: false; error: { status: number; code: string; message: string } };

// A message port, whichever kind: Electron's MessagePortMain in the app, Node's MessagePort in tests.
export interface Channel { send(message: unknown): void; onMessage(listener: (message: unknown) => void): void }

const isRequest = (m: unknown): m is WorkerRequest => !!m && typeof m === 'object' && typeof (m as WorkerRequest).id === 'number' && typeof (m as WorkerRequest).op === 'string';

// The worker side: each request is sent with the credentials main attached to it.
export function serveTransport(channel: Channel, transportFor: (credentials: Credentials | null) => Transport): void {
  channel.onMessage((m) => {
    if (!isRequest(m)) return;
    const t = transportFor(m.credentials);
    const call = m.op === 'push' ? t.push(m.arg as never) : m.op === 'pull' ? t.pull(m.arg as never) : t.bootstrap(m.arg as never);
    call.then(
      (data) => channel.send({ id: m.id, ok: true, data } satisfies WorkerReply),
      (e: unknown) => channel.send({
        id: m.id, ok: false,
        error: e instanceof TransportError ? { status: e.status, code: e.code, message: e.message } : { status: 0, code: 'WORKER_ERROR', message: String(e) },
      } satisfies WorkerReply),
    );
  });
}
