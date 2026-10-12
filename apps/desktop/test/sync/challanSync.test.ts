import { describe, expect, it } from 'vitest';
import { newUlid } from '@muneem/domain';
import type { Challan, CompleteSaleResult, SaleQuote } from '@muneem/contracts';
import { saleDraftOf } from '../../src/main/services/challans/challanService.js';
import { caller, ownerAtTill } from '../helpers.js';
import { DEVICE_A, DEVICE_B, ownerMembership, referenceCloud, syncedDevice, syncUntilQuiet } from './syncHelpers.js';

const comparable = (c: Challan) => ({ ...c, consignee: c.customerId ? null : c.consignee });

describe('delivery challan sync (FR-087)', () => {
  it('challans made on one till reach another, which invoices the one sent for supply, and both see it invoiced', async () => {
    const cloud = referenceCloud();
    const a = await syncedDevice(cloud, DEVICE_A);
    const { businessId, branchId } = await ownerAtTill(a.app);
    const apiA = caller(a.app);
    const pcs = (await apiA.data<{ id: string; code: string }[]>('catalog.listUoms')).find((u) => u.code === 'PCS')!.id;
    const soap = (await apiA.data<{ id: string }>('products.create', { name: 'Lux Soap', baseUomId: pcs, gstRateBp: 1800, sellingPricePaise: 4130 })).id;
    const customerId = (await apiA.data<{ id: string }>('customers.create', { name: 'Gupta Traders', phone: '9876543210' })).id;
    const make = async (draft: Record<string, unknown>) => {
      const q = await apiA.data<SaleQuote>('sales.quote', saleDraftOf(draft as never));
      return apiA.data<Challan>('challans.create', { ...draft, commandId: newUlid(), expectedTotalPaise: q.totals.totalPaise });
    };
    const lines = [{ productId: soap, uomId: pcs, qtyMilli: 6000 }];
    const forSupply = await make({ purpose: 'supply', customerId, lines, transport: { mode: 'road', vehicleNo: 'DL01AB1234', distanceKm: 8 } });
    const forJobWork = await make({ purpose: 'job_work', consignee: { name: 'Ravi Job Works', gstin: '27AAAAA0000A1Z5' }, lines, transport: { mode: 'rail', docNo: 'RR-17' } });
    await syncUntilQuiet(a.app);
    expect(cloud.deadLetters(businessId)).toEqual([]);

    const b = await syncedDevice(cloud, DEVICE_B, () => [ownerMembership(businessId)]);
    const apiB = caller(b.app);
    await apiB.data('auth.login', { identifier: '9999999999', password: 'correct-horse' });
    await syncUntilQuiet(b.app);
    for (const made of [forSupply, forJobWork]) expect(comparable(await apiB.data<Challan>('challans.get', { id: made.id }))).toEqual(comparable(made));

    const t2 = await apiB.data<{ id: string }>('business.createTerminal', { branchId, code: 'T02', name: 'Till 2' });
    await apiB.data('business.selectTerminal', { terminalId: t2.id });
    await apiB.data('pos.openRegister', { openingCashPaise: 0 });
    const sale = await apiB.data<CompleteSaleResult>('sales.complete', {
      ...forSupply.draft, challanId: forSupply.id, commandId: newUlid(), expectedTotalPaise: forSupply.totals.totalPaise,
      tenders: [{ method: 'upi', amountPaise: forSupply.totals.totalPaise }],
    });
    await syncUntilQuiet(b.app);
    await syncUntilQuiet(a.app);
    expect(cloud.deadLetters(businessId)).toEqual([]);
    expect(await apiA.data<Challan>('challans.get', { id: forSupply.id })).toMatchObject({ status: 'billed', saleId: sale.saleId, saleDocNumber: sale.docNumber });
    expect((await apiA.data<Challan>('challans.get', { id: forJobWork.id })).status).toBe('open');
  });
});
