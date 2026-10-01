import { beforeEach, describe, expect, it } from 'vitest';
import { createGateway } from '../src/main/ipc/gateway.js';
import { testApp } from './helpers.js';
import type { App } from '../src/main/app.js';
import type { Db } from '@muneem/db-sqlite';

let app: App; let db: Db;
beforeEach(async () => { ({ app, db } = await testApp()); });

describe('IPC gateway pipeline (LLD §10.3)', () => {
  it('rejects unknown channels before any work', async () => {
    const r = await app.gateway.handle('executeSql', { sql: 'DROP TABLE business' }, 1);
    expect(r).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } });
  });
  it('rejects untrusted senders', async () => {
    const g = createGateway({ handlers: app.handlers, session: app.session, rbac: app.rbac, db: () => db, deviceId: () => 'd', loggers: { app: { warn() {}, error() {} } as never, sync: {} as never, hardware: {} as never, dir: '' }, events: app.events, connectivity: () => ({ online: false, serverSkewMs: null }), isTrustedSender: (id) => id === 7 });
    expect(await g.handle('auth.getSession', {}, 8)).toMatchObject({ ok: false, error: { code: 'PERMISSION_DENIED' } });
    expect(await g.handle('auth.getSession', {}, 7)).toEqual({ ok: true, data: null });
  });
  it('validates input with zod → VALIDATION_FAILED with field messages', async () => {
    const r = await app.gateway.handle('auth.login', { identifier: 'x', password: '' }, 1);
    expect(r).toMatchObject({ ok: false, error: { code: 'VALIDATION_FAILED', class: 'validation' } });
    expect((r as { error: { fields: Record<string, string> } }).error.fields).toHaveProperty('identifier');
  });
  it('requires a session for permissioned methods → NOT_AUTHENTICATED', async () => {
    expect(await app.gateway.handle('business.getBranches', {}, 1)).toMatchObject({ ok: false, error: { code: 'NOT_AUTHENTICATED', class: 'auth' } });
  });
  it('enforces permissions in main against the cached snapshot', async () => {
    await app.gateway.handle('auth.login', { identifier: '9999999999', password: 'correct-horse' }, 1);
    // logged in but no business yet → business.view fails
    expect(await app.gateway.handle('business.getBranches', {}, 1)).toMatchObject({ ok: false, error: { code: 'PERMISSION_DENIED' } });
    const c = await app.gateway.handle('business.create', { name: 'Shop', businessType: 'retail', stateCode: '07', taxScheme: 'regular' }, 1);
    expect(c.ok).toBe(true);
    expect(await app.gateway.handle('business.getBranches', {}, 1)).toEqual({ ok: true, data: [] });
  });
  it('applies grant limits (discount above cashier limit is denied)', async () => {
    await app.gateway.handle('auth.login', { identifier: '9999999999', password: 'correct-horse' }, 1);
    await app.gateway.handle('business.create', { name: 'Shop', businessType: 'retail', stateCode: '07', taxScheme: 'regular' }, 1);
    const s = app.session.require();
    db.prepare("UPDATE user_membership SET grants_json = ? WHERE user_id = ?").run(JSON.stringify([{ permission: 'settings.manage', limit: { maxDiscountBp: 500 } }, { permission: 'settings.view' }]), s.user.id);
    expect(() => app.rbac.assert(s, 'settings.manage', { discountBp: 600 })).toThrow(/limit/);
    expect(() => app.rbac.assert(s, 'settings.manage', { discountBp: 500 })).not.toThrow();
  });
  it('rate limits per channel and principal', async () => {
    let t = 0;
    const g = createGateway({ handlers: app.handlers, session: app.session, rbac: app.rbac, db: () => db, deviceId: () => 'd', loggers: { app: { warn() {}, error() {} } as never, sync: {} as never, hardware: {} as never, dir: '' }, events: app.events, connectivity: () => ({ online: false, serverSkewMs: null }), isTrustedSender: () => true, now: () => t });
    const results = [] as boolean[];
    for (let i = 0; i < 12; i++) results.push((await g.handle('device.getInfo', {}, 1)).ok); // perSec: 10
    expect(results.filter(Boolean).length).toBe(10);
    t += 1000;
    expect((await g.handle('device.getInfo', {}, 1)).ok).toBe(true);
  });
  it('writes an audit row for audit:true methods and pushes sync.status', async () => {
    const pushed: string[] = [];
    app.events.attach({ send: (ch) => pushed.push(ch) });
    await app.gateway.handle('auth.login', { identifier: '9999999999', password: 'correct-horse' }, 1);
    const rows = db.prepare("SELECT action FROM audit_log ORDER BY seq").all() as { action: string }[];
    expect(rows.map((r) => r.action)).toContain('ipc.auth.login');
    expect(pushed).toContain('sync.status');
    const after = db.prepare("SELECT after_json FROM audit_log WHERE action = 'ipc.auth.login'").get() as { after_json: string };
    expect(after.after_json).not.toContain('correct-horse'); // redacted
  });
  it('never leaks stack traces or SQL through the envelope', async () => {
    app.handlers['device.getInfo'] = () => { throw new Error('SELECT secret FROM users; near "x": syntax error'); };
    const r = await app.gateway.handle('device.getInfo', {}, 1);
    expect(r.ok).toBe(false);
    const err = (r as unknown as { error: Record<string, unknown> }).error;
    expect(err.code).toBe('INTERNAL');
    expect(JSON.stringify(err)).not.toMatch(/SELECT|stack|at /);
    expect(typeof err.requestId).toBe('string');
  });
  it('validates output too (a handler returning garbage cannot reach the renderer)', async () => {
    app.handlers['device.getInfo'] = () => ({ nope: 1 });
    expect((await app.gateway.handle('device.getInfo', {}, 1)).ok).toBe(false);
  });
});
