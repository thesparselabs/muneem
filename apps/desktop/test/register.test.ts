import { beforeEach, describe, expect, it } from 'vitest';
import type { Db } from '@muneem/db-sqlite';
import type { App } from '../src/main/app.js';
import { caller, grantRole, ownerAtTill, testApp } from './helpers.js';

let app: App;
let db: Db;
let api: ReturnType<typeof caller>;

beforeEach(async () => {
  ({ app, db } = await testApp());
  api = caller(app);
  await ownerAtTill(app);
});

describe('register over IPC', () => {
  it('opens, records cash movements, reports and closes with a Z report', async () => {
    expect(await api.data('pos.getSession')).toBeNull();
    expect(await api.call('pos.xReport')).toMatchObject({ ok: false, error: { code: 'REGISTER_NOT_OPEN' } });
    await api.data('pos.openRegister', { openingCashPaise: 50_000 });
    await api.data('pos.cashMovement', { kind: 'cash_out', amountPaise: 2500, reason: 'courier' });
    expect(await api.data('pos.xReport')).toMatchObject({ expectedCashPaise: 47_500, final: false });
    const z = await api.data('pos.closeRegister', { countedCashPaise: 47_500, denominations: { '50000': 0, '2000': 20, '500': 15 } });
    expect(z).toMatchObject({ final: true, variancePaise: 0, sessionNo: 1 });
    expect(await api.data('pos.zReport')).toEqual(z);
  });

  it('refuses denominations that do not add up', async () => {
    await api.data('pos.openRegister', { openingCashPaise: 0 });
    expect(await api.call('pos.closeRegister', { countedCashPaise: 1000, denominations: { '500': 1 } }))
      .toMatchObject({ ok: false, error: { code: 'VALIDATION_FAILED' } });
  });

  it('a cashier cannot close with a large variance and sees no expected cash under blind close', async () => {
    await api.data('settings.set', { key: 'pos.blindClose', value: true });
    await api.data('pos.openRegister', { openingCashPaise: 50_000 });
    grantRole(db, app, 'cashier');
    expect(await api.data('pos.xReport')).toMatchObject({ expectedCashPaise: null });
    expect(await api.call('pos.closeRegister', { countedCashPaise: 20_000 })).toMatchObject({ ok: false, error: { code: 'PERMISSION_DENIED' } });
    grantRole(db, app, 'manager');
    expect(app.register.close({ countedCashPaise: 20_000 })).toMatchObject({ variancePaise: -30_000 }); // gateway allows one close per second
  });

  it('creates and finds customers', async () => {
    const c = await api.data<{ id: string; stateCode: string }>('customers.create', { name: 'Gupta Traders', gstin: '27AAAAA0000A1Z5' });
    expect(c.stateCode).toBe('27');
    expect(await api.data('customers.search', { query: 'gupta' })).toEqual([expect.objectContaining({ id: c.id })]);
    expect(await api.call('customers.create', { name: 'Clash', gstin: '27AAAAA0000A1Z5' })).toMatchObject({ ok: false, error: { code: 'ALREADY_EXISTS' } });
  });
});
