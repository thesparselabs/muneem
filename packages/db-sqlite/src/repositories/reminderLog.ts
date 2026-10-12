import type { ReminderRecord } from '@muneem/contracts';
import type { Db } from '../open.js';
import { stmt } from '../statements.js';

// FR-088 (ADR-0070): what a reminder needs to know about a customer beyond their dues, and the record of each one sent.
export interface NewReminder {
  id: string; businessId: string; customerId: string; recipient: string; shareId: string; overduePaise: number; balancePaise: number;
  oldestDueDate: string; createdBy: string;
}

export function insertReminder(db: Db, r: NewReminder, at: string): void {
  stmt(db, `INSERT INTO reminder_log (id, business_id, customer_id, channel, recipient, share_id, overdue_paise, balance_paise, oldest_due_date, created_by, created_at)
    VALUES (@id, @businessId, @customerId, 'whatsapp', @recipient, @shareId, @overduePaise, @balancePaise, @oldestDueDate, @createdBy, @at)`).run({ ...r, at });
}

type Row = {
  id: string; customer_id: string; customer_name: string; recipient: string; share_id: string; file_name: string; overdue_paise: number;
  balance_paise: number; oldest_due_date: string; created_at: string;
};
const toRecord = (r: Row): ReminderRecord => ({
  id: r.id, customerId: r.customer_id, customerName: r.customer_name, channel: 'whatsapp', to: r.recipient, shareId: r.share_id, fileName: r.file_name,
  overduePaise: r.overdue_paise, balancePaise: r.balance_paise, oldestDueDate: r.oldest_due_date, createdAt: r.created_at,
});

export function listReminders(db: Db, businessId: string, f: { customerId?: string | undefined; limit: number }): ReminderRecord[] {
  return (stmt(db, `SELECT r.*, c.name AS customer_name, s.file_name FROM reminder_log r JOIN customer c ON c.id = r.customer_id JOIN share_log s ON s.id = r.share_id
    WHERE r.business_id = @businessId AND (@customerId IS NULL OR r.customer_id = @customerId)
    ORDER BY r.created_at DESC, r.id DESC LIMIT @limit`).all({ businessId, customerId: f.customerId ?? null, limit: f.limit }) as Row[]).map(toRecord);
}

export const lastReminderAt = (db: Db, businessId: string, customerId: string): string | null =>
  (stmt(db, 'SELECT MAX(created_at) FROM reminder_log WHERE business_id = ? AND customer_id = ?').pluck().get(businessId, customerId) as string | null) ?? null;

// The last day the customer paid anything that still stands.
export const lastReceiptOn = (db: Db, businessId: string, customerId: string): string | null =>
  (stmt(db, `SELECT MAX(payment_date) FROM payment WHERE business_id = ? AND party_type = 'customer' AND party_id = ? AND direction = 'in' AND status = 'posted'`)
    .pluck().get(businessId, customerId) as string | null) ?? null;

// ADR-0050: a reminder needs the customer's standing consent for reminders on that channel.
export const hasReminderConsent = (db: Db, customerId: string, channel: 'whatsapp' | 'sms'): boolean =>
  stmt(db, `SELECT 1 FROM customer_consent WHERE customer_id = ? AND purpose = 'payment_reminders' AND channel = ? AND withdrawn_at IS NULL`)
    .get(customerId, channel) !== undefined;
