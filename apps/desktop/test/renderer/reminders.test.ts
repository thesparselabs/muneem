import { describe, expect, it } from 'vitest';
import { parseEveryDays, reminderStateText } from '../../src/renderer/src/lib/reminders/text.js';

describe('reminders screen text', () => {
  it('says where each customer stands for a reminder', () => {
    expect(reminderStateText({ state: 'due' })).toBe('Due for a reminder');
    expect(reminderStateText({ state: 'no_consent' })).toBe('No WhatsApp consent');
    expect(reminderStateText({ state: 'paid_recently', lastPaidOn: '2026-09-21', nextOn: '2026-09-28' })).toBe('Paid 21 Sept · next 28 Sept');
    expect(reminderStateText({ state: 'reminded_recently', lastRemindedAt: new Date(2026, 8, 21, 12).toISOString(), nextOn: '2026-09-28' }))
      .toBe('Reminded 21 Sept · next 28 Sept');
  });

  it('takes a cadence of 1 to 90 whole days', () => {
    expect(['7', ' 30 ', '1', '90'].map(parseEveryDays)).toEqual([7, 30, 1, 90]);
    expect(['0', '91', '2.5', '', 'x'].map(parseEveryDays)).toEqual([null, null, null, null, null]);
  });
});
