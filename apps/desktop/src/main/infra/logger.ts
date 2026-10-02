import pino, { type Logger } from 'pino';
import { existsSync, mkdirSync, renameSync, statSync } from 'node:fs';
import { join } from 'node:path';

export type { Logger };
const MAX_BYTES = 5 * 1024 * 1024;
const KEEP = 5;

/** Size-based rotation at open time; simple and dependency-free (no worker-thread transports in Electron main). */
function rotate(path: string): void {
  if (!existsSync(path) || statSync(path).size < MAX_BYTES) return;
  for (let i = KEEP - 1; i >= 1; i--) {
    const from = `${path}.${i}`;
    if (existsSync(from)) renameSync(from, `${path}.${i + 1}`);
  }
  renameSync(path, `${path}.1`);
}

export interface Loggers { app: Logger; sync: Logger; hardware: Logger; dir: string }

export function createLoggers(logDir: string, level = 'info'): Loggers {
  mkdirSync(logDir, { recursive: true });
  const make = (name: string) => {
    const file = join(logDir, `${name}.log`);
    rotate(file);
    return pino({ level, base: { log: name }, timestamp: pino.stdTimeFunctions.isoTime }, pino.destination({ dest: file, sync: false, mkdir: true }));
  };
  return { app: make('app'), sync: make('sync'), hardware: make('hardware'), dir: logDir };
}

export function silentLoggers(): Loggers {
  const l = pino({ level: 'silent' });
  return { app: l, sync: l, hardware: l, dir: '' };
}
