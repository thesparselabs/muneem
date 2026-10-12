import { describe, expect, it } from 'vitest';
import type { Challan } from '@muneem/contracts';
import { challanStatusText, emptyChallanForm, formToDraft, quoteDraftOf, type ChallanForm } from '../../src/renderer/src/lib/challans/form.js';
import { billableChallan } from '../../src/renderer/src/lib/pos/retrieve.js';

const P = '01J00000000000000000000P01';
const U = '01J00000000000000000000U01';
const line = (qty: string) => ({ productId: P, name: 'Soap', units: [{ id: U, code: 'PCS' }], uomId: U, qty });

describe('challan form', () => {
  it('turns a consignee typed by hand and the transport into a draft', () => {
    const f: ChallanForm = {
      ...emptyChallanForm(), purpose: 'job_work', consigneeName: ' Ravi Job Works ', consigneeGstin: '27aaaaa0000a1z5', lines: [line('5')],
      mode: 'rail', vehicleNo: ' ', distanceKm: '120', docNo: 'RR-17',
    };
    expect(formToDraft(f)).toEqual({
      ok: true,
      draft: {
        purpose: 'job_work', consignee: { name: 'Ravi Job Works', gstin: '27AAAAA0000A1Z5' }, lines: [{ productId: P, uomId: U, qtyMilli: 5000 }],
        transport: { mode: 'rail', distanceKm: 120, docNo: 'RR-17' },
      },
    });
  });

  it('names what is missing or does not parse', () => {
    expect(formToDraft(emptyChallanForm())).toEqual({ ok: false, errors: { lines: 'add at least one product', consignee: 'choose a customer or type the consignee' } });
    expect(formToDraft({ ...emptyChallanForm(), customer: { id: 'c1', name: 'Gupta' }, lines: [line('0')], distanceKm: '1.5' })).toEqual({
      ok: false, errors: { 'lines.0.qty': 'quantity above zero', distanceKm: 'whole kilometres, 0 to 4000' },
    });
  });

  it('values a challan the way main does: no discounts, and a consignee GSTIN sets the place of supply', () => {
    const lines = [{ productId: P, uomId: U, qtyMilli: 1000 }];
    expect(quoteDraftOf({ purpose: 'job_work', consignee: { name: 'R', gstin: '27AAAAA0000A1Z5' }, lines, transport: { mode: 'road' } })).toEqual({
      lines: [{ ...lines[0], lineDiscount: { kind: 'amount', value: 0 } }], billDiscount: { kind: 'amount', value: 0 },
      placeOfSupplyOverride: { stateCode: '27', reason: 'Consignee GSTIN' },
    });
    expect(quoteDraftOf({ purpose: 'supply', customerId: 'c1', consignee: { name: 'ignored', gstin: '27AAAAA0000A1Z5' }, lines, transport: { mode: 'road' } }))
      .not.toHaveProperty('placeOfSupplyOverride');
  });

  it('tells which challans the till can invoice', () => {
    const c = (over: Partial<Challan>) => ({ id: 'h1', docNumber: 'DE01H/2627/00002', purpose: 'supply', status: 'open', draft: {}, totals: { totalPaise: 100 }, ...over }) as Challan;
    expect(billableChallan(c({}))).toEqual({ id: 'h1', docNumber: 'DE01H/2627/00002', draft: {}, totalPaise: 100 });
    expect(billableChallan(c({ status: 'billed', saleDocNumber: 'DE01/2627/000010' })).refusal).toBe('Challan DE01H/2627/00002 was already invoiced as DE01/2627/000010.');
    expect(billableChallan(c({ purpose: 'job_work' })).refusal).toBe('Challan DE01H/2627/00002 was sent for job work; only a challan for supply is invoiced.');
    expect([challanStatusText({ status: 'open' }), challanStatusText({ status: 'billed', saleDocNumber: 'DE01/2627/000010' })]).toEqual(['Open', 'Invoiced as DE01/2627/000010']);
  });
});
