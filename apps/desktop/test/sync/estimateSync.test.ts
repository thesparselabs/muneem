import { describe, expect, it } from 'vitest';
import { newUlid } from '@muneem/domain';
import type { CompleteSaleResult, Estimate, SaleQuote } from '@muneem/contracts';
import { caller, ownerAtTill } from '../helpers.js';
import { DEVICE_A, DEVICE_B, ownerMembership, referenceCloud, syncedDevice, syncUntilQuiet } from './syncHelpers.js';

const comparable = (e: Estimate) => ({ ...e, customer: null });

describe('estimate sync (FR-086)', () => {
  it('an estimate made on one till reaches another, is billed there, and both see it converted', async () => {
    const cloud = referenceCloud();
    const a = await syncedDevice(cloud, DEVICE_A);
    const { businessId, branchId } = await ownerAtTill(a.app);
    const apiA = caller(a.app);
    const pcs = (await apiA.data<{ id: string; code: string }[]>('catalog.listUoms')).find((u) => u.code === 'PCS')!.id;
    const soap = (await apiA.data<{ id: string }>('products.create', { name: 'Lux Soap', baseUomId: pcs, gstRateBp: 1800, sellingPricePaise: 4130 })).id;
    const customerId = (await apiA.data<{ id: string }>('customers.create', { name: 'Gupta Traders', phone: '9876543210' })).id;
    const draft = { customerId, lines: [{ productId: soap, uomId: pcs, qtyMilli: 3000, lineDiscount: { kind: 'percent', value: 500 } }] };
    const q = await apiA.data<SaleQuote>('sales.quote', draft);
    const made = await apiA.data<Estimate>('estimates.create', { ...draft, commandId: newUlid(), expectedTotalPaise: q.totals.totalPaise, notes: 'Bulk rate' });
    await syncUntilQuiet(a.app);
    expect(cloud.deadLetters(businessId)).toEqual([]);

    const b = await syncedDevice(cloud, DEVICE_B, () => [ownerMembership(businessId)]);
    const apiB = caller(b.app);
    await apiB.data('auth.login', { identifier: '9999999999', password: 'correct-horse' });
    await syncUntilQuiet(b.app);
    const pulled = await apiB.data<Estimate>('estimates.get', { id: made.id });
    expect(comparable(pulled)).toEqual(comparable(made));
    expect(pulled.customer.name).toBe('Gupta Traders');

    const t2 = await apiB.data<{ id: string }>('business.createTerminal', { branchId, code: 'T02', name: 'Till 2' });
    await apiB.data('business.selectTerminal', { terminalId: t2.id });
    await apiB.data('pos.openRegister', { openingCashPaise: 0 });
    const sale = await apiB.data<CompleteSaleResult>('sales.complete', {
      ...pulled.draft, estimateId: pulled.id, commandId: newUlid(), expectedTotalPaise: pulled.totals.totalPaise,
      tenders: [{ method: 'upi', amountPaise: pulled.totals.totalPaise }],
    });
    await syncUntilQuiet(b.app);
    await syncUntilQuiet(a.app);
    expect(cloud.deadLetters(businessId)).toEqual([]);
    const seenOnA = await apiA.data<Estimate>('estimates.get', { id: made.id });
    expect(seenOnA).toMatchObject({ status: 'converted', saleId: sale.saleId, saleDocNumber: sale.docNumber });
    expect(comparable(seenOnA)).toEqual(comparable(await apiB.data<Estimate>('estimates.get', { id: made.id })));
  });
});
