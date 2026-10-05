import { mkdtempSync, utimesSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { contract, ROLE_PRESETS } from '@muneem/contracts';
import { CrashReports, storeUrl } from '../../src/main/telemetry/crashReports.js';
import { installProcessHooks, reportNativeCrashes } from '../../src/main/telemetry/hooks.js';
import type { CrashEvent } from '../../src/main/telemetry/scrub.js';
import { silentLoggers } from '../../src/main/infra/logger.js';
import { caller, ownerAtTill, testApp } from '../helpers.js';

const flush = () => new Promise((r) => setImmediate(r));

async function shop() {
  const sent: CrashEvent[] = [];
  const t = await testApp({ crashSend: async (e) => { sent.push(e); } });
  await ownerAtTill(t.app);
  return { ...t, sent, call: caller(t.app) };
}

describe('crash reporting consent (ADR-0053)', () => {
  it('sends nothing until the owner turns it on for the business, then reports and records when', async () => {
    const { app, sent, call } = await shop();
    app.telemetry.crashReports.capture({ kind: 'uncaught', process: 'main', name: 'Error', message: 'boom' });
    await flush();
    expect(sent).toHaveLength(0);
    expect(await call.data('diagnostics.crashReporting')).toEqual({ enabled: false, configured: true, lastSentAt: null });

    await call.data('settings.set', { key: 'telemetry.crashReports', value: true });
    await call.data('diagnostics.reportRendererError', { source: 'error', name: 'TypeError', message: "x of 'Ramesh Kumar'", stack: 'TypeError: x\n    at render (http://localhost/assets/index.js:10:2)' });
    await flush();
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ tags: { kind: 'renderer', process: 'renderer' }, exception: { values: [{ type: 'TypeError', value: 'x of "…"' }] } });
    expect(JSON.stringify(sent[0])).not.toContain('Ramesh');
    expect((await call.data<{ lastSentAt: string | null }>('diagnostics.crashReporting')).lastSentAt).not.toBeNull();
  });

  it('only the owner role can change the setting', () => {
    expect(contract['settings.set'].permission).toBe('settings.manage');
    const holders = Object.entries(ROLE_PRESETS).filter(([, grants]) => grants.some((g) => g.permission === 'settings.manage')).map(([role]) => role);
    expect(holders).toEqual(['owner']);
  });

  it('is off without a business, and without a collector address', async () => {
    const t = await testApp({ crashSend: async () => { throw new Error('must not send'); } });
    expect(t.app.telemetry.crashReports.status()).toMatchObject({ enabled: false });
    expect(storeUrl(null)).toBeNull();
    expect(storeUrl('http://key@crash.example.com/1')).toBeNull();
    expect(storeUrl('https://crash.example.com/1')).toBeNull();
    expect(storeUrl('https://abc123@crash.example.com/1')).toBe('https://crash.example.com/api/1/store/?sentry_key=abc123&sentry_version=7');
  });
});

