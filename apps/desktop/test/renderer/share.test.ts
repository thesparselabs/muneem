import { describe, expect, it } from 'vitest';
import { hasPending, shareOutcome } from '../../src/renderer/src/lib/share/shareText.js';

describe('share dialog text', () => {
  it('tells the user what happened and what to do next', () => {
    const r = { to: '+919876543210', fileName: 'invoice-DE01_2627_000042.pdf' };
    expect(shareOutcome({ ...r, status: 'opened' })).toEqual({
      text: 'WhatsApp opened for +919876543210. Attach invoice-DE01_2627_000042.pdf from your Downloads folder, then press send.', variant: 'success',
    });
    expect(shareOutcome({ ...r, to: 'meena@example.com', status: 'sent' })).toEqual({ text: 'Emailed to meena@example.com.', variant: 'success' });
    expect(shareOutcome({ ...r, to: 'meena@example.com', status: 'queued' }).variant).toBe('info');
    expect(shareOutcome({ ...r, status: 'failed', lastError: 'to must be one email address' })).toEqual({ text: 'Not sent: to must be one email address.', variant: 'error' });
  });

  it('keeps refreshing the history only while an email is still on its way', () => {
    expect(hasPending([{ status: 'sent' }, { status: 'opened' }])).toBe(false);
    expect(hasPending([{ status: 'sent' }, { status: 'queued' }])).toBe(true);
    expect(hasPending([{ status: 'sending' }])).toBe(true);
  });
});
