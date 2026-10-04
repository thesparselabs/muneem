// Electron utility process entry (7d): HTTP, gzip and request signing for sync. It never opens the database.
import { HttpTransport } from '../main/sync/httpTransport.js';
import { serveTransport, type Channel, type WorkerConfig } from '../main/sync/workerProtocol.js';

interface PortMain { on(event: 'message', listener: (e: { data: unknown }) => void): void; postMessage(message: unknown): void; start(): void }
interface ParentPort { once(event: 'message', listener: (e: { data: unknown; ports: PortMain[] }) => void): void }

const parentPort = (process as unknown as { parentPort?: ParentPort }).parentPort;

parentPort?.once('message', (e) => {
  const { config } = e.data as { config: WorkerConfig };
  const port = e.ports[0];
  if (!port) return;
  const channel: Channel = { send: (m) => port.postMessage(m), onMessage: (listener) => port.on('message', (ev) => listener(ev.data)) };
  serveTransport(channel, (credentials) => new HttpTransport({ ...config, credentials: () => credentials }));
  port.start();
});
