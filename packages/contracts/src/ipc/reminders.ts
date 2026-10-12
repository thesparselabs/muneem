import { z } from 'zod';
import { BusinessDate, IsoDateTime, Ulid } from './schemas.js';

// FR-088 (ADR-0070): a customer past due is reminded over WhatsApp, with consent, at most once per cadence and not
// straight after they paid.
export const REMINDER_DEFAULT_EVERY_DAYS = 7;
export const REMINDER_STATES = ['due', 'reminded_recently', 'paid_recently', 'no_consent'] as const;
export const ReminderState = z.enum(REMINDER_STATES);
export type ReminderState = z.infer<typeof ReminderState>;

export const DueReminder = z.object({
  customerId: Ulid,
  name: z.string(),
  phone: z.string().optional(),
  overduePaise: z.number().int(),
  balancePaise: z.number().int(),
  oldestDueDate: BusinessDate,
  daysOverdue: z.number().int(),
  documents: z.number().int(),
  lastRemindedAt: IsoDateTime.optional(),
  lastPaidOn: BusinessDate.optional(),
  // When the next reminder may go, for one not due today.
  nextOn: BusinessDate.optional(),
  state: ReminderState,
});
export type DueReminder = z.infer<typeof DueReminder>;

export const DueReminders = z.object({ everyDays: z.number().int(), items: z.array(DueReminder) });
export type DueReminders = z.infer<typeof DueReminders>;

export const ReminderPreview = z.object({ to: z.string(), message: z.string(), fileName: z.string() });
export type ReminderPreview = z.infer<typeof ReminderPreview>;

export const SendReminderInput = z.object({
  customerId: Ulid,
  to: z.string().trim().min(1).max(30),
  message: z.string().trim().min(1).max(1000),
});
export type SendReminderInput = z.infer<typeof SendReminderInput>;

export const ReminderRecord = z.object({
  id: Ulid,
  customerId: Ulid,
  customerName: z.string(),
  channel: z.literal('whatsapp'),
  to: z.string(),
  overduePaise: z.number().int(),
  balancePaise: z.number().int(),
  oldestDueDate: BusinessDate,
  shareId: Ulid,
  fileName: z.string(),
  createdAt: IsoDateTime,
});
export type ReminderRecord = z.infer<typeof ReminderRecord>;

export const ReminderHistoryInput = z.object({ customerId: Ulid.optional(), limit: z.number().int().min(1).max(200).default(50) });
export type ReminderHistoryInput = z.infer<typeof ReminderHistoryInput>;
