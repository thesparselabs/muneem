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

describe('held bills', () => {
  it('holds a cart, lists it, blocks closing, and gives it back once', async () => {
    const pcs = (await api.data<{ id: string; code: string }[]>('catalog.listUoms')).find((u) => u.code === 'PCS')!.id;
    const p = await api.data<{ id: string }>('products.create', { name: 'Soap', baseUomId: pcs, sellingPricePaise: 1000 });
    expect(await api.call('pos.holdBill', { cart: { lines: [{ productId: p.id, uomId: pcs, qtyMilli: 1000 }] } })).toMatchObject({ ok: false, error: { code: 'REGISTER_NOT_OPEN' } });
    await api.data('pos.openRegister', { openingCashPaise: 0 });
    const held = await api.data<{ id: string; lineCount: number }>('pos.holdBill', { label: 'Mrs Rao', cart: { lines: [{ productId: p.id, uomId: pcs, qtyMilli: 3000 }] } });
    expect(held).toMatchObject({ lineCount: 1, label: 'Mrs Rao' });
    expect(await api.data('pos.listHeldBills')).toHaveLength(1);
    expect(await api.call('pos.closeRegister', { countedCashPaise: 0 })).toMatchObject({ ok: false, error: { message: expect.stringContaining('held bills') } });
    const back = await api.data<{ cart: { lines: { qtyMilli: number }[] } }>('pos.retrieveBill', { id: held.id });
    expect(back.cart.lines[0]!.qtyMilli).toBe(3000);
    expect(await api.call('pos.retrieveBill', { id: held.id })).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } });
    expect(await api.data('pos.listHeldBills')).toEqual([]);
  });
});
