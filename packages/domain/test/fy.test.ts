import { describe, expect, it } from 'vitest';
import { dayBefore, financialYearOf, fyBounds, fyStartOf, monthEnd, monthStart, nextMonthStart } from '../src/index.js';

describe('financialYearOf', () => {
  it('April–March', () => {
    expect(financialYearOf('2026-04-01')).toBe('2026-27');
    expect(financialYearOf('2026-03-31')).toBe('2025-26');
    expect(financialYearOf('2026-09-26T10:00:00.000Z')).toBe('2026-27');
    expect(financialYearOf('2099-12-31')).toBe('2099-00');
  });
  it('bounds', () => expect(fyBounds('2026-27')).toEqual({ start: '2026-04-01', end: '2027-03-31' }));
});

describe('calendar helpers', () => {
  it('step months and days across year ends and leap years', () => {
    expect(monthEnd('2028-02-10')).toBe('2028-02-29');
    expect(monthEnd('2026-12-31')).toBe('2026-12-31');
    expect(monthStart('2026-07-19')).toBe('2026-07-01');
    expect(nextMonthStart('2026-12-05')).toBe('2027-01-01');
    expect(dayBefore('2027-01-01')).toBe('2026-12-31');
    expect(dayBefore('2028-03-01')).toBe('2028-02-29');
  });

  it('starts the financial year on 1 April', () => {
    expect(fyStartOf('2026-03-31')).toBe('2025-04-01');
    expect(fyStartOf('2026-04-01')).toBe('2026-04-01');
    expect(fyStartOf('2027-01-15')).toBe('2026-04-01');
  });
});
