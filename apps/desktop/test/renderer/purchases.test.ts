import { describe, expect, it } from 'vitest';
import type { PurchaseQuote, Uom } from '@muneem/contracts';
import { billCheck, emptyPurchaseForm, formToDraft, lineFor, returnLines, unitsOf } from '../../src/renderer/src/lib/purchases/form.js';
import { emptyExpenseForm, expenseFormToInput, gstAllowed } from '../../src/renderer/src/lib/expenses/form.js';

const PCS = '01J0000000000000000000PCS0';
const BOX = '01J0000000000000000000B0X0';
const uoms = [{ id: PCS, code: 'PCS' }, { id: BOX, code: 'BOX' }] as Uom[];
const soap = { id: '01J000000000000000000S0AP0', name: 'Soap', baseUomId: PCS, conversions: [{ id: 'CONV', fromUomId: BOX, toUomId: PCS, factorMilli: 12_000 }], gstRateBp: 1800 };

describe('purchase form', () => {
  it('offers the base unit and every unit the product converts from', () => {
    expect(unitsOf(soap, uoms)).toEqual([{ id: PCS, code: 'PCS' }, { id: BOX, code: 'BOX' }]);
  });

  it('turns the form into a draft, defaulting GST to the product rate', () => {
    const form = { ...emptyPurchaseForm('2026-10-04'), supplierId: 'S', invoiceNo: ' INV-1 ', billTotal: '1180', charges: [{ kind: 'freight' as const, amount: '50' }],
      lines: [{ ...lineFor(soap, uoms), qty: '10', rate: '100', discountPct: '5' }] };
    const r = formToDraft(form);
    expect(r).toMatchObject({ ok: true, draft: {
      supplierInvoiceNo: 'INV-1', billTotalPaise: 118_000, charges: [{ kind: 'freight', amountPaise: 5000 }],
      lines: [{ uomId: PCS, qtyMilli: 10_000, unitPricePaise: 10_000, gstRateBp: 1800, lineDiscount: { kind: 'percent', value: 500 }, itcEligible: true }],
    } });
  });

  it('names every field that does not parse', () => {
    const form = { ...emptyPurchaseForm('2026-10-04'), billTotal: 'x', lines: [{ ...lineFor(soap, uoms), qty: '0', rate: '', gstRate: '120' }] };
    expect(formToDraft(form)).toEqual({ ok: false, errors: {
      supplierId: 'choose the supplier', invoiceNo: 'enter the bill number', 'lines.0.qty': 'quantity above zero', 'lines.0.rate': 'enter the rate',
      'lines.0.gstRate': 'a percent from 0 to 100', billTotal: 'the grand total printed on the bill',
    } });
  });

  it('fills a form line from an imported line', () => {
    expect(lineFor(soap, uoms, { productId: soap.id, uomId: BOX, qtyMilli: 2000, unitPricePaise: 120_000, priceIsInclusive: false, lineDiscount: { kind: 'percent', value: 250 } }))
      .toMatchObject({ uomId: BOX, qty: '2', rate: '1200.00', discountPct: '2.5', gstRate: '18' });
  });

  it('says whether the bill total fits', () => {
    const q = (diff?: number, ok?: boolean) => ({ totals: { computedTotalPaise: 154_250 }, ...(diff !== undefined && { billDifferencePaise: diff, billTotalOk: ok }) }) as PurchaseQuote;
    expect(billCheck(q(0, true))).toEqual({ tone: 'ok', text: 'Matches the bill' });
    expect(billCheck(q(-50, true)).text).toContain('round-off');
    expect(billCheck(q(-250, false))).toMatchObject({ tone: 'bad', text: expect.stringContaining('₹1,542.50') });
    expect(billCheck(q()).tone).toBe('none');
  });

  it('collects what is going back and refuses more than is left', () => {
    const rows = [{ purchaseItemId: 'L1', name: 'Rice', uomCode: 'PCS', leftMilli: 2000, qty: '2' }, { purchaseItemId: 'L2', name: 'Soap', uomCode: 'PCS', leftMilli: 5000, qty: '' }];
    expect(returnLines(rows)).toEqual({ ok: true, lines: [{ purchaseItemId: 'L1', qtyMilli: 2000 }] });
    expect(returnLines([{ ...rows[0]!, qty: '2.001' }])).toEqual({ ok: false, error: 'Only 2 PCS of Rice is left to return' });
    expect(returnLines([rows[1]!])).toEqual({ ok: false, error: 'Enter what is going back' });
  });
});

describe('expense form', () => {
  it('offers GST only with a GSTIN and sends the vendor only without a supplier', () => {
    const f = { ...emptyExpenseForm('2026-10-04', 'C'), amount: '118', gstRate: '18', vendorName: 'Airtel', vendorGstin: '07ddddd0000d1z5' };
    expect(gstAllowed(f, false)).toBe(true);
    expect(expenseFormToInput(f, 'CMD', false)).toEqual({ ok: true, input: expect.objectContaining({
      amountPaise: 11_800, gstRateBp: 1800, itcEligible: true, vendorName: 'Airtel', vendorGstin: '07DDDDD0000D1Z5',
    }) });
    expect(expenseFormToInput({ ...f, vendorGstin: '' }, 'CMD', false)).toEqual({ ok: true, input: expect.not.objectContaining({ gstRateBp: expect.anything() }) });
  });

  it('needs a supplier for credit and an amount', () => {
    expect(expenseFormToInput({ ...emptyExpenseForm('2026-10-04', 'C'), method: 'credit' }, 'CMD', false))
      .toEqual({ ok: false, errors: { supplierId: expect.any(String), amount: 'enter the amount' } });
  });
});
