import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import type { CrashReports } from './crashReports.js';
import type { ReportInput } from './scrub.js';

interface ProcessLike {
  on(event: 'uncaughtExceptionMonitor', fn: (err: unknown, origin: string) => void): unknown;
  on(event: 'unhandledRejection', fn: (reason: unknown) => void): unknown;
}
interface GoneDetails { reason: string; exitCode: number; type?: string }
interface AppLike {
  on(event: 'render-process-gone', fn: (e: unknown, wc: unknown, details: GoneDetails) => void): unknown;
  on(event: 'child-process-gone', fn: (e: unknown, details: GoneDetails) => void): unknown;
}

const parts = (err: unknown): Pick<ReportInput, 'name' | 'message' | 'stack'> =>
  err instanceof Error ? { name: err.name, message: err.message, stack: err.stack } : { name: 'NonError', message: typeof err === 'string' ? err : typeof err };

// The monitor event observes without replacing Electron's own uncaught-exception handling.
export function installProcessHooks(reports: CrashReports, proc: ProcessLike, app: AppLike, onRejection: (reason: unknown) => void): void {
  proc.on('uncaughtExceptionMonitor', (err) => reports.capture({ kind: 'uncaught', process: 'main', ...parts(err) }));
  proc.on('unhandledRejection', (reason) => {
    onRejection(reason);
    reports.capture({ kind: 'unhandled_rejection', process: 'main', ...parts(reason) });
  });
  app.on('render-process-gone', (_e, _wc, d) => {
    if (d.reason !== 'clean-exit') reports.capture({ kind: 'process_gone', process: 'renderer', name: 'RenderProcessGone', message: `${d.reason} (exit ${d.exitCode})` });
  });
  app.on('child-process-gone', (_e, d) => {
    if (d.reason !== 'clean-exit') reports.capture({ kind: 'process_gone', process: d.type ?? 'unknown', name: 'ChildProcessGone', message: `${d.reason} (exit ${d.exitCode})` });
  });
}

function dumpsNewerThan(dir: string, since: number): number {
  let n = 0;
  let entries: string[] = [];
  try { entries = readdirSync(dir); } catch { return 0; }
  for (const name of entries) {
    const path = join(dir, name);
    try {
      const s = statSync(path);
      if (s.isDirectory()) n += dumpsNewerThan(path, since);
      else if (name.endsWith('.dmp') && s.mtimeMs > since) n += 1;
    } catch { /* removed while listing */ }
  }
  return n;
}

/**
 * Native crashes: crashpad writes minidumps locally and never uploads them, since they hold process memory. The next
 * start reports only that they happened.
 */
export function reportNativeCrashes(reports: CrashReports, dumpsDir: string, checkedAt: { get(): number; set(at: number): void }, now: number): void {
  try {
    const n = dumpsNewerThan(dumpsDir, checkedAt.get());
    checkedAt.set(now);
    if (n > 0) reports.capture({ kind: 'native', process: 'unknown', name: 'NativeCrash', message: `${n} native crash dump(s) since the last start; kept on this computer` });
  } catch { /* never in the way of starting */ }
}
