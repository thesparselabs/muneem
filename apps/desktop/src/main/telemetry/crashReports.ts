import type { CrashReportingStatus } from '@muneem/contracts';
import type { Logger } from '../infra/logger.js';
import { fingerprint, toEvent, type CrashEvent, type ReportContext, type ReportInput } from './scrub.js';

export type CrashSend = (event: CrashEvent) => Promise<void>;

export interface CrashReportsDeps {
  enabled: () => boolean;
  context: () => ReportContext;
  send: CrashSend | null;
  lastSent: () => string | null;
  recordSent: (iso: string) => void;
  newId: () => string;
  now: () => number;
  log: Logger;
}

// The release build bakes the DSN in (9e); outside a vite build (scripts, the crash child) import.meta.env is absent.
export const DEFAULT_CRASH_DSN: string | null = import.meta.env?.MAIN_VITE_CRASH_DSN || null;

const MAX_PER_HOUR = 10;
const SAME_ERROR_WINDOW_MS = 10 * 60_000;

/** NFR-025: sends a scrubbed report when the business opted in. Never throws into the app and never makes it wait. */
export class CrashReports {
  private sentAt: number[] = [];
  private seen = new Map<string, number>();
  constructor(private readonly d: CrashReportsDeps) {}

  capture(input: ReportInput): void {
    try {
      if (!this.d.send || !this.safeEnabled()) return;
      const now = this.d.now();
      const event = toEvent(input, this.d.context(), this.d.newId(), now);
      if (!this.admit(fingerprint(event), now)) return;
      void this.d.send(event).then(() => this.d.recordSent(new Date(now).toISOString()))
        .catch((e: unknown) => this.d.log.warn({ err: String(e) }, 'crash report not sent'));
    } catch (e) {
      try { this.d.log.warn({ err: String(e) }, 'crash report not built'); } catch { /* the logger itself failed */ }
    }
  }

  status(): CrashReportingStatus {
    return { enabled: this.safeEnabled(), configured: this.d.send !== null, lastSentAt: this.d.lastSent() };
  }

  private safeEnabled(): boolean {
    try { return this.d.enabled(); } catch { return false; }
  }

  private admit(key: string, now: number): boolean {
    this.sentAt = this.sentAt.filter((t) => now - t < 3_600_000);
    const last = this.seen.get(key);
    if (this.sentAt.length >= MAX_PER_HOUR || (last !== undefined && now - last < SAME_ERROR_WINDOW_MS)) return false;
    this.sentAt.push(now);
    this.seen.set(key, now);
    return true;
  }
}

/** The collector's store endpoint from a Sentry DSN (https://<key>@<host>/<project>); null when unset or malformed. */
export function storeUrl(dsn: string | undefined | null): string | null {
  if (!dsn) return null;
  try {
    const u = new URL(dsn);
    const project = u.pathname.replace(/^\/+|\/+$/gu, '');
    const local = u.hostname === 'localhost' || u.hostname === '127.0.0.1';
    if (!u.username || !/^\d+$/u.test(project) || (u.protocol !== 'https:' && !(local && u.protocol === 'http:'))) return null;
    return `${u.protocol}//${u.host}/api/${project}/store/?sentry_key=${encodeURIComponent(u.username)}&sentry_version=7`;
  } catch { return null; }
}

export function httpCrashSend(url: string, fetchImpl: typeof fetch, timeoutMs = 5000): CrashSend {
  return async (event) => {
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), timeoutMs);
    try {
      const r = await fetchImpl(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(event), signal: abort.signal });
      if (!r.ok) throw new Error(`the crash collector answered ${r.status}`);
    } finally { clearTimeout(timer); }
  };
}
