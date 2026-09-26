import { describe, expect, it } from 'vitest';
import { financialYearOf, fyBounds } from '../src/index.js';

describe('financialYearOf', () => {
  it('April–March', () => {
    expect(financialYearOf('2026-04-01')).toBe('2026-27');
    expect(financialYearOf('2026-03-31')).toBe('2025-26');
    expect(financialYearOf('2026-09-26T10:00:00.000Z')).toBe('2026-27');
    expect(financialYearOf('2099-12-31')).toBe('2099-00');
  });
  it('bounds', () => expect(fyBounds('2026-27')).toEqual({ start: '2026-04-01', end: '2027-03-31' }));
});