describe('the reporter never gets in the way', () => {
  const reporter = (over: Partial<ConstructorParameters<typeof CrashReports>[0]> = {}) => {
    const sent: CrashEvent[] = [];
    let now = 0;
    const r = new CrashReports({
      enabled: () => true, send: async (e) => { sent.push(e); }, lastSent: () => null, recordSent: () => undefined, newId: () => 'id', now: () => now,
      log: silentLoggers().app,
      context: () => ({ appVersion: '1', schemaVersion: 1, os: 'linux', installation: '0123456789abcdef', environment: 'production' }), ...over,
    });
    return { r, sent, tick: (ms: number) => { now += ms; } };
  };

  it('swallows a failing consent check, context, sender or rejected send', async () => {
    const boom = () => { throw new Error('boom'); };
    expect(() => reporter({ enabled: boom }).r.capture({ kind: 'uncaught', process: 'main' })).not.toThrow();
    expect(() => reporter({ context: boom }).r.capture({ kind: 'uncaught', process: 'main' })).not.toThrow();
    expect(() => reporter({ send: boom as never }).r.capture({ kind: 'uncaught', process: 'main' })).not.toThrow();
    reporter({ send: () => Promise.reject(new Error('offline')) }).r.capture({ kind: 'uncaught', process: 'main' });
    await flush();
  });

  it('does not wait for the network', () => {
    const { r } = reporter({ send: () => new Promise(() => undefined) });
    const started = Date.now();
    r.capture({ kind: 'uncaught', process: 'main', message: 'x' });
    expect(Date.now() - started).toBeLessThan(50);
  });

  it('sends the same error once per 10 minutes and at most 10 an hour', () => {
    const { r, sent, tick } = reporter();
    for (let i = 0; i < 3; i++) r.capture({ kind: 'uncaught', process: 'main', message: 'same' });
    expect(sent).toHaveLength(1);
    tick(11 * 60_000);
    r.capture({ kind: 'uncaught', process: 'main', message: 'same' });
    expect(sent).toHaveLength(2);
    for (let i = 0; i < 20; i++) r.capture({ kind: 'uncaught', process: 'main', message: `different ${String.fromCharCode(97 + i)}` });
    expect(sent).toHaveLength(10);
  });
});

describe('process hooks', () => {
  type Fn = (...a: unknown[]) => void;
  const emitter = () => {
    const handlers = new Map<string, Fn>();
    return { on: (e: string, fn: Fn) => { handlers.set(e, fn); }, emit: (e: string, ...a: unknown[]) => handlers.get(e)!(...a) };
  };

  it('reports uncaught errors, rejections and gone processes, but not a clean exit', () => {
    const captured: unknown[] = [];
    const reports = { capture: (i: unknown) => captured.push(i) } as unknown as CrashReports;
    const proc = emitter();
    const app = emitter();
    const rejections: unknown[] = [];
    installProcessHooks(reports, proc as never, app as never, (r) => rejections.push(r));
    proc.emit('uncaughtExceptionMonitor', new RangeError('bad'), 'uncaughtException');
    proc.emit('unhandledRejection', 'plain string');
    app.emit('render-process-gone', {}, {}, { reason: 'crashed', exitCode: 11 });
    app.emit('child-process-gone', {}, { reason: 'clean-exit', exitCode: 0, type: 'Utility' });
    expect(captured).toEqual([
      expect.objectContaining({ kind: 'uncaught', process: 'main', name: 'RangeError', message: 'bad' }),
      { kind: 'unhandled_rejection', process: 'main', name: 'NonError', message: 'plain string' },
      expect.objectContaining({ kind: 'process_gone', process: 'renderer', message: 'crashed (exit 11)' }),
    ]);
    expect(rejections).toEqual(['plain string']);
  });

  it('reports only that native crashes happened since the last start', () => {
    const dir = mkdtempSync(join(tmpdir(), 'muneem-dumps-'));
    mkdirSync(join(dir, 'reports'));
    writeFileSync(join(dir, 'reports', 'old.dmp'), 'x');
    utimesSync(join(dir, 'reports', 'old.dmp'), new Date(1000), new Date(1000));
    writeFileSync(join(dir, 'reports', 'new.dmp'), 'x');
    const captured: { message?: string }[] = [];
    let checked = 5000;
    const marker = { get: () => checked, set: (at: number) => { checked = at; } };
    reportNativeCrashes({ capture: (i: { message?: string }) => captured.push(i) } as unknown as CrashReports, dir, marker, Date.now() + 1000);
    expect(captured).toEqual([expect.objectContaining({ kind: 'native', message: expect.stringMatching(/^1 native crash/u) })]);
    reportNativeCrashes({ capture: (i: { message?: string }) => captured.push(i) } as unknown as CrashReports, dir, marker, Date.now());
    expect(captured).toHaveLength(1);
  });
});
