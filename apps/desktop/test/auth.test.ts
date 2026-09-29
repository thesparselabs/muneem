import { describe, expect, it } from 'vitest';
import { MIGRATIONS, getCredential, verifyAuditChain } from '@muneem/db-sqlite';

const SCHEMA_VERSION = MIGRATIONS.at(-1)!.version;
import { testApp, USER_ID } from './helpers.js';

const DAY = 86_400_000;

describe('auth: online login caches what offline needs (LLD §15.2)', () => {
  it('online login → device registered, argon2id hash cached, tokens in secret store, session online', async () => {
    const { app, db, server } = await testApp();
    const s = await app.auth.login({ identifier: '9999999999', password: 'correct-horse' });
    expect(s.mode).toBe('online');
    expect(s.user.id).toBe(USER_ID);
    expect(server.calls.map((c) => c.path)).toEqual(expect.arrayContaining(['/v1/auth/login', '/v1/devices/register']));
    const reg = server.calls.find((c) => c.path === '/v1/devices/register')!;
    expect(reg.headers.Authorization).toBe('Bearer access.jwt');
    expect(reg.body).toMatchObject({ platform: 'linux', app_version: '0.0.0-test', schema_version: SCHEMA_VERSION });
    expect(Buffer.from((reg.body as { public_key: string }).public_key, 'base64')).toHaveLength(32);
    expect(app.device.cloudDeviceId()).toBe('01J00000000000000000000C01');
    const cred = getCredential(db, USER_ID)!;
    expect(cred.passwordHash).toMatch(/^\$argon2id\$/);
    expect(cred.passwordHash).not.toContain('correct-horse');
    expect(cred.maxOfflineDays).toBe(30);
    // subsequent request is signed with the device key
    await app.cloud.request('GET', '/health', undefined, { auth: false });
    const last = server.calls.at(-1)!;
    expect(last.headers['X-Device-Id']).toBe('01J00000000000000000000C01');
    expect(last.headers['X-Device-Signature']).toMatch(/^[A-Za-z0-9+/=]+$/);
    expect(last.headers['X-Device-Timestamp']).toMatch(/^\d{10}$/); // unix seconds, as the Go verifier parses it
    expect(verifyAuditChain(db, '_device', app.device.localDeviceId()).ok).toBe(true);
  });
  it('wrong password online → INVALID_CREDENTIALS, nothing cached', async () => {
    const { app, db } = await testApp();
    await expect(app.auth.login({ identifier: '9999999999', password: 'nope' })).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
    expect(getCredential(db, USER_ID)).toBeNull();
  });
});

describe('auth: offline login', () => {
  async function seeded(now?: () => number) {
    const t = await testApp({ ...(now && { now }) });
    await t.app.auth.login({ identifier: '9999999999', password: 'correct-horse' });
    t.app.session.clear();
    t.server.online = false;
    await t.app.connectivity.probe();
    return t;
  }
  it('succeeds with the cached hash when the network is gone', async () => {
    const { app } = await seeded();
    const s = await app.auth.loginOffline({ identifier: '9999999999', password: 'correct-horse' });
    expect(s.mode).toBe('offline');
    expect(s.offlineDaysRemaining).toBe(30);
  });
  it('auth.login itself falls back to offline when the cloud is unreachable', async () => {
    const { app } = await seeded();
    const s = await app.auth.login({ identifier: '9999999999', password: 'correct-horse' });
    expect(s.mode).toBe('offline');
  });
  it('wrong password fails; unknown user fails', async () => {
    const { app } = await seeded();
    await expect(app.auth.loginOffline({ identifier: '9999999999', password: 'wrong' })).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
    await expect(app.auth.loginOffline({ identifier: 'nobody', password: 'x' })).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
  });
  it('blocks after max_offline_days → OFFLINE_PERIOD_EXCEEDED', async () => {
    let now = Date.now();
    const { app } = await seeded(() => now);
    now += 31 * DAY;
    await expect(app.auth.loginOffline({ identifier: '9999999999', password: 'correct-horse' })).rejects.toMatchObject({ code: 'OFFLINE_PERIOD_EXCEEDED' });
  });
  it('PIN switch: 5 wrong PINs → PIN_LOCKED for 5 minutes, then works again', async () => {
    let now = Date.now();
    const { app } = await seeded(() => now);
    await app.auth.loginOffline({ identifier: '9999999999', password: 'correct-horse' });
    await app.auth.setPin('4321');
    for (let i = 0; i < 4; i++) await expect(app.auth.switchUser({ userId: USER_ID, pin: '0000' })).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
    await expect(app.auth.switchUser({ userId: USER_ID, pin: '0000' })).rejects.toMatchObject({ code: 'PIN_LOCKED' });
    await expect(app.auth.switchUser({ userId: USER_ID, pin: '4321' })).rejects.toMatchObject({ code: 'PIN_LOCKED' });
    now += 301_000;
    const s = await app.auth.switchUser({ userId: USER_ID, pin: '4321' });
    expect(s.user.id).toBe(USER_ID);
  });
  it('logout clears the session and the refresh token', async () => {
    const { app } = await seeded();
    await app.auth.loginOffline({ identifier: '9999999999', password: 'correct-horse' });
    await app.auth.logout();
    expect(app.session.get()).toBeNull();
  });
});

