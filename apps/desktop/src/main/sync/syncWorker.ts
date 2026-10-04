import { MessageChannelMain, utilityProcess, type MessagePortMain, type UtilityProcess } from 'electron';
import type { Loggers } from '../infra/logger.js';
import type { Credentials } from './transport.js';
import { UtilityTransport } from './utilityTransport.js';
import type { Channel, WorkerConfig } from './workerProtocol.js';

const RESPAWN_DELAY_MS = 5_000;

// Forks the sync utility process over a fresh MessageChannel; if it dies, its calls fail as unreachable and a new one is forked.
export function startSyncWorker(entry: string, config: WorkerConfig, credentials: () => Credentials | null, log: Loggers['sync']): { transport: UtilityTransport; stop(): void } {
  const listeners: ((message: unknown) => void)[] = [];
  let port: MessagePortMain | null = null;
  let child: UtilityProcess | null = null;
  let stopped = false;
  const channel: Channel = { send: (m) => port?.postMessage(m), onMessage: (l) => listeners.push(l) };
  const transport = new UtilityTransport(channel, credentials);

  const spawn = (): void => {
    const { port1, port2 } = new MessageChannelMain();
    port1.on('message', (e) => { for (const l of listeners) l(e.data); });
    port1.start();
    port = port1;
    child = utilityProcess.fork(entry, [], { serviceName: 'Muneem sync' });
    child.postMessage({ config }, [port2]);
    child.once('exit', (code) => {
      log.warn({ code }, 'sync worker exited');
      transport.failAll('sync worker exited');
      port1.close();
      if (!stopped) setTimeout(spawn, RESPAWN_DELAY_MS).unref();
    });
  };
  spawn();
  return { transport, stop: () => { stopped = true; child?.kill(); } };
}
