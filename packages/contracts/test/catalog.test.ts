import { describe, expect, it } from 'vitest';
import { PriceItemList } from '../src/index.js';

const UOM = '01J0000000000000000000PCS0';
const item = (over: Record<string, unknown> = {}) => ({ uomId: UOM, pricePaise: 100, effectiveFrom: '2026-10-01', ...over });
const issues = (items: unknown[]) => {
  const r = PriceItemList.safeParse(items);
  return r.success ? {} : Object.fromEntries(r.error.issues.map((i) => [i.path.join('.'), i.message]));
};

describe('PriceItemList', () => {
  it('accepts an open-ended price and a closed window', () => {
    expect(issues([item(), item({ minQtyMilli: 12_000, effectiveTo: '2026-12-31' })])).toEqual({});
  });
  it('rejects an end date on or before the start date', () => {
    expect(issues([item({ effectiveTo: '2026-10-01' })])).toEqual({ '0.effectiveTo': 'must be after the "from" date' });
  });
  it('rejects two rows for the same unit, quantity and start date', () => {
    expect(issues([item(), item({ pricePaise: 90 })])).toEqual({ '1.effectiveFrom': 'same unit, quantity and date as row 1' });
  });
});
