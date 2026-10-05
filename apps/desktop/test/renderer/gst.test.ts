import { describe, expect, it } from 'vitest';
import { challanFromCash, EMPTY_CHALLAN, monthLabel, parseChallan, previousMonth, recentMonths, utilisationRows } from '../../src/renderer/src/lib/gst/gstForm.js';

describe('GST screens', () => {
  it('lists months newest first across a year end, and names them', () => {
    expect(recentMonths('2026-02-14', 4)).toEqual(['2026-02-01', '2026-01-01', '2025-12-01', '2025-11-01']);
    expect(previousMonth('2026-04-03')).toBe('2026-03-01');
    expect(monthLabel('2026-05-01')).toBe('May 2026');
  });

  it('reads a challan in rupees per head and refuses an empty or unreadable one', () => {
    expect(parseChallan({ ...EMPTY_CHALLAN, cgstPaise: '1,234.50', sgstPaise: '1234.5' })).toEqual({ heads: { igstPaise: 0, cgstPaise: 123_450, sgstPaise: 123_450, cessPaise: 0 } });
    expect(parseChallan(EMPTY_CHALLAN)).toEqual({ error: 'Enter the tax paid' });
    expect(parseChallan({ ...EMPTY_CHALLAN, igstPaise: 'abc' })).toEqual({ error: 'IGST is not an amount' });
    expect(challanFromCash({ igstPaise: 0, cgstPaise: 56_844, sgstPaise: 5, cessPaise: 0 })).toEqual({ igstPaise: '', cgstPaise: '568.44', sgstPaise: '0.05', cessPaise: '' });
  });

  it('shows only the moves the set-off made', () => {
    expect(utilisationRows({ igstToIgstPaise: 0, igstToCgstPaise: 32_400, igstToSgstPaise: 0, cgstToCgstPaise: 0, cgstToIgstPaise: 0, sgstToSgstPaise: 0, sgstToIgstPaise: 0, cessToCessPaise: 1_800 }))
      .toEqual([{ from: 'IGST', to: 'CGST', paise: 32_400 }, { from: 'Cess', to: 'Cess', paise: 1_800 }]);
  });
});
