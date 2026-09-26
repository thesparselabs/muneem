import { ZodError, type z } from 'zod';
import { AppError, contract, type Channel, type ClientError, type Contract, type IpcEnvelope, type Session } from '@muneem/contracts';
import { newUlid } from '@muneem/domain';
import { appendAudit, readSyncStatus, withTransaction, type Db } from '@muneem/db-sqlite';
import type { Loggers } from '../infra/logger.js';
import type { SessionService } from '../services/session.js';
import type { Rbac } from '../rbac.js';
import type { EventBus } from '../infra/events.js';

/** Audit scope for events that happen before any business exists (login, device setup). */
export const DEVICE_AUDIT_SCOPE = '_device';

/** Handler input is the PARSED (z.output) shape; output is re-validated by the gateway. */
export type Handler<C extends Channel> = (input: z.output<Contract[C]['input']>, ctx: Session | null) => unknown;
export type Handlers = { [C in Channel]: Handler<C> };

export interface GatewayDeps {
  handlers: Handlers;
  session: SessionService;
  rbac: Rbac;
  db: () => Db;
  deviceId: () => string;
  loggers: Loggers;
  events: EventBus;
  connectivity: () => { online: boolean; serverSkewMs: number | null };
  isTrustedSender: (senderId: number) => boolean;
  now?: () => number;
}

/** Token bucket per (channel, principal). */
class RateLimiter {
  private buckets = new Map<string, { tokens: number; at: number }>();
  constructor(private readonly now: () => number) {}
  hit(channel: string, principal: string, perSec: number): void {
    const key = `${channel}|${principal}`;
    const t = this.now();
    const b = this.buckets.get(key) ?? { tokens: perSec, at: t };
    b.tokens = Math.min(perSec, b.tokens + ((t - b.at) / 1000) * perSec);
    b.at = t;
    if (b.tokens < 1) { this.buckets.set(key, b); throw new AppError('RATE_LIMITED', 'Too many requests'); }
    b.tokens -= 1;
    this.buckets.set(key, b);
  }
}

const REDACT = /pass|pin|token|secret|otp/i;
function redact(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(redact);
  if (v && typeof v === 'object') {
    const o: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v as Record<string, unknown>)) o[k] = REDACT.test(k) ? '[redacted]' : redact(x);
    return o;
  }
  return v;
}

export function toClientError(e: unknown, requestId: string, log: Loggers['app']): ClientError {
  if (e instanceof AppError) return { code: e.code, class: e.class, message: e.message, ...(e.fields && { fields: e.fields }), requestId };
  if (e instanceof ZodError) {
    const fields: Record<string, string> = {};
    for (const i of e.issues) fields[i.path.join('.') || '_'] = i.message;
    return { code: 'VALIDATION_FAILED', class: 'validation', message: 'Invalid input', fields, requestId };
  }
  const msg = e instanceof Error ? e.message : String(e);
  if (/UNIQUE constraint/.test(msg)) return { code: 'ALREADY_EXISTS', class: 'business_rule', message: 'Already exists', requestId };
  if (msg === 'NOT_FOUND') return { code: 'NOT_FOUND', class: 'business_rule', message: 'Not found', requestId };
  if (msg === 'VERSION_CONFLICT') return { code: 'INVALID_STATE', class: 'business_rule', message: 'Changed elsewhere; reload and retry', requestId };
  log.error({ requestId, err: e instanceof Error ? { message: e.message, stack: e.stack } : e }, 'unhandled error in IPC');
  return { code: 'INTERNAL', class: 'permanent', message: 'Something went wrong. Reference: ' + requestId, requestId };
}

/** LLD §10.3 pipeline: sender check → contract lookup → validate → session → RBAC → rate-limit → dispatch → audit → envelope. */
export function createGateway(d: GatewayDeps) {
  const limiter = new RateLimiter(d.now ?? (() => Date.now()));

  async function handle(channel: string, raw: unknown, senderId: number): Promise<IpcEnvelope<unknown>> {
    const requestId = newUlid();
    const t0 = performance.now();
    try {
      if (!d.isTrustedSender(senderId)) throw new AppError('PERMISSION_DENIED', 'untrusted sender');
      const spec = (contract as Record<string, (typeof contract)[Channel] | undefined>)[channel];
      if (!spec) throw new AppError('NOT_FOUND', 'unknown channel');
      const input = spec.input.parse(raw ?? {});
      let ctx: Session | null = d.session.get();
      if (spec.permission !== null) {
        ctx = d.session.require();
        d.rbac.assert(ctx, spec.permission, input);
      }
      limiter.hit(channel, ctx?.user.id ?? 'anon', spec.rateLimit.perSec);
      const out = await (d.handlers[channel as Channel] as (i: unknown, c: Session | null) => unknown)(input, ctx);
      if (spec.audit) {
        const after = d.session.get();
        const businessId = after?.businessId ?? ctx?.businessId ?? DEVICE_AUDIT_SCOPE;
        const userId = after?.user.id ?? ctx?.user.id ?? 'anonymous';
        withTransaction(d.db(), () => {
          appendAudit(d.db(), { businessId, deviceId: d.deviceId(), userId, terminalId: after?.terminalId ?? null, action: `ipc.${channel}`, entityType: channel.split('.')[0]!, after: redact(input) });
        });
        const c = d.connectivity();
        d.events.emit('sync.status', readSyncStatus(d.db(), c.online, c.serverSkewMs));
      }
      return { ok: true, data: spec.output.parse(out) };
    } catch (e) {
      return { ok: false, error: toClientError(e, requestId, d.loggers.app) };
    } finally {
      const ms = performance.now() - t0;
      if (ms > 250) d.loggers.app.warn({ channel, ms: Math.round(ms) }, 'slow IPC');
    }
  }
  return { handle };
}

export function registerIpc(ipcMain: { handle(channel: string, listener: (event: { sender: { id: number } }, ...args: any[]) => any): void }, gateway: ReturnType<typeof createGateway>): void {
  for (const channel of Object.keys(contract)) {
    ipcMain.handle(channel, (event, raw) => gateway.handle(channel, raw, event.sender.id));
  }
}
