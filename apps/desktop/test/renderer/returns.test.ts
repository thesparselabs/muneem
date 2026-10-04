import { describe, expect, it } from 'vitest';
import type { ReturnQuote } from '@muneem/contracts';
import { matchesSearch, parseQuantities, returnLabel, wholeBill } from '../../src/renderer/src/lib/sales/returnForm.js';

const line = (lineNo: number, returnableQtyMilli: number, soldQtyMilli = 3000): ReturnQuote['lines'][number] => ({
  lineNo, name: `Item ${lineNo}`, uomCode: 'PCS', soldQtyMilli, returnedQtyMilli: soldQtyMilli - returnableQtyMilli, returnableQtyMilli, qtyMilli: 0,
  taxablePaise: 0, cgstPaise: 0, sgstPaise: 0, igstPaise: 0, cessPaise: 0, totalPaise: 0,
});
const quote = (lines: ReturnQuote['lines']): ReturnQuote => ({
  saleId: '01J00000000000000000000S01', saleDocNumber: 'T1/2627/000001', lines, taxablePaise: 0, cgstPaise: 0, sgstPaise: 0, igstPaise: 0, cessPaise: 0,
  roundOffPaise: 0, totalPaise: 0, creditPaise: 0, refundPaise: 0, refundMethod: 'cash', refundMethods: ['cash', 'upi', 'card'], outstandingPaise: 0, completesSale: false, issues: [],
});

describe('return dialog form', () => {
  it('prefills every line still returnable with all that is left', () => {
    expect(wholeBill(quote([line(1, 3000), line(2, 0), line(3, 1500)]))).toEqual({ 1: '3', 3: '1.5' });
  });

  it('turns typed quantities into lines, skipping empty ones and refusing more than is left', () => {
    const q = quote([line(1, 3000), line(2, 1000), line(3, 2000)]);
    expect(parseQuantities(q, { 1: '1.25', 2: '', 3: '0' })).toEqual({ lines: [{ lineNo: 1, qtyMilli: 1250 }], errors: {} });
    expect(parseQuantities(q, { 1: 'abc', 2: '2' }).errors).toEqual({ 1: 'enter a quantity', 2: 'only 1 PCS left' });
  });

  it('labels returned bills and finds a bill by number or customer', () => {
    expect([returnLabel({ returned: 'none' }), returnLabel({ returned: 'partial' }), returnLabel({ returned: 'full' })]).toEqual(['', 'Part returned', 'Returned']);
    expect(matchesSearch({ docNumber: 'T1/2627/000042', customerName: 'Meena Iyer' }, '0042')).toBe(true);
    expect(matchesSearch({ docNumber: 'T1/2627/000042', customerName: 'Meena Iyer' }, 'meena')).toBe(true);
    expect(matchesSearch({ docNumber: 'T1/2627/000042' }, 'ravi')).toBe(false);
  });
});