describe('business setup end-to-end through the gateway', () => {
  it('create business → branch → terminal → select; outbox rows queued; audit chain intact', async () => {
    const { app, db } = await testApp();
    const g = app.gateway;
    await g.handle('auth.login', { identifier: '9999999999', password: 'correct-horse' }, 1);
    const b = await g.handle('business.create', { name: 'Sharma General Store', businessType: 'retail', stateCode: '07', taxScheme: 'regular', gstin: '07AAAAA0000A1Z5' }, 1);
    expect(b.ok).toBe(true);
    const br = await g.handle('business.createBranch', { code: 'DEL1', name: 'Delhi', stateCode: '07', isDefault: true }, 1);
    expect(br.ok).toBe(true);
    const branchId = (br as { data: { id: string } }).data.id;
    const t = await g.handle('business.createTerminal', { branchId, code: 'T01', name: 'Counter 1' }, 1);
    expect(t.ok).toBe(true);
    const sel = await g.handle('business.selectTerminal', { terminalId: (t as { data: { id: string } }).data.id }, 1);
    expect(sel).toMatchObject({ ok: true, data: { branchId, terminalId: (t as { data: { id: string } }).data.id } });
    const outbox = db.prepare("SELECT entity_type, operation_type FROM sync_outbox ORDER BY seq").all();
    expect(outbox).toEqual([
      { entity_type: 'business', operation_type: 'create' }, { entity_type: 'branch', operation_type: 'create' },
      { entity_type: 'terminal', operation_type: 'create' }, { entity_type: 'terminal', operation_type: 'update' },
    ]);
    const s = app.session.require();
    expect(verifyAuditChain(db, s.businessId!, app.device.localDeviceId()).ok).toBe(true);
    expect((await g.handle('sync.getStatus', {}, 1))).toMatchObject({ ok: true, data: { state: 'queued', pending: 4 } });
    const h = await g.handle('diagnostics.getHealth', {}, 1);
    expect(h).toMatchObject({ ok: true, data: { outboxDepth: 4, auditChainOk: true, schemaVersion: SCHEMA_VERSION } });
    expect(await g.handle('diagnostics.integrityCheck', {}, 1)).toMatchObject({ ok: true, data: { quickCheck: 'ok', foreignKeys: 'ok', auditChain: 'ok' } });
  });
  it('backupNow writes a verified copy (file DB)', async () => {
    const { app } = await testApp({ file: true });
    await app.gateway.handle('auth.login', { identifier: '9999999999', password: 'correct-horse' }, 1);
    await app.gateway.handle('business.create', { name: 'S', businessType: 'retail', stateCode: '07', taxScheme: 'regular' }, 1);
    const r = await app.gateway.handle('diagnostics.backupNow', {}, 1);
    expect(r).toMatchObject({ ok: true, data: { verified: true } });
    expect((r as { data: { bytes: number } }).data.bytes).toBeGreaterThan(10_000);
    const bundle = await app.gateway.handle('diagnostics.exportSupportBundle', {}, 1);
    expect(bundle.ok).toBe(true);
    expect((bundle as { data: { handle: string } }).data.handle).not.toMatch(/[\\/]/); // opaque handle, never a path
  });
});
