import { createPrivateKey, sign as edSign } from 'node:crypto';
import { AppError, SYNC_HEADERS, SYNC_PROTOCOL_VERSION } from '@muneem/contracts';
import { newUlid } from '@muneem/domain';
import { deviceTimestamp, signingString } from './signing.js';
import type { Loggers } from './logger.js';

export interface CloudClientOptions {
  baseUrl: string;                 // e.g. http://localhost:8080/v1
  appVersion: string;
  schemaVersion: number;
  getDeviceId: () => string | null;
  getPrivateKeyPem: () => string | null;
  getAccessToken: () => string | null;
  onServerTime: (serverIso: string, skewMs: number) => void;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  loggers: Loggers;
}

export interface CloudResponse<T> { status: number; data: T; headers: Headers }

export class CloudError extends AppError {
  constructor(code: AppError['code'], message: string, readonly status: number, readonly body: unknown) { super(code, message); }
}

export class CloudClient {
  constructor(private readonly o: CloudClientOptions) {}

  get baseUrl(): string { return this.o.baseUrl; }

  async request<T>(method: 'GET' | 'POST' | 'PATCH' | 'DELETE', path: string, body?: unknown, opts: { auth?: boolean } = {}): Promise<CloudResponse<T>> {
    const url = new URL(this.o.baseUrl.replace(/\/$/, '') + path);
    const bodyText = body === undefined ? undefined : JSON.stringify(body);
    const ts = deviceTimestamp(); // unix seconds; must be byte-identical in the header and the signed string
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      [SYNC_HEADERS.appVersion]: this.o.appVersion,
      [SYNC_HEADERS.schemaVersion]: String(this.o.schemaVersion),
      [SYNC_HEADERS.syncProtocol]: String(SYNC_PROTOCOL_VERSION),
      [SYNC_HEADERS.requestId]: newUlid(),
      [SYNC_HEADERS.deviceTimestamp]: ts,
    };
    const deviceId = this.o.getDeviceId();
    const pem = this.o.getPrivateKeyPem();
    if (deviceId && pem) {
      headers[SYNC_HEADERS.deviceId] = deviceId;
      headers[SYNC_HEADERS.deviceSignature] = signRequest(pem, method, url.pathname, ts, bodyText);
    }
    if (opts.auth !== false) {
      const tok = this.o.getAccessToken();
      if (tok) headers.Authorization = `Bearer ${tok}`;
    }
    const f = this.o.fetchImpl ?? fetch;
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), this.o.timeoutMs ?? 15_000);
    let res: Response;
    try {
      res = await f(url, { method, headers, signal: ctrl.signal, ...(bodyText !== undefined && { body: bodyText }) });
    } catch (e) {
      this.o.loggers.sync.warn({ path, err: String(e) }, 'network unreachable');
      throw new AppError('NETWORK_UNREACHABLE', 'Cannot reach Muneem cloud');
    } finally {
      clearTimeout(t);
    }
    const serverTime = res.headers.get(SYNC_HEADERS.serverTime);
    if (serverTime) {
      const skew = Date.parse(serverTime) - Date.now();
      if (Number.isFinite(skew)) this.o.onServerTime(serverTime, skew);
    }
    const text = await res.text();
    let data: unknown = null;
    if (text) { try { data = JSON.parse(text); } catch { data = text; } }
    if (!res.ok) {
      const err = (data as { error?: { code?: string; message?: string } } | null)?.error;
      const code = mapStatus(res.status, err?.code);
      const message = code === 'DEVICE_CLOCK_SKEW' ? 'This computer\u2019s clock is more than 5 minutes off. Check the date and time, then try again.' : err?.message ?? `HTTP ${res.status}`;
      throw new CloudError(code, message, res.status, data);
    }
    return { status: res.status, data: data as T, headers: res.headers };
  }
}

export function signRequest(privateKeyPem: string, method: string, path: string, ts: string, body: string | undefined): string {
  const key = createPrivateKey(privateKeyPem);
  return edSign(null, Buffer.from(signingString(method, path, ts, body), 'utf8'), key).toString('base64');
}

function mapStatus(status: number, code?: string): AppError['code'] {
  if (code === 'UPGRADE_REQUIRED' || status === 426) return 'UPGRADE_REQUIRED';
  if (code === 'DEVICE_CLOCK_SKEW') return 'DEVICE_CLOCK_SKEW';
  if (status === 401) return code === 'DEVICE_REVOKED' ? 'DEVICE_REVOKED' : 'INVALID_CREDENTIALS';
  if (status === 403) return 'PERMISSION_DENIED';
  if (status === 404) return 'NOT_FOUND';
  if (status === 409) return 'ALREADY_EXISTS';
  if (status === 422 || status === 400) return 'VALIDATION_FAILED';
  if (status === 429) return 'RATE_LIMITED';
  if (status >= 500) return 'SERVER_BUSY';
  return 'INTERNAL';
}
