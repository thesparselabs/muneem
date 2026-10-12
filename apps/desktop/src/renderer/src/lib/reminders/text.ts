import type { DueReminder } from '@muneem/contracts';

const day = (iso: string): string => new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
const localDay = (timestamp: string): string => new Date(timestamp).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });

// Where a customer stands for a reminder, in the words the Reminders screen shows.
export function reminderStateText(r: Pick<DueReminder, 'state' | 'nextOn' | 'lastRemindedAt' | 'lastPaidOn'>): string {
  switch (r.state) {
    case 'due': return 'Due for a reminder';
    case 'no_consent': return 'No WhatsApp consent';
    case 'reminded_recently': return `Reminded ${localDay(r.lastRemindedAt!)} · next ${day(r.nextOn!)}`;
    case 'paid_recently': return `Paid ${day(r.lastPaidOn!)} · next ${day(r.nextOn!)}`;
  }
}

// A cadence the shopkeeper typed, if it is one the setting takes.
export function parseEveryDays(text: string): number | null {
  const n = Number(text.trim());
  return Number.isInteger(n) && n >= 1 && n <= 90 ? n : null;
}
