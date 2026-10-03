import { describe, expect, it } from 'vitest';
import {
  creditLimitText, customerFormToInput, emptySupplierForm, overdueOver30, parseCreditLimit, supplierFormToInput,
} from '../../src/renderer/src/lib/parties/forms.js';
import { summarise, toChoice, type GridItem } from '../../src/renderer/src/lib/payments/allocationGrid.js';

describe('supplier and customer forms', () => {
  it('takes the state from the GSTIN and names bad fields', () => {
    const r = supplierFormToInput({ ...emptySupplierForm('27'), name: 'Acme', gstin: '07aaaaa0000a1z5', creditDays: '30' });
    expect(r).toEqual({ ok: true, input: expect.objectContaining({ gstin: '07AAAAA0000A1Z5', stateCode: '07', creditDays: 30 }) });
    expect(supplierFormToInput({ ...emptySupplierForm('07'), name: '', creditDays: '3.5' })).toEqual({ ok: false, errors: { creditDays: 'whole days' } });
    expect(supplierFormToInput({ ...emptySupplierForm('07'), name: '' })).toMatchObject({ ok: false, errors: { name: expect.any(String) } });
  });

  it('leaves credit days out of a customer edit when the box is empty', () => {
    expect(customerFormToInput({ name: 'Ravi', phone: '', gstin: '', creditDays: '' })).toEqual({ ok: true, input: { name: 'Ravi' } });
  });

  it('reads an empty credit limit as no limit set', () => {
    expect(parseCreditLimit('')).toEqual({ ok: true, limitPaise: null });
    expect(parseCreditLimit('2500.50')).toEqual({ ok: true, limitPaise: 250_050 });
    expect(parseCreditLimit('abc')).toMatchObject({ ok: false });
    expect(creditLimitText(null)).toBe('');
    expect(creditLimitText(250_050)).toBe('2500.50');
  });

  it('counts what is more than 30 days overdue', () => {
    expect(overdueOver30({ notDuePaise: 1, days0to30Paise: 2, days31to60Paise: 4, days61to90Paise: 8, over90Paise: 16, advancePaise: 0, netPaise: 31 })).toBe(28);
  });
});

describe('allocation grid', () => {
  const items: GridItem[] = [
    { type: 'sale', id: 'B', docDate: '2026-09-10', dueDate: '2026-09-20', openPaise: 4000 },
    { type: 'opening', id: 'A', docDate: '2026-04-01', dueDate: '2026-04-01', openPaise: 6000 },
  ];

  it('auto previews oldest due first and shows the advance', () => {
    const s = summarise('auto', items, 7000, {});
    expect([...s.amounts]).toEqual([['A', 6000], ['B', 1000]]);
    expect(s).toMatchObject({ allocatedPaise: 7000, advancePaise: 0, errors: {} });
    expect(toChoice('auto', items, s)).toBe('auto');
    expect(summarise('auto', items, 15_000, {}).advancePaise).toBe(5000);
  });

  it('choose takes typed amounts, and names too much on an item or in total', () => {
    const s = summarise('choose', items, 5000, { B: '30', A: '' });
    expect(toChoice('choose', items, s)).toEqual([{ type: 'sale', id: 'B', amountPaise: 3000 }]);
    expect(s).toMatchObject({ allocatedPaise: 3000, advancePaise: 2000 });
    expect(summarise('choose', items, 5000, { B: '41' }).errors).toEqual({ B: 'more than is open' });
    expect(summarise('choose', items, 5000, { A: '40', B: '20' }).errors).toEqual({ total: 'allocations add up to more than the payment' });
    expect(summarise('choose', items, 5000, { A: 'x' }).errors).toEqual({ A: 'not an amount' });
  });
});
