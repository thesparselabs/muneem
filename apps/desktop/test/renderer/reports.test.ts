import { describe, expect, it } from 'vitest';
import type { ReportDefinitionView } from '@muneem/contracts';
import { checkParams, defaultParams, formatCell, groupReports, periodLabel, runParams } from '../../src/renderer/src/lib/reports/reportForm.js';

const def = (over: Partial<ReportDefinitionView>): ReportDefinitionView => ({
  id: 'sales.byDay', title: 'Sales by day', group: 'Sales', columns: [],
  params: [{ key: 'from', label: 'From', kind: 'date', required: false }, { key: 'to', label: 'To', kind: 'date', required: false }, { key: 'branchId', label: 'Branch', kind: 'branch', required: false }],
  ...over,
});

describe('report form helpers', () => {
  it('groups reports in catalogue order', () => {
    const g = groupReports([def({ id: 'a', group: 'Accounts' }), def({ id: 'b', group: 'Sales' }), def({ id: 'c', group: 'Accounts' })]);
    expect(g.map((x) => [x.group, x.reports.map((r) => r.id)])).toEqual([['Accounts', ['a', 'c']], ['Sales', ['b']]]);
  });

  it('opens a range on the financial year to date and an as-of on today', () => {
    expect(defaultParams(def({}), '2026-10-04')).toEqual({ from: '2026-04-01', to: '2026-10-04', branchId: '' });
    expect(defaultParams(def({ params: [{ key: 'asOf', label: 'As of', kind: 'date', required: false }] }), '2026-02-10')).toEqual({ asOf: '2026-02-10' });
  });

  it('names missing and inverted fields, and sends only what is filled', () => {
    const ledger = def({ params: [{ key: 'partyId', label: 'Customer', kind: 'customer', required: true }, ...def({}).params] });
    expect(checkParams(ledger, { partyId: '', from: '2026-05-01', to: '2026-04-01' })).toEqual({ partyId: 'choose customer', from: 'after the end date' });
    expect(checkParams(ledger, { partyId: 'X', from: '2026-04-01', to: '2026-05-01' })).toEqual({});
    expect(runParams({ from: '2026-04-01', branchId: ' ', to: '2026-05-01 ' })).toEqual({ from: '2026-04-01', to: '2026-05-01' });
  });

  it('shows cells in the units the exports use', () => {
    expect(formatCell('money', 1_234_567)).toBe('₹12,345.67');
    expect(formatCell('qty', -1500)).toBe('-1.5');
    expect(formatCell('percent', 2_550)).toBe('25.50%');
    expect(formatCell('number', 7)).toBe('7');
    expect(formatCell('money', null)).toBe('');
    expect(periodLabel({ from: '2026-04-01', to: '2026-04-30' })).toBe('2026-04-01 to 2026-04-30');
    expect(periodLabel({ asOf: '2026-04-30' })).toBe('As of 2026-04-30');
  });
});
